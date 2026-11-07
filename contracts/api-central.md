# API de la central

Implementada en `central/api/main.py` (Python + FastAPI + SQLite). Central A en el puerto 8001 y
B en el 8002 (`central/iniciar.py`). La documentación interactiva queda en `/docs` de cada una.
Las dos centrales exponen la misma API y, una vez sincronizadas, responden lo mismo.

## POST /reportes

La pasarela sube uno o varios mensajes SARD1 tal como llegaron de la malla.

- Entrada: `{ "mensajes": ["SARD1|...", ...], "pasarela_id": "..." }` (`pasarela_id` opcional).
- Salida: `{ "sack": ["SACK|<id>", ...], "rechazados": [{ "mensaje": "...", "motivo": "..." }] }`
- Un `id` ya visto devuelve su `SACK` igual (idempotente) y no crea otro reporte.
- Un mensaje mal formado va a `rechazados` y no recibe `SACK`.

## GET /incidentes

Incidentes agrupados y priorizados para el tablero, de P1 a P4 y, dentro de cada prioridad, del
más antiguo al más nuevo. Un reporte aparece aquí cuando los agentes ya lo priorizaron y lo
correlacionaron (en segundos).

- Parámetros opcionales: `estado`, `prioridad` (`P1`…`P4`), `desde` (hora unix mínima).
- Salida: lista de incidentes:

| Campo | Qué es |
|-------|--------|
| `id` | `inc-<id del primer reporte>` |
| `prioridad` | La más alta de sus reportes |
| `tipo` | El tipo más frecuente entre sus reportes (`ATRAP`, `MEDIC`, …) |
| `geohash` | El del primer reporte, o `null` si no trajo ubicación |
| `hora_unix` | Hora del primer reporte |
| `reportes` | Ids de los reportes, en orden de hora |
| `evidencia` | Uno por reporte: `reporte_id`, `texto`, `tipo`, `personas`, `hora_unix`, `prioridad`, `fuente` (`directa`, `de_oidas`, `incierta`), `vinculo` (`nuevo` o `mismo`), `similitud`, `rutas` (pasarelas por las que llegó) y `senales` (lista de `{senal, origen, prioridad, cita, probabilidad}`; `origen` es `formulario`, `texto` o `jev`) |
| `incertidumbre` | `revisar` (bool), `motivos`, `corroboracion` (`corroborado`, `sin_confirmar`, `posible_rumor`), `dispositivos`, `fuentes_directas`, `contradicciones`, `posibles_mismo_incidente`, `discrepancias_entre_centrales`, `sin_ubicacion`, `sin_analisis_ia` |
| `estado` | `sin_propuesta`, `pendiente`, `aprobada` o `rechazada` |
| `accion_propuesta` | `null` o `{id, entidad, accion, prioridad, personas_estimadas, justificacion, falta_confirmar, requiere_aprobacion}` |
| `decision` | `null` o `{accion_id, decision, coordinador, nota}` |

Para no ocultar casos, el tablero puede pedir todo y separar en pantalla los P1/P2 de los P3/P4 y
de los que tienen `incertidumbre.revisar`.

## POST /incidentes/{id}/aprobacion

El coordinador humano aprueba o rechaza la acción propuesta vigente. Ninguna acción se ejecuta
sin esto. Si el incidente cambia después (llega otro reporte), sale una propuesta nueva y el
incidente vuelve a `pendiente`.

- Entrada: `{ "decision": "aprobar" | "rechazar", "coordinador": "...", "nota": "..." }`
- Salida: el incidente actualizado (mismo formato que en `GET /incidentes`).
- `404` si el incidente no existe; `409` si todavía no tiene acción propuesta.

## GET /salud

Para el failover de la pasarela y el indicador de nodos del tablero.

- Salida: `{ "estado": "ok", "central": "A" | "B", "jev": "ok" | "caido" }`

## GET /eventos

Para que las centrales se sincronicen entre sí; no es para el tablero ni la pasarela.

- Parámetros: `desde_seq` (por defecto 0), `limite` (por defecto 500, máximo 1000).
- Salida: `{ "eventos": [{seq, id, nodo, tipo, reporte_id, causa, datos, creado_en}], "ultimo_seq": n }`
