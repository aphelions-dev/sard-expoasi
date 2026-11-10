# Entregables oficiales

Fuente: bases de la hackathon, sección 6, Tabla 4 (`docs/referencias/HackathonExpoASI2026.pdf`).
La evaluación no depende solo de la presentación: el jurado debe poder reproducir y auditar.

| # | Entregable | Contenido requerido (bases) | Dónde | Responsable | Listo |
|---|------------|-----------------------------|-------|-------------|-------|
| 1 | Prototipo funcional | Aplicación o servicio que cubra el flujo mínimo de reporte, procesamiento y priorización | `app/`, `central/`, `tablero/` | Todos | [ ] |
| 2 | Código fuente | Repositorio accesible al jurado, instrucciones de instalación, dependencias y configuración para reproducir la prueba | Este repo + README de cada área | Todos (README raíz: P3) | [ ] |
| 3 | Documento de arquitectura | Diagrama de componentes, distribución de agentes, flujos de mensajes, almacenamiento y dependencias | `docs/arquitectura.md` | Todos | [ ] |
| 4 | Fichas de agentes | Objetivo, entradas, salidas, herramientas, memoria, límites de autonomía, manejo de errores y criterios de terminación | `docs/fichas-agentes/` | P2 (comunicación: P1) | [ ] |
| 5 | Protocolo de comunicación | Esquema del mensaje, reintentos, confirmaciones, deduplicación y estrategia de sincronización | `contracts/` | Todos | [ ] |
| 6 | Resultados de pruebas | Métricas, escenarios ejecutados, errores observados, limitaciones y pruebas de estrés | `pruebas/` | P3 | [ ] |
| 7 | Pitch y demostración | Presentación ejecutiva y demostración reproducible bajo al menos una condición adversa | `docs/pitch/` | P3 (demo: todos) | [ ] |

Además, la demo debe mostrar el recorrido de integración de 8 pasos (bases, sección 4.7):
`docs/pitch/guion-demo.md`. El video de respaldo es nuestro plan B, no un entregable oficial.
