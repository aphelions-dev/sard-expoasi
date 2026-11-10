"""Mensajes SARD1 y SACK según `contracts/protocolo-sard1.md`. Solo lo que el simulador necesita:
armar líneas válidas y leer las que viajan por la malla."""

import re
from dataclasses import dataclass

PRIORIDADES = ("P1", "P2", "P3", "P4")
TIPOS = ("ATRAP", "MEDIC", "FUEGO", "DESLIZ", "INUND", "GAS", "VIA", "DESAP", "OTRO")
RE_ID = re.compile(r"^[0-9A-Za-z]+-[0-9]+$")
RE_GEOHASH = re.compile(r"^[0-9b-hjkmnp-z]{6,9}$")  # 6 a 9 según la precisión del GPS


@dataclass(frozen=True)
class Reporte:
    id: str
    prioridad: str
    tipo: str
    personas: int
    atrapados: bool
    heridos: bool
    vulnerables: bool
    geohash: str  # vacío si no hay GPS
    hora_unix: int
    texto: str

    def linea(self) -> str:
        banderas = f"{int(self.atrapados)}{int(self.heridos)}{int(self.vulnerables)}"
        return (f"SARD1|{self.id}|{self.prioridad}|{self.tipo}|{self.personas}|{banderas}|"
                f"{self.geohash}|{self.hora_unix}|{self.texto}")


def sack(id_: str) -> str:
    return f"SACK|{id_}"


def leer(linea: str) -> Reporte:
    """Lee una línea SARD1 válida; `ValueError` con el motivo si no lo es."""
    partes = linea.strip().split("|", 8)  # todo lo que sigue al campo 7 es texto (puede tener '|')
    if len(partes) < 9 or partes[0] != "SARD1":
        raise ValueError(f"no es un SARD1 completo: {linea!r}")
    _, id_, prioridad, tipo, personas, banderas, geohash, hora, texto = partes
    if not RE_ID.match(id_):
        raise ValueError(f"id inválido: {id_!r}")
    if prioridad not in PRIORIDADES:
        raise ValueError(f"prioridad inválida: {prioridad!r}")
    if tipo not in TIPOS:
        raise ValueError(f"tipo inválido: {tipo!r}")
    if not personas.isdigit():
        raise ValueError(f"personas inválido: {personas!r}")
    if len(banderas) != 3 or set(banderas) - {"0", "1"}:
        raise ValueError(f"banderas inválidas: {banderas!r}")
    if geohash and not RE_GEOHASH.match(geohash):
        raise ValueError(f"geohash inválido: {geohash!r}")
    if not hora.isdigit():
        raise ValueError(f"hora_unix inválida: {hora!r}")
    return Reporte(id_, prioridad, tipo, int(personas), banderas[0] == "1", banderas[1] == "1",
                   banderas[2] == "1", geohash, int(hora), texto)
