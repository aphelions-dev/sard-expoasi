# Ficha: agente de correlación y deduplicación

**Dueño:** P2 · `central/agentes/correlacion/` · Fuente de los límites: Bases, Tabla 3 (`docs/referencias/HackathonExpoASI2026.pdf`)

| Campo | Contenido |
|-------|-----------|
| Objetivo | Agrupar los reportes que probablemente describen el mismo suceso, comparando ubicación aproximada, hora, tipo, texto, identificadores y fuentes. Distinguir un rumor repetido de una emergencia corroborada por fuentes independientes. |
| Entradas | Eventos `reporte_priorizado`. |
| Salidas | Evento `incidente_actualizado`: incidente candidato, nivel de similitud, reportes asociados y contradicciones pendientes. |
| Herramientas | El código filtra candidatos: incidentes con reportes a menos de 1,5 km (geohash, `pygeohash`) y 2 h; sin ubicación, los más cercanos en el tiempo; máximo 5. Jev (`jev-1.14.0`) responde por cada candidato «¿es el mismo suceso?» y «¿lo contradice en algún dato?». Preguntas y umbrales en `central/agentes/correlacion/jev.py`. |
| Decisión | p(mismo) ≥ 0,7: se vincula. Entre 0,3 y 0,7: incidente nuevo con el candidato en `posibles` para que decida el coordinador. Menos de 0,3: incidente nuevo. Contradicción ≥ 0,7: queda visible en el incidente. Sin Jev: solo se vincula con la misma celda de geohash, el mismo tipo y menos de 30 min; ante la duda no se junta. |
| Rumor y corroboración | Se calcula en la vista del incidente: «corroborado» con al menos 2 dispositivos distintos y una fuente directa; «posible rumor» si todas las fuentes son de oídas (pregunta «testigo directo» del triaje); si no, «sin confirmar». Las llegadas repetidas de un mismo reporte por varias pasarelas se cuentan como rutas, no como fuentes. |
| Memoria | Registro de eventos (solo agrega). Sin estado propio: un incidente es el conjunto de `incidente_actualizado` con su id. |
| Límites de autonomía | No borra ni fusiona reportes: cada observación original sigue en el incidente con su texto y su similitud. Un vínculo dudoso no se hace; se muestra como posible. |
| Manejo de errores | Si Jev falla, usa la regla conservadora y anota `jev_error`. Si el agente falla con un reporte, registra `agente_error` y lo reintenta. |
| Criterio de terminación | Cada `reporte_priorizado` tiene un `incidente_actualizado` con el incidente (nuevo o existente), la similitud, los posibles vínculos y las contradicciones. |
