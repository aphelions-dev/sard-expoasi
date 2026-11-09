# Tablero del coordinador

**Dueño:** Persona 3 (@CrArenas) · **Rama:** `p3/tablero-pruebas`

Stack: **Next.js 16 (export estático) + React 19 + TypeScript + shadcn/ui** (estilo `base-mira`,
sobre Base UI) y el mapa de [mapcn](https://mapcn.dev) sobre MapLibre. Sin backend propio: solo
consume la API de la central (`contracts/api-central.md`).

## Cómo correrlo

Con las centrales arriba (`central/README.md`), desde `tablero/`:

```bash
npm install
npm run dev -- -p 5173   # http://localhost:5173
npm test                 # pruebas de la lógica (failover, filtros, mensajes de error, barrios y mapa)
npm run build            # versión estática en out/; servirla en la raíz con cualquier servidor estático
```

Las URLs de las centrales salen de `NEXT_PUBLIC_CENTRAL_A_URL` y `NEXT_PUBLIC_CENTRAL_B_URL`
(plantilla en `.env.example`); vacías, usa `localhost:8001` y `:8002`.

## Estructura

- `app/`: la página y los estilos. Los colores y su tema de Tailwind están en `tokens.css`,
  generado desde `diseno/tokens.json` (ver `diseno/README.md`).
- `components/tablero/`: las piezas del tablero (barra de estado, cola, mapa, panel, recursos).
- `components/ui/`: lo escriben los CLI de shadcn y mapcn. No se editan a mano; se envuelven.
- `lib/`: cliente de la API, tipos del contrato y lógica sin interfaz (con sus pruebas).

## Qué hace

- **Cola** con los incidentes en el orden que decide la central (`motivo_orden`). Los filtros
  `P1–P2`, `Revisar` y `P3–P4` solo esconden de la vista, nunca reordenan, y los contadores
  muestran cuántos hay en cada uno.
- **Detalle**: por qué está en ese lugar, ubicación (geohash y coordenadas aproximadas), impacto,
  vigencia, **incertidumbre** (corroboración, dispositivos, testigos directos, motivos de revisión,
  contradicciones, discrepancias entre centrales, sin IA o sin ubicación) y la **evidencia** de cada
  reporte con las señales del triaje y su origen (formulario, texto o Jev).
- **Acción propuesta** con entidad, recurso disponible, incidentes que compiten por él y lo que falta
  confirmar. Aprobar o rechazar es un botón explícito; si el incidente está marcado para revisar,
  aprobar exige una nota (el `422` del contrato).
- **Salud** de la central A, la B y Jev (`GET /salud` cada 3 s). Si la A no responde, el tablero lee
  y decide en la B y lo avisa.
- **Barrio** de cada incidente en la cola y el detalle ("Chipre · comuna 01"), calculado desde el
  geohash con los límites oficiales. Fuera de Manizales (Villamaría) dice "sin barrio": no se
  inventa un nombre.
- **Mapa** (siempre visible, al centro): un rombo por celda de geohash con el color de la prioridad
  más alta, el icono del tipo, cuántos incidentes hay en la celda y un punto si alguno está para
  revisar. Lo ya decidido se atenúa. La celda (~600 m × 1,2 km) se dibuja punteada porque la
  ubicación real está en algún lugar de ese rectángulo. Al pasar el cursor, un tooltip resume los
  incidentes de la celda; el clic los recorre. Hospitales, clínicas y bomberos van en círculos
  atenuados. **Funciona sin internet**: todo lo dibujado es local; las calles de OpenStreetMap son
  una capa opcional que se apaga.
- **Cerca del incidente**: hospitales/clínicas y estaciones de bomberos más cercanos en línea recta.
- **Recursos** (pestaña): los recursos del contrato (equipo de rescate, máquina de bomberos,
  ambulancia, equipo de búsqueda, cuadrilla) unidad por unidad, como en el SCI-211: cuántas
  están disponibles, asignadas o fuera de servicio, y las solicitudes sin unidad, con aviso si
  faltan. Quien representa a la entidad registra cada unidad con su matrícula
  (`POST /recursos/unidades`) y reporta sus cambios: asignarla a un incidente, liberarla o
  marcarla no disponible con una nota. Aprobar un incidente solo solicita el recurso. Un recurso
  sin unidades se marca: la coordinación propone sin saber si hay.
- **Rechazados** (pestaña, con el número sin recuperar): los mensajes mal formados o cortados, en el
  orden de la central, con sus motivos y solo los campos que llegaron (`GET /rechazados`). Marca
  "Recuperado" si después llegó una versión válida.
- El nombre del coordinador y el tema (oscuro por defecto, claro para proyector) se recuerdan en
  el navegador.

## Datos geográficos

En `public/geo/`, archivos fijos para que el mapa no dependa de internet:

| Archivo | Fuente | Licencia / uso |
|---------|--------|----------------|
| `barrios.geojson` | "Límite de barrios Municipio de Manizales", SIG Alcaldía de Manizales (Acuerdo 589 de 2004). Tomado de [lufigir/manizalesdepie](https://github.com/lufigir/manizalesdepie), con permiso | Dato abierto de la Alcaldía |
| `lugares.geojson` | Hospitales, clínicas y bomberos de OpenStreetMap. Se regenera con `node scripts/lugares-osm.mjs` (adaptado de `scripts/import-osm-sites.mjs` de manizalesdepie) | © colaboradores de OpenStreetMap, ODbL |

La capa de calles usa las teselas estándar de OpenStreetMap (con atribución en el mapa). El punto
en polígono (`lib/geo.ts`) viene de `lib/geo.ts` de manizalesdepie, y la conversión de colores
para MapLibre (`lib/color.ts`), de su `barrio-layer.tsx`. MapLibre va en **v6**, la que pide el mapa
de mapcn. Su worker se copia a `public/vendor/` antes de `dev` y `build`
(`scripts/copiar-worker.mjs`): si no, mapcn lo pide a unpkg.com y el mapa no carga sin internet.

## Diseño

Consola de operaciones, con el reparto de los sistemas de despacho: franja de estado arriba; cola,
mapa y decisión en tres paneles redimensionables; recursos fijos abajo. Fira Sans para el texto y
Fira Code para ids, geohash y horas. Tokens en `app/globals.css`:

- Grises neutros, bordes finos, radio chico, sin sombras ni degradados.
- El color se reserva para el estado: **P1 rojo, P2 naranja, P3 ámbar, P4 gris azulado**, siempre
  con su texto; magenta para "revisar", verde para "aprobada" y "en línea". Nunca un color
  literal en un componente.
- La acción principal es neutra (no azul ni verde), para que no compita con los colores de estado.
- La evidencia va antes de la propuesta, y los botones de decisión quedan fijos al pie del panel.
- En el mapa, rombos para incidentes y círculos para puntos de atención (simbología de la FGDC), y
  el mapa base lo menos saliente posible.
- Foco visible, flechas arriba/abajo recorren la cola, respeta `prefers-reduced-motion`; en
  pantallas angostas, cola, mapa y panel se alternan.

## No le toca

Lógica de triaje (vive en la central), app Android, base de datos de la central.

## Tareas por hito

- **Hito 2:** mostrar los reportes recibidos. Hecho (#9).
- **Hito 3:** incidentes con evidencia, incertidumbre y aprobación. Hecho (#24).
- **Hito 4:** estado de las centrales A/B y de Jev, recursos y rechazados. Hecho.
- **Hito 5:** pulido para la demo.

## Terminado

El coordinador ve los incidentes ordenados por prioridad, entiende por qué cada uno tiene esa
prioridad, y ninguna acción avanza sin que la apruebe.
