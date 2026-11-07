# App y malla: instrucciones locales para Claude Code (Persona 1)

1. Antes de nada, leer `../CLAUDE.md` y `../contracts/` (protocolo y API).
2. Modificar solo archivos dentro de `app/`. Para cualquier otra carpeta, abrir un issue.
3. Respetar `contracts/` al pie de la letra: no inventar campos, tipos, prioridades ni endpoints.
4. Un cambio al contrato se propone en una rama `contrato/<descripcion>` con un PR aparte que
   revisan los tres. Nunca mezclarlo con un PR de esta área.
5. Trabajar en la rama `p1/app-malla` y abrir PR a `dev` al terminar cada tarea.
6. Lo que no esté definido se marca "por definir" y se pregunta.
7. Solo Android/Kotlin. Nada de iOS, macOS ni Swift.
8. El código de bitchat vive en el submódulo `app/bitchat-android`; los cambios se hacen y suben
   en el fork, y aquí solo se actualiza el puntero del submódulo.
9. La prioridad en el celular se calcula solo con reglas; nada de Jev ni de red en el borde.
10. Nunca borrar un reporte local: los vencidos se marcan "no entregado".
