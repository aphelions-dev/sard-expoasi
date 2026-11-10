# Entregable 4 · Fichas de agentes

Bases, Tabla 4: «objetivo, entradas, salidas, herramientas, memoria, límites de autonomía, manejo
de errores y criterios de terminación». Este documento reúne los seis agentes de la Tabla 3 de las
bases y cómo colaboran. La ficha completa de cada uno, con todos esos campos, está en
`docs/fichas-agentes/`, junto al código que describe; si algo cambia, se corrige allá primero.

| # | Agente (bases, Tabla 3) | Ficha completa | Código | Usa IA |
|---|-------------------------|----------------|--------|--------|
| 1 | Recepción y normalización | [recepcion.md](../fichas-agentes/recepcion.md) | `central/agentes/recepcion/` | No |
| 2 | Triaje y priorización | [triaje.md](../fichas-agentes/triaje.md) | `central/agentes/triaje/` | Sí, Jev |
| 3 | Correlación y deduplicación | [correlacion.md](../fichas-agentes/correlacion.md) | `central/agentes/correlacion/` | Sí, Jev |
| 4 | Comunicación y sincronización | [comunicacion.md](../fichas-agentes/comunicacion.md) | `app/bitchat-android/.../sard/`, `reportar/lib/` | No |
| 5 | Resiliencia y recuperación | [resiliencia.md](../fichas-agentes/resiliencia.md) | `central/agentes/resiliencia/` | No |
| 6 | Coordinación de respuesta | [coordinacion.md](../fichas-agentes/coordinacion.md) | `central/agentes/coordinacion/` | No |

## Cómo colaboran sin un agente central

Cada agente de la central es un proceso aparte que lee y escribe en el registro de eventos (patrón
pizarra). Ninguno llama a otro ni espera a otro: el triaje no sabe que existe la correlación, solo
que hay `reporte_recibido` sin `reporte_priorizado`. Por eso la caída de uno no detiene a los demás,
y al volver retoma lo pendiente. Las dos centrales tienen los mismos agentes; los de la B esperan
mientras la A responda (detalle en el [entregable 3](03-arquitectura.md#2-distribución-de-agentes)).

```
celular ─SARD1→ [1 Recepción] ─reporte_recibido→ [2 Triaje] ─reporte_priorizado→ [3 Correlación]
   ↑                 │                                                                │
   └──── SACK ───────┘                                              incidente_actualizado
                                                                                     ↓
                     coordinador ←─ accion_propuesta (pendiente) ←── [6 Coordinación]
[4 Comunicación]: cola del celular, reintentos y SACK      [5 Resiliencia]: copia eventos entre A y B
```

## Las fichas, campo por campo

### 1 · Recepción y normalización

| Campo | Contenido |
|-------|-----------|
| Objetivo | Validar y normalizar cada SARD1, detectar campos faltantes, formatos inválidos y mensajes truncados, descartar duplicados exactos por id y devolver `SACK` |
| Entradas | Mensajes SARD1 crudos de `POST /reportes` (pasarela Android o app web) |
| Salidas | `reporte_recibido` (normalizado), `reporte_duplicado` o `reporte_rechazado` (motivos, campos que sí llegaron); `SACK|<id>` |
| Herramientas | Validador SARD1 (`central/protocolo/sard1.py`), registro de eventos y entrega a la otra central antes del `SACK` (`POST /eventos`). Sin IA |
| Memoria | Registro de eventos; la deduplicación es un índice único sobre `reporte_id` |
| Límites de autonomía | No inventa la ubicación ni completa datos: un geohash vacío queda vacío y un mensaje inválido se rechaza, no se corrige |
| Manejo de errores | Mensaje truncado o inválido: sin `SACK`, el celular reintenta y el coordinador lo ve en `GET /rechazados`. Base caída: error HTTP y la pasarela reintenta. Otra central sin responder en 1 s: el `SACK` sale igual y la copia llega por sincronización |
| Terminación | Cada mensaje termina con exactamente un evento y, si es válido, su `SACK` en la respuesta |

### 2 · Triaje y priorización

| Campo | Contenido |
|-------|-----------|
| Objetivo | Identificar indicadores de riesgo (atrapados, no respira, inconsciente, sangrado grave, incendio, herido), proponer la prioridad, explicar las señales y marcar los casos ambiguos |
| Entradas | `reporte_recibido` |
| Salidas | `reporte_priorizado`: prioridad final, la de reglas y la de Jev, evidencia (señal, origen, cita o probabilidad), fuente (directa, de oídas, incierta) y motivos de revisión |
| Herramientas | Reglas (banderas y `contracts/palabras-criticas.txt`) y Jev con 8 preguntas de sí/no y una de tipo (`central/agentes/triaje/jev.py`). Jev propone P1 si una señal vital pasa de 0,7 y P2 si «herido» pasa de 0,7 |
| Memoria | Registro de eventos; lo pendiente es todo `reporte_recibido` sin `reporte_priorizado` |
| Límites de autonomía | Jev puede subir una prioridad, nunca bajarla (ADR 0005). Apoyo, no diagnóstico clínico. Una palabra crítica negada («no hay atrapados») no baja la prioridad: queda como «posible negación» para el coordinador |
| Manejo de errores | Jev caído, lento (más de 8 s, un reintento) o sin clave: queda la prioridad de reglas, marcada `jev: caido`. Reporte sin texto: no consulta a Jev. Error del agente: `agente_error` y reintento |
| Terminación | Cada `reporte_recibido` tiene exactamente un `reporte_priorizado`; los P1 se procesan primero |

### 3 · Correlación y deduplicación

| Campo | Contenido |
|-------|-----------|
| Objetivo | Agrupar los reportes que probablemente describen el mismo suceso y distinguir un rumor repetido de una emergencia corroborada |
| Entradas | `reporte_priorizado` |
| Salidas | `incidente_actualizado`: incidente nuevo o existente, similitud, posibles vínculos y contradicciones |
| Herramientas | Código que filtra candidatos (menos de 1,5 km y 2 h, máximo 5, `pygeohash`) y Jev por candidato: «¿es el mismo suceso?» y «¿lo contradice?». Con p ≥ 0,7 vincula; entre 0,3 y 0,7 abre otro incidente y lo anota como posible |
| Memoria | Registro de eventos; un incidente es el conjunto de `incidente_actualizado` con su id |
| Límites de autonomía | No borra ni fusiona reportes: cada observación sigue en el incidente con su texto. Un vínculo dudoso no se hace, se muestra. Corroborado exige 2 dispositivos y una fuente directa; varias pasarelas cuentan como rutas, no como fuentes |
| Manejo de errores | Sin Jev, solo vincula la misma celda, el mismo tipo y menos de 30 min; ante la duda no junta. Error del agente: `agente_error` y reintento |
| Terminación | Cada `reporte_priorizado` tiene un `incidente_actualizado` |

### 4 · Comunicación y sincronización

| Campo | Contenido |
|-------|-----------|
| Objetivo | Decidir qué transmitir primero, administrar la cola, los reintentos y los `SACK`. Servicio transversal, sin IA |
| Entradas | Reportes propios o de vecinos, `SACK` de la malla, aviso de vecino nuevo; en la pasarela, `GET /salud` y `POST /reportes` |
| Salidas | SARD1 a los vecinos en orden de cola y estado de cada reporte (pendiente, entregado, no entregado) |
| Herramientas | Cola por prioridad y `hora_unix`; reintentos 2, 4, 8, 16, 32 s y luego 60 s con ±20 %; vencimiento a los 600 s; failover A → B. Detalle en el [entregable 5](05-protocolo-comunicacion.md) |
| Memoria | Archivo JSON en el celular (`filesDir/sard/reportes.json`) o almacenamiento del navegador en la app web; sobrevive a un reinicio |
| Límites de autonomía | No cambia la prioridad. No descarta P3/P4. Nunca borra: lo vencido se marca. Solo la pasarela usa internet |
| Manejo de errores | Sin `SACK`: reintenta. Vencido: «no entregado» hasta ver un vecino nuevo. Ninguna central responde: conserva y reintenta. Mensaje rechazado por mal formado: no lo reintenta |
| Terminación | Por reporte: al recibir su `SACK` o al vencer. La cola es continua mientras el celular esté encendido |

### 5 · Resiliencia y recuperación

| Campo | Contenido |
|-------|-----------|
| Objetivo | Supervisar la otra central, detectar interrupciones y reanudar el procesamiento a partir del registro de eventos. Lógica distribuida convencional, sin LLM |
| Entradas | Eventos de la otra central (`GET /eventos?desde_seq=`) y su `GET /salud` |
| Salidas | Copia de los eventos que faltaban, `par_caido`, `par_recuperado`; el tablero ve el estado en `/salud` |
| Herramientas | Unión de registros por id cada segundo, en las dos direcciones. El registro es un conjunto que solo crece (G-Set): la unión no tiene conflictos y reimportar es inofensivo |
| Memoria | Registro de eventos; el cursor vive en memoria y al reiniciar reimporta sin duplicar |
| Límites de autonomía | Ningún modelo toma decisiones de infraestructura. A qué central se sube lo decide la pasarela con `/salud` |
| Manejo de errores | Otra central caída: `par_caido` una vez y sigue intentando. Clasificaciones distintas del mismo reporte: se conservan las dos y el incidente toma la más alta, marcado en `discrepancias_entre_centrales`. Base nueva en la otra: el cursor vuelve a 0 |
| Terminación | Servicio continuo. Una recuperación termina cuando `GET /incidentes` da lo mismo en las dos centrales |

### 6 · Coordinación de respuesta

| Campo | Contenido |
|-------|-----------|
| Objetivo | Preparar por incidente una recomendación con entidad, recurso, justificación y lo que falta confirmar, para que el coordinador la apruebe o la rechace |
| Entradas | `incidente_actualizado` y el incidente completo; unidades registradas por cada entidad (`unidad_registrada`, `unidad_estado`) y solicitudes abiertas |
| Salidas | `accion_propuesta` con `requiere_aprobacion`. La decisión del coordinador queda como `decision_humana` y, si aprueba, `recurso_solicitado` |
| Herramientas | Matriz de responsabilidades (atrapados, incendios, deslizamientos, inundaciones y gas a Bomberos; heridos y desaparecidos a Cruz Roja; vías a Defensa Civil; lo demás a la sala de crisis) y una plantilla con los datos del incidente. Sin IA |
| Memoria | Registro de eventos; sin estado propio |
| Límites de autonomía | No despacha ni asigna: aprobar solo solicita el recurso, y la asignación la reporta la entidad dueña (ADR 0006). No inventa disponibilidad: sin unidades registradas, `disponibles` es `null`. Si el incidente cambia, propone de nuevo y la decisión anterior no se aplica |
| Manejo de errores | Incidente incompleto: `agente_error` y reintento. Aprobar un incidente marcado para revisión exige nota (`422`). Falta ubicación, fuente directa o número de personas: lo dice en `falta_confirmar` |
| Terminación | Cada `incidente_actualizado` tiene una `accion_propuesta`; el ciclo termina con una `decision_humana` sobre la propuesta vigente |

## Límites de autonomía frente a las bases

| Límite que piden las bases (Tabla 3) | Cómo se cumple | Dónde se verifica |
|--------------------------------------|----------------|-------------------|
| Recepción: no inventa la ubicación ni completa datos | Geohash vacío queda vacío; inválido se rechaza | `central/tests/`, ejemplos 04, 06 y 09 de `contracts/ejemplos/` |
| Triaje: apoyo, no diagnóstico ni decisión definitiva | Jev solo sube; todo va al coordinador con su evidencia | E6 y E7: 0 prioridades bajadas |
| Correlación: mantiene el vínculo con cada observación | No borra ni fusiona; cada reporte con su texto y similitud | E4: exactamente 1 reporte por id |
| Comunicación: la prioridad no hace desaparecer lo bajo | P3/P4 esperan, nunca se descartan | E3: ningún reporte descartado por la cola |
| Resiliencia: sin LLM en infraestructura | Código convencional, sin Jev | `central/agentes/resiliencia/` |
| Coordinación: no despacha sin autorización | `requiere_aprobacion` siempre; aprobar solo solicita | `central/tests/`, paso 6 de la demo |
