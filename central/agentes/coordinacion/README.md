# Agente de coordinación

**Hito:** 3 · **Ficha:** `docs/fichas-agentes/coordinacion.md`

## Alcance

Proponer acciones por incidente para el coordinador humano, con el recurso que usarían (ambulancia, equipo de rescate…), y marcarlas como ejecutadas solo tras `POST /incidentes/{id}/aprobacion`. Cuántas unidades quedan lo calcula la vista con lo que declara el coordinador en `POST /recursos`.

## No le toca

Ejecutar cualquier acción sin aprobación humana.
