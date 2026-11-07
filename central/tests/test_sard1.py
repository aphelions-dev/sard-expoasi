import pytest

from protocolo import sard1
from tests.conftest import ejemplo


@pytest.mark.parametrize("n", [1, 2, 3, 4, 7])
def test_ejemplos_validos(n):
    (linea,) = ejemplo(n)
    assert isinstance(sard1.leer(linea), sard1.Reporte)


def test_campos_del_ejemplo_01():
    r = sard1.leer(ejemplo(1)[0])
    assert r == sard1.Reporte(
        id="a3f9-0042", prioridad="P1", tipo="ATRAP", personas=3, atrapados=True,
        heridos=False, vulnerables=True, geohash="d2fkcd", hora_unix=1762481000,
        texto="edificio colapsado calle 23",
    )


def test_sin_gps_queda_vacio_sin_inventar():
    r = sard1.leer(ejemplo(4)[0])
    assert r.geohash is None


def test_sin_texto():
    assert sard1.leer(ejemplo(3)[0]).texto == ""


def test_truncado_conserva_id():
    r = sard1.leer(ejemplo(6)[0])
    assert isinstance(r, sard1.Rechazo)
    assert r.id == "b712-0008"
    assert "truncado" in r.motivos[0]


def test_sack_no_es_reporte():
    assert isinstance(sard1.leer(ejemplo(8)[0]), sard1.Rechazo)


def test_campos_invalidos_da_todos_los_motivos():
    r = sard1.leer(ejemplo(9)[0])
    assert isinstance(r, sard1.Rechazo)
    texto = " ".join(r.motivos)
    for campo in ("prioridad", "tipo", "personas", "banderas", "hora_unix"):
        assert campo in texto


def test_barra_en_el_texto_queda_en_el_texto():
    r = sard1.leer("SARD1|a1-1|P3|OTRO|0|000||1762481000|uno | dos")
    assert r.texto == "uno | dos"
