"""`uv run --env-file ../.env python -m agentes.correlacion` desde `central/`."""

from agentes import ejecutor
from agentes.correlacion import agente
from agentes.triaje.jev import Jev

ejecutor.correr(
    agente="correlacion",
    consume="reporte_priorizado",
    produce="incidente_actualizado",
    procesar=agente.procesar(Jev()),
)
