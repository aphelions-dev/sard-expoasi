"""`uv run --env-file ../.env python -m agentes.triaje` desde `central/`."""

from agentes import ejecutor
from agentes.triaje import agente, jev

ejecutor.correr(
    agente="triaje",
    consume="reporte_recibido",
    produce="reporte_priorizado",
    procesar=agente.procesar(jev.Jev()),
)
