# Calibración del umbral de Jev

Elige el umbral de «sí» de Jev (`SI` en `agentes/triaje/jev.py`, hoy 0,7) con los reportes
etiquetados a mano de `datos/sinteticos/reportes_etiquetados.csv` (#13).

```bash
uv run --env-file ../.env python -m calibracion.correr
```

Le pregunta a Jev una vez por reporte y guarda las respuestas en `respuestas-jev.json`. Si se
corre otra vez, solo consulta los textos nuevos. Después prueba umbrales de 0,5 a 0,9 con la misma
regla del triaje (`agente.senales_jev`) y escribe `resultados.md` con subtriaje, sobretriaje,
recall de P1 y cuántas veces subió Jev, comparado con el triaje solo con reglas.

Recomienda el umbral con menos subtriaje y, si empatan, el de menos sobretriaje. No cambia el
código: si el equipo lo adopta, se cambia `SI` y se anota en la ficha de triaje.

Cada reporte entra con prioridad del celular P4 y las banderas de las columnas `atrapados` y
`heridos`, para medir lo que aporta la central sobre el formulario.

Probado el 7 de noviembre de 2026 con los 40 casos de `sesgo/`: todos los umbrales entre 0,5 y
0,85 dan 0 subtriaje, y 0,9 deja escapar uno. Son casos claros; para que el umbral se note, el CSV
de #13 necesita casos dudosos («creo que», «no sé si respira», textos a medio escribir).
