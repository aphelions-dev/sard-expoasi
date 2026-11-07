# Ficha: agente de coordinación de respuesta

**Dueño:** P2 · `central/agentes/coordinacion/` · Fuente de los límites: Bases, Tabla 3 (`docs/referencias/HackathonExpoASI2026.pdf`)

| Campo | Contenido |
|-------|-----------|
| Objetivo | Preparar una recomendación por incidente relacionándolo con los recursos declarados disponibles, las restricciones operativas y la incertidumbre. |
| Entradas | Eventos `incidente_actualizado` y decisiones del coordinador (`POST /incidentes/{id}/aprobacion`). |
| Salidas | Evento `accion_propuesta` (acción sugerida, justificación, requisitos pendientes, solicitud de aprobación); `accion_aprobada` o `accion_rechazada`. |
| Herramientas | Por definir. |
| Memoria | Registro de eventos (solo agrega). Estado adicional: por definir. |
| Límites de autonomía | No despacha unidades ni asigna recursos sin aprobación humana explícita. |
| Manejo de errores | Por definir. Nunca borra eventos; registra el error como evento. |
| Criterio de terminación | Por definir. |
