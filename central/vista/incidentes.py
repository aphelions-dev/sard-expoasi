"""Vista de incidentes para el tablero, calculada a partir del registro de eventos.

No guarda nada: cada consulta pliega los eventos. Así la central B muestra lo mismo que la A
apenas tiene sus eventos, y una corrección es siempre un evento nuevo.
"""

import sqlite3
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Any

from registro import eventos
from registro.eventos import Evento


def dispositivo(reporte_id: str) -> str:
    return reporte_id.split("-", 1)[0]


@dataclass
class Incidente:
    id: str
    prioridad: str
    tipo: str
    geohash: str | None
    hora_unix: int
    reportes: list[str]
    evidencia: list[dict[str, Any]]
    incertidumbre: dict[str, Any]
    estado: str  # sin_propuesta, pendiente, aprobada, rechazada
    accion_propuesta: dict[str, Any] | None
    decision: dict[str, Any] | None = None
    _fuentes: list[str] = field(default_factory=list, repr=False)


def construir(evs: list[Evento]) -> dict[str, Incidente]:
    recibidos: dict[str, dict] = {}
    priorizados: dict[str, list[dict]] = defaultdict(list)
    rutas: dict[str, set] = defaultdict(set)
    vinculos: dict[str, dict] = {}
    propuestas: dict[str, Evento] = {}
    decisiones: dict[str, Evento] = {}

    for ev in sorted(evs, key=lambda e: e.creado_en):
        d, rid = ev.datos, ev.reporte_id
        if ev.tipo == "reporte_recibido":
            recibidos.setdefault(rid, d)
            rutas[rid].add(d.get("pasarela_id"))
        elif ev.tipo == "reporte_duplicado":
            rutas[rid].add(d.get("pasarela_id"))
        elif ev.tipo == "reporte_priorizado":
            priorizados[rid].append(d)
        elif ev.tipo == "incidente_actualizado":
            vinculos.setdefault(rid, d)  # si A y B correlacionaron, gana el primero
        elif ev.tipo == "accion_propuesta":
            propuestas[d["incidente_id"]] = ev
        elif ev.tipo == "decision_humana":
            decisiones[d["incidente_id"]] = ev

    miembros: dict[str, list[str]] = defaultdict(list)
    for rid, v in vinculos.items():
        if rid in recibidos and rid in priorizados:
            miembros[v["incidente_id"]].append(rid)

    out = {}
    for inc_id, rids in miembros.items():
        rids.sort(key=lambda r: recibidos[r]["hora_unix"])
        out[inc_id] = _incidente(inc_id, rids, recibidos, priorizados, rutas, vinculos,
                                 propuestas.get(inc_id), decisiones.get(inc_id))
    return out


def _incidente(inc_id, rids, recibidos, priorizados, rutas, vinculos, propuesta, decision):
    evidencia, motivos, discrepancias, fuentes = [], [], [], []
    contradicciones, posibles = [], []
    sin_ia = False
    prioridades = []
    for rid in rids:
        rep, tri = recibidos[rid], priorizados[rid]
        ps = sorted({t["prioridad"] for t in tri})
        if len(ps) > 1:
            discrepancias.append({"reporte_id": rid, "prioridades": ps})
        t = min(tri, key=lambda x: x["prioridad"])  # la más alta si dos centrales difieren
        prioridades.append(t["prioridad"])
        fuentes.append(t.get("fuente") or "sin_dato")
        sin_ia |= t["jev"] == "caido"
        motivos += [f"{rid}: {m}" for m in t["motivos_revision"]]
        v = vinculos[rid]
        contradicciones += [{"reporte_id": rid, **c} for c in v.get("contradicciones", [])]
        posibles += [{"reporte_id": rid, **p} for p in v.get("posibles", [])]
        evidencia.append({
            "reporte_id": rid, "texto": rep["texto"], "tipo": rep["tipo"],
            "personas": rep["personas"], "hora_unix": rep["hora_unix"],
            "prioridad": t["prioridad"], "fuente": t.get("fuente"),
            "vinculo": v["vinculo"], "similitud": v.get("similitud"),
            "senales": t["evidencia"], "rutas": len(rutas[rid]),
        })

    fundador = recibidos[rids[0]]
    dispositivos = {dispositivo(r) for r in rids}
    directas = fuentes.count("directa")
    if fuentes and all(f == "de_oidas" for f in fuentes):
        corroboracion = "posible_rumor"
    elif len(dispositivos) >= 2 and directas >= 1:
        corroboracion = "corroborado"
    else:
        corroboracion = "sin_confirmar"

    accion = None
    if propuesta:
        accion = {"id": propuesta.id, **{k: v for k, v in propuesta.datos.items()
                                          if k != "incidente_id"}}
    estado, dec = "sin_propuesta", None
    if accion:
        estado = "pendiente"
        if decision and decision.datos["accion_id"] == accion["id"]:
            estado = "aprobada" if decision.datos["decision"] == "aprobar" else "rechazada"
            dec = {k: v for k, v in decision.datos.items() if k != "incidente_id"}

    tipos = Counter(recibidos[r]["tipo"] for r in rids)
    return Incidente(
        id=inc_id,
        prioridad=min(prioridades),
        tipo=tipos.most_common(1)[0][0],
        geohash=fundador["geohash"],
        hora_unix=fundador["hora_unix"],
        reportes=rids,
        evidencia=evidencia,
        incertidumbre={
            "revisar": bool(motivos or contradicciones or posibles or discrepancias),
            "motivos": motivos,
            "corroboracion": corroboracion,
            "dispositivos": len(dispositivos),
            "fuentes_directas": directas,
            "contradicciones": contradicciones,
            "posibles_mismo_incidente": posibles,
            "discrepancias_entre_centrales": discrepancias,
            "sin_ubicacion": fundador["geohash"] is None,
            "sin_analisis_ia": sin_ia,
        },
        estado=estado,
        accion_propuesta=accion,
        decision=dec,
    )


def todos(conn: sqlite3.Connection) -> dict[str, Incidente]:
    return construir(eventos.leer(conn))


def uno(conn: sqlite3.Connection, incidente_id: str) -> Incidente | None:
    return construir(eventos.de_incidente(conn, incidente_id)).get(incidente_id)
