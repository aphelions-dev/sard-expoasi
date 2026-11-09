# SARD — instrucciones para Claude Code (todo el equipo)

## Contexto

Sistema de reportes de emergencia: celular Android → malla Bluetooth (fork de bitchat Android) →
celular pasarela con internet → central de riesgo con agentes → tablero con coordinador humano.

- Principio: **reglas en el borde, Jev en el centro, humanos al final.**
- Jev (TypeSafe AI) solo en la central. Si falla, el triaje sigue con reglas.
- Jev nunca baja una prioridad; las reglas ganan cuando hay palabra crítica (ADR 0005).
- El registro de eventos de la central solo agrega, nunca borra (ADR 0003).
- Ninguna acción se ejecuta sin aprobación humana.
- La app completa es Android, sin Swift. El iPhone entra con el bitchat oficial (relevo) y con la
  app web `reportar/` (ADR 0007 y 0008).

## Contrato (resumen; la fuente es `contracts/protocolo-sard1.md`)

```
SARD1|<id>|<prioridad>|<tipo>|<personas>|<banderas>|<geohash>|<hora_unix>|<texto>
SACK|<id>
```

- prioridad `P1`…`P4`; tipo `ATRAP MEDIC FUEGO VIA DESAP OTRO`; banderas 3 dígitos
  (atrapados, heridos, niños/adultos mayores); geohash 6 caracteres o vacío.
- Reenviar P1/P2 primero sin descartar P3/P4; reintentos con espera creciente hasta `SACK`;
  cada id se acepta una vez; ordenar por `hora_unix`; lo vencido se marca, no se borra.

## Reglas para todos

1. Leer este archivo y `contracts/` antes de tocar código.
2. Modificar solo la carpeta de tu área. Si necesitas algo de otra área, abrir un issue.
3. No inventar campos, tipos ni endpoints. Si el contrato no lo dice, se propone en una rama
   `contrato/<descripcion>` con un PR aparte que revisan los tres.
4. Lo no definido se marca "por definir"; no se supone.
5. Commits en español con prefijo `feat`, `fix`, `docs`, `test`, `chore`, `contrato`.
6. PR a `dev`, nunca push directo a `main` ni a `dev`.
7. Sin secretos en el repo: usar `.env` (plantilla en `.env.example`).
8. Datos de prueba siempre sintéticos.

## Mapa

`app/` P1 · `central/` P2 · `tablero/` `reportar/` `simulador/` `pruebas/` `datos/` P3 · `contracts/` los tres ·
estilo en `diseno/tokens.json` (se edita ahí y se corre `node diseno/generar.mjs`) ·
despliegue en `docs/despliegue.md` · plan en `docs/plan.md` · decisiones en `docs/decisiones/`.
