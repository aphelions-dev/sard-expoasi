// Zonas del tablero: barrios y comunas oficiales (`public/geo/barrios.geojson`). El geohash de un
// incidente se asigna al barrio donde cae el centro de su celda (`barrioDe`), así que con 6
// caracteres (~1,2 × 0,6 km) la celda puede tocar barrios vecinos: el barrio es una referencia
// para ubicarse y filtrar, no el sitio exacto.
import type { Incidente, Prioridad } from "./api/tipos";
import type { Barrio } from "./geo";

export type Zona = { tipo: "barrio" | "comuna"; id: string; nombre: string };

export const nombreComuna = (c: string) => `Comuna ${Number(c)}`;

export function enZona(barrio: Barrio | null, zona: Zona | null): boolean {
  if (!zona) return true;
  if (!barrio) return false;
  return zona.tipo === "barrio" ? barrio.id === zona.id : barrio.comuna === zona.id;
}

const pendiente = (i: Incidente) => i.estado === "pendiente" || i.estado === "sin_propuesta";
const orden = (p: Prioridad) => Number(p.slice(1));

export interface ResumenBarrio {
  /** Prioridad más alta de lo pendiente; si no queda nada pendiente, la más alta de todos. */
  prioridad: Prioridad;
  /** Cuántos incidentes tiene, decididos o no. */
  total: number;
  pendientes: number;
  revisar: boolean;
  /** Ya no pide trabajo: todo decidido o sin noticias recientes. Se dibuja apagado. */
  apagado: boolean;
}

/** Lo que el mapa pinta en cada barrio, por id de barrio. */
export function resumenPorBarrio(
  incidentes: Incidente[],
  barrio: (gh: string | null) => Barrio | null,
): Map<string, ResumenBarrio> {
  const grupos = new Map<string, Incidente[]>();
  for (const i of incidentes) {
    const b = barrio(i.geohash);
    if (b) grupos.set(b.id, [...(grupos.get(b.id) ?? []), i]);
  }
  const out = new Map<string, ResumenBarrio>();
  for (const [id, g] of grupos) {
    const vivos = g.filter((i) => pendiente(i) && !i.vigencia.sin_noticias_recientes);
    const base = vivos.length ? vivos : g;
    out.set(id, {
      prioridad: base.map((i) => i.prioridad).sort((a, b) => orden(a) - orden(b))[0],
      total: g.length,
      pendientes: g.filter(pendiente).length,
      revisar: g.some((i) => pendiente(i) && i.incertidumbre.revisar),
      apagado: vivos.length === 0,
    });
  }
  return out;
}

/** Barrios y comunas con incidentes, para el buscador: primero los que tienen más pendientes. */
export function zonasConConteo(
  incidentes: Incidente[],
  barrio: (gh: string | null) => Barrio | null,
): { zona: Zona; total: number; pendientes: number }[] {
  const cuenta = new Map<string, { zona: Zona; total: number; pendientes: number }>();
  const sumar = (zona: Zona, i: Incidente) => {
    const k = `${zona.tipo}:${zona.id}`;
    const c = cuenta.get(k) ?? { zona, total: 0, pendientes: 0 };
    c.total += 1;
    if (pendiente(i)) c.pendientes += 1;
    cuenta.set(k, c);
  };
  for (const i of incidentes) {
    const b = barrio(i.geohash);
    if (!b) continue;
    sumar({ tipo: "barrio", id: b.id, nombre: b.nombre }, i);
    sumar({ tipo: "comuna", id: b.comuna, nombre: nombreComuna(b.comuna) }, i);
  }
  return [...cuenta.values()].sort((a, b) => b.pendientes - a.pendientes || b.total - a.total);
}

/** Lo que cambió entre dos lecturas: ids nuevos y los que cambiaron de prioridad. */
export function cambios(antes: Map<string, Prioridad>, ahora: Incidente[]): string[] {
  return ahora.filter((i) => antes.get(i.id) !== i.prioridad).map((i) => i.id);
}
