"""Posiciones de los celulares: metros en un plano local alrededor del centro de Manizales, y su
geohash de 6 caracteres para el campo 6 de SARD1."""

import math

CENTRO = (5.0689, -75.5174)  # lat, lon del centro de Manizales (celda d2fkcd)

# Dónde cae cada grupo de celulares cuando la emergencia toca varios barrios (`--focos`): una malla
# Bluetooth cubre unos cientos de metros, así que una ciudad tiene varias, cada una con su pasarela.
# El primero es CENTRO, para que `--focos 1` dé lo mismo de siempre; los demás son el centro de
# barrios de comunas distintas (tablero/public/geo/barrios.geojson).
FOCOS = (
    ("Centro", CENTRO),
    ("Chipre", (5.07653, -75.52572)),
    ("Fátima", (5.05248, -75.49708)),
    ("La Sultana", (5.06165, -75.47241)),
    ("Bosques del Norte", (5.08174, -75.4904)),
    ("San José", (5.07184, -75.51412)),
)
_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"


def a_latlon(x: float, y: float, centro: tuple[float, float] = CENTRO) -> tuple[float, float]:
    """(x, y) en metros desde la esquina suroeste del área → (lat, lon)."""
    lat0, lon0 = centro
    lat = lat0 + y / 111_320
    lon = lon0 + x / (111_320 * math.cos(math.radians(lat0)))
    return lat, lon


# Radio de precisión del GPS (metros, como Location.getAccuracy() de Android) → caracteres del
# geohash: la tabla de «Ubicación» de contracts/protocolo-sard1.md.
def caracteres(radio_m: float) -> int:
    return 9 if radio_m <= 5 else 8 if radio_m <= 20 else 7 if radio_m <= 75 else 6


# Cuánto suele medir ese radio. Supuesto del simulador, no una medición: a cielo abierto un
# celular da de 3 a 20 m; entre edificios o bajo techo, de decenas a cientos de metros.
RADIOS_GPS = ((0.15, 2, 5), (0.45, 5, 20), (0.25, 20, 75), (0.15, 75, 300))  # (peso, desde, hasta)


def radio_gps(rng) -> float:
    r, acum = rng.random(), 0.0
    for peso, desde, hasta in RADIOS_GPS:
        acum += peso
        if r <= acum:
            return rng.uniform(desde, hasta)
    return RADIOS_GPS[-1][2]


def a_metros(lat: float, lon: float, centro: tuple[float, float] = CENTRO) -> tuple[float, float]:
    """(lat, lon) → (x, y) en metros desde `centro`; la inversa de `a_latlon`."""
    lat0, lon0 = centro
    return (lon - lon0) * 111_320 * math.cos(math.radians(lat0)), (lat - lat0) * 111_320


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
