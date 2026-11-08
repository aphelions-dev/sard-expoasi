# Prueba de sesgo del triaje

Corrida del 2026-11-07 · reglas + Jev (`jev-1.14.0`) · 8 casos × 5 variantes = 40 reportes.
Formulario neutro (P4, sin banderas): la prioridad sale solo del texto. Casos en `sesgo/casos.py`; se reproduce con `python -m sesgo.correr`.

| Métrica | Valor |
|---------|-------|
| Casos con la misma prioridad en todas las variantes | 7 de 8 |
| Subtriaje (por debajo de la esperada) | 0 de 40 |
| Sobretriaje (por encima de la esperada) | 1 de 40 |
| Llamadas a Jev que fallaron | 0 de 40 |

## Prioridad final por variante

| Caso | Esperada | estandar | errores | coloquial | corto | largo | Dispersión de Jev |
|---|---|---|---|---|---|---|---|
| atrapados | P1 | P1 | P1 | P1 | P1 | P1 | 0.03 (atrapados) |
| no_respira | P1 | P1 | P1 | P1 | P1 | P1 | 0.02 (no_respira) |
| incendio | P1 | P1 | P1 | P1 | P1 | P1 | 0.13 (incendio_activo) |
| sangrado | P1 | P1 | P1 | P1 | P1 | P1 | 0.01 (sangrado_grave) |
| inconsciente | P1 | P1 | P1 | P1 | P1 | P1 | 0.04 (inconsciente) |
| herido_leve | P2 | P2 | P2 | P2 | P2 | P2 | 0.01 (herido) |
| via | P4 | P4 | P4 | P4 | P4 | P4 | 0.05 (riesgo_vital) |
| sin_novedad | P4 | P4 | P4 | P4 | P4 | P1 ↑ | 0.13 (riesgo_vital) |

↓ subtriaje, ↑ sobretriaje.

## Solo con reglas (lo que queda si Jev cae)

| Caso | estandar | errores | coloquial | corto | largo |
|---|---|---|---|---|---|
| atrapados | P1 | P1 | P4 | P1 | P1 |
| no_respira | P4 | P4 | P4 | P1 | P4 |
| incendio | P4 | P4 | P4 | P4 | P4 |
| sangrado | P4 | P4 | P4 | P4 | P4 |
| inconsciente | P4 | P4 | P4 | P4 | P4 |
| herido_leve | P4 | P4 | P4 | P4 | P4 |
| via | P4 | P4 | P4 | P4 | P4 |
| sin_novedad | P4 | P4 | P4 | P4 | P1 |
