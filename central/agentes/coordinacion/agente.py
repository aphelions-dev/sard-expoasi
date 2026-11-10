"""Agente de coordinación: propone una acción por incidente; nunca la ejecuta.

Consume `incidente_actualizado` y produce `accion_propuesta`. Cada vez que un incidente cambia
se propone de nuevo, y la propuesta queda pendiente hasta `POST /incidentes/{id}/aprobacion`.
Ficha: `docs/fichas-agentes/coordinacion.md`.

La entidad sale de la matriz de responsabilidades que describió el comandante de Bomberos de
Manizales (Bomberos lidera búsqueda y rescate, incendios y evacuación). Deslizamiento, inundación
y fuga de gas van a Bomberos por esa misma regla; el comandante no los nombró uno por uno. Sin IA:
reglas y una plantilla, para que la recomendación sea explicable.

Si quien reportó marcó «otro» y el triaje vio con claridad otro tipo en el texto, la propuesta va
a la entidad de ese tipo en vez de a la sala de crisis, y lo dice. El tipo del incidente no cambia.
"""

import sqlite3
from typing import Any

from registro import eventos
from vista import incidentes

ENTIDAD = {
    "ATRAP": ("Bomberos", "búsqueda y rescate"),
    "FUEGO": ("Bomberos", "control del incendio y evacuación"),
    "DESLIZ": ("Bomberos", "búsqueda, rescate y evacuación por el deslizamiento"),
    "INUND": ("Bomberos", "evacuación y control de la inundación"),
    "GAS": ("Bomberos", "control de la fuga y evacuación"),
    "MEDIC": ("Cruz Roja", "atención prehospitalaria"),
    "DESAP": ("Cruz Roja", "búsqueda y restablecimiento de contacto familiar"),
    "VIA": ("Defensa Civil", "evaluación y despeje de la vía"),
    "OTRO": ("Sala de crisis", "verificación y asignación"),
}

# Recurso que usaría cada tipo (`contracts/api-central.md`, Recursos). Las unidades las registra
# cada entidad; la vista del incidente dice cuántas hay disponibles y cuáles tiene asignadas.
RECURSO = {
    "ATRAP": "equipo de rescate",
    "FUEGO": "máquina de bomberos",
    "DESLIZ": "equipo de rescate",
    "INUND": "máquina de bomberos",
    "GAS": "máquina de bomberos",
    "MEDIC": "ambulancia",
    "DESAP": "equipo de búsqueda",
    "VIA": "cuadrilla",
    "OTRO": None,
}
RECURSOS = {(ENTIDAD[t][0], r) for t, r in RECURSO.items() if r}

NOMBRE = {
    "ATRAP": "personas atrapadas",
    "FUEGO": "incendio",
    "DESLIZ": "deslizamiento",
    "INUND": "inundación",
    "GAS": "fuga de gas",
    "MEDIC": "urgencia médica",
    "DESAP": "persona desaparecida",
    "VIA": "vía afectada",
}


def tipo_para_proponer(inc: incidentes.Incidente) -> str:
    """El tipo del incidente, salvo que sea «otro» y el triaje haya visto uno concreto."""
    if inc.tipo == "OTRO" and inc._tipo_sugerido in NOMBRE:
        return inc._tipo_sugerido
    return inc.tipo


def proponer(inc: incidentes.Incidente) -> dict[str, Any]:
    tipo = tipo_para_proponer(inc)
    entidad, tarea = ENTIDAD[tipo]
    inc_ = inc.incertidumbre
    lugar = f"la zona {inc.geohash}" if inc.geohash else "ubicación sin confirmar"
    personas = max((e["personas"] for e in inc.evidencia), default=0)

    falta = []
    if inc_["sin_ubicacion"]:
        falta.append("ubicación del incidente")
    if inc_["corroboracion"] != "corroborado":
        falta.append("una segunda fuente que lo haya visto en persona")
    if tipo != inc.tipo:
        falta.append(f"el tipo de emergencia: se marcó «otro» y el mensaje parece {NOMBRE[tipo]}")
    if tipo in ("ATRAP", "MEDIC") and personas == 0:
        falta.append("número de personas afectadas")
    if inc_["contradicciones"]:
        falta.append("datos contradictorios entre reportes")
    if inc_["posibles_mismo_incidente"]:
        falta.append("si es el mismo suceso que otro incidente cercano")

    justificacion = (
        f"{len(inc.reportes)} reporte(s) de {inc_['dispositivos']} dispositivo(s); "
        f"corroboración: {inc_['corroboracion'].replace('_', ' ')}; prioridad {inc.prioridad}."
    )
    if inc_["sin_analisis_ia"]:
        justificacion += " Sin análisis de IA: priorizado solo con reglas."
    if tipo != inc.tipo:
        justificacion += f" Se marcó «otro»; por el mensaje se trata como {NOMBRE[tipo]}."

    return {
        "incidente_id": inc.id,
        "entidad": entidad,
        "recurso": RECURSO[tipo],
        "accion": f"Enviar a {entidad} para {tarea} en {lugar}",
        "prioridad": inc.prioridad,
        "personas_estimadas": personas,
        "justificacion": justificacion,
        "falta_confirmar": falta,
        "requiere_aprobacion": True,
    }


def procesar(conn: sqlite3.Connection, ev: eventos.Evento) -> dict[str, Any]:
    inc = incidentes.uno(conn, ev.datos["incidente_id"])
    if inc is None:  # el reporte aún no tiene todos sus eventos; se reintenta
        raise LookupError(f"incidente {ev.datos['incidente_id']} incompleto")
    return proponer(inc)
