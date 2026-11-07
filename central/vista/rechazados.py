"""Mensajes rechazados, para que un reporte truncado no quede invisible (`GET /rechazados`).

No recibieron SACK, así que el celular sigue reintentando. Aquí se muestran los campos que sí
llegaron, sin completar nada, y si después llegó una versión válida del mismo id.
"""

import sqlite3
from typing import Any

from protocolo.sard1 import PRIORIDADES
from registro import eventos


def todos(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    evs = eventos.leer(conn, tipos=["reporte_rechazado", "reporte_recibido"])
    validos = {e.reporte_id for e in evs if e.tipo == "reporte_recibido"}
    out = [{"reporte_id": e.reporte_id, "motivos": e.datos["motivos"], "campos": e.datos["campos"],
            "pasarela_id": e.datos.get("pasarela_id"), "recibido_en": e.creado_en,
            "recuperado": e.reporte_id in validos}
           for e in evs if e.tipo == "reporte_rechazado"]

    def clave(r):
        p = r["campos"].get("prioridad")
        return (r["recuperado"], p if p in PRIORIDADES else "P9", -r["recibido_en"])
    return sorted(out, key=clave)
