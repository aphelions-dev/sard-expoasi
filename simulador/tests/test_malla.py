from simulador.malla import Parametros, Simulacion
from simulador.metricas import calcular


def correr(**kw) -> dict:
    return calcular(Simulacion(Parametros(**kw)).correr())


def test_misma_semilla_mismo_resultado():
    assert correr(semilla=4, perdida=0.3) == correr(semilla=4, perdida=0.3)


def test_sin_perdida_todo_llega_y_vuelve_el_sack():
    m = correr(semilla=1, perdida=0.0)
    assert m["nodos_con_camino_a_pasarela"] == 30
    assert m["tasa_entrega"] == 1.0
    assert m["confirmados_reportante"] == m["creados"]
    assert m["saltos_promedio"] > 1  # cruzó la malla, no solo vecinos de la pasarela


def test_con_mucha_perdida_los_reintentos_igual_entregan():
    m = correr(semilla=1, perdida=0.5)
    assert m["tasa_entrega"] == 1.0


def test_con_la_cola_llena_p1_llega_antes_y_p4_no_se_descarta():
    m = correr(semilla=1, reportes=200, ventana_s=60, capacidad=1, bateria_min=50, bateria_max=60)
    lat = m["latencia_por_prioridad"]
    assert lat["P1"]["p50_s"] < lat["P3"]["p50_s"] < lat["P4"]["p50_s"]
    assert lat["P4"]["entregados"] == lat["P4"]["creados"]  # espera su turno, pero llega


def test_varias_pasarelas_un_solo_reporte_por_id():
    m = correr(semilla=1, pasarelas=3)
    assert m["llegadas_duplicadas"] > 0
    assert m["reportes_creados_en_central_por_id"] == 1


def test_caida_de_la_central_no_pierde_reportes():
    m = correr(semilla=1, caida=(50, 400))
    assert m["subidas_fallidas"] > 0
    assert m["tasa_entrega"] == 1.0


def test_sin_bateria_el_celular_se_apaga():
    sim = Simulacion(Parametros(semilla=1, bateria_min=0.05, bateria_max=0.1)).correr()
    assert all(not n.vivo and n.apagado_en is not None for n in sim.nodos)


def test_vencido_se_marca_y_no_se_borra():
    sim = Simulacion(Parametros(semilla=1, nodos=6, lado_m=1000, vence_s=30)).correr()
    vencidos = [s for s in sim.seguimiento.values() if s.vencido]
    assert vencidos
    for s in vencidos:
        assert s.id in next(n for n in sim.nodos if n.id == s.nodo).cola


def test_en_orden_de_llegada_la_prioridad_no_se_nota():
    kw = dict(semilla=1, reportes=200, ventana_s=60, capacidad=1, bateria_min=50, bateria_max=60)
    con = correr(**kw)["latencia_por_prioridad"]
    sin = correr(**kw, por_prioridad=False)["latencia_por_prioridad"]
    assert con["P1"]["p50_s"] < sin["P1"]["p50_s"]


def test_traza_y_reporte_a_pedido_para_el_recorrido():
    sim = Simulacion(Parametros(semilla=3, reportes=0, duracion_s=200))
    sim.traza, sim.continuo = [], False
    r = sim.crear("n05", {"texto": "hay dos atrapados", "tipo_real": "ATRAP", "prioridad_real": "P1",
                          "atrapados": "1", "heridos": "0"})
    sim.correr()
    tipos = [e["tipo"] for e in sim.traza if e.get("id") == r.id]
    assert tipos[0] == "creado"
    assert {"salto", "llegada", "confirmado"} <= set(tipos)
    assert sim.seguimiento[r.id].confirmado is not None


def test_palabras_criticas_del_contrato():
    from simulador.recorrido import palabras_criticas
    assert palabras_criticas("Hay tres personas ATRAPADAS") == ["atrapad"]
    assert palabras_criticas("todo bien") == []


def test_focos_son_mallas_separadas_con_su_pasarela():
    from dataclasses import replace

    from simulador.geo import a_latlon, geohash

    p = replace(Parametros(), semilla=3, nodos=24, focos=6, reportes=30)
    sim = Simulacion(p)
    por_foco = [sim.nodos[k::6] for k in range(6)]
    assert all(any(n.pasarela for n in grupo) for grupo in por_foco)
    # Nadie oye a un celular de otro foco: están a kilómetros.
    foco = {n.id: i % 6 for i, n in enumerate(sim.nodos)}
    assert all(foco[v.id] == foco[a] for a, vs in sim.vecinos.items() for v in vs)
    assert len({geohash(*a_latlon(n.x, n.y)) for n in sim.nodos}) >= 6
    assert Simulacion(replace(p, focos=1)).nodos[0].x < p.lado_m  # un foco: lo de siempre


def test_largo_del_geohash_segun_precision_del_gps():
    import random
    from collections import Counter

    from simulador.generador import Generador
    from simulador.geo import caracteres

    assert [caracteres(r) for r in (3, 5, 6, 20, 21, 75, 76)] == [9, 9, 8, 8, 7, 7, 6]
    gen = Generador(random.Random(1), sin_gps=0)
    largos = Counter(len(gen.nuevo(f"n{i}", 10, 10, 0).geohash) for i in range(400))
    assert set(largos) == {6, 7, 8, 9} and largos[8] > largos[6]
