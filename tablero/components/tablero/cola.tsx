"use client"

import { useRef } from "react"
import { ArrowDown, Clock, MapPinOff, TriangleAlert, Users } from "lucide-react"

import { ScrollArea } from "@/components/ui/scroll-area"
import type { Incidente } from "@/lib/api/tipos"
import { FILTROS, agrupar, conteos, filtrar, type Filtro } from "@/lib/cola"
import { TIPO, haceCuanto } from "@/lib/formato"
import type { Barrio } from "@/lib/geo"
import { cn } from "@/lib/utils"
import type { Zona } from "@/lib/zonas"

import { FiltroZona } from "./filtro-zona"

import { ICONO_TIPO } from "./iconos"
import { BARRA_PRIORIDAD, EstadoInsignia, Prioridad } from "./insignias"

interface Props {
  incidentes: Incidente[]
  cargando: boolean
  filtro: Filtro
  onFiltro: (f: Filtro) => void
  seleccion: string | null
  onSeleccion: (id: string) => void
  ahora: number
  barrio: (gh: string | null) => Barrio | null
  zona: Zona | null
  onZona: (z: Zona | null) => void
  zonas: { zona: Zona; total: number; pendientes: number }[]
  /** Llegaron o cambiaron de prioridad hace unos segundos: destellan. */
  recientes: Set<string>
  /** Llegaron desde que el coordinador miró por última vez. */
  nuevos: string[]
  onVerNuevos: () => void
}

/** Cola en filas densas, en el orden que decide la central. Los filtros esconden, no reordenan. */
export function Cola({
  incidentes,
  cargando,
  filtro,
  onFiltro,
  seleccion,
  onSeleccion,
  ahora,
  barrio,
  zona,
  onZona,
  zonas,
  recientes,
  nuevos,
  onVerNuevos,
}: Props) {
  const lista = filtrar(incidentes, filtro)
  const secciones = agrupar(lista)
  const orden = secciones.flatMap((s) => s.incidentes)
  const n = conteos(incidentes)
  const ref = useRef<HTMLDivElement>(null)

  // Flechas arriba/abajo recorren la cola sin soltar el teclado, de una sección a la siguiente.
  function teclado(e: React.KeyboardEvent, i: number) {
    const paso = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0
    if (!paso) return
    e.preventDefault()
    const sig = orden[i + paso]
    if (!sig) return
    onSeleccion(sig.id)
    ref.current
      ?.querySelectorAll<HTMLButtonElement>("button[data-fila]")
      [i + paso]?.focus()
  }

  return (
    <section
      className="flex h-full min-h-0 flex-col"
      aria-label="Cola de incidentes"
    >
      <div
        className="flex h-9 shrink-0 items-center gap-0.5 border-b px-1.5"
        role="tablist"
        aria-label="Filtrar incidentes"
      >
        {FILTROS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filtro === f.id}
            onClick={() => onFiltro(f.id)}
            className={cn(
              "flex h-6 items-center gap-1.5 rounded-sm px-2 text-xs text-muted-foreground transition-colors hover:text-foreground",
              filtro === f.id && "bg-accent font-medium text-foreground"
            )}
          >
            {f.etiqueta}
            <span className="font-mono text-[0.6875rem] opacity-70">
              {n[f.id]}
            </span>
          </button>
        ))}
      </div>

      <div className="flex h-8 shrink-0 items-center gap-1 border-b px-1.5">
        <FiltroZona zona={zona} onZona={onZona} zonas={zonas} />
        {nuevos.length > 0 && (
          <button
            type="button"
            onClick={onVerNuevos}
            className="ml-auto flex h-6 shrink-0 animate-latido items-center gap-1 rounded-full bg-foreground px-2 text-[0.6875rem] font-medium text-background"
            aria-live="polite"
          >
            <ArrowDown aria-hidden="true" className="size-3" />
            {nuevos.length} nuevo{nuevos.length > 1 ? "s" : ""}
          </button>
        )}
      </div>

      {lista.length === 0 ? (
        <p className="p-4 text-xs text-muted-foreground">
          {cargando
            ? "Cargando…"
            : incidentes.length
              ? "Ningún incidente con este filtro."
              : zona
                ? `Nada en ${zona.nombre}.`
                : "Todavía no hay incidentes."}
        </p>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div ref={ref}>
            {secciones.map(({ grupo, incidentes: deGrupo }) => (
              <section key={grupo.id} aria-labelledby={`g-${grupo.id}`}>
                <h3
                  id={`g-${grupo.id}`}
                  className="sticky top-0 z-10 flex items-center justify-between border-b bg-muted/95 px-3 py-1 text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase backdrop-blur"
                >
                  {grupo.titulo}
                  <span className="font-mono font-normal">
                    {deGrupo.length}
                  </span>
                </h3>
                {deGrupo.length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    {grupo.vacio}
                  </p>
                )}
                <ol className="divide-y border-b">
                  {deGrupo.map((inc) => {
                    const i = orden.indexOf(inc)
                    const b = barrio(inc.geohash)
                    const elegida = seleccion === inc.id
                    const Icono = ICONO_TIPO[inc.tipo]
                    const decidido =
                      inc.estado === "aprobada" || inc.estado === "rechazada"
                    const avisos =
                      inc.incertidumbre.revisar ||
                      inc.impacto.vulnerables ||
                      inc.incertidumbre.sin_ubicacion ||
                      inc.vigencia.sin_noticias_recientes ||
                      decidido
                    return (
                      <li key={inc.id}>
                        {/* Dos líneas fijas (qué, dónde, cuántos, cuándo · lo que dijo la gente) y una
                      tercera solo si hay algo fuera de lo normal. El resto, en el panel. */}
                        <button
                          data-fila
                          data-id={inc.id}
                          aria-current={elegida}
                          onClick={() => onSeleccion(inc.id)}
                          onKeyDown={(e) => teclado(e, i)}
                          title={inc.motivo_orden}
                          className={cn(
                            "relative grid w-full gap-0.5 py-2 pr-2.5 pl-3.5 text-left text-xs transition-colors hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none",
                            recientes.has(inc.id) && "animate-llegada",
                            elegida && "bg-accent",
                            decidido && !elegida && "opacity-60"
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "absolute inset-y-0 left-0 w-1",
                              BARRA_PRIORIDAD[inc.prioridad]
                            )}
                          />
                          <span className="flex min-w-0 items-center gap-1.5">
                            <Prioridad p={inc.prioridad} />
                            <Icono
                              aria-hidden="true"
                              className="size-3.5 shrink-0"
                            />
                            <span className="shrink-0 font-medium">
                              {TIPO[inc.tipo]}
                            </span>
                            {b && (
                              <span className="truncate text-muted-foreground">
                                · {b.nombre}
                              </span>
                            )}
                            <span className="ml-auto flex shrink-0 items-center gap-2 font-mono text-[0.6875rem] text-muted-foreground">
                              <span
                                className="flex items-center gap-0.5"
                                title={`${inc.impacto.personas} personas`}
                              >
                                <Users className="size-3" aria-hidden="true" />
                                {inc.impacto.personas}
                              </span>
                              {haceCuanto(inc.hora_unix, ahora).replace(
                                "hace ",
                                ""
                              )}
                            </span>
                          </span>
                          <span className="truncate text-muted-foreground">
                            «{inc.evidencia[0]?.texto || "sin texto"}»
                          </span>
                          {avisos && (
                            <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[0.6875rem]">
                              {inc.incertidumbre.revisar && (
                                <span className="flex items-center gap-1 font-medium text-revisar">
                                  <TriangleAlert
                                    className="size-3"
                                    aria-hidden="true"
                                  />
                                  Revisar
                                </span>
                              )}
                              {inc.impacto.vulnerables && (
                                <span className="font-medium">
                                  Niños o mayores
                                </span>
                              )}
                              {inc.incertidumbre.sin_ubicacion && (
                                <span className="flex items-center gap-1 text-p2">
                                  <MapPinOff
                                    className="size-3"
                                    aria-hidden="true"
                                  />
                                  Sin ubicación
                                </span>
                              )}
                              {inc.vigencia.sin_noticias_recientes && (
                                <span className="flex items-center gap-1 text-vencido">
                                  <Clock
                                    className="size-3"
                                    aria-hidden="true"
                                  />
                                  {inc.vigencia.minutos_sin_noticias} min sin
                                  noticias
                                </span>
                              )}
                              {decidido && <EstadoInsignia e={inc.estado} />}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </section>
            ))}
          </div>
        </ScrollArea>
      )}
    </section>
  )
}
