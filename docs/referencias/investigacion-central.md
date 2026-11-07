# Investigación: ¿la central hace lo que piden las bases?

Revisión del 7 de noviembre de 2026 (P2). Comparamos la central con las bases
(`HackathonExpoASI2026.pdf`) y con literatura abierta sobre triaje de mensajes de crisis y
supervisión humana. Las fuentes las leímos con Firecrawl (resúmenes extraídos del texto completo).
No buscamos en Scopus ni IEEE: para decidir esto bastó la literatura abierta.

## Lo que la evidencia respalda

| Decisión | Evidencia |
|----------|-----------|
| Jev responde preguntas atómicas con probabilidad y el código decide la prioridad | Obligar a un modelo a elegir entre opciones fijas es un mecanismo fuerte de subtriaje; con respuesta libre acierta más (arXiv 2603.11413, triaje médico de consumo, 2026). |
| Las reglas no bajan una prioridad y Jev solo sube | Los estudios de triaje con LLM tratan el subtriaje como el error que más importa (p. ej. «When algorithms triage trauma», 2026). |
| No quedarse solo con palabras clave | En mensajes cortos de crisis, las líneas base de léxico rinden poco frente a modelos aprendidos (Kejriwal y Zhou, PMC7341028). Nuestra prueba de sesgo dio lo mismo (`central/sesgo/`). |
| Lista corta arriba sin ocultar el resto | En TREC-IS 2020 cerca del 10 % de los mensajes tenía información accionable y solo entre 0,2 % y 1,3 % era crítico (`trec.nist.gov/pubs/trec29/papers/OVERVIEW.IS.pdf`). |

## Huecos frente a las bases, y qué hicimos

| Hueco | Bases | Cambio |
|-------|-------|--------|
| La coordinación no miraba los recursos | Tabla 3: «relacionando el incidente con los recursos declarados disponibles»; Escenario 2: «las pocas ambulancias» | `GET`/`POST /recursos`; cada incidente dice cuántas unidades quedan y con quién compite |
| El orden era solo prioridad y hora | Objetivo 4: «según urgencia, impacto y confianza» | Orden por prioridad, impacto (niños o adultos mayores, personas) y corroboración, con `motivo_orden` |
| Un reporte truncado no lo veía nadie | Escenario 2: «mensajes a medio terminar» | `GET /rechazados` con los campos que sí llegaron; sigue sin `SACK` para que el celular reintente |
| No se veía qué tan vieja era la información | Sección 1.1: información «desactualizada» | `vigencia` con los minutos sin noticias |

## Riesgo para el tablero: el humano no es garantía

Poner a un humano a aprobar puede aumentar la confianza en el sistema y aun así bajar la exactitud:
en un experimento, quienes podían ajustar la recomendación corrigieron menos justo cuando el error
era grande (PMC10857587). La EDPS (TechDispatch sobre supervisión humana, 2025) recomienda
interfaces que inviten a pensar, no solo a confirmar. Por eso la API pide una nota al aprobar un
incidente marcado para revisión, y conviene que el tablero muestre la evidencia antes que la
propuesta.

## Pendiente

- El PDF de TREC-IS 2019 (ISCRAM) no se pudo leer: la página pide captcha.
- Repetir la prueba de sesgo y la calibración con los 100 reportes etiquetados (#13).
