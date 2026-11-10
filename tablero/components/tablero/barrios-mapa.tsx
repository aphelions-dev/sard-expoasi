"use client"

// Los barrios como lectura principal del mapa: cada uno se pinta con la prioridad más alta de lo
// que tiene pendiente, más intenso cuantos más incidentes tiene, y lleva una etiqueta con su nombre
// y el número. Lo pinta el estado de cada barrio (feature-state) sobre la capa `barrios` de
// `mapa.tsx`, así que cambiar un número no recarga la geometría. Cuando un barrio cambia (llega un
// incidente, sube o baja la prioridad) destella unos segundos; con movimiento reducido, no.
import { useEffect, useRef, useState } from "react"
import type { Map as MapLibreMap } from "maplibre-gl"

import { MapMarker, MarkerContent, useMap } from "@/components/ui/map"
import type { Prioridad } from "@/lib/api/tipos"
import type { ColeccionBarrios } from "@/lib/geo"
import { cn } from "@/lib/utils"
import type { ResumenBarrio, Zona } from "@/lib/zonas"

export const FUENTE_BARRIOS = "geojson-source-barrios"
const DESTELLO_MS = 2400

const PUNTO: Record<Prioridad, string> = { P1: "bg-p1", P2: "bg-p2", P3: "bg-p3", P4: "bg-p4" }

/** Expresiones de pintura de la capa de barrios, leídas del estado de cada uno. */
/** `cerca`: el estado que llega es solo el de los incidentes sin ubicación exacta, cuyo sitio es
 *  «en este barrio o cerca»; el barrio se pinta más suave para que los puntos precisos manden. */
export function pinturaBarrios(c: { barrio: string; borde: string; texto: string; p: Record<Prioridad, string> }, cerca: boolean) {
  // feature-state no tiene tipo: las expresiones lo piden explícito o MapLibre descarta la pintura.
  const p = ["to-string", ["coalesce", ["feature-state", "p"], "-"]]
  const color = ["match", p, "P1", c.p.P1, "P2", c.p.P2, "P3", c.p.P3, "P4", c.p.P4, c.barrio]
  const n = ["to-number", ["coalesce", ["feature-state", "n"], 0]]
  const pulso = ["to-number", ["coalesce", ["feature-state", "pulso"], 0]]
  const fuera = ["case", ["boolean", ["feature-state", "fuera"], false], 0.35, 1]
  // Sin incidentes, el barrio es fondo; con ellos, de 0,4 a 0,7 según cuántos tiene.
  const base = [
    "case",
    ["==", p, "-"], 0.45,
    ["boolean", ["feature-state", "apagado"], false], 0.22,
    ["min", 0.7, ["+", 0.32, ["*", 0.08, n]]],
  ]
  const opacidad = ["*", fuera, cerca ? 0.6 : 1, ["min", 0.9, ["+", base, ["*", 0.5, pulso]]]]
  return {
    fill: { "fill-color": color, "fill-opacity": opacidad } as never,
    hover: { "fill-opacity": ["min", 0.9, ["+", opacidad, 0.15]] } as never,
    line: {
      "line-color": ["case", ["boolean", ["feature-state", "sel"], false], c.texto, ["==", p, "-"], c.texto, color],
      "line-width": ["case", ["boolean", ["feature-state", "sel"], false], 2.5, ["==", p, "-"], 0.9, 1.4],
      // Los barrios sin incidentes se ven como contorno tenue: el mapa de barrios entero, sin competir.
      "line-opacity": ["case", ["boolean", ["feature-state", "sel"], false], 1, ["==", p, "-"], 0.28, 0.9],
    } as never,
  }
}

function dentroDeZona(id: string, comuna: string, zona: Zona | null) {
  return !zona || (zona.tipo === "barrio" ? zona.id === id : zona.id === comuna)
}

/** Pasa el resumen de cada barrio al estado del mapa y hace destellar los que cambiaron. */
export function EstadoBarrios({
  barrios,
  resumen,
  zona,
  onCambio,
}: {
  barrios: ColeccionBarrios
  resumen: Map<string, ResumenBarrio>
  zona: Zona | null
  onCambio: (ids: string[]) => void
}) {
  const { map, isLoaded } = useMap()
  const previo = useRef<Map<string, ResumenBarrio> | null>(null)
  const animacion = useRef<number | null>(null)

  useEffect(() => {
    if (!map || !isLoaded || !map.getSource(FUENTE_BARRIOS)) return
    for (const f of barrios.features) {
      const { id, comuna } = f.properties
      const r = resumen.get(id)
      map.setFeatureState(
        { source: FUENTE_BARRIOS, id },
        {
          p: r?.prioridad ?? null,
          n: r?.total ?? 0,
          apagado: r?.apagado ?? false,
          fuera: !dentroDeZona(id, comuna, zona),
          sel: zona?.tipo === "barrio" && zona.id === id,
        },
      )
    }

    const antes = previo.current
    previo.current = resumen
    if (!antes) return // la primera lectura no es un cambio
    const cambiados = [...resumen].filter(([id, r]) => {
      const a = antes.get(id)
      return !a || a.prioridad !== r.prioridad || a.total !== r.total
    }).map(([id]) => id)
    if (cambiados.length === 0) return
    onCambio(cambiados)
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
    destellar(map, cambiados, animacion)
  }, [map, isLoaded, barrios, resumen, zona, onCambio])

  useEffect(() => () => {
    if (animacion.current) cancelAnimationFrame(animacion.current)
  }, [])

  return null
}

/** Dos latidos que se apagan: el barrio sube de intensidad y vuelve a su color. */
function destellar(map: MapLibreMap, ids: string[], animacion: React.RefObject<number | null>) {
  if (animacion.current) cancelAnimationFrame(animacion.current)
  const inicio = performance.now()
  const paso = (t: number) => {
    const k = Math.min(1, (t - inicio) / DESTELLO_MS)
    const pulso = (1 - k) * (0.5 - 0.5 * Math.cos(4 * Math.PI * k))
    for (const id of ids) {
      if (map.getSource(FUENTE_BARRIOS)) map.setFeatureState({ source: FUENTE_BARRIOS, id }, { pulso })
    }
    animacion.current = k < 1 ? requestAnimationFrame(paso) : null
  }
  animacion.current = requestAnimationFrame(paso)
}

/** Nombre y número de cada barrio con incidentes, sobre su centro. Clic: filtrar por ese barrio. */
export function EtiquetasBarrios({
  barrios,
  resumen,
  zona,
  destellan,
  onZona,
  onEncima,
}: {
  barrios: ColeccionBarrios
  resumen: Map<string, ResumenBarrio>
  zona: Zona | null
  destellan: Set<string>
  onZona: (z: Zona | null) => void
  /** La etiqueta tapa el barrio: al pasar sobre ella se muestra lo mismo que sobre el barrio. */
  onEncima: (b: { id: string; nombre: string } | null) => void
}) {
  return barrios.features
    .filter((f) => resumen.has(f.properties.id))
    .map((f) => {
      const { id, name, comuna, lon, lat } = f.properties
      const r = resumen.get(id)!
      const elegido = zona?.tipo === "barrio" && zona.id === id
      return (
        <MapMarker
          key={`${id}-${destellan.has(id) ? "d" : ""}`}
          longitude={lon}
          latitude={lat}
          onClick={() => onZona(elegido ? null : { tipo: "barrio", id, nombre: name })}
        >
          <MarkerContent>
            <span
              onMouseEnter={() => onEncima({ id, nombre: name })}
              onMouseLeave={() => onEncima(null)}
              data-p={r.apagado ? undefined : r.prioridad}
              data-sel={elegido}
              className={cn(
                "flex h-6 cursor-pointer items-center gap-1.5 rounded-full border bg-card/95 pr-1 pl-2 text-[0.6875rem] whitespace-nowrap shadow-sm",
                elegido && "border-foreground",
                !dentroDeZona(id, comuna, zona) && "opacity-40",
                r.apagado && "opacity-60",
                destellan.has(id) && "animate-latido",
              )}
              aria-label={`${name}: ${r.total} incidente${r.total > 1 ? "s" : ""}, ${r.pendientes} por decidir${r.revisar ? ", alguno para revisar" : ""}`}
            >
              <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", PUNTO[r.prioridad])} />
              <span className="font-medium">{name}</span>
              <span className={cn("grid h-4 min-w-4 place-items-center rounded-full px-1 font-mono text-[0.625rem] font-semibold", r.apagado ? "bg-muted text-muted-foreground" : "bg-foreground text-background")}>
                {r.total}
              </span>
              {r.revisar && <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-revisar" />}
            </span>
          </MarkerContent>
        </MapMarker>
      )
    })
}

function encuadrar(map: MapLibreMap, features: ColeccionBarrios["features"], maxZoom: number) {
  const puntos = features.flatMap((f) => (f.geometry.type === "Polygon" ? f.geometry.coordinates : f.geometry.coordinates.flat()).flat())
  if (puntos.length === 0) return
  const lon = puntos.map(([x]) => x)
  const lat = puntos.map(([, y]) => y)
  const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches
  map.fitBounds(
    [
      [Math.min(...lon), Math.min(...lat)],
      [Math.max(...lon), Math.max(...lat)],
    ],
    { padding: 60, maxZoom, duration: quieto ? 0 : 700 },
  )
}

/** Encuadra la zona elegida (un barrio o todos los de una comuna). La primera vez que hay
 *  incidentes, encuadra los barrios donde están en vez de dejar la vista fija del centro. */
export function EncuadrarZona({ barrios, zona, resumen }: { barrios: ColeccionBarrios; zona: Zona | null; resumen: Map<string, ResumenBarrio> }) {
  const { map, isLoaded } = useMap()
  const inicial = useRef(false)
  const hay = resumen.size > 0
  useEffect(() => {
    if (!map || !isLoaded || !zona) return
    encuadrar(map, barrios.features.filter((f) => dentroDeZona(f.properties.id, f.properties.comuna, zona)), 14)
  }, [map, isLoaded, barrios, zona])
  useEffect(() => {
    if (!map || !isLoaded || !hay || inicial.current || zona) return
    inicial.current = true
    encuadrar(map, barrios.features.filter((f) => resumen.has(f.properties.id)), 13.5)
  }, [map, isLoaded, barrios, hay, resumen, zona])
  return null
}

/** El zoom actual, para pasar de barrios a celdas exactas al acercarse. */
export function Zoom({ onZoom }: { onZoom: (z: number) => void }) {
  const { map, isLoaded } = useMap()
  useEffect(() => {
    if (!map || !isLoaded) return
    const avisar = () => onZoom(map.getZoom())
    avisar()
    map.on("zoomend", avisar)
    return () => {
      map.off("zoomend", avisar)
    }
  }, [map, isLoaded, onZoom])
  return null
}

/** Reproduce cómo fueron llegando los incidentes: de la hora del primero a la del último en unos
 *  segundos. Mientras corre, el mapa muestra solo lo que ya había llegado a esa hora. */
export function useReproduccion(horas: number[], duracionMs = 15000) {
  const [t, setT] = useState<number | null>(null)
  const desde = horas.length ? Math.min(...horas) : 0
  const hasta = horas.length ? Math.max(...horas) : 0

  useEffect(() => {
    if (t === null) return
    if (t >= hasta) {
      const fin = setTimeout(() => setT(null), 1500)
      return () => clearTimeout(fin)
    }
    const avance = Math.max(1, (hasta - desde) / (duracionMs / 100))
    const tic = setTimeout(() => setT((x) => (x === null ? null : Math.min(hasta, x + avance))), 100)
    return () => clearTimeout(tic)
  }, [t, desde, hasta, duracionMs])

  return {
    t,
    progreso: t === null || hasta === desde ? 0 : (t - desde) / (hasta - desde),
    puede: hasta > desde,
    empezar: () => setT(desde),
    parar: () => setT(null),
  }
}
