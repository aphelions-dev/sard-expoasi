// URLs de las centrales, fijas en la compilación (NEXT_PUBLIC_*). En Railway son los dominios
// públicos con HTTPS; en Docker local, localhost:8001 y :8002.
export type Nodo = "A" | "B"

export const CENTRALES: Record<Nodo, string> = {
  A: process.env.NEXT_PUBLIC_CENTRAL_A_URL || "http://localhost:8001",
  B: process.env.NEXT_PUBLIC_CENTRAL_B_URL || "http://localhost:8002",
}
