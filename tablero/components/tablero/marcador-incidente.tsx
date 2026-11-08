"use client"

// Un marcador por celda de geohash. Sigue la simbología de emergencias de la FGDC: los incidentes
// son rombos. El color es la prioridad, el icono es el tipo y el tamaño crece con la prioridad
// (color y tamaño se leen como "qué tan grave" y "dónde" a la vez). Lo ya decidido se atenúa para
// que lo pendiente sobresalga.
import { MapMarker, MarkerContent, MarkerTooltip } from "@/components/ui/map"
import type { Incidente, Prioridad as TPrioridad } from "@/lib/api/tipos"
import { TIPO } from "@/lib/formato"
import { cn } from "@/lib/utils"

import { ICONO_TIPO } from "./iconos"

const TAMANO: Record<TPrioridad, string> = { P1: "size-8", P2: "size-7", P3: "size-6", P4: "size-6" }
const ICONO: Record<TPrioridad, string> = { P1: "size-4", P2: "size-3.5", P3: "size-3", P4: "size-3" }
const FONDO: Record<TPrioridad, string> = {
  P1: "bg-p1 text-card",
  P2: "bg-p2 text-card",
  P3: "bg-p3 text-card",
  P4: "bg-p4 text-card",
}
const TEXTO: Record<TPrioridad, string> = { P1: "text-p1", P2: "text-p2", P3: "text-p3", P4: "text-p4" }

interface Props {
  /** Incidentes de la misma celda, en el orden de la central (el primero manda). */
  grupo: Incidente[]
  centro: [number, number]
  barrio: string | null
  seleccion: string | null
  onSeleccion: (id: string) => void
}

export function MarcadorIncidente({ grupo, centro, barrio, seleccion, onSeleccion }: Props) {
  // El rombo siempre muestra el más grave de la celda: elegir uno menos grave no lo esconde.
  const principal = grupo.reduce((a, b) => (Number(b.prioridad.slice(1)) < Number(a.prioridad.slice(1)) ? b : a))
  const elegido = grupo.find((i) => i.id === seleccion) ?? null
  const visible = principal
  const p = visible.prioridad
  const Icono = ICONO_TIPO[visible.tipo]
  const pendientes = grupo.filter((i) => i.estado === "pendiente" || i.estado === "sin_propuesta").length
  const revisar = grupo.some((i) => i.incertidumbre.revisar && (i.estado === "pendiente" || i.estado === "sin_propuesta"))
  const sinNoticias = grupo.every((i) => i.vigencia.sin_noticias_recientes)

  // Clic: el principal; si ya está elegido, el siguiente de la misma celda.
  function alClic() {
    const i = elegido ? grupo.indexOf(elegido) : -1
    onSeleccion(grupo[(i + 1) % grupo.length].id)
  }

  return (
    <MapMarker longitude={centro[0]} latitude={centro[1]} onClick={alClic}>
      <MarkerContent>
        <span
          data-sel={elegido ? "true" : undefined}
          data-p={p}
          className={cn("relative grid place-items-center", TAMANO[p], pendientes === 0 && "opacity-45", sinNoticias && "opacity-60")}
          aria-label={`${grupo.length} incidente${grupo.length > 1 ? "s" : ""} en ${barrio ?? "esta celda"}, el más grave ${p} ${TIPO[visible.tipo]}`}
        >
          {/* Rombo: un cuadrado girado, con el icono derecho encima. */}
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-[12%] rotate-45 rounded-[3px] border-2 border-background shadow-sm",
              FONDO[p],
              elegido && "outline-2 outline-offset-2 outline-foreground",
            )}
          />
          <Icono aria-hidden="true" strokeWidth={2.5} className={cn("relative", ICONO[p])} />
          {grupo.length > 1 && (
            <span className="absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full border border-background bg-foreground px-1 font-mono text-[0.625rem] leading-none font-semibold text-background">
              {grupo.length}
            </span>
          )}
          {revisar && (
            <span aria-hidden="true" className="absolute -bottom-1 -left-1 size-2.5 rounded-full border-2 border-background bg-revisar" />
          )}
        </span>
      </MarkerContent>
      <MarkerTooltip offset={18} className="rounded-none bg-transparent p-0 text-popover-foreground shadow-none">
        <div className="w-64 rounded-sm border bg-popover text-xs text-popover-foreground shadow-md">
          <div className="flex items-baseline justify-between gap-2 border-b px-2.5 py-1.5">
            <span className="font-medium">{barrio ?? "Sin barrio conocido"}</span>
            <span className="text-muted-foreground">
              {grupo.length} incidente{grupo.length > 1 ? "s" : ""} · zona aprox. 600 m
            </span>
          </div>
          <ul className="divide-y">
            {grupo.slice(0, 5).map((i) => {
              const I = ICONO_TIPO[i.tipo]
              return (
                <li key={i.id} className={cn("flex items-center gap-2 px-2.5 py-1.5", i.id === seleccion && "bg-accent")}>
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
            {grupo.length > 1 ? "Clic: ver el siguiente de esta zona" : "Clic: ver el incidente"}
          </p>
        </div>
      </MarkerTooltip>
    </MapMarker>
  )
}
