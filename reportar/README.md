# App web de reportes

**Dueño:** Persona 3 · ADR 0007 (por qué existe) y 0008 (por qué va aparte del tablero).

Para el celular que no tiene la app Android, como un iPhone. Arma el mismo `SARD1` que la app, con
las reglas de prioridad del celular y `public/palabras-criticas.txt`, una copia de `contracts/` que
`npm run dev` y `npm run build` refrescan (la imagen de Docker solo ve `reportar/`). Guarda los
reportes en el navegador, abre sin internet (`public/sw.js`) y los sube con `POST /reportes` a la
central A o, si no responde, a la B. Sin internet, «Copiar para bitchat» deja el mensaje listo para
el chat público de bitchat.

## Cómo correrla

Con las centrales arriba, desde `reportar/`:

```bash
npm install
npm run dev -- -p 5174   # http://localhost:5174
npm test                 # prioridad, mensaje, cola de reintentos y copia de las palabras críticas
npm run build            # versión estática en out/
```

En Docker: `docker compose up --build` la sirve en `http://localhost:5174`. Las URLs de las
centrales salen de `NEXT_PUBLIC_CENTRAL_A_URL` y `NEXT_PUBLIC_CENTRAL_B_URL` al compilar.

En un celular, el service worker y la ubicación solo funcionan con HTTPS: para probarla en uno, se
despliega (`docs/despliegue.md`).

## Estructura

- `app/`: la página y los estilos. `tokens.css` se genera desde `diseno/tokens.json`.
- `components/app-reportar.tsx`: el formulario y *Mis reportes*.
- `components/ui/`: los componentes de shadcn que usa, copiados del tablero. No se editan a mano.
- `lib/`: reglas del `SARD1` (`sard1.ts`), cola de reintentos (`cola.ts`) y subida a la central
  (`envio.ts`), con sus pruebas.
- `public/`: service worker, manifiesto e íconos (los PNG salen de `favicon.svg`).
