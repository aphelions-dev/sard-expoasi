# Central y agentes

**Dueño:** Persona 2 (@lufigir) · **Rama:** `p2/central-agentes`

Stack propuesto (**a confirmar**): Python + FastAPI + SQLite.

## Estructura

| Carpeta | Contenido |
|---------|-----------|
| `api/` | Endpoints de `contracts/api-central.md` |
| `agentes/` | Una subcarpeta por agente, cada una con su README de alcance |
| `datos/` | Base local y registro de eventos (los `.sqlite` no se suben) |

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
