"""Preguntas a Jev para la correlación y sus umbrales, en un solo lugar.

Una pregunta por candidato: «¿el reporte nuevo describe el mismo suceso que este incidente?»
y «¿lo contradice en algún dato?». El código filtra antes por distancia y hora, y decide con
las probabilidades (ver `agente.py`).
"""

from typing import Any

from typesafe_sdk import Noul

from agentes.triaje.jev import Jev  # mismo cliente, modelo y timeout que el triaje

SI = 0.7
NO = 0.3
MAX_CANDIDATOS = 5


def preguntas(candidatos: list[str]) -> dict[str, Noul]:
    q: dict[str, Noul] = {}
    for i, inc in enumerate(candidatos):
        q[f"mismo_{i}"] = Noul(
            instructions=f"`reporte_nuevo` describe el mismo suceso que `candidatos.{inc}`",
            criteria={"true": "Es el mismo derrumbe, incendio, persona o lugar visto por otra persona",
                      "false": "Es otro suceso, aunque sea del mismo tipo o de la misma zona"},
        )
        q[f"contradice_{i}"] = Noul(
            instructions=f"`reporte_nuevo` contradice algún dato concreto de `candidatos.{inc}`",
            criteria={"true": "Difieren en el número de personas, si siguen atrapadas, si hay fuego, o el lugar exacto",
                      "false": "Los datos coinciden o se complementan"},
        )
    return q


def comparar(cliente: Jev, nuevo: dict[str, Any], candidatos: dict[str, dict[str, Any]]):
    """Devuelve {incidente_id: (p_mismo, p_contradice)}. Lanza excepción si Jev falla."""
    ids = list(candidatos)
    r = cliente.preguntar({"reporte_nuevo": nuevo, "candidatos": candidatos}, preguntas(ids))
    return {inc: (r.nouls[f"mismo_{i}"].noul, r.nouls[f"contradice_{i}"].noul)
            for i, inc in enumerate(ids)}
