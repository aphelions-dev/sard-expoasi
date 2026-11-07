# Ficha: agente de correlación

| Campo | Contenido |
|-------|-----------|
| Objetivo | Agrupar reportes del mismo evento (geohash cercano, tipo, ventana de tiempo) en un incidente con su evidencia. |
| Entradas | Eventos `reporte_priorizado`. |
| Salidas | Evento `incidente_actualizado` con reportes asociados, evidencia e incertidumbre. |
| Herramientas | Por definir. |
| Memoria | Registro de eventos (solo agrega). Estado adicional: por definir. |
| Límites de autonomía | Cambiar prioridades, proponer acciones. Criterios exactos de cercanía: por definir. |
| Manejo de errores | Por definir. Nunca borra eventos; registra el error como evento. |
| Criterio de terminación | Por definir. |
