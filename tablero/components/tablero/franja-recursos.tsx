"use client"

import { TriangleAlert } from "lucide-react"

import type { Incidente, Recurso } from "@/lib/api/tipos"
import { filas } from "@/lib/recursos"
import { cn } from "@/lib/utils"

interface Props {
  declarados: Recurso[] | null
  incidentes: Incidente[]
  onAbrir: () => void
}

/** Franja fija abajo: cuánto hay de cada recurso y dónde falta. Compite con cada decisión, así que
 *  se ve siempre; el detalle y la declaración se abren en el panel derecho. */
export function FranjaRecursos({ declarados, incidentes, onAbrir }: Props) {
  if (!declarados) return null
  return (
    <footer className="flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-t bg-card px-2 text-xs">
      <button
        onClick={onAbrir}
        className="shrink-0 rounded-sm px-2 py-1 text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase hover:bg-accent hover:text-foreground"
      >
        Recursos
      </button>
      {filas(declarados, incidentes).map((f) => {
        const d = f.declarado
        const faltan = d ? f.piden - d.disponibles : 0
        return (
          <button
            key={`${f.entidad}|${f.recurso}`}
            onClick={onAbrir}
            title={`${f.entidad} · ${f.piden} pendiente${f.piden === 1 ? "" : "s"} lo pide${f.piden === 1 ? "" : "n"}`}
            className="flex shrink-0 items-center gap-1.5 rounded-sm border-l px-2.5 py-1 first-of-type:border-l-0 hover:bg-accent"
          >
            <span className="text-muted-foreground first-letter:uppercase">{f.recurso}</span>
            {d ? (
              <span className={cn("font-mono font-semibold", d.disponibles === 0 && "text-p1")}>
                {d.disponibles}
                <span className="font-normal text-muted-foreground">/{d.declarados}</span>
              </span>
            ) : (
              <span className="text-p2">sin declarar</span>
            )}
            {faltan > 0 && (
              <span className="flex items-center gap-0.5 text-p1">
                <TriangleAlert className="size-3" aria-hidden="true" />
                faltan {faltan}
              </span>
            )}
          </button>
        )
      })}
    </footer>
  )
}
