"""Agente de recepción: valida SARD1, deduplica por id, registra y devuelve SACK.

Devuelve también el `reporte_recibido` de cada id con SACK, para que la API se lo entregue a la
otra central antes de responder (`agentes/resiliencia/entregar.py`).

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
    recibidos: list[eventos.Evento]


def recibir(
    conn: sqlite3.Connection, mensajes: list[str], *, nodo: str, pasarela_id: str | None
) -> Resultado:
    sacks: list[str] = []
    rechazados: list[dict[str, str]] = []
    recibidos: list[eventos.Evento] = []
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
            nuevo = eventos.recibido(conn, leido.id)
        recibidos.append(nuevo)
        sacks.append(sard1.sack(leido.id))
    return Resultado(sack=sacks, rechazados=rechazados, recibidos=recibidos)
