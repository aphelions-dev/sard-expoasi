import { TriangleAlert } from "lucide-react";
import type { Corroboracion, Estado, Prioridad } from "../api/tipos";
import { CORROBORACION, ESTADO } from "../formato";

const NOMBRE_PRIORIDAD: Record<Prioridad, string> = {
  P1: "crítica",
  P2: "alta",
  P3: "media",
  P4: "baja",
};

/** La prioridad siempre va con su texto: el color nunca es la única señal. */
export function InsigniaPrioridad({ p, grande = false }: { p: Prioridad; grande?: boolean }) {
  return (
    <span className={`insignia prioridad p-${p.toLowerCase()}${grande ? " grande" : ""}`} title={`Prioridad ${NOMBRE_PRIORIDAD[p]}`}>
      {p}
      {grande && <span className="prioridad-nombre">{NOMBRE_PRIORIDAD[p]}</span>}
    </span>
  );
}

export function InsigniaEstado({ e }: { e: Estado }) {
  return <span className={`insignia estado e-${e}`}>{ESTADO[e]}</span>;
}

export function InsigniaRevisar() {
  return (
    <span className="insignia revisar">
      <TriangleAlert size={13} aria-hidden="true" />
      Revisar
    </span>
  );
}

export function InsigniaConfianza({ c }: { c: Corroboracion }) {
  return <span className={`insignia confianza c-${c}`}>{CORROBORACION[c]}</span>;
}
