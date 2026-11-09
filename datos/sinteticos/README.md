# Reportes sintéticos etiquetados

**Dueño:** Persona 3 (@CrArenas) · Issue #13 · Todo es inventado (CLAUDE.md, regla 8).

`reportes_etiquetados.csv` tiene 100 reportes con la prioridad y el tipo que les corresponde según
la regla de abajo. Los usan la calibración del umbral de Jev (`central/calibracion/`) y el
escenario E6 de `pruebas/escenarios.md`.

## Columnas

| Columna | Qué es |
|---------|--------|
| `id` | `r001`…`r100` |
| `texto` | Lo que el ciudadano escribió en el campo libre; puede venir vacío o cortado |
| `tipo_real` | `ATRAP MEDIC FUEGO VIA DESAP OTRO` (`contracts/protocolo-sard1.md`) |
| `prioridad_real` | `P1`…`P4` según la regla de etiquetado |
| `atrapados`, `heridos` | `1`/`0`: las banderas que el ciudadano marcó en el formulario, no la verdad del caso |
| `notas` | `claro`, `dudoso: …` o `sobretriaje esperado: …`, con el motivo |

## Regla de etiquetado

La prioridad se decide por **riesgo vital y por cuánto tiempo puede esperar la atención**, solo con
lo que dice el reporte. No se completa lo que no está escrito.

| Prioridad | Cuándo | Ejemplos |
|-----------|--------|----------|
| P1 | Riesgo vital ahora | Atrapados, no respira, inconsciente, sangrado grave, convulsiones, fuego, humo o gas con personas |
| P2 | Herido o persona vulnerable que no aguanta horas | Fractura, quemadura con la persona consciente, sin insulina u oxígeno, niño o adulto vulnerable desaparecido, estructura a punto de caer con gente cerca |
| P3 | Daño sin persona en peligro inmediato | Vía bloqueada, adulto desaparecido sin indicio de peligro, fuga de agua, poste caído |
| P4 | Informativo o necesidad no urgente | Agua, refugio, «estamos bien», rumor sin detalle, preguntas |

Un reporte de oídas («dicen que…») con riesgo vital sigue siendo P1: la confianza la mide la
correlación, no el triaje. Un rumor sin detalle concreto es P4.

## Mezcla

| P1 | P2 | P3 | P4 | Dudosos | Sobretriaje esperado |
|----|----|----|----|---------|----------------------|
| 30 | 25 | 25 | 20 | 42 | 4 |

Los **dudosos** son los casos que hacen notar el umbral de Jev: «creo que», «no sé si respira»,
textos con faltas o cortados, de oídas, y P1 que no contienen ninguna palabra crítica (por ejemplo
«quedó debajo de la placa»). Con las palabras críticas del 7 de noviembre, 13 de los 30 P1 se
quedaban en P4 solo con reglas; con la lista corregida en #69 (variantes como «atrap», «ahog»,
«aplastad», «escombros»), quedan **4 de 30** (`r002`, `r013`, `r019`, `r026`): es lo que Jev o el
coordinador tienen que rescatar.

Los de **sobretriaje esperado** son casos donde las reglas suben la prioridad de más y así debe
quedar registrado (ADR 0005: las reglas ganan):

- `r050` «sangre» en un herido leve, `r075` «fuego» ya apagado.
- `r056` negación: «no hay carros atrapados» (desde #70 la central lo marca como posible negación,
  sin bajar la prioridad).
- `r062` bandera de heridos en raspones ya curados.

Dos que lo eran dejaron de serlo con #69: `r100` («gas» dentro de «lle**gas**te») y `r096` (un
rumor con «gas»), porque «gas» solo cuenta ahora en frases como «fuga de gas».

## Cómo se revisó

Cada fila se pasó por las reglas reales del triaje (`central/agentes/triaje/reglas.py`) con la
prioridad del celular en P4, igual que la calibración. Solo con reglas y la lista de #69: 53
exactas, 43 por debajo de su prioridad real y 4 por encima, todas las de arriba (con la lista del
7 de noviembre eran 42, 52 y 6). Los P3 aparecen «por debajo» solo porque
la calibración entra con P4 y las reglas no tienen nada que suba a P3.

Con la prioridad que calculan las reglas del celular (contrato, «Prioridad en el celular»), en vez de
P4, la central da 55 exactas, 21 por debajo y 24 por encima (`pruebas/resultados/E7/`). Los 4 P1 sin
palabra crítica ni atrapados marcado quedan en P3: sin Jev, solo el coordinador los sube.
