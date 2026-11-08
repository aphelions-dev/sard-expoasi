"""Línea de comandos del simulador.

    PYTHONUTF8=1 uv run python -m simulador generar --n 20 --semilla 1
    PYTHONUTF8=1 uv run python -m simulador correr --semilla 1 --perdida 0.3
    PYTHONUTF8=1 uv run python -m simulador correr --central --velocidad 10   # API real, A → B
    PYTHONUTF8=1 uv run python -m simulador correr --desde ../pruebas/resultados/<corrida>/parametros.json
"""

import argparse
import json
import os
import random
import time
from dataclasses import fields

from .centrales import CentralHttp
from .generador import Generador
from .malla import Parametros, Simulacion
from .metricas import calcular, guardar, resumen


def _tipo(f):
    if f.name == "caida":
        return lambda s: tuple(int(x) for x in s.split(","))
    if f.name == "vence_s":
        return int
    return type(f.default)


def main() -> None:
    ap = argparse.ArgumentParser(prog="simulador")
    sub = ap.add_subparsers(dest="cmd", required=True)

    g = sub.add_parser("generar", help="imprime reportes SARD1 sintéticos")
    g.add_argument("--n", type=int, default=10)
    g.add_argument("--semilla", type=int, default=1)

    e = sub.add_parser("escenarios", help="E1–E4 de pruebas/escenarios.md con el simulador")
    e.add_argument("claves", nargs="*", default=["E1", "E2", "E3", "E4"])

    ec = sub.add_parser("escenarios-central", help="E4, E5 y E6/E7 contra centrales reales que levanta y apaga")
    ec.add_argument("--env-file", help="archivo .env con JEV_API_KEY para correr E6 con Jev")

    rc = sub.add_parser("recorrido", help="recorrido de 8 pasos de la demo con visor web (http://localhost:8090)")
    rc.add_argument("--seguido", action="store_true", help="avanzar solo, sin Enter (ensayo o video)")
    rc.add_argument("--pausa", type=float, default=8.0, help="segundos por paso con --seguido")
    rc.add_argument("--env-file", help="archivo .env con JEV_API_KEY")

    c = sub.add_parser("correr", help="corre la malla y guarda resultados en pruebas/resultados/")
    for f in fields(Parametros):
        ayuda = "desde,hasta en segundos" if f.name == "caida" else None
        c.add_argument(f"--{f.name.replace('_', '-')}", type=_tipo(f), default=None, help=ayuda)
    c.add_argument("--desde", help="parametros.json de una corrida anterior, para repetirla")
    c.add_argument("--central", action="store_true", help="entregar a la API real (CENTRAL_A_URL, CENTRAL_B_URL)")
    c.add_argument("--nombre", help="carpeta de resultados (por defecto, sale de los parámetros)")
    a = ap.parse_args()

    if a.cmd == "escenarios":
        from .escenarios import correr as correr_escenarios
        correr_escenarios(a.claves)
        return

    if a.cmd == "escenarios-central":
        from .escenarios_central import correr as correr_central
        correr_central(a.env_file)
        return

    if a.cmd == "recorrido":
        from .recorrido import main as recorrido
        recorrido(a.seguido, a.env_file, a.pausa)
        return

    if a.cmd == "generar":
        gen = Generador(random.Random(a.semilla))
        for i in range(a.n):
            print(gen.nuevo(f"g{i % 5}", random.Random(a.semilla + i).uniform(0, 250),
                            random.Random(a.semilla - i).uniform(0, 250), Parametros.hora_base + i * 30).linea())
        return

    base = json.load(open(a.desde, encoding="utf-8")) if a.desde else {}
    if "caida" in base and base["caida"] is not None:
        base["caida"] = tuple(base["caida"])
    valores = {**base, **{f.name: getattr(a, f.name) for f in fields(Parametros) if getattr(a, f.name) is not None}}
    central = None
    if a.central:
        central = CentralHttp({"A": os.environ.get("CENTRAL_A_URL") or "http://127.0.0.1:8001",
                               "B": os.environ.get("CENTRAL_B_URL") or "http://127.0.0.1:8002"})
        # La central acepta cada id una vez: cada corrida real lleva su propio prefijo y su hora.
        valores.setdefault("prefijo", f"s{int(time.time()) % 100000}n")
        valores.setdefault("hora_base", int(time.time()))
    p = Parametros(**valores)
    sim = Simulacion(p, central).correr()
    nombre = a.nombre or (f"{'central' if a.central else 'sim'}-s{p.semilla}-n{p.nodos}-a{p.alcance_m:g}"
                          f"-p{int(p.perdida * 100)}")
    destino = guardar(sim, nombre)
    print(resumen(nombre, vars(p), calcular(sim)))
    if a.central:
        print(f"Subidas por central: {central.usadas}")
    print(f"Resultados en {destino}")


if __name__ == "__main__":
    main()
