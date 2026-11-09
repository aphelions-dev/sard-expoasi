// Filtros de la cola. Nunca reordenan: el orden lo decide la central (`motivo_orden`).
import type { Incidente } from "./api/tipos";

export type Filtro = "todos" | "urgentes" | "revisar" | "resto";

export const FILTROS: { id: Filtro; etiqueta: string }[] = [
  { id: "todos", etiqueta: "Todos" },
  { id: "urgentes", etiqueta: "Urgentes" },
  { id: "revisar", etiqueta: "Revisar" },
  { id: "resto", etiqueta: "No urgentes" }, // P3 y P4; corto para que quepa en la cola angosta
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

export type Grupo = "decidir" | "esperando" | "atencion" | "descartados";

/** Secciones de la cola, en el orden en que piden trabajo: lo que espera una decisión, lo aprobado
 *  que todavía no tiene unidad, lo que ya está en manos de una entidad y lo descartado. */
export const GRUPOS: { id: Grupo; titulo: string; vacio: string }[] = [
  { id: "decidir", titulo: "Por decidir", vacio: "Nada pendiente de decisión." },
  { id: "esperando", titulo: "Esperando unidad", vacio: "" },
  { id: "atencion", titulo: "En atención", vacio: "" },
  { id: "descartados", titulo: "Descartados", vacio: "" },
];

export function grupoDe(i: Incidente): Grupo {
  if (i.estado === "pendiente" || i.estado === "sin_propuesta") return "decidir";
  if (i.estado === "rechazada") return "descartados";
  return i.recurso && i.recurso.asignadas.length === 0 ? "esperando" : "atencion";
}

/** La cola partida en secciones; dentro de cada una se respeta el orden de la central. */
export function agrupar(lista: Incidente[]): { grupo: (typeof GRUPOS)[number]; incidentes: Incidente[] }[] {
  return GRUPOS.map((grupo) => ({ grupo, incidentes: lista.filter((i) => grupoDe(i) === grupo.id) })).filter(
    (s) => s.grupo.id === "decidir" || s.incidentes.length > 0,
  );
}
