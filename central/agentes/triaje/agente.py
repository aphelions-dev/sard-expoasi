"""Agente de triaje: reglas primero, Jev después; Jev solo puede subir la prioridad.

Consume `reporte_recibido` y produce `reporte_priorizado`. Ficha: `docs/fichas-agentes/triaje.md`.

Tabla de decisión:
- prioridad de reglas = la más alta entre la del celular, las banderas del formulario y las
  palabras críticas del texto (ADR 0005);
- prioridad de Jev = P1 si alguna señal vital supera el umbral de sí, P2 si «herido» lo supera;
- prioridad final = la más alta de las dos. Nunca más baja que la de reglas.
- revisión humana si Jev subió la prioridad, si el riesgo vital quedó en la zona dudosa, o si
  Jev ve otro tipo de emergencia con claridad.
"""

import sqlite3
from dataclasses import asdict
from typing import Any

from agentes.triaje import jev as jev_mod
from agentes.triaje import reglas
from registro import eventos


def mas_alta(*prioridades: str | None) -> str:
    return min(p for p in prioridades if p)  # "P1" < "P2" < ...


def senales_jev(nouls: dict[str, float], si: float = jev_mod.SI) -> list[reglas.Senal]:
    """Señales que Jev da por ciertas con el umbral `si`. La calibración prueba otros umbrales."""
    return [reglas.Senal(nombre, "jev", p, probabilidad=nouls[nombre])
            for nombre, p in jev_mod.QUE_SUBE.items() if nouls[nombre] >= si]


def triar(reporte: dict[str, Any], cliente: jev_mod.Jev) -> dict[str, Any]:
    senales = reglas.senales(reporte)
    p_reglas = mas_alta(*(s.prioridad for s in senales))
    revision: list[str] = []
    datos: dict[str, Any] = {"prioridad_reglas": p_reglas, "prioridad_jev": None}

    if not reporte["texto"].strip():
        datos["jev"] = "no_aplica"  # sin texto no hay nada que Jev pueda juzgar
    elif not cliente.disponible:
        datos["jev"] = "caido"
    else:
        try:
            r = cliente.evaluar(reporte["texto"])
        except Exception as e:  # sigue con reglas; el error queda en el evento
            datos.update(jev="caido", jev_error=repr(e))
        else:
            datos.update(jev="ok", jev_modelo=r.modelo, jev_nouls=r.nouls,
                         tipo_jev=r.tipo, tipo_jev_probabilidad=r.tipo_probabilidad)
            de_jev = senales_jev(r.nouls)
            senales += de_jev
            subidas = [s.prioridad for s in de_jev]
            datos["prioridad_jev"] = mas_alta(*subidas) if subidas else None

            riesgo = r.nouls["riesgo_vital"]
            if jev_mod.NO <= riesgo < jev_mod.SI:
                revision.append(f"riesgo vital dudoso ({riesgo:.2f})")
            if r.tipo != reporte["tipo"] and r.tipo_probabilidad >= jev_mod.SI:
                revision.append(f"el celular dice {reporte['tipo']}, Jev ve {r.tipo}")
            testigo = r.nouls["testigo_directo"]
            datos["fuente"] = ("directa" if testigo >= jev_mod.SI
                               else "de_oidas" if testigo < jev_mod.NO else "incierta")

    final = mas_alta(p_reglas, datos["prioridad_jev"])
    if final < p_reglas:
        revision.append(f"Jev subió la prioridad de {p_reglas} a {final}")

    return {
        **datos,
        "prioridad": final,
        "tipo": reporte["tipo"],
        "evidencia": [asdict(s) for s in senales],
        "revisar": bool(revision),
        "motivos_revision": revision,
    }


def procesar(cliente: jev_mod.Jev):
    def _procesar(conn: sqlite3.Connection, ev: eventos.Evento) -> dict[str, Any]:
        return triar(ev.datos, cliente)
    return _procesar
