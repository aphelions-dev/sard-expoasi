# Tablero: instrucciones locales para Claude Code (Persona 3)

1. Antes de nada, leer `../CLAUDE.md` y `../contracts/` (protocolo y API).
2. Modificar solo archivos dentro de `tablero/` (y `simulador/`, `pruebas/`, `datos/` desde sus
   propias sesiones). Para cualquier otra carpeta, abrir un issue.
3. Respetar `contracts/` al pie de la letra: no inventar campos ni endpoints.
4. Un cambio al contrato se propone en una rama `contrato/<descripcion>` con un PR aparte que
   revisan los tres. Nunca mezclarlo con un PR de esta área.
5. Trabajar en la rama `p3/tablero-pruebas` y abrir PR a `dev` al terminar cada tarea.
6. Lo que no esté definido (incluido el stack) se marca "por definir" y se pregunta.
7. El tablero solo consume la API de la central (`contracts/api-central.md`); no lee la base de
   datos directamente.
8. Mostrar siempre evidencia e incertidumbre junto a cada prioridad. Aprobar es una acción
   explícita del coordinador.
