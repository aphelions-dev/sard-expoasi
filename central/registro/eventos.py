"""Registro de eventos de la central: solo agrega, nunca borra ni modifica (ADR 0003).

Cada evento tiene un `id` global (uuid) y el `nodo` que lo creó, para que la central B pueda
copiar los eventos de la A sin duplicarlos. `seq` es el orden local de llegada.
Las reglas de solo-agregar las impone la base con triggers, no solo el código.
"""

import json
import sqlite3
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ESQUEMA = """
CREATE TABLE IF NOT EXISTS eventos (
    seq        INTEGER PRIMARY KEY AUTOINCREMENT,
    id         TEXT NOT NULL UNIQUE,
    nodo       TEXT NOT NULL,
    tipo       TEXT NOT NULL,
    reporte_id TEXT,
    causa      TEXT,
    datos      TEXT NOT NULL,
    creado_en  REAL NOT NULL
);

-- Un reporte se acepta una sola vez por id (protocolo SARD1, regla 3).
CREATE UNIQUE INDEX IF NOT EXISTS un_reporte_recibido
    ON eventos (reporte_id) WHERE tipo = 'reporte_recibido';

-- Un agente responde una sola vez a cada evento, aunque corran varias copias de él.
CREATE UNIQUE INDEX IF NOT EXISTS un_respuesta
    ON eventos (tipo, causa) WHERE causa IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_eventos_tipo ON eventos (tipo, seq);
CREATE INDEX IF NOT EXISTS ix_eventos_causa ON eventos (causa);
CREATE INDEX IF NOT EXISTS ix_eventos_incidente
    ON eventos (json_extract(datos, '$.incidente_id'));
CREATE INDEX IF NOT EXISTS ix_eventos_reporte ON eventos (reporte_id);

CREATE TRIGGER IF NOT EXISTS eventos_sin_update BEFORE UPDATE ON eventos
BEGIN SELECT RAISE(ABORT, 'el registro de eventos solo agrega'); END;

CREATE TRIGGER IF NOT EXISTS eventos_sin_delete BEFORE DELETE ON eventos
BEGIN SELECT RAISE(ABORT, 'el registro de eventos solo agrega'); END;
"""


@dataclass(frozen=True)
class Evento:
    seq: int
    id: str
    nodo: str
    tipo: str
    reporte_id: str | None
    causa: str | None
    datos: dict[str, Any]
    creado_en: float


def conectar(ruta: Path | str) -> sqlite3.Connection:
    """Abre la base en modo WAL: varios lectores y un escritor, también entre procesos."""
    if str(ruta) != ":memory:":
        Path(ruta).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(ruta, timeout=5.0, isolation_level=None, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


def crear_esquema(conn: sqlite3.Connection) -> None:
    conn.executescript(ESQUEMA)


def agregar(
    conn: sqlite3.Connection,
    *,
    nodo: str,
    tipo: str,
    datos: dict[str, Any],
    reporte_id: str | None = None,
    causa: str | None = None,
) -> Evento | None:
    """Agrega un evento. Devuelve None si una restricción de unicidad lo descartó."""
    id_ = uuid.uuid4().hex
    creado_en = time.time()
    cur = conn.execute(
        "INSERT OR IGNORE INTO eventos (id, nodo, tipo, reporte_id, causa, datos, creado_en)"
        " VALUES (?, ?, ?, ?, ?, ?, ?)",
        (id_, nodo, tipo, reporte_id, causa, json.dumps(datos, ensure_ascii=False), creado_en),
    )
    if cur.rowcount == 0:
        return None
    return Evento(cur.lastrowid, id_, nodo, tipo, reporte_id, causa, datos, creado_en)


def importar(conn: sqlite3.Connection, ev: dict[str, Any]) -> bool:
    """Copia un evento de otra central conservando su id, nodo y hora.

    El registro se comporta como un conjunto que solo crece (G-Set): un evento que ya está,
    o que choca con una restricción de unicidad, se ignora. Devuelve si se agregó.
    """
    cur = conn.execute(
        "INSERT OR IGNORE INTO eventos (id, nodo, tipo, reporte_id, causa, datos, creado_en)"
        " VALUES (?, ?, ?, ?, ?, ?, ?)",
        (ev["id"], ev["nodo"], ev["tipo"], ev["reporte_id"], ev["causa"],
         json.dumps(ev["datos"], ensure_ascii=False), ev["creado_en"]),
    )
    return cur.rowcount == 1


def leer(
    conn: sqlite3.Connection, *, desde_seq: int = 0, tipos: list[str] | None = None,
    limite: int | None = None,
) -> list[Evento]:
    """Eventos con seq mayor que `desde_seq`, en orden de llegada."""
    sql = "SELECT * FROM eventos WHERE seq > ?"
    params: list[Any] = [desde_seq]
    if tipos:
        sql += f" AND tipo IN ({','.join('?' * len(tipos))})"
        params += tipos
    sql += " ORDER BY seq"
    if limite:
        sql += " LIMIT ?"
        params.append(limite)
    return [_a_evento(f) for f in conn.execute(sql, params)]


def de_incidente(conn: sqlite3.Connection, incidente_id: str) -> list[Evento]:
    """Todos los eventos de un incidente: los de sus reportes y los que lo nombran."""
    filas = conn.execute(
        "SELECT * FROM eventos WHERE json_extract(datos, '$.incidente_id') = ?"
        " OR reporte_id IN (SELECT reporte_id FROM eventos WHERE tipo = 'incidente_actualizado'"
        "   AND json_extract(datos, '$.incidente_id') = ?)"
        " ORDER BY seq",
        (incidente_id, incidente_id),
    )
    return [_a_evento(f) for f in filas]


def pendientes(
    conn: sqlite3.Connection, *, consume: str, produce: str, limite: int = 50
) -> list[Evento]:
    """Eventos `consume` que aún no tienen un evento `produce` que los cite como causa.

    Los P1 salen primero; dentro de cada prioridad, en orden de llegada.
    """
    filas = conn.execute(
        "SELECT e.* FROM eventos e WHERE e.tipo = ? AND NOT EXISTS"
        " (SELECT 1 FROM eventos r WHERE r.tipo = ? AND r.causa = e.id)"
        " ORDER BY coalesce(json_extract(e.datos, '$.prioridad'), 'P9'), e.seq LIMIT ?",
        (consume, produce, limite),
    )
    return [_a_evento(f) for f in filas]


def ultimo(conn: sqlite3.Connection, tipo: str) -> Evento | None:
    fila = conn.execute(
        "SELECT * FROM eventos WHERE tipo = ? ORDER BY seq DESC LIMIT 1", (tipo,)
    ).fetchone()
    return _a_evento(fila) if fila else None


def _a_evento(fila: sqlite3.Row) -> Evento:
    return Evento(
        seq=fila["seq"],
        id=fila["id"],
        nodo=fila["nodo"],
        tipo=fila["tipo"],
        reporte_id=fila["reporte_id"],
        causa=fila["causa"],
        datos=json.loads(fila["datos"]),
        creado_en=fila["creado_en"],
    )
