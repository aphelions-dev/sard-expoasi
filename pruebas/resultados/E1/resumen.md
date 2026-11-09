# E1 · Pérdida de paquetes

Malla base (30 celulares en 150 m, alcance 50 m) con pérdida por salto creciente.

10 semillas por caso (promedio; peor caso entre paréntesis). Parámetros completos en `casos.json`; se reproduce con `python -m simulador escenarios E1`.

| Caso | Entrega (peor) | SACK al reportante | Saltos | Duplicados | Con camino a pasarela | Apagados |
|---|---|---|---|---|---|---|
| pérdida 0 % | 99.2% (92.5%) | 99.2% | 2.61 | 0 | 29.9 de 30 | 0 |
| pérdida 10 % | 99.8% (97.5%) | 99.8% | 2.71 | 0 | 29.9 de 30 | 0 |
| pérdida 30 % | 99.5% (95.0%) | 99.5% | 2.99 | 0 | 29.9 de 30 | 0 |
| pérdida 50 % | 99.8% (97.5%) | 99.8% | 3.69 | 0 | 29.9 de 30 | 0 |

Latencia hasta la central, en segundos: mediana promedio (p95 en el peor caso).

| Caso | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| pérdida 0 % | 2.5 (6) · 106/107 | 2.5 (6) · 57/57 | 2.3 (7) · 140/142 | 2.8 (6) · 94/94 |
| pérdida 10 % | 2.7 (7) · 119/119 | 2.7 (6) · 58/58 | 2.7 (6) · 142/143 | 2.9 (7) · 80/80 |
| pérdida 30 % | 3.1 (10) · 121/121 | 2.7 (10) · 61/61 | 3.3 (9) · 127/128 | 2.9 (7) · 89/90 |
| pérdida 50 % | 3.9 (25) · 116/116 | 4.2 (11) · 58/58 | 4.2 (23) · 148/148 | 4.2 (14) · 77/78 |

En cada celda de latencia, después del punto: entregados/creados sumando las semillas.
