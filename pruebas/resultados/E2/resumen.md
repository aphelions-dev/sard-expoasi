# E2 · Densidad de malla

Terreno de 250 m × 250 m, pérdida 10 %: cuántos celulares y con qué alcance.

10 semillas por caso (promedio; peor caso entre paréntesis). Parámetros completos en `casos.json`; se reproduce con `python -m simulador escenarios E2`.

| Caso | Entrega (peor) | SACK al reportante | Saltos | Duplicados | Con camino a pasarela | Apagados |
|---|---|---|---|---|---|---|
| 15 celulares · 30 m | 4.2% (0.0%) | 4.2% | 1.0 | 0 | 1.7 de 15 | 0 |
| 15 celulares · 50 m | 14.0% (0.0%) | 14.0% | 1.2 | 0 | 3.1 de 15 | 0.8 |
| 15 celulares · 100 m | 96.0% (75.0%) | 96.0% | 2.21 | 0 | 14.6 de 15 | 0 |
| 30 celulares · 30 m | 1.5% (0.0%) | 1.5% | 1.44 | 0 | 1.8 de 30 | 0.1 |
| 30 celulares · 50 m | 25.2% (5.0%) | 25.2% | 2.4 | 0 | 8.9 de 30 | 3.3 |
| 30 celulares · 100 m | 100.0% (100.0%) | 100.0% | 2.06 | 0 | 30 de 30 | 0 |
| 60 celulares · 30 m | 16.0% (0.0%) | 16.0% | 3.17 | 0 | 10 de 60 | 0.4 |
| 60 celulares · 50 m | 98.0% (87.5%) | 98.0% | 4.81 | 0 | 58.6 de 60 | 0 |
| 60 celulares · 100 m | 100.0% (100.0%) | 100.0% | 1.93 | 0 | 60 de 60 | 0 |

Latencia hasta la central, en segundos: mediana promedio (p95 en el peor caso).

| Caso | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| 15 celulares · 30 m | 1 (1) · 6/107 | 1 (1) · 2/64 | 1 (4) · 7/156 | 2.5 (4) · 2/73 |
| 15 celulares · 50 m | 1.38 (8) · 15/106 | 1.25 (2) · 8/65 | 1.33 (3) · 16/133 | 1.12 (3) · 17/96 |
| 15 celulares · 100 m | 1.8 (9) · 115/118 | 2.1 (9) · 63/65 | 1.9 (7) · 135/141 | 2.1 (7) · 71/76 |
| 30 celulares · 30 m | 2.5 (4) · 2/113 | — (—) · 0/51 | 1 (2) · 2/166 | 1.5 (2) · 2/70 |
| 30 celulares · 50 m | 3.44 (12) · 26/113 | 3 (6) · 11/54 | 2.5 (8) · 42/162 | 2.12 (10) · 22/71 |
| 30 celulares · 100 m | 2.1 (4) · 123/123 | 2.2 (4) · 49/49 | 1.9 (5) · 162/162 | 1.9 (4) · 66/66 |
| 60 celulares · 30 m | 3.83 (13) · 23/124 | 7 (12) · 10/55 | 4.8 (13) · 16/144 | 4.67 (17) · 15/77 |
| 60 celulares · 50 m | 4.9 (18) · 116/118 | 4.5 (13) · 51/53 | 4.6 (17) · 151/153 | 5 (19) · 74/76 |
| 60 celulares · 100 m | 1.7 (4) · 121/121 | 1.7 (4) · 41/41 | 1.9 (4) · 154/154 | 1.9 (4) · 84/84 |

En cada celda de latencia, después del punto: entregados/creados sumando las semillas.
