"""Métricas de una corrida y su registro en `pruebas/resultados/<nombre>/`:
parametros.json, metricas.json, reportes.csv (uno por reporte) y resumen.md."""

import csv
import json
import math
from dataclasses import asdict
from pathlib import Path

from .malla import Simulacion

RESULTADOS = Path(__file__).parents[2] / "pruebas" / "resultados"


def _percentil(xs: list[int], q: float) -> int | None:
    if not xs:
        return None
    xs = sorted(xs)
    return xs[max(0, math.ceil(q * len(xs)) - 1)]


def calcular(sim: Simulacion) -> dict:
    segs = list(sim.seguimiento.values())
    entregados = [s for s in segs if s.llegada is not None]
    latencia = {}
    for p in ("P1", "P2", "P3", "P4"):
        de_p = [s for s in segs if s.prioridad == p]
        lat = [s.llegada - s.creado for s in de_p if s.llegada is not None]
        latencia[p] = {"creados": len(de_p), "entregados": len(lat), "p50_s": _percentil(lat, 0.5),
                       "p95_s": _percentil(lat, 0.95), "max_s": max(lat) if lat else None}
    llegadas = sim.central.llegadas
    return {
        "creados": len(segs),
        "entregados_central": len(entregados),
        "tasa_entrega": round(len(entregados) / len(segs), 4) if segs else None,
        "confirmados_reportante": sum(s.confirmado is not None for s in segs),
        "vencidos": sum(s.vencido for s in segs),
        "latencia_por_prioridad": latencia,
        "saltos_promedio": round(sum(s.saltos for s in entregados) / len(entregados), 2) if entregados else None,
        "llegadas_duplicadas": sum(n - 1 for n in llegadas.values()),
        "max_llegadas_por_id": max(llegadas.values(), default=0),
        "reportes_creados_en_central_por_id": 1 if len(sim.central.creados) == len(llegadas) else "más de 1",
        "emitidos": sim.emitidos,
        "subidas_fallidas": sim.subidas_fallidas,
        "nodos_apagados": sum(not n.vivo for n in sim.nodos),
        "nodos_sin_vecinos": sum(not v for v in sim.vecinos.values()),
        "nodos_con_camino_a_pasarela": sim.conectados_inicio,
        "segundos_simulados": sim.t,
    }


def _fila(etiqueta: str, valor) -> str:
    return f"| {etiqueta} | {'—' if valor is None else valor} |"


def resumen(nombre: str, p: dict, m: dict) -> str:
    l = [f"# Corrida `{nombre}`", "",
         f"Semilla {p['semilla']} · {p['nodos']} celulares ({p['pasarelas']} pasarela) en {p['lado_m']:g} m × "
         f"{p['lado_m']:g} m · alcance {p['alcance_m']:g} m · pérdida {p['perdida']:.0%} · "
         f"{p['reportes']} reportes", "",
         "| Métrica | Valor |", "|---|---|",
         _fila("Tasa de entrega a la central", f"{m['tasa_entrega']:.1%}" if m["tasa_entrega"] is not None else None),
         _fila("Confirmados al reportante (SACK de vuelta)", f"{m['confirmados_reportante']} de {m['creados']}"),
         _fila("Saltos promedio", m["saltos_promedio"]),
         _fila("Llegadas duplicadas a la central", m["llegadas_duplicadas"]),
         _fila("Reportes creados por id en la central", m["reportes_creados_en_central_por_id"]),
         _fila("Vencidos (no entregados)", m["vencidos"]),
         _fila("Celulares apagados por batería", f"{m['nodos_apagados']} de {p['nodos']}"),
         _fila("Celulares sin ningún vecino", m["nodos_sin_vecinos"]),
         _fila("Celulares con camino a una pasarela al empezar", f"{m['nodos_con_camino_a_pasarela']} de {p['nodos']}"),
         _fila("Mensajes emitidos (reportes / SACK)", f"{m['emitidos']['reportes']} / {m['emitidos']['sacks']}"),
         _fila("Segundos simulados", m["segundos_simulados"]),
         "", "| Prioridad | Creados | Entregados | Latencia p50 (s) | p95 (s) | Máx (s) |", "|---|---|---|---|---|---|"]
    for pr, d in m["latencia_por_prioridad"].items():
        l.append(f"| {pr} | {d['creados']} | {d['entregados']} | {d['p50_s'] if d['p50_s'] is not None else '—'} "
                 f"| {d['p95_s'] if d['p95_s'] is not None else '—'} | {d['max_s'] if d['max_s'] is not None else '—'} |")
    l += ["", "Se reproduce con los parámetros de `parametros.json` (`python -m simulador correr --desde ...`)."]
    return "\n".join(l) + "\n"


def guardar(sim: Simulacion, nombre: str, carpeta: Path = RESULTADOS) -> Path:
    destino = carpeta / nombre
    destino.mkdir(parents=True, exist_ok=True)
    p = asdict(sim.p)
    m = calcular(sim)
    (destino / "parametros.json").write_text(json.dumps(p, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (destino / "metricas.json").write_text(json.dumps(m, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    with open(destino / "reportes.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["id", "prioridad", "nodo", "creado_s", "llegada_s", "saltos", "confirmado_s", "vencido"])
        for s in sim.seguimiento.values():
            w.writerow([s.id, s.prioridad, s.nodo, s.creado, s.llegada, s.saltos, s.confirmado, int(s.vencido)])
    (destino / "resumen.md").write_text(resumen(nombre, p, m), encoding="utf-8")
    return destino
