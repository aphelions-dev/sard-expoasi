"""Correlación, coordinación, vista de incidentes, aprobación y sincronización."""

from dataclasses import asdict

import pytest

from agentes import ejecutor
from agentes.coordinacion import agente as coordinacion
from agentes.correlacion import agente as correlacion
from agentes.triaje import agente as triaje
from protocolo import sard1
from registro import eventos
from tests.test_triaje import JevFalso
from vista import incidentes


class JevCorrelacion(JevFalso):
    """Responde 'mismo' con la probabilidad dada para todos los candidatos."""

    def __init__(self, mismo=0.9, contradice=0.1, **kw):
        super().__init__(**kw)
        self.mismo, self.contradice = mismo, contradice

    def preguntar(self, state, questions):
        if self._falla:
            raise TimeoutError("Jev no respondió")
        n = len(questions) // 2

        class R:
            nouls = {**{f"mismo_{i}": type("N", (), {"noul": self.mismo}) for i in range(n)},
                     **{f"contradice_{i}": type("N", (), {"noul": self.contradice}) for i in range(n)}}
        return R()


@pytest.fixture
def conn(tmp_path):
    c = eventos.conectar(tmp_path / "t.sqlite")
    eventos.crear_esquema(c)
    yield c
    c.close()


def pipeline(conn, lineas, jev_corr, nodo="A"):
    for l in lineas:
        r = sard1.leer(l)
        eventos.agregar(conn, nodo=nodo, tipo="reporte_recibido", reporte_id=r.id,
                        datos={**asdict(r), "pasarela_id": "p1"})
    pasos = [
        ("reporte_recibido", "reporte_priorizado", triaje.procesar(JevFalso())),
        ("reporte_priorizado", "incidente_actualizado", correlacion.procesar(jev_corr)),
        ("incidente_actualizado", "accion_propuesta", coordinacion.procesar),
    ]
    for consume, produce, f in pasos:
        while ejecutor.procesar_pendientes(conn, agente=produce, consume=consume,
                                           produce=produce, procesar=f, nodo=nodo):
            pass
    return incidentes.todos(conn)


A1 = "SARD1|aa11-1|P1|ATRAP|3|100|d29e4k|1762481000|edificio colapsado, se oyen voces"
A2 = "SARD1|bb22-1|P1|ATRAP|2|100|d29e4m|1762481300|derrumbe en la esquina, hay gente abajo"
LEJOS = "SARD1|cc33-1|P2|ATRAP|1|100|d29exx|1762481300|casa caída"


def test_dos_reportes_cercanos_del_mismo_suceso_se_vinculan(conn):
    incs = pipeline(conn, [A1, A2], JevCorrelacion(mismo=0.9))
    (inc,) = incs.values()
    assert inc.id == "inc-aa11-1" and inc.reportes == ["aa11-1", "bb22-1"]
    assert inc.incertidumbre["dispositivos"] == 2
    assert inc.incertidumbre["corroboracion"] == "corroborado"
    assert inc.estado == "pendiente"
    assert inc.accion_propuesta["entidad"] == "Bomberos"


def test_jev_dudoso_no_fusiona_y_lo_anota(conn):
    incs = pipeline(conn, [A1, A2], JevCorrelacion(mismo=0.5))
    assert len(incs) == 2
    (posible,) = incs["inc-bb22-1"].incertidumbre["posibles_mismo_incidente"]
    assert posible["incidente_id"] == "inc-aa11-1"
    assert "si es el mismo suceso" in " ".join(incs["inc-bb22-1"].accion_propuesta["falta_confirmar"])


def test_lejos_no_es_candidato(conn):
    incs = pipeline(conn, [A1, LEJOS.replace("d29exx", "d2b000")], JevCorrelacion(mismo=0.99))
    assert len(incs) == 2


def test_sin_jev_solo_junta_misma_celda_tipo_y_hora(conn):
    mismo = A2.replace("d29e4m", "d29e4k")
    incs = pipeline(conn, [A1, mismo], JevCorrelacion(falla=True))
    assert len(incs) == 1
    incs = pipeline(conn, [A2.replace("bb22-1", "dd44-1")], JevCorrelacion(falla=True))
    assert "inc-dd44-1" in incs  # otra celda: no se junta


def test_contradiccion_queda_visible(conn):
    incs = pipeline(conn, [A1, A2], JevCorrelacion(mismo=0.9, contradice=0.8))
    inc = incs["inc-aa11-1"]
    assert inc.incertidumbre["contradicciones"] and inc.incertidumbre["revisar"]


def test_rumor_de_un_solo_origen(conn):
    rumor = "SARD1|ee55-1|P2|ATRAP|0|000|d29e4k|1762481000|dicen que se cayó la iglesia"
    triaje_rumor = JevFalso({"testigo_directo": 0.03})
    r = sard1.leer(rumor)
    eventos.agregar(conn, nodo="A", tipo="reporte_recibido", reporte_id=r.id, datos=asdict(r))
    ejecutor.procesar_pendientes(conn, agente="t", consume="reporte_recibido",
                                 produce="reporte_priorizado",
                                 procesar=triaje.procesar(triaje_rumor), nodo="A")
    incs = pipeline(conn, [], JevCorrelacion())
    assert incs["inc-ee55-1"].incertidumbre["corroboracion"] == "posible_rumor"


def test_sin_ubicacion_pide_confirmarla(conn):
    incs = pipeline(conn, ["SARD1|ff66-1|P2|MEDIC|1|010||1762481000|señora herida"], JevCorrelacion())
    inc = incs["inc-ff66-1"]
    assert inc.incertidumbre["sin_ubicacion"]
    assert "ubicación del incidente" in inc.accion_propuesta["falta_confirmar"]
    assert "ubicación sin confirmar" in inc.accion_propuesta["accion"]


def test_central_b_importa_y_ve_lo_mismo(conn, tmp_path):
    pipeline(conn, [A1, A2], JevCorrelacion())
    b = eventos.conectar(tmp_path / "b.sqlite")
    eventos.crear_esquema(b)
    evs = [asdict(e) for e in eventos.leer(conn)]
    assert sum(eventos.importar(b, e) for e in evs) == len(evs)
    assert sum(eventos.importar(b, e) for e in evs) == 0  # reimportar es inofensivo
    vista_a, vista_b = incidentes.todos(conn), incidentes.todos(b)
    assert {k: asdict(v) for k, v in vista_a.items()} == {k: asdict(v) for k, v in vista_b.items()}


def test_dos_centrales_triaron_distinto_se_conservan_ambas(conn, tmp_path):
    # La B recibió el mismo reporte durante la caída de la A y lo trió con otra prioridad.
    pipeline(conn, [A1], JevCorrelacion())
    b = eventos.conectar(tmp_path / "b.sqlite")
    eventos.crear_esquema(b)
    r = sard1.leer(A1)
    ev = eventos.agregar(b, nodo="B", tipo="reporte_recibido", reporte_id=r.id, datos=asdict(r))
    eventos.agregar(b, nodo="B", tipo="reporte_priorizado", reporte_id=r.id, causa=ev.id,
                    datos={**triaje.triar(asdict(r), JevFalso()), "prioridad": "P2"})
    for e in eventos.leer(b):
        eventos.importar(conn, asdict(e))
    (inc,) = incidentes.todos(conn).values()
    (d,) = inc.incertidumbre["discrepancias_entre_centrales"]
    assert d["prioridades"] == ["P1", "P2"] and inc.prioridad == "P1"
