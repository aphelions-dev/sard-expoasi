# Tablero del coordinador

**Dueño:** Persona 3 (@CrArenas) · **Rama:** `p3/tablero-pruebas`

Stack: **React 19 + Vite + TypeScript**. Sin backend propio: solo consume la API de la central
(`contracts/api-central.md`).

## Cómo correrlo

Con las centrales arriba (`central/README.md`), desde `tablero/`:

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # pruebas de la lógica (failover, filtros, mensajes de error, barrios y mapa)
npm run build      # versión de producción en dist/
```

Las URLs de las centrales salen de `VITE_CENTRAL_A_URL` y `VITE_CENTRAL_B_URL` (plantilla en
`.env.example`); vacías, usa `localhost:8001` y `:8002`.

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
- **Mapa** (pestaña "Mapa"): cada incidente es la **celda de su geohash** (~600 m × 1,2 km)
  coloreada por prioridad, no un punto, porque la ubicación real está en algún lugar de ese
  rectángulo. Encima, barrios, hospitales, clínicas y bomberos; clic en una celda la elige en la
  cola. **Funciona sin internet**: todo lo dibujado es local; las calles de OpenStreetMap son una
  capa opcional que se apaga.
- **Cerca del incidente**: hospitales/clínicas y estaciones de bomberos más cercanos en línea recta.
- El nombre del coordinador, el tema (oscuro por defecto, claro para proyector) y la vista se
  recuerdan en el navegador.

## Datos geográficos

En `public/geo/`, archivos fijos para que el mapa no dependa de internet:

| Archivo | Fuente | Licencia / uso |
|---------|--------|----------------|
| `barrios.geojson` | "Límite de barrios Municipio de Manizales", SIG Alcaldía de Manizales (Acuerdo 589 de 2004). Tomado de [lufigir/manizalesdepie](https://github.com/lufigir/manizalesdepie), con permiso | Dato abierto de la Alcaldía |
| `lugares.geojson` | Hospitales, clínicas y bomberos de OpenStreetMap. Se regenera con `node scripts/lugares-osm.mjs` (adaptado de `scripts/import-osm-sites.mjs` de manizalesdepie) | © colaboradores de OpenStreetMap, ODbL |

La capa de calles usa las teselas estándar de OpenStreetMap (con atribución en el mapa). El punto
en polígono (`src/geo/geo.ts`) viene de `lib/geo.ts` de manizalesdepie. MapLibre se mantiene en
**v5**: la v6 cambió las exportaciones.

## Diseño

Elegido con la skill `ui-ux-pro-max`: estilo tablero denso sobre base suiza minimalista, Fira Sans
para texto y Fira Code para ids, geohash y horas (empaquetadas, funcionan sin internet). Tokens en
`src/estilos/tokens.css`:

- El color fuerte se reserva para la prioridad: **P1 rojo, P2 naranja, P3 ámbar, P4 gris**, siempre
  con su texto (`P1 CRÍTICA`), nunca solo color.
- Azul de seguridad para las acciones, para no confundir un botón con una alerta.
- Ámbar para avisos (revisar, sin ubicación, Jev caído), verde solo para "aprobada" y "en línea",
  violeta para "posible rumor".
- Contraste de texto 4,5:1 en los dos temas; foco visible; flechas arriba/abajo recorren la cola;
  botones de 44 px; respeta `prefers-reduced-motion`; en pantallas angostas, cola y detalle se
  alternan.

## No le toca

Lógica de triaje (vive en la central), app Android, base de datos de la central.

## Tareas por hito

- **Hito 2:** mostrar los reportes recibidos. Hecho (#9).
- **Hito 3:** incidentes con evidencia, incertidumbre y aprobación. Hecho (#24).
- **Hito 4:** estado de las centrales A/B y de Jev. Hecho. Falta: recursos (`GET/POST /recursos`) y
  rechazados (`GET /rechazados`).
- **Hito 5:** pulido para la demo.

## Terminado

El coordinador ve los incidentes ordenados por prioridad, entiende por qué cada uno tiene esa
prioridad, y ninguna acción avanza sin que la apruebe.
