# Central y agentes: instrucciones locales para Claude Code (Persona 2)

1. Antes de nada, leer `../CLAUDE.md` y `../contracts/` (protocolo y API).
2. Modificar solo archivos dentro de `central/`. Para cualquier otra carpeta, abrir un issue.
3. Respetar `contracts/` al pie de la letra: no inventar campos, tipos, prioridades ni endpoints.
4. Un cambio al contrato se propone en una rama `contrato/<descripcion>` con un PR aparte que
   revisan los tres. Nunca mezclarlo con un PR de esta área.
5. Trabajar en la rama `p2/central-agentes` y abrir PR a `dev` al terminar cada tarea.
6. Lo que no esté definido se marca "por definir" y se pregunta.
7. El registro de eventos solo agrega, nunca borra ni modifica (ADR 0003).
8. Jev solo se llama desde el agente de triaje y nunca baja una prioridad; si falla o tarda, el
   triaje sigue con reglas (ADR 0004 y 0005).
9. Ninguna acción se ejecuta sin aprobación del coordinador.
10. La clave de Jev se lee de `JEV_API_KEY` en `.env`; nunca va en el código.
11. Cada agente tiene su ficha en `../docs/fichas-agentes/`: actualizarla si cambia su alcance.
