// Barrios oficiales y lugares de atención, cargados de archivos fijos en public/geo/: el tablero
// los dibuja sin depender de internet.
//
// - barrios.geojson: "Límite de barrios Municipio de Manizales", SIG Alcaldía de Manizales
//   (Acuerdo 589 de 2004). Tomado de lufigir/manizalesdepie, con permiso. Villamaría no tiene un
//   dato equivalente: ahí se dice "sin barrio" en vez de inventar un nombre.
// - lugares.geojson: hospitales, clínicas y bomberos de OpenStreetMap (scripts/lugares-osm.mjs).
import geohash from "ngeohash";

type Anillo = [number, number][];
type Geometria = { type: "Polygon"; coordinates: Anillo[] } | { type: "MultiPolygon"; coordinates: Anillo[][] };

export interface ColeccionBarrios {
  type: "FeatureCollection";
  features: { type: "Feature"; properties: { id: string; name: string; comuna: string; lon: number; lat: number }; geometry: Geometria }[];
}

export interface ColeccionLugares {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: { id: string; tipo: "hospital" | "clinica" | "bomberos"; nombre: string };
    geometry: { type: "Point"; coordinates: [number, number] };
  }[];
}

export interface Barrio {
  id: string;
  nombre: string;
  comuna: string;
}

export interface Geo {
  barrios: ColeccionBarrios;
  lugares: ColeccionLugares;
}

export async function cargarGeo(): Promise<Geo> {
  const [barrios, lugares] = await Promise.all(
    ["/geo/barrios.geojson", "/geo/lugares.geojson"].map((u) => fetch(u).then((r) => r.json())),
  );
  return { barrios, lugares };
}

// Punto en polígono por rayos, de lib/geo.ts de manizalesdepie: unos 115 barrios, sin huecos.
function enAnillo(lon: number, lat: number, anillo: Anillo): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

export function contiene(g: Geometria, lon: number, lat: number): boolean {
  const poligonos = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return poligonos.some((anillos) => anillos.length > 0 && enAnillo(lon, lat, anillos[0]));
}

/** Barrio del centro de la celda del geohash, o `null` si cae fuera de Manizales. */
export function barrioDe(barrios: ColeccionBarrios, gh: string): Barrio | null {
  const { latitude, longitude } = geohash.decode(gh);
  const f = barrios.features.find((b) => contiene(b.geometry, longitude, latitude));
  return f ? { id: f.properties.id, nombre: f.properties.name, comuna: f.properties.comuna } : null;
}

/** `barrioDe` con memoria: punto en polígono contra ~115 barrios, una vez por geohash. */
export function buscadorDeBarrio(barrios: ColeccionBarrios): (gh: string | null) => Barrio | null {
  const cache = new Map<string, Barrio | null>();
  return (gh) => {
    if (!gh) return null;
    if (!cache.has(gh)) cache.set(gh, barrioDe(barrios, gh));
    return cache.get(gh)!;
  };
}

/** La celda del geohash como polígono: la ubicación real está en algún punto de ese rectángulo. */
export function celda(gh: string): Anillo {
  const [s, o, n, e] = geohash.decode_bbox(gh);
  return [
    [o, s],
    [e, s],
    [e, n],
    [o, n],
    [o, s],
  ];
}

/** Metros entre dos puntos lon/lat; suficiente a escala de ciudad. */
export function metros([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]): number {
  const rad = Math.PI / 180;
  const x = (lon2 - lon1) * rad * Math.cos(((lat1 + lat2) / 2) * rad);
  const y = (lat2 - lat1) * rad;
  return Math.hypot(x, y) * 6_371_000;
}

/** Los `n` lugares de un tipo más cercanos al centro de la celda. */
export function cercanos(lugares: ColeccionLugares, gh: string, tipos: string[], n = 3) {
  const { latitude, longitude } = geohash.decode(gh);
  return lugares.features
    .filter((l) => tipos.includes(l.properties.tipo))
    .map((l) => ({ ...l.properties, metros: metros([longitude, latitude], l.geometry.coordinates) }))
    .sort((a, b) => a.metros - b.metros)
    .slice(0, n);
}
