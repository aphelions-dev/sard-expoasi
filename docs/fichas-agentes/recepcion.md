# Ficha: agente de recepción

| Campo | Contenido |
|-------|-----------|
| Objetivo | Recibir los mensajes de `POST /reportes`, validar el formato SARD1, descartar duplicados por id, escribir en el registro de eventos y devolver `SACK`. |
| Entradas | Mensajes SARD1 crudos desde la pasarela. |
| Salidas | Evento `reporte_recibido` o `reporte_rechazado` en el registro; `SACK|<id>` a la pasarela. |
| Herramientas | Por definir. |
| Memoria | Registro de eventos (solo agrega). Estado adicional: por definir. |
| Límites de autonomía | Triaje, correlación o cualquier interpretación del texto. |
| Manejo de errores | Por definir. Nunca borra eventos; registra el error como evento. |
| Criterio de terminación | Por definir. |
