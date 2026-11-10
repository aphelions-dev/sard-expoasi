# Entregable 6 · Resultados de pruebas

Bases, Tabla 4: «métricas, escenarios ejecutados, errores observados, limitaciones y resultados de
las pruebas de estrés». Y objetivo 10: «pruebas reproducibles de desconexión, pérdida de paquetes y
recuperación». Los datos crudos de cada corrida (semillas, parámetros y métricas) están en
`pruebas/resultados/`, y cómo se repite cada una, en la sección 6.

Última corrida: 9 de noviembre de 2026. E1 a E4 con el simulador de la malla; E4 (central), E5, E6
y E7 contra las centrales A y B reales, levantadas con bases nuevas. E6 con Jev (`jev-1.14.0`); E7
sin Jev.

## 1. Resultados clave

| Qué se prueba | Resultado |
|---------------|-----------|
| Caída de la central A en plena carga (E5) | **60 de 60 entregados, 0 perdidos**; la pasarela pasó a la B |
| Pérdida de la mitad de los mensajes en cada salto (E1) | **99,8 % de entrega** con los reintentos |
| Prioridad con la cola llena (E3) | **Un P1 llega 5 veces más rápido** (mediana 5,4 s contra 26,5 s), sin descartar P3/P4 |
| El mismo reporte por 3 pasarelas (E4) | **Exactamente 1 reporte por id** en la A y en la B |
| Triaje con Jev (E6) | **Recall de P1 de 100 %** (30 de 30); ninguna prioridad bajada |
| Triaje sin Jev (E7) | El triaje sigue: **100 % priorizados**, recall de P1 de 87 % y ninguna prioridad bajada |

## 2. Escenarios ejecutados

| # | Escenario | Variable | Métrica | Esperado | Resultado |
|---|-----------|----------|---------|----------|-----------|
| E1 | Pérdida de paquetes | 0, 10, 30 y 50 % por salto | Entrega, latencia | Entrega final cercana a 100 %; la latencia crece con la pérdida | **Cumple** |
| E2 | Densidad de la malla | 15, 30 y 60 celulares × alcance de 30, 50 y 100 m en 250 × 250 m | Entrega, saltos | Encontrar desde cuándo la malla se corta | **Umbral medido** |
| E3 | Prioridad | 200 reportes en 60 s con la cola llena | Latencia por prioridad | P1/P2 llegan antes y P3/P4 también llegan | **Cumple**, con un costo en P4 |
| E4 | Duplicados | Mismo id por 1, 2 y 3 pasarelas | Reportes por id en la central | Exactamente 1 por id | **Cumple** (simulador y central real) |
| E5 | Caída de la central | Apagar la A entera en el segundo 120 de la carga | Reportes perdidos | 0 perdidos; la pasarela pasa a la B | **Cumple** |
| E6 | Triaje con Jev | 100 reportes etiquetados a mano | Exactitud, subtriaje, recall de P1 | Ningún P1 bajado | **Cumple** |
| E7 | Jev caído | Los mismos 100, sin Jev | Disponibilidad, exactitud | El triaje sigue funcionando | **Cumple** |

Cada caso del simulador se corre con 10 semillas y se reporta el promedio y el peor caso. El
modelo de la malla: celulares quietos, alcance fijo, pérdida independiente por mensaje, consumo de
batería por mensaje emitido (`simulador/README.md`).

## 3. Métricas

### E1 · Pérdida de paquetes

30 celulares en 150 × 150 m, alcance 50 m, una pasarela.

| Pérdida por salto | Entrega (peor caso) | Saltos | Mediana de P1 (p95 en el peor caso) |
|-------------------|---------------------|--------|-------------------------------------|
| 0 % | 99,2 % (92,5 %) | 2,61 | 2,5 s (6 s) |
| 10 % | 99,8 % (97,5 %) | 2,71 | 2,7 s (7 s) |
| 30 % | 99,5 % (95,0 %) | 2,99 | 3,1 s (10 s) |
| 50 % | 99,8 % (97,5 %) | 3,69 | 3,9 s (25 s) |

Lo no entregado salió siempre del único celular aislado de una semilla, no de la pérdida.

### E2 · Densidad de la malla

| Celulares | Alcance 30 m | Alcance 50 m | Alcance 100 m |
|-----------|--------------|--------------|---------------|
| 15 | 4,2 % | 14,0 % | 96,0 % |
| 30 | 1,5 % | 25,2 % | 100 % |
| 60 | 16,0 % | 98,0 % | 100 % |

Entrega promedio. Con 30 celulares a 50 m, solo 8,9 de 30 tienen camino a una pasarela: la
densidad decide más que la pérdida.

### E3 · Prioridad con la cola llena

| Orden de la cola | Entrega | P1 | P2 | P3 | P4 |
|------------------|---------|----|----|----|----|
| Por prioridad | 98,8 % | 5,4 s | 13,8 s | 42,4 s | 74,6 s |
| Por llegada (para comparar) | 98,4 % | 26,5 s | 28,1 s | 29,1 s | 25,3 s |

Mediana de latencia hasta la central. Llegó el 95,3 % de los P4 con prioridad contra el 97,6 % por
llegada.

### E4 · Duplicados

| Pasarelas | Copias duplicadas por corrida | Reportes por id en la central |
|-----------|-------------------------------|-------------------------------|
| 1 | 0 | 1 |
| 2 | 7,8 | 1 |
| 3 | 11,2 | 1 |

Contra la central real: 20 reportes enviados 70 veces (por 3 pasarelas a la A y la mitad también a
la B), 70 `SACK` y exactamente un `reporte_recibido` por id en las dos centrales.

### E5 · Caída de la central A

| Métrica | Valor |
|---------|-------|
| Entregados | 60 de 60 |
| Perdidos | 0 |
| Subidas a la A / a la B | 22 / 32 |
| Subidas que fallaron y se reintentaron | 8 |
| Confirmados por la A que faltaban en la B mientras la A estaba caída | 0 |
| Latencia de P1: mediana, p95 | 3 s, 6 s |

### E6 y E7 · Triaje, con Jev y sin Jev

Los 100 reportes sintéticos de `datos/sinteticos/`, etiquetados a mano (30 son P1). Se mandan dos
veces: con **formulario neutro** (el celular manda P4 y solo las banderas, para medir lo que agrega
la central) y con la **prioridad del celular** (la que calculan sus reglas, para medir el sistema
entero).

| Métrica | Neutro, sin Jev (E7) | Neutro, con Jev (E6) | Celular, sin Jev (E7) | Celular, con Jev (E6) |
|---------|---------------------|----------------------|-----------------------|-----------------------|
| Priorizados | 100 % | 100 % | 100 % | 100 % |
| Exactas | 53 | 60 | 55 | 62 |
| Subtriaje (por debajo de la etiqueta) | 43 | 28 | 21 | 7 |
| Sobretriaje (por encima) | 4 | 12 | 24 | 31 |
| Recall de P1 | 87 % | **100 %** | 87 % | **100 %** |
| Prioridades bajadas respecto al celular | — | — | 0 | 0 |
| Segundos hasta priorizar los 100 | 2,2 | 20,3 | 2,3 | 18,5 |

- **Jev rescata los P1 que las reglas no ven.** Sin Jev quedan por debajo 4 P1 sin ninguna palabra
  crítica («mi mamá quedó debajo de la placa del techo», «colapsó el puente peatonal y hay gente
  abajo», «la casa se derrumbó con la familia adentro», «hay alguien colgado del balcón»). Con Jev
  los 30 P1 quedan en P1.
- **El error que se acepta es el sobretriaje.** Con el sistema entero, Jev baja el subtriaje de 21 a
  7 y sube el sobretriaje de 24 a 31. En triaje de campo se acepta hasta 35 % de sobretriaje frente
  a 5 % de subtriaje (guía de triaje de campo de 2021); el sobretriaje queda dentro, el subtriaje
  (7 %, ninguno de ellos P1) todavía no.
- **Jev cuesta tiempo, no disponibilidad.** Priorizar 100 reportes pasa de 2 s a unos 20 s; si Jev
  cae, el sistema vuelve a 2 s con reglas.

### Sesgo por forma de escribir

El mismo suceso escrito de cinco formas (cuidado, con faltas, coloquial, corto y largo), 40
reportes, con Jev (`central/sesgo/resultados.md`, 7 de noviembre de 2026):

| Métrica | Valor |
|---------|-------|
| Casos con la misma prioridad en todas las variantes | 7 de 8 |
| Subtriaje | 0 de 40 |
| Sobretriaje | 1 de 40 (un «sin novedad» largo subió a P1) |

Sin Jev, las reglas solo ven palabras críticas escritas tal cual: de los 5 casos P1, solo
«atrapados» sale P1 en la mayoría de sus variantes, y los otros 4 quedan en P4 (salvo la variante
corta de «no respira»). Por eso, sin Jev pesa lo que el reportante marca en el formulario.

## 4. Pruebas de estrés

| Prueba | Carga | Resultado |
|--------|-------|-----------|
| Cola llena (E3) | 200 reportes en 60 s, 1 mensaje/s por celular, 10 semillas | Entrega 98,8 % (peor 95,5 %); ningún reporte descartado por la cola. Los que faltan se fueron con celulares sin batería (5,9 de 30) |
| Pérdida extrema (E1) | 50 % de pérdida por salto | Entrega 99,8 %; el p95 de P1 en el peor caso sube a 25 s |
| Caída en carga (E5) | 60 reportes en 300 s con la A apagada en el segundo 120 | 60/60 entregados, 0 perdidos |
| Recorrido de la demo | Ráfaga de 20 reportes en ~20 s con la A apagada a mitad de la ráfaga | 23/23 entregados y confirmados; 11 subidas a la B; A y B coinciden al volver la A |
| Triaje en lote (E6 y E7) | 100 reportes en un solo `POST` | 100 % priorizados: 2,2 s sin Jev, 20,3 s con Jev |

## 5. Errores observados

Lo que las pruebas encontraron en el sistema y cómo quedó:

| Error | Dónde | Estado |
|-------|-------|--------|
| «gas» se buscaba como fragmento: «¿llegaste bien?» salía P1 | Palabras críticas | Resuelto (#69) |
| Las reglas no detectaban variantes («sangrar mucho», «atrapda», «aplastada») | Palabras críticas | Resuelto (#69) |
| Las reglas no entienden negaciones («no hay carros atrapados» sale P1) | Triaje | Mitigado: se marca «posible negación» para el coordinador, sin bajar la prioridad (#70) |
| La central daba `SACK` antes de que la otra copiara el reporte: si caía justo después, 1 o 2 reportes confirmados quedaban solo en su disco | Sincronización | Resuelto: entrega a la otra antes del `SACK` (#74, #75) |
| Un celular sin camino a la pasarela reintentaba para siempre y se apagaba por batería | Cola de la app | Resuelto en el contrato: vencimiento a 600 s (#58); los apagados bajan de 9,9 a 3,3 de 30 y los mensajes emitidos un 35 % |
| Sin Jev, la correlación junta reportes distintos con el mismo geohash y tipo | Correlación | Abierto (#44) |
| `evidencia[].rutas` llega como número; el contrato dice lista de pasarelas | API de la central | Abierto (#44) |
| Los geohash de los ejemplos del contrato caían en Cali | Contrato | Resuelto (#46) |
| Railway rechaza la instrucción `VOLUME` del Dockerfile de la central | Despliegue | Resuelto en `main` (#105); falta en `dev` (#104) |

Errores de las propias herramientas de prueba, ya corregidos: la paginación de `GET /eventos` en
el script de E5 (daba 42 reportes «faltantes» que no lo estaban), una malla con la pasarela aislada
en la primera corrida base y una ráfaga del recorrido que llegaba entera a la A antes del apagón.

### Pruebas automáticas

| Parte | Comando | Pruebas | Estado el 9 de noviembre |
|-------|---------|---------|--------------------------|
| Central | `cd central && uv run pytest` | 67 | Pasan |
| Simulador | `cd simulador && uv run pytest` | 39 | Pasan |
| Tablero | `cd tablero && npm test` | 40 | Pasan |
| App web de reportes | `cd reportar && npm test` | 18 | Pasan |
| App Android (cola, pasarela, SARD1) | `cd app/bitchat-android && ./gradlew :app:testDebugUnitTest` | 15 | No corridas en esta revisión |

## 6. Cómo se repite cada prueba

```bash
cd simulador
PYTHONUTF8=1 uv run python -m simulador escenarios                              # E1 a E4 (~40 s, reproducibles por semilla)
PYTHONUTF8=1 uv run python -m simulador escenarios-central                      # E4 central, E5 y E7 (~4 min; puertos 8001 y 8002 libres)
PYTHONUTF8=1 uv run python -m simulador escenarios-central --env-file ../.env   # lo mismo, con E6 en lugar de E7 (requiere JEV_API_KEY)
PYTHONUTF8=1 uv run python -m simulador recorrido                               # el recorrido de 8 pasos de la demo
cd ../central && uv run --env-file ../.env python -m sesgo.correr               # prueba de sesgo
```

Cada corrida guarda parámetros, semillas y métricas en `pruebas/resultados/<escenario>/`.

## 7. Limitaciones

- **El simulador es un modelo.** Alcance fijo, pérdida independiente, celulares quietos y un
  consumo de batería supuesto. No reemplaza una prueba de campo. Con celulares reales se probó el
  recorrido con 3 Android (reporte sin internet, malla, pasarela, central, «entregado») y la caída de
  la central A con la pasarela pasando a la B.
- **No se mide la reactivación por vecino nuevo.** Con celulares quietos, un celular aislado nunca
  gana camino. Está cubierta por pruebas unitarias de la app (`ColaTest`).
- **E4 (central), E5, E6 y E7 dependen del reloj real** y no son reproducibles al 100 %; E5 se
  repitió el 9 de noviembre con el mismo resultado.
- **E6 depende de Jev**, un servicio externo: sus probabilidades pueden cambiar con otra versión del
  modelo. La corrida usa `jev-1.14.0`.
- **Los 100 reportes son pocos** para fijar el umbral de Jev (0,7); con los 40 de la prueba de
  sesgo, todos los umbrales entre 0,5 y 0,85 dan 0 subtriaje.
- **Subtriaje de 7 % con el sistema entero**, por encima del 5 % de referencia; ninguno es P1.
- **No se probó con iPhone** que el bitchat oficial reenvíe un SARD1 entre dos Android (ADR 0007).
- **Datos sintéticos.** Ninguna prueba usa datos de personas reales.
