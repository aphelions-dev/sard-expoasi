# Protocolo SARD1

Único punto de unión entre la app (P1), la central (P2) y el tablero/simulador (P3).
Cualquier cambio se propone en una rama `contrato/<descripcion>` y lo aprueban los tres.

## Formato

```
SARD1|<id>|<prioridad>|<tipo>|<personas>|<banderas>|<geohash>|<hora_unix>|<texto>
SACK|<id>
```

Ejemplo:

```
SARD1|a3f9-0042|P1|ATRAP|3|101|d2fkcd|1762481000|edificio colapsado calle 23
```

## Campos del reporte

| # | Campo | Formato | Obligatorio | Descripción |
|---|-------|---------|-------------|-------------|
| 0 | cabecera | `SARD1` literal | sí | Versión del protocolo. |
| 1 | id | `<disp>-<contador>` | sí | ID corto del dispositivo + contador local. Único por reporte. |
| 2 | prioridad | `P1`…`P4` | sí | P1 crítica, P4 baja. La calculan las reglas en el celular. |
| 3 | tipo | `ATRAP` `MEDIC` `FUEGO` `VIA` `DESAP` `OTRO` | sí | Tipo de emergencia. |
| 4 | personas | entero ≥ 0 | sí | Personas afectadas estimadas. |
| 5 | banderas | 3 dígitos `0`/`1` | sí | Posición 1: atrapados. 2: heridos. 3: niños o adultos mayores. |
| 6 | geohash | 6 a 9 caracteres, o vacío | no | Zona del reportante. El largo dice la precisión (ver «Ubicación»). Vacío si no hay GPS (`\|\|` seguidos). |
| 7 | hora_unix | entero (segundos) | sí | Hora de creación en el celular. |
| 8 | texto | texto libre | no | Opcional y recortado. Puede contener `\|`: todo lo que sigue al separador del campo 7 es texto. Longitud máxima: **por definir**. |

## Ubicación

El geohash es tan largo como lo permite la precisión del GPS, para que el mensaje nunca aparente
saber más de lo que sabe. Es la idea de AML (ETSI TS 103 625), que manda latitud, longitud y un
radio de incertidumbre; aquí el largo del geohash cumple el papel del radio, sin agregar un campo.

La app toma el radio de `Location.getAccuracy()` de Android (metros, 68 % de confianza) y elige:

| Radio de precisión | Caracteres | Zona que ve el coordinador |
|--------------------|------------|----------------------------|
| hasta 5 m | 9 | ~5 × 5 m |
| hasta 20 m | 8 | ~38 × 19 m |
| hasta 75 m | 7 | ~150 × 150 m |
| más de 75 m | 6 | ~1,2 × 0,6 km |

Con 6 caracteres un mensaje es igual que antes de esta regla. La central acepta de 6 a 9 y el
tablero dibuja la zona del tamaño que llegó: lo preciso casi como un punto, lo impreciso como un
área.

## Acuse

`SACK|<id>`: la central confirma que recibió y registró el reporte `<id>`. Viaja de vuelta por la
pasarela y la malla hasta el reportante. Antes de darlo, la central le entrega el reporte a la otra
(`POST /eventos`), salvo que la otra no responda en 1 s.

## Reglas

1. Reenviar primero P1/P2, sin descartar nunca P3/P4.
2. Reintentar con espera creciente hasta recibir `SACK`: 2, 4, 8, 16, 32 s y luego 60 s fijo, con
   ±20 % al azar para que los celulares no reintenten todos a la vez.
3. La central acepta cada `id` una sola vez; un duplicado recibe `SACK` pero no crea otro reporte.
4. Ordenar por `hora_unix` del campo, no por la hora de llegada.
5. Un reporte vence a los 600 s (10 min) de su `hora_unix`, en el reportante y en cada relevo
   (unos 14 intentos). Vencido, queda marcado como "no entregado" y se deja de reintentar, pero nunca
   se borra. Se reactiva con una ronda nueva de reintentos (la espera vuelve a 2 s) cuando el
   celular ve un vecino nuevo en la malla.
6. Un mensaje mal formado no recibe `SACK`: la central lo rechaza con sus motivos y lo registra como
   `reporte_rechazado`. El emisor no debe reintentarlo sin corregirlo.

## Palabras críticas

La lista vive en `contracts/palabras-criticas.txt`, con la regla de comparación al inicio del
archivo. La app y la central leen ese mismo archivo: un reporte que contenga una de ellas es P1
y ningún modelo baja esa prioridad (ADR 0005).

## Sincronización

- **Pasarela.** Antes de subir, consulta `GET /salud` de la central A; si no responde, sube a la B.
  Las dos aceptan los mismos mensajes y devuelven el mismo `SACK`.
- **Centrales.** Cada central copia cada segundo los eventos de la otra con `GET /eventos` y los une
  por id. Los reportes nuevos, además, se entregan a la otra antes del `SACK` (`POST /eventos`). Como el registro solo crece (ADR 0003), la unión no tiene conflictos, y un reporte que
  llegó a las dos se cuenta una vez. Detalle en `contracts/api-central.md` y
  `docs/fichas-agentes/resiliencia.md`.

## Por definir

- Longitud máxima de `texto` y del mensaje completo (límite de la malla, P1; se mide en #1).
- Qué tan vieja puede ser la posición del GPS para usarla en un reporte (P1).
- Cómo detecta la app un vecino nuevo para reactivar un reporte vencido (regla 5; se confirma en
  #1 con bitchat-android).
