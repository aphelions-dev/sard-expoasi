"""Orden por impacto y confianza, vigencia, recursos por unidad, rechazados y nota obligatoria."""

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


def registrar(cliente, matricula, entidad="Cruz Roja", recurso="ambulancia"):
    return cliente.post("/recursos/unidades", json={
        "entidad": entidad, "recurso": recurso, "matricula": matricula, "reportado_por": "CR sala"})


def estado(cliente, matricula, estado, incidente_id=None, nota=""):
    return cliente.post(f"/recursos/unidades/{matricula}/estado", json={
        "estado": estado, "incidente_id": incidente_id, "reportado_por": "CR sala", "nota": nota})


def test_aprobar_solicita_y_la_entidad_asigna_y_libera(cliente):
    subir(cliente, [linea("aa01-1"), linea("bb02-1", geohash="d2u000")])
    procesar(cliente)
    primero, segundo = [i["id"] for i in cliente.get("/incidentes").json()]
    inc = cliente.get("/incidentes").json()[0]
    assert inc["accion_propuesta"]["recurso"] == "ambulancia"
    assert inc["recurso"] == {"recurso": "ambulancia", "entidad": "Cruz Roja", "disponibles": None,
                              "compiten": [segundo], "solicitado": False, "asignadas": []}
    assert cliente.get("/recursos").json() == []  # sin unidades registradas no se inventa nada

    (fila,) = registrar(cliente, "CR-114").json()
    assert fila["disponibles"] == 1 and fila["unidades"][0]["estado"] == "disponible"

    # Aprobar solicita el recurso, pero no toca la unidad.
    cliente.post(f"/incidentes/{primero}/aprobacion",
                 json={"decision": "aprobar", "coordinador": "sala", "nota": "va"})
    (fila,) = cliente.get("/recursos").json()
    assert fila["disponibles"] == 1 and fila["solicitudes_abiertas"] == [primero]
    incs = {i["id"]: i for i in cliente.get("/incidentes").json()}
    assert incs[primero]["recurso"]["solicitado"] and incs[primero]["recurso"]["disponibles"] == 1

    # La Cruz Roja reporta la asignación: la solicitud se cierra y deja de competir.
    (fila,) = estado(cliente, "CR-114", "asignada", primero).json()
    assert (fila["disponibles"], fila["asignadas"], fila["solicitudes_abiertas"]) == (0, 1, [])
    assert fila["unidades"][0]["incidente_id"] == primero
    incs = {i["id"]: i for i in cliente.get("/incidentes").json()}
    assert incs[primero]["recurso"]["asignadas"] == ["CR-114"]
    assert incs[segundo]["recurso"]["compiten"] == [] and incs[segundo]["recurso"]["disponibles"] == 0

    # Liberar es volver a disponible; no_disponible no cuenta como disponible.
    assert estado(cliente, "CR-114", "disponible").json()[0]["disponibles"] == 1
    (fila,) = estado(cliente, "CR-114", "no_disponible", nota="sin tripulación").json()
    assert (fila["disponibles"], fila["no_disponibles"]) == (0, 1)
    assert fila["unidades"][0]["nota"] == "sin tripulación"

    tipos = [e["tipo"] for e in cliente.get("/eventos").json()["eventos"]]
    assert tipos.count("recurso_solicitado") == 1 and tipos.count("unidad_estado") == 3


def test_errores_al_registrar_y_reportar_unidades(cliente):
    assert registrar(cliente, "X-1", recurso="helicóptero").status_code == 422
    assert registrar(cliente, "CR-114").status_code == 200
    assert registrar(cliente, "CR-114").status_code == 409
    assert estado(cliente, "NO-EXISTE", "disponible").status_code == 404
    assert estado(cliente, "CR-114", "asignada").status_code == 422
    assert estado(cliente, "CR-114", "asignada", "inc-nada").status_code == 404
    assert estado(cliente, "CR-114", "disponible", "inc-nada").status_code == 422
    assert estado(cliente, "CR-114", "en_camino").status_code == 422


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
