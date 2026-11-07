"""Orden por impacto y confianza, vigencia, recursos declarados, rechazados y nota obligatoria."""

import time

from agentes import ejecutor
from agentes.coordinacion import agente as coordinacion
from agentes.correlacion import agente as correlacion
from agentes.triaje import agente as triaje
from protocolo import sard1
from registro import eventos
from tests.test_incidentes import JevCorrelacion
from tests.test_triaje import JevFalso


def subir(cliente, mensajes):
    return cliente.post("/reportes", json={"mensajes": mensajes, "pasarela_id": "p1"}).json()


def procesar(cliente):
    import api.main

    conn = eventos.conectar(api.main.CONFIG.db)
    for consume, produce, f in [
        ("reporte_recibido", "reporte_priorizado", triaje.procesar(JevFalso())),
        ("reporte_priorizado", "incidente_actualizado", correlacion.procesar(JevCorrelacion(mismo=0.05))),
        ("incidente_actualizado", "accion_propuesta", coordinacion.procesar),
    ]:
        while ejecutor.procesar_pendientes(conn, agente=produce, consume=consume, produce=produce,
                                           procesar=f, nodo="A"):
            pass
    conn.close()


def linea(id_, tipo="MEDIC", personas=1, banderas="010", hora=None, geohash="d29e4k"):
    hora = hora or int(time.time())
    return f"SARD1|{id_}|P2|{tipo}|{personas}|{banderas}|{geohash}|{hora}|herido en la calle"


def test_dentro_de_la_prioridad_va_primero_el_impacto(cliente):
    ahora = int(time.time())
    subir(cliente, [
        linea("aa01-1", personas=1, hora=ahora - 300, geohash="d29e4k"),
        linea("bb02-1", personas=4, hora=ahora - 200, geohash="d2g000"),
        linea("cc03-1", personas=1, banderas="011", hora=ahora - 100, geohash="d2u000"),
    ])
    procesar(cliente)
    incs = cliente.get("/incidentes").json()
    assert [i["id"] for i in incs] == ["inc-cc03-1", "inc-bb02-1", "inc-aa01-1"]
    assert incs[0]["impacto"] == {"personas": 1, "vulnerables": True}
    assert incs[0]["motivo_orden"].startswith("P2 · niños o adultos mayores · 1 persona")


def test_vigencia_marca_lo_que_lleva_mas_de_una_hora_sin_noticias(cliente):
    ahora = int(time.time())
    subir(cliente, [linea("aa01-1", hora=ahora - 2 * 3600), linea("bb02-1", hora=ahora, geohash="d2u000")])
    procesar(cliente)
    v = {i["id"]: i["vigencia"] for i in cliente.get("/incidentes").json()}
    assert v["inc-aa01-1"]["sin_noticias_recientes"] and v["inc-aa01-1"]["minutos_sin_noticias"] >= 119
    assert not v["inc-bb02-1"]["sin_noticias_recientes"]


def test_recursos_declarados_se_descuentan_al_aprobar(cliente):
    subir(cliente, [linea("aa01-1"), linea("bb02-1", geohash="d2u000")])
    procesar(cliente)
    inc = cliente.get("/incidentes").json()[0]
    assert inc["accion_propuesta"]["recurso"] == "ambulancia"
    assert inc["recurso"]["disponibles"] is None  # nadie lo ha declarado: no se inventa
    assert len(inc["recurso"]["compiten"]) == 1

    r = cliente.post("/recursos", json={"entidad": "Cruz Roja", "recurso": "ambulancia",
                                        "disponibles": 1, "coordinador": "sala"})
    assert r.json()[0]["disponibles"] == 1
    aprobar = cliente.post(f"/incidentes/{inc['id']}/aprobacion",
                           json={"decision": "aprobar", "coordinador": "sala", "nota": "va"})
    assert aprobar.status_code == 200
    assert cliente.get("/recursos").json()[0] == {
        **cliente.get("/recursos").json()[0], "comprometidos": 1, "disponibles": 0}
    otro = [i for i in cliente.get("/incidentes").json() if i["id"] != inc["id"]][0]
    assert otro["recurso"]["disponibles"] == 0 and otro["recurso"]["compiten"] == []

    # Devolver la unidad es declarar otra vez el número actual.
    cliente.post("/recursos", json={"entidad": "Cruz Roja", "recurso": "ambulancia",
                                    "disponibles": 1, "coordinador": "sala"})
    assert cliente.get("/recursos").json()[0]["disponibles"] == 1


def test_recurso_desconocido_se_rechaza(cliente):
    r = cliente.post("/recursos", json={"entidad": "Cruz Roja", "recurso": "helicóptero",
                                        "disponibles": 1, "coordinador": "sala"})
    assert r.status_code == 422


def test_aprobar_lo_marcado_para_revisar_exige_nota(cliente):
    from tests.test_incidentes import A1, A2
    import api.main

    subir(cliente, [A1, A2])
    conn = eventos.conectar(api.main.CONFIG.db)
    for consume, produce, f in [
        ("reporte_recibido", "reporte_priorizado", triaje.procesar(JevFalso())),
        ("reporte_priorizado", "incidente_actualizado",
         correlacion.procesar(JevCorrelacion(mismo=0.9, contradice=0.9))),
        ("incidente_actualizado", "accion_propuesta", coordinacion.procesar),
    ]:
        while ejecutor.procesar_pendientes(conn, agente=produce, consume=consume, produce=produce,
                                           procesar=f, nodo="A"):
            pass
    conn.close()
    (inc,) = cliente.get("/incidentes").json()
    assert inc["incertidumbre"]["revisar"] and inc["incertidumbre"]["contradicciones"]
    url = f"/incidentes/{inc['id']}/aprobacion"
    assert cliente.post(url, json={"decision": "aprobar", "coordinador": "sala"}).status_code == 422
    assert cliente.post(url, json={"decision": "rechazar", "coordinador": "sala"}).status_code == 200
    assert cliente.post(url, json={"decision": "aprobar", "coordinador": "sala",
                                   "nota": "lo confirmó la radio"}).status_code == 200


def test_truncado_muestra_lo_que_llego_y_se_marca_recuperado(cliente):
    r = subir(cliente, ["SARD1|b712-0008|P1|ATRAP|2|1"])
    assert r["sack"] == []
    (rech,) = cliente.get("/rechazados").json()
    # «banderas» llegó cortado ("1" de "101"): no se muestra como dato.
    assert rech["campos"] == {"id": "b712-0008", "prioridad": "P1", "tipo": "ATRAP", "personas": "2"}
    assert rech["reporte_id"] == "b712-0008" and not rech["recuperado"]

    subir(cliente, ["SARD1|b712-0008|P1|ATRAP|2|101|d29e4k|1762481000|edificio caído"])
    assert cliente.get("/rechazados").json()[0]["recuperado"]


def test_rechazados_pendientes_y_criticos_primero(cliente):
    subir(cliente, ["SARD1|aa01-1|P3|VIA|0", "SARD1|bb02-1|P1|ATRAP|2", "SARD1|x"])
    ids = [r["reporte_id"] for r in cliente.get("/rechazados").json()]
    assert ids == ["bb02-1", "aa01-1", None]


def test_parser_truncado_no_inventa_el_ultimo_campo():
    r = sard1.leer("SARD1|b712-0008|P1|ATR")
    assert r.campos == {"id": "b712-0008", "prioridad": "P1"}
