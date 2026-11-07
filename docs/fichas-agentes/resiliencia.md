# Ficha: agente de resiliencia y recuperación

**Dueño:** P2 · `central/agentes/resiliencia/` · Fuente de los límites: Bases, Tabla 3 (`docs/referencias/HackathonExpoASI2026.pdf`)

| Campo | Contenido |
|-------|-----------|
| Objetivo | Supervisar la disponibilidad de las centrales, detectar interrupciones y reanudar el procesamiento en la central B a partir del registro de eventos. Servicio transversal, con lógica distribuida convencional. |
| Entradas | Registro de eventos de la central A; estado de `GET /salud`. |
| Salidas | Estado de salud, central operativa, eventos recuperados y conflictos de sincronización. |
| Herramientas | Por definir. |
| Memoria | Registro de eventos (solo agrega). Estado adicional: por definir. |
| Límites de autonomía | Sin LLM: ningún modelo toma decisiones de infraestructura. El failover lo decide la pasarela. |
| Manejo de errores | Por definir. Nunca borra eventos; registra el error como evento. |
| Criterio de terminación | Por definir. |
