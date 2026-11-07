# Ficha: agente de triaje

| Campo | Contenido |
|-------|-----------|
| Objetivo | Asignar tipo y prioridad final. Primero reglas; luego Jev puede subir la prioridad, nunca bajarla. Si Jev falla o tarda, queda la de reglas. |
| Entradas | Eventos `reporte_recibido`. |
| Salidas | Evento `reporte_priorizado` con prioridad, fuente (reglas/Jev) y justificación. |
| Herramientas | Por definir. |
| Memoria | Registro de eventos (solo agrega). Estado adicional: por definir. |
| Límites de autonomía | Bajar una prioridad, agrupar reportes, proponer acciones. |
| Manejo de errores | Por definir. Nunca borra eventos; registra el error como evento. |
| Criterio de terminación | Por definir. |
