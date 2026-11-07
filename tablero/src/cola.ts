// Filtros de la cola. Nunca reordenan: el orden lo decide la central (`motivo_orden`).
import type { Incidente } from "./api/tipos";

export type Filtro = "todos" | "urgentes" | "revisar" | "resto";

export const FILTROS: { id: Filtro; etiqueta: string }[] = [
  { id: "todos", etiqueta: "Todos" },
  { id: "urgentes", etiqueta: "P1–P2" },
  { id: "revisar", etiqueta: "Revisar" },
  { id: "resto", etiqueta: "P3–P4" },
];

const CUMPLE: Record<Filtro, (i: Incidente) => boolean> = {
  todos: () => true,
  urgentes: (i) => i.prioridad === "P1" || i.prioridad === "P2",
  revisar: (i) => i.incertidumbre.revisar,
  resto: (i) => i.prioridad === "P3" || i.prioridad === "P4",
};

export function filtrar(lista: Incidente[], filtro: Filtro): Incidente[] {
  return lista.filter(CUMPLE[filtro]);
}

export function conteos(lista: Incidente[]): Record<Filtro, number> {
  return {
    todos: lista.length,
    urgentes: lista.filter(CUMPLE.urgentes).length,
    revisar: lista.filter(CUMPLE.revisar).length,
    resto: lista.filter(CUMPLE.resto).length,
  };
}

/** Pendientes de decisión humana: lo que el coordinador tiene por hacer. */
export function porDecidir(lista: Incidente[]): number {
  return lista.filter((i) => i.estado === "pendiente").length;
}
