# Central y agentes

**Dueño:** Persona 2 (@lufigir) · **Rama:** `p2/central-agentes`

Stack: Python 3.12 + FastAPI + SQLite, con [uv](https://docs.astral.sh/uv/).

## Cómo correrla

Desde `central/`, con el `.env` de la raíz (copia de `.env.example` con `JEV_API_KEY`):

```bash
uv sync
uv run --env-file ../.env uvicorn api.main:app --port 8001                 # central A
SARD_NODO=B uv run --env-file ../.env uvicorn api.main:app --port 8002     # central B
uv run pytest                                                              # pruebas
```

| Variable | Por defecto | Qué es |
|----------|-------------|--------|
| `SARD_NODO` | `A` | Qué central es (`A` o `B`) |
| `SARD_DB` | `datos/central-<nodo>.sqlite` | Base de la instancia |
| `JEV_API_KEY` | — | Clave de Jev; sin ella el triaje queda solo con reglas |

## Estructura

| Carpeta | Contenido |
|---------|-----------|
| `api/` | Endpoints de `contracts/api-central.md` |
| `agentes/` | Una subcarpeta por agente, cada una con su README de alcance |
| `protocolo/` | Lectura y validación de SARD1 |
| `registro/` | Registro de eventos (solo agrega) |
| `datos/` | Base local y registro de eventos (los `.sqlite` no se suben) |
| `tests/` | Pruebas; las de protocolo y API usan `contracts/ejemplos/` |

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
| `reporte_priorizado` | Triaje | Por implementar (#11) |
| `incidente_actualizado` | Correlación | Por implementar (#12) |

## Decisiones provisionales del contrato

Mientras `contracts/protocolo-sard1.md` las tenga «por definir», la central hace esto:

- **`|` dentro del texto:** todo lo que sigue al campo 7 es texto, aunque tenga `|`.
- **Longitud del texto:** no se recorta en la central; el límite lo pone la malla.
- **Mensaje mal formado:** se rechaza sin `SACK` y queda como `reporte_rechazado`.
- **`jev` en `/salud`:** por ahora solo indica si hay clave configurada; refleja el estado real
  cuando exista el agente de triaje.

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
