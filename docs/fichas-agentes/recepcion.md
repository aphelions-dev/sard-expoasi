# Ficha: agente de recepción y normalización

**Dueño:** P2 · `central/agentes/recepcion/` · Fuente de los límites: Bases, Tabla 3 (`docs/referencias/HackathonExpoASI2026.pdf`)

| Campo | Contenido |
|-------|-----------|
| Objetivo | Recibir los mensajes de `POST /reportes`, validar el formato SARD1 y normalizarlo; detectar campos faltantes, formatos inválidos y mensajes truncados; descartar duplicados exactos por id; devolver `SACK`. |
| Entradas | Mensajes SARD1 crudos desde la pasarela. |
| Salidas | Evento `reporte_recibido` (normalizado) o `reporte_rechazado` (con el error de validación y los campos desconocidos); `SACK|<id>`. |
| Herramientas | Código determinista, sin IA: validador SARD1 (`central/protocolo/sard1.py`) y el registro de eventos. Corre dentro de `POST /reportes`, porque la pasarela necesita el `SACK` en la misma respuesta. |
| Memoria | Registro de eventos (solo agrega). Sin estado propio: la deduplicación la hace un índice único sobre `reporte_id` en los eventos `reporte_recibido`. |
| Límites de autonomía | No inventa la ubicación ni completa como hechos los datos que el ciudadano no suministró: un geohash vacío queda vacío y un mensaje inválido no se corrige, se rechaza. |
| Manejo de errores | Mensaje truncado o con campos inválidos: evento `reporte_rechazado` con todos los motivos y el id si se pudo leer; no se devuelve `SACK`. Id repetido: `SACK` igual y evento `reporte_duplicado` con la pasarela por la que llegó. Si la base no responde, la API devuelve error y la pasarela reintenta (el reporte sigue en su cola). |
| Criterio de terminación | Cada mensaje del lote termina con exactamente un evento (`reporte_recibido`, `reporte_duplicado` o `reporte_rechazado`) y, si es válido, su `SACK` en la respuesta. |
