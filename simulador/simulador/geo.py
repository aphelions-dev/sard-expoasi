"""Posiciones de los celulares: metros en un plano local alrededor del centro de Manizales, y su
geohash de 6 caracteres para el campo 6 de SARD1."""

import math

CENTRO = (5.0689, -75.5174)  # lat, lon del centro de Manizales (celda d2fkcd)
_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"


def a_latlon(x: float, y: float, centro: tuple[float, float] = CENTRO) -> tuple[float, float]:
    """(x, y) en metros desde la esquina suroeste del área → (lat, lon)."""
    lat0, lon0 = centro
    lat = lat0 + y / 111_320
    lon = lon0 + x / (111_320 * math.cos(math.radians(lat0)))
    return lat, lon


def geohash(lat: float, lon: float, precision: int = 6) -> str:
    rangos = [[-90.0, 90.0], [-180.0, 180.0]]  # lat, lon
    bits, n, par, out = 0, 0, True, []
    while len(out) < precision:
        r, v = (rangos[1], lon) if par else (rangos[0], lat)
        medio = (r[0] + r[1]) / 2
        bits <<= 1
        if v >= medio:
            bits |= 1
            r[0] = medio
        else:
            r[1] = medio
        par = not par
        n += 1
        if n == 5:
            out.append(_BASE32[bits])
            bits, n = 0, 0
    return "".join(out)
