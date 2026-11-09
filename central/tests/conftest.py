import importlib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

EJEMPLOS = Path(__file__).parents[2] / "contracts" / "ejemplos"


def ejemplo(n: int) -> list[str]:
    """Líneas del ejemplo `NN-*.txt` de contracts/ejemplos."""
    (archivo,) = EJEMPLOS.glob(f"{n:02d}-*.txt")
    return [l for l in archivo.read_text(encoding="utf-8").splitlines() if l.strip()]


@pytest.fixture
def cliente(tmp_path, monkeypatch):
    monkeypatch.setenv("SARD_NODO", "A")
    monkeypatch.setenv("SARD_DB", str(tmp_path / "central.sqlite"))
    monkeypatch.delenv("JEV_API_KEY", raising=False)
    monkeypatch.delenv("CENTRAL_B_URL", raising=False)
    import api.main

    importlib.reload(api.main)
    with TestClient(api.main.app) as c:
        yield c
