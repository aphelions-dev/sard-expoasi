// Filtros y secciones de la cola. El orden lo decide la central (`motivo_orden`); aquí solo se
// separa por lo que falta hacer y se deja al final de cada prioridad lo que quizá no aplica.
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

/** Todos sus reportes podrían estar negando la palabra de alerta («ya apagamos el fuego»). La
 *  prioridad no baja (ADR 0005); en la cola va al final de su prioridad, con su marca. */
export function quizaNoAplica(i: Incidente): boolean {
  const negados = new Set(
    i.incertidumbre.motivos.filter((m) => m.includes("posible negación de")).map((m) => m.split(": ")[0]),
  );
  return i.reportes.length > 0 && i.reportes.every((r) => negados.has(r));
}

export type Grupo = "decidir" | "sin_noticias" | "aprobados" | "descartados";

/** Secciones de la cola, en el orden en que piden trabajo: lo que espera una decisión, lo que la
 *  espera pero lleva más de una hora sin un reporte nuevo, lo aprobado y lo descartado. */
export const GRUPOS: { id: Grupo; titulo: string; vacio: string }[] = [
  { id: "decidir", titulo: "Por decidir", vacio: "Nada reciente pendiente de decisión." },
  { id: "sin_noticias", titulo: "Por decidir · sin noticias recientes", vacio: "" },
  { id: "aprobados", titulo: "Aprobados", vacio: "" },
  { id: "descartados", titulo: "Descartados", vacio: "" },
];

export function grupoDe(i: Incidente): Grupo {
  if (i.estado === "rechazada") return "descartados";
  if (i.estado === "aprobada") return "aprobados";
  return i.vigencia.sin_noticias_recientes ? "sin_noticias" : "decidir";
}

/** Dentro de cada prioridad, lo que quizá no aplica va al final; el resto conserva el orden de la
 *  central (`motivo_orden`). */
function dudososAlFinal(lista: Incidente[]): Incidente[] {
  return lista
    .map((inc, n) => ({ inc, n, dudoso: quizaNoAplica(inc) }))
    .sort((a, b) => a.inc.prioridad.localeCompare(b.inc.prioridad) || Number(a.dudoso) - Number(b.dudoso) || a.n - b.n)
    .map((x) => x.inc);
}

/** La cola partida en secciones. */
export function agrupar(lista: Incidente[]): { grupo: (typeof GRUPOS)[number]; incidentes: Incidente[] }[] {
  return GRUPOS.map((grupo) => {
    const suyos = lista.filter((i) => grupoDe(i) === grupo.id);
    return { grupo, incidentes: grupo.id === "decidir" || grupo.id === "sin_noticias" ? dudososAlFinal(suyos) : suyos };
  }).filter((s) => s.grupo.id === "decidir" || s.incidentes.length > 0);
}
