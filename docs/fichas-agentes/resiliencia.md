# Ficha: agente de resiliencia y recuperación

**Dueño:** P2 · `central/agentes/resiliencia/` · Fuente de los límites: Bases, Tabla 3 (`docs/referencias/HackathonExpoASI2026.pdf`)

| Campo | Contenido |
|-------|-----------|
| Objetivo | Supervisar la disponibilidad de las centrales, detectar interrupciones y reanudar el procesamiento en la central B a partir del registro de eventos. Servicio transversal, con lógica distribuida convencional. |
| Entradas | Registro de eventos de la central A; estado de `GET /salud`. |
| Salidas | Estado de salud, central operativa, eventos recuperados y conflictos de sincronización. |
| Herramientas | Código, sin IA (`central/agentes/resiliencia/sincronizar.py`). Cada segundo pide a la otra central `GET /eventos?desde_seq=` y une los eventos a su registro por id. El registro funciona como un conjunto que solo crece (G-Set, un CRDT): la unión no tiene conflictos y reimportar es inofensivo. Va en las dos direcciones. Además, cada reporte nuevo se entrega a la otra antes del `SACK` (`POST /eventos`, `entregar.py`): así una central que cae justo después de confirmar no deja reportes que solo ella tiene. |
| Relevo | Las dos centrales corren a la vez. Los agentes de la B esperan mientras la A responda a `/salud`; si la A deja de responder, la B procesa, y cuando la A vuelve, la A trae lo que hizo la B y retoma. Los ids de incidente son deterministas (`inc-<reporte>`), así que las dos centrales nombran igual el mismo incidente. |
| Memoria | Registro de eventos (solo agrega). El cursor de lectura vive en memoria: al reiniciar arranca de 0 y reimporta sin duplicar. |
| Límites de autonomía | Sin LLM: ningún modelo toma decisiones de infraestructura. Qué central recibe los reportes lo decide la pasarela con `/salud`. |
| Manejo de errores | Si la otra central no responde, registra `par_caido` una vez y sigue intentando; al volver, `par_recuperado`. Si las dos centrales clasificaron distinto el mismo reporte, se conservan las dos versiones: el incidente toma la prioridad más alta y lo marca en `discrepancias_entre_centrales`. Si la otra central arrancó con una base nueva, el cursor vuelve a 0. |
| Criterio de terminación | Servicio continuo. Una recuperación termina cuando `GET /incidentes` da lo mismo en las dos centrales (probado: caída de la A, reporte y aprobación en la B, vuelta de la A). |
