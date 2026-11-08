"""Reglas del triaje: palabras críticas del contrato y banderas del formulario."""

import re
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


# Negación antes de una palabra crítica, al estilo NegEx: disparador dentro de las 4 palabras
# previas y en la misma frase. Solo avisa: la prioridad no baja (ADR 0005), porque una regla de
# negación que se equivoca esconde un P1 real, y en triaje el subtriaje es el error caro.
NEGACION = re.compile(
    r"\b(no hay|no habia|ningun[ao]?|nadie|sin|ya (?:se |lo |la |los |las )?(?:apag|control|saca|rescat)\w*)\b")
CORTE = re.compile(r"[,.;:!?]| pero | aunque | y ")
VENTANA = 4


def posibles_negaciones(texto: str) -> list[str]:
    """Palabras críticas que parecen negadas («no hay carros atrapados», «ya apagamos el fuego»)."""
    norm = normalizar(texto)
    out = []
    for palabra in palabras_criticas():
        if palabra.startswith("no "):  # «no respira» ya es la negación que importa
            continue
        i = norm.find(palabra)
        if i < 0:
            continue
        frase = CORTE.split(norm[:i])[-1]
        if NEGACION.search(" ".join(frase.split()[-VENTANA:])):
            out.append(palabra)
    return out
