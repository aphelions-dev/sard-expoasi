"""`uv run --env-file ../.env python -m agentes.coordinacion` desde `central/`."""

from agentes import ejecutor
from agentes.coordinacion import agente

ejecutor.correr(
    agente="coordinacion",
    consume="incidente_actualizado",
    produce="accion_propuesta",
    procesar=agente.procesar,
)
