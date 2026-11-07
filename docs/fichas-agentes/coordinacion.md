# Ficha: agente de coordinación de respuesta

**Dueño:** P2 · `central/agentes/coordinacion/` · Fuente de los límites: Bases, Tabla 3 (`docs/referencias/HackathonExpoASI2026.pdf`)

| Campo | Contenido |
|-------|-----------|
| Objetivo | Preparar una recomendación por incidente con la entidad responsable, la justificación y lo que falta confirmar, para que el coordinador la apruebe o la rechace. |
| Entradas | Eventos `incidente_actualizado` y el incidente completo, calculado del registro (`central/vista/incidentes.py`). |
| Salidas | Evento `accion_propuesta`: entidad, acción, prioridad, personas estimadas, justificación, `falta_confirmar` y `requiere_aprobacion`. La decisión del coordinador (`POST /incidentes/{id}/aprobacion`) queda como evento `decision_humana` ligado a esa propuesta. |
| Herramientas | Código, sin IA. Matriz de responsabilidades según lo que contó el comandante de Bomberos de Manizales: atrapados e incendios a Bomberos (búsqueda, rescate, evacuación), heridos y desaparecidos a Cruz Roja, vías a Defensa Civil, lo demás a la sala de crisis. La justificación es una plantilla con los datos del incidente. |
| Memoria | Registro de eventos (solo agrega). Sin estado propio. |
| Límites de autonomía | No despacha unidades ni asigna recursos: toda propuesta sale con `requiere_aprobacion` y queda pendiente hasta la decisión humana. Si el incidente cambia (llega otro reporte), se propone de nuevo y la decisión anterior no se aplica a la nueva propuesta. |
| Manejo de errores | Si el incidente todavía no tiene todos sus eventos, registra `agente_error` y lo reintenta. Si falta la ubicación, una segunda fuente directa o el número de personas, lo dice en `falta_confirmar` en lugar de suponerlo. |
| Criterio de terminación | Cada `incidente_actualizado` tiene una `accion_propuesta`; el ciclo de un incidente termina con una `decision_humana` sobre su propuesta vigente. |
