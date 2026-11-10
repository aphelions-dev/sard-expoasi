# 0008 — App de reportes aparte del tablero, y despliegue en Railway

**Estado:** aceptada

**Contexto:** la app web de reportes (ADR 0007) nació como una ruta del tablero (`/reportar/`).
Para usarla desde un celular hay que publicarla en internet con HTTPS, y entonces la pregunta fue
si podía seguir siendo el mismo servicio que el tablero. No conviene, por dos razones:

- La usan públicos distintos. La app de reportes es para cualquier ciudadano; el tablero, para
  quien coordina. En un mismo sitio, la URL pública de la app también sirve el panel que aprueba
  despachos.
- La central no tiene autenticación y su CORS es `*`: aprobar, registrar recursos y `POST /eventos`
  están abiertos para quien conozca la URL. Mientras corrió solo en la red de la demo no importaba;
  publicada, sí.

**Decisión:**

1. La app de reportes vive en `reportar/`, como app propia: su Next, su nginx y su dominio. Comparte
   con el tablero los tokens (`diseno/tokens.json` genera el tema de las dos) y los componentes de
   shadcn, que se copian a cada app como manda shadcn.
2. Se despliega en Railway con cuatro servicios desde el mismo repo: `central-a`, `central-b`,
   `tablero` y `reportar`. Cada servicio lee su configuración de `railway/<servicio>.json`. Las
   centrales guardan el SQLite en un volumen y se sincronizan por la red privada
   (`central-b.railway.internal`), así que `/eventos` no tiene que pasar por internet. Los pasos
   están en `docs/despliegue.md`.
3. La autenticación queda para la próxima entrega y está anotada en `docs/riesgos.md`. Mientras
   tanto los datos son sintéticos y la URL del tablero no se publica.

**Consecuencias:**

- Railway da HTTPS en cada dominio, que es lo que necesitan el service worker y la ubicación en el
  celular (ADR 0007).
- En Railway un servicio con volumen no admite réplicas y se cae unos segundos en cada redeploy. El
  par A/B lo cubre si no se despliegan las dos a la vez.
- **Por definir:** si A y B van en regiones distintas de Railway. En la misma región, el par no
  protege de una caída de esa región.
