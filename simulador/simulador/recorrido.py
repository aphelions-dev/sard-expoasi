"""Recorrido de 8 pasos de la demo (`docs/pitch/guion-demo.md`) con el simulador como malla.

Es el plan B de los pasos 1 a 3 mientras no haya celulares (la app es de P1): los celulares y la
malla son simulados; las centrales A y B, los agentes y el tablero son los reales.

    cd tablero && npm run dev                         # el tablero, en otra terminal (paso 6)
    cd simulador && PYTHONUTF8=1 uv run python -m simulador recorrido
    # visor de la malla: http://localhost:8090 · avanzar: Enter aquí o "Siguiente paso" en el visor
    # --seguido: avanza solo (para ensayar o grabar el video) · --env-file ../.env: con Jev

El script levanta A y B con bases nuevas, declara recursos, corre la malla en tiempo real y en el
paso 7 apaga la central A entera con reportes en vuelo. Los puertos 8001, 8002 y 8090 deben estar
libres.
"""

import json
import random
import sys
import threading
import time
import unicodedata
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from .centrales import CentralHttp
from .escenarios_central import URLS, Centrales, _leer_env, pedir
from .generador import cargar
from .geo import a_latlon
from .malla import Parametros, Simulacion

RAIZ = Path(__file__).parents[2]
VISOR = Path(__file__).parents[1] / "visor"
BARRIOS = RAIZ / "tablero" / "public" / "geo" / "barrios.geojson"
PALABRAS = RAIZ / "contracts" / "palabras-criticas.txt"
PUERTO = 8090

PASOS = {
    1: ("Reporte", "Sin internet, una persona llena el formulario. El celular calcula la prioridad con las "
                   "reglas (palabras críticas del contrato) y arma un mensaje SARD1 de pocos bytes."),
    2: ("Almacenamiento", "El reporte queda guardado en el celular como «pendiente», en una cola que reenvía "
                          "P1/P2 primero sin descartar P3/P4."),
    3: ("Transmisión", "Salta de celular en celular por Bluetooth hasta la pasarela, con pérdidas y reintentos "
                       "con espera creciente. Otros vecinos reportan lo mismo."),
    4: ("Agentes", "La pasarela sube a la central A: recepción valida, acepta cada id una sola vez y responde "
                   "SACK, que vuelve por la malla."),
    5: ("Priorización", "Triaje (reglas + Jev) y correlación: los reportes del mismo suceso quedan en un "
                        "incidente con evidencia, incertidumbre y una acción propuesta."),
    6: ("Tablero", "El coordinador ve el incidente en el tablero, revisa por qué está arriba y aprueba la "
                   "acción. Nada se ejecuta sin esa aprobación."),
    7: ("Caída de nodo", "Llega una ráfaga de reportes y, en plena carga, se apaga la central A completa "
                         "(API y agentes)."),
    8: ("Recuperación", "La pasarela pasa sola a la central B, que ya tenía todo sincronizado. Ningún reporte "
                        "se pierde y cada reportante ve «entregado». Al volver la A, las dos coinciden."),
}

DESTACADO = {"texto": "se cayó el edificio de la calle 23, hay tres personas atrapadas en el segundo piso",
             "tipo_real": "ATRAP", "prioridad_real": "P1", "atrapados": "1", "heridos": "0"}
VECINOS = [
    {"texto": "edificio de la calle 23 en el suelo, se oyen gritos adentro", "tipo_real": "ATRAP",
     "prioridad_real": "P2", "atrapados": "0", "heridos": "1"},
    {"texto": "dicen que el edificio de la 23 se cayó y hay gente adentro", "tipo_real": "ATRAP",
     "prioridad_real": "P3", "atrapados": "0", "heridos": "0"},
]


def _normal(t: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", t.lower()) if not unicodedata.combining(c))


def palabras_criticas(texto: str) -> list[str]:
    """Las del contrato que aparecen en el texto (así lo hace la app, P1)."""
    lineas = PALABRAS.read_text(encoding="utf-8").splitlines()
    return [l.strip() for l in lineas if l.strip() and not l.startswith("#") and _normal(l.strip()) in _normal(texto)]


class Estado:
    """Lo que el visor lee en /estado. La traza la escribe el hilo de la simulación (solo agrega)."""

    def __init__(self, sim: Simulacion):
        self.sim = sim
        self.paso, self.titulo, self.detalle = 0, "Preparando", ["Levantando las centrales A y B…"]
        self.centrales = {"A": "arriba", "B": "arriba"}
        self.destacado: str | None = None
        self.siguiente = threading.Event()
        self.lock = threading.Lock()

    def poner(self, paso: int, *detalle: str) -> None:
        with self.lock:
            self.paso, self.titulo = paso, PASOS[paso][0] if paso in PASOS else "Fin"
            self.detalle = [PASOS[paso][1], *detalle] if paso in PASOS else list(detalle)
        print(f"\n{'=' * 70}\nPaso {paso} · {self.titulo}" if paso in PASOS else "\nFin")
        for d in self.detalle:
            print(f"  {d}")

    def agregar(self, *detalle: str) -> None:
        with self.lock:
            self.detalle += detalle
        for d in detalle:
            print(f"  {d}")

    def json(self, desde: int) -> dict:
        sim = self.sim
        segs = list(sim.seguimiento.values())  # la escribe otro hilo: copia atómica
        with self.lock:
            return {
                "paso": self.paso, "titulo": self.titulo, "detalle": self.detalle, "centrales": self.centrales,
                "destacado": self.destacado, "t": sim.t,
                "nodos": [{"id": n.id, "lat": la, "lon": lo, "pasarela": n.pasarela, "vivo": n.vivo}
                          for n in sim.nodos for la, lo in [a_latlon(n.x, n.y)]],
                "vecinos": sorted({tuple(sorted((a, b.id))) for a, vs in sim.vecinos.items() for b in vs}),
                "eventos": sim.traza[desde:], "n": len(sim.traza),
                "cuentas": {"creados": len(sim.seguimiento),
                            "en_central": sum(s.llegada is not None for s in segs),
                            "entregados": sum(s.confirmado is not None for s in segs)},
            }


def servidor(estado: Estado) -> ThreadingHTTPServer:
    tipos = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".geojson": "application/json"}

    class Manejador(BaseHTTPRequestHandler):
        def _enviar(self, cuerpo: bytes, tipo: str, codigo: int = 200) -> None:
            self.send_response(codigo)
            self.send_header("Content-Type", f"{tipo}; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(cuerpo)

        def do_GET(self):
            u = urlparse(self.path)
            if u.path == "/estado":
                desde = int(parse_qs(u.query).get("desde", ["0"])[0])
                return self._enviar(json.dumps(estado.json(desde), ensure_ascii=False).encode(), "application/json")
            archivo = BARRIOS if u.path == "/barrios.geojson" else VISOR / (u.path.strip("/") or "index.html")
            if archivo.resolve().parent not in (VISOR.resolve(), BARRIOS.parent.resolve()) or not archivo.is_file():
                return self._enviar(b"no encontrado", "text/plain", 404)
            self._enviar(archivo.read_bytes(), tipos.get(archivo.suffix, "application/octet-stream"))

        def do_POST(self):
            if urlparse(self.path).path == "/siguiente":
                estado.siguiente.set()
                return self._enviar(b"{}", "application/json")
            self._enviar(b"no encontrado", "text/plain", 404)

        def log_message(self, *a):  # sin ruido en la terminal de la demo
            pass

    s = ThreadingHTTPServer(("localhost", PUERTO), Manejador)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s


def mas_lejano(sim: Simulacion) -> str:
    """El celular con más saltos hasta la pasarela: el recorrido más largo y visible."""
    dist = {n.id: 0 for n in sim.nodos if n.pasarela}
    frente = list(dist)
    while frente:
        nuevos = []
        for a in frente:
            for v in sim.vecinos[a]:
                if v.id not in dist:
                    dist[v.id] = dist[a] + 1
                    nuevos.append(v.id)
        frente = nuevos
    return max(dist, key=dist.get)


def incidente_de(nodo: str, id_: str) -> dict | None:
    for i in pedir(f"{URLS[nodo]}/incidentes", espera=10) or []:
        if id_ in i["reportes"]:
            return i
    return None


def main(seguido: bool = False, env_file: str | None = None, pausa_s: float = 8.0) -> None:
    centrales = Centrales(_leer_env(env_file))
    p = Parametros(semilla=3, reportes=0, duracion_s=10**6, velocidad=2, bateria_min=15, bateria_max=20,
                   prefijo=f"d{int(time.time()) % 10000}n", hora_base=int(time.time()))
    central = CentralHttp(URLS, espera_s=1.0)
    sim = Simulacion(p, central)
    sim.traza, sim.continuo = [], True
    estado = Estado(sim)
    corriendo = threading.Event()  # pausa la malla entre los pasos 1 y 2
    pedidos: list = []             # lo que el hilo principal le pide a la simulación, en su hilo

    def al_paso(t: int) -> None:
        corriendo.wait()
        while pedidos:
            pedidos.pop(0)()
        sim.p.hora_base = int(time.time()) - t  # hora_unix real en cada reporte nuevo

    sim.al_paso = al_paso
    srv = servidor(estado)

    def esperar(condicion=lambda: True, limite_s: float = 120) -> None:
        """Hasta que se cumpla la condición y el presentador avance (o pase la pausa en --seguido)."""
        fin = time.time() + limite_s
        while not condicion() and time.time() < fin:
            time.sleep(0.5)
        if seguido:
            time.sleep(pausa_s)
        else:
            estado.siguiente.clear()
            print("  [Enter o «Siguiente paso» en el visor]")
            estado.siguiente.wait()
        estado.siguiente.clear()

    if not seguido:
        def leer_teclado():
            for _ in sys.stdin:
                estado.siguiente.set()
        threading.Thread(target=leer_teclado, daemon=True).start()

    hilo = threading.Thread(target=sim.correr, daemon=True)
    try:
        print(f"Visor de la malla: http://localhost:{PUERTO}  ·  Tablero: http://localhost:5173")
        webbrowser.open(f"http://localhost:{PUERTO}")
        centrales.levantar("A")
        centrales.levantar("B")
        for entidad, recurso, n in [("Bomberos", "equipo de rescate", 1), ("Bomberos", "máquina de bomberos", 1),
                                    ("Cruz Roja", "ambulancia", 2)]:
            pedir(f"{URLS['A']}/recursos", {"entidad": entidad, "recurso": recurso, "disponibles": n,
                                            "coordinador": "sala de crisis"})
        hilo.start()

        # 1 · Reporte
        reportante = mas_lejano(sim)
        r = sim.crear(reportante, DESTACADO)  # la malla está en pausa: no hay carrera con su hilo
        estado.destacado = r.id
        criticas = palabras_criticas(r.texto)
        estado.poner(1, f"Celular {reportante} · {r.id}", f"Mensaje ({len(r.linea().encode())} bytes): {r.linea()}",
                     f"Prioridad {r.prioridad} por reglas: palabra crítica «{criticas[0]}» y «atrapados» marcado."
                     if criticas else f"Prioridad {r.prioridad} por reglas.")
        esperar()

        # 2 · Almacenamiento
        estado.poner(2, f"{r.id} guardado en {reportante} como pendiente: 1 de 1 en su cola.")
        esperar()

        # 3 · Transmisión
        rng = random.Random(3)
        cercanos = [v.id for v in sim.vecinos[reportante] if not v.pasarela][:2] or [reportante]
        for nodo, fila in zip(cercanos * 2, VECINOS):
            pedidos.append(lambda nodo=nodo, fila=fila: sim.crear(nodo, fila))
        estado.poner(3, f"Dos vecinos de {reportante} reportan el mismo derrumbe.")
        corriendo.set()
        esperar(lambda: sim.seguimiento[r.id].llegada is not None)
        s = sim.seguimiento[r.id]
        estado.agregar(f"Llegó a la pasarela en {s.llegada - s.creado} s y {s.saltos} saltos.")

        # 4 · Agentes
        estado.poner(4, f"Central {central.ultima} respondió SACK|{r.id}.",
                     "Si el mismo id llega por otra pasarela, recibe SACK otra vez pero no crea otro reporte.")
        esperar(lambda: sim.seguimiento[r.id].confirmado is not None, limite_s=30)
        if sim.seguimiento[r.id].confirmado is not None:
            estado.agregar(f"El SACK volvió hasta {reportante}: el reportante ve «entregado».")

        # 5 · Priorización
        estado.poner(5, "Esperando el incidente con su acción propuesta…")
        inc = None
        fin = time.time() + 60
        while time.time() < fin and not (inc and inc["accion_propuesta"]):
            inc = incidente_de("A", r.id)
            time.sleep(1)
        if inc:
            a = inc["accion_propuesta"] or {}
            estado.agregar(f"Incidente {inc['id']} con {len(inc['reportes'])} reportes: {inc['motivo_orden']}",
                           f"Propuesta: {a.get('accion', 'sin propuesta todavía')}")
        esperar()

        # 6 · Tablero
        estado.poner(6, "Abre http://localhost:5173: el incidente está arriba en la cola. Aprueba la acción.")
        esperar(lambda: (incidente_de("A", r.id) or {}).get("estado") in ("aprobada", "rechazada"), limite_s=600)
        inc = incidente_de("A", r.id) or {}
        if inc.get("decision"):
            d = inc["decision"]
            estado.agregar(f"{'Aprobada' if d['decision'] == 'aprobar' else 'Rechazada'} por {d['coordinador']}.")

        # 7 · Caída de nodo
        filas = cargar()
        libres = [n.id for n in sim.nodos if not n.pasarela and n.vivo]
        rafaga = [(rng.choice(libres), rng.choice(filas)) for _ in range(20)]
        antes = len(sim.seguimiento)
        for i, (nodo, fila) in enumerate(rafaga):
            pedidos.append(lambda nodo=nodo, fila=fila: sim.crear(nodo, fila))
        estado.poner(7, "Ráfaga de 20 reportes desde toda la malla.")
        time.sleep(2)
        for k in (3, 2, 1):
            estado.agregar(f"Apagando la central A en {k}…")
            time.sleep(1)
        en_vuelo = sum(s.llegada is None for s in list(sim.seguimiento.values()))
        centrales.apagar("A")
        with estado.lock:
            estado.centrales["A"] = "caida"
        estado.agregar(f"Central A apagada (API y agentes) con {en_vuelo} reportes todavía en la malla.")
        esperar()

        # 8 · Recuperación
        ids = [x for x in list(sim.seguimiento)[antes:]]
        estado.poner(8, "La pasarela consulta /salud de la A, no responde y sube a la B.")
        esperar(lambda: all(sim.seguimiento[i].confirmado is not None for i in ids), limite_s=90)
        total = len(sim.seguimiento)
        llegaron = sum(s.llegada is not None for s in list(sim.seguimiento.values()))
        confirmados = sum(s.confirmado is not None for s in list(sim.seguimiento.values()))
        subidas = ", ".join(f"{n}: {k}" for n, k in sorted(central.usadas.items()))
        estado.agregar(f"Subidas por central ({subidas}). En la central: {llegaron} de {total}; «entregado» en "
                       f"{confirmados} celulares.", "Vuelve la central A…")
        centrales.levantar("A")
        with estado.lock:
            estado.centrales["A"] = "arriba"
        time.sleep(6)
        conjuntos = {n: sorted((i["id"], tuple(sorted(i["reportes"]))) for i in pedir(f"{URLS[n]}/incidentes", espera=10) or [])
                     for n in ("A", "B")}
        estado.agregar("A y B dan los mismos incidentes." if conjuntos["A"] == conjuntos["B"]
                       else "A y B todavía están sincronizando.")
        esperar()
        estado.poner(9, "Fin del recorrido. Gracias.")
        time.sleep(2 if seguido else 0)
    finally:
        sim.detener = True
        corriendo.set()
        centrales.cerrar()
        srv.shutdown()
