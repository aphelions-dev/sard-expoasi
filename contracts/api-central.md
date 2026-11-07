# API de la central (borrador)

> **Borrador — a confirmar por Persona 2.** Los nombres de campos pueden cambiar.
> Stack propuesto (a confirmar): Python + FastAPI + SQLite.

## POST /reportes

La pasarela sube uno o varios mensajes SARD1 tal como llegaron de la malla.

- Entrada (borrador): `{ "mensajes": ["SARD1|...", ...], "pasarela_id": "..." }`
- Salida (borrador): `{ "sack": ["SACK|<id>", ...], "rechazados": [{ "mensaje": "...", "motivo": "..." }] }`
- Un `id` ya visto devuelve su `SACK` igual (idempotente).

## GET /incidentes

Incidentes agrupados y priorizados para el tablero.

- Parámetros (borrador): `estado`, `prioridad`, `desde` (hora unix).
- Salida (borrador): lista de `{ id, prioridad, tipo, geohash, reportes: [ids], evidencia, incertidumbre, estado, accion_propuesta }`.

## POST /incidentes/{id}/aprobacion

El coordinador humano aprueba o rechaza la acción propuesta. Ninguna acción se ejecuta sin esto.

- Entrada (borrador): `{ "decision": "aprobar" | "rechazar", "coordinador": "...", "nota": "..." }`
- Salida (borrador): incidente actualizado.

## GET /salud

Para el failover de la pasarela entre central A y B.

- Salida (borrador): `{ "estado": "ok", "central": "A" | "B", "jev": "ok" | "caido" }`
