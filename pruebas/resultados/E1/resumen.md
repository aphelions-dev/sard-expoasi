# E1 · Pérdida de paquetes

Malla base (30 celulares en 150 m, alcance 50 m) con pérdida por salto creciente.

10 semillas por caso (promedio; peor caso entre paréntesis). Parámetros completos en `casos.json`; se reproduce con `python -m simulador escenarios E1`.

| Caso | Entrega (peor) | SACK al reportante | Saltos | Duplicados | Con camino a pasarela | Apagados |
|---|---|---|---|---|---|---|
| pérdida 0 % | 99.2% (92.5%) | 99.2% | 2.59 | 0 | 29.9 de 30 | 0 |
| pérdida 10 % | 99.8% (97.5%) | 99.8% | 2.79 | 0 | 29.9 de 30 | 0 |
| pérdida 30 % | 99.8% (97.5%) | 99.8% | 3.02 | 0 | 29.9 de 30 | 0 |
| pérdida 50 % | 99.8% (97.5%) | 99.8% | 3.62 | 0 | 29.9 de 30 | 0 |

Latencia hasta la central, en segundos: mediana promedio (p95 en el peor caso).

| Caso | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| pérdida 0 % | 2.7 (7) · 120/121 | 2.4 (7) · 90/91 | 2.5 (6) · 105/106 | 2.6 (7) · 82/82 |
| pérdida 10 % | 2.8 (7) · 118/118 | 2.4 (6) · 108/109 | 3 (8) · 93/93 | 2.7 (7) · 80/80 |
| pérdida 30 % | 3.2 (11) · 124/124 | 3.3 (11) · 110/110 | 3 (17) · 86/86 | 2.8 (7) · 79/80 |
| pérdida 50 % | 3.8 (63) · 121/121 | 4.1 (23) · 102/102 | 4.4 (15) · 95/95 | 4.2 (14) · 81/82 |

En cada celda de latencia, después del punto: entregados/creados sumando las semillas.
