# E2 · Densidad de malla

Terreno de 250 m × 250 m, pérdida 10 %: cuántos celulares y con qué alcance.

10 semillas por caso (promedio; peor caso entre paréntesis). Parámetros completos en `casos.json`; se reproduce con `python -m simulador escenarios E2`.

| Caso | Entrega (peor) | SACK al reportante | Saltos | Duplicados | Con camino a pasarela | Apagados |
|---|---|---|---|---|---|---|
| 15 celulares · 30 m | 3.8% (0.0%) | 3.8% | 1.0 | 0 | 1.7 de 15 | 1 |
| 15 celulares · 50 m | 14.5% (0.0%) | 14.5% | 1.2 | 0 | 3.1 de 15 | 3.1 |
| 15 celulares · 100 m | 96.0% (75.0%) | 96.0% | 2.24 | 0 | 14.6 de 15 | 0 |
| 30 celulares · 30 m | 1.2% (0.0%) | 1.2% | 1.17 | 0 | 1.8 de 30 | 2 |
| 30 celulares · 50 m | 26.2% (2.5%) | 26.2% | 2.43 | 0 | 8.9 de 30 | 9.9 |
| 30 celulares · 100 m | 100.0% (100.0%) | 100.0% | 2.04 | 0 | 30 de 30 | 0 |
| 60 celulares · 30 m | 16.2% (0.0%) | 16.2% | 4.52 | 0 | 10 de 60 | 4 |
| 60 celulares · 50 m | 97.8% (87.5%) | 97.8% | 4.86 | 0 | 58.6 de 60 | 0.3 |
| 60 celulares · 100 m | 100.0% (100.0%) | 100.0% | 1.93 | 0 | 60 de 60 | 0 |

Latencia hasta la central, en segundos: mediana promedio (p95 en el peor caso).

| Caso | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| 15 celulares · 30 m | 1 (1) · 4/122 | 1 (1) · 2/103 | 1 (4) · 7/105 | 2.5 (4) · 2/70 |
| 15 celulares · 50 m | 1.22 (8) · 19/123 | 1 (2) · 9/84 | 1 (3) · 16/98 | 1.12 (3) · 14/95 |
| 15 celulares · 100 m | 2.3 (9) · 116/119 | 2.2 (9) · 95/99 | 2.3 (7) · 97/101 | 2.2 (7) · 76/81 |
| 30 celulares · 30 m | 1 (1) · 1/111 | 1 (1) · 1/109 | 1 (1) · 1/106 | 1.5 (2) · 2/74 |
| 30 celulares · 50 m | 2.62 (12) · 29/119 | 2.56 (10) · 25/93 | 2.5 (9) · 31/128 | 3.57 (8) · 20/60 |
| 30 celulares · 100 m | 2 (5) · 129/129 | 2.1 (4) · 90/90 | 2.2 (4) · 109/109 | 2 (4) · 72/72 |
| 60 celulares · 30 m | 2.6 (12) · 16/113 | 4.2 (13) · 18/111 | 7.8 (13) · 16/94 | 6.75 (17) · 15/82 |
| 60 celulares · 50 m | 4.8 (16) · 116/118 | 4.6 (17) · 91/95 | 4.7 (20) · 105/106 | 5 (19) · 79/81 |
| 60 celulares · 100 m | 1.8 (4) · 133/133 | 2 (4) · 82/82 | 2 (4) · 106/106 | 1.9 (4) · 79/79 |

En cada celda de latencia, después del punto: entregados/creados sumando las semillas.
