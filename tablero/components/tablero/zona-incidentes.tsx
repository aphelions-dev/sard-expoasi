"use client"

// Una zona del mapa con incidentes. El geohash dice la precisión con su largo: con 6 o 7 caracteres
// (~1 km o ~150 m) no se sabe el sitio, y el incidente se muestra como su barrio pintado del color de
// la prioridad (fuera de los barrios, como el rectángulo del geohash), no como un icono; aquí solo
// va lo que el área no dice sola, cuántos hay y si piden revisión. Con 8 o más (~20 m), un punto;
// los puntos que en pantalla se tocarían se juntan en uno con el número (`lib/racimos.ts`).
import { CircleDashed } from "lucide-react"

import { MapMarker, MarkerContent, MarkerTooltip, useMap } from "@/components/ui/map"
import type { Incidente, Prioridad } from "@/lib/api/tipos"
import { TIPO, precision } from "@/lib/formato"
import { cn } from "@/lib/utils"

import { ICONO_TIPO } from "./iconos"

const TEXTO: Record<Prioridad, string> = { P1: "text-p1", P2: "text-p2", P3: "text-p3", P4: "text-p4" }

const pendiente = (i: Incidente) => i.estado === "pendiente" || i.estado === "sin_propuesta"

/** El siguiente incidente de la zona: el más grave primero; si ya hay uno elegido, el que sigue. */
export function siguienteDeZona(grupo: Incidente[], seleccion: string | null): string {
  const i = grupo.findIndex((x) => x.id === seleccion)
  return grupo[(i + 1) % grupo.length].id
}

const FONDO: Record<Prioridad, string> = { P1: "bg-p1", P2: "bg-p2", P3: "bg-p3", P4: "bg-p4" }

/** Con 8 caracteres o más el geohash mide unos 38 × 19 m (protocolo, «Ubicación»): eso ya es un
 *  sitio, y se marca como punto con el icono del tipo. Con menos, el área dice la verdad. */
export const PRECISO = 8

/** Un incidente con ubicación precisa: punto del color de la prioridad, con el icono del tipo. */
function Punto({ inc, elegido, revisar }: { inc: Incidente; elegido: boolean; revisar: boolean }) {
  const Icono = ICONO_TIPO[inc.tipo]
  return (
    <span
      className={cn(
        "relative grid size-7 place-items-center rounded-full border-2 border-background text-card shadow-md",
        FONDO[inc.prioridad],
        elegido && "outline-2 outline-offset-2 outline-foreground",
        !pendiente(inc) && "opacity-50",
      )}
      aria-label={`${inc.prioridad} ${TIPO[inc.tipo]}, ubicación precisa`}
    >
      <Icono aria-hidden="true" stroke={2.25} className="size-4" />
      {revisar && <span aria-hidden="true" className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-background bg-revisar" />}
    </span>
  )
}

/** Uno o varios incidentes con ubicación precisa que en pantalla caen en el mismo sitio. Uno solo
 *  es su punto; varios, un círculo con el número y el color del más grave. Clic: si al acercarse se
 *  separan, acerca; si están en el mismo sitio, pasa al siguiente. */
export function MarcaPuntos({
  grupo,
  centro,
  separable,
  seleccion,
  onSeleccion,
}: {
  /** Del más grave al menos grave. */
  grupo: Incidente[]
  centro: [number, number]
  separable: boolean
  seleccion: string | null
  onSeleccion: (id: string) => void
}) {
  const { map } = useMap()
  const revisar = grupo.some((i) => i.incertidumbre.revisar && pendiente(i))
  const elegido = grupo.find((i) => i.id === seleccion)
  const uno = grupo.length === 1

  function clic() {
    if (!uno && separable && map) {
      const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches
      map.easeTo({ center: centro, zoom: Math.min(18, map.getZoom() + 2), duration: quieto ? 0 : 500 })
    } else {
      onSeleccion(siguienteDeZona(grupo, seleccion))
    }
  }

  return (
    <MapMarker longitude={centro[0]} latitude={centro[1]} onClick={clic}>
      <MarkerContent>
        {uno ? (
          <Punto inc={grupo[0]} elegido={!!elegido} revisar={revisar} />
        ) : (
          <span
            className={cn(
              "relative grid size-8 place-items-center rounded-full border-2 border-background font-mono text-xs font-bold text-card shadow-md",
              FONDO[grupo[0].prioridad],
              elegido && "outline-2 outline-offset-2 outline-foreground",
              grupo.every((i) => !pendiente(i)) && "opacity-50",
            )}
            aria-label={`${grupo.length} incidentes con ubicación precisa, el más grave ${grupo[0].prioridad}${revisar ? ", alguno para revisar" : ""}`}
          >
            {grupo.length}
            {revisar && <span aria-hidden="true" className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-background bg-revisar" />}
          </span>
        )}
      </MarkerContent>
      <MarkerTooltip className="rounded-none bg-transparent p-0 text-popover-foreground shadow-none">
        <TarjetaZona
          grupo={grupo}
          barrio={null}
          titulo={uno ? "Ubicación precisa" : "Ubicaciones precisas"}
          seleccion={seleccion}
          pie={uno ? "Clic: ver el incidente." : separable ? "Clic: acercar para separarlos." : "Están en el mismo sitio. Clic: ver el siguiente."}
        />
      </MarkerTooltip>
    </MapMarker>
  )
}

/** Los incidentes sin ubicación exacta de un área (un barrio, o una zona fuera de los barrios):
 *  cuántos son y si alguno pide revisión. Es donde se hace clic para recorrerlos, así que se dibuja
 *  aunque sea uno solo. `borde`: va pegada al borde de arriba de la zona en vez de en su centro. */
export function MarcaZona({
  grupo,
  donde,
  borde = false,
  seleccion,
  onSeleccion,
}: {
  grupo: Incidente[]
  donde: [number, number]
  borde?: boolean
  seleccion: string | null
  onSeleccion: (id: string) => void
}) {
  const revisar = grupo.some((i) => i.incertidumbre.revisar && pendiente(i))
  const elegido = grupo.some((i) => i.id === seleccion)
  return (
    <MapMarker
      longitude={donde[0]}
      latitude={donde[1]}
      anchor={borde ? "top" : "center"}
      offset={borde ? [0, 3] : [0, 0]}
      onClick={() => onSeleccion(siguienteDeZona(grupo, seleccion))}
    >
      <MarkerContent>
        <span
          className={cn(
            "flex h-5 items-center gap-1 rounded-full border bg-card/90 pr-1.5 pl-1 font-mono text-[0.6875rem] leading-none font-semibold text-foreground shadow-sm",
            elegido && "border-foreground",
          )}
          aria-label={`${grupo.length} incidente${grupo.length > 1 ? "s" : ""} sin ubicación exacta en esta zona${revisar ? ", alguno para revisar" : ""}`}
        >
          {/* Círculo punteado: no se sabe el sitio. Del color del más grave. */}
          <CircleDashed aria-hidden="true" className={cn("size-3.5", TEXTO[grupo[0].prioridad])} />
          {grupo.length}
          {revisar && <span aria-hidden="true" className="size-1.5 rounded-full bg-revisar" />}
        </span>
      </MarkerContent>
      <MarkerTooltip className="rounded-none bg-transparent p-0 text-popover-foreground shadow-none">
        <TarjetaZona
          grupo={grupo}
          barrio={null}
          titulo="Sin ubicación exacta"
          seleccion={seleccion}
          pie={`Están en esta zona o cerca. ${grupo.length > 1 ? "Clic: ver el siguiente." : "Clic: ver el incidente."}`}
        />
      </MarkerTooltip>
    </MapMarker>
  )
}

/** Lo que hay en la zona bajo el cursor. */
export function TarjetaZona({ grupo, barrio, titulo, seleccion, pie }: { grupo: Incidente[]; barrio: string | null; titulo?: string; seleccion: string | null; pie?: string }) {
  return (
    <div className="w-64 rounded-sm border bg-popover text-xs text-popover-foreground shadow-md">
      <div className="flex items-baseline justify-between gap-2 border-b px-2.5 py-1.5">
        <span className="font-medium">{titulo ?? barrio ?? "Fuera de los barrios del mapa"}</span>
        <span className="text-muted-foreground">
          {grupo.length} incidente{grupo.length > 1 ? "s" : ""}
        </span>
      </div>
      <ul className="divide-y">
        {grupo.slice(0, 5).map((i) => {
          const I = ICONO_TIPO[i.tipo]
          return (
            <li key={i.id} className={cn("flex items-center gap-2 px-2.5 py-1.5", i.id === seleccion && "bg-accent", !pendiente(i) && "opacity-60")}>
              <span className={cn("font-mono font-semibold", TEXTO[i.prioridad])}>{i.prioridad}</span>
              <I aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{TIPO[i.tipo]}</span>
              <span className="ml-auto shrink-0 font-mono text-muted-foreground">{i.impacto.personas} p.</span>
              {i.incertidumbre.revisar && <span aria-label="Revisar" className="size-2 shrink-0 rounded-full bg-revisar" />}
            </li>
          )
        })}
      </ul>
      {grupo.length > 5 && <p className="border-t px-2.5 py-1 text-muted-foreground">y {grupo.length - 5} más en la cola</p>}
      <p className="border-t px-2.5 py-1 text-[0.6875rem] text-muted-foreground">
        {pie ?? (<>{grupo[0].geohash && grupo[0].geohash.length >= PRECISO
          ? "Ubicación precisa del GPS."
          : `El sitio exacto está en algún lugar de esta zona (${grupo[0].geohash ? precision(grupo[0].geohash) : "sin dato"}).`}{" "}
        {grupo.length > 1 ? "Clic: ver el siguiente." : "Clic: ver el incidente."}</>)}
      </p>
    </div>
  )
}
