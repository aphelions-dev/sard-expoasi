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


def test_incidentes_y_aprobacion(cliente):
    from agentes import ejecutor
    from agentes.coordinacion import agente as coordinacion
    from agentes.correlacion import agente as correlacion
    from agentes.triaje import agente as triaje
    from tests.test_triaje import JevFalso
    import api.main

    subir(cliente, ejemplo(1) + ejemplo(2))
    assert cliente.get("/incidentes").json() == []  # aún sin correlacionar
    conn = eventos.conectar(api.main.CONFIG.db)
    for consume, produce, f in [
        ("reporte_recibido", "reporte_priorizado", triaje.procesar(JevFalso())),
        ("reporte_priorizado", "incidente_actualizado", correlacion.procesar(JevFalso(falla=True))),
        ("incidente_actualizado", "accion_propuesta", coordinacion.procesar),
    ]:
        ejecutor.procesar_pendientes(conn, agente=produce, consume=consume, produce=produce,
                                     procesar=f, nodo="A")
    conn.close()

    incs = cliente.get("/incidentes").json()
    assert [i["prioridad"] for i in incs] == ["P1", "P2"]
    assert all(i["estado"] == "pendiente" for i in incs)
    assert cliente.get("/incidentes", params={"prioridad": "P2"}).json()[0]["id"] == "inc-b712-0007"

    r = cliente.post("/incidentes/inc-a3f9-0042/aprobacion",
                     json={"decision": "aprobar", "coordinador": "sala de crisis", "nota": "ok"})
    assert r.status_code == 200 and r.json()["estado"] == "aprobada"
    assert cliente.post("/incidentes/inc-x/aprobacion",
                        json={"decision": "aprobar", "coordinador": "x"}).status_code == 404
    assert len(cliente.get("/incidentes", params={"estado": "pendiente"}).json()) == 1


def test_eventos_para_sincronizar(cliente):
    subir(cliente, ejemplo(1) + ejemplo(2))
    todo = cliente.get("/eventos").json()
    assert todo["ultimo_seq"] == 2 and len(todo["eventos"]) == 2
    assert len(cliente.get("/eventos", params={"desde_seq": 1}).json()["eventos"]) == 1


def test_salud(cliente):
    assert cliente.get("/salud").json() == {"estado": "ok", "central": "A", "jev": "caido"}
