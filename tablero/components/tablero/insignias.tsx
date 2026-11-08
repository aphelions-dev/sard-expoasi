import { TriangleAlert } from "lucide-react"

import type { Corroboracion, Estado, Prioridad } from "@/lib/api/tipos"
import { CORROBORACION, ESTADO } from "@/lib/formato"
import { cn } from "@/lib/utils"

const NOMBRE_PRIORIDAD: Record<Prioridad, string> = { P1: "crítica", P2: "alta", P3: "media", P4: "baja" }

// Clases completas (no armadas con plantillas) para que Tailwind las encuentre.
export const TONO_PRIORIDAD: Record<Prioridad, string> = {
  P1: "bg-p1-surface text-p1 border-p1/40",
  P2: "bg-p2-surface text-p2 border-p2/40",
  P3: "bg-p3-surface text-p3 border-p3/40",
  P4: "bg-p4-surface text-p4 border-p4/40",
}

export const BARRA_PRIORIDAD: Record<Prioridad, string> = {
  P1: "bg-p1",
  P2: "bg-p2",
  P3: "bg-p3",
  P4: "bg-p4",
}

const base = "inline-flex h-5 shrink-0 items-center gap-1 rounded-sm border px-1.5 text-[0.6875rem] font-medium whitespace-nowrap"

/** La prioridad siempre va con su texto: el color nunca es la única señal. */
export function Prioridad({ p, grande = false }: { p: Prioridad; grande?: boolean }) {
  return (
    <span
      className={cn(base, "font-mono font-semibold", TONO_PRIORIDAD[p], grande && "h-6 px-2 text-xs")}
      title={`Prioridad ${NOMBRE_PRIORIDAD[p]}`}
    >
      {p}
      {grande && <span className="font-sans font-medium">{NOMBRE_PRIORIDAD[p]}</span>}
    </span>
  )
}

const TONO_ESTADO: Record<Estado, string> = {
  sin_propuesta: "border-border text-muted-foreground",
  pendiente: "border-foreground/30 text-foreground",
  aprobada: "border-ok/40 bg-ok-surface text-ok",
  rechazada: "border-border bg-muted text-muted-foreground line-through decoration-1",
}

export function EstadoInsignia({ e }: { e: Estado }) {
  return <span className={cn(base, TONO_ESTADO[e])}>{ESTADO[e]}</span>
}

export function Revisar() {
  return (
    <span className={cn(base, "border-revisar/40 bg-revisar-surface text-revisar")}>
      <TriangleAlert className="size-3" aria-hidden="true" />
      Revisar
    </span>
  )
}

const TONO_CONFIANZA: Record<Corroboracion, string> = {
  corroborado: "border-ok/40 text-ok",
  sin_confirmar: "border-border text-muted-foreground",
  posible_rumor: "border-revisar/40 text-revisar",
}

export function Confianza({ c }: { c: Corroboracion }) {
  return <span className={cn(base, TONO_CONFIANZA[c])}>{CORROBORACION[c]}</span>
}

/** Punto de salud: en línea, caída o sin dato. */
export function Punto({ estado }: { estado: "ok" | "caido" | "aviso" | "espera" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        estado === "ok" && "bg-ok",
        estado === "caido" && "bg-p1",
        estado === "aviso" && "bg-p2",
        estado === "espera" && "bg-muted-foreground/50",
      )}
    />
  )
}
