"""Modelo de la malla: celulares quietos con batería, Bluetooth con alcance y pérdida, guardar y
reenviar por prioridad, reintentos con espera creciente y SACK de vuelta hasta el reportante.

Tiempo en pasos de 1 s simulado. Con la misma semilla y los mismos parámetros, el resultado es
idéntico (con la central simulada). Lo que el contrato deja "por definir" (tiempos de espera,
vencimiento, largo del texto) son parámetros: propuesta del simulador, no decisión de la app (P1).
"""

import math
import random
import time
from dataclasses import dataclass, field

from .centrales import CentralSimulada
from .generador import Generador
from .sard1 import Reporte, sack


@dataclass
class Parametros:
    semilla: int = 1
    nodos: int = 30
    pasarelas: int = 1
    lado_m: float = 150.0          # los celulares se reparten en un cuadrado de este lado
    alcance_m: float = 50.0        # alcance Bluetooth LE entre dos celulares
    perdida: float = 0.1           # probabilidad de perder cada mensaje en cada salto
    reportes: int = 40
    ventana_s: int = 600           # los reportes se crean al azar en los primeros N segundos
    duracion_s: int = 1800
    capacidad: int = 4             # mensajes que un celular alcanza a emitir por segundo
    bateria_min: float = 5.0       # % inicial; las bases hablan de menos del 20 %
    bateria_max: float = 20.0
    gasto_reposo: float = 0.002    # % por segundo encendido
    gasto_envio: float = 0.02      # % por mensaje emitido
    espera_base_s: float = 2.0     # espera creciente: 2, 4, 8… s
    espera_tope_s: float = 60.0
    variacion: float = 0.2         # ±20 % al azar para que no reintenten todos a la vez
    vence_s: int | None = None     # por definir (P1): None = nunca vence
    sin_gps: float = 0.1
    hora_base: int = 1786338000    # 10 de agosto de 2026 (el sismo de las bases)
    caida: tuple[int, int] | None = None  # (desde, hasta) s: la central no responde
    velocidad: float = 0.0         # 0 = lo más rápido posible; 1 = tiempo real
    prefijo: str = "n"             # prefijo de los dispositivos en los ids
    por_prioridad: bool = True     # False = en orden de llegada, solo para comparar en E3


@dataclass
class Copia:
    reporte: Reporte
    linea: str
    saltos: int
    intentos: int = 0
    proximo: float = 0.0
    vencido: bool = False


@dataclass
class Nodo:
    id: str
    x: float
    y: float
    bateria: float
    pasarela: bool
    vivo: bool = True
    apagado_en: int | None = None
    cola: dict[str, Copia] = field(default_factory=dict)
    confirmados: set[str] = field(default_factory=set)       # ids con SACK conocido
    sacks_por_avisar: list[str] = field(default_factory=list)


@dataclass
class Seguimiento:
    """Lo que le pasó a un reporte, de punta a punta."""
    id: str
    prioridad: str
    nodo: str
    creado: int
    llegada: int | None = None     # cuando la central dio SACK por primera vez
    saltos: int | None = None
    confirmado: int | None = None  # cuando el SACK volvió al reportante
    vencido: bool = False


class Simulacion:
    def __init__(self, p: Parametros, central=None, filas: list[dict] | None = None, al_paso=None):
        self.p = p
        self.al_paso = al_paso  # función(t) al empezar cada paso: p. ej. apagar la central A en E5
        self.rng = random.Random(p.semilla)
        self.central = central or CentralSimulada()
        self.gen = Generador(self.rng, filas, p.sin_gps)
        self.nodos = [
            Nodo(f"{p.prefijo}{i:02d}", self.rng.uniform(0, p.lado_m), self.rng.uniform(0, p.lado_m),
                 self.rng.uniform(p.bateria_min, p.bateria_max), pasarela=i < p.pasarelas)
            for i in range(p.nodos)
        ]
        self.vecinos = {
            a.id: [b for b in self.nodos if b is not a and math.dist((a.x, a.y), (b.x, b.y)) <= p.alcance_m]
            for a in self.nodos
        }
        self.conectados_inicio = self.conectados_a_pasarela()
        self.agenda = sorted(self.rng.randrange(p.ventana_s) for _ in range(p.reportes))
        self.seguimiento: dict[str, Seguimiento] = {}
        self.emitidos = {"reportes": 0, "sacks": 0, "bytes": 0}
        self.subidas_fallidas = 0
        self.t = 0

    # --- reglas de la malla ---

    def espera(self, intentos: int) -> float:
        base = min(self.p.espera_tope_s, self.p.espera_base_s * 2 ** (intentos - 1))
        return base * (1 + self.rng.uniform(-self.p.variacion, self.p.variacion))

    def _emitir(self, n: Nodo, linea: str) -> list[Nodo]:
        """Un mensaje al aire: lo oyen los vecinos encendidos que no lo pierdan."""
        n.bateria -= self.p.gasto_envio
        self.emitidos["bytes"] += len(linea.encode())
        return [v for v in self.vecinos[n.id] if v.vivo and self.rng.random() >= self.p.perdida]

    def _confirmar(self, n: Nodo, id_: str) -> None:
        if id_ in n.confirmados:
            return
        n.confirmados.add(id_)
        n.sacks_por_avisar.append(id_)
        s = self.seguimiento.get(id_)
        if s and s.nodo == n.id and s.confirmado is None:
            s.confirmado = self.t

    def _recibir(self, v: Nodo, c: Copia) -> None:
        id_ = c.reporte.id
        if id_ in v.confirmados:
            v.sacks_por_avisar.append(id_)  # el que reenvía no sabe del SACK: se le repite
        elif id_ not in v.cola:
            v.cola[id_] = Copia(c.reporte, c.linea, c.saltos + 1, proximo=self.t + 1)

    def _pendientes(self, n: Nodo) -> list[Copia]:
        """Por prioridad y luego por hora; nunca se descarta un P3/P4, solo espera su turno."""
        listos = [c for c in n.cola.values()
                  if c.reporte.id not in n.confirmados and not c.vencido and c.proximo <= self.t]
        if not self.p.por_prioridad:
            return sorted(listos, key=lambda c: c.reporte.hora_unix)
        return sorted(listos, key=lambda c: (c.reporte.prioridad, c.reporte.hora_unix))

    def _paso_nodo(self, n: Nodo) -> None:
        n.bateria -= self.p.gasto_reposo
        if n.bateria <= 0:
            n.vivo, n.apagado_en = False, self.t
            return

        if self.p.vence_s is not None:
            for c in n.cola.values():
                if not c.vencido and c.reporte.id not in n.confirmados and self.t - (c.reporte.hora_unix - self.p.hora_base) > self.p.vence_s:
                    c.vencido = True  # se marca "no entregado"; nunca se borra
                    s = self.seguimiento[c.reporte.id]
                    if s.nodo == n.id:
                        s.vencido = True

        pend = self._pendientes(n)
        if n.pasarela and pend:
            ids = self.central.subir([c.linea for c in pend], n.id)
            if ids is None:
                self.subidas_fallidas += 1
                for c in pend:
                    c.intentos += 1
                    c.proximo = self.t + self.espera(c.intentos)
            else:
                for c in pend:
                    if c.reporte.id in ids:
                        s = self.seguimiento[c.reporte.id]
                        if s.llegada is None:
                            s.llegada, s.saltos = self.t, c.saltos
                        self._confirmar(n, c.reporte.id)
        elif not n.pasarela:
            for c in pend[: self.p.capacidad]:
                self.emitidos["reportes"] += 1
                for v in self._emitir(n, c.linea):
                    self._recibir(v, c)
                c.intentos += 1
                c.proximo = self.t + self.espera(c.intentos)

        avisar, n.sacks_por_avisar = n.sacks_por_avisar, []
        for id_ in dict.fromkeys(avisar):
            self.emitidos["sacks"] += 1
            for v in self._emitir(n, sack(id_)):
                self._confirmar(v, id_)

    def _crear_reportes(self) -> None:
        while self.agenda and self.agenda[0] <= self.t:
            self.agenda.pop(0)
            vivos = [n for n in self.nodos if n.vivo and not n.pasarela] or [n for n in self.nodos if n.vivo]
            if not vivos:
                continue
            n = self.rng.choice(vivos)
            r = self.gen.nuevo(n.id, n.x, n.y, self.p.hora_base + self.t)
            n.cola[r.id] = Copia(r, r.linea(), saltos=0, proximo=self.t)
            self.seguimiento[r.id] = Seguimiento(r.id, r.prioridad, n.id, self.t)

    def _terminado(self) -> bool:
        """Todo confirmado al reportante, vencido, o entregado aunque el reportante ya se apagó.
        Si nadie lo entregó, sigue: otro celular puede tener una copia."""
        vivos = {n.id for n in self.nodos if n.vivo}
        return not self.agenda and all(
            s.confirmado is not None or s.vencido or (s.nodo not in vivos and s.llegada is not None)
            for s in self.seguimiento.values())

    def conectados_a_pasarela(self) -> int:
        """Celulares con algún camino a una pasarela al empezar (los demás están en islas)."""
        vistos = {n.id for n in self.nodos if n.pasarela}
        frente = [n for n in self.nodos if n.pasarela]
        while frente:
            nuevos = []
            for n in frente:
                for v in self.vecinos[n.id]:
                    if v.id not in vistos:
                        vistos.add(v.id)
                        nuevos.append(v)
            frente = nuevos
        return len(vistos)

    def correr(self) -> "Simulacion":
        for self.t in range(self.p.duracion_s + 1):
            if self.p.caida:
                self.central.caida = self.p.caida[0] <= self.t < self.p.caida[1]
            if self.al_paso:
                self.al_paso(self.t)
            self._crear_reportes()
            orden = [n for n in self.nodos if n.vivo]
            self.rng.shuffle(orden)
            for n in orden:
                self._paso_nodo(n)
            if self._terminado():
                break
            if self.p.velocidad:
                time.sleep(1 / self.p.velocidad)
        return self
