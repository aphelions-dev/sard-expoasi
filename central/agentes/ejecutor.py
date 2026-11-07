"""Ejecutor común de los agentes: patrón pizarra sobre el registro de eventos.

Cada agente es un proceso aparte que consume un tipo de evento y produce otro. No hay un
orquestador: si un agente cae, los demás siguen, y al volver retoma lo que quedó pendiente.
La respuesta cita el evento de entrada en `causa`; un índice único impide responder dos veces,
así que se pueden correr varias copias de un mismo agente sin duplicar trabajo.
"""

import logging
import sqlite3
import time
import traceback
from collections.abc import Callable
from typing import Any

import config
from registro import eventos

Procesar = Callable[[sqlite3.Connection, eventos.Evento], dict[str, Any]]

log = logging.getLogger("sard.agentes")


def procesar_pendientes(
    conn: sqlite3.Connection, *, agente: str, consume: str, produce: str, procesar: Procesar,
    nodo: str,
) -> int:
    """Procesa un lote de pendientes. Devuelve cuántos eventos produjo."""
    hechos = 0
    for ev in eventos.pendientes(conn, consume=consume, produce=produce):
        try:
            datos = procesar(conn, ev)
        except Exception as e:  # el error queda registrado y el evento se reintenta
            log.exception("%s falló con %s", agente, ev.id)
            eventos.agregar(
                conn, nodo=nodo, tipo="agente_error", reporte_id=ev.reporte_id, causa=ev.id,
                datos={"agente": agente, "error": repr(e), "traza": traceback.format_exc(limit=3)},
            )
            continue
        if eventos.agregar(
            conn, nodo=nodo, tipo=produce, reporte_id=ev.reporte_id, causa=ev.id, datos=datos
        ):
            hechos += 1
    return hechos


def correr(*, agente: str, consume: str, produce: str, procesar: Procesar,
           intervalo: float = 0.5) -> None:
    """Bucle del proceso del agente: revisa la pizarra cada `intervalo` segundos."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
    cfg = config.cargar()
    conn = eventos.conectar(cfg.db)
    eventos.crear_esquema(conn)
    log.info("%s en central %s: %s -> %s", agente, cfg.nodo, consume, produce)
    while True:
        n = procesar_pendientes(
            conn, agente=agente, consume=consume, produce=produce, procesar=procesar, nodo=cfg.nodo
        )
        if n:
            log.info("%s: %d eventos %s", agente, n, produce)
        else:
            time.sleep(intervalo)
