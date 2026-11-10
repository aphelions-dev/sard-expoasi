"""Preguntas a Jev y sus umbrales, en un solo lugar para revisarlas.

Jev hace juicios atómicos sobre el texto (Noul: probabilidad de que algo sea cierto) y el
código decide la prioridad con ellos (ver `agente.py`). Umbrales iniciales de la guía de
TypeSafe: >= 0,7 es sí, < 0,3 es no, y en medio no está claro. Probadas con reportes en
español el 7/nov/2026; se recalibran con los 100 reportes etiquetados (#13).
"""

import os
from dataclasses import dataclass

from typesafe_sdk import Choice, Noul, RetryPolicy, TypeSafeClient

MODELO = "jev-1.14.0"  # versión fija: los umbrales se calibraron con ella
TIMEOUT_S = 8.0
SI = 0.7
NO = 0.3

# Señal -> prioridad que justifica cuando Jev la da por cierta.
QUE_SUBE = {
    "atrapados": "P1",
    "no_respira": "P1",
    "inconsciente": "P1",
    "sangrado_grave": "P1",
    "incendio_activo": "P1",
    "riesgo_vital": "P1",
    "herido": "P2",
}

PREGUNTAS = {
    "atrapados": Noul(
        instructions="Hay personas atrapadas que no pueden salir por sí mismas",
        criteria={"true": "Alguien está atrapado bajo escombros, encerrado o sin poder salir",
                  "false": "Las personas pueden moverse y salir por su cuenta"},
    ),
    "no_respira": Noul(instructions="Alguien no respira o tiene dificultad grave para respirar"),
    "inconsciente": Noul(instructions="Alguien está inconsciente o no responde"),
    "sangrado_grave": Noul(instructions="Alguien sangra en abundancia"),
    "incendio_activo": Noul(instructions="Hay fuego o humo saliendo ahora mismo"),
    "herido": Noul(instructions="Hay al menos una persona herida"),
    "riesgo_vital": Noul(instructions="Alguna persona corre riesgo inmediato de morir"),
    "testigo_directo": Noul(
        instructions="Quien escribe está viendo la situación en persona",
        criteria={"true": "Describe lo que ve o vive en ese momento",
                  "false": "Repite lo que otra persona le contó o un rumor ('dicen que', 'me contaron')"},
    ),
    "tipo": Choice(
        instructions="Qué tipo de emergencia describe el reporte",
        criteria={
            "ATRAP": "Personas atrapadas o estructura colapsada",
            "MEDIC": "Persona herida o con urgencia médica",
            "FUEGO": "Incendio o humo",
            "DESLIZ": "Deslizamiento de tierra o derrumbe de una ladera",
            "INUND": "Inundación, creciente o desbordamiento de una quebrada",
            "GAS": "Fuga de gas u olor a gas",
            "VIA": "Vía bloqueada o daño en la vía",
            "DESAP": "Persona desaparecida",
            "OTRO": "Otra situación",
        },
    ),
}


@dataclass(frozen=True)
class Respuesta:
    modelo: str
    nouls: dict[str, float]
    tipo: str
    tipo_probabilidad: float


class Jev:
    def __init__(self, api_key: str | None = None):
        key = api_key or os.environ.get("JEV_API_KEY")
        self._cliente = (
            TypeSafeClient(api_key=key, model=MODELO, timeout=TIMEOUT_S,
                           retry=RetryPolicy(max_retries=1))
            if key else None
        )

    @property
    def disponible(self) -> bool:
        return self._cliente is not None

    def preguntar(self, state, questions):
        """Una llamada a Jev. Lanza excepción si no responde: un fallo nunca se lee como «no»."""
        if self._cliente is None:
            raise RuntimeError("JEV_API_KEY no configurada")
        return self._cliente.system_one(state=state, questions=questions)

    def evaluar(self, texto: str) -> Respuesta:
        r = self.preguntar({"reporte": texto}, PREGUNTAS)
        tipo = r.choices["tipo"]
        return Respuesta(
            modelo=r.model,
            nouls={k: v.noul for k, v in r.nouls.items()},
            tipo=tipo.choice,
            tipo_probabilidad=tipo.probabilities[tipo.choice],
        )
