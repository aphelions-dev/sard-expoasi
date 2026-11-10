# Escenarios de prueba

Cada corrida guarda semilla, parámetros y resultados en `pruebas/resultados/` (índice y hallazgos en
`pruebas/resultados/README.md`). Cómo se corren: `simulador/README.md`.

| # | Escenario | Variable | Métrica | Esperado | Resultado |
|---|-----------|----------|---------|----------|-----------|
| E1 | Pérdida de paquetes | 0 / 10 / 30 / 50 % | Tasa de entrega, latencia | Entrega final 100 % con reintentos; latencia crece con la pérdida | Cumple (lo no entregado sale de celulares aislados) |
| E2 | Densidad de malla | 15 / 30 / 60 celulares × 30 / 50 / 100 m en 250 m × 250 m | Tasa de entrega, saltos promedio | Por definir | Umbral medido: ver resultados |
| E3 | Prioridad | Mezcla P1–P4 con cola llena | Latencia por prioridad | P1/P2 llegan antes; P3/P4 también llegan | Cumple, con un costo en P4 (ver hallazgos) |
| E4 | Duplicados | Mismo id por varios caminos | Reportes creados por id | Exactamente 1 por id | Cumple (simulador y central real) |
| E5 | Caída de central | Apagar A durante la carga | Reportes perdidos | 0 perdidos; la pasarela pasa a B | Cumple (ver ventana de sincronización) |
| E6 | Triaje | 100 reportes etiquetados | Exactitud de prioridad; P1 subestimados | Cero P1 bajados de prioridad | Cumple: recall de P1 de 100 %, 0 bajados |
| E7 | Jev caído | Sin Jev | Exactitud solo con reglas, disponibilidad | El triaje sigue funcionando | Cumple |

Umbrales numéricos: por definir con el equipo a partir de estos resultados.
