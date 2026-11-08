"""Calibración del umbral de Jev, con un CSV pequeño y un Jev falso."""

from calibracion import correr
from tests.test_triaje import NOULS_CALMA, JevFalso

CSV = """id,texto,tipo_real,prioridad_real,atrapados,heridos,notas
r1,quedó gente bajo la casa,ATRAP,P1,0,0,
r2,se torció el tobillo,MEDIC,P2,0,1,
r3,todo bien en la cuadra,OTRO,P4,0,0,
r4,mal etiquetado,OTRO,P7,0,0,
"""

NOULS = {
    "quedó gente bajo la casa": NOULS_CALMA | {"atrapados": 0.62},
    "se torció el tobillo": NOULS_CALMA | {"herido": 0.8},
    "todo bien en la cuadra": NOULS_CALMA | {"riesgo_vital": 0.55},
}


class JevPorTexto(JevFalso):
    def evaluar(self, texto):
        self.llamadas += 1
        from agentes.triaje import jev
        return jev.Respuesta("jev-falso", NOULS[texto], "ATRAP", 0.9)


def test_barrido_y_recomendacion(tmp_path):
    ruta = tmp_path / "e.csv"
    ruta.write_text(CSV, encoding="utf-8")
    filas, avisos = correr.leer_csv(ruta)
    assert [f["id"] for f in filas] == ["r1", "r2", "r3"] and "P7" in avisos[0]

    cliente = JevPorTexto()
    resp = correr.respuestas(filas, cliente, cache=tmp_path / "c.json")
    assert cliente.llamadas == 3
    correr.respuestas(filas, cliente, cache=tmp_path / "c.json")
    assert cliente.llamadas == 3  # la caché evita volver a preguntar

    # Con 0,7 se escapa r1 (atrapados 0,62); con 0,6 se detecta; r3 no sube con el riesgo vital
    # porque riesgo_vital 0,55 queda bajo los dos umbrales.
    assert correr.evaluar(filas, resp, 0.7)["subtriaje"] == ["r1"]
    assert correr.evaluar(filas, resp, 0.6)["subtriaje"] == []
    assert correr.evaluar(filas, resp, 0.5)["sobretriaje"] == ["r3"]
    barrido = [correr.evaluar(filas, resp, si) for si in correr.UMBRALES]
    assert correr.recomendar(barrido) == 0.6
    assert correr.evaluar(filas, resp, None)["subtriaje"] == ["r1"]  # solo reglas

    texto = correr.informe(filas, resp, avisos, ruta)
    assert "0.6 **(recomendado)**" in texto and "1 de 3 coinciden" in texto
