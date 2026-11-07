"""Prueba de sesgo del triaje: ¿la prioridad depende de cómo se escribe el reporte?

    uv run --env-file ../.env python -m sesgo.correr            # reglas y Jev
    uv run --env-file ../.env python -m sesgo.correr --sin-jev  # solo reglas

Pasa cada variante de `casos.py` por el mismo `triar` del agente de triaje, con el formulario
neutro (P4, sin banderas): así la prioridad sale solo del texto. Escribe `sesgo/resultados.md`.

Métricas:
- consistencia: casos en que todas las variantes reciben la misma prioridad;
- subtriaje: variantes que quedan por debajo de la prioridad esperada (el error grave);
- sobretriaje: variantes que quedan por encima;
- dispersión de Jev: diferencia entre la probabilidad más alta y la más baja de la señal que
  decide el caso, entre variantes.
"""

import sys
import time
from datetime import date
from pathlib import Path

from agentes.triaje import agente, jev
from sesgo.casos import CASOS, VARIANTES

SALIDA = Path(__file__).parent / "resultados.md"

# Señal de Jev que decide cada caso, para medir cuánto se mueve entre variantes.
SENAL = {"atrapados": "atrapados", "no_respira": "no_respira", "incendio": "incendio_activo",
         "sangrado": "sangrado_grave", "inconsciente": "inconsciente", "herido_leve": "herido",
         "via": "riesgo_vital", "sin_novedad": "riesgo_vital"}


class SinJev(jev.Jev):
    def __init__(self):
        self._cliente = None


def reporte(caso: dict, texto: str) -> dict:
    return {"prioridad": "P4", "tipo": caso["tipo"], "atrapados": False, "heridos": False,
            "texto": texto}


def correr(cliente: jev.Jev) -> list[dict]:
    filas = []
    for caso in CASOS:
        for v in VARIANTES:
            r = agente.triar(reporte(caso, caso["textos"][v]), cliente)
            nouls = r.get("jev_nouls") or {}
            filas.append({"caso": caso["id"], "variante": v, "esperada": caso["esperada"],
                          "reglas": r["prioridad_reglas"], "final": r["prioridad"],
                          "jev": r["jev"], "p_senal": nouls.get(SENAL[caso["id"]])})
    return filas


def resumen(filas: list[dict], con_jev: bool) -> str:
    por_caso = {c["id"]: [f for f in filas if f["caso"] == c["id"]] for c in CASOS}
    consistentes = sum(len({f["final"] for f in fs}) == 1 for fs in por_caso.values())
    sub = [f for f in filas if f["final"] > f["esperada"]]
    sobre = [f for f in filas if f["final"] < f["esperada"]]
    caidas = [f for f in filas if f["jev"] == "caido"]

    l = [f"# Prueba de sesgo del triaje\n",
         f"Corrida del {date.today().isoformat()} · "
         + (f"reglas + Jev (`{jev.MODELO}`)" if con_jev else "solo reglas")
         + f" · {len(CASOS)} casos × {len(VARIANTES)} variantes = {len(filas)} reportes.",
         "Formulario neutro (P4, sin banderas): la prioridad sale solo del texto. "
         "Casos en `sesgo/casos.py`; se reproduce con `python -m sesgo.correr`.\n",
         "| Métrica | Valor |", "|---------|-------|",
         f"| Casos con la misma prioridad en todas las variantes | {consistentes} de {len(CASOS)} |",
         f"| Subtriaje (por debajo de la esperada) | {len(sub)} de {len(filas)} |",
         f"| Sobretriaje (por encima de la esperada) | {len(sobre)} de {len(filas)} |"]
    if con_jev:
        l.append(f"| Llamadas a Jev que fallaron | {len(caidas)} de {len(filas)} |")

    l += ["", "## Prioridad final por variante", "",
          "| Caso | Esperada | " + " | ".join(VARIANTES) + (" | Dispersión de Jev |" if con_jev else ""),
          "|---|---|" + "---|" * len(VARIANTES) + ("---|" if con_jev else "")]
    for cid, fs in por_caso.items():
        celdas = []
        for f in fs:
            marca = " ↓" if f["final"] > f["esperada"] else " ↑" if f["final"] < f["esperada"] else ""
            celdas.append(f"{f['final']}{marca}")
        fila = f"| {cid} | {fs[0]['esperada']} | " + " | ".join(celdas) + " |"
        if con_jev:
            ps = [f["p_senal"] for f in fs if f["p_senal"] is not None]
            fila += f" {max(ps) - min(ps):.2f} ({SENAL[cid]}) |" if ps else " — |"
        l.append(fila)
    l += ["", "↓ subtriaje, ↑ sobretriaje.", "",
          "## Solo con reglas (lo que queda si Jev cae)", "",
          "| Caso | " + " | ".join(VARIANTES) + " |", "|---|" + "---|" * len(VARIANTES)]
    for cid, fs in por_caso.items():
        l.append(f"| {cid} | " + " | ".join(f["reglas"] for f in fs) + " |")
    return "\n".join(l) + "\n"


def main() -> None:
    con_jev = "--sin-jev" not in sys.argv
    cliente = jev.Jev() if con_jev else SinJev()
    if con_jev and not cliente.disponible:
        raise SystemExit("Falta JEV_API_KEY; usa --env-file ../.env o --sin-jev")
    t = time.monotonic()
    filas = correr(cliente)
    texto = resumen(filas, con_jev)
    SALIDA.write_text(texto, encoding="utf-8")
    print(texto)
    print(f"{len(filas)} reportes en {time.monotonic() - t:.0f} s → {SALIDA}")


if __name__ == "__main__":
    main()
