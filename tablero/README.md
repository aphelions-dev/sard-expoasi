# Tablero del coordinador

**Dueño:** Persona 3 (@CrArenas) · **Rama:** `p3/tablero-pruebas`

Stack: **React 19 + Vite + TypeScript**. Sin backend propio: solo consume la API de la central
(`contracts/api-central.md`).

## Cómo correrlo

Con las centrales arriba (`central/README.md`), desde `tablero/`:

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # pruebas de la lógica (failover, filtros, mensajes de error)
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
- El nombre del coordinador y el tema (oscuro por defecto, claro para proyector) se recuerdan en el
  navegador.

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
