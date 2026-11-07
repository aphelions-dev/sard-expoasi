# Escenarios de prueba

Cada corrida guarda semilla, parámetros y resultados en `pruebas/resultados/`.

| # | Escenario | Variable | Métrica | Esperado |
|---|-----------|----------|---------|----------|
| E1 | Pérdida de paquetes | 0 / 10 / 30 / 50 % | Tasa de entrega, latencia | Entrega final 100 % con reintentos; latencia crece con la pérdida |
| E2 | Densidad de malla | N celulares y alcance (por definir) | Tasa de entrega, saltos promedio | Por definir |
| E3 | Prioridad | Mezcla P1–P4 con cola llena | Latencia por prioridad | P1/P2 llegan antes; P3/P4 también llegan |
| E4 | Duplicados | Mismo id por varios caminos | Reportes creados por id | Exactamente 1 por id |
| E5 | Caída de central | Apagar A durante la carga | Reportes perdidos | 0 perdidos; la pasarela pasa a B |
| E6 | Triaje | 100 reportes etiquetados | Exactitud de tipo y prioridad; P1 subestimados | Cero P1 bajados de prioridad |
| E7 | Jev caído | Sin Jev | Exactitud solo con reglas, disponibilidad | El triaje sigue funcionando |

Umbrales numéricos: por definir tras las primeras corridas.
