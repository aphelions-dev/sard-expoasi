# Central y agentes

**Dueño:** Persona 2 (@lufigir) · **Rama:** `p2/central-agentes`

Stack: Python 3.12 + FastAPI + SQLite, con [uv](https://docs.astral.sh/uv/).

## Cómo correrla

Desde `central/`, con el `.env` de la raíz (copia de `.env.example` con `JEV_API_KEY`):

```bash
uv sync
uv run --env-file ../.env python iniciar.py A     # central A completa en :8001 (API + 4 agentes)
uv run --env-file ../.env python iniciar.py B     # central B completa en :8002, en otra terminal
uv run pytest                                     # pruebas
```

Ctrl+C en la terminal de una central la apaga entera: así se muestra la caída en la demo. Cada
pieza también se puede levantar sola (`uvicorn api.main:app --port 8001`,
`python -m agentes.triaje`, `agentes.correlacion`, `agentes.coordinacion`, `agentes.resiliencia`).

Cada agente es un proceso aparte (patrón pizarra): lee del registro de eventos lo que le falta
procesar y escribe su resultado como evento nuevo. Si uno cae, los demás siguen, y al volver
retoma lo pendiente. Se pueden correr dos copias de un mismo agente sin duplicar resultados.
El ejecutor común está en `agentes/ejecutor.py`.

| Variable | Por defecto | Qué es |
|----------|-------------|--------|
| `SARD_NODO` | `A` | Qué central es (`A` o `B`) |
| `SARD_DB` | `datos/central-<nodo>.sqlite` | Base de la instancia |
| `JEV_API_KEY` | — | Clave de Jev; sin ella el triaje y la correlación quedan solo con reglas |
| `CENTRAL_A_URL`, `CENTRAL_B_URL` | `http://localhost:8001` y `:8002` | Dónde está cada central, para sincronizarse y para el relevo |

## Centrales A y B

Las dos corren a la vez. El agente de resiliencia de cada una copia cada segundo los eventos de
la otra (`GET /eventos`) y los une por id; como el registro solo crece, la unión no tiene
conflictos. Los agentes de la B esperan mientras la A responda a `/salud`: si la A cae, la B
procesa lo que le llega (la pasarela le manda a la B), y cuando la A vuelve, trae lo que hizo
la B y retoma. Probado con Jev real: caída de la A, reporte y aprobación en la B, vuelta de la A,
y `GET /incidentes` igual en las dos.

Para dos computadores, poner en el `.env` de cada uno las URLs reales de las dos centrales.

## Estructura

| Carpeta | Contenido |
|---------|-----------|
| `api/` | Endpoints de `contracts/api-central.md` |
| `agentes/` | Una subcarpeta por agente, cada una con su README de alcance |
| `protocolo/` | Lectura y validación de SARD1 |
| `registro/` | Registro de eventos (solo agrega) |
| `vista/` | Incidentes para el tablero, calculados a partir de los eventos |
| `iniciar.py` | Levanta una central completa |
| `datos/` | Base local y registro de eventos (los `.sqlite` no se suben) |
| `tests/` | Pruebas; las de protocolo y API usan `contracts/ejemplos/` |
| `sesgo/` | Prueba de sesgo del triaje: el mismo suceso escrito de varias formas (`sesgo/README.md`) |
| `demo/` | Recorrido de la demo en la parte de la central (pasos 4, 5, 7 y 8): hace de pasarela, `python -m demo.recorrido` |

## Registro de eventos

Una tabla `eventos` en SQLite (modo WAL) donde cada fila es un hecho: `id` global (uuid), `nodo`
que lo creó, `tipo`, `reporte_id`, `causa` (el evento que lo originó) y `datos` en JSON. Triggers
en la base rechazan cualquier `UPDATE` o `DELETE` (ADR 0003), y un índice único impide registrar
dos veces el mismo reporte.

| Tipo | Lo escribe | Cuándo |
|------|-----------|--------|
| `reporte_recibido` | Recepción | Llega un SARD1 válido con id nuevo |
| `reporte_duplicado` | Recepción | Llega otra vez un id ya registrado (guarda la pasarela, para contar rutas) |
| `reporte_rechazado` | Recepción | El mensaje no cumple el protocolo (guarda los motivos) |
| `reporte_priorizado` | Triaje | Prioridad final, la de reglas y la de Jev, evidencia, fuente (directa, de oídas) y motivos de revisión |
| `incidente_actualizado` | Correlación | El reporte abre un incidente o se vincula a uno (similitud, posibles vínculos, contradicciones) |
| `accion_propuesta` | Coordinación | Entidad, acción, justificación y lo que falta confirmar; queda pendiente |
| `decision_humana` | API (coordinador) | Aprobación o rechazo de la propuesta vigente |
| `agente_error` | Cualquier agente | Un agente falló con un evento; se reintenta |
| `par_caido`, `par_recuperado` | Resiliencia | La otra central dejó de responder o volvió |
| `recurso_declarado` | API (coordinador) | Cuántas unidades hay de un recurso (`POST /recursos`); reemplaza la declaración anterior |

## Decisiones provisionales del contrato

Mientras `contracts/protocolo-sard1.md` las tenga «por definir», la central hace esto:

- **`|` dentro del texto:** todo lo que sigue al campo 7 es texto, aunque tenga `|`.
- **Longitud del texto:** no se recorta en la central; el límite lo pone la malla.
- **Mensaje mal formado:** se rechaza sin `SACK` y queda como `reporte_rechazado`.
- **`jev` en `/salud`:** el estado del último reporte que el triaje le mandó a Jev; si todavía no
  hay ninguno, si hay clave configurada.

## Alcance

API, registro de eventos (solo agrega), agentes de recepción, triaje (reglas + Jev), correlación,
coordinación y resiliencia (central B y sincronización).

## No le toca

App Android, malla, tablero, simulador.

## Dependencias

- Recibe mensajes SARD1 de la pasarela (Persona 1).
- Entrega `GET /incidentes` y `POST /incidentes/{id}/aprobacion` al tablero (Persona 3).
- Persona 3 la prueba con el simulador y los reportes sintéticos.
- Jev (TypeSafe AI) vía `JEV_API_KEY`.

## Tareas por hito

- **Hito 1:** API y registro de eventos que acepte SARD1.
- **Hito 2:** agente de recepción (valida, deduplica, devuelve `SACK`).
- **Hito 3:** triaje (reglas + Jev), correlación y coordinación.
- **Hito 4:** central B y sincronización desde el registro de eventos.
- **Hito 5:** fichas de agentes finales y apoyo en la demo.

## Terminado

Acepta cada id una sola vez, prioriza con reglas aunque Jev esté caído, no ejecuta nada sin
aprobación, y la central B retoma desde el registro de eventos sin perder reportes.
