import sqlite3

import pytest

from registro import eventos
from tests.conftest import ejemplo


def subir(cliente, mensajes, pasarela="pasarela-1"):
    r = cliente.post("/reportes", json={"mensajes": mensajes, "pasarela_id": pasarela})
    assert r.status_code == 200
    return r.json()


def registro(cliente):
    import api.main

    conn = eventos.conectar(api.main.CONFIG.db)
    try:
        return eventos.leer(conn)
    finally:
        conn.close()


def test_valido_devuelve_sack_y_registra(cliente):
    out = subir(cliente, ejemplo(1))
    assert out == {"sack": ["SACK|a3f9-0042"], "rechazados": []}
    (ev,) = registro(cliente)
    assert ev.tipo == "reporte_recibido" and ev.reporte_id == "a3f9-0042" and ev.nodo == "A"
    assert ev.datos["pasarela_id"] == "pasarela-1"


def test_duplicado_recibe_sack_pero_no_crea_otro_reporte(cliente):
    out = subir(cliente, ejemplo(5))
    assert out["sack"] == ["SACK|a3f9-0042", "SACK|a3f9-0042"]
    tipos = [e.tipo for e in registro(cliente)]
    assert tipos == ["reporte_recibido", "reporte_duplicado"]


def test_duplicado_por_otra_pasarela_queda_trazado(cliente):
    subir(cliente, ejemplo(1), pasarela="p1")
    subir(cliente, ejemplo(1), pasarela="p2")
    dup = registro(cliente)[-1]
    assert dup.tipo == "reporte_duplicado" and dup.datos["pasarela_id"] == "p2"


@pytest.mark.parametrize("n", [6, 8, 9])
def test_invalidos_se_rechazan_y_registran(cliente, n):
    out = subir(cliente, ejemplo(n))
    assert out["sack"] == []
    assert len(out["rechazados"]) == 1 and out["rechazados"][0]["motivo"]
    assert [e.tipo for e in registro(cliente)] == ["reporte_rechazado"]


def test_lote_mixto(cliente):
    mensajes = [l for n in range(1, 10) for l in ejemplo(n)]
    out = subir(cliente, mensajes)
    assert len(out["rechazados"]) == 3
    assert sorted(set(out["sack"])) == [
        "SACK|a3f9-0042", "SACK|a3f9-0043", "SACK|b712-0007", "SACK|c0d1-0003", "SACK|d4e5-0001",
    ]
    recibidos = [e for e in registro(cliente) if e.tipo == "reporte_recibido"]
    assert len(recibidos) == 5


def test_registro_no_permite_modificar_ni_borrar(cliente):
    subir(cliente, ejemplo(1))
    import api.main

    conn = eventos.conectar(api.main.CONFIG.db)
    with pytest.raises(sqlite3.IntegrityError, match="solo agrega"):
        conn.execute("UPDATE eventos SET tipo = 'x'")
    with pytest.raises(sqlite3.IntegrityError, match="solo agrega"):
        conn.execute("DELETE FROM eventos")
    conn.close()


def test_salud(cliente):
    assert cliente.get("/salud").json() == {"estado": "ok", "central": "A", "jev": "caido"}
