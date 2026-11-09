// Recursos por tipo de incidente, tal como los fija `contracts/api-central.md` (Recursos).
import type { EstadoUnidad, Incidente, Recurso, Tipo } from "./api/tipos";

export interface Catalogo {
  entidad: string;
  recurso: string;
  tipos: Tipo[];
}

export const CATALOGO: Catalogo[] = [
  { entidad: "Bomberos", recurso: "equipo de rescate", tipos: ["ATRAP"] },
  { entidad: "Bomberos", recurso: "máquina de bomberos", tipos: ["FUEGO"] },
  { entidad: "Cruz Roja", recurso: "ambulancia", tipos: ["MEDIC"] },
  { entidad: "Cruz Roja", recurso: "equipo de búsqueda", tipos: ["DESAP"] },
  { entidad: "Defensa Civil", recurso: "cuadrilla", tipos: ["VIA"] },
];

export const ESTADO_UNIDAD: Record<EstadoUnidad, string> = {
  disponible: "Disponible",
  asignada: "Asignada",
  no_disponible: "No disponible",
};

export interface FilaRecurso extends Catalogo {
  registro: Recurso | null; // null: la entidad no ha registrado unidades
  faltan: number;           // solicitudes abiertas que no alcanza a cubrir lo disponible
}

const clave = (entidad: string, recurso: string) => `${entidad}|${recurso}`;

/** Una fila por recurso del catálogo, más cualquier otro que la central tenga registrado. */
export function filas(recursos: Recurso[]): FilaRecurso[] {
  const porClave = new Map(recursos.map((r) => [clave(r.entidad, r.recurso), r]));
  const conocidos = new Set(CATALOGO.map((c) => clave(c.entidad, c.recurso)));
  const extra: Catalogo[] = recursos
    .filter((r) => !conocidos.has(clave(r.entidad, r.recurso)))
    .map((r) => ({ entidad: r.entidad, recurso: r.recurso, tipos: [] }));
  return [...CATALOGO, ...extra].map((c) => {
    const registro = porClave.get(clave(c.entidad, c.recurso)) ?? null;
    const faltan = registro ? Math.max(0, registro.solicitudes_abiertas.length - registro.disponibles) : 0;
    return { ...c, registro, faltan };
  });
}

/** Incidentes a los que se puede asignar una unidad de este recurso: primero los que ya lo tienen
 *  solicitado (en el orden de la central), luego los pendientes que lo piden. */
export function candidatos(f: FilaRecurso, incidentes: Incidente[]): Incidente[] {
  const piden = incidentes.filter(
    (i) => (i.estado === "aprobada" || i.estado === "pendiente") && i.recurso?.entidad === f.entidad && i.recurso.recurso === f.recurso,
  );
  const abiertas = f.registro?.solicitudes_abiertas ?? [];
  const rango = (i: Incidente) => (abiertas.includes(i.id) ? abiertas.indexOf(i.id) : abiertas.length + piden.indexOf(i));
  return piden.sort((a, b) => rango(a) - rango(b));
}
