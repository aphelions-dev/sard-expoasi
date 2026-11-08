# Ficha: agente de triaje y priorización

**Dueño:** P2 · `central/agentes/triaje/` · Fuente de los límites: Bases, Tabla 3 (`docs/referencias/HackathonExpoASI2026.pdf`)

| Campo | Contenido |
|-------|-----------|
| Objetivo | Identificar indicadores de riesgo (atrapados, dificultad respiratoria, incendio, necesidad médica urgente), proponer la prioridad, explicar las señales y marcar los casos ambiguos. Primero reglas; después Jev. |
| Entradas | Eventos `reporte_recibido`. |
| Salidas | Evento `reporte_priorizado`: prioridad, fuente (reglas/Jev), evidencia textual, incertidumbre y motivo de escalamiento. |
| Herramientas | Reglas: banderas del formulario y palabras críticas de `contracts/palabras-criticas.txt`. Jev (`jev-1.14.0`, TypeSafe): ocho preguntas Noul sobre el texto (atrapados, no respira, inconsciente, sangrado grave, incendio activo, herido, riesgo vital, testigo directo) y una Choice con el tipo. Las preguntas y umbrales están en `central/agentes/triaje/jev.py`. |
| Decisión | Prioridad de reglas = la más alta entre la del celular, las banderas y las palabras críticas. Jev propone P1 si una señal vital pasa de 0,7 y P2 si «herido» pasa de 0,7. Final = la más alta de las dos. Va a revisión humana si Jev subió la prioridad, si el riesgo vital queda entre 0,3 y 0,7, o si Jev ve con claridad otro tipo de emergencia que el marcado en el celular. «Testigo directo» clasifica la fuente como directa, de oídas o incierta, para la correlación. |
| Memoria | Registro de eventos (solo agrega). Sin estado propio: lo pendiente es todo `reporte_recibido` sin un `reporte_priorizado` que lo cite. |
| Límites de autonomía | Jev puede subir una prioridad, nunca bajarla (ADR 0005). Es apoyo, no diagnóstico clínico ni decisión definitiva de rescate. Toda la evidencia (señal, origen, cita del texto o probabilidad) queda en el evento para el coordinador. |
| Manejo de errores | Jev caído, lento (más de 8 s, con un reintento) o sin clave: queda la prioridad de reglas y el evento lo marca `jev: caido` con el error. Reporte sin texto: no se consulta a Jev (`no_aplica`). Si el agente falla con un reporte, registra `agente_error` una vez y lo reintenta en la siguiente vuelta. |
| Criterio de terminación | Cada `reporte_recibido` tiene exactamente un `reporte_priorizado` con prioridad, evidencia, estado de Jev y motivos de revisión. Los P1 se procesan primero. |
