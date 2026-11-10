"""Lectura y validación de mensajes SARD1 según `contracts/protocolo-sard1.md`.

No completa ni corrige campos: un mensaje inválido se rechaza con sus motivos, y lo que el
ciudadano no envió (geohash, texto) queda vacío.
"""

import re
from dataclasses import dataclass, field

PRIORIDADES = ("P1", "P2", "P3", "P4")
TIPOS = ("ATRAP", "MEDIC", "FUEGO", "DESLIZ", "INUND", "GAS", "VIA", "DESAP", "OTRO")
N_CAMPOS = 9
NOMBRES = ("id", "prioridad", "tipo", "personas", "banderas", "geohash", "hora_unix", "texto")

RE_ID = re.compile(r"^[0-9A-Za-z]+-[0-9]+$")
RE_BANDERAS = re.compile(r"^[01]{3}$")
RE_GEOHASH = re.compile(r"^[0-9b-hjkmnp-z]{6,9}$")  # base32 de geohash; el largo dice la precisión
RE_ENTERO = re.compile(r"^[0-9]+$")


@dataclass(frozen=True)
class Reporte:
    id: str
    prioridad: str
    tipo: str
    personas: int
    atrapados: bool
    heridos: bool
    vulnerables: bool  # niños o adultos mayores
    geohash: str | None
    hora_unix: int
    texto: str


@dataclass(frozen=True)
class Rechazo:
    motivos: list[str]
    id: str | None = None  # si el id se pudo leer
    campos: dict[str, str] = field(default_factory=dict)


def leer(mensaje: str) -> Reporte | Rechazo:
    mensaje = mensaje.strip()
    if mensaje.startswith("SACK|"):
        return Rechazo(["es un acuse SACK, no un reporte"])
    if not mensaje.startswith("SARD1|"):
        return Rechazo(["no empieza por la cabecera SARD1"])

    # El escape de '|' en el texto está por definir: todo lo que sigue al campo 7 es texto.
    partes = mensaje.split("|", N_CAMPOS - 1)
    id_ = partes[1] if len(partes) > 1 and RE_ID.match(partes[1]) else None
    if len(partes) < N_CAMPOS:
        # Solo los campos que llegaron con su separador: el último pudo cortarse a la mitad.
        llegados = dict(zip(NOMBRES, partes[1:-1]))
        return Rechazo([f"truncado: {len(partes)} de {N_CAMPOS} campos"], id=id_, campos=llegados)

    _, id_crudo, prioridad, tipo, personas, banderas, geohash, hora, texto = partes
    campos = dict(
        id=id_crudo, prioridad=prioridad, tipo=tipo, personas=personas,
        banderas=banderas, geohash=geohash, hora_unix=hora,
    )
    motivos = []
    if id_ is None:
        motivos.append(f"id inválido: {id_crudo!r}")
    if prioridad not in PRIORIDADES:
        motivos.append(f"prioridad inválida: {prioridad!r}")
    if tipo not in TIPOS:
        motivos.append(f"tipo inválido: {tipo!r}")
    if not RE_ENTERO.match(personas):
        motivos.append(f"personas inválido: {personas!r}")
    if not RE_BANDERAS.match(banderas):
        motivos.append(f"banderas inválidas: {banderas!r}")
    if geohash and not RE_GEOHASH.match(geohash):
        motivos.append(f"geohash inválido: {geohash!r}")
    if not RE_ENTERO.match(hora):
        motivos.append(f"hora_unix inválida: {hora!r}")
    if motivos:
        return Rechazo(motivos, id=id_, campos=campos)

    return Reporte(
        id=id_crudo,
        prioridad=prioridad,
        tipo=tipo,
        personas=int(personas),
        atrapados=banderas[0] == "1",
        heridos=banderas[1] == "1",
        vulnerables=banderas[2] == "1",
        geohash=geohash or None,
        hora_unix=int(hora),
        texto=texto,
    )


def sack(reporte_id: str) -> str:
    return f"SACK|{reporte_id}"
