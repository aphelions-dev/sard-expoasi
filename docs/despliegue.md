# Despliegue

Dos formas de correr SARD completo: Docker Compose en un computador, para la demo, y Railway, para
tenerlo en internet con HTTPS. Por qué son cuatro servicios y no uno: ADR 0008.

| Servicio | Qué es | Público |
|---|---|---|
| `central-a`, `central-b` | API y agentes; el registro de eventos en SQLite | Sí, para la pasarela, la app de reportes y el tablero |
| `tablero` | Tablero del coordinador (estático, nginx) | Sí, pero su URL no se publica (no hay login todavía) |
| `reportar` | App web de reportes (estático, nginx, service worker) | Sí |

## Docker Compose (local)

```bash
docker compose up --build                 # centrales en :8001 y :8002, tablero en :5173, reportar en :5174
docker compose run --rm simulador         # reportes sintéticos por la malla simulada
docker compose stop central-a             # cae la A, sigue la B
```

Desde un celular en la misma red, `http://<ip-del-computador>:5174` abre la app de reportes, pero
sin HTTPS el navegador no deja usar el modo sin internet ni la ubicación. Para eso está Railway.

## Railway

Cada servicio sale del mismo repo y lee su configuración de `railway/<servicio>.json` (Dockerfile,
comando, healthcheck y las carpetas que disparan un nuevo despliegue).

### 1. Proyecto

Crear un proyecto nuevo en Railway. Los creados después del 16 de octubre de 2025 resuelven la red
privada en IPv4 y en IPv6. Los anteriores solo resuelven en IPv6, y la central escucha en `0.0.0.0`,
que es IPv4: con un proyecto viejo, A y B no se ven entre sí.

### 2. Servicios

Crear cuatro servicios con **Deploy from GitHub repo** sobre este repo y la rama que se quiera
desplegar. Los nombres tienen que ser exactamente estos: la red privada usa el nombre del servicio
(`central-b.railway.internal`).

| Servicio | Root directory | Config file (Settings) | Volumen | Variables |
|---|---|---|---|---|
| `central-a` | (vacío: la raíz) | `/railway/central-a.json` | montado en `/repo/central/datos` | `PORT=8001`, `CENTRAL_A_URL=http://central-a.railway.internal:8001`, `CENTRAL_B_URL=http://central-b.railway.internal:8002`, `JEV_API_KEY` (opcional, como variable secreta) |
| `central-b` | (vacío: la raíz) | `/railway/central-b.json` | montado en `/repo/central/datos` | `PORT=8002` y las mismas `CENTRAL_*_URL` y `JEV_API_KEY` |
| `tablero` | `/tablero` | `/railway/tablero.json` | no | `PORT=80`, `NEXT_PUBLIC_CENTRAL_A_URL=https://${{central-a.RAILWAY_PUBLIC_DOMAIN}}`, `NEXT_PUBLIC_CENTRAL_B_URL=https://${{central-b.RAILWAY_PUBLIC_DOMAIN}}` |
| `reportar` | `/reportar` | `/railway/reportar.json` | no | `PORT=80` y las mismas dos `NEXT_PUBLIC_*` |

- Las centrales se construyen desde la raíz porque leen `contracts/palabras-criticas.txt`. El
  tablero y la app de reportes, desde su carpeta.
- `PORT` le dice a Railway a qué puerto llevar el dominio y el healthcheck. La central escucha en
  8001 (A) u 8002 (B), y nginx en el 80.
- Las `NEXT_PUBLIC_*` quedan fijas al compilar: los dos Dockerfile las reciben como `ARG`, que es
  como Railway las pasa a la construcción. Si cambia el dominio de una central, hay que volver a
  desplegar el tablero y la app de reportes.
- Railway no deja usar réplicas en un servicio con volumen, y cada redeploy de una central la deja
  caída unos segundos. Mientras no se desplieguen las dos a la vez, la otra atiende.

### 3. Dominios

En **Settings → Networking → Generate domain** de cada servicio. Railway pone el certificado HTTPS.
Primero las centrales (el tablero y la app de reportes las nombran) y después los otros dos.

### 4. Comprobar

1. `https://<dominio de central-a>/salud` responde `{"estado":"ok","central":"A",…}`, y lo mismo la B.
2. En un celular, abrir el dominio de `reportar`, enviar un reporte y ver «✓ Entregado».
3. En el tablero, el reporte aparece en la cola con la marca NUEVO.
4. Detener `central-a` desde Railway. La app de reportes sube a la B, y el tablero avisa que está
   trabajando con el respaldo.

## Lo que falta

- **Autenticación.** La central no pide credencial a nadie (`docs/riesgos.md`). La URL del tablero
  no se publica, pero las de las centrales van dentro del código de la app de reportes y cualquiera
  puede leerlas: con ellas se puede aprobar o cambiar recursos. Por eso los datos siguen siendo
  sintéticos hasta la próxima entrega.
- **Regiones.** Está por definir si A y B van en regiones distintas de Railway (ADR 0008).
