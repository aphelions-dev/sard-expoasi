"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import type { Prioridad as TPrioridad, Rechazado } from "@/lib/api/tipos"
import { haceCuanto } from "@/lib/formato"
import { cn } from "@/lib/utils"

import { Prioridad } from "./insignias"

const PRIORIDADES = new Set(["P1", "P2", "P3", "P4"])

/** Mensajes que no cumplieron el protocolo: no recibieron SACK, así que el celular sigue
 *  reintentando, pero lo que sí llegó no queda invisible. El orden lo pone la central. */
export function Rechazados({ lista, ahora }: { lista: Rechazado[] | null; ahora: number }) {
  const pendientes = lista?.filter((r) => !r.recuperado).length ?? 0
  return (
    <section className="flex h-full min-h-0 flex-col" aria-labelledby="t-rechazados">
      <header className="space-y-1 px-3 pt-3 pb-2.5">
        <h2 id="t-rechazados" className="text-base font-semibold">Mensajes rechazados</h2>
        <p className="text-xs text-muted-foreground">
          Llegaron mal formados o cortados y no recibieron <span className="font-mono">SACK</span>: el celular sigue reintentando. Aquí se ve lo
          que sí llegó, sin completar nada. «Recuperado» quiere decir que después llegó una versión válida del mismo reporte.
        </p>
        {lista && lista.length > 0 && (
          <p className="text-xs">
            <span className="font-mono">{pendientes}</span> sin recuperar ·{" "}
            <span className="font-mono">{lista.length - pendientes}</span> recuperado{lista.length - pendientes === 1 ? "" : "s"}
          </p>
        )}
      </header>
      {lista === null ? (
        <p className="border-t p-3 text-xs text-muted-foreground">Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="border-t p-3 text-xs text-muted-foreground">No hay mensajes rechazados.</p>
      ) : (
        <ScrollArea className="min-h-0 flex-1 border-t">
          <ul className="divide-y">
            {lista.map((r, i) => {
              const p = r.campos.prioridad
              return (
                <li key={`${r.reporte_id ?? "sin-id"}-${r.recibido_en}-${i}`} className={cn("space-y-1.5 px-3 py-2.5 text-xs", r.recuperado && "opacity-60")}>
                  <div className="flex flex-wrap items-center gap-2">
                    {p && PRIORIDADES.has(p) && <Prioridad p={p as TPrioridad} />}
                    <span className="font-mono">{r.reporte_id ?? "id ilegible"}</span>
                    <span
                      className={cn(
                        "rounded-sm border px-1.5 text-[0.6875rem]",
                        r.recuperado ? "border-ok/40 bg-ok-surface text-ok" : "border-revisar/40 bg-revisar-surface text-revisar",
                      )}
                    >
                      {r.recuperado ? "Recuperado" : "Sin recuperar"}
                    </span>
                    <span className="ml-auto text-[0.6875rem] text-muted-foreground">
                      {r.pasarela_id ?? "pasarela desconocida"} · {haceCuanto(r.recibido_en, ahora)}
                    </span>
                  </div>
                  <ul className="list-disc pl-4">
                    {r.motivos.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                  {Object.keys(r.campos).length > 0 ? (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-sm bg-muted/60 p-2">
                      {Object.entries(r.campos).map(([k, v]) => (
                        <div key={k} className="contents">
                          <dt className="text-muted-foreground">{k.replace("_", " ")}</dt>
                          <dd className="font-mono break-all">{v === "" ? <em className="text-muted-foreground">vacío</em> : v}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-muted-foreground">No llegó ningún campo legible.</p>
                  )}
                </li>
              )
            })}
          </ul>
        </ScrollArea>
      )}
    </section>
  )
}
