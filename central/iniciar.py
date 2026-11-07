"""Levanta una central completa: API y los cuatro agentes, cada uno en su proceso.

    uv run --env-file ../.env python iniciar.py A      # central A en el puerto 8001
    uv run --env-file ../.env python iniciar.py B      # central B en el puerto 8002

Ctrl+C (o cerrar la ventana) apaga todo: así se simula la caída de una central en la demo.
Los procesos de los agentes son independientes: si uno muere, los demás siguen.
"""

import os
import subprocess
import sys
import time

PUERTOS = {"A": 8001, "B": 8002}
AGENTES = ["triaje", "correlacion", "coordinacion", "resiliencia"]


def main() -> None:
    nodo = (sys.argv[1] if len(sys.argv) > 1 else "A").upper()
    if nodo not in PUERTOS:
        raise SystemExit("uso: python iniciar.py A|B")
    env = {**os.environ, "SARD_NODO": nodo, "PYTHONUTF8": "1"}
    for n, puerto in PUERTOS.items():  # el .env manda; si está vacío, las dos en este equipo
        env[f"CENTRAL_{n}_URL"] = env.get(f"CENTRAL_{n}_URL") or f"http://localhost:{puerto}"
    py = sys.executable
    comandos = [[py, "-m", "uvicorn", "api.main:app", "--host", "0.0.0.0",
                 "--port", str(PUERTOS[nodo])]]
    comandos += [[py, "-m", f"agentes.{a}"] for a in AGENTES]
    procesos = [subprocess.Popen(c, env=env, cwd=os.path.dirname(os.path.abspath(__file__)))
                for c in comandos]
    print(f"Central {nodo} en http://localhost:{PUERTOS[nodo]} con {len(AGENTES)} agentes.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        for p in procesos:
            p.terminate()
        for p in procesos:
            p.wait(timeout=10)


if __name__ == "__main__":
    main()
