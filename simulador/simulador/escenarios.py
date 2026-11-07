"""Escenarios E1–E4 de `pruebas/escenarios.md`, solo con el simulador (central simulada).

Cada caso se corre con 10 semillas (10 repartos distintos de celulares) y se informa promedio,
peor y mejor. Todo es reproducible: los parámetros quedan en `casos.json`.

    PYTHONUTF8=1 uv run python -m simulador escenarios            # E1 a E4
    PYTHONUTF8=1 uv run python -m simulador escenarios E3
"""

import json
from dataclasses import asdict, replace
from pathlib import Path
from statistics import mean

from .malla import Parametros, Simulacion
from .metricas import RESULTADOS, calcular

SEMILLAS = range(1, 11)
PRIORIDADES = ("P1", "P2", "P3", "P4")


def _prom(xs):
    xs = [x for x in xs if x is not None]
    return round(mean(xs), 2) if xs else None


def agrupar(ms: list[dict]) -> dict:
    lat = {}
    for p in PRIORIDADES:
        d = [m["latencia_por_prioridad"][p] for m in ms]
        lat[p] = {
            "creados": sum(x["creados"] for x in d),
            "entregados": sum(x["entregados"] for x in d),
            "p50_prom_s": _prom([x["p50_s"] for x in d]),
            "p95_peor_s": max((x["p95_s"] for x in d if x["p95_s"] is not None), default=None),
        }
    tasas = [m["tasa_entrega"] for m in ms]
    return {
        "tasa_entrega": {"prom": round(mean(tasas), 4), "peor": min(tasas), "mejor": max(tasas)},
        "confirmados_reportante": round(mean(m["confirmados_reportante"] / m["creados"] for m in ms), 4),
        "latencia": lat,
        "saltos_prom": _prom([m["saltos_promedio"] for m in ms]),
        "llegadas_duplicadas_prom": _prom([m["llegadas_duplicadas"] for m in ms]),
        "un_reporte_por_id": all(m["reportes_creados_en_central_por_id"] == 1 for m in ms),
        "nodos_apagados_prom": _prom([m["nodos_apagados"] for m in ms]),
        "conectados_a_pasarela_prom": _prom([m["nodos_con_camino_a_pasarela"] for m in ms]),
        "emitidos_prom": _prom([m["emitidos"]["reportes"] + m["emitidos"]["sacks"] for m in ms]),
    }


def caso(nombre: str, base: Parametros) -> dict:
    ms = [calcular(Simulacion(replace(base, semilla=s)).correr()) for s in SEMILLAS]
    params = asdict(base)
    params.pop("semilla")
    return {"caso": nombre, "parametros": params, "semillas": list(SEMILLAS),
            "agregado": agrupar(ms), "por_semilla": ms}


BASE = Parametros()

ESCENARIOS = {
    "E1": ("Pérdida de paquetes", "Malla base (30 celulares en 150 m, alcance 50 m) con pérdida por salto creciente.",
           [(f"pérdida {int(p * 100)} %", replace(BASE, perdida=p)) for p in (0.0, 0.1, 0.3, 0.5)]),
    "E2": ("Densidad de malla", "Terreno de 250 m × 250 m, pérdida 10 %: cuántos celulares y con qué alcance.",
           [(f"{n} celulares · {a} m", replace(BASE, lado_m=250.0, nodos=n, alcance_m=float(a)))
            for n in (15, 30, 60) for a in (30, 50, 100)]),
    "E3": ("Prioridad con la cola llena", "200 reportes en 60 s y 1 mensaje/s por celular: con prioridad y, para "
           "comparar, en orden de llegada.",
           [("con prioridad", replace(BASE, reportes=200, ventana_s=60, capacidad=1)),
            ("orden de llegada", replace(BASE, reportes=200, ventana_s=60, capacidad=1, por_prioridad=False))]),
    "E4": ("Duplicados", "El mismo reporte llega por varias pasarelas.",
           [(f"{k} pasarela{'s' if k > 1 else ''}", replace(BASE, pasarelas=k)) for k in (1, 2, 3)]),
}


def _v(x, sufijo=""):
    return "—" if x is None else f"{x}{sufijo}"


def resumen(clave: str, titulo: str, desc: str, casos: list[dict]) -> str:
    l = [f"# {clave} · {titulo}", "", desc, "",
         f"{len(SEMILLAS)} semillas por caso (promedio; peor caso entre paréntesis). Parámetros completos en "
         "`casos.json`; se reproduce con `python -m simulador escenarios " + clave + "`.", "",
         "| Caso | Entrega (peor) | SACK al reportante | Saltos | Duplicados | Con camino a pasarela | Apagados |",
         "|---|---|---|---|---|---|---|"]
    for c in casos:
        a = c["agregado"]
        l.append(f"| {c['caso']} | {a['tasa_entrega']['prom']:.1%} ({a['tasa_entrega']['peor']:.1%}) "
                 f"| {a['confirmados_reportante']:.1%} | {_v(a['saltos_prom'])} | {_v(a['llegadas_duplicadas_prom'])} "
                 f"| {_v(a['conectados_a_pasarela_prom'])} de {c['parametros']['nodos']} | {_v(a['nodos_apagados_prom'])} |")
    l += ["", "Latencia hasta la central, en segundos: mediana promedio (p95 en el peor caso).", "",
          "| Caso | P1 | P2 | P3 | P4 |", "|---|---|---|---|---|"]
    for c in casos:
        lat = c["agregado"]["latencia"]
        celdas = [f"{_v(lat[p]['p50_prom_s'])} ({_v(lat[p]['p95_peor_s'])}) · {lat[p]['entregados']}/{lat[p]['creados']}"
                  for p in PRIORIDADES]
        l.append(f"| {c['caso']} | " + " | ".join(celdas) + " |")
    l += ["", "En cada celda de latencia, después del punto: entregados/creados sumando las semillas."]
    return "\n".join(l) + "\n"


def correr(claves: list[str], carpeta: Path = RESULTADOS) -> None:
    for clave in claves:
        titulo, desc, defs = ESCENARIOS[clave]
        casos = [caso(n, p) for n, p in defs]
        destino = carpeta / clave
        destino.mkdir(parents=True, exist_ok=True)
        (destino / "casos.json").write_text(json.dumps(casos, indent=1, ensure_ascii=False) + "\n",
                                            encoding="utf-8", newline="\n")
        texto = resumen(clave, titulo, desc, casos)
        (destino / "resumen.md").write_text(texto, encoding="utf-8", newline="\n")
        print(texto)
