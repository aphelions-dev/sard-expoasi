import dataclasses
import importlib
import json
import sqlite3

import pytest
from fastapi.testclient import TestClient

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


def test_post_eventos_une_solo_reportes_recibidos(cliente):
    subir(cliente, ejemplo(1))
    ev = {k: v for k, v in cliente.get("/eventos").json()["eventos"][0].items() if k != "seq"}
    otro = {**ev, "id": "otro-id", "reporte_id": "otro-reporte", "nodo": "B"}
    assert cliente.post("/eventos", json={"eventos": [ev, otro]}).json() == {"agregados": 1}
    assert cliente.post("/eventos", json={"eventos": [otro]}).json() == {"agregados": 0}
    accion = {**otro, "id": "x", "tipo": "decision_humana"}
    assert cliente.post("/eventos", json={"eventos": [accion]}).status_code == 422
    assert [e["id"] for e in cliente.get("/eventos").json()["eventos"]] == [ev["id"], "otro-id"]


class _Respuesta:
    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


def _con_par(monkeypatch, urlopen):
    import api.main

    monkeypatch.setattr(api.main, "CONFIG",
                        dataclasses.replace(api.main.CONFIG, url_par="http://central-b"))
    monkeypatch.setattr("urllib.request.urlopen", urlopen)


def test_reporte_llega_a_la_otra_central_antes_del_sack(cliente, monkeypatch, tmp_path):
    from agentes.resiliencia import entregar

    monkeypatch.setattr(entregar, "_pausa_hasta", 0.0)
    enviados = []

    def urlopen(pedido, timeout):
        assert pedido.full_url == "http://central-b/eventos" and timeout <= 1.0
        enviados.append(json.loads(pedido.data))
        return _Respuesta()

    _con_par(monkeypatch, urlopen)
    sacks = subir(cliente, ejemplo(1))["sack"]
    subir(cliente, ejemplo(1))  # un duplicado se vuelve a entregar, por si la primera vez falló
    assert len(sacks) == 1 and len(enviados) == 2
    (ev,) = enviados[0]["eventos"]
    assert ev["tipo"] == "reporte_recibido" and f"SACK|{ev['reporte_id']}" == sacks[0]
    assert enviados[1] == enviados[0]

    # La B lo guarda con el mismo id: la sincronización después no lo duplica.
    import api.main

    monkeypatch.setenv("SARD_NODO", "B")
    monkeypatch.setenv("SARD_DB", str(tmp_path / "central-b.sqlite"))
    importlib.reload(api.main)
    with TestClient(api.main.app) as b:
        assert b.post("/eventos", json=enviados[0]).json() == {"agregados": 1}
        assert b.get("/eventos").json()["eventos"][0]["id"] == ev["id"]


def test_sack_igual_si_la_otra_central_no_responde(cliente, monkeypatch):
    from agentes.resiliencia import entregar

    monkeypatch.setattr(entregar, "_pausa_hasta", 0.0)
    def urlopen(pedido, timeout):
        raise TimeoutError("timed out")

    _con_par(monkeypatch, urlopen)
    assert len(subir(cliente, ejemplo(1))["sack"]) == 1


def test_tras_un_fallo_no_hace_esperar_a_la_pasarela(cliente, monkeypatch):
    from agentes.resiliencia import entregar

    llamadas = []

    def urlopen(pedido, timeout):
        llamadas.append(pedido)
        raise ConnectionRefusedError()

    _con_par(monkeypatch, urlopen)
    reloj = [100.0]
    monkeypatch.setattr(entregar.time, "monotonic", lambda: reloj[0])
    monkeypatch.setattr(entregar, "_pausa_hasta", 0.0)
    subir(cliente, ejemplo(1))
    subir(cliente, ejemplo(2))
    assert len(llamadas) == 1
    reloj[0] += entregar.PAUSA
    subir(cliente, ejemplo(2))
    assert len(llamadas) == 2
