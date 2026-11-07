# E4 · Duplicados

El mismo reporte llega por varias pasarelas.

10 semillas por caso (promedio; peor caso entre paréntesis). Parámetros completos en `casos.json`; se reproduce con `python -m simulador escenarios E4`.

| Caso | Entrega (peor) | SACK al reportante | Saltos | Duplicados | Con camino a pasarela | Apagados |
|---|---|---|---|---|---|---|
| 1 pasarela | 99.8% (97.5%) | 99.8% | 2.79 | 0 | 29.9 de 30 | 0 |
| 2 pasarelas | 99.5% (95.0%) | 99.5% | 2.1 | 8.4 | 29.9 de 30 | 0 |
| 3 pasarelas | 99.8% (97.5%) | 99.8% | 1.64 | 11.4 | 29.9 de 30 | 0 |

Latencia hasta la central, en segundos: mediana promedio (p95 en el peor caso).

| Caso | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| 1 pasarela | 2.8 (7) · 118/118 | 2.4 (6) · 108/109 | 3 (8) · 93/93 | 2.7 (7) · 80/80 |
| 2 pasarelas | 2.3 (6) · 123/124 | 2 (5) · 106/106 | 1.9 (8) · 98/99 | 1.7 (5) · 71/71 |
| 3 pasarelas | 1.5 (5) · 119/119 | 1.6 (5) · 116/116 | 1.7 (4) · 80/80 | 1.7 (4) · 84/85 |

En cada celda de latencia, después del punto: entregados/creados sumando las semillas.
