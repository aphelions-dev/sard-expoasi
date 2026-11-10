// Reporte SARD1 desde la app web, con las mismas reglas que la app Android
// (`contracts/protocolo-sard1.md`, secciones «Formato», «Ubicación» y «Prioridad en el celular»).
import geohash from "ngeohash"

export const TIPOS = [
  "ATRAP",
  "MEDIC",
  "FUEGO",
  "DESLIZ",
  "INUND",
  "GAS",
  "VIA",
  "DESAP",
  "OTRO",
] as const
export type Tipo = (typeof TIPOS)[number]
export type Prioridad = "P1" | "P2" | "P3" | "P4"

export const NOMBRE_TIPO: Record<Tipo, string> = {
  ATRAP: "Atrapados",
  MEDIC: "Médica",
  FUEGO: "Incendio",
  DESLIZ: "Deslizamiento",
  INUND: "Inundación",
  GAS: "Fuga de gas",
  VIA: "Vía bloqueada",
  DESAP: "Desaparecido",
  OTRO: "Otro",
}

export type Datos = {
  tipo: Tipo
  personas: number
  atrapados: boolean
  heridos: boolean
  vulnerables: boolean // niños o adultos mayores
  texto: string
}

export type Reporte = Datos & {
  id: string
  prioridad: Prioridad
  geohash: string
  horaUnix: number
}

/** Minúsculas y sin tildes, la regla de comparación de `palabras-criticas.txt`. */
export function normalizar(texto: string): string {
  return texto.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "")
}

/** Lee el formato de `palabras-criticas.txt`: una por línea, `#` es comentario. */
export function leerLista(contenido: string): string[] {
  return contenido
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map(normalizar)
}

/** La primera palabra crítica que aparece en el texto, o null. */
export function palabraCritica(
  texto: string,
  palabras: string[]
): string | null {
  const t = normalizar(texto)
  return palabras.find((p) => t.includes(p)) ?? null
}

/** Gana la primera regla que se cumple, de arriba abajo. Solo reglas (ADR 0004). */
export function prioridad(d: Datos, palabras: string[]): Prioridad {
  if (d.atrapados || palabraCritica(d.texto, palabras)) return "P1"
  if (d.heridos || d.vulnerables) return "P2"
  if (d.personas >= 1) return "P3"
  return "P4"
}

/** Tan largo como lo permite la precisión del GPS (radio en metros, 68 % de confianza). */
export function largoGeohash(precisionM: number): number {
  if (precisionM <= 5) return 9
  if (precisionM <= 20) return 8
  if (precisionM <= 75) return 7
  return 6
}

export function geohashDe(
  lat: number,
  lon: number,
  precisionM: number
): string {
  return geohash.encode(lat, lon, largoGeohash(precisionM))
}

/** El texto va en una sola línea: un salto partiría el mensaje en la malla. */
export function limpiarTexto(texto: string): string {
  return texto.replace(/\s+/g, " ").trim()
}

export function mensaje(r: Reporte): string {
  const banderas = [r.atrapados, r.heridos, r.vulnerables]
    .map((b) => (b ? "1" : "0"))
    .join("")
  return `SARD1|${r.id}|${r.prioridad}|${r.tipo}|${r.personas}|${banderas}|${r.geohash}|${r.horaUnix}|${r.texto}`
}

/** El id confirmado si el mensaje es un `SACK|<id>`; null en otro caso. */
export function leerSack(m: string): string | null {
  const id = m.startsWith("SACK|") ? m.slice(5) : ""
  return /^[0-9A-Za-z]+-[0-9]+$/.test(id) ? id : null
}
