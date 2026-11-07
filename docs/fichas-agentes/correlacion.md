# Ficha: agente de correlación y deduplicación

**Dueño:** P2 · `central/agentes/correlacion/` · Fuente de los límites: Bases, Tabla 3 (`docs/referencias/HackathonExpoASI2026.pdf`)

| Campo | Contenido |
|-------|-----------|
| Objetivo | Agrupar los reportes que probablemente describen el mismo suceso, comparando ubicación aproximada, hora, tipo, texto, identificadores y fuentes. Distinguir un rumor repetido de una emergencia corroborada por fuentes independientes. |
| Entradas | Eventos `reporte_priorizado`. |
| Salidas | Evento `incidente_actualizado`: incidente candidato, nivel de similitud, reportes asociados y contradicciones pendientes. |
| Herramientas | Por definir. |
| Memoria | Registro de eventos (solo agrega). Estado adicional: por definir. |
| Límites de autonomía | Mantiene el vínculo con cada observación original; no borra evidencia ni fusiona casos distintos sin justificación. |
| Manejo de errores | Por definir. Nunca borra eventos; registra el error como evento. |
| Criterio de terminación | Por definir. |
