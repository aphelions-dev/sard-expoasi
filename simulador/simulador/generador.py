"""Generador de reportes SARD1 sintéticos (#4).

Los textos, el tipo y la prioridad salen de los 100 reportes etiquetados a mano
(`datos/sinteticos/reportes_etiquetados.csv`). La prioridad del CSV hace de "prioridad calculada
en el celular": las reglas de la app son de P1 y todavía no existen.

    PYTHONUTF8=1 uv run python -m simulador generar --n 20 --semilla 1
"""

import csv
import random
from pathlib import Path

from .geo import a_latlon, caracteres, geohash, radio_gps
from .sard1 import Reporte

CSV = Path(__file__).parents[2] / "datos" / "sinteticos" / "reportes_etiquetados.csv"


def cargar(ruta: Path = CSV) -> list[dict]:
    with open(ruta, encoding="utf-8", newline="") as f:
        filas = list(csv.DictReader(f))
    if not filas:
        raise SystemExit(f"{ruta} no tiene reportes (#13).")
    return filas


class Generador:
    def __init__(self, rng: random.Random, filas: list[dict] | None = None, sin_gps: float = 0.1):
        self.rng = rng
        self.filas = filas if filas is not None else cargar()
        self.sin_gps = sin_gps  # fracción de celulares sin GPS: geohash vacío
        self.contadores: dict[str, int] = {}

    def nuevo(self, disp: str, x: float, y: float, hora_unix: int, fila: dict | None = None) -> Reporte:
        f = fila or self.rng.choice(self.filas)
        n = self.contadores[disp] = self.contadores.get(disp, 0) + 1
        # El largo del geohash sale del radio del GPS (contrato, «Ubicación»). Se sortea aparte, con
        # el id como semilla, para no mover la secuencia del resto de la simulación.
        precision = caracteres(radio_gps(random.Random(f"{disp}-{n}")))
        gh = "" if self.rng.random() < self.sin_gps else geohash(*a_latlon(x, y), precision)
        return Reporte(
            id=f"{disp}-{n}",
            prioridad=f["prioridad_real"],
            tipo=f["tipo_real"],
            personas=self.rng.randint(0 if f["prioridad_real"] == "P4" else 1, 8),
            atrapados=f["atrapados"] == "1",
            heridos=f["heridos"] == "1",
            vulnerables=self.rng.random() < 0.3,
            geohash=gh,
            hora_unix=hora_unix,
            texto=f["texto"],
        )
