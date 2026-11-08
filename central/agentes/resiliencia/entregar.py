"""Entrega a la otra central los reportes recién recibidos, antes de dar el SACK (#49).

Sin esto, si la central cae justo después de confirmar, el reporte queda solo en su base hasta que
vuelve: la otra no lo ve y el celular ya no reintenta. `POST /reportes` espera esta entrega hasta
1 s; si la otra no responde, da el SACK igual y la copia llega por `GET /eventos`
(`contracts/api-central.md`). Después de un fallo deja de intentar por `PAUSA` segundos, para no
hacer esperar a la pasarela por una central caída. Sin IA.
"""

import json
import logging
import time
import urllib.request
from dataclasses import asdict

from registro import eventos

log = logging.getLogger("sard.resiliencia")
ESPERA = 1.0
PAUSA = 5.0
_pausa_hasta = 0.0


def entregar(url_par: str | None, evs: list[eventos.Evento]) -> bool:
    """Envía los eventos a `POST /eventos` de la otra central. Devuelve si ella confirmó."""
    global _pausa_hasta
    if not url_par or not evs:
        return not evs
    if time.monotonic() < _pausa_hasta:
        return False
    cuerpo = {"eventos": [{k: v for k, v in asdict(e).items() if k != "seq"} for e in evs]}
    pedido = urllib.request.Request(
        f"{url_par}/eventos", data=json.dumps(cuerpo, ensure_ascii=False).encode(),
        headers={"Content-Type": "application/json"}, method="POST",
    )
    try:
        with urllib.request.urlopen(pedido, timeout=ESPERA):
            return True
    except OSError as e:
        _pausa_hasta = time.monotonic() + PAUSA
        log.warning("la otra central no confirmó %d reportes: %s", len(evs), e)
        return False
