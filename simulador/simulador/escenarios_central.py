"""Escenarios contra la central real: E4 (duplicados en la central), E5 (caída de la central A
durante la carga), E6/E7 (triaje con los 100 reportes etiquetados; sin Jev, E6 es E7).

Levanta las centrales A y B de `central/` con bases nuevas en una carpeta temporal, corre y las
apaga. No toca código de la central: solo la usa por su API (`contracts/api-central.md`).

    PYTHONUTF8=1 uv run python -m simulador escenarios-central              # E4c, E5, E6/E7
    PYTHONUTF8=1 uv run python -m simulador escenarios-central --env-file ../.env   # con JEV_API_KEY

Los puertos 8001 y 8002 deben estar libres.
"""

import json
import os
import random
import shutil
import subprocess
import tempfile
import time
import urllib.request
from dataclasses import asdict, replace
from pathlib import Path

from .centrales import CentralHttp
from .generador import cargar
from .geo import a_latlon, geohash
from .malla import Parametros, Simulacion
from .metricas import RESULTADOS, calcular
from .sard1 import Reporte

CENTRAL = Path(__file__).parents[2] / "central"
URLS = {"A": "http://127.0.0.1:8001", "B": "http://127.0.0.1:8002"}
ORDEN = {"P1": 1, "P2": 2, "P3": 3, "P4": 4}


# --- centrales ---

def _leer_env(ruta: str | None) -> dict:
    if not ruta or not Path(ruta).exists():
        return {}
    pares = (l.split("=", 1) for l in Path(ruta).read_text(encoding="utf-8").splitlines()
             if "=" in l and not l.lstrip().startswith("#"))
    return {k.strip(): v.strip() for k, v in pares if v.strip()}


class Centrales:
    """Las dos centrales completas (API + agentes), cada una con su base en una carpeta temporal."""

    def __init__(self, env_extra: dict):
        self.dir = Path(tempfile.mkdtemp(prefix="sard-pruebas-"))
        self.env_extra = env_extra
        self.procesos: dict[str, subprocess.Popen] = {}

    def levantar(self, nodo: str) -> None:
        env = {**os.environ, **self.env_extra, "PYTHONUTF8": "1",
               "SARD_DB": str(self.dir / f"central-{nodo}.sqlite"),
               "CENTRAL_A_URL": URLS["A"], "CENTRAL_B_URL": URLS["B"]}
        extra = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == "nt" else {"start_new_session": True}
        self.procesos[nodo] = subprocess.Popen(
            ["uv", "run", "--project", str(CENTRAL), "python", "iniciar.py", nodo], cwd=CENTRAL, env=env,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, **extra)
        for _ in range(60):
            if pedir(f"{URLS[nodo]}/salud"):
                return
            time.sleep(0.5)
        raise RuntimeError(f"La central {nodo} no respondió a /salud")

    def apagar(self, nodo: str) -> None:
        """Mata la central entera (API y agentes), como un corte de luz."""
        p = self.procesos.pop(nodo, None)
        if not p:
            return
        if os.name == "nt":
            subprocess.run(["taskkill", "/PID", str(p.pid), "/T", "/F"], capture_output=True)
        else:
            os.killpg(p.pid, 9)
        p.wait()

    def cerrar(self) -> None:
        for n in list(self.procesos):
            self.apagar(n)
        shutil.rmtree(self.dir, ignore_errors=True)


def pedir(url: str, datos: dict | None = None, espera: float = 3.0):
    cuerpo = json.dumps(datos).encode() if datos is not None else None
    req = urllib.request.Request(url, data=cuerpo, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=espera) as r:
            return json.load(r)
    except OSError:
        return None


def recibidos(nodo: str) -> dict[str, int]:
    """Cuántos eventos `reporte_recibido` tiene cada id en una central (debe ser 1)."""
    cuenta, desde = {}, 0
    while True:
        r = pedir(f"{URLS[nodo]}/eventos?desde_seq={desde}&limite=1000")
        if not r or not r["eventos"]:
            return cuenta
        for ev in r["eventos"]:
            if ev["tipo"] == "reporte_recibido":
                cuenta[ev["reporte_id"]] = cuenta.get(ev["reporte_id"], 0) + 1
        desde = r["eventos"][-1]["seq"]  # `ultimo_seq` es el último de toda la base, no de la página


def prioridades_finales(nodo: str, ids: set[str], espera_s: float = 90) -> dict[str, str]:
    """Prioridad final de cada reporte según la evidencia de `GET /incidentes`, cuando ya están todos."""
    limite = time.time() + espera_s
    finales: dict[str, str] = {}
    while time.time() < limite:
        incs = pedir(f"{URLS[nodo]}/incidentes", espera=10) or []
        finales = {e["reporte_id"]: e["prioridad"] for i in incs for e in i["evidencia"] if e["reporte_id"] in ids}
        if len(finales) == len(ids):
            break
        time.sleep(2)
    return finales


# --- escenarios ---

def e4_central(centrales: Centrales) -> dict:
    """El mismo lote llega por 3 pasarelas a la A y una parte también a la B."""
    filas = cargar()
    rng = random.Random(4)
    hora = int(time.time())
    lineas = [Reporte(f"e4d-{i}", f["prioridad_real"], f["tipo_real"], 1, f["atrapados"] == "1",
                      f["heridos"] == "1", False, "d2fkcd", hora, f["texto"]).linea()
              for i, f in enumerate(rng.sample(filas, 20), start=1)]
    sacks = 0
    for pasarela in ("pasarela-1", "pasarela-2", "pasarela-3"):
        r = pedir(f"{URLS['A']}/reportes", {"mensajes": lineas, "pasarela_id": pasarela}) or {"sack": []}
        sacks += len(r["sack"])
    r = pedir(f"{URLS['B']}/reportes", {"mensajes": lineas[:10], "pasarela_id": "pasarela-4"}) or {"sack": []}
    sacks += len(r["sack"])
    time.sleep(4)  # sincronización A ↔ B
    en_a, en_b = recibidos("A"), recibidos("B")
    ids = [l.split("|")[1] for l in lineas]
    return {
        "reportes_distintos": len(ids), "envios": 3 * len(ids) + 10, "sack_recibidos": sacks,
        "reporte_recibido_por_id_en_A": sorted({en_a.get(i, 0) for i in ids}),
        "reporte_recibido_por_id_en_B": sorted({en_b.get(i, 0) for i in ids}),
        "cumple": all(en_a.get(i) == 1 and en_b.get(i) == 1 for i in ids) and sacks == 3 * len(ids) + 10,
    }


def e5(centrales: Centrales, apagar_en: int = 120) -> dict:
    """La malla sube a la A; en el segundo `apagar_en` se apaga la A entera con reportes en vuelo."""
    p = replace(Parametros(), semilla=5, reportes=60, ventana_s=300, duracion_s=1200,
                prefijo=f"e5{int(time.time()) % 10000}n", hora_base=int(time.time()))
    central = CentralHttp(URLS, espera_s=1.0)
    estado = {"apagada_en": None}

    def al_paso(t: int) -> None:
        if t == apagar_en:
            centrales.apagar("A")
            estado["apagada_en"] = t

    sim = Simulacion(p, central, al_paso=al_paso).correr()
    m = calcular(sim)
    confirmados = {s.id for s in sim.seguimiento.values() if s.llegada is not None}
    ausentes_con_a_caida = sorted(confirmados - set(recibidos("B")))
    # La A vuelve con su misma base: lo que confirmó antes de caer y la B no alcanzó a copiar
    # debería llegar a la B por la sincronización.
    centrales.levantar("A")
    time.sleep(5)
    ausentes_tras_volver = sorted(confirmados - set(recibidos("B")))
    creados_antes = sum(s.creado < apagar_en for s in sim.seguimiento.values())
    return {
        "parametros": asdict(p), "apagada_A_en_s": estado["apagada_en"],
        "creados": m["creados"], "creados_antes_del_apagon": creados_antes,
        "entregados": m["entregados_central"], "tasa_entrega": m["tasa_entrega"],
        "confirmados_reportante": m["confirmados_reportante"],
        "subidas_por_central": central.usadas, "subidas_fallidas": m["subidas_fallidas"],
        "con_sack_pero_ausentes_en_B_con_A_caida": ausentes_con_a_caida,
        "con_sack_pero_ausentes_en_B_tras_volver_A": ausentes_tras_volver,
        "perdidos": m["creados"] - m["entregados_central"] + len(ausentes_tras_volver),
        "latencia_por_prioridad": m["latencia_por_prioridad"],
        "cumple": m["tasa_entrega"] == 1.0 and not ausentes_tras_volver and "B" in central.usadas,
    }


def e6_e7(centrales: Centrales) -> dict:
    """Los 100 reportes etiquetados, dos veces: con formulario neutro (P4, solo las banderas) para
    medir lo que hace la central, y con la prioridad del celular igual a la etiqueta para comprobar
    que la central nunca la baja."""
    filas = cargar()
    rng = random.Random(6)
    hora = int(time.time())
    salud = pedir(f"{URLS['A']}/salud") or {}
    modos = {}
    for modo, disp in (("formulario_neutro", "e6n"), ("prioridad_del_celular", "e6c")):
        enviados = {}
        lineas = []
        for i, f in enumerate(filas, start=1):
            prio = "P4" if modo == "formulario_neutro" else f["prioridad_real"]
            gh = geohash(*a_latlon(rng.uniform(0, 3000), rng.uniform(-1500, 1500)))
            r = Reporte(f"{disp}-{i}", prio, f["tipo_real"], 1, f["atrapados"] == "1", f["heridos"] == "1",
                        False, gh, hora + i, f["texto"])
            enviados[r.id] = (f, prio)
            lineas.append(r.linea())
        t0 = time.time()
        pedir(f"{URLS['A']}/reportes", {"mensajes": lineas, "pasarela_id": "pruebas-e6"}, espera=30)
        finales = prioridades_finales("A", set(enviados))
        segundos = round(time.time() - t0, 1)
        sub, sobre, bajados, p1_sub = [], [], [], []
        for id_, (f, prio) in enviados.items():
            final = finales.get(id_)
            if final is None:
                continue
            real = f["prioridad_real"]
            if ORDEN[final] > ORDEN[real]:
                sub.append(id_)
                if real == "P1":
                    p1_sub.append(f"{id_}: «{f['texto']}» → {final}")
            elif ORDEN[final] < ORDEN[real]:
                sobre.append(id_)
            if ORDEN[final] > ORDEN[prio]:
                bajados.append(id_)
        n = len(enviados)
        p1 = sum(f["prioridad_real"] == "P1" for f, _ in enviados.values())
        modos[modo] = {
            "enviados": n, "priorizados": len(finales), "disponibilidad": round(len(finales) / n, 4),
            "segundos_hasta_priorizar_todos": segundos,
            "exactas": n - len(sub) - len(sobre) - (n - len(finales)), "subtriaje": len(sub), "sobretriaje": len(sobre),
            "recall_p1": round((p1 - len(p1_sub)) / p1, 4), "p1_subestimados": p1_sub,
            "bajados_respecto_al_celular": bajados,
        }
    return {"jev": salud.get("jev"), "modos": modos,
            "cumple": modos["prioridad_del_celular"]["bajados_respecto_al_celular"] == []
            and all(m["disponibilidad"] == 1.0 for m in modos.values())}


# --- informe ---

def _guardar(clave: str, datos: dict, texto: str) -> None:
    destino = RESULTADOS / clave
    destino.mkdir(parents=True, exist_ok=True)
    (destino / "central.json").write_text(json.dumps(datos, indent=1, ensure_ascii=False) + "\n",
                                          encoding="utf-8", newline="\n")
    (destino / "resumen-central.md").write_text(texto, encoding="utf-8", newline="\n")
    print(texto)


def _si(x: bool) -> str:
    return "sí" if x else "**no**"


def informe_e4(d: dict) -> str:
    return "\n".join([
        "# E4 · Duplicados en la central real", "",
        f"{d['reportes_distintos']} reportes enviados {d['envios']} veces: el lote completo por 3 pasarelas a la "
        "central A y la mitad también directo a la B.", "",
        "| Métrica | Valor |", "|---|---|",
        f"| `SACK` recibidos | {d['sack_recibidos']} de {d['envios']} envíos |",
        f"| `reporte_recibido` por id en la A | {d['reporte_recibido_por_id_en_A']} |",
        f"| `reporte_recibido` por id en la B (tras sincronizar) | {d['reporte_recibido_por_id_en_B']} |",
        f"| Cumple «exactamente 1 por id» | {_si(d['cumple'])} |", ""])


def informe_e5(d: dict) -> str:
    l = ["# E5 · Caída de la central A durante la carga", "",
         f"Malla base (semilla {d['parametros']['semilla']}, {d['parametros']['nodos']} celulares, pérdida "
         f"{d['parametros']['perdida']:.0%}) subiendo a la API real. La central A completa (API y agentes) se "
         f"apaga en el segundo {d['apagada_A_en_s']}, con {d['creados_antes_del_apagon']} de {d['creados']} "
         "reportes ya creados y el resto todavía por crearse.", "",
         "| Métrica | Valor |", "|---|---|",
         f"| Entregados | {d['entregados']} de {d['creados']} ({d['tasa_entrega']:.0%}) |",
         f"| Perdidos | {d['perdidos']} |",
         f"| Confirmados al reportante | {d['confirmados_reportante']} |",
         f"| Subidas por central | {d['subidas_por_central']} |",
         f"| Subidas que fallaron y se reintentaron | {d['subidas_fallidas']} |",
         f"| Con `SACK` de la A pero ausentes en la B mientras la A está caída | "
         f"{len(d['con_sack_pero_ausentes_en_B_con_A_caida'])} {d['con_sack_pero_ausentes_en_B_con_A_caida'] or ''} |",
         f"| Ausentes en la B después de que la A vuelve | {len(d['con_sack_pero_ausentes_en_B_tras_volver_A'])} |",
         f"| Cumple «0 perdidos; la pasarela pasa a B» | {_si(d['cumple'])} |", "",
         "Los reportes que la A confirmó justo antes de caer y la B no alcanzó a copiar (sincroniza cada "
         "segundo) no se pierden: quedan en la base de la A y la B los recibe cuando la A vuelve. Mientras "
         "la A está caída, el coordinador no los ve en la B y el celular ya no reintenta, porque recibió `SACK`.",
         "",
         "| Prioridad | Entregados | Latencia p50 (s) | p95 (s) | Máx (s) |", "|---|---|---|---|---|"]
    for p, x in d["latencia_por_prioridad"].items():
        l.append(f"| {p} | {x['entregados']}/{x['creados']} | {x['p50_s']} | {x['p95_s']} | {x['max_s']} |")
    return "\n".join(l) + "\n"


def informe_e6(d: dict) -> str:
    sin_jev = d["jev"] != "ok"
    titulo = "E7 · Triaje con Jev caído (solo reglas)" if sin_jev else "E6 · Triaje con reglas y Jev"
    l = [f"# {titulo}", "",
         f"Los 100 reportes etiquetados (`datos/sinteticos/`) contra la central A real. Jev: `{d['jev']}`."
         + (" Sin `JEV_API_KEY` esta corrida es E7; E6 con Jev se corre con `--env-file ../.env`." if sin_jev else ""),
         "", "- **Formulario neutro**: el celular manda P4 y solo las banderas; mide lo que agrega la central.",
         "- **Prioridad del celular**: el celular manda la prioridad etiquetada; comprueba que la central nunca la baja.",
         "", "| Métrica | Formulario neutro | Prioridad del celular |", "|---|---|---|"]
    a, b = d["modos"]["formulario_neutro"], d["modos"]["prioridad_del_celular"]
    for nombre, k in (("Priorizados (disponibilidad)", "disponibilidad"), ("Exactas", "exactas"),
                      ("Subtriaje (debajo de la real)", "subtriaje"), ("Sobretriaje (encima)", "sobretriaje"),
                      ("Recall de P1", "recall_p1"), ("Segundos hasta priorizar los 100", "segundos_hasta_priorizar_todos")):
        fmt = (lambda x: f"{x:.0%}") if k in ("disponibilidad", "recall_p1") else str
        l.append(f"| {nombre} | {fmt(a[k])} | {fmt(b[k])} |")
    l.append(f"| Bajados respecto al celular | — | {len(b['bajados_respecto_al_celular'])} |")
    l += ["", f"Cumple «el triaje sigue funcionando» y «cero P1 bajados»: {_si(d['cumple'])}.", "",
          f"P1 que el formulario neutro deja por debajo ({len(a['p1_subestimados'])}): son los que solo Jev o "
          "un humano pueden rescatar.", ""]
    l += [f"- {x}" for x in a["p1_subestimados"]]
    return "\n".join(l) + "\n"


def correr(env_file: str | None = None) -> None:
    """E4 y E6/E7 primero; E5 al final porque apaga la central A."""
    centrales = Centrales(_leer_env(env_file))
    try:
        centrales.levantar("A")
        centrales.levantar("B")
        d = e4_central(centrales)
        _guardar("E4", d, informe_e4(d))
        d = e6_e7(centrales)
        _guardar("E7" if d["jev"] != "ok" else "E6", d, informe_e6(d))
        d = e5(centrales)
        _guardar("E5", d, informe_e5(d))
    finally:
        centrales.cerrar()
