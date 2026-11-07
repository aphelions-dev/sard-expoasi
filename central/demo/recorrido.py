"""Recorrido de la demo en la parte de la central (pasos 4, 5, 7 y 8 de `docs/pitch/guion-demo.md`).

Hace de pasarela: sube reportes SARD1 sintéticos con `POST /reportes` a la central que responda
`GET /salud` (A primero, si no B) y muestra lo que devuelve. Sirve para ensayar la central sin
celulares y como plan B si la malla falla en vivo.

    # terminal 1 y 2: las dos centrales (ver central/README.md)
    uv run --env-file ../.env python iniciar.py A
    uv run --env-file ../.env python iniciar.py B
    # terminal 3: el recorrido; pausa entre pasos y pide apagar y levantar la A
    uv run --env-file ../.env python -m demo.recorrido
    # sin pausas (para probarlo de corrido, sin apagar la A): agregar --seguido

Cada corrida usa ids nuevos, así que se puede repetir sin borrar las bases.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request

import pygeohash

CENTRALES = {"A": os.environ.get("CENTRAL_A_URL") or "http://localhost:8001",
             "B": os.environ.get("CENTRAL_B_URL") or "http://localhost:8002"}
ZONA = pygeohash.encode(5.0689, -75.5174, 6)  # centro de Manizales, datos sintéticos
BASE = int(time.time())  # contador de esta corrida: ids distintos en cada ensayo


def sard1(disp: str, n: int, prioridad: str, tipo: str, personas: int, banderas: str,
          texto: str, geohash: str = ZONA) -> str:
    return f"SARD1|{disp}-{BASE + n}|{prioridad}|{tipo}|{personas}|{banderas}|{geohash}|{int(time.time())}|{texto}"


def pedir(url: str, datos: dict | None = None, timeout: float = 5.0):
    cuerpo = json.dumps(datos).encode() if datos is not None else None
    req = urllib.request.Request(url, data=cuerpo, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def viva(nodo: str) -> bool:
    try:
        return pedir(f"{CENTRALES[nodo]}/salud", timeout=1.0)["estado"] == "ok"
    except (OSError, ValueError):
        return False


def central_activa() -> str:
    """Lo que hace la pasarela: A si responde, si no B."""
    for nodo in ("A", "B"):
        if viva(nodo):
            return nodo
    raise SystemExit("Ninguna central responde a /salud; levántalas con iniciar.py")


def subir(mensajes: list[str], pasarela: str) -> tuple[str, set[str]]:
    """Devuelve la central que respondió y los ids que recibieron SACK."""
    nodo = central_activa()
    r = pedir(f"{CENTRALES[nodo]}/reportes", {"mensajes": mensajes, "pasarela_id": pasarela})
    print(f"  {pasarela} → central {nodo}")
    for s in r["sack"]:
        print(f"    ✔ {s}")
    for x in r["rechazados"]:
        print(f"    ✘ rechazado ({x['motivo']}): {x['mensaje'][:60]}")
    return nodo, {s.split("|")[1] for s in r["sack"]}


def esperar_incidentes(nodo: str, esperados: set[str], limite_s: float = 40) -> list[dict]:
    fin = time.monotonic() + limite_s
    while True:
        incs = pedir(f"{CENTRALES[nodo]}/incidentes")
        vistos = {r for i in incs for r in i["reportes"]}
        listos = esperados <= vistos and all(
            i["accion_propuesta"] for i in incs if set(i["reportes"]) & esperados)
        if listos or time.monotonic() > fin:
            if not esperados <= vistos:
                print(f"  (faltan {sorted(esperados - vistos)} tras {limite_s:.0f} s)")
            return [i for i in incs if set(i["reportes"]) & esperados]
        time.sleep(1)


def mostrar(incs: list[dict]) -> None:
    for i in incs:
        inc = i["incertidumbre"]
        print(f"\n  {i['id']}  {i['prioridad']} {i['tipo']}  {len(i['reportes'])} reporte(s)  "
              f"estado: {i['estado']}")
        print(f"    corroboración: {inc['corroboracion']} · revisar: {inc['revisar']}"
              + (f" · sin análisis de IA" if inc["sin_analisis_ia"] else ""))
        for e in i["evidencia"]:
            senales = ", ".join(f"{s['senal']} ({s['origen']})" for s in e["senales"]
                                if s["origen"] != "formulario" or s["prioridad"] != e["prioridad"])
            print(f"    · {e['reporte_id']} {e['prioridad']} fuente {e['fuente']}, "
                  f"rutas {e['rutas']}: «{e['texto'][:50]}»")
            if senales:
                print(f"      señales: {senales}")
        if i["accion_propuesta"]:
            a = i["accion_propuesta"]
            print(f"    propuesta: {a['entidad']}, {a['accion']}")
            if a["falta_confirmar"]:
                print(f"    falta confirmar: {', '.join(a['falta_confirmar'])}")


def paso(titulo: str, instruccion: str = "") -> None:
    print(f"\n{'=' * 70}\n{titulo}")
    if instruccion:
        print(f"  → {instruccion}")
    if "--seguido" not in sys.argv:
        input("  [Enter para seguir]")


def main() -> None:
    paso("Paso 4 · La central recibe, deduplica y registra")
    lote1 = [
        sard1("demo1", 1, "P1", "ATRAP", 2, "100", "se cayó la casa de la esquina, hay dos personas atrapadas"),
        sard1("demo2", 2, "P3", "ATRAP", 2, "000", "estoy al frente, vi caer la casa de la esquina y hay gente adentro"),
        sard1("demo3", 3, "P4", "OTRO", 0, "000", "dicen que en el barrio de arriba se cayó un puente"),
        "SARD1|demo9-1|P9|ATRAP|x|1|zz|ayer|mensaje roto",
    ]
    nodo, ids1 = subir(lote1, "pasarela-1")
    print("  El mismo reporte llega otra vez por otra pasarela:")
    subir(lote1[:1], "pasarela-2")

    paso("Paso 5 · Triaje (reglas + Jev) y correlación en incidentes")
    mostrar(esperar_incidentes(nodo, ids1))

    paso("Paso 7 · Caída de la central A",
         "Apaga la central A (Ctrl+C en su terminal) y presiona Enter.")
    lote2 = [sard1("demo4", 4, "P3", "MEDIC", 1, "000",
                   "un señor se cortó la pierna con un vidrio y está perdiendo mucha sangre")]
    nodo2, ids2 = subir(lote2, "pasarela-1")
    if nodo2 == "A":
        print("  (la A sigue respondiendo: apágala para ver el relevo)")
    mostrar(esperar_incidentes(nodo2, ids2))

    paso("Paso 8 · Recuperación",
         "Levanta otra vez la central A (iniciar.py A) y presiona Enter.")
    todos = ids1 | ids2
    for _ in range(30):
        if viva("A") and viva("B"):
            break
        time.sleep(1)
    vistas = {}
    for n in ("A", "B"):
        if viva(n):
            incs = esperar_incidentes(n, todos, limite_s=20)
            vistas[n] = {i["id"]: (i["prioridad"], sorted(i["reportes"]), i["estado"]) for i in incs}
            print(f"  central {n}: {len(vistas[n])} incidente(s) con "
                  f"{sum(len(v[1]) for v in vistas[n].values())} de {len(todos)} reportes")
    if len(vistas) == 2:
        print("  ✔ A y B dan los mismos incidentes" if vistas["A"] == vistas["B"]
              else "  ✘ A y B todavía difieren")
    print("\nNingún reporte se perdió si cada id de arriba tuvo su SACK y aparece en los dos.")


if __name__ == "__main__":
    main()
