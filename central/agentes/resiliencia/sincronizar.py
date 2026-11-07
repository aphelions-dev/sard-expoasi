"""Agente de resiliencia: mantiene esta central al día con la otra.

Cada segundo trae de la otra central los eventos nuevos (`GET /eventos?desde_seq=`) y los une a
su registro por id. Como el registro solo crece, la unión no tiene conflictos (G-Set): un evento
repetido se ignora, y si las dos centrales clasificaron distinto el mismo reporte se conservan
las dos versiones y el tablero las muestra. Va en las dos direcciones: la A copia de la B lo que
la B recibió mientras la A estaba caída. Sin IA. Ficha: `docs/fichas-agentes/resiliencia.md`.
"""

import json
import logging
import sqlite3
import time
import urllib.request

import config
from registro import eventos

log = logging.getLogger("sard.resiliencia")
LOTE = 500


def traer(conn: sqlite3.Connection, url_par: str, desde_seq: int) -> tuple[int, int]:
    """Trae un lote de la otra central. Devuelve (nuevo cursor, eventos agregados)."""
    url = f"{url_par}/eventos?desde_seq={desde_seq}&limite={LOTE}"
    with urllib.request.urlopen(url, timeout=3) as r:
        lote = json.load(r)
    if lote["ultimo_seq"] < desde_seq:  # la otra central arrancó con una base nueva
        return 0, 0
    agregados = sum(eventos.importar(conn, ev) for ev in lote["eventos"])
    return (lote["eventos"][-1]["seq"] if lote["eventos"] else desde_seq), agregados


def correr(intervalo: float = 1.0) -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
    cfg = config.cargar()
    if not cfg.url_par:
        raise SystemExit("Falta la URL de la otra central (CENTRAL_A_URL / CENTRAL_B_URL)")
    conn = eventos.conectar(cfg.db)
    eventos.crear_esquema(conn)
    log.info("central %s sincroniza con %s", cfg.nodo, cfg.url_par)
    cursor, vivo = 0, None  # el cursor arranca en 0: reimportar es inofensivo
    while True:
        try:
            cursor, n = traer(conn, cfg.url_par, cursor)
        except OSError as e:
            if vivo is not False:
                eventos.agregar(conn, nodo=cfg.nodo, tipo="par_caido",
                                datos={"par": cfg.url_par, "error": repr(e)})
                log.warning("la otra central no responde: %s", e)
            vivo = False
            time.sleep(intervalo)
            continue
        if vivo is False:
            eventos.agregar(conn, nodo=cfg.nodo, tipo="par_recuperado", datos={"par": cfg.url_par})
            log.info("la otra central volvió")
        vivo = True
        if n:
            log.info("%d eventos nuevos de la otra central", n)
        if n < LOTE:
            time.sleep(intervalo)
