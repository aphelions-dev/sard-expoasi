// Cola de reintentos de la app web (contrato, reglas 2 y 5), como `Cola.kt` de la app Android.
// La web no tiene vecinos de malla: la ronda nueva de un vencido empieza cuando vuelve internet.
import type { Prioridad } from "./sard1"

export type Estado = "pendiente" | "entregado" | "no_entregado" | "rechazado"

export type Guardado = {
  id: string
  mensaje: string
  prioridad: Prioridad
  horaUnix: number
  estado: Estado
  intentos: number
  proximoMs: number
  inicioRondaMs: number // 0 mientras siga en la primera ronda
  motivo?: string // por qué la central lo rechazó
  central?: "A" | "B"
}

export const VENCE_MS = 600_000
const ESPERAS_S = [2, 4, 8, 16, 32, 60]

/** Espera tras [intentos] envíos: 2, 4, 8, 16, 32 s y luego 60 s, con ±20 % según [azar]. */
export function esperaMs(intentos: number, azar: number): number {
  const base =
    ESPERAS_S[Math.min(Math.max(intentos - 1, 0), ESPERAS_S.length - 1)] * 1000
  return Math.floor(base * (0.8 + 0.4 * azar))
}

export function vencido(g: Guardado, ahoraMs: number): boolean {
  const inicio = g.inicioRondaMs > 0 ? g.inicioRondaMs : g.horaUnix * 1000
  return ahoraMs - inicio >= VENCE_MS
}

/** Los pendientes cuyo intento ya llegó: P1 primero y, en cada prioridad, el más antiguo. */
export function debidos(lista: Guardado[], ahoraMs: number): Guardado[] {
  return lista
    .filter((g) => g.estado === "pendiente" && g.proximoMs <= ahoraMs)
    .sort(
      (a, b) =>
        a.prioridad.localeCompare(b.prioridad) || a.horaUnix - b.horaUnix
    )
}

/** Ronda nueva para los no entregados: se intentan ya y la espera vuelve a 2 s. */
export function reactivar(lista: Guardado[], ahoraMs: number): Guardado[] {
  return lista.map((g) =>
    g.estado === "no_entregado"
      ? {
          ...g,
          estado: "pendiente",
          intentos: 0,
          proximoMs: ahoraMs,
          inicioRondaMs: ahoraMs,
        }
      : g
  )
}
