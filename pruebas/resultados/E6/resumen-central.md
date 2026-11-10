# E6 · Triaje con reglas y Jev

Los 100 reportes etiquetados (`datos/sinteticos/`) contra la central A real. Jev: `ok`.

- **Formulario neutro**: el celular manda P4 y solo las banderas; mide lo que agrega la central.
- **Prioridad del celular**: el celular manda la prioridad de sus reglas (contrato, «Prioridad en el celular»); mide el sistema entero y comprueba que la central nunca la baja.

| Métrica | Formulario neutro | Prioridad del celular |
|---|---|---|
| Priorizados (disponibilidad) | 100% | 100% |
| Exactas | 60 | 62 |
| Subtriaje (debajo de la real) | 28 | 7 |
| Sobretriaje (encima) | 12 | 31 |
| Recall de P1 | 100% | 100% |
| Segundos hasta priorizar los 100 | 20.3 | 18.5 |
| Bajados respecto al celular | — | 0 |

Cumple «el triaje sigue funcionando» y «cero P1 bajados»: sí.

P1 que el formulario neutro deja por debajo (0): son los que solo Jev o un humano pueden rescatar.


P1 que quedan por debajo con la prioridad del celular (0): ni las reglas del celular ni la central los suben.

