# Resultados de las pruebas (#16)

Corridas del 7 de noviembre de 2026. E1–E4 con el simulador y la central simulada, 10 semillas por
caso (reproducibles). E4 (parte central), E5 y E7 contra las centrales A y B reales, levantadas con
bases nuevas y sin Jev.

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
| E5 | [`E5/resumen-central.md`](E5/resumen-central.md) | Se apaga la A entera en el segundo 120 con carga en curso: 60 de 60 entregados, la pasarela sube a la B (25 subidas a la A, 31 a la B), 0 perdidos. |
| E6 | — | Pendiente: necesita `JEV_API_KEY`. El comando está listo. |
| E7 | [`E7/resumen-central.md`](E7/resumen-central.md) | Sin Jev, la central prioriza los 100 en 4,2 s (disponibilidad 100 %). Con formulario neutro, recall de P1 de 57 % (13 P1 sin palabra crítica quedan en P4); con la prioridad del celular, 0 bajados. |

## Hallazgos

1. **La densidad manda más que la pérdida.** Con 50 % de pérdida los reintentos igual entregan todo
   (E1), pero un celular sin camino a una pasarela no entrega nunca (E2). La métrica "celulares con
   camino a una pasarela" lo explica: en 30 celulares a 50 m, solo 8,9 de 30 lo tienen.
2. **Los celulares aislados se quedan sin batería reintentando.** En E2 (30 celulares a 50 m), 9,9 de
   30 se apagan: reenvían cada 60 s un reporte que nunca recibirá `SACK`. Para P1: un tope de
   reintentos o el vencimiento (hoy "por definir") ahorrarían batería sin borrar nada.
3. **La prioridad tiene un costo en P4.** En E3, P4 espera más y en ese tiempo algunos celulares que
   lo guardaban se apagan: llega el 94 % de P4 con prioridad contra el 97,6 % en orden de llegada.
   Ninguno se descarta por la cola; se pierden con la batería.
4. **Ventana de sincronización en E5.** La A da `SACK` y la B copia sus eventos cada segundo: si la A
   cae en ese segundo, 1 o 2 reportes confirmados quedan solo en el disco de la A. No se pierden (la B
   los recibe cuando la A vuelve), pero mientras tanto el coordinador no los ve y el celular ya no
   reintenta. Es de la central (P2): sincronizar antes de dar `SACK` o más seguido lo cerraría.
5. **Sin Jev, 13 de 30 P1 dependen del celular o del coordinador.** Son los P1 sin palabra crítica
   (`E7/resumen-central.md`, lista completa); con la prioridad que pone el celular no se pierde
   ninguno, porque la central nunca baja una prioridad.

## Limitaciones

- El simulador es un modelo: alcance fijo, pérdida independiente por mensaje, celulares quietos y un
  consumo de batería supuesto (`simulador/README.md`). No reemplaza la prueba con celulares.
- E4 (parte central), E5 y E7 dependen del reloj real y no son reproducibles al 100 %: el tamaño de la
  ventana del hallazgo 4 cambia entre corridas.
- E7 usa la central sin Jev; E6 queda pendiente de la clave.
