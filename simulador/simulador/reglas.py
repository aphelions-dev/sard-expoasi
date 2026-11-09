"""Prioridad en el celular (contrato, «Prioridad en el celular»; ADR 0004 y 0005).

Gana la primera regla que se cumple, de arriba abajo: P1 atrapados o palabra crítica; P2 heridos
o niños/adultos mayores; P3 una o más personas afectadas; P4 ninguna. El tipo no cuenta. Es lo que
hace la app (P1); el simulador lo repite para que sus mensajes salgan como los de un celular real.
"""

import unicodedata
from functools import cache
from pathlib import Path

PALABRAS = Path(__file__).parents[2] / "contracts" / "palabras-criticas.txt"


def normal(texto: str) -> str:
    """Minúsculas y sin tildes, la regla de comparación de `palabras-criticas.txt`."""
    return "".join(c for c in unicodedata.normalize("NFKD", texto.lower()) if not unicodedata.combining(c))


@cache
def _palabras() -> tuple[str, ...]:
    lineas = PALABRAS.read_text(encoding="utf-8").splitlines()
    return tuple(l.strip() for l in lineas if l.strip() and not l.lstrip().startswith("#"))


def palabras_criticas(texto: str) -> list[str]:
    """Las del contrato que aparecen en el texto, buscadas como fragmento."""
    t = normal(texto)
    return [p for p in _palabras() if normal(p) in t]


def prioridad(personas: int, atrapados: bool, heridos: bool, vulnerables: bool, texto: str) -> tuple[str, str]:
    """La prioridad y su motivo, como los muestra la app."""
    criticas = palabras_criticas(texto)
    if atrapados or criticas:
        motivos = (["atrapados marcado"] if atrapados else []) + [f"palabra crítica «{p}»" for p in criticas[:1]]
        return "P1", " y ".join(motivos)
    if heridos or vulnerables:
        return "P2", "heridos marcado" if heridos else "niños o adultos mayores marcado"
    if personas >= 1:
        return "P3", f"{personas} personas afectadas"
    return "P4", "ninguna persona afectada"
