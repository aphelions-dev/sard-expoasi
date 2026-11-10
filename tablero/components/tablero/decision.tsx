"use client"

import { useState } from "react"
import { Check, LoaderCircle, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { decidir, mensajeDecision, type Nodo } from "@/lib/api/central"
import type { Incidente } from "@/lib/api/tipos"
import { cn } from "@/lib/utils"

const vigenteDe = (inc: Incidente) =>
  inc.accion_propuesta && inc.decision?.accion_id === inc.accion_propuesta.id ? inc.decision : null

/** La acción propuesta completa. Va después de la evidencia: primero se mira, luego se decide. */
export function Propuesta({ inc, lugar }: { inc: Incidente; lugar: (texto: string) => string }) {
  const a = inc.accion_propuesta
  if (!a) {
    return <p className="text-xs text-muted-foreground">El sistema todavía no sugiere una acción para este incidente.</p>
  }
  const vigente = vigenteDe(inc)
  const anterior = inc.decision && !vigente ? inc.decision : null

  return (
    <div className="space-y-2.5 text-xs">
      {/* La entidad va en la frase; la prioridad y las personas, arriba en el incidente. */}
      <p className="text-sm font-medium">{lugar(a.accion)}</p>
      {a.recurso && (
        <p>
          <span className="text-muted-foreground">Recurso que se solicita:</span> {a.recurso}
        </p>
      )}

      {a.falta_confirmar.length > 0 && (
        <div>
          <h4 className="font-medium">Falta confirmar</h4>
          <ul className="mt-0.5 list-disc pl-4 text-muted-foreground">
            {a.falta_confirmar.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {anterior && (
        <p className="text-muted-foreground">
          Llegó información nueva después de la decisión anterior ({anterior.decision === "aprobar" ? "aprobada" : "rechazada"} por{" "}
          {anterior.coordinador}): esta es una sugerencia nueva.
        </p>
      )}
    </div>
  )
}

interface Props {
  inc: Incidente
  nodo: Nodo | null
  coordinador: string
  lugar: (texto: string) => string
  onDecidido: () => void
}

/** Barra fija al pie del panel: la decisión siempre está a mano. Nada avanza sin que el
 *  coordinador apriete un botón. */
export function BarraDecision({ inc, nodo, coordinador, lugar, onDecidido }: Props) {
  const [nota, setNota] = useState("")
  const [enviando, setEnviando] = useState<"aprobar" | "rechazar" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const a = inc.accion_propuesta
  if (!a) return null

  const vigente = vigenteDe(inc)
  const notaObligatoria = inc.incertidumbre.revisar
  const sinNombre = !coordinador.trim()
  const faltaNota = notaObligatoria && !nota.trim()

  async function enviar(decision: "aprobar" | "rechazar") {
    if (!nodo) return
    setEnviando(decision)
    setError(null)
    try {
      await decidir(nodo, inc.id, { decision, coordinador: coordinador.trim(), nota: nota.trim() })
      setNota("")
      onDecidido()
    } catch (e) {
      setError(mensajeDecision(e))
    } finally {
      setEnviando(null)
    }
  }

  if (vigente) {
    return (
      <div
        role="status"
        className={cn(
          "flex shrink-0 gap-2 border-t p-3 text-xs",
          vigente.decision === "aprobar" ? "bg-ok-surface text-ok" : "bg-muted text-muted-foreground",
        )}
      >
        {vigente.decision === "aprobar" ? <Check className="size-4 shrink-0" aria-hidden="true" /> : <X className="size-4 shrink-0" aria-hidden="true" />}
        <div>
          <strong>{vigente.decision === "aprobar" ? "Aprobada" : "Rechazada"}</strong> por {vigente.coordinador}
          {vigente.decision === "aprobar" && a.recurso && (
            <p className="mt-0.5 text-foreground/80">
              Se solicita {a.recurso} a {a.entidad}.
            </p>
          )}
          {vigente.nota && <p className="mt-0.5 text-foreground/80">«{vigente.nota}»</p>}
        </div>
      </div>
    )
  }

  return (
    // El paso 4, separado del resto: otro fondo, un borde marcado y su propio título, para que
    // nunca se confunda leer con decidir.
    <section aria-labelledby="t-decision" className="shrink-0 space-y-2 border-t-2 border-foreground/70 bg-muted p-3 text-xs">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="grid size-4 place-items-center rounded-full bg-foreground font-mono text-[0.625rem] text-background">
          4
        </span>
        <h3 id="t-decision" className="shrink-0 font-semibold">
          Tu decisión
        </h3>
        <span className="truncate text-muted-foreground" title={lugar(a.accion)}>
          · {lugar(a.accion)}
        </span>
      </div>
      <label htmlFor="nota" className="sr-only">
        Nota
      </label>
      <Textarea
        id="nota"
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        rows={2}
        aria-describedby="ayuda-nota"
        className="min-h-12 bg-card"
        placeholder={notaObligatoria ? "Nota obligatoria: por qué apruebas lo que el sistema marcó para revisar" : "Nota opcional para el equipo"}
      />
      {error && (
        <p role="alert" className="rounded-sm border border-destructive/40 bg-destructive/10 p-2 text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <p id="ayuda-nota" className={cn("mr-auto", sinNombre || faltaNota ? "text-revisar" : "text-muted-foreground")}>
          {sinNombre
            ? "Identifícate arriba a la derecha para poder decidir."
            : faltaNota
              ? "Marcado para revisar: la nota es obligatoria para aprobar."
              : `Decides como ${coordinador.trim()}.`}
        </p>
        <Button variant="outline" size="lg" disabled={sinNombre || !!enviando || !nodo} onClick={() => enviar("rechazar")}>
          {enviando === "rechazar" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <X aria-hidden="true" />}
          Rechazar
        </Button>
        <Button size="lg" disabled={sinNombre || faltaNota || !!enviando || !nodo} onClick={() => enviar("aprobar")}>
          {enviando === "aprobar" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
          Aprobar
        </Button>
      </div>
    </section>
  )
}
