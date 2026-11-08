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
    propuestas_por_id: dict[str, Evento] = {}
    declaraciones: dict[tuple[str, str], Evento] = {}
    aprobaciones: list[Evento] = []

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
            propuestas_por_id[ev.id] = ev
        elif ev.tipo == "decision_humana":
            decisiones[d["incidente_id"]] = ev
            if d["decision"] == "aprobar":
                aprobaciones.append(ev)
        elif ev.tipo == "recurso_declarado":
            declaraciones[(d["entidad"], d["recurso"])] = ev

    miembros: dict[str, list[str]] = defaultdict(list)
    for rid, v in vinculos.items():
        if rid in recibidos and rid in priorizados:
            miembros[v["incidente_id"]].append(rid)

    out = {}
    for inc_id, rids in miembros.items():
        rids.sort(key=lambda r: recibidos[r]["hora_unix"])
        out[inc_id] = _incidente(inc_id, rids, recibidos, priorizados, rutas, vinculos,
                                 propuestas.get(inc_id), decisiones.get(inc_id))
    _asignar_recursos(out, estado_recursos(declaraciones, aprobaciones, propuestas_por_id))
    return out


def estado_recursos(declaraciones, aprobaciones, propuestas_por_id) -> dict[tuple, dict]:
    """Unidades por recurso: lo declarado menos lo aprobado después de la última declaración."""
    out = {}
    for clave, dec in declaraciones.items():
        usados = set()
        for ap in aprobaciones:
            prop = propuestas_por_id.get(ap.datos["accion_id"])
            if (prop and ap.creado_en > dec.creado_en
                    and (prop.datos["entidad"], prop.datos.get("recurso")) == clave):
                usados.add(ap.datos["incidente_id"])  # un incidente compromete una unidad
        n = dec.datos["disponibles"]
        out[clave] = {"entidad": clave[0], "recurso": clave[1], "declarados": n,
                      "comprometidos": len(usados), "disponibles": max(0, n - len(usados)),
                      "coordinador": dec.datos["coordinador"], "declarado_en": dec.creado_en}
    return out


def _asignar_recursos(incs: dict[str, "Incidente"], estado: dict[tuple, dict]) -> None:
    for inc in incs.values():
        a = inc.accion_propuesta
        if not a or not a.get("recurso"):
            continue
        clave = (a["entidad"], a["recurso"])
        compiten = sorted(
            o.id for o in incs.values()
            if o.id != inc.id and o.estado == "pendiente" and o.prioridad <= inc.prioridad
            and o.accion_propuesta
            and (o.accion_propuesta["entidad"], o.accion_propuesta.get("recurso")) == clave)
        inc.recurso = {"recurso": a["recurso"], "entidad": a["entidad"],
                       "disponibles": estado[clave]["disponibles"] if clave in estado else None,
                       "compiten": compiten}


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
    evs = eventos.leer(conn, tipos=["recurso_declarado", "decision_humana", "accion_propuesta"])
    declaraciones, aprobaciones, props = {}, [], {}
    for ev in sorted(evs, key=lambda e: e.creado_en):
        if ev.tipo == "recurso_declarado":
            declaraciones[(ev.datos["entidad"], ev.datos["recurso"])] = ev
        elif ev.tipo == "accion_propuesta":
            props[ev.id] = ev
        elif ev.datos["decision"] == "aprobar":
            aprobaciones.append(ev)
    return sorted(estado_recursos(declaraciones, aprobaciones, props).values(),
                  key=lambda r: (r["entidad"], r["recurso"]))


def uno(conn: sqlite3.Connection, incidente_id: str) -> Incidente | None:
    return construir(eventos.de_incidente(conn, incidente_id)).get(incidente_id)
