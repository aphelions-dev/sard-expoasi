"""Agente de recepción: valida SARD1, deduplica por id, registra y devuelve SACK.

Corre dentro de `POST /reportes`, porque la pasarela necesita el SACK en la misma respuesta.
Ficha: `docs/fichas-agentes/recepcion.md`.
"""

import sqlite3
from dataclasses import asdict, dataclass

from protocolo import sard1
from registro import eventos


@dataclass(frozen=True)
class Resultado:
    sack: list[str]
    rechazados: list[dict[str, str]]


def recibir(
    conn: sqlite3.Connection, mensajes: list[str], *, nodo: str, pasarela_id: str | None
) -> Resultado:
    sacks: list[str] = []
    rechazados: list[dict[str, str]] = []
    for mensaje in mensajes:
        leido = sard1.leer(mensaje)
        if isinstance(leido, sard1.Rechazo):
            eventos.agregar(
                conn, nodo=nodo, tipo="reporte_rechazado", reporte_id=leido.id,
                datos={"mensaje": mensaje, "motivos": leido.motivos,
                       "campos": leido.campos, "pasarela_id": pasarela_id},
            )
            rechazados.append({"mensaje": mensaje, "motivo": "; ".join(leido.motivos)})
            continue

        nuevo = eventos.agregar(
            conn, nodo=nodo, tipo="reporte_recibido", reporte_id=leido.id,
            datos={**asdict(leido), "pasarela_id": pasarela_id},
        )
        if nuevo is None:
            # Ya estaba: se registra la llegada por otra ruta, sin crear otro reporte.
            eventos.agregar(
                conn, nodo=nodo, tipo="reporte_duplicado", reporte_id=leido.id,
                datos={"pasarela_id": pasarela_id},
            )
        sacks.append(sard1.sack(leido.id))
    return Resultado(sack=sacks, rechazados=rechazados)
