# Agente de coordinación

**Hito:** 3 · **Ficha:** `docs/fichas-agentes/coordinacion.md`

## Alcance

Proponer acciones por incidente para el coordinador humano, con el recurso que usarían (ambulancia, equipo de rescate…), y marcarlas como ejecutadas solo tras `POST /incidentes/{id}/aprobacion`. Cuántas unidades hay disponibles lo calcula la vista con lo que registra y reporta cada entidad en `POST /recursos/unidades`; aprobar solo solicita el recurso.

## No le toca

Ejecutar cualquier acción sin aprobación humana.
