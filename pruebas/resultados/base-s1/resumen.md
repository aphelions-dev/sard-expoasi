# Corrida `base-s1`

Semilla 1 · 30 celulares (1 pasarela) en 150 m × 150 m · alcance 50 m · pérdida 10% · 40 reportes

| Métrica | Valor |
|---|---|
| Tasa de entrega a la central | 100.0% |
| Confirmados al reportante (SACK de vuelta) | 40 de 40 |
| Saltos promedio | 2.77 |
| Llegadas duplicadas a la central | 0 |
| Reportes creados por id en la central | 1 |
| Vencidos (no entregados) | 0 |
| Celulares apagados por batería | 0 de 30 |
| Celulares sin ningún vecino | 0 |
| Celulares con camino a una pasarela al empezar | 30 de 30 |
| Mensajes emitidos (reportes / SACK) | 1008 / 1192 |
| Segundos simulados | 600 |

| Prioridad | Creados | Entregados | Latencia p50 (s) | p95 (s) | Máx (s) |
|---|---|---|---|---|---|
| P1 | 13 | 13 | 2 | 4 | 4 |
| P2 | 11 | 11 | 2 | 4 | 4 |
| P3 | 8 | 8 | 3 | 5 | 5 |
| P4 | 8 | 8 | 3 | 5 | 5 |

Se reproduce con los parámetros de `parametros.json` (`python -m simulador correr --desde ...`).
