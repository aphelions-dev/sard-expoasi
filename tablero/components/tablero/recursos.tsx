"use client"

import { useState } from "react"
import { LoaderCircle, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { declararRecurso, ErrorApi, type Nodo } from "@/lib/api/central"
import type { Incidente, Recurso } from "@/lib/api/tipos"
import { TIPO, haceCuanto } from "@/lib/formato"
import { filas, type FilaRecurso } from "@/lib/recursos"
import { cn } from "@/lib/utils"

interface Props {
  declarados: Recurso[] | null
  incidentes: Incidente[]
  nodo: Nodo | null
  coordinador: string
  ahora: number
  onDeclarado: () => void
}

/** Lo que el coordinador tiene disponible. La coordinación no propone lo que no hay, y cada
 *  aprobación compromete una unidad. */
export function Recursos({ declarados, incidentes, nodo, coordinador, ahora, onDeclarado }: Props) {
  return (
    <section className="flex h-full min-h-0 flex-col" aria-labelledby="t-recursos">
      <header className="space-y-1 px-3 pt-3 pb-2.5">
        <h2 id="t-recursos" className="text-base font-semibold">Recursos</h2>
        <p className="text-xs text-muted-foreground">
          Declara cuántas unidades tienes libres ahora. Cada aprobación compromete una; declarar otra vez reemplaza lo anterior y vuelve a
          contar desde ahí.
        </p>
      </header>
      {declarados === null ? (
        <p className="border-t p-3 text-xs text-muted-foreground">Cargando…</p>
      ) : (
        <ScrollArea className="min-h-0 flex-1 border-t">
          <ul className="divide-y">
            {filas(declarados, incidentes).map((f) => (
              <Fila key={`${f.entidad}|${f.recurso}`} f={f} nodo={nodo} coordinador={coordinador} ahora={ahora} onDeclarado={onDeclarado} />
            ))}
          </ul>
        </ScrollArea>
      )}
    </section>
  )
}

function Fila({ f, nodo, coordinador, ahora, onDeclarado }: { f: FilaRecurso; nodo: Nodo | null; coordinador: string; ahora: number; onDeclarado: () => void }) {
  const d = f.declarado
  const [valor, setValor] = useState(String(d?.disponibles ?? ""))
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState(false)
  const sinNombre = !coordinador.trim()
  const n = Number(valor)
  const valido = valor.trim() !== "" && Number.isInteger(n) && n >= 0
  const faltan = d ? f.piden - d.disponibles : 0

  async function declarar() {
    if (!nodo || !valido) return
    setEnviando(true)
    setError(null)
    setHecho(false)
    try {
      await declararRecurso(nodo, { entidad: f.entidad, recurso: f.recurso, disponibles: n, coordinador: coordinador.trim() })
      setHecho(true)
      onDeclarado()
    } catch (e) {
      setError(e instanceof ErrorApi ? `La central respondió ${e.estado}: ${e.message}` : "No se pudo hablar con la central; no se registró.")
    } finally {
      setEnviando(false)
    }
  }

  const id = `rec-${f.entidad}-${f.recurso}`.replace(/\s+/g, "-")
  return (
    <li className="space-y-2 px-3 py-2.5 text-xs">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium first-letter:uppercase">{f.recurso}</h3>
          <p className="text-muted-foreground">
            {f.entidad}
            {f.tipos.length > 0 && ` · ${f.tipos.map((t) => TIPO[t]).join(", ")}`}
          </p>
        </div>
        {d && (
          <p className="shrink-0 text-right">
            <strong className={cn("font-mono text-lg", d.disponibles === 0 && "text-p1")}>{d.disponibles}</strong>
            <span className="text-muted-foreground"> / {d.declarados} libres</span>
          </p>
        )}
      </div>

      {d ? (
        <>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={d.declarados}
            aria-valuenow={d.comprometidos}
            aria-label={`${d.comprometidos} comprometidas de ${d.declarados}`}
          >
            <span className="block h-full bg-foreground/70" style={{ width: d.declarados ? `${(d.comprometidos / d.declarados) * 100}%` : "0" }} />
          </div>
          <p className="text-muted-foreground">
            {d.comprometidos} comprometida{d.comprometidos === 1 ? "" : "s"} · declarado por {d.coordinador} {haceCuanto(d.declarado_en, ahora)}
          </p>
        </>
      ) : (
        <p className="text-p2">Sin declarar: la coordinación propone sin saber si hay.</p>
      )}
      <p className={cn("flex items-center gap-1", faltan > 0 ? "text-p1" : "text-muted-foreground")}>
        {faltan > 0 && <TriangleAlert className="size-3" aria-hidden="true" />}
        {f.piden} incidente{f.piden === 1 ? "" : "s"} pendiente{f.piden === 1 ? "" : "s"} lo pide{f.piden === 1 ? "" : "n"}
        {faltan > 0 && ` · faltan ${faltan}`}
      </p>

      <div className="flex items-end gap-2">
        <label htmlFor={id} className="grid flex-1 gap-1">
          <span className="text-muted-foreground">Unidades libres ahora</span>
          <Input
            id={id}
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={valor}
            onChange={(e) => {
              setValor(e.target.value)
              setHecho(false)
            }}
            className="font-mono"
          />
        </label>
        <Button disabled={sinNombre || !valido || enviando || !nodo} onClick={declarar}>
          {enviando && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          Declarar
        </Button>
      </div>
      {sinNombre && <p className="text-muted-foreground">Identifícate arriba a la derecha para declarar.</p>}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {hecho && (
        <p role="status" className="text-ok">
          Declarado.
        </p>
      )}
    </li>
  )
}
