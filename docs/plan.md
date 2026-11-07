# Plan por hitos

Sin fechas: se pasa al siguiente hito cuando se cumple el criterio. Al cumplirlo, PR `dev → main`
y tag `hito-N`. Cada tarea es un issue en GitHub con su milestone, etiqueta y responsable.

## Hito 1 — Base y malla validada

**Objetivo:** confirmar que la malla funciona y tener el esqueleto de cada parte.

| Persona | Tarea |
|---------|-------|
| P1 | Compilar el fork de bitchat Android y lograr mensajes entre 3 celulares Android |
| P2 | API y registro de eventos que acepte SARD1 |
| P3 | Simulador básico de la malla |
| P3 | Generador de reportes sintéticos |

**Criterio:** los mensajes cruzan la malla (A → B → C). Si no se logra, se decide el plan B con
transporte simulado antes de seguir.

## Hito 2 — Primer reporte de punta a punta

**Objetivo:** un reporte real recorre todo el camino.

| Persona | Tarea |
|---------|-------|
| P1 | Formulario offline y prioridad por reglas |
| P1 | Almacenamiento local de reportes |
| P1 | Modo pasarela con envío HTTP y SACK |
| P2 | Agente de recepción |
| P3 | Tablero que muestra los reportes recibidos |

**Criterio:** un reporte creado sin internet llega a la central por la malla, aparece en el
tablero y el reportante ve "entregado".

## Hito 3 — Inteligencia

**Objetivo:** la central prioriza y agrupa, y el humano decide.

| Persona | Tarea |
|---------|-------|
| P1 | Cola de reenvío por prioridad y reintentos con espera creciente |
| P2 | Agente de triaje (reglas + Jev) |
| P2 | Agentes de correlación y coordinación |
| P3 | Tablero con evidencia, incertidumbre y aprobación |
| P3 | 100 reportes sintéticos etiquetados a mano |

**Criterio:** el tablero muestra incidentes priorizados con su evidencia y ninguna acción se
ejecuta sin aprobación.

## Hito 4 — Resiliencia

**Objetivo:** el sistema aguanta fallas.

| Persona | Tarea |
|---------|-------|
| P1 | Failover de la pasarela entre central A y B |
| P2 | Central B y sincronización desde el registro de eventos |
| P3 | Pruebas de pérdida, densidad, duplicados, caída de central y Jev caído, con métricas |

**Criterio:** se apaga la central A durante la carga y no se pierde ningún reporte.

## Hito 5 — Demo lista

**Objetivo:** todo listo para presentar.

| Persona | Tarea |
|---------|-------|
| Todos | Recorrido completo de 8 pasos integrado (`docs/pitch/guion-demo.md`) |
| P2 | Fichas de agentes finales |
| Todos | Protocolo final revisado (`contracts/`) |
| P3 | Resultados de pruebas documentados |
| P3 | README final y pitch |
| Todos | Dos ensayos de la demo |
| Todos | Video de respaldo de la demo |

**Criterio:** los 7 entregables (`docs/entregables.md`) están completos y la demo corre bajo al
menos una condición adversa.
