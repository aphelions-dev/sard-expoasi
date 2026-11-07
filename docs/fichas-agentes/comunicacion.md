# Ficha: agente de comunicación y sincronización

**Dueño:** P1 · cola de reenvío de la app (`app/`) · Fuente de los límites: Bases, Tabla 3 (`docs/referencias/HackathonExpoASI2026.pdf`)

| Campo | Contenido |
|-------|-----------|
| Objetivo | Decidir qué mensajes transmitir primero según urgencia, antigüedad, tamaño y vencimiento; administrar la cola, los reintentos con espera creciente y las confirmaciones (`SACK`). Servicio transversal, no un agente con LLM. |
| Entradas | Reportes guardados en el celular y `SACK` recibidos. |
| Salidas | Cola de transmisión ordenada y estado de entrega de cada reporte (pendiente, entregado, no entregado). |
| Herramientas | Por definir. |
| Memoria | Registro de eventos (solo agrega). Estado adicional: por definir. |
| Límites de autonomía | La priorización no puede hacer desaparecer los casos P3/P4. Nunca borra un reporte; los vencidos se marcan "no entregado". |
| Manejo de errores | Por definir. Nunca borra eventos; registra el error como evento. |
| Criterio de terminación | Por definir. |
