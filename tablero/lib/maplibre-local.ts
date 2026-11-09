// Se importa antes que el mapa de mapcn: con el worker ya configurado, mapcn no lo pide a unpkg.com
// y el mapa funciona sin internet. El archivo lo copia scripts/copiar-worker.mjs.
import { setWorkerUrl } from "maplibre-gl"

setWorkerUrl("/vendor/maplibre-gl-worker.mjs")
