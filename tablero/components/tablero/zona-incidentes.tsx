"use client"

// Una zona del mapa con incidentes. El protocolo manda una zona aproximada (geohash de 6
// caracteres, ~1,2 × 0,6 km), no un punto: por eso el incidente se dibuja como el área sombreada
// del color de su prioridad (capa `celdas` de `mapa.tsx`) y no como un icono, que haría creer que
// se sabe el sitio exacto. Aquí solo va lo que el área no dice sola: cuántos hay y si piden revisión.
import { MapMarker, MarkerContent } from "@/components/ui/map"
import type { Incidente, Prioridad } from "@/lib/api/tipos"
import { TIPO } from "@/lib/formato"
import { cn } from "@/lib/utils"

import { ICONO_TIPO } from "./iconos"

const TEXTO: Record<Prioridad, string> = { P1: "text-p1", P2: "text-p2", P3: "text-p3", P4: "text-p4" }

const pendiente = (i: Incidente) => i.estado === "pendiente" || i.estado === "sin_propuesta"

/** El siguiente incidente de la zona: el más grave primero; si ya hay uno elegido, el que sigue. */
export function siguienteDeZona(grupo: Incidente[], seleccion: string | null): string {
  const i = grupo.findIndex((x) => x.id === seleccion)
  return grupo[(i + 1) % grupo.length].id
}

/** Cuántos incidentes hay en la zona y si alguno pide revisión. Sin nada que decir, no se dibuja. */
export function MarcaZona({
  grupo,
  centro,
  seleccion,
  onSeleccion,
}: {
  grupo: Incidente[]
  centro: [number, number]
  seleccion: string | null
  onSeleccion: (id: string) => void
}) {
  const revisar = grupo.some((i) => i.incertidumbre.revisar && pendiente(i))
  if (grupo.length === 1 && !revisar) return null
  return (
    <MapMarker longitude={centro[0]} latitude={centro[1]} onClick={() => onSeleccion(siguienteDeZona(grupo, seleccion))}>
      <MarkerContent>
        <span
          className="flex h-5 items-center gap-1 rounded-full border border-background bg-foreground px-1.5 font-mono text-[0.6875rem] leading-none font-semibold text-background shadow-sm"
          aria-label={`${grupo.length} incidente${grupo.length > 1 ? "s" : ""} en esta zona${revisar ? ", alguno para revisar" : ""}`}
        >
          {grupo.length > 1 && grupo.length}
          {revisar && <span aria-hidden="true" className="size-2 rounded-full bg-revisar" />}
        </span>
      </MarkerContent>
    </MapMarker>
  )
}

/** Lo que hay en la zona bajo el cursor. */
export function TarjetaZona({ grupo, barrio, seleccion }: { grupo: Incidente[]; barrio: string | null; seleccion: string | null }) {
  return (
    <div className="w-64 rounded-sm border bg-popover text-xs text-popover-foreground shadow-md">
      <div className="flex items-baseline justify-between gap-2 border-b px-2.5 py-1.5">
        <span className="font-medium">{barrio ?? "Fuera de los barrios del mapa"}</span>
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
        El sitio exacto está en algún lugar de esta zona (~1 km). {grupo.length > 1 ? "Clic: ver el siguiente." : "Clic: ver el incidente."}
      </p>
    </div>
  )
}
