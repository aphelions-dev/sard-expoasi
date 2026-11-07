import random
from pathlib import Path

import pytest

from simulador.generador import Generador
from simulador.geo import CENTRO, geohash
from simulador.sard1 import leer

EJEMPLOS = Path(__file__).parents[2] / "contracts" / "ejemplos"


def lineas(n: str) -> list[str]:
    return next(EJEMPLOS.glob(f"{n}-*.txt")).read_text(encoding="utf-8").splitlines()


@pytest.mark.parametrize("n", ["01", "02", "03", "04", "05", "07"])
def test_lee_los_ejemplos_validos_del_contrato(n):
    for l in lineas(n):
        r = leer(l)
        assert r.linea() == l.strip()  # ida y vuelta sin perder nada


@pytest.mark.parametrize("n", ["06", "09"])
def test_rechaza_los_ejemplos_invalidos_del_contrato(n):
    with pytest.raises(ValueError):
        leer(lineas(n)[0])


def test_el_texto_puede_traer_barras():
    r = leer("SARD1|a1-1|P2|OTRO|1|000||1786338000|calle 5 | carrera 3")
    assert r.texto == "calle 5 | carrera 3"


def test_lo_generado_cumple_sard1():
    gen = Generador(random.Random(3))
    for i in range(200):
        l = gen.nuevo(f"n{i % 7:02d}", 50, 50, 1786338000 + i).linea()
        assert leer(l).linea() == l


def test_geohash_del_centro_de_manizales():
    assert geohash(*CENTRO) == "d2fkcd"
