# Simulador: instrucciones locales para Claude Code (Persona 3)

1. Antes de nada, leer `../CLAUDE.md` y `../contracts/` (protocolo y API).
2. Modificar solo archivos dentro de `simulador/` (y `pruebas/`, `datos/` cuando la tarea lo
   pida). Para cualquier otra carpeta, abrir un issue.
3. Respetar `contracts/` al pie de la letra: los mensajes generados cumplen SARD1 exactamente;
   validar contra `contracts/ejemplos/`.
4. Un cambio al contrato se propone en una rama `contrato/<descripcion>` con un PR aparte que
   revisan los tres. Nunca mezclarlo con un PR de esta área.
5. Trabajar en la rama `p3/tablero-pruebas` y abrir PR a `dev` al terminar cada tarea.
6. Lo que no esté definido se marca "por definir" y se pregunta.
7. Toda corrida es reproducible: semilla fija y parámetros guardados junto a los resultados en
   `../pruebas/resultados/`.
8. Datos siempre sintéticos. Python se ejecuta como `PYTHONUTF8=1 python ...` en Windows.
