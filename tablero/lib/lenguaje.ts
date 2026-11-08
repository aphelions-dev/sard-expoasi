// La central habla en su idioma (Jev, señales con guion bajo, "el celular dice…"); quien coordina
// no tiene por qué saber qué es Jev ni cómo funciona el triaje. Aquí se traduce lo que la central
// escribe a palabras de una sala de crisis. Lo que no se reconoce se deja como vino.
import type { Tipo } from "./api/tipos"
import { TIPO } from "./formato"

const SENALES: Record<string, string> = {
  atrapados: "personas atrapadas",
  no_respira: "alguien no respira",
  inconsciente: "alguien inconsciente",
  sangrado_grave: "sangrado grave",
  incendio_activo: "fuego activo",
  riesgo_vital: "riesgo para la vida",
  herido: "personas heridas",
  "prioridad del celular": "prioridad que marcó quien reportó",
  "atrapados marcado": "marcó personas atrapadas",
  "heridos marcado": "marcó personas heridas",
}

/** Nombre de una señal del triaje en palabras de la sala. */
export function senalLegible(senal: string): string {
  const alerta = senal.match(/^palabra crítica «(.+)»$/)
  if (alerta) return `palabra de alerta «${alerta[1]}»`
  return SENALES[senal] ?? senal.replaceAll("_", " ")
}

/** De dónde salió una señal. */
export const ORIGEN_LEGIBLE: Record<"formulario" | "texto" | "jev", string> = {
  formulario: "Lo marcó quien reportó",
  texto: "Palabra en el mensaje",
  jev: "Análisis automático",
}

const tipo = (t: string) => (t in TIPO ? TIPO[t as Tipo].toLowerCase() : t)

/** Un motivo de revisión u otra frase de la central, sin jerga técnica. */
export function enPalabras(texto: string): string {
  return texto
    .replace(/Jev subió la prioridad de (P\d) a (P\d)/g, "el análisis automático subió la prioridad de $1 a $2: confirma que es así")
    .replace(/riesgo vital dudoso \([\d.,]+\)/g, "no está claro si hay riesgo para la vida")
    .replace(/el celular dice (\w+), Jev ve (\w+)/g, (_, a: string, b: string) => `quien reportó marcó «${tipo(a)}», pero el mensaje parece «${tipo(b)}»`)
    .replace(/\bJev\b/g, "el análisis automático")
    .replace(/^(\S)/, (c) => c.toUpperCase())
}
