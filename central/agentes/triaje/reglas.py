"""Reglas del triaje: palabras críticas del contrato y banderas del formulario."""

import unicodedata
from dataclasses import dataclass
from functools import cache
from pathlib import Path

PALABRAS_CRITICAS = Path(__file__).parents[3] / "contracts" / "palabras-criticas.txt"


@dataclass(frozen=True)
class Senal:
    senal: str
    origen: str  # "formulario", "texto" o "jev"
    prioridad: str
    cita: str | None = None
    probabilidad: float | None = None


def normalizar(texto: str) -> str:
    sin_tildes = unicodedata.normalize("NFKD", texto.lower())
    return "".join(c for c in sin_tildes if not unicodedata.combining(c))


@cache
def palabras_criticas() -> tuple[str, ...]:
    lineas = PALABRAS_CRITICAS.read_text(encoding="utf-8").splitlines()
    return tuple(normalizar(l.strip()) for l in lineas if l.strip() and not l.startswith("#"))


def senales(reporte: dict) -> list[Senal]:
    """Señales que las reglas encuentran en un reporte normalizado por recepción."""
    out = [Senal("prioridad del celular", "formulario", reporte["prioridad"])]
    if reporte["atrapados"]:
        out.append(Senal("atrapados marcado", "formulario", "P1"))
    if reporte["heridos"]:
        out.append(Senal("heridos marcado", "formulario", "P2"))
    texto = normalizar(reporte["texto"])
    for palabra in palabras_criticas():
        i = texto.find(palabra)
        if i >= 0:
            # La cita sale del texto original, que tiene la misma longitud salvo tildes combinadas.
            cita = reporte["texto"][max(0, i - 20): i + len(palabra) + 20].strip()
            out.append(Senal(f"palabra crítica «{palabra}»", "texto", "P1", cita=cita))
    return out
