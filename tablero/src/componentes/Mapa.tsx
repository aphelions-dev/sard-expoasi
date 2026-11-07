// Mapa de incidentes sobre MapLibre (v5: la v6 quitó la exportación por defecto; ver el README
// de lufigir/manizalesdepie). Sin teselas funciona igual: barrios, celdas y lugares son archivos
// locales. Con internet se puede poner debajo el mapa de calles de CARTO.
import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MapaML } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Incidente } from "../api/tipos";
import { celda, type Geo } from "../geo/geo";

interface Props {
  geo: Geo;
  incidentes: Incidente[];
  seleccion: string | null;
  onSeleccion: (id: string) => void;
  tema: string;
}

const CENTRO: [number, number] = [-75.5, 5.058];
// Teselas estándar de OpenStreetMap: no piden clave (las de CARTO ya la piden). En oscuro se
// invierten y se les quita el color para que no compitan con los colores de prioridad.
const TESELAS = ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"];
const PINTURA_CALLES: Record<string, [string, number][]> = {
  dark: [["raster-saturation", -1], ["raster-brightness-min", 0.9], ["raster-brightness-max", 0.05], ["raster-opacity", 0.5]],
  light: [["raster-saturation", -0.85], ["raster-brightness-min", 0], ["raster-brightness-max", 1], ["raster-opacity", 0.55]],
};

function token(nombre: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
}

function celdas(incidentes: Incidente[], seleccion: string | null) {
  return {
    type: "FeatureCollection" as const,
    // Lo último se dibuja encima: P4 primero, P1 al final y la seleccionada sobre todo.
    features: incidentes
      .filter((i) => i.geohash)
      .sort((a, b) => Number(a.id === seleccion) - Number(b.id === seleccion) || b.prioridad.localeCompare(a.prioridad))
      .map((i) => ({
        type: "Feature" as const,
        properties: { id: i.id, prioridad: i.prioridad, sel: i.id === seleccion },
        geometry: { type: "Polygon" as const, coordinates: [celda(i.geohash!)] },
      })),
  };
}

/** Colores leídos de los tokens: la paleta vive en un solo lugar (tokens.css). */
function pintar(m: MapaML) {
  const porPrioridad = ["match", ["get", "prioridad"], "P1", token("--p1"), "P2", token("--p2"), "P3", token("--p3"), token("--p4")];
  m.setPaintProperty("fondo", "background-color", token("--bg"));
  m.setPaintProperty("barrios-relleno", "fill-color", token("--superficie-2"));
  m.setPaintProperty("barrios-borde", "line-color", token("--borde-fuerte"));
  m.setPaintProperty("celdas-relleno", "fill-color", porPrioridad as never);
  m.setPaintProperty("celdas-borde", "line-color", ["case", ["get", "sel"], token("--texto"), porPrioridad] as never);
  m.setPaintProperty("lugares", "circle-color", token("--superficie"));
  m.setPaintProperty("lugares", "circle-stroke-color", [
    "match", ["get", "tipo"], "bomberos", token("--texto"), token("--accion-texto"),
  ] as never);
}

export function Mapa({ geo, incidentes, seleccion, onSeleccion, tema }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaML | null>(null);
  const [listo, setListo] = useState(false);
  const [calles, setCalles] = useState(true);
  const [barrio, setBarrio] = useState<string | null>(null);
  const onSel = useRef(onSeleccion);
  onSel.current = onSeleccion;

  useEffect(() => {
    const m = new maplibregl.Map({
      container: caja.current!,
      center: CENTRO,
      zoom: 12.6,
      attributionControl: { compact: true },
      style: {
        version: 8,
        sources: {
          calles: {
            type: "raster",
            tiles: TESELAS,
            tileSize: 256,
            maxzoom: 19,
            attribution: '© <a href="https://www.openstreetmap.org/copyright">colaboradores de OpenStreetMap</a>',
          },
          barrios: {
            type: "geojson",
            data: geo.barrios as never,
            attribution: "Barrios: SIG Alcaldía de Manizales",
          },
          celdas: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
          lugares: { type: "geojson", data: geo.lugares as never, attribution: "Lugares: OpenStreetMap (ODbL)" },
        },
        layers: [
          { id: "fondo", type: "background", paint: { "background-color": "#000" } },
          {
            id: "calles",
            type: "raster",
            source: "calles",
            // Desde el primer cuadro, para que no destelle el mapa claro antes de `load`.
            paint: Object.fromEntries(PINTURA_CALLES[document.documentElement.dataset.theme ?? "dark"] ?? PINTURA_CALLES.dark),
          },
          { id: "barrios-relleno", type: "fill", source: "barrios", paint: { "fill-opacity": 0.35 } },
          { id: "barrios-borde", type: "line", source: "barrios", paint: { "line-width": 0.8 } },
          {
            id: "celdas-relleno",
            type: "fill",
            source: "celdas",
            paint: { "fill-opacity": ["case", ["get", "sel"], 0.55, 0.3] },
          },
          {
            id: "celdas-borde",
            type: "line",
            source: "celdas",
            paint: { "line-width": ["case", ["get", "sel"], 3, 1.5] },
          },
          {
            id: "lugares",
            type: "circle",
            source: "lugares",
            paint: {
              "circle-radius": ["match", ["get", "tipo"], "clinica", 4, 6],
              "circle-stroke-width": 2.5,
            },
          },
        ],
      },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.on("load", () => {
      pintar(m);
      setListo(true);
    });
    m.on("click", "celdas-relleno", (e) => {
      const id = e.features?.[0]?.properties?.id;
      if (id) onSel.current(id);
    });
    m.on("click", "lugares", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const [lon, lat] = (f.geometry as { coordinates: [number, number] }).coordinates;
      new maplibregl.Popup({ closeButton: false, className: "popup-lugar" })
        .setLngLat([lon, lat])
        .setText(`${f.properties.nombre} · ${{ hospital: "hospital", clinica: "clínica", bomberos: "bomberos" }[f.properties.tipo as string]}`)
        .addTo(m);
    });
    for (const capa of ["celdas-relleno", "lugares"]) {
      m.on("mouseenter", capa, () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", capa, () => (m.getCanvas().style.cursor = ""));
    }
    m.on("mousemove", "barrios-relleno", (e) => setBarrio(e.features?.[0]?.properties?.name ?? null));
    m.on("mouseleave", "barrios-relleno", () => setBarrio(null));
    mapa.current = m;
    return () => m.remove();
  }, [geo]);

  useEffect(() => {
    if (listo) (mapa.current!.getSource("celdas") as GeoJSONSource).setData(celdas(incidentes, seleccion));
  }, [listo, incidentes, seleccion]);

  useEffect(() => {
    const m = mapa.current;
    if (!listo || !m) return;
    pintar(m);
    for (const [prop, valor] of PINTURA_CALLES[tema] ?? PINTURA_CALLES.dark) m.setPaintProperty("calles", prop, valor);
  }, [listo, tema]);

  useEffect(() => {
    if (listo) mapa.current!.setLayoutProperty("calles", "visibility", calles ? "visible" : "none");
  }, [listo, calles]);

  // Llevar la vista al incidente elegido, sin animación si el usuario la pidió reducida.
  useEffect(() => {
    const inc = incidentes.find((i) => i.id === seleccion);
    if (!listo || !inc?.geohash) return;
    const [[o, s], , [e, n]] = celda(inc.geohash);
    const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
    mapa.current!.easeTo({ center: [(o + e) / 2, (s + n) / 2], duration: quieto ? 0 : 500 });
    // Solo al cambiar de selección, no en cada sondeo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, seleccion]);

  const sinUbicacion = incidentes.filter((i) => !i.geohash).length;

  return (
    <div className="mapa">
      <div ref={caja} className="mapa-lienzo" role="region" aria-label="Mapa de incidentes" />
      <div className="mapa-leyenda">
        <span className="leyenda-titulo">Celda de ubicación (±600 m)</span>
        {(["P1", "P2", "P3", "P4"] as const).map((p) => (
          <span key={p} className="leyenda-item">
            <span className={`muestra m-${p.toLowerCase()}`} aria-hidden="true" />
            {p}
          </span>
        ))}
        <span className="leyenda-item">
          <span className="muestra-punto hospital" aria-hidden="true" />
          Hospital o clínica
        </span>
        <span className="leyenda-item">
          <span className="muestra-punto bomberos" aria-hidden="true" />
          Bomberos
        </span>
        <label className="leyenda-calles">
          <input type="checkbox" checked={calles} onChange={(e) => setCalles(e.target.checked)} />
          Calles (requiere internet)
        </label>
      </div>
      {barrio && <div className="mapa-barrio">{barrio}</div>}
      {sinUbicacion > 0 && (
        <div className="mapa-aviso">
          {sinUbicacion} incidente{sinUbicacion > 1 ? "s" : ""} sin ubicación: solo en la cola
        </div>
      )}
    </div>
  );
}
