"""Vista de incidentes para el tablero, calculada a partir del registro de eventos.

No guarda nada: cada consulta pliega los eventos. Así la central B muestra lo mismo que la A
apenas tiene sus eventos, y una corrección es siempre un evento nuevo.
"""

import sqlite3
import time
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Any

from registro import eventos
from registro.eventos import Evento


SIN_NOTICIAS_S = 60 * 60  # `vigencia.sin_noticias_recientes` (contracts/api-central.md)
CONFIANZA = {"corroborado": 0, "sin_confirmar": 1, "posible_rumor": 2}


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
    impacto: dict[str, Any] = field(default_factory=dict)
    vigencia: dict[str, Any] = field(default_factory=dict)
    motivo_orden: str = ""
    recurso: dict[str, Any] | None = None
    _fuentes: list[str] = field(default_factory=list, repr=False)


def construir(evs: list[Evento]) -> dict[str, Incidente]:
    recibidos: dict[str, dict] = {}
    priorizados: dict[str, list[dict]] = defaultdict(list)
    rutas: dict[str, set] = defaultdict(set)
    vinculos: dict[str, dict] = {}
    propuestas: dict[str, Evento] = {}
    decisiones: dict[str, Evento] = {}
    unidad_evs: list[Evento] = []

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
        elif ev.tipo in ("unidad_registrada", "unidad_estado"):
            unidad_evs.append(ev)

    miembros: dict[str, list[str]] = defaultdict(list)
    for rid, v in vinculos.items():
        if rid in recibidos and rid in priorizados:
            miembros[v["incidente_id"]].append(rid)

    out = {}
    for inc_id, rids in miembros.items():
        rids.sort(key=lambda r: recibidos[r]["hora_unix"])
        out[inc_id] = _incidente(inc_id, rids, recibidos, priorizados, rutas, vinculos,
                                 propuestas.get(inc_id), decisiones.get(inc_id))
    _asignar_recursos(out, unidades(unidad_evs))
    return out


def unidades(evs: list[Evento]) -> dict[str, dict[str, Any]]:
    """Estado vigente de cada unidad (SCI-211): el último cambio que reportó su entidad."""
    out: dict[str, dict[str, Any]] = {}
    for ev in sorted(evs, key=lambda e: e.creado_en):
        d = ev.datos
        if ev.tipo == "unidad_registrada":
            if d["matricula"] not in out:  # si A y B la registraron, vale la primera
                out[d["matricula"]] = {
                    "entidad": d["entidad"], "recurso": d["recurso"], "matricula": d["matricula"],
                    "estado": "disponible", "incidente_id": None,
                    "reportado_por": d["reportado_por"], "reportado_en": ev.creado_en, "nota": ""}
        elif d["matricula"] in out:
            out[d["matricula"]].update(
                estado=d["estado"], incidente_id=d["incidente_id"],
                reportado_por=d["reportado_por"], reportado_en=ev.creado_en, nota=d["nota"])
    return out


def _clave(inc: "Incidente") -> tuple[str, str] | None:
    a = inc.accion_propuesta
    return (a["entidad"], a["recurso"]) if a and a.get("recurso") else None


def _asignar_recursos(incs: dict[str, "Incidente"], unids: dict[str, dict]) -> None:
    asignadas: dict[str, list[str]] = defaultdict(list)
    disponibles: Counter = Counter()
    registrados = set()
    for u in unids.values():
        registrados.add((u["entidad"], u["recurso"]))
        if u["estado"] == "asignada":
            asignadas[u["incidente_id"]].append(u["matricula"])
        elif u["estado"] == "disponible":
            disponibles[(u["entidad"], u["recurso"])] += 1

    for inc in incs.values():
        clave = _clave(inc)
        if clave is None:
            continue
        compiten = sorted(
            o.id for o in incs.values()
            if o.id != inc.id and o.estado in ("pendiente", "aprobada")
            and o.prioridad <= inc.prioridad and _clave(o) == clave and not asignadas[o.id])
        inc.recurso = {"recurso": clave[1], "entidad": clave[0],
                       "disponibles": disponibles[clave] if clave in registrados else None,
                       "compiten": compiten, "solicitado": inc.estado == "aprobada",
                       "asignadas": sorted(asignadas[inc.id])}


def clave_orden(inc: "Incidente") -> tuple:
    """Urgencia, impacto y confianza (bases, objetivo 4); la hora desempata."""
    return (inc.prioridad, not inc.impacto["vulnerables"], -inc.impacto["personas"],
            CONFIANZA[inc.incertidumbre["corroboracion"]], inc.hora_unix)


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
    personas = max(recibidos[r]["personas"] for r in rids)
    vulnerables = any(recibidos[r]["vulnerables"] for r in rids)
    ultimo = max(recibidos[r]["hora_unix"] for r in rids)
    sin_noticias = max(0, int(time.time()) - ultimo)
    motivo = [min(prioridades)]
    if vulnerables:
        motivo.append("niños o adultos mayores")
    motivo += [f"{personas} persona{'s' if personas != 1 else ''}",
               corroboracion.replace("_", " ")]
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
        impacto={"personas": personas, "vulnerables": vulnerables},
        vigencia={"ultimo_reporte_unix": ultimo, "minutos_sin_noticias": sin_noticias // 60,
                  "sin_noticias_recientes": sin_noticias > SIN_NOTICIAS_S},
        motivo_orden=" · ".join(motivo),
    )


def todos(conn: sqlite3.Connection) -> dict[str, Incidente]:
    return construir(eventos.leer(conn))


def recursos(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """`GET /recursos`: una fila por recurso con al menos una unidad registrada."""
    evs = eventos.leer(conn)
    incs = sorted(construir(evs).values(), key=clave_orden)
    unids = unidades([e for e in evs if e.tipo in ("unidad_registrada", "unidad_estado")])
    filas: dict[tuple[str, str], dict[str, Any]] = {}
    for u in sorted(unids.values(), key=lambda u: u["matricula"]):
        clave = (u["entidad"], u["recurso"])
        f = filas.setdefault(clave, {
            "entidad": clave[0], "recurso": clave[1], "disponibles": 0, "asignadas": 0,
            "no_disponibles": 0, "solicitudes_abiertas": [], "unidades": []})
        f[{"disponible": "disponibles", "asignada": "asignadas",
           "no_disponible": "no_disponibles"}[u["estado"]]] += 1
        f["unidades"].append({k: u[k] for k in ("matricula", "estado", "incidente_id",
                                                 "reportado_por", "reportado_en", "nota")})
    for inc in incs:
        clave = _clave(inc)
        if clave in filas and inc.recurso["solicitado"] and not inc.recurso["asignadas"]:
            filas[clave]["solicitudes_abiertas"].append(inc.id)
    return [filas[c] for c in sorted(filas)]


def uno(conn: sqlite3.Connection, incidente_id: str) -> Incidente | None:
    return construir(eventos.de_incidente(conn, incidente_id)).get(incidente_id)
