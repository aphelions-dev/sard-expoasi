// Recursos por tipo de incidente, tal como los fija `contracts/api-central.md` (POST /recursos).
import type { Incidente, Recurso, Tipo } from "./api/tipos";

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

export interface FilaRecurso extends Catalogo {
  declarado: Recurso | null; // null: nadie lo ha declarado
  piden: number;             // incidentes pendientes cuya acción propuesta usa este recurso
}

const clave = (entidad: string, recurso: string) => `${entidad}|${recurso}`;

/** Una fila por recurso del catálogo, más cualquier otro que la central tenga declarado. */
export function filas(declarados: Recurso[], incidentes: Incidente[]): FilaRecurso[] {
  const porClave = new Map(declarados.map((r) => [clave(r.entidad, r.recurso), r]));
  const piden = new Map<string, number>();
  for (const i of incidentes) {
    const a = i.accion_propuesta;
    if (i.estado === "pendiente" && a?.recurso) {
      const k = clave(a.entidad, a.recurso);
      piden.set(k, (piden.get(k) ?? 0) + 1);
    }
  }
  const conocidos = new Set(CATALOGO.map((c) => clave(c.entidad, c.recurso)));
  const extra: Catalogo[] = declarados
    .filter((r) => !conocidos.has(clave(r.entidad, r.recurso)))
    .map((r) => ({ entidad: r.entidad, recurso: r.recurso, tipos: [] }));
  return [...CATALOGO, ...extra].map((c) => {
    const k = clave(c.entidad, c.recurso);
    return { ...c, declarado: porClave.get(k) ?? null, piden: piden.get(k) ?? 0 };
  });
}
