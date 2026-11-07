# Ficha: agente de triaje y priorización

**Dueño:** P2 · `central/agentes/triaje/` · Fuente de los límites: Bases, Tabla 3 (`docs/referencias/HackathonExpoASI2026.pdf`)

| Campo | Contenido |
|-------|-----------|
| Objetivo | Identificar indicadores de riesgo (atrapados, dificultad respiratoria, incendio, necesidad médica urgente), proponer la prioridad, explicar las señales y marcar los casos ambiguos. Primero reglas; después Jev. |
| Entradas | Eventos `reporte_recibido`. |
| Salidas | Evento `reporte_priorizado`: prioridad, fuente (reglas/Jev), evidencia textual, incertidumbre y motivo de escalamiento. |
| Herramientas | Por definir. |
| Memoria | Registro de eventos (solo agrega). Estado adicional: por definir. |
| Límites de autonomía | Jev puede subir una prioridad, nunca bajarla (ADR 0005). Es apoyo, no diagnóstico clínico ni decisión definitiva de rescate. |
| Manejo de errores | Por definir. Nunca borra eventos; registra el error como evento. |
| Criterio de terminación | Por definir. |
