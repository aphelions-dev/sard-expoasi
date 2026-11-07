/**
 * Genera public/geo/lugares.geojson: hospitales, clínicas y estaciones de bomberos de Manizales
 * y Villamaría, desde OpenStreetMap (© colaboradores de OpenStreetMap, licencia ODbL).
 *
 *   node scripts/lugares-osm.mjs
 *
 * Se corre a mano y el resultado se sube al repo: el tablero no depende de internet para
 * dibujarlos. Adaptado de scripts/import-osm-sites.mjs de lufigir/manizalesdepie (usado con
 * permiso), que los cargaba en Supabase; aquí se escribe un archivo fijo.
 */
import { writeFile } from "node:fs/promises";

const SERVIDORES = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
// Rectángulo de la zona urbana de Manizales y Villamaría (sur, oeste, norte, este). La búsqueda
// por área administrativa devolvía solo una parte del municipio.
const ZONA = "4.98,-75.58,5.11,-75.42";
const CONSULTA = `
[out:json][timeout:180];
nwr["amenity"~"^(hospital|clinic|fire_station)$"](${ZONA});
out center tags;
`;

const TIPO = { hospital: "hospital", clinic: "clinica", fire_station: "bomberos" };

async function consultar() {
  for (const url of SERVIDORES) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "User-Agent": "sard-tablero/0.1 (hackathon SARD, UNAL Manizales)" },
      body: new URLSearchParams({ data: CONSULTA }),
    }).catch(() => null);
    if (r?.ok) return r.json();
    console.warn(`${url} respondió ${r?.status ?? "sin conexión"}; probando el siguiente`);
  }
  throw new Error("Ningún servidor de Overpass respondió");
}

const { elements } = await consultar();

const features = elements
  .map((el) => {
    const lon = el.lon ?? el.center?.lon;
    const lat = el.lat ?? el.center?.lat;
    const tipo = TIPO[el.tags?.amenity];
    if (lon == null || lat == null || !tipo) return null;
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [+lon.toFixed(6), +lat.toFixed(6)] },
      properties: {
        id: `${el.type}/${el.id}`,
        tipo,
        nombre: el.tags.name ?? (tipo === "bomberos" ? "Estación de bomberos" : "Sin nombre en OSM"),
      },
    };
  })
  .filter(Boolean)
  // Los consultorios odontológicos vienen como `clinic` pero no atienden una emergencia.
  .filter((f) => !/dental|odonto/i.test(f.properties.nombre))
  .sort((a, b) => a.properties.id.localeCompare(b.properties.id));

const salida = new URL("../public/geo/lugares.geojson", import.meta.url);
await writeFile(
  salida,
  JSON.stringify({
    type: "FeatureCollection",
    atribucion: "© colaboradores de OpenStreetMap, ODbL",
    features,
  }) + "\n",
);
const n = (t) => features.filter((f) => f.properties.tipo === t).length;
console.log(`${features.length} lugares: ${n("hospital")} hospitales, ${n("clinica")} clínicas, ${n("bomberos")} bomberos`);
