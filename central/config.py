"""Configuración de una instancia de la central, leída del entorno."""

import os
from dataclasses import dataclass
from pathlib import Path

DIR_DATOS = Path(__file__).parent / "datos"


@dataclass(frozen=True)
class Config:
    nodo: str  # "A" o "B"
    db: Path
    jev_api_key: str | None


def cargar() -> Config:
    nodo = os.environ.get("SARD_NODO", "A").upper()
    if nodo not in ("A", "B"):
        raise ValueError(f"SARD_NODO debe ser A o B, no {nodo!r}")
    db = Path(os.environ.get("SARD_DB", DIR_DATOS / f"central-{nodo}.sqlite"))
    return Config(nodo=nodo, db=db, jev_api_key=os.environ.get("JEV_API_KEY") or None)
