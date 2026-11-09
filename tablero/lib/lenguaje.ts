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

const sinTildes = (t: string) => t.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()

/** La palabra entera del mensaje donde aparece un fragmento de la lista de alerta: la lista guarda
 *  raíces («atrap»), pero quien coordina tiene que leer «atrapados». Sin mensaje, el fragmento. */
export function palabraCompleta(fragmento: string, textos: string[]): string {
  const f = sinTildes(fragmento)
  for (const texto of textos) {
    // Quitar tildes no cambia la longitud del texto en español escrito con letras precompuestas.
    const i = sinTildes(texto).indexOf(f)
    if (i < 0 || sinTildes(texto).length !== texto.length) continue
    let a = i
    let b = i + f.length
    while (a > 0 && /[\p{L}\p{N}]/u.test(texto[a - 1])) a--
    while (b < texto.length && /[\p{L}\p{N}]/u.test(texto[b])) b++
    return texto.slice(a, b).toLowerCase()
  }
  return fragmento
}

/** Una cita del mensaje sin palabras partidas: se completa hasta el espacio más cercano. */
export function citaLegible(cita: string, texto: string): string {
  const i = texto.indexOf(cita)
  if (i < 0) return cita
  let a = i
  let b = i + cita.length
  while (a > 0 && !/\s/.test(texto[a - 1])) a--
  while (b < texto.length && !/\s/.test(texto[b])) b++
  return `${a > 0 ? "…" : ""}${texto.slice(a, b).trim()}${b < texto.length ? "…" : ""}`
}

/** Nombre de una señal del triaje en palabras de la sala. */
export function senalLegible(senal: string, texto = ""): string {
  const alerta = senal.match(/^palabra crítica «(.+)»$/)
  if (alerta) return `palabra de alerta «${palabraCompleta(alerta[1], [texto])}»`
  return SENALES[senal] ?? senal.replaceAll("_", " ")
}

/** De dónde salió una señal. */
export const ORIGEN_LEGIBLE: Record<"formulario" | "texto" | "jev", string> = {
  formulario: "Lo marcó quien reportó",
  texto: "Palabra en el mensaje",
  jev: "Análisis automático",
}

const tipo = (t: string) => (t in TIPO ? TIPO[t as Tipo].toLowerCase() : t)

/** Un motivo de revisión u otra frase de la central, sin jerga técnica. `mensajes` son los
 *  textos de los reportes, para nombrar la palabra entera en vez de la raíz de la lista. */
export function enPalabras(texto: string, mensajes: string[] = []): string {
  return texto
    .replace(
      /posible negación de «([^»]+)»: la prioridad no baja, confirmar si aplica/g,
      (_, f: string) => `el mensaje podría estar diciendo que no hay «${palabraCompleta(f, mensajes)}»: la prioridad sigue alta hasta que lo confirmes`,
    )
    .replace(/Jev subió la prioridad de (P\d) a (P\d)/g, "el análisis automático subió la prioridad de $1 a $2: confirma que es así")
    .replace(/riesgo vital dudoso \([\d.,]+\)/g, "no está claro si hay riesgo para la vida")
    .replace(/el celular dice (\w+), Jev ve (\w+)/g, (_, a: string, b: string) => `quien reportó marcó «${tipo(a)}», pero el mensaje parece «${tipo(b)}»`)
    .replace(/\bJev\b/g, "el análisis automático")
    .replace(/^(\S)/, (c) => c.toUpperCase())
}

const DATO: Record<string, string> = {
  id: "código del reporte",
  prioridad: "prioridad",
  tipo: "tipo",
  personas: "número de personas",
  banderas: "marcas (atrapados, heridos, niños o mayores)",
  geohash: "zona",
  hora_unix: "hora",
}

/** Por qué la central no aceptó un mensaje, sin nombres de campos del protocolo. */
export function motivoRechazo(m: string): string {
  const cortado = m.match(/^truncado: (\d+) de (\d+) campos$/)
  if (cortado) return `Llegó cortado: trae ${cortado[1]} de los ${cortado[2]} datos.`
  const malo = m.match(/^(\w+) inválid[oa]s?: (.*)$/)
  if (malo) return `Dato no válido (${DATO[malo[1]] ?? malo[1]}): ${malo[2]}.`
  return m.replace(/^./, (c) => c.toUpperCase())
}
