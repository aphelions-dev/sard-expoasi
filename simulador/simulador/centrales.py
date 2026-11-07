"""A dónde entrega la pasarela.

- `CentralSimulada`: dentro del simulador, responde SACK al instante. Reproducible; para E1–E4.
- `CentralHttp`: la API real (`contracts/api-central.md`), `POST /reportes` con failover A → B
  según `GET /salud`. Para E5 y como plan B de la demo; no es reproducible al 100 %.
"""

import json
import urllib.error
import urllib.request


class CentralSimulada:
    def __init__(self) -> None:
        self.llegadas: dict[str, int] = {}  # id → veces que llegó (duplicados por varios caminos)
        self.creados: set[str] = set()      # cada id crea un solo reporte (regla 3)
        self.caida = False                  # para ensayar una caída sin la central real

    def subir(self, lineas: list[str], pasarela: str) -> list[str] | None:
        """Ids con SACK, o `None` si no hay central que responda."""
        if self.caida:
            return None
        ids = []
        for l in lineas:
            id_ = l.split("|", 2)[1]
            self.llegadas[id_] = self.llegadas.get(id_, 0) + 1
            self.creados.add(id_)
            ids.append(id_)
        return ids


class CentralHttp:
    def __init__(self, urls: dict[str, str], espera_s: float = 3.0) -> None:
        self.urls = urls  # {"A": "http://localhost:8001", "B": ...}
        self.espera_s = espera_s
        self.llegadas: dict[str, int] = {}
        self.creados: set[str] = set()
        self.usadas: dict[str, int] = {}  # cuántas subidas fueron a cada central
        self.ultima: str | None = None    # central que respondió la última subida
        self.caida = False

    def _pedir(self, url: str, datos: dict | None = None):
        cuerpo = json.dumps(datos).encode() if datos is not None else None
        req = urllib.request.Request(url, data=cuerpo, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=self.espera_s) as r:
            return json.load(r)

    def _activa(self) -> str | None:
        for nodo, url in self.urls.items():
            try:
                self._pedir(f"{url}/salud")
                return nodo
            except (urllib.error.URLError, OSError, TimeoutError):
                continue
        return None

    def subir(self, lineas: list[str], pasarela: str) -> list[str] | None:
        nodo = self._activa()
        if nodo is None:
            return None
        try:
            r = self._pedir(f"{self.urls[nodo]}/reportes", {"mensajes": lineas, "pasarela_id": pasarela})
        except (urllib.error.URLError, OSError, TimeoutError):
            return None
        self.usadas[nodo] = self.usadas.get(nodo, 0) + 1
        self.ultima = nodo
        ids = [s.split("|", 1)[1] for s in r["sack"]]
        for id_ in ids:
            self.llegadas[id_] = self.llegadas.get(id_, 0) + 1
            self.creados.add(id_)
        return ids
