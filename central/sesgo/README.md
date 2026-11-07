# Prueba de sesgo del triaje

Revisa si la prioridad depende de cómo se escribe el reporte (`docs/uso-responsable-ia.md`).

## Método

`casos.py` tiene 8 sucesos inventados (6 que justifican subir la prioridad y 2 que no) y la
prioridad que el texto solo justifica. Cada suceso está escrito de 5 formas: español cuidado, sin
tildes y con faltas, coloquial colombiano, tres o cuatro palabras, y el dato clave en medio de
contexto que no importa. `correr.py` pasa los 40 textos por el mismo `triar` del agente, con el
formulario neutro (P4, sin banderas), para que la prioridad salga solo del texto. Mide:

- **consistencia**, si las 5 formas de un suceso reciben la misma prioridad;
- **subtriaje**, cuántas quedan por debajo de la esperada (el error que más importa);
- **sobretriaje**, cuántas quedan por encima;
- **dispersión de Jev**, cuánto se mueve entre variantes la probabilidad de la señal que decide.

```bash
uv run --env-file ../.env python -m sesgo.correr            # reglas y Jev (40 llamadas)
uv run --env-file ../.env python -m sesgo.correr --sin-jev  # solo reglas
```

Cada corrida reescribe `resultados.md`.

## Qué encontramos (7 de noviembre de 2026, `jev-1.14.0`)

- **Con Jev, la forma de escribir no cambió la prioridad.** No hubo subtriaje en ninguno de los
  40 reportes: los 6 sucesos que lo justifican quedaron en su prioridad con faltas, en coloquial
  («quedó privada», «no le entra aire») y en tres palabras. La probabilidad de la señal que decide
  se movió como mucho 0,13 entre variantes.
- **Las reglas solas son literales.** Sin Jev y sin banderas, 25 de los 30 reportes de los 6
  sucesos graves se quedan en P4. «No está respirando», «se está quemando», «perdiendo mucha
  sangre» y «no reacciona» no contienen ninguna palabra crítica de la lista, y «encerraos» no
  contiene «atrapad». Si Jev cae, lo que sostiene la prioridad es lo que marca el reportante en el
  formulario (banderas y prioridad del celular), no el texto.
- **Un sobretriaje, y es de reglas.** «Ya revisamos el gas» contiene la palabra crítica «gas» y
  sube a P1 un reporte sin novedad. Lo dejamos así: subestimar es peor que sobrestimar, y el
  coordinador lo ve en la evidencia.

## Límites

Son 40 textos que escribimos nosotros, no una muestra de reportes reales: sirven para encontrar
fallas, no para dar una tasa de error. Falta repetirla con los 100 reportes etiquetados a mano
(#13) y con formas que aquí no están, como el español de quien lo habla como segunda lengua.

## Qué sigue

Proponer en una rama `contrato/` que la lista de palabras críticas cubra las formas que aquí se
escaparon (respirando, quemando, sangre, no reacciona, encerrad), para que el triaje con reglas
aguante mejor sin Jev. Esa lista es del contrato y la usa también la app, así que la deciden los
tres.
