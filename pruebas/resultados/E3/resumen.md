# E3 · Prioridad con la cola llena

200 reportes en 60 s y 1 mensaje/s por celular: con prioridad y, para comparar, en orden de llegada.

10 semillas por caso (promedio; peor caso entre paréntesis). Parámetros completos en `casos.json`; se reproduce con `python -m simulador escenarios E3`.

| Caso | Entrega (peor) | SACK al reportante | Saltos | Duplicados | Con camino a pasarela | Apagados |
|---|---|---|---|---|---|---|
| con prioridad | 98.4% (95.0%) | 97.9% | 2.84 | 0 | 29.9 de 30 | 7.2 |
| orden de llegada | 98.4% (95.5%) | 98.0% | 2.81 | 0 | 29.9 de 30 | 6.8 |

Latencia hasta la central, en segundos: mediana promedio (p95 en el peor caso).

| Caso | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| con prioridad | 6.3 (24) · 589/589 | 24.6 (76) · 484/485 | 50.4 (124) · 504/511 | 77.3 (175) · 390/415 |
| orden de llegada | 25.4 (134) · 620/628 | 25.1 (132) · 479/485 | 30.6 (140) · 503/512 | 25.3 (148) · 366/375 |

En cada celda de latencia, después del punto: entregados/creados sumando las semillas.
