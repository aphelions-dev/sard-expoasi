import random
from pathlib import Path

import pytest

from simulador.generador import Generador
from simulador.reglas import palabras_criticas, prioridad
from simulador.sard1 import leer

EJEMPLOS = Path(__file__).parents[2] / "contracts" / "ejemplos"


def validos():
    for f in sorted(EJEMPLOS.glob("*.txt")):
        for l in f.read_text(encoding="utf-8").splitlines():
            try:
                yield f.name, leer(l)
            except ValueError:
                pass


@pytest.mark.parametrize("nombre,r", list(validos()))
def test_las_reglas_dan_la_prioridad_de_los_ejemplos_del_contrato(nombre, r):
    assert prioridad(r.personas, r.atrapados, r.heridos, r.vulnerables, r.texto)[0] == r.prioridad


@pytest.mark.parametrize("args,esperada", [
    ((0, True, True, True, ""), "P1"),          # atrapados gana a todo
    ((0, False, False, False, "olor a HUMO"), "P1"),  # palabra crítica, sin importar mayúsculas
    ((5, False, True, False, ""), "P2"),        # heridos
    ((5, False, False, True, ""), "P2"),        # niños o adultos mayores
    ((1, False, False, False, "vía cerrada"), "P3"),
    ((0, False, False, False, "vía cerrada"), "P4"),
])
def test_gana_la_primera_regla_que_se_cumple(args, esperada):
    assert prioridad(*args)[0] == esperada


def test_las_palabras_se_buscan_sin_tildes_y_como_fragmento():
    assert "atrap" in palabras_criticas("quedó ATRAPDA en el baño")
    assert palabras_criticas("llegaste tarde con la gaseosa") == []  # «gas» solo como frase


def test_lo_generado_trae_la_prioridad_de_las_reglas():
    gen = Generador(random.Random(5))
    for i in range(300):
        r = gen.nuevo(f"n{i % 7:02d}", 50, 50, 1786338000 + i)
        assert r.prioridad == prioridad(r.personas, r.atrapados, r.heridos, r.vulnerables, r.texto)[0]
