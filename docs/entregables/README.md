# Entregables oficiales

Fuente: bases de la hackathon, sección 6, Tabla 4 (`docs/referencias/HackathonExpoASI2026.pdf`).
La evaluación no depende solo de la presentación: el jurado debe poder reproducir y auditar.

| # | Entregable | Contenido requerido (bases) | Documento | Estado |
|---|------------|-----------------------------|-----------|--------|
| 1 | Prototipo funcional | Aplicación o servicio que cubra el flujo mínimo de reporte, procesamiento y priorización | `app/`, `reportar/`, `central/`, `tablero/`; desplegado en Railway (`docs/despliegue.md`) | Listo |
| 2 | Código fuente | Repositorio accesible al jurado, instrucciones de instalación, dependencias y configuración | Este repo; README raíz y de cada carpeta | Listo |
| 3 | Documento de arquitectura | Diagrama de componentes, distribución de agentes, flujos de mensajes, almacenamiento y dependencias | [03-arquitectura.md](03-arquitectura.md) | Listo |
| 4 | Fichas de agentes | Objetivo, entradas, salidas, herramientas, memoria, límites de autonomía, manejo de errores y criterios de terminación | [04-fichas-agentes.md](04-fichas-agentes.md) | Listo |
| 5 | Protocolo de comunicación | Esquema del mensaje, reintentos, confirmaciones, deduplicación y estrategia de sincronización | [05-protocolo-comunicacion.md](05-protocolo-comunicacion.md) | Listo; por definir el largo máximo del texto y la antigüedad del GPS |
| 6 | Resultados de pruebas | Métricas, escenarios ejecutados, errores observados, limitaciones y pruebas de estrés | [06-resultados-pruebas.md](06-resultados-pruebas.md) | Listo, E1 a E7 |
| 7 | Pitch y demostración | Presentación ejecutiva y demostración reproducible bajo al menos una condición adversa | `docs/pitch/` | Guion y video de respaldo listos; falta exportar `pitch.pdf` |

## Verificación contra las bases

Revisión del 9 de noviembre de 2026, punto por punto.

### Objetivos específicos (sección 2.2)

| # | Objetivo | Cómo lo cumple SARD | Evidencia |
|---|----------|---------------------|-----------|
| 1 | Captura resiliente | Formulario sin internet en la app Android y en la app web; el reporte se guarda en el celular antes de emitirse | Entregable 3, sección 4 |
| 2 | Comunicación eficiente | Mensaje de texto de 47 a 136 bytes, cola por prioridad, reintentos y `SACK` | Entregable 5; E1 |
| 3 | Inteligencia agéntica | Cinco agentes en procesos aparte, sin orquestador, más la cola del celular | Entregables 3 y 4 |
| 4 | Triaje informativo | Reglas más Jev, con evidencia e incertidumbre; orden por urgencia, impacto y confianza | Entregable 4; E6 y E7 |
| 5 | Gestión de duplicados | Deduplicación en malla, central e incidente, sin borrar ni fusionar | Entregable 5, sección 6; E4 |
| 6 | Continuidad operativa | Centrales A y B a la vez; la pasarela, la app web y el tablero pasan a la B | E5 |
| 7 | Coordinación distribuida | Registro que solo crece, unido por id en las dos direcciones | Entregable 5, sección 7 |
| 8 | Interacción humana | Tablero con cola por secciones, evidencia, incertidumbre, mapa, boletín y aprobación | `tablero/README.md` |
| 9 | Uso responsable de IA | Jev nunca baja una prioridad, nada se ejecuta sin aprobación, todo queda en el registro, prueba de sesgo | `docs/uso-responsable-ia.md`; E6 |
| 10 | Validación experimental | Pruebas reproducibles de pérdida, densidad, prioridad, duplicados, caída y triaje | Entregable 6 |

### Preguntas de los escenarios (sección 3)

| Escenario | Pregunta | Respuesta | Dónde |
|-----------|----------|-----------|-------|
| 1 | ¿Cómo crear y guardar un reporte sin conexión? | Formulario en la app (o la app web), guardado en el celular | Entregable 3, sección 4 |
| 1 | ¿Cómo enviarlo con el menor número de bytes? | Una línea de texto posicional; geohash en lugar de coordenadas | Entregable 5, sección 1 |
| 1 | ¿Cómo evitar perderlo si se interrumpe? | Copia en cada celular, reintentos hasta `SACK`, vencimiento sin borrar | Entregable 5, sección 3 |
| 1 | ¿Cómo saber si necesita atención inmediata? | Reglas en el celular; reglas y Jev en la central | Entregable 5, sección 5; entregable 4 |
| 1 | ¿Cómo evitar que un incidente se registre decenas de veces? | Deduplicación por id y agrupación en incidentes | Entregable 5, sección 6 |
| 1 | Justificar qué se envía primero y el riesgo de aplazar | P1/P2 primero; el costo medido en P4 | Entregable 5, sección 3; E3 |
| 2 | ¿Cómo continúa si el nodo principal se apaga? | La B ya tiene los eventos y toma el relevo | E5 |
| 2 | ¿Cómo se sincronizan nodos aislados? | Unión de registros por id (G-Set) | Entregable 5, sección 7 |
| 2 | ¿Cómo combinar fragmentos sin inventar? | Recepción rechaza, no completa; correlación no fusiona | Entregable 4, agentes 1 y 3 |
| 2 | ¿Cómo administrar la incertidumbre? | Corroboración, motivos de revisión, contradicciones, «sin IA», «sin ubicación» | `contracts/api-central.md`, `incertidumbre` |
| 2 | ¿Cómo dar una lista corta sin ocultar casos? | Orden por prioridad, impacto y confianza; los filtros esconden, nunca sacan de la lista | `tablero/README.md` |

### Retos (sección 4)

| Reto | Tipo | Estado |
|------|------|--------|
| 1. El reporte que debe sobrevivir | Obligatorio | Cumple: app Android probada con 3 celulares y app web |
| 2. Comunicación en ráfagas | Obligatorio | Cumple: E1, E3 y E4 |
| 3. El tejido de agentes | Diferenciador | Cumple: agentes sin orquestador; cae uno, siguen los demás |
| 4. La verdad entre fragmentos | Profundización | Cumple: rumor frente a corroborado, contradicciones visibles |
| 5. Sobrevivir a la caída | Profundización | Cumple: E5, y probado con celulares reales |
| 6. El tablero que salva tiempo | Profundización | Cumple: cola priorizada con evidencia, incertidumbre, ubicación y acción sugerida |

### Recorrido de integración (sección 4.7)

Los 8 pasos (reporte, almacenamiento, transmisión intermitente, agentes, priorización, tablero,
pérdida del nodo y recuperación) se muestran en la demo: `docs/pitch/guion-demo.md`, con
`python -m simulador recorrido` o con los celulares, y en el video de respaldo.

### Lo que falta

- Exportar `docs/pitch/pitch.pdf` (entregable 7).
- Fijar el largo máximo del texto y la antigüedad del GPS (entregable 5).
- Autenticación de la API: hoy cualquiera con la URL puede aprobar (`docs/riesgos.md`).
- Probar con un iPhone real el relevo por bitchat (ADR 0007).
