"use client"

// Mapa de incidentes sobre el `Map` de mapcn (MapLibre 5). Barrios, celdas y lugares son archivos
// locales, así que sin internet se ve igual; las calles de OpenStreetMap son una capa opcional.
//
// Jerarquía visual (Du et al. 2021, diseño de mapas de crisis): el mapa base va lo menos saliente
// posible; los incidentes, lo más. Color y tamaño marcan la gravedad; la forma (rombo = incidente,
// círculo = punto de atención, como en la simbología de la FGDC) dice qué es cada cosa.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import type { StyleSpecification } from "maplibre-gl"
import { ChevronDown, FireExtinguisher, Maximize2, Minimize2, Scan } from "lucide-react"

import "@/lib/maplibre-local" // antes que el mapa: worker local, sin internet
import { Map, MapControls, MapGeoJSON, MapMarker, MarkerContent, MarkerTooltip, useMap } from "@/components/ui/map"
import type { Incidente } from "@/lib/api/tipos"
import { token } from "@/lib/color"
import { TIPO } from "@/lib/formato"
import { celda, type Barrio, type Geo } from "@/lib/geo"
import { cn } from "@/lib/utils"

import { ICONO_TIPO } from "./iconos"
import { MarcadorIncidente } from "./marcador-incidente"

interface Props {
  geo: Geo
  incidentes: Incidente[]
  seleccion: string | null
  onSeleccion: (id: string) => void
  barrio: (gh: string | null) => Barrio | null
  completo: boolean
  onCompleto: (v: boolean) => void
}

const CENTRO: [number, number] = [-75.5, 5.058]
const NOMBRE_LUGAR = { hospital: "Hospital", clinica: "Clínica", bomberos: "Bomberos" } as const

// Teselas estándar de OpenStreetMap: no piden clave. Sin color y atenuadas para que no compitan
// con los colores de prioridad; en oscuro, además, invertidas.
const PINTURA_CALLES = {
  dark: { "raster-saturation": -1, "raster-brightness-min": 0.9, "raster-brightness-max": 0.05, "raster-opacity": 0.45 },
  light: { "raster-saturation": -0.9, "raster-brightness-min": 0, "raster-brightness-max": 1, "raster-opacity": 0.5 },
} as const

// Un solo estilo, fijo, para los dos temas. Cambiar de estilo hace que mapcn lo reemplace de forma
// asíncrona, y dos cambios seguidos (tema y colores) dejaban el mapa con el del tema anterior. El
// tema se aplica repintando estas dos capas en el mismo mapa (`PinturaBase`).
const ESTILO: StyleSpecification = {
  version: 8,
  sources: {
    calles: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">colaboradores de OpenStreetMap</a>',
    },
  },
  layers: [
    { id: "fondo", type: "background", paint: { "background-color": "rgba(0, 0, 0, 0)" } },
    { id: "calles", type: "raster", source: "calles", paint: PINTURA_CALLES.dark },
  ],
}
const ESTILOS = { light: ESTILO, dark: ESTILO }

/** Fondo y calles según el tema, sobre el mismo estilo. */
function PinturaBase({ tema, fondo, calles }: { tema: "light" | "dark"; fondo: string; calles: boolean }) {
  const { map, isLoaded } = useMap()
  useEffect(() => {
    if (!map || !isLoaded || !map.getLayer("calles")) return
    map.setPaintProperty("fondo", "background-color", fondo)
    for (const [prop, valor] of Object.entries(PINTURA_CALLES[tema])) map.setPaintProperty("calles", prop as "raster-opacity", valor)
    map.setLayoutProperty("calles", "visibility", calles ? "visible" : "none")
  }, [map, isLoaded, tema, fondo, calles])
  return null
}

interface Colores {
  fondo: string
  barrio: string
  borde: string
  texto: string
  p: Record<"P1" | "P2" | "P3" | "P4", string>
}

function leerColores(): Colores {
  return {
    fondo: token("--mapa-fondo"),
    barrio: token("--mapa-barrio"),
    borde: token("--mapa-borde"),
    texto: token("--foreground"),
    p: { P1: token("--p1"), P2: token("--p2"), P3: token("--p3"), P4: token("--p4") },
  }
}

function observarClase(avisar: () => void) {
  const o = new MutationObserver(avisar)
  o.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  return () => o.disconnect()
}

/** Incidentes agrupados por celda, en el orden de la central (el primero de cada grupo manda). */
function porCelda(incidentes: Incidente[]): [string, Incidente[]][] {
  const grupos = new globalThis.Map<string, Incidente[]>()
  for (const i of incidentes) {
    if (!i.geohash) continue
    grupos.set(i.geohash, [...(grupos.get(i.geohash) ?? []), i])
  }
  return [...grupos.entries()]
}

function centroDe(gh: string): [number, number] {
  const [[o, s], , [e, n]] = celda(gh)
  return [(o + e) / 2, (s + n) / 2]
}

/** Una celda por geohash, con la prioridad más alta de sus incidentes: varios incidentes en la
 *  misma celda no deben apilar rellenos hasta volverla opaca. */
function celdas(grupos: [string, Incidente[]][], seleccion: string | null): GeoJSON.FeatureCollection {
  const orden = (p: string) => Number(p.slice(1))
  return {
    type: "FeatureCollection",
    features: grupos
      .map(([gh, grupo]) => ({
        gh,
        prioridad: grupo.map((i) => i.prioridad).sort((a, b) => orden(a) - orden(b))[0],
        sel: grupo.some((i) => i.id === seleccion),
      }))
      // Lo último se dibuja encima: P4 primero, P1 al final y la elegida sobre todo.
      .sort((a, b) => Number(a.sel) - Number(b.sel) || orden(b.prioridad) - orden(a.prioridad))
      .map(({ gh, prioridad, sel }) => ({
        type: "Feature",
        properties: { gh, prioridad, sel },
        geometry: { type: "Polygon", coordinates: [celda(gh)] },
      })),
  }
}

/** Lleva la vista al incidente elegido, sin animación si el usuario pidió movimiento reducido. */
function Enfocar({ incidentes, seleccion }: { incidentes: Incidente[]; seleccion: string | null }) {
  const { map, isLoaded } = useMap()
  const gh = incidentes.find((i) => i.id === seleccion)?.geohash ?? null
  useEffect(() => {
    if (!map || !isLoaded || !gh) return
    const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches
    map.easeTo({ center: centroDe(gh), duration: quieto ? 0 : 500 })
  }, [map, isLoaded, gh])
  return null
}

/** Encuadrar y pantalla completa, debajo del zoom de mapcn y con su mismo aspecto. */
function Botones({ grupos, completo, onCompleto }: { grupos: [string, Incidente[]][]; completo: boolean; onCompleto: (v: boolean) => void }) {
  const { map } = useMap()

  function encuadrar() {
    if (!map || grupos.length === 0) return
    const esquinas = grupos.flatMap(([gh]) => celda(gh))
    const lon = esquinas.map(([x]) => x)
    const lat = esquinas.map(([, y]) => y)
    const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches
    map.fitBounds(
      [
        [Math.min(...lon), Math.min(...lat)],
        [Math.max(...lon), Math.max(...lat)],
      ],
      { padding: 80, maxZoom: 15, duration: quieto ? 0 : 600 },
    )
  }

  const boton = "flex size-8 items-center justify-center first:rounded-t-md last:rounded-b-md hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
  return (
    <div className="absolute top-[5.25rem] right-2 z-10 flex flex-col rounded-md border bg-background shadow-sm [&>button:not(:last-child)]:border-b">
      <button type="button" onClick={encuadrar} className={boton} aria-label="Encuadrar todos los incidentes" title="Encuadrar todos los incidentes">
        <Scan className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => onCompleto(!completo)}
        className={boton}
        aria-label={completo ? "Salir de pantalla completa (Esc)" : "Mapa en pantalla completa"}
        title={completo ? "Salir de pantalla completa (Esc)" : "Mapa en pantalla completa"}
      >
        {completo ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
      </button>
    </div>
  )
}

export function Mapa({ geo, incidentes, seleccion, onSeleccion, barrio, completo, onCompleto }: Props) {
  const [calles, setCalles] = useState(true)
  const [leyenda, setLeyenda] = useState(false)
  const [lugares, setLugares] = useState(true)
  const [encima, setEncima] = useState<string | null>(null)

  // Los tokens dependen de la clase de <html>, que next-themes cambia fuera de React.
  const clase = useSyncExternalStore(observarClase, () => document.documentElement.className, () => "")
  const colores = useMemo(() => (clase ? leerColores() : null), [clase])
  // El tema sale de la misma clase que los colores, para que nunca vayan desfasados.
  const tema = clase.split(" ").includes("dark") ? "dark" : "light"

  const grupos = useMemo(() => porCelda(incidentes), [incidentes])
  const datos = useMemo(() => celdas(grupos, seleccion), [grupos, seleccion])
  const sinUbicacion = incidentes.filter((i) => !i.geohash).length

  if (!colores) return <div className="h-full bg-mapa-fondo" />

  const porPrioridad = ["match", ["get", "prioridad"], "P1", colores.p.P1, "P2", colores.p.P2, "P3", colores.p.P3, colores.p.P4]

  return (
    <div className="relative h-full bg-mapa-fondo" role="region" aria-label="Mapa de incidentes">
      <Map
        theme={tema}
        styles={ESTILOS}
        center={CENTRO}
        zoom={12.6}
        attributionControl={{ compact: true }}
      >
        <PinturaBase tema={tema} fondo={colores.fondo} calles={calles} />
        {/* Mapa base: lo menos saliente posible. */}
        <MapGeoJSON
          id="barrios"
          data={geo.barrios as GeoJSON.FeatureCollection}
          promoteId="id"
          interactive
          fillPaint={{ "fill-color": colores.barrio, "fill-opacity": 0.3 }}
          fillHoverPaint={{ "fill-opacity": 0.55 }}
          linePaint={{ "line-color": colores.borde, "line-width": 0.6 }}
          onHover={(e) => setEncima((e?.feature.properties?.name as string | undefined) ?? null)}
        />
        {/* La celda es la incertidumbre de la ubicación: tenue y punteada; la elegida, marcada. */}
        <MapGeoJSON
          id="celdas"
          data={datos}
          fillPaint={{ "fill-color": porPrioridad as never, "fill-opacity": ["case", ["get", "sel"], 0.28, 0.12] as never }}
          linePaint={{
            "line-color": ["case", ["get", "sel"], colores.texto, porPrioridad] as never,
            "line-width": ["case", ["get", "sel"], 2, 1] as never,
            "line-dasharray": [2, 1.5],
          }}
        />
        {/* Puntos de atención: contexto, en círculo y atenuados. */}
        {lugares && geo.lugares.features.map((l) => {
          // Hospital con "H": la única letra que admite la simbología de la FGDC, y la que se
          // reconoce a este tamaño. Bomberos con extintor, distinto de la llama de "Incendio".
          const salud = l.properties.tipo !== "bomberos"
          return (
            <MapMarker key={l.properties.id} longitude={l.geometry.coordinates[0]} latitude={l.geometry.coordinates[1]}>
              <MarkerContent>
                <span
                  className={cn(
                    "grid place-items-center rounded-full border bg-card/90",
                    l.properties.tipo === "clinica" ? "size-4" : "size-5",
                    salud ? "border-lugar-salud text-lugar-salud" : "border-foreground/50 text-foreground/70",
                  )}
                >
                  {salud ? (
                    <span aria-hidden="true" className={cn("font-sans leading-none font-bold", l.properties.tipo === "clinica" ? "text-[0.5625rem]" : "text-[0.6875rem]")}>
                      H
                    </span>
                  ) : (
                    <FireExtinguisher aria-hidden="true" className="size-3" />
                  )}
                </span>
              </MarkerContent>
              <MarkerTooltip className="rounded-none bg-transparent p-0 text-popover-foreground shadow-none">
                <div className="rounded-sm border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md">
                  {l.properties.nombre} <span className="text-muted-foreground">· {NOMBRE_LUGAR[l.properties.tipo]}</span>
                </div>
              </MarkerTooltip>
            </MapMarker>
          )
        })}
        {/* Incidentes al final, para que queden encima de todo. */}
        {grupos.map(([gh, grupo]) => (
          <MarcadorIncidente
            key={gh}
            grupo={grupo}
            centro={centroDe(gh)}
            barrio={barrio(gh)?.nombre ?? null}
            seleccion={seleccion}
            onSeleccion={onSeleccion}
          />
        ))}
        <MapControls position="top-right" />
        <Botones grupos={grupos} completo={completo} onCompleto={onCompleto} />
        <Enfocar incidentes={incidentes} seleccion={seleccion} />
      </Map>

      <div className="absolute top-2 left-2 z-10 mr-14 max-w-80 rounded-sm border bg-card/95 text-[0.6875rem] text-muted-foreground shadow-sm">
        <button
          onClick={() => setLeyenda(!leyenda)}
          aria-expanded={leyenda}
          className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 font-medium text-foreground"
        >
          Leyenda
          <ChevronDown aria-hidden="true" className={cn("size-3.5 transition-transform", !leyenda && "-rotate-90")} />
        </button>
        {leyenda && (
          <div className="space-y-2 border-t px-2.5 py-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {(["P1", "P2", "P3", "P4"] as const).map((p) => (
                <span key={p} className="flex items-center gap-1 font-mono">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-2.5 rotate-45 rounded-[1px]",
                      p === "P1" && "bg-p1",
                      p === "P2" && "bg-p2",
                      p === "P3" && "bg-p3",
                      p === "P4" && "bg-p4",
                    )}
                  />
                  {p}
                </span>
              ))}
              <span className="flex items-center gap-1">
                <span aria-hidden="true" className="size-2.5 rounded-full bg-revisar" />
                revisar
              </span>
              <span className="flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="grid h-3.5 min-w-3.5 place-items-center rounded-full bg-foreground px-0.5 font-mono text-[0.5625rem] text-background"
                >
                  3
                </span>
                en la celda
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {(Object.keys(ICONO_TIPO) as (keyof typeof ICONO_TIPO)[]).map((t) => {
                const I = ICONO_TIPO[t]
                return (
                  <span key={t} className="flex items-center gap-1.5">
                    <I aria-hidden="true" className="size-3.5 text-foreground" />
                    {TIPO[t]}
                  </span>
                )
              })}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1">
                <span aria-hidden="true" className="size-3 border border-dashed border-foreground/60" />
                ubicación ±600 m
              </span>
              <span className="flex items-center gap-1">
                <span aria-hidden="true" className="grid size-3.5 place-items-center rounded-full border border-lugar-salud text-[0.5rem] font-bold text-lugar-salud">
                  H
                </span>
                hospital o clínica
              </span>
              <span className="flex items-center gap-1">
                <FireExtinguisher aria-hidden="true" className="size-3.5" />
                bomberos
              </span>
            </div>
            <p>Atenuado: ya decidido o sin noticias recientes.</p>
            <div className="space-y-1 border-t pt-2">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={lugares} onChange={(e) => setLugares(e.target.checked)} className="accent-foreground" />
                Hospitales y bomberos
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={calles} onChange={(e) => setCalles(e.target.checked)} className="accent-foreground" />
                Calles de OpenStreetMap (requiere internet)
              </label>
            </div>
          </div>
        )}
      </div>

      {encima && (
        <div className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-sm border bg-card/95 px-2 py-1 text-xs font-medium">
          {encima}
        </div>
      )}
      {sinUbicacion > 0 && (
        <div className="absolute right-2 bottom-10 z-10 rounded-sm border border-p2/40 bg-p2-surface px-2 py-1 text-[0.6875rem] text-p2">
          {sinUbicacion} incidente{sinUbicacion > 1 ? "s" : ""} sin ubicación: solo en la cola
        </div>
      )}
    </div>
  )
}
