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

Incidentes agrupados y priorizados para el tablero. Un reporte aparece aquí cuando los agentes ya
lo priorizaron y lo correlacionaron (en segundos).

Orden, según urgencia, impacto y confianza (bases, objetivo 4):

1. prioridad, de P1 a P4;
2. impacto: primero los que tienen niños o adultos mayores, después los de más personas;
3. confianza: `corroborado`, `sin_confirmar`, `posible_rumor`;
4. hora del primer reporte, del más antiguo al más nuevo.

Ningún criterio saca un incidente de la lista: solo cambia su lugar.

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
| `impacto` | `{personas, vulnerables}`: el mayor número de personas entre sus reportes y si alguno marcó niños o adultos mayores |
| `vigencia` | `{ultimo_reporte_unix, minutos_sin_noticias, sin_noticias_recientes}`; `sin_noticias_recientes` es `true` si pasaron más de 60 minutos desde el último reporte |
| `motivo_orden` | Texto corto con lo que decidió su lugar, p. ej. `"P1 · niños o adultos mayores · 3 personas · corroborado"` |
| `recurso` | `null` si el tipo no usa un recurso declarado, o `{recurso, entidad, disponibles, compiten}`: `disponibles` es `null` si nadie lo ha declarado; `compiten` son los ids de otros incidentes pendientes que piden el mismo recurso con prioridad igual o mayor |
| `estado` | `sin_propuesta`, `pendiente`, `aprobada` o `rechazada` |
| `accion_propuesta` | `null` o `{id, entidad, recurso, accion, prioridad, personas_estimadas, justificacion, falta_confirmar, requiere_aprobacion}`; `recurso` es `null` o el nombre del recurso que usaría (p. ej. `"ambulancia"`) |
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
- `422` si se aprueba un incidente con `incertidumbre.revisar` y la `nota` está vacía: el
  coordinador escribe por qué aprueba lo que el sistema marcó para revisar.
- Una aprobación compromete una unidad del recurso de la propuesta (ver `/recursos`).

## GET /recursos

Recursos que el coordinador declaró disponibles, para que la coordinación no proponga lo que no hay.

- Salida: lista de `{entidad, recurso, declarados, comprometidos, disponibles, coordinador, declarado_en}`.
- `comprometidos` cuenta las propuestas aprobadas que usan ese recurso después de la última
  declaración; `disponibles = declarados - comprometidos`, nunca menor que 0.

## POST /recursos

El coordinador declara cuántas unidades tiene de un recurso. Cada declaración reemplaza a la
anterior del mismo recurso; para devolver unidades, declara otra vez el número actual.

- Entrada: `{ "entidad": "Cruz Roja", "recurso": "ambulancia", "disponibles": 3, "coordinador": "..." }`
- Salida: la lista de `GET /recursos`.
- Recursos por tipo de incidente: `ATRAP` equipo de rescate (Bomberos), `FUEGO` máquina de
  bomberos (Bomberos), `MEDIC` ambulancia (Cruz Roja), `DESAP` equipo de búsqueda (Cruz Roja),
  `VIA` cuadrilla (Defensa Civil), `OTRO` ninguno (sala de crisis).

## GET /rechazados

Mensajes que no cumplieron el protocolo, para que un reporte truncado no quede invisible. No
recibieron `SACK`, así que el celular sigue reintentando; aquí el coordinador ve lo que sí llegó.

- Salida: lista de `{reporte_id, motivos, campos, pasarela_id, recibido_en, recuperado}`.
- `reporte_id` es `null` si el id no se pudo leer. `campos` tiene solo los campos que llegaron,
  sin completar nada. `recuperado` es `true` si después llegó una versión válida del mismo id.
- Orden: primero los no recuperados; luego por la prioridad que traían (los sin prioridad al
  final); luego del más reciente al más antiguo.

## GET /salud

Para el failover de la pasarela y el indicador de nodos del tablero.

- Salida: `{ "estado": "ok", "central": "A" | "B", "jev": "ok" | "caido" }`

## GET /eventos

Para que las centrales se sincronicen entre sí; no es para el tablero ni la pasarela.

- Parámetros: `desde_seq` (por defecto 0), `limite` (por defecto 500, máximo 1000).
- Salida: `{ "eventos": [{seq, id, nodo, tipo, reporte_id, causa, datos, creado_en}], "ultimo_seq": n }`
