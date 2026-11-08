"""API de la central (`contracts/api-central.md`).

Arranque: `uv run --env-file ../.env uvicorn api.main:app --port 8001` desde `central/`, o la
central completa con `uv run --env-file ../.env python iniciar.py A`.
"""

import sqlite3
from collections.abc import Iterator
from contextlib import asynccontextmanager
from dataclasses import asdict
from typing import Annotated, Any, Literal

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import config
from agentes.coordinacion import agente as coordinacion
from agentes.recepcion import agente as recepcion
from registro import eventos
from vista import incidentes, rechazados

CONFIG = config.cargar()


@asynccontextmanager
async def lifespan(app: FastAPI):
    conn = eventos.conectar(CONFIG.db)
    eventos.crear_esquema(conn)
    conn.close()
    yield


app = FastAPI(title=f"SARD central {CONFIG.nodo}", lifespan=lifespan)
# El tablero corre en otro origen (otro puerto o archivo local).
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def conexion() -> Iterator[sqlite3.Connection]:
    conn = eventos.conectar(CONFIG.db)
    try:
        yield conn
    finally:
        conn.close()


Conexion = Annotated[sqlite3.Connection, Depends(conexion)]
Prioridad = Literal["P1", "P2", "P3", "P4"]
Estado = Literal["sin_propuesta", "pendiente", "aprobada", "rechazada"]


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


class Incidente(BaseModel):
    id: str
    prioridad: Prioridad
    tipo: str
    geohash: str | None
    hora_unix: int
    reportes: list[str]
    evidencia: list[dict[str, Any]]
    incertidumbre: dict[str, Any]
    estado: Estado
    impacto: dict[str, Any]
    vigencia: dict[str, Any]
    motivo_orden: str
    recurso: dict[str, Any] | None
    accion_propuesta: dict[str, Any] | None
    decision: dict[str, Any] | None


class Aprobacion(BaseModel):
    decision: Literal["aprobar", "rechazar"]
    coordinador: str
    nota: str = ""


class Declaracion(BaseModel):
    entidad: str
    recurso: str
    disponibles: int = Field(ge=0)
    coordinador: str


class Recurso(BaseModel):
    entidad: str
    recurso: str
    declarados: int
    comprometidos: int
    disponibles: int
    coordinador: str
    declarado_en: float


class ReporteRechazado(BaseModel):
    reporte_id: str | None
    motivos: list[str]
    campos: dict[str, str]
    pasarela_id: str | None
    recibido_en: float
    recuperado: bool


def _salida(inc: incidentes.Incidente) -> Incidente:
    return Incidente(**{k: v for k, v in asdict(inc).items() if not k.startswith("_")})


@app.post("/reportes")
def reportes(entrada: EntradaReportes, conn: Conexion) -> SalidaReportes:
    r = recepcion.recibir(conn, entrada.mensajes, nodo=CONFIG.nodo, pasarela_id=entrada.pasarela_id)
    return SalidaReportes(sack=r.sack, rechazados=[Rechazado(**x) for x in r.rechazados])


@app.get("/incidentes")
def listar_incidentes(
    conn: Conexion,
    estado: Estado | None = None,
    prioridad: Prioridad | None = None,
    desde: Annotated[int | None, Query(description="hora unix mínima del incidente")] = None,
) -> list[Incidente]:
    """Por prioridad, impacto y confianza; la hora desempata (contracts/api-central.md)."""
    out = [
        i for i in incidentes.todos(conn).values()
        if (estado is None or i.estado == estado)
        and (prioridad is None or i.prioridad == prioridad)
        and (desde is None or i.hora_unix >= desde)
    ]
    return [_salida(i) for i in sorted(out, key=incidentes.clave_orden)]


@app.post("/incidentes/{incidente_id}/aprobacion")
def aprobar(incidente_id: str, entrada: Aprobacion, conn: Conexion) -> Incidente:
    """El coordinador decide sobre la acción propuesta vigente. Nada se ejecuta sin esto."""
    inc = incidentes.uno(conn, incidente_id)
    if inc is None:
        raise HTTPException(404, f"no existe el incidente {incidente_id}")
    if inc.accion_propuesta is None:
        raise HTTPException(409, "el incidente todavía no tiene una acción propuesta")
    if (entrada.decision == "aprobar" and inc.incertidumbre["revisar"]
            and not entrada.nota.strip()):
        raise HTTPException(422, "el incidente está marcado para revisar: la nota es obligatoria")
    eventos.agregar(
        conn, nodo=CONFIG.nodo, tipo="decision_humana",
        datos={"incidente_id": incidente_id, "accion_id": inc.accion_propuesta["id"],
               **entrada.model_dump()},
    )
    return _salida(incidentes.todos(conn)[incidente_id])


@app.get("/recursos")
def listar_recursos(conn: Conexion) -> list[Recurso]:
    return [Recurso(**r) for r in incidentes.recursos(conn)]


@app.post("/recursos")
def declarar_recurso(entrada: Declaracion, conn: Conexion) -> list[Recurso]:
    if (entrada.entidad, entrada.recurso) not in coordinacion.RECURSOS:
        validos = ", ".join(f"{r} ({e})" for e, r in sorted(coordinacion.RECURSOS))
        raise HTTPException(422, f"recurso desconocido; los válidos son: {validos}")
    eventos.agregar(conn, nodo=CONFIG.nodo, tipo="recurso_declarado", datos=entrada.model_dump())
    return listar_recursos(conn)


@app.get("/rechazados")
def listar_rechazados(conn: Conexion) -> list[ReporteRechazado]:
    return [ReporteRechazado(**r) for r in rechazados.todos(conn)]


@app.get("/eventos")
def listar_eventos(
    conn: Conexion, desde_seq: int = 0, limite: Annotated[int, Query(le=1000)] = 500
) -> dict[str, Any]:
    """Para que la otra central se sincronice; no es para el tablero."""
    evs = eventos.leer(conn, desde_seq=desde_seq, limite=limite)
    ultimo = conn.execute("SELECT coalesce(max(seq), 0) FROM eventos").fetchone()[0]
    return {"eventos": [asdict(e) for e in evs], "ultimo_seq": ultimo}


@app.get("/salud")
def salud(conn: Conexion) -> Salud:
    # Estado de Jev según el último reporte que el triaje le pudo mandar.
    fila = conn.execute(
        "SELECT json_extract(datos, '$.jev') FROM eventos WHERE tipo = 'reporte_priorizado'"
        " AND json_extract(datos, '$.jev') IN ('ok', 'caido') ORDER BY seq DESC LIMIT 1"
    ).fetchone()
    jev = fila[0] if fila else ("ok" if CONFIG.jev_api_key else "caido")
    return Salud(estado="ok", central=CONFIG.nodo, jev=jev)
