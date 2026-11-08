"use client"

// Mapa de incidentes sobre el `Map` de mapcn (MapLibre 5). Barrios, celdas y lugares son archivos
// locales, así que sin internet se ve igual; las calles de OpenStreetMap son una capa opcional.
//
// Jerarquía visual (Du et al. 2021, diseño de mapas de crisis): el mapa base va lo menos saliente
// posible; los incidentes, lo más. De lejos, la lectura es por barrio (`barrios-mapa.tsx`): cada
// barrio con el color de la prioridad más alta que tiene pendiente y cuántos incidentes hay, como
// agregan los tableros de emergencia por unidad administrativa. Al acercarse aparece la zona de
// cada incidente (su celda de geohash), porque el reporte trae un área, no un punto: un icono haría
// creer que se sabe el sitio exacto. Hospitales y bomberos (simbología FGDC) van apagados.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react"
import type { StyleSpecification } from "maplibre-gl"
import { ChevronDown, FireExtinguisher, Maximize2, Minimize2, Play, Scan, Square } from "lucide-react"

import "@/lib/maplibre-local" // antes que el mapa: worker local, sin internet
import { Map, MapControls, MapGeoJSON, MapMarker, MarkerContent, MarkerTooltip, useMap } from "@/components/ui/map"
import type { Incidente } from "@/lib/api/tipos"
import { token } from "@/lib/color"
import { celda, type Barrio, type Geo } from "@/lib/geo"
import { cn } from "@/lib/utils"
import { enZona, resumenPorBarrio, type Zona } from "@/lib/zonas"

import { EncuadrarZona, EstadoBarrios, EtiquetasBarrios, Zoom, pinturaBarrios, useReproduccion } from "./barrios-mapa"
import { MarcaZona, PRECISO, TarjetaZona, siguienteDeZona } from "./zona-incidentes"

/** Desde este zoom se ven las celdas de cada incidente en vez del resumen por barrio. */
const ZOOM_CELDAS = 14

interface Props {
  geo: Geo
  incidentes: Incidente[]
  seleccion: string | null
  onSeleccion: (id: string) => void
  barrio: (gh: string | null) => Barrio | null
  zona: Zona | null
  onZona: (z: Zona | null) => void
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
 *  misma celda no deben apilar rellenos hasta volverla opaca. Lo ya decidido o sin noticias
 *  recientes se apaga para que lo pendiente sobresalga. */
function celdas(grupos: [string, Incidente[]][], seleccion: string | null, fuera: (gh: string) => boolean): GeoJSON.FeatureCollection {
  const orden = (p: string) => Number(p.slice(1))
  return {
    type: "FeatureCollection",
    features: grupos
      .map(([gh, grupo]) => ({
        gh,
        prioridad: grupo.map((i) => i.prioridad).sort((a, b) => orden(a) - orden(b))[0],
        sel: grupo.some((i) => i.id === seleccion),
        apagada:
          fuera(gh) ||
          grupo.every((i) => i.estado === "aprobada" || i.estado === "rechazada") ||
          grupo.every((i) => i.vigencia.sin_noticias_recientes),
      }))
      // Lo último se dibuja encima: P4 primero, P1 al final y la elegida sobre todo.
      .sort((a, b) => Number(a.sel) - Number(b.sel) || orden(b.prioridad) - orden(a.prioridad))
      .map(({ gh, prioridad, sel, apagada }) => ({
        type: "Feature",
        properties: { gh, prioridad, sel, apagada },
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

export function Mapa({ geo, incidentes: todos, seleccion, onSeleccion, barrio, zona, onZona, completo, onCompleto }: Props) {
  const [calles, setCalles] = useState(true)
  const [leyenda, setLeyenda] = useState(false)
  const [lugares, setLugares] = useState(false)
  const [encima, setEncima] = useState<{ id: string; nombre: string } | null>(null)
  const [celdaEncima, setCeldaEncima] = useState<string | null>(null)
  const [zoom, setZoom] = useState(12.6)
  const [destellan, setDestellan] = useState<Set<string>>(() => new Set())
  const repro = useReproduccion(todos.map((i) => i.hora_unix))
  // Durante la reproducción, solo lo que ya había llegado a esa hora.
  const incidentes = useMemo(() => (repro.t === null ? todos : todos.filter((i) => i.hora_unix <= repro.t!)), [todos, repro.t])
  const resumen = useMemo(() => resumenPorBarrio(incidentes, barrio), [incidentes, barrio])
  const alCambiar = useCallback((ids: string[]) => {
    setDestellan(new Set(ids))
    setTimeout(() => setDestellan(new Set()), 3600)
  }, [])

  // Los tokens dependen de la clase de <html>, que next-themes cambia fuera de React.
  const clase = useSyncExternalStore(observarClase, () => document.documentElement.className, () => "")
  const colores = useMemo(() => (clase ? leerColores() : null), [clase])
  // El tema sale de la misma clase que los colores, para que nunca vayan desfasados.
  const tema = clase.split(" ").includes("dark") ? "dark" : "light"

  // De cerca (o con un barrio elegido) se ven todas las celdas; de lejos, solo las que no caen en
  // ningún barrio (Villamaría, afueras) y los puntos precisos, que el resumen por barrio no muestra.
  const cerca = zoom >= ZOOM_CELDAS || zona?.tipo === "barrio"
  const grupos = useMemo(
    () => porCelda(incidentes).filter(([gh]) => cerca || gh.length >= PRECISO || !barrio(gh)),
    [incidentes, cerca, barrio],
  )
  // Con una zona elegida, las celdas de afuera se apagan como lo ya decidido.
  const datos = useMemo(() => celdas(grupos, seleccion, (gh) => !enZona(barrio(gh), zona)), [grupos, seleccion, barrio, zona])
  const sinUbicacion = incidentes.filter((i) => !i.geohash).length
  const grupoDe = (gh: string) => grupos.find(([g]) => g === gh)?.[1] ?? null
  const enCelda = celdaEncima ? grupoDe(celdaEncima) : null
  const enBarrio = encima ? incidentes.filter((i) => barrio(i.geohash)?.id === encima.id) : []

  if (!colores) return <div className="h-full bg-mapa-fondo" />

  const porPrioridad = ["match", ["get", "prioridad"], "P1", colores.p.P1, "P2", colores.p.P2, "P3", colores.p.P3, colores.p.P4]
  const pintura = pinturaBarrios(colores)

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
        {/* Barrios: fondo apagado, y del color de su prioridad los que tienen incidentes. Clic en un
            barrio: filtrar por él (otra vez: quitar el filtro). */}
        <MapGeoJSON
          id="barrios"
          data={geo.barrios as GeoJSON.FeatureCollection}
          promoteId="id"
          interactive
          fillPaint={pintura.fill}
          fillHoverPaint={pintura.hover}
          linePaint={pintura.line}
          onHover={(e) => {
            const p = e?.feature.properties as { id?: string; name?: string } | undefined
            setEncima(p?.id && p.name ? { id: p.id, nombre: p.name } : null)
          }}
          onClick={(e) => {
            // Un clic sobre una celda es para elegir el incidente, no el barrio de abajo.
            const m = e.originalEvent.target
            if (m.getLayer("geojson-fill-celdas") && m.queryRenderedFeatures(e.originalEvent.point, { layers: ["geojson-fill-celdas"] }).length) return
            const p = e.feature.properties as { id: string; name: string }
            onZona(zona?.tipo === "barrio" && zona.id === p.id ? null : { tipo: "barrio", id: p.id, nombre: p.name })
          }}
        />
        <EstadoBarrios barrios={geo.barrios} resumen={resumen} zona={zona} onCambio={alCambiar} />
        {/* El incidente es su zona: relleno del color de la prioridad y borde punteado, porque el
            sitio exacto no se sabe; la elegida, con el borde marcado. */}
        <MapGeoJSON
          id="celdas"
          data={datos}
          promoteId="gh"
          interactive
          fillPaint={{
            "fill-color": porPrioridad as never,
            "fill-opacity": ["case", ["get", "sel"], 0.6, ["get", "apagada"], 0.15, 0.4] as never,
          }}
          fillHoverPaint={{ "fill-opacity": 0.6 }}
          linePaint={{
            "line-color": ["case", ["get", "sel"], colores.texto, porPrioridad] as never,
            "line-width": ["case", ["get", "sel"], 2.5, 1.25] as never,
            "line-dasharray": [2, 1.5],
          }}
          onHover={(e) => setCeldaEncima((e?.feature.properties?.gh as string | undefined) ?? null)}
          onClick={(e) => {
            const g = grupoDe(e.feature.properties?.gh as string)
            if (g) onSeleccion(siguienteDeZona(g, seleccion))
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
        {/* De lejos, el nombre y el número de cada barrio; de cerca, cuántos hay en cada celda. */}
        {!cerca && <EtiquetasBarrios barrios={geo.barrios} resumen={resumen} zona={zona} destellan={destellan} onZona={onZona} />}
        {grupos.map(([gh, grupo]) => (
          <MarcaZona key={gh} gh={gh} grupo={grupo} centro={centroDe(gh)} seleccion={seleccion} onSeleccion={onSeleccion} />
        ))}
        <MapControls position="top-right" />
        <Botones grupos={grupos} completo={completo} onCompleto={onCompleto} />
        <Enfocar incidentes={incidentes} seleccion={seleccion} />
        <EncuadrarZona barrios={geo.barrios} zona={zona} resumen={resumen} />
        <Zoom onZoom={setZoom} />
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
            <p>De lejos, cada barrio toma el color de lo más grave que tiene por decidir, más intenso cuantos más incidentes tiene. Clic en un barrio: ver solo ese barrio en la cola.</p>
            <p>De cerca, cada incidente es la zona donde ocurrió, tan grande como la incertidumbre del GPS. Si el GPS fue preciso (~20 m), es un punto con el icono del tipo.</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {(["P1", "P2", "P3", "P4"] as const).map((p) => (
                <span key={p} className="flex items-center gap-1 font-mono">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-3 border border-dashed",
                      p === "P1" && "border-p1 bg-p1/40",
                      p === "P2" && "border-p2 bg-p2/40",
                      p === "P3" && "border-p3 bg-p3/40",
                      p === "P4" && "border-p4 bg-p4/40",
                    )}
                  />
                  {p}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="grid h-3.5 min-w-3.5 place-items-center rounded-full bg-foreground px-0.5 font-mono text-[0.5625rem] text-background"
                >
                  3
                </span>
                incidentes en la misma zona
              </span>
              <span className="flex items-center gap-1">
                <span aria-hidden="true" className="size-2.5 rounded-full bg-revisar" />
                para revisar
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
            <p>Más tenue: ya decidido o sin noticias recientes.</p>
            <div className="space-y-1 border-t pt-2">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={lugares} onChange={(e) => setLugares(e.target.checked)} className="accent-foreground" />
                Hospitales y bomberos
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={calles} onChange={(e) => setCalles(e.target.checked)} className="accent-foreground" />
                Mapa de calles (requiere internet)
              </label>
            </div>
          </div>
        )}
      </div>

      {celdaEncima && enCelda ? (
        <div className="pointer-events-none absolute bottom-12 left-2 z-10">
          <TarjetaZona grupo={enCelda} barrio={barrio(celdaEncima)?.nombre ?? null} seleccion={seleccion} />
        </div>
      ) : encima && enBarrio.length > 0 ? (
        <div className="pointer-events-none absolute bottom-12 left-2 z-10">
          <TarjetaZona
            grupo={enBarrio}
            barrio={encima.nombre}
            seleccion={seleccion}
            pie={zona?.tipo === "barrio" && zona.id === encima.id ? "Clic: ver todas las zonas." : "Clic: ver solo este barrio en la cola."}
          />
        </div>
      ) : (
        encima && (
          <div className="pointer-events-none absolute bottom-12 left-2 z-10 rounded-sm border bg-card/95 px-2 py-1 text-xs font-medium">
            {encima.nombre} <span className="font-normal text-muted-foreground">· sin incidentes</span>
          </div>
        )
      )}

      {/* Reproducir cómo fueron llegando: la sala ve en segundos cómo creció la emergencia. */}
      {repro.puede && (
        <div className="absolute bottom-2 left-2 z-10 flex items-center gap-2 rounded-md border bg-card/95 py-1 pr-2.5 pl-1 text-[0.6875rem] shadow-sm">
          <button
            type="button"
            onClick={repro.t === null ? repro.empezar : repro.parar}
            className="flex h-6 items-center gap-1 rounded-sm px-2 font-medium hover:bg-accent"
          >
            {repro.t === null ? <Play aria-hidden="true" className="size-3" /> : <Square aria-hidden="true" className="size-3" />}
            {repro.t === null ? "Reproducir llegadas" : "Detener"}
          </button>
          {repro.t !== null && (
            <>
              <span className="h-1 w-24 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <span className="block h-full bg-foreground" style={{ width: `${repro.progreso * 100}%` }} />
              </span>
              <span className="font-mono tabular-nums">
                {new Date(repro.t * 1000).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })} · {incidentes.length}
              </span>
            </>
          )}
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
