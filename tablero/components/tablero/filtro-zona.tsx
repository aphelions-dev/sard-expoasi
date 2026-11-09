"use client"

// Filtro por barrio o comuna sobre la cola. Se elige aquí o con un clic en el mapa; mientras esté
// puesto, la cola y sus conteos muestran solo esa zona y el mapa la encuadra.
import { useState } from "react"
import { ChevronDown, MapPin, Search, X } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Zona } from "@/lib/zonas"
import { cn } from "@/lib/utils"

interface Props {
  zona: Zona | null
  onZona: (z: Zona | null) => void
  zonas: { zona: Zona; total: number; pendientes: number }[]
}

const sinTildes = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()

export function FiltroZona({ zona, onZona, zonas }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState("")
  const q = sinTildes(texto.trim())
  const lista = zonas.filter((z) => !q || sinTildes(z.zona.nombre).includes(q))
  const comunas = lista.filter((z) => z.zona.tipo === "comuna")
  const barrios = lista.filter((z) => z.zona.tipo === "barrio")

  function elegir(z: Zona) {
    onZona(z)
    setAbierto(false)
    setTexto("")
  }

  if (zona) {
    return (
      <div className="flex min-w-0 items-center gap-1 rounded-sm border border-foreground/30 bg-accent py-0.5 pr-0.5 pl-2 text-xs">
        <MapPin aria-hidden="true" className="size-3 shrink-0" />
        <span className="truncate">
          <span className="text-muted-foreground">{zona.tipo === "barrio" ? "Barrio" : ""} </span>
          <span className="font-medium">{zona.nombre}</span>
        </span>
        <button
          type="button"
          onClick={() => onZona(null)}
          className="grid size-5 shrink-0 place-items-center rounded-sm hover:bg-background"
          aria-label={`Quitar el filtro de ${zona.nombre}`}
          title="Ver todas las zonas"
        >
          <X className="size-3.5" />
        </button>
      </div>
    )
  }

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex h-6 items-center gap-1 rounded-sm px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          />
        }
      >
        <MapPin aria-hidden="true" className="size-3" />
        Todas las zonas
        <ChevronDown aria-hidden="true" className="size-3 opacity-60" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 gap-0 p-0">
        <label className="flex items-center gap-2 border-b px-2.5 py-2">
          <Search aria-hidden="true" className="size-3.5 text-muted-foreground" />
          <input
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lista[0] && elegir(lista[0].zona)}
            placeholder="Buscar barrio o comuna"
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
        </label>
        <div className="max-h-72 overflow-y-auto py-1 text-xs">
          {lista.length === 0 && <p className="px-2.5 py-2 text-muted-foreground">Ninguna zona con incidentes se llama así.</p>}
          {[
            ["Comunas", comunas],
            ["Barrios", barrios],
          ].map(
            ([titulo, grupo]) =>
              (grupo as typeof lista).length > 0 && (
                <div key={titulo as string}>
                  <p className="px-2.5 pt-1.5 pb-0.5 text-[0.625rem] font-semibold tracking-wide text-muted-foreground uppercase">{titulo as string}</p>
                  {(grupo as typeof lista).map(({ zona: z, total, pendientes }) => (
                    <button
                      key={`${z.tipo}:${z.id}`}
                      type="button"
                      onClick={() => elegir(z)}
                      className="flex w-full items-center gap-2 px-2.5 py-1 text-left hover:bg-accent"
                    >
                      <span className="truncate">{z.nombre}</span>
                      <span className={cn("ml-auto shrink-0 font-mono", pendientes ? "text-foreground" : "text-muted-foreground")}>
                        {pendientes > 0 ? `${pendientes} por decidir` : `${total}`}
                      </span>
                    </button>
                  ))}
                </div>
              ),
          )}
        </div>
        <p className="border-t px-2.5 py-1.5 text-[0.6875rem] text-muted-foreground">También puedes hacer clic en un barrio del mapa.</p>
      </PopoverContent>
    </Popover>
  )
}
