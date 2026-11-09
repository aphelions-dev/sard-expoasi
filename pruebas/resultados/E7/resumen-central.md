# E7 · Triaje con Jev caído (solo reglas)

Los 100 reportes etiquetados (`datos/sinteticos/`) contra la central A real. Jev: `caido`. Sin `JEV_API_KEY` esta corrida es E7; E6 con Jev se corre con `--env-file ../.env`.

- **Formulario neutro**: el celular manda P4 y solo las banderas; mide lo que agrega la central.
- **Prioridad del celular**: el celular manda la prioridad de sus reglas (contrato, «Prioridad en el celular»); mide el sistema entero y comprueba que la central nunca la baja.

| Métrica | Formulario neutro | Prioridad del celular |
|---|---|---|
| Priorizados (disponibilidad) | 100% | 100% |
| Exactas | 53 | 55 |
| Subtriaje (debajo de la real) | 43 | 21 |
| Sobretriaje (encima) | 4 | 24 |
| Recall de P1 | 87% | 87% |
| Segundos hasta priorizar los 100 | 2.2 | 2.3 |
| Bajados respecto al celular | — | 0 |

Cumple «el triaje sigue funcionando» y «cero P1 bajados»: sí.

P1 que el formulario neutro deja por debajo (4): son los que solo Jev o un humano pueden rescatar.

- e6n-2: «mi mamá quedó debajo de la placa del techo, la escucho pero no la puedo sacar» → P4
- e6n-13: «colapsó el puente peatonal y hay gente abajo» → P4
- e6n-19: «la casa se derrumbó con la familia adentro, son 4 con dos niños» → P4
- e6n-26: «hay alguien colgado del balcón del cuarto piso, se va a caer» → P4

P1 que quedan por debajo con la prioridad del celular (4): ni las reglas del celular ni la central los suben.

- e6c-2: «mi mamá quedó debajo de la placa del techo, la escucho pero no la puedo sacar» → P3
- e6c-13: «colapsó el puente peatonal y hay gente abajo» → P3
- e6c-19: «la casa se derrumbó con la familia adentro, son 4 con dos niños» → P3
- e6c-26: «hay alguien colgado del balcón del cuarto piso, se va a caer» → P3
