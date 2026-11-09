# E3 · Prioridad con la cola llena

200 reportes en 60 s y 1 mensaje/s por celular: con prioridad y, para comparar, en orden de llegada.

10 semillas por caso (promedio; peor caso entre paréntesis). Parámetros completos en `casos.json`; se reproduce con `python -m simulador escenarios E3`.

| Caso | Entrega (peor) | SACK al reportante | Saltos | Duplicados | Con camino a pasarela | Apagados |
|---|---|---|---|---|---|---|
| con prioridad | 98.8% (95.5%) | 98.4% | 2.77 | 0 | 29.9 de 30 | 5.9 |
| orden de llegada | 98.4% (95.5%) | 98.0% | 2.81 | 0 | 29.9 de 30 | 6.3 |

Latencia hasta la central, en segundos: mediana promedio (p95 en el peor caso).

| Caso | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| con prioridad | 5.4 (20) · 562/564 | 13.8 (57) · 281/284 | 42.4 (102) · 722/722 | 74.6 (155) · 410/430 |
| orden de llegada | 26.5 (134) · 596/605 | 28.1 (127) · 285/286 | 29.1 (137) · 721/734 | 25.3 (148) · 366/375 |

En cada celda de latencia, después del punto: entregados/creados sumando las semillas.
