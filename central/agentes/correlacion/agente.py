"""Agente de correlación: agrupa reportes del mismo suceso sin borrar ni fusionar originales.

Consume `reporte_priorizado` y produce `incidente_actualizado`. Ficha:
`docs/fichas-agentes/correlacion.md`.

1. El código busca incidentes candidatos: reportes de las últimas/próximas 2 h a menos de
   1,5 km (o, si el reporte no trae ubicación, los más cercanos en el tiempo).
2. Jev compara el reporte con cada candidato.
3. p(mismo) >= 0,7: se vincula al incidente. Entre 0,3 y 0,7: incidente nuevo, con el candidato
   anotado como «posible mismo incidente» para que decida el coordinador. Menos: incidente nuevo.
4. Sin Jev: solo se vincula si coincide la celda del geohash, el tipo y la hora con 30 min de
   diferencia; si no, incidente nuevo. Ante la duda no se junta nada.

El id de un incidente es `inc-<id del reporte que lo abrió>`, así las dos centrales le ponen
el mismo nombre al mismo incidente.
"""

import json
import sqlite3
from collections import defaultdict
from typing import Any

import pygeohash

from agentes.correlacion import jev as jev_corr
from agentes.triaje.jev import Jev
from registro import eventos

VENTANA_S = 2 * 3600
RADIO_M = 1500
VENTANA_SIN_JEV_S = 30 * 60


def candidatos(conn: sqlite3.Connection, rep: dict[str, Any]) -> dict[str, list[dict]]:
    """Incidentes cercanos en espacio y tiempo, con sus reportes."""
    filas = conn.execute(
        "SELECT json_extract(ia.datos, '$.incidente_id') AS inc, rr.datos AS rep"
        " FROM eventos ia JOIN eventos rr"
        "   ON rr.tipo = 'reporte_recibido' AND rr.reporte_id = ia.reporte_id"
        " WHERE ia.tipo = 'incidente_actualizado'"
        "   AND json_extract(rr.datos, '$.hora_unix') BETWEEN ? AND ?",
        (rep["hora_unix"] - VENTANA_S, rep["hora_unix"] + VENTANA_S),
    ).fetchall()
    por_inc: dict[str, list[dict]] = defaultdict(list)
    for f in filas:
        r = json.loads(f["rep"])
        if r["id"] not in {x["id"] for x in por_inc[f["inc"]]}:
            por_inc[f["inc"]].append(r)

    def cerca(reps: list[dict]) -> bool:
        if not rep["geohash"]:
            return True
        return any(r["geohash"] and pygeohash.geohash_haversine_distance(
            rep["geohash"], r["geohash"]) <= RADIO_M for r in reps)

    cerca_inc = {i: rs for i, rs in por_inc.items() if cerca(rs)}
    orden = sorted(cerca_inc, key=lambda i: min(abs(r["hora_unix"] - rep["hora_unix"])
                                                 for r in cerca_inc[i]))
    return {i: cerca_inc[i] for i in orden[: jev_corr.MAX_CANDIDATOS]}


def _resumen(rep: dict, base: dict) -> dict[str, Any]:
    """Lo que Jev necesita de un reporte, con los hechos que el código ya sabe."""
    d = {"tipo": rep["tipo"], "personas": rep["personas"], "texto": rep["texto"] or "(sin texto)",
         "minutos_de_diferencia": round(abs(rep["hora_unix"] - base["hora_unix"]) / 60)}
    if rep["geohash"] and base["geohash"]:
        d["distancia_metros"] = round(
            pygeohash.geohash_haversine_distance(rep["geohash"], base["geohash"]))
    return d


def correlacionar(conn: sqlite3.Connection, rep: dict[str, Any], cliente: Jev) -> dict[str, Any]:
    nuevo_id = f"inc-{rep['id']}"
    cands = candidatos(conn, rep)
    base = {"vinculo": "nuevo", "incidente_id": nuevo_id, "similitud": None,
            "posibles": [], "contradicciones": [], "candidatos": len(cands)}
    if not cands:
        return {**base, "metodo": "sin_candidatos"}

    if cliente.disponible:
        try:
            nuevo = {k: v for k, v in _resumen(rep, rep).items() if k != "minutos_de_diferencia"}
            resumen = {i: {"tipo": rs[0]["tipo"], "reportes": [_resumen(r, rep) for r in rs[-3:]]}
                       for i, rs in cands.items()}
            res = jev_corr.comparar(cliente, nuevo, resumen)
        except Exception as e:
            base["jev_error"] = repr(e)
        else:
            mejor = max(res, key=lambda i: res[i][0])
            p_mismo, p_contra = res[mejor]
            posibles = [{"incidente_id": i, "probabilidad": round(p, 2)}
                        for i, (p, _) in res.items() if jev_corr.NO <= p < jev_corr.SI]
            if p_mismo >= jev_corr.SI:
                contra = ([{"incidente_id": mejor, "probabilidad": round(p_contra, 2)}]
                          if p_contra >= jev_corr.SI else [])
                return {**base, "metodo": "jev", "vinculo": "mismo", "incidente_id": mejor,
                        "similitud": round(p_mismo, 2), "contradicciones": contra,
                        "posibles": [p for p in posibles if p["incidente_id"] != mejor]}
            return {**base, "metodo": "jev", "posibles": posibles}

    # Sin Jev: regla conservadora.
    for inc, rs in cands.items():
        if any(r["geohash"] and r["geohash"] == rep["geohash"] and r["tipo"] == rep["tipo"]
               and abs(r["hora_unix"] - rep["hora_unix"]) <= VENTANA_SIN_JEV_S for r in rs):
            return {**base, "metodo": "reglas", "vinculo": "mismo", "incidente_id": inc}
    return {**base, "metodo": "reglas"}


def procesar(cliente: Jev):
    def _procesar(conn: sqlite3.Connection, ev: eventos.Evento) -> dict[str, Any]:
        rec = conn.execute(
            "SELECT datos FROM eventos WHERE tipo = 'reporte_recibido' AND reporte_id = ?",
            (ev.reporte_id,),
        ).fetchone()
        return correlacionar(conn, json.loads(rec["datos"]), cliente)
    return _procesar
