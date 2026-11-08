"use client"

import { ArrowRight, TriangleAlert, Users, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Incidente } from "@/lib/api/tipos"
import { TIPO, haceCuanto, lugarLegible } from "@/lib/formato"
import type { Barrio } from "@/lib/geo"

import { ICONO_TIPO } from "./iconos"
import { EstadoInsignia, Prioridad } from "./insignias"

interface Props {
  inc: Incidente
  barrio: Barrio | null
  ahora: number
  onAbrir: () => void
  onCerrar: () => void
}

/** En pantalla completa, el incidente elegido flota sobre el mapa con lo justo para reconocerlo;
 *  la evidencia y la decisión siguen en el panel, a un clic. */
export function TarjetaMapa({ inc, barrio, ahora, onAbrir, onCerrar }: Props) {
  const Icono = ICONO_TIPO[inc.tipo]
  return (
    <section
      aria-label="Incidente elegido"
      className="absolute bottom-3 left-3 z-20 w-[min(22rem,calc(100%-1.5rem))] rounded-md border bg-card text-xs shadow-lg"
    >
      <div className="flex items-start gap-2 p-3 pb-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Prioridad p={inc.prioridad} />
            <Icono aria-hidden="true" className="size-3.5" />
            <span className="font-semibold">{TIPO[inc.tipo]}</span>
            <EstadoInsignia e={inc.estado} />
          </div>
          <p className="text-muted-foreground">
            {barrio?.nombre ?? (inc.geohash ? "Sin barrio conocido" : "Sin ubicación")} ·{" "}
            <Users className="inline size-3 align-[-2px]" aria-hidden="true" /> {inc.impacto.personas} ·{" "}
            {haceCuanto(inc.vigencia.ultimo_reporte_unix, ahora)}
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onCerrar} aria-label="Cerrar tarjeta">
          <X />
        </Button>
      </div>
      <p className="line-clamp-2 px-3 text-sm">«{inc.evidencia[0]?.texto || "sin texto"}»</p>
      {inc.incertidumbre.revisar && (
        <p className="mx-3 mt-2 flex items-center gap-1 font-medium text-revisar">
          <TriangleAlert className="size-3.5" aria-hidden="true" />
          Marcado para revisar
        </p>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 border-t px-3 py-2">
        <span className="truncate text-muted-foreground">{inc.accion_propuesta ? lugarLegible(inc.accion_propuesta.accion, inc.geohash, barrio?.nombre ?? null) : "Sin acción sugerida todavía"}</span>
        <Button size="sm" onClick={onAbrir}>
          Ver y decidir
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </section>
  )
}
