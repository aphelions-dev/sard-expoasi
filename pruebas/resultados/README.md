# Resultados de las pruebas (#16)

E1–E4 con el simulador y la central simulada, 10 semillas por caso (reproducibles), con los tiempos
de reintento y el vencimiento a 600 s del contrato (#58). E4 (parte central), E5 y E7 contra las
centrales A y B reales, levantadas con bases nuevas y sin Jev. Última corrida: 8 de noviembre de
2026, con la central que copia cada reporte a la otra antes del `SACK` (#74, #75) y las palabras
críticas corregidas (#69).

```bash
cd simulador
PYTHONUTF8=1 uv run python -m simulador escenarios            # E1–E4 (~40 s)
PYTHONUTF8=1 uv run python -m simulador escenarios-central    # E4 central, E5, E7 (~4 min; puertos 8001/8002 libres)
PYTHONUTF8=1 uv run python -m simulador escenarios-central --env-file ../.env   # E6 con JEV_API_KEY
```

| # | Detalle | Resultado |
|---|---------|-----------|
| E1 | [`E1/resumen.md`](E1/resumen.md) | Entrega promedio 99,2–99,8 % con 0 a 50 % de pérdida; todo lo no entregado salió del único celular aislado de una semilla. La mediana de P1 sube de 2,8 s a 3,8 s y su p95 en el peor caso de 7 s a 63 s. |
| E2 | [`E2/resumen.md`](E2/resumen.md) | En 250 m × 250 m la malla se corta por densidad: 30 celulares a 50 m entregan 26 %; 60 a 50 m, 97,8 %; a 100 m, 96–100 % desde 15 celulares. |
| E3 | [`E3/resumen.md`](E3/resumen.md) | Con la cola llena, la mediana de P1 es 6,3 s con prioridad contra 25,4 s en orden de llegada (4 veces más rápido); P4 pasa de 25 s a 77 s. |
| E4 | [`E4/resumen.md`](E4/resumen.md), [`E4/resumen-central.md`](E4/resumen-central.md) | Con 2 y 3 pasarelas llegan 8,4 y 11,4 copias duplicadas por corrida, pero la central real registra exactamente 1 `reporte_recibido` por id en la A y en la B. |
| E5 | [`E5/resumen-central.md`](E5/resumen-central.md) | Se apaga la A entera en el segundo 120 con carga en curso: 60 de 60 entregados, la pasarela sube a la B (25 subidas a la A, 30 a la B), 0 perdidos y ninguno confirmado que falte en la B mientras la A está caída. |
| E6 | — | Pendiente: necesita `JEV_API_KEY`. El comando está listo. |
| E7 | [`E7/resumen-central.md`](E7/resumen-central.md) | Sin Jev, la central prioriza los 100 en 2,2 s (disponibilidad 100 %). Con formulario neutro, 53 exactas y recall de P1 de 87 % (4 P1 sin palabra crítica quedan en P4); con la prioridad del celular, 0 bajados. |

## Hallazgos

1. **La densidad manda más que la pérdida.** Con 50 % de pérdida los reintentos igual entregan todo
   (E1), pero un celular sin camino a una pasarela no entrega nunca (E2). La métrica "celulares con
   camino a una pasarela" lo explica: en 30 celulares a 50 m, solo 8,9 de 30 lo tienen.
2. **Los celulares aislados se quedaban sin batería reintentando.** Sin vencimiento, en E2 (30
   celulares a 50 m) 9,9 de 30 se apagaban reenviando cada 60 s un reporte que nunca recibiría
   `SACK`. **Resuelto en el contrato** (#58, regla 5: el reporte vence a los 600 s sin borrarse):
   con el vencimiento, los apagados bajan a 3,3 de 30 y los mensajes emitidos un 35 % (7.183 →
   4.676); con 60 celulares a 30 m, de 4,0 a 0,6. Ninguna entrega cambia en E1–E4.
3. **La prioridad tiene un costo en P4.** En E3, P4 espera más y en ese tiempo algunos celulares que
   lo guardaban se apagan: llega el 94 % de P4 con prioridad contra el 97,6 % en orden de llegada.
   Ninguno se descarta por la cola; se pierden con la batería.
4. **La ventana de sincronización de E5 quedó cerrada.** El 7 de noviembre, si la A caía justo después
   de dar `SACK`, 1 o 2 reportes confirmados quedaban solo en su disco hasta que volvía. **Resuelto**
   (#49, con #74 y #75): la central entrega cada reporte a la otra antes del `SACK`. En la corrida del
   8 de noviembre, ningún reporte confirmado faltó en la B mientras la A estaba caída.
5. **Sin Jev, 4 de 30 P1 dependen del celular o del coordinador.** Con la lista de palabras críticas
   del 7 de noviembre eran 13 (recall de P1 de 57 %); con la corregida en #69, 4 (recall 87 %). Son
   P1 que no dicen ninguna palabra crítica («quedó debajo de la placa», «hay alguien colgado del
   balcón»; lista en `E7/resumen-central.md`). Con la prioridad que pone el celular no se pierde
   ninguno, porque la central nunca baja una prioridad.

## Pruebas de estrés

| Prueba | Carga | Resultado |
|--------|-------|-----------|
| E3, cola llena | 200 reportes en 60 s, 1 mensaje/s por celular, 10 semillas | Entrega 98,4 % (peor 95 %); mediana P1 6,3 s, P4 77 s; ningún reporte descartado por la cola, los perdidos se fueron con celulares sin batería (6,7 de 30) |
| E1, pérdida extrema | 50 % de pérdida por salto | Entrega 99,8 %; el p95 de P1 en el peor caso sube a 63 s |
| E5, caída en carga | 60 reportes en 300 s con la central A apagada en el segundo 120 | 60/60 entregados, 0 perdidos |
| Recorrido de la demo | Ráfaga de 20 reportes durante ~20 s y la central A apagada a mitad de la ráfaga (`python -m simulador recorrido`) | 23/23 entregados y confirmados; 11 subidas a la B durante la caída; A y B coinciden al volver la A |
| E7, triaje en lote | 200 reportes de una vez sin Jev | Priorizados en 2,2 s cada lote de 100 |

## Errores observados

Lo que las pruebas encontraron en el sistema, con su issue:

| Error | Dónde | Issue |
|-------|-------|-------|
| «gas» se buscaba como fragmento: «¿lle**gas**te bien?» salía P1 | Palabras críticas | #43; resuelto en #69 |
| Las reglas no detectaban variantes («sangrar mucho», «atrapda», «aplastada», «ahogando») | Palabras críticas | #43; resuelto en #69 |
| Las reglas no entienden negaciones («no hay carros atrapados» sale P1) | Triaje | #43; desde #70 se marca como posible negación, sin bajar la prioridad |
| La central daba `SACK` antes de que la otra central copiara el reporte | Central, sincronización | #49; resuelto en #74 y #75 |
| Un celular sin camino a la pasarela reintentaba para siempre y se apagaba por batería | Cola de la app | #50; resuelto en el contrato (#58, vencimiento a 600 s) |
| Sin Jev, la correlación junta reportes distintos con el mismo geohash y tipo (un ascensor y un colegio) | Correlación | Anotado en #44 |
| Los geohash de los ejemplos del contrato caían en Cali | Contrato | #46; resuelto |
| `evidencia[].rutas` llega como número; el contrato lo describe como la lista de pasarelas | API de la central | Anotado en #44 |

Errores de las propias herramientas de prueba, ya corregidos: la paginación de `GET /eventos` en el
script de E5 (daba 42 reportes "faltantes" que no lo estaban), la conexión de la malla en la primera
corrida base (área demasiado grande, la pasarela aislada) y la ráfaga del recorrido, que con las
centrales en `127.0.0.1` (#76) llegaba entera a la A antes del apagón y ya no mostraba la caída.

## Pruebas automáticas

| Parte | Comando | Pruebas |
|-------|---------|---------|
| Central (P2) | `cd central && uv run pytest` | 65 |
| Tablero | `cd tablero && npm test` | 38 |
| Simulador | `cd simulador && uv run pytest` | 24 |

## Limitaciones

- El simulador es un modelo: alcance fijo, pérdida independiente por mensaje, celulares quietos y un
  consumo de batería supuesto (`simulador/README.md`). No reemplaza la prueba con celulares.
- La reactivación de un reporte vencido al aparecer un vecino nuevo (contrato, regla 5) no se mide:
  con los celulares quietos, un celular aislado nunca gana camino. Se confirma con la app en #1.
- E4 (parte central), E5 y E7 dependen del reloj real y no son reproducibles al 100 %.
- E7 usa la central sin Jev; E6 queda pendiente de la clave.
