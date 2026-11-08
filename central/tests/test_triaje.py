from dataclasses import asdict

import pytest

from agentes import ejecutor
from agentes.triaje import agente, jev, reglas
from protocolo import sard1
from registro import eventos

NOULS_CALMA = {k: 0.05 for k in jev.PREGUNTAS if k != "tipo"} | {"testigo_directo": 0.9}


class JevFalso(jev.Jev):
    def __init__(self, nouls=None, tipo=None, falla=False, disponible=True):
        self._nouls, self._tipo, self._falla, self._disp = nouls or {}, tipo, falla, disponible
        self.llamadas = 0

    @property
    def disponible(self):
        return self._disp

    def evaluar(self, texto):
        self.llamadas += 1
        if self._falla:
            raise TimeoutError("Jev no respondió")
        return jev.Respuesta("jev-falso", NOULS_CALMA | self._nouls, self._tipo or "OTRO", 0.9)


def reporte(linea):
    return asdict(sard1.leer(linea))


def test_palabra_critica_es_p1_aunque_el_celular_diga_p4():
    r = reporte("SARD1|a-1|P4|OTRO|1|000||1|Mi mamá está ATRAPADA en el baño")
    out = agente.triar(r, JevFalso())
    assert out["prioridad"] == "P1" and out["prioridad_reglas"] == "P1"
    (s,) = [e for e in out["evidencia"] if e["origen"] == "texto"]
    assert "ATRAPADA" in s["cita"]


def test_jev_nunca_baja_la_prioridad():
    r = reporte("SARD1|a-1|P1|ATRAP|3|100||1|ayuda")
    out = agente.triar(r, JevFalso())  # Jev ve todo en calma
    assert out["prioridad"] == "P1"


def test_jev_sube_y_pide_revision():
    r = reporte("SARD1|a-1|P3|OTRO|1|000||1|mi abuelo respira muy raro")
    out = agente.triar(r, JevFalso({"no_respira": 0.84}))
    assert out["prioridad"] == "P1" and out["prioridad_reglas"] == "P3"
    assert out["revisar"] and "Jev subió" in out["motivos_revision"][0]


def test_riesgo_dudoso_va_a_revision():
    r = reporte("SARD1|a-1|P3|OTRO|0|000||1|me siento mareado")
    out = agente.triar(r, JevFalso({"riesgo_vital": 0.61}))
    assert out["revisar"] and any("dudoso" in m for m in out["motivos_revision"])


def test_rumor_queda_de_oidas():
    r = reporte("SARD1|a-1|P2|ATRAP|0|000||1|dicen que se cayó una iglesia")
    out = agente.triar(r, JevFalso({"testigo_directo": 0.03}))
    assert out["fuente"] == "de_oidas"


def test_jev_caido_sigue_con_reglas():
    r = reporte("SARD1|a-1|P2|MEDIC|1|010||1|fractura")
    out = agente.triar(r, JevFalso(falla=True))
    assert out["jev"] == "caido" and out["prioridad"] == "P2" and "jev_error" in out


def test_sin_texto_no_llama_a_jev():
    cliente = JevFalso()
    out = agente.triar(reporte("SARD1|a-1|P4|VIA|0|000||1|"), cliente)
    assert out["jev"] == "no_aplica" and cliente.llamadas == 0


def test_normalizar_quita_tildes():
    assert reglas.normalizar("Inconsciénte NIÑO") == "inconsciente nino"


@pytest.fixture
def conn(tmp_path):
    c = eventos.conectar(tmp_path / "t.sqlite")
    eventos.crear_esquema(c)
    yield c
    c.close()


def recibir(conn, linea, nodo="A"):
    r = sard1.leer(linea)
    return eventos.agregar(conn, nodo=nodo, tipo="reporte_recibido", reporte_id=r.id,
                           datos=asdict(r))


def correr_triaje(conn, cliente):
    return ejecutor.procesar_pendientes(
        conn, agente="triaje", consume="reporte_recibido", produce="reporte_priorizado",
        procesar=agente.procesar(cliente), nodo="A",
    )


def test_ejecutor_procesa_una_vez_y_p1_primero(conn):
    recibir(conn, "SARD1|a-1|P4|VIA|0|000||1|")
    recibir(conn, "SARD1|a-2|P1|ATRAP|1|100||2|")
    assert correr_triaje(conn, JevFalso()) == 2
    assert correr_triaje(conn, JevFalso()) == 0  # nada pendiente
    orden = [e.reporte_id for e in eventos.leer(conn, tipos=["reporte_priorizado"])]
    assert orden == ["a-2", "a-1"]


def test_dos_copias_del_agente_no_duplican(conn):
    ev = recibir(conn, "SARD1|a-1|P2|MEDIC|1|010||1|")
    datos = agente.triar(ev.datos, JevFalso())
    assert eventos.agregar(conn, nodo="A", tipo="reporte_priorizado", causa=ev.id, datos=datos)
    assert eventos.agregar(conn, nodo="B", tipo="reporte_priorizado", causa=ev.id, datos=datos) is None


def test_error_se_registra_y_se_reintenta(conn):
    recibir(conn, "SARD1|a-1|P2|MEDIC|1|010||1|")

    def explota(c, ev):
        raise ValueError("bug")

    for _ in range(2):
        assert ejecutor.procesar_pendientes(
            conn, agente="triaje", consume="reporte_recibido", produce="reporte_priorizado",
            procesar=explota, nodo="A") == 0
    errores = eventos.leer(conn, tipos=["agente_error"])
    assert len(errores) == 1  # se registra una vez, no en cada intento
    assert correr_triaje(conn, JevFalso()) == 1  # cuando el agente funciona, lo retoma
