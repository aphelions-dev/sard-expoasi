// Cliente de la API de la central. El tablero lee de la A mientras responda a /salud; si no, de la B.
import type { Incidente, Rechazado, Recurso, Salud } from "./tipos";

export type Nodo = "A" | "B";

export const CENTRALES: Record<Nodo, string> = {
  A: process.env.NEXT_PUBLIC_CENTRAL_A_URL || "http://localhost:8001",
  B: process.env.NEXT_PUBLIC_CENTRAL_B_URL || "http://localhost:8002",
};

const ESPERA_MS = 2500;

export class ErrorApi extends Error {
  constructor(public estado: number, mensaje: string) {
    super(mensaje);
  }
}

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(ESPERA_MS) });
  if (!r.ok) {
    const cuerpo = await r.json().catch(() => null);
    const detalle = typeof cuerpo?.detail === "string" ? cuerpo.detail : r.statusText;
    throw new ErrorApi(r.status, detalle);
  }
  return r.json() as Promise<T>;
}

/** `null` si la central no responde: para el tablero eso es "caída". */
export async function salud(nodo: Nodo): Promise<Salud | null> {
  try {
    return await pedir<Salud>(`${CENTRALES[nodo]}/salud`);
  } catch {
    return null;
  }
}

/** La A mientras esté arriba; si no, la B; `null` si las dos están caídas. */
export function elegirActiva(saludes: Record<Nodo, Salud | null>): Nodo | null {
  if (saludes.A) return "A";
  if (saludes.B) return "B";
  return null;
}

export function incidentes(nodo: Nodo): Promise<Incidente[]> {
  return pedir<Incidente[]>(`${CENTRALES[nodo]}/incidentes`);
}

export interface EntradaDecision {
  decision: "aprobar" | "rechazar";
  coordinador: string;
  nota: string;
}

export function decidir(nodo: Nodo, incidenteId: string, entrada: EntradaDecision): Promise<Incidente> {
  return pedir<Incidente>(`${CENTRALES[nodo]}/incidentes/${encodeURIComponent(incidenteId)}/aprobacion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entrada),
  });
}

/** Mensaje para el coordinador según el código de `POST /incidentes/{id}/aprobacion`. */
export function mensajeDecision(e: unknown): string {
  if (e instanceof ErrorApi) {
    if (e.estado === 404) return "El incidente ya no existe en esta central.";
    if (e.estado === 409) return "El incidente todavía no tiene una acción propuesta.";
    if (e.estado === 422) return "Este incidente está marcado para revisar: escribe en la nota por qué lo apruebas.";
    return `La central respondió ${e.estado}: ${e.message}`;
  }
  return "No se pudo hablar con la central. La decisión no se registró; inténtalo de nuevo.";
}

export function recursos(nodo: Nodo): Promise<Recurso[]> {
  return pedir<Recurso[]>(`${CENTRALES[nodo]}/recursos`);
}

export interface EntradaRecurso {
  entidad: string;
  recurso: string;
  disponibles: number;
  coordinador: string;
}

export function declararRecurso(nodo: Nodo, entrada: EntradaRecurso): Promise<Recurso[]> {
  return pedir<Recurso[]>(`${CENTRALES[nodo]}/recursos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entrada),
  });
}

export function rechazados(nodo: Nodo): Promise<Rechazado[]> {
  return pedir<Rechazado[]>(`${CENTRALES[nodo]}/rechazados`);
}
