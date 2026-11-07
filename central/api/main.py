"""API de la central (`contracts/api-central.md`).

Arranque: `uv run --env-file ../.env uvicorn api.main:app --port 8001` desde `central/`.
"""

import sqlite3
from collections.abc import Iterator
from contextlib import asynccontextmanager
from typing import Annotated, Literal

from fastapi import Depends, FastAPI
from pydantic import BaseModel

import config
from agentes.recepcion import agente as recepcion
from registro import eventos

CONFIG = config.cargar()


@asynccontextmanager
async def lifespan(app: FastAPI):
    conn = eventos.conectar(CONFIG.db)
    eventos.crear_esquema(conn)
    conn.close()
    yield


app = FastAPI(title=f"SARD central {CONFIG.nodo}", lifespan=lifespan)


def conexion() -> Iterator[sqlite3.Connection]:
    conn = eventos.conectar(CONFIG.db)
    try:
        yield conn
    finally:
        conn.close()


Conexion = Annotated[sqlite3.Connection, Depends(conexion)]


class EntradaReportes(BaseModel):
    mensajes: list[str]
    pasarela_id: str | None = None


class Rechazado(BaseModel):
    mensaje: str
    motivo: str


class SalidaReportes(BaseModel):
    sack: list[str]
    rechazados: list[Rechazado]


class Salud(BaseModel):
    estado: Literal["ok"]
    central: Literal["A", "B"]
    jev: Literal["ok", "caido"]


@app.post("/reportes")
def reportes(entrada: EntradaReportes, conn: Conexion) -> SalidaReportes:
    r = recepcion.recibir(conn, entrada.mensajes, nodo=CONFIG.nodo, pasarela_id=entrada.pasarela_id)
    return SalidaReportes(sack=r.sack, rechazados=[Rechazado(**x) for x in r.rechazados])


@app.get("/salud")
def salud(conn: Conexion) -> Salud:
    # Estado de Jev según el último reporte que el triaje le pudo mandar.
    fila = conn.execute(
        "SELECT json_extract(datos, '$.jev') FROM eventos WHERE tipo = 'reporte_priorizado'"
        " AND json_extract(datos, '$.jev') IN ('ok', 'caido') ORDER BY seq DESC LIMIT 1"
    ).fetchone()
    jev = fila[0] if fila else ("ok" if CONFIG.jev_api_key else "caido")
    return Salud(estado="ok", central=CONFIG.nodo, jev=jev)
