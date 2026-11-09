# E4 · Duplicados

El mismo reporte llega por varias pasarelas.

10 semillas por caso (promedio; peor caso entre paréntesis). Parámetros completos en `casos.json`; se reproduce con `python -m simulador escenarios E4`.

| Caso | Entrega (peor) | SACK al reportante | Saltos | Duplicados | Con camino a pasarela | Apagados |
|---|---|---|---|---|---|---|
| 1 pasarela | 99.8% (97.5%) | 99.8% | 2.71 | 0 | 29.9 de 30 | 0 |
| 2 pasarelas | 99.5% (95.0%) | 99.5% | 2.11 | 7.8 | 29.9 de 30 | 0 |
| 3 pasarelas | 99.8% (97.5%) | 99.8% | 1.64 | 11.2 | 29.9 de 30 | 0 |

Latencia hasta la central, en segundos: mediana promedio (p95 en el peor caso).

| Caso | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| 1 pasarela | 2.7 (7) · 119/119 | 2.7 (6) · 58/58 | 2.7 (6) · 142/143 | 2.9 (7) · 80/80 |
| 2 pasarelas | 2 (6) · 109/110 | 2.2 (5) · 66/66 | 2.2 (8) · 154/155 | 1.8 (5) · 69/69 |
| 3 pasarelas | 1.3 (5) · 113/113 | 1.5 (5) · 64/64 | 1.7 (4) · 138/138 | 1.6 (4) · 84/85 |

En cada celda de latencia, después del punto: entregados/creados sumando las semillas.
