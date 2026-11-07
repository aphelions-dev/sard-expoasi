# E7 · Triaje con Jev caído (solo reglas)

Los 100 reportes etiquetados (`datos/sinteticos/`) contra la central A real. Jev: `caido`. Sin `JEV_API_KEY` esta corrida es E7; E6 con Jev se corre con `--env-file ../.env`.

- **Formulario neutro**: el celular manda P4 y solo las banderas; mide lo que agrega la central.
- **Prioridad del celular**: el celular manda la prioridad etiquetada; comprueba que la central nunca la baja.

| Métrica | Formulario neutro | Prioridad del celular |
|---|---|---|
| Priorizados (disponibilidad) | 100% | 100% |
| Exactas | 42 | 94 |
| Subtriaje (debajo de la real) | 52 | 0 |
| Sobretriaje (encima) | 6 | 6 |
| Recall de P1 | 57% | 100% |
| Segundos hasta priorizar los 100 | 4.2 | 4.2 |
| Bajados respecto al celular | — | 0 |

Cumple «el triaje sigue funcionando» y «cero P1 bajados»: sí.

P1 que el formulario neutro deja por debajo (13): son los que solo Jev o un humano pueden rescatar.

- e6n-2: «mi mamá quedó debajo de la placa del techo, la escucho pero no la puedo sacar» → P4
- e6n-4: «mi papá se desplomó, está morado y no se mueve» → P4
- e6n-11: «no sé si respira mi abuela, está muy pálida y fría» → P4
- e6n-13: «colapsó el puente peatonal y hay gente abajo» → P4
- e6n-14: «se escucha a alguien pidiendo auxilio entre los escombros del colegio» → P4
- e6n-15: «mi hijo de 3 años se tragó algo y se está ahogando» → P4
- e6n-18: «mi esposa está embarazada, empezó a sangrar mucho y está mareada» → P4
- e6n-19: «la casa se derrumbó con la familia adentro, son 4 con dos niños» → P4
- e6n-24: «persona aplastada por una pared en la carrera 5» → P4
- e6n-25: «mi bebé no se despierta y tiene fiebre muy alta» → P4
- e6n-26: «hay alguien colgado del balcón del cuarto piso, se va a caer» → P4
- e6n-28: «edif caido gnt atrapda cll 10 ayu» → P4
- e6n-30: «la bodega de pinturas está ardiendo al lado del jardín infantil» → P4
