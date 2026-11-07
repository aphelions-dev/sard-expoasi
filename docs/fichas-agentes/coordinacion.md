# Ficha: agente de coordinación

| Campo | Contenido |
|-------|-----------|
| Objetivo | Proponer acciones por incidente para el coordinador humano y marcarlas como ejecutadas solo tras `POST /incidentes/{id}/aprobacion`. |
| Entradas | Eventos `incidente_actualizado` y decisiones del coordinador. |
| Salidas | Evento `accion_propuesta`, `accion_aprobada` o `accion_rechazada`. |
| Herramientas | Por definir. |
| Memoria | Registro de eventos (solo agrega). Estado adicional: por definir. |
| Límites de autonomía | Ejecutar cualquier acción sin aprobación humana. |
| Manejo de errores | Por definir. Nunca borra eventos; registra el error como evento. |
| Criterio de terminación | Por definir. |
