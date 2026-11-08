"""Ensayo de la demo bajo condición adversa: caída de la central A en plena carga y Jev caído.

Cubre E5 y E7 de `pruebas/escenarios.md` en la parte de la central. Levanta las centrales A y B
con `iniciar.py` sobre bases nuevas en una carpeta temporal, hace de pasarela (A si responde a
`/salud`, si no B; reenvía cada id hasta recibir su `SACK`), apaga la A a mitad de la carga, la
vuelve a levantar y comprueba:

- ningún reporte se perdió: cada id tuvo `SACK` y aparece en un incidente de A y de B;
- cada id está en un solo incidente (sin duplicados);
- ninguna prioridad quedó por debajo de la del formulario (ADR 0005);
- A y B terminan con los mismos incidentes.

    uv run --env-file ../.env python -m demo.adversa                # Jev caído (clave inválida)
    uv run --env-file ../.env python -m demo.adversa --jev real     # con la clave del .env
    uv run python -m demo.adversa --reportes 60 --semilla 7 --salida resultado.json

Usa los puertos 8001 y 8002: si ya hay una central corriendo, se detiene. Sale con código 1 si
alguna comprobación falla. Los registros de cada central quedan en la carpeta temporal.
"""

import argparse
import json
import os
import random
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import pygeohash

from demo.recorrido import pedir

CENTRAL = Path(__file__).parents[1]
CENTRALES = {"A": "http://127.0.0.1:8001", "B": "http://127.0.0.1:8002"}
ORDEN = ["P1", "P2", "P3", "P4"]
CLAVE_INVALIDA = "clave-invalida-ensayo-adverso"

# (prioridad del formulario, tipo, personas, banderas, texto); datos sintéticos.
PLANTILLAS = [
    ("P1", "ATRAP", 2, "100", "se cayó la casa y hay dos personas atrapadas bajo el techo"),
    ("P1", "MEDIC", 1, "010", "mi papá no respira, está tirado en el piso"),
    ("P1", "FUEGO", 3, "001", "sale humo del segundo piso y adentro hay niños"),
    ("P2", "MEDIC", 1, "010", "una señora se fracturó el brazo al salir corriendo"),
    ("P2", "ATRAP", 1, "000", "creo que el vecino quedó encerrado en el ascensor"),
    ("P3", "VIA", 0, "000", "la vía al hospital está bloqueada por un derrumbe"),
    ("P3", "MEDIC", 1, "000", "un señor se cortó la pierna con un vidrio y sangra mucho"),
    ("P3", "DESAP", 1, "001", "no encontramos a mi abuela desde el temblor"),
    ("P4", "OTRO", 0, "000", "dicen que en el barrio de arriba se cayó un puente"),
    ("P4", "VIA", 0, "000", "hay piedras en la carretera pero se puede pasar"),
]


def viva(nodo: str) -> bool:
    try:
        return pedir(f"{CENTRALES[nodo]}/salud", timeout=1.0)["estado"] == "ok"
    except (OSError, ValueError):
        return False


def levantar(nodo: str, carpeta: Path, jev: str) -> subprocess.Popen:
    env = {**os.environ, "PYTHONUTF8": "1", "SARD_DB": str(carpeta / f"central-{nodo}.sqlite"),
           "CENTRAL_A_URL": CENTRALES["A"], "CENTRAL_B_URL": CENTRALES["B"]}
    if jev == "caido":
        env["JEV_API_KEY"] = CLAVE_INVALIDA
    grupo = ({"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == "nt"
             else {"start_new_session": True})
    log = open(carpeta / f"central-{nodo}.log", "a", encoding="utf-8")
    p = subprocess.Popen([sys.executable, "iniciar.py", nodo], cwd=CENTRAL, env=env,
                         stdout=log, stderr=subprocess.STDOUT, **grupo)
    esperar(lambda: viva(nodo), 30, f"la central {nodo} no arrancó (ver {log.name})")
    return p


def apagar(p: subprocess.Popen) -> None:
    """Como Ctrl+C en la terminal de la central: cae la API y sus cuatro agentes."""
    if p.poll() is not None:
        return
    if os.name == "nt":
        p.send_signal(signal.CTRL_BREAK_EVENT)
    else:
        os.killpg(p.pid, signal.SIGINT)
    try:
        p.wait(timeout=15)
    except subprocess.TimeoutExpired:
        p.kill()


def esperar(condicion, limite_s: float, error: str) -> None:
    fin = time.monotonic() + limite_s
    while not condicion():
        if time.monotonic() > fin:
            raise SystemExit(error)
        time.sleep(0.5)


def generar(n: int, semilla: int) -> dict[str, tuple[str, str]]:
    """id -> (mensaje SARD1, prioridad del formulario)."""
    azar = random.Random(semilla)
    base = int(time.time())
    reportes = {}
    for i in range(n):
        p, tipo, personas, banderas, texto = azar.choice(PLANTILLAS)
        lat, lon = 5.0689 + azar.uniform(-0.01, 0.01), -75.5174 + azar.uniform(-0.01, 0.01)
        rid = f"adv{i % 5}-{base + i}"
        msg = (f"SARD1|{rid}|{p}|{tipo}|{personas}|{banderas}|"
               f"{pygeohash.encode(lat, lon, 6)}|{base + i}|{texto}")
        reportes[rid] = (msg, p)
    return reportes


def central_activa() -> str | None:
    return next((n for n in ("A", "B") if viva(n)), None)


def enviar(pendientes: dict[str, str], acuse: dict[str, str]) -> None:
    """Una vuelta de la pasarela: manda lo pendiente y anota quién dio SACK."""
    nodo = central_activa()
    if not nodo or not pendientes:
        return
    try:
        r = pedir(f"{CENTRALES[nodo]}/reportes",
                  {"mensajes": list(pendientes.values()), "pasarela_id": "pasarela-ensayo"})
    except (OSError, ValueError):
        return  # la central cayó en medio del envío: se reintenta en la próxima vuelta
    for s in r["sack"]:
        rid = s.split("|")[1]
        acuse.setdefault(rid, nodo)
        pendientes.pop(rid, None)


def estado(nodo: str) -> dict[str, list[dict]]:
    """id de reporte -> evidencias en que aparece, con el incidente al que pertenece."""
    por_id: dict[str, list[dict]] = {}
    for inc in pedir(f"{CENTRALES[nodo]}/incidentes"):
        for e in inc["evidencia"]:
            por_id.setdefault(e["reporte_id"], []).append({**e, "incidente": inc["id"]})
    return por_id


def foto(nodo: str) -> dict[str, tuple]:
    return {i["id"]: (i["prioridad"], sorted(i["reportes"]), i["estado"])
            for i in pedir(f"{CENTRALES[nodo]}/incidentes")}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--reportes", type=int, default=40)
    ap.add_argument("--semilla", type=int, default=1)
    ap.add_argument("--cortar", type=float, default=0.5, help="fracción enviada antes de apagar la A")
    ap.add_argument("--jev", choices=["caido", "real"], default="caido")
    ap.add_argument("--espera", type=float, default=120, help="segundos para que A y B converjan")
    ap.add_argument("--salida", type=Path, help="JSON con parámetros y métricas")
    args = ap.parse_args()

    if args.jev == "real" and not os.environ.get("JEV_API_KEY"):
        raise SystemExit("--jev real necesita JEV_API_KEY (usar --env-file ../.env)")
    if viva("A") or viva("B"):
        raise SystemExit("Ya hay una central en 8001 u 8002; apágala antes del ensayo")

    carpeta = Path(tempfile.mkdtemp(prefix="sard-adversa-"))
    reportes = generar(args.reportes, args.semilla)
    print(f"Ensayo adverso: {args.reportes} reportes, semilla {args.semilla}, Jev {args.jev}")
    print(f"  bases y registros en {carpeta}")

    procesos = {n: levantar(n, carpeta, args.jev) for n in ("A", "B")}
    try:
        acuse: dict[str, str] = {}
        pendientes: dict[str, str] = {}
        corte = int(len(reportes) * args.cortar)
        inicio = time.monotonic()
        for i, (rid, (msg, _)) in enumerate(reportes.items()):
            if i == corte:
                print(f"  {i} reportes enviados: se apaga la central A")
                apagar(procesos["A"])
            pendientes[rid] = msg
            if i % 2:  # la pasarela sube de a dos
                enviar(pendientes, acuse)
                time.sleep(0.2)
        espera = 0.5
        while pendientes and time.monotonic() - inicio < args.espera:
            enviar(pendientes, acuse)
            time.sleep(espera)
            espera = min(espera * 2, 4)  # reintentos con espera creciente
        print(f"  {len(acuse)} SACK ({sum(n == 'A' for n in acuse.values())} de A, "
              f"{sum(n == 'B' for n in acuse.values())} de B); se levanta otra vez la A")

        procesos["A"] = levantar("A", carpeta, args.jev)
        todos = set(reportes)

        def convergieron() -> bool:
            try:
                return todos <= set(estado("A")) and todos <= set(estado("B")) \
                    and foto("A") == foto("B")
            except (OSError, ValueError):
                return False

        t0 = time.monotonic()
        while not convergieron() and time.monotonic() - t0 < args.espera:
            time.sleep(1)
        convergencia_s = round(time.monotonic() - t0, 1)

        vistas = {n: estado(n) for n in ("A", "B")}
        bajados = sorted(rid for rid, (_, p) in reportes.items()
                         for e in vistas["A"].get(rid, [])
                         if ORDEN.index(e["prioridad"]) > ORDEN.index(p))
        metricas = {
            "reportes": len(reportes),
            "sack": len(acuse),
            "sack_de_b": sum(n == "B" for n in acuse.values()),
            "perdidos": sorted(todos - set(acuse)),
            "faltan_en_a": sorted(todos - set(vistas["A"])),
            "faltan_en_b": sorted(todos - set(vistas["B"])),
            "en_varios_incidentes": sorted(r for v in vistas.values() for r, es in v.items()
                                           if len({e["incidente"] for e in es}) > 1),
            "prioridad_bajada": bajados,
            "subidos_por_triaje": sum(1 for rid, (_, p) in reportes.items()
                                      for e in vistas["A"].get(rid, [])
                                      if ORDEN.index(e["prioridad"]) < ORDEN.index(p)),
            "a_igual_b": foto("A") == foto("B"),
            "convergencia_s": convergencia_s,
            "jev_segun_salud": pedir(f"{CENTRALES['A']}/salud")["jev"],
        }
    finally:
        for p in procesos.values():
            apagar(p)

    fallas = [k for k in ("perdidos", "faltan_en_a", "faltan_en_b", "en_varios_incidentes",
                          "prioridad_bajada") if metricas[k]]
    if not metricas["a_igual_b"]:
        fallas.append("a_igual_b")
    if args.jev == "caido" and metricas["jev_segun_salud"] != "caido":
        fallas.append("jev_segun_salud")

    print()
    for k, v in metricas.items():
        marca = "✘" if k in fallas else " "
        print(f"  {marca} {k}: {v}")
    print("\n✔ Ninguna comprobación falló" if not fallas else f"\n✘ Fallaron: {', '.join(fallas)}")

    if args.salida:
        args.salida.write_text(json.dumps(
            {"parametros": {k: (str(v) if isinstance(v, Path) else v) for k, v in vars(args).items()},
             "metricas": metricas, "fallas": fallas}, ensure_ascii=False, indent=2),
            encoding="utf-8")
    sys.exit(1 if fallas else 0)


if __name__ == "__main__":
    main()
