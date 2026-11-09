// Copia el worker de MapLibre a public/vendor/ para servirlo desde el propio tablero. Sin esto,
// el componente de mapcn lo pide a unpkg.com y el mapa queda en blanco sin internet. Corre antes de
// `dev` y `build`, así que siempre coincide con la versión instalada.
import { copyFileSync, mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

const require = createRequire(import.meta.url)
const origen = join(dirname(require.resolve("maplibre-gl/package.json")), "dist", "maplibre-gl-worker.mjs")
const destino = new URL("../public/vendor/", import.meta.url)
mkdirSync(destino, { recursive: true })
copyFileSync(origen, new URL("maplibre-gl-worker.mjs", destino))
