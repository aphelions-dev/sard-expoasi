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
| `recurso` | `null` si el tipo no usa un recurso, o `{recurso, entidad, disponibles, compiten, solicitado, asignadas}`: `disponibles` es cuántas unidades de ese recurso están en estado `disponible` (`null` si la entidad no ha registrado ninguna); `compiten` son los ids de otros incidentes que piden el mismo recurso con prioridad igual o mayor y todavía no tienen unidad asignada; `solicitado` es `true` si la acción vigente fue aprobada (el recurso está pedido); `asignadas` son las matrículas de las unidades asignadas a este incidente |
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
- Aprobar es **solicitar** el recurso de la propuesta (evento `recurso_solicitado`), como el bloque
  "Solicitud de recurso" del formulario SCI-211. No asigna ninguna unidad: la asignación la reporta
  la entidad dueña del recurso (`POST /recursos/unidades/{matricula}/estado`).

## Recursos

Se llevan como en el Sistema de Comando de Incidentes (SCI, formulario SCI-211): **unidad por
unidad**, cada una con su entidad, su matrícula y uno de tres estados. Los registra y actualiza la
entidad dueña (su representante en la sala o su registrador), no el coordinador: quien autoriza un
cambio de estado es quien lo reporta, apenas ocurre. Cada cambio queda en el registro de eventos
con quién y cuándo.

| Estado | Significa |
|--------|-----------|
| `disponible` | Lista para una asignación inmediata |
| `asignada` | Trabajando en un incidente (`incidente_id`) |
| `no_disponible` | No se puede usar: mantenimiento, descanso del personal, sin tripulación |

Recursos por tipo de incidente: `ATRAP` equipo de rescate (Bomberos), `FUEGO` máquina de bomberos
(Bomberos), `MEDIC` ambulancia (Cruz Roja), `DESAP` equipo de búsqueda (Cruz Roja), `VIA` cuadrilla
(Defensa Civil), `OTRO` ninguno (sala de crisis).

### GET /recursos

Para que la coordinación no proponga lo que no hay y el coordinador vea dónde falta.

- Salida: lista de `{entidad, recurso, disponibles, asignadas, no_disponibles,
  solicitudes_abiertas, unidades}`, una por recurso con al menos una unidad registrada.
- `solicitudes_abiertas`: ids de los incidentes con la acción aprobada que piden ese recurso y no
  tienen unidad asignada, en el orden de `GET /incidentes`.
- `unidades`: lista de `{matricula, estado, incidente_id, reportado_por, reportado_en, nota}`.

### POST /recursos/unidades

La entidad registra una unidad (el ingreso del SCI-211). Entra como `disponible`.

- Entrada: `{ "entidad": "Cruz Roja", "recurso": "ambulancia", "matricula": "CR-114", "reportado_por": "..." }`
- Salida: la lista de `GET /recursos`.
- `409` si la matrícula ya está registrada; `422` si la entidad y el recurso no son un par de la
  lista de recursos por tipo.

### POST /recursos/unidades/{matricula}/estado

La entidad reporta un cambio de estado. Liberar una unidad es volverla `disponible`.

- Entrada: `{ "estado": "asignada", "incidente_id": "inc-...", "reportado_por": "...", "nota": "..." }`
- `incidente_id` es obligatorio con `asignada` y debe ser `null` con los otros estados.
- Salida: la lista de `GET /recursos`.
- `404` si la matrícula o el incidente no existen; `422` si el estado no es válido o falta
  `incidente_id` al asignar.

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

## POST /eventos

La central que recibe un reporte le entrega a la otra su evento `reporte_recibido` antes de dar el
`SACK`, para que un reporte confirmado esté en las dos aunque la primera caiga enseguida. No es
para el tablero ni la pasarela.

- Entrada: `{ "eventos": [{id, nodo, tipo, reporte_id, causa, datos, creado_en}] }`, con el mismo
  `id`, `nodo` y `creado_en` que en la central de origen.
- Solo acepta `tipo = "reporte_recibido"`; cualquier otro tipo responde 422 y no agrega nada. Los
  demás eventos siguen llegando por `GET /eventos`.
- Se une al registro igual que la sincronización: un evento que ya estaba se ignora.
- Salida: `{ "agregados": n }`.
- Quien envía espera la respuesta hasta 1 s. Si la otra central no responde a tiempo, da el `SACK`
  igual: la copia la completa después `GET /eventos`.
- Autenticación entre centrales: por definir (hoy `GET /eventos` tampoco la tiene).
