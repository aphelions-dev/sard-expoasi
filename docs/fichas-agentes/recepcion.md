# Ficha: agente de recepción y normalización

**Dueño:** P2 · `central/agentes/recepcion/` · Fuente de los límites: Bases, Tabla 3 (`docs/referencias/HackathonExpoASI2026.pdf`)

| Campo | Contenido |
|-------|-----------|
| Objetivo | Recibir los mensajes de `POST /reportes`, validar el formato SARD1 y normalizarlo; detectar campos faltantes, formatos inválidos y mensajes truncados; descartar duplicados exactos por id; devolver `SACK`. |
| Entradas | Mensajes SARD1 crudos desde la pasarela. |
| Salidas | Evento `reporte_recibido` (normalizado) o `reporte_rechazado` (con el error de validación y los campos desconocidos); `SACK|<id>`. |
| Herramientas | Por definir. |
| Memoria | Registro de eventos (solo agrega). Estado adicional: por definir. |
| Límites de autonomía | No inventa la ubicación ni completa como hechos los datos que el ciudadano no suministró. |
| Manejo de errores | Por definir. Nunca borra eventos; registra el error como evento. |
| Criterio de terminación | Por definir. |
