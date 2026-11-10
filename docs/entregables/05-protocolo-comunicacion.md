# Entregable 5 · Protocolo de comunicación

Bases, Tabla 4: «esquema del mensaje, reintentos, confirmaciones, deduplicación y estrategia de
sincronización». Este documento lo explica de punta a punta. La fuente normativa es el contrato
del equipo, que cambia solo con un PR `contrato/...` que aprueban los tres:

- `contracts/protocolo-sard1.md`: mensaje, reglas de la cola y prioridad en el celular.
- `contracts/api-central.md`: API de la central, incluida la sincronización entre centrales.
- `contracts/palabras-criticas.txt`: la lista que comparten la app, la app web y la central.
- `contracts/ejemplos/`: mensajes válidos e inválidos con el resultado esperado.

Si este documento y el contrato no coinciden, manda el contrato.

## 1. Esquema del mensaje

Una línea de texto con campos separados por `|`. Sin JSON ni nombres de campo: la posición dice
qué es cada uno.

```
SARD1|<id>|<prioridad>|<tipo>|<personas>|<banderas>|<geohash>|<hora_unix>|<texto>
SACK|<id>
```

```
SARD1|a3f9-0042|P1|ATRAP|3|101|d2fkcd|1762481000|edificio colapsado calle 23
SACK|a3f9-0042
```

| # | Campo | Formato | Obligatorio | Qué es |
|---|-------|---------|-------------|--------|
| 0 | cabecera | `SARD1` | sí | Versión del protocolo |
| 1 | id | `<dispositivo>-<contador>` | sí | Id corto del celular más un contador local; único por reporte |
| 2 | prioridad | `P1`…`P4` | sí | La calculan las reglas del celular (sección 5) |
| 3 | tipo | `ATRAP` `MEDIC` `FUEGO` `DESLIZ` `INUND` `GAS` `VIA` `DESAP` `OTRO` | sí | Atrapados, urgencia médica, incendio, deslizamiento, inundación, fuga de gas, vía afectada, desaparecido u otro |
| 4 | personas | entero ≥ 0 | sí | Personas afectadas estimadas |
| 5 | banderas | 3 dígitos `0`/`1` | sí | Atrapados, heridos, niños o adultos mayores |
| 6 | geohash | 6 a 9 caracteres, o vacío | no | Zona del reportante; el largo dice la precisión del GPS |
| 7 | hora_unix | entero en segundos | sí | Hora de creación en el celular |
| 8 | texto | texto libre | no | Puede contener `|`: todo lo que sigue al campo 7 es texto |

### Por qué este formato: el menor número de bytes

Las bases preguntan cómo enviar el reporte con el menor número posible de bytes (Escenario 1,
pregunta 2). Medido sobre los ejemplos del contrato:

| Mensaje | Bytes |
|---------|-------|
| Sin texto (`SARD1|c0d1-0003|P4|VIA|0|000|d2fkc7|1762481300|`) | 47 |
| Típico, con una frase (`…|ATRAP|3|101|d2fkcd|1762481000|edificio colapsado calle 23`) | 76 |
| Sin GPS | 68 |
| Texto largo (una frase de 80 caracteres) | 136 |
| Acuse (`SACK|a3f9-0042`) | 14 |

- Los datos estructurados ocupan unos 45 bytes; el resto es texto opcional.
- bitchat parte en fragmentos lo que pasa de 512 bytes. Un reporte típico cabe en un solo paquete,
  que llega entero o no llega, sin reensamblar.
- El geohash da la ubicación en 6 a 9 caracteres en lugar de dos números decimales, y su largo hace
  de radio de incertidumbre: un GPS impreciso manda menos caracteres y el mensaje nunca aparenta
  saber más de lo que sabe.

| Precisión del GPS (`Location.getAccuracy()`) | Caracteres | Zona que ve el coordinador |
|----------------------------------------------|------------|----------------------------|
| hasta 5 m | 9 | ~5 × 5 m |
| hasta 20 m | 8 | ~38 × 19 m |
| hasta 75 m | 7 | ~150 × 150 m |
| más de 75 m, o sin GPS | 6, o vacío | ~1,2 × 0,6 km, o sin ubicación |

## 2. Transporte

| Tramo | Cómo viaja |
|-------|-----------|
| Celular → celular | Mensaje público de la malla Bluetooth LE de bitchat: difusión a todos los vecinos, hasta 7 saltos. La app lo reconoce por la cabecera y no lo muestra en el chat. Un iPhone con el bitchat oficial lo reenvía sin entenderlo |
| Pasarela → central | `POST /reportes` por HTTPS con todos los pendientes en un lote: `{"mensajes": [...], "pasarela_id": "..."}` |
| Central → pasarela | La respuesta trae `{"sack": ["SACK|<id>", ...], "rechazados": [...]}` |
| Pasarela → malla | Cada `SACK` sale como mensaje público y vuelve al reportante por los relevos |
| App web → central | Igual que una pasarela, con `pasarela_id` = `web-<dispositivo>`. Sin internet, «Copiar para bitchat» deja el SARD1 listo para pegarlo en el chat público y entrar a la malla |

## 3. Cola, reintentos y vencimiento

Cada celular (reportante y cada relevo) tiene su propia cola, guardada en el almacenamiento del
celular para que sobreviva a un reinicio.

| Regla | Qué hace | Por qué |
|-------|----------|---------|
| Orden | P1 y P2 primero; dentro de cada prioridad, la `hora_unix` más antigua | Con la ventana de comunicación corta, lo crítico sale primero (Reto 2) |
| Sin descarte | P3 y P4 esperan su turno, nunca se descartan | Límite de la Tabla 3 de las bases para el agente de comunicación |
| Reintentos | Espera creciente hasta el `SACK`: 2, 4, 8, 16, 32 s y luego 60 s fijo, con ±20 % al azar | El azar evita que todos los celulares reintenten a la vez |
| Vencimiento | A los 600 s de la `hora_unix` (unos 14 intentos), el reporte queda «no entregado» y deja de reintentar. Nunca se borra | En la simulación, los celulares aislados se apagaban por batería reintentando para siempre (pruebas, hallazgo 2) |
| Reactivación | Un reporte vencido empieza una ronda nueva (la espera vuelve a 2 s) cuando aparece un vecino nuevo en la malla, o en la app web cuando vuelve internet; la ronda vence a los 600 s de reactivarse | Un camino nuevo puede llegar a la pasarela |
| Mal formado | Si la central lo rechaza, no se reintenta sin corregirlo | Reintentarlo no cambia el resultado |

**El riesgo de aplazar un mensaje** (las bases piden justificarlo): un P4 espera más con la cola
llena y, mientras espera, el celular que lo guarda puede apagarse. En la prueba E3 llegó el 95,3 %
de los P4 con prioridad contra el 97,6 % en orden de llegada, a cambio de que un P1 llegue 5 veces
más rápido. Ninguno se descartó por la cola; los que no llegaron se perdieron con la batería.

## 4. Confirmaciones

`SACK|<id>` dice: «la central registró este reporte». Se da apenas el reporte queda guardado en las
dos centrales, antes de que lo procesen los agentes. Confirma la entrega, no la atención.

1. La central valida el mensaje y lo registra como `reporte_recibido`.
2. Le entrega ese evento a la otra central (`POST /eventos`) y espera hasta 1 s. Así, un reporte
   confirmado está en las dos aunque la primera caiga enseguida. Si la otra no responde a tiempo,
   el `SACK` sale igual y la copia llega con la sincronización.
3. El `SACK` vuelve en la respuesta HTTP y la pasarela lo difunde por la malla.
4. Cada relevo que lo ve deja de reenviar ese reporte; el reportante lo marca «entregado».
5. Si a un relevo le llega un reporte ya confirmado, no lo encola y repite el `SACK` a quien se lo
   mandó, que no se había enterado.

## 5. Prioridad en el celular

Gana la primera fila que se cumple, de arriba abajo. Solo reglas, sin red ni modelos (ADR 0004):

| Prioridad | Cuándo |
|-----------|--------|
| P1 | Atrapados marcado, o el texto tiene una palabra crítica (`contracts/palabras-criticas.txt`) |
| P2 | Heridos, o niños o adultos mayores |
| P3 | Una o más personas afectadas |
| P4 | Ninguna persona afectada |

La central puede subirla con sus agentes, nunca bajarla (ADR 0005).

## 6. Deduplicación

El mismo reporte se copia por diseño (difusión, reintentos, varias pasarelas). Se deduplica en tres
niveles, y ninguno borra evidencia:

| Nivel | Qué se repite | Cómo se resuelve |
|-------|---------------|------------------|
| Malla | Las copias idénticas que llegan por varios vecinos y reintentos | Cada celular descarta los repetidos por `id`. Los SARD1 no pasan por el filtro de spam de bitchat, que escondía los reintentos idénticos |
| Central | El mismo `id` por varias pasarelas o reintentos | Se acepta una vez (índice único en la base); el duplicado recibe `SACK` y queda como `reporte_duplicado`, que cuenta como ruta, no como otra fuente |
| Incidente | Reportes distintos del mismo suceso (varias personas reportando lo mismo) | El agente de correlación los agrupa en un incidente sin fusionarlos; un vínculo dudoso se muestra como posible y no se hace ([entregable 4](04-fichas-agentes.md)) |

En la prueba E4, con 3 pasarelas llegan 11,4 copias duplicadas por corrida y la central registra
exactamente un reporte por id, en la A y en la B.

## 7. Estrategia de sincronización

| Entre | Cómo | Qué pasa si se corta |
|-------|------|----------------------|
| Celular y celular | Difusión con reintentos hasta el `SACK` | Cada uno guarda su copia; cualquiera que alcance una pasarela lo entrega |
| Pasarela y centrales | Antes de subir, `GET /salud` de la A con 3 s de límite; si no responde, sube a la B. Si la A responde pero falla al recibir, también prueba la B | Las dos aceptan los mismos mensajes y devuelven el mismo `SACK` |
| Central y central | Cada segundo, cada una pide a la otra `GET /eventos?desde_seq=` y une los eventos a su registro por `id`; en las dos direcciones. Los reportes nuevos, además, se entregan antes del `SACK` | Al volver, la que estuvo caída pide desde su último `seq` y se pone al día |

**Por qué la unión no tiene conflictos.** El registro de eventos solo agrega (ADR 0003): ningún
evento se modifica ni se borra. Unir dos registros es unir dos conjuntos por `id` (un G-Set, el
CRDT más simple), y el resultado no depende del orden ni de cuántas veces se repita. Los ids de
incidente son deterministas (`inc-<id del primer reporte>`), así que las dos centrales nombran
igual el mismo incidente. Si las dos clasificaron distinto el mismo reporte mientras estuvieron
aisladas, se conservan las dos versiones, el incidente toma la prioridad más alta y lo marca en
`discrepancias_entre_centrales` para el coordinador.

**Quién procesa.** Las dos centrales tienen agentes, pero los de la B esperan mientras la A
responda a `/salud`, para no competir por los mismos eventos. Si la A cae, la B procesa; cuando la
A vuelve, trae lo que hizo la B y retoma. En la prueba E5, con la A apagada en plena carga, se
entregaron 60 de 60 reportes, 0 perdidos.

## 8. API de la central

| Método y ruta | Quién la usa | Para qué |
|---------------|--------------|----------|
| `POST /reportes` | Pasarela, app web, simulador | Subir SARD1 y recibir los `SACK` |
| `GET /salud` | Pasarela, app web, tablero, la otra central | `{"estado":"ok","central":"A","jev":"ok"}` |
| `GET /incidentes` | Tablero | Incidentes ordenados con evidencia, incertidumbre y propuesta |
| `POST /incidentes/{id}/aprobacion` | Tablero | El coordinador aprueba o rechaza la propuesta vigente |
| `GET /rechazados` | Tablero | Mensajes que no cumplieron el protocolo, para que nada quede invisible |
| `GET /recursos`, `POST /recursos/unidades`, `POST /recursos/unidades/{matricula}/estado` | Entidades | Unidades por recurso, como en el formulario SCI-211 (ADR 0006) |
| `GET /eventos`, `POST /eventos` | La otra central | Sincronización |

Entradas, salidas y errores de cada una: `contracts/api-central.md`.

## 9. Por definir

- **Longitud máxima del texto y del mensaje completo.** Se fija midiendo la cabecera con los
  celulares, para que un reporte nunca pase de 512 bytes y no se fragmente. Hoy no hay recorte: un
  mensaje más largo se fragmenta y bitchat lo reensambla con un plazo de 30 s.
- **Antigüedad máxima del GPS** para usar una posición en un reporte.
- **Autenticación** de la API y entre centrales (`docs/riesgos.md`).
