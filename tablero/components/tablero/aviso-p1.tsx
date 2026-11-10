"use client"

import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Incidente } from "@/lib/api/tipos"
import { TIPO, haceCuanto } from "@/lib/formato"
import type { Barrio } from "@/lib/geo"

import { ICONO_TIPO } from "./iconos"

interface Props {
  /** Llegaron como P1 o subieron a P1 y nadie los ha abierto, en el orden de la cola. */
  incidentes: Incidente[]
  barrio: (gh: string | null) => Barrio | null
  ahora: number
  onAbrir: (id: string) => void
  onDescartar: () => void
}

/** Franja arriba del tablero mientras haya un P1 nuevo sin abrir: no depende de mirar la cola. */
export function AvisoP1({
  incidentes,
  barrio,
  ahora,
  onAbrir,
  onDescartar,
}: Props) {
  const [inc] = incidentes
  if (!inc) return null
  const Icono = ICONO_TIPO[inc.tipo]
  const b = barrio(inc.geohash)
  const otros = incidentes.length - 1
  return (
    <div
      role="alert"
      className="flex shrink-0 animate-aviso items-center gap-3 border-b border-p1/50 bg-p1-surface px-3 py-1.5 text-xs text-p1"
    >
      <span className="shrink-0 rounded-sm bg-p1 px-1.5 py-0.5 font-mono text-[0.6875rem] font-bold text-background">
        P1 NUEVO
      </span>
      <Icono aria-hidden="true" className="size-4 shrink-0" />
      <p className="min-w-0 flex-1 truncate">
        <span className="font-semibold">{TIPO[inc.tipo]}</span>
        {b && <> · {b.nombre}</>} · {haceCuanto(inc.hora_unix, ahora)}
        <span className="text-foreground/80">
          {" "}
          · «{inc.evidencia[0]?.texto || "sin texto"}»
        </span>
      </p>
      {otros > 0 && <span className="shrink-0 font-medium">y {otros} más</span>}
      <Button
        size="sm"
        className="h-7 shrink-0 bg-p1 px-3 text-background hover:bg-p1/85"
        onClick={() => onAbrir(inc.id)}
      >
        Abrir
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        className="shrink-0 text-p1 hover:bg-p1/15 hover:text-p1"
        onClick={onDescartar}
        aria-label="Descartar el aviso"
        title="Descartar el aviso (siguen en la cola)"
      >
        <X />
      </Button>
    </div>
  )
}
