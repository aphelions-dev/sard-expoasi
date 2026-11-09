// Genera los tokens de cada interfaz desde diseno/tokens.json, la única fuente del estilo de SARD:
//   tablero/app/tokens.css   (tema claro en :root y oscuro en .dark)
//   simulador/visor/tokens.css   (solo el oscuro, el de la sala)
//   app/bitchat-android/.../sard/SardColores.kt   (colores de estado para Compose)
//
// Uso: `node diseno/generar.mjs` reescribe los tres; `node diseno/generar.mjs --revisar` solo
// comprueba que estén al día y sale con 1 si alguno quedó viejo.
import { existsSync, readFileSync, writeFileSync } from "node:fs"

const raiz = new URL("../", import.meta.url)
const tokens = JSON.parse(readFileSync(new URL("diseno/tokens.json", raiz), "utf8"))
const AVISO = "Generado por diseno/generar.mjs desde diseno/tokens.json. No editar a mano."

const bloque = (selector, valores, extra = []) =>
  [`${selector} {`, ...extra, ...Object.entries(valores).map(([k, v]) => `    --${k}: ${v};`), "}"].join("\n")

const cssTablero = [
  `/* ${AVISO} */`,
  "",
  bloque(":root", tokens.claro, [`    --radius: ${tokens.radio};`]),
  "",
  bloque(".dark", tokens.oscuro),
  "",
].join("\n")

const cssVisor = [
  `/* ${AVISO} */`,
  "",
  bloque(":root", tokens.oscuro, [
    "    color-scheme: dark;",
    `    --radius: ${tokens.radio};`,
    `    --font-sans: "${tokens.fuentes.sans}", system-ui, sans-serif;`,
    `    --font-mono: "${tokens.fuentes.mono}", ui-monospace, monospace;`,
  ]),
  "",
].join("\n")

// oklch(L C h [/ alfa]) a sRGB, con la matriz de OKLab de Björn Ottosson.
function oklchArgb(valor) {
  const m = valor.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)(%?))?\s*\)$/)
  if (!m) throw new Error(`Color que no es oklch: ${valor}`)
  const [L, C, h] = [Number(m[1]), Number(m[2]), (Number(m[3]) * Math.PI) / 180]
  const alfa = m[4] === undefined ? 1 : Number(m[4]) / (m[5] ? 100 : 1)
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lineal = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ]
  const byte = (x) => Math.round(Math.min(1, Math.max(0, x)) * 255)
  const gamma = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)
  return [byte(alfa), ...lineal.map((x) => byte(gamma(x)))]
    .map((n) => n.toString(16).padStart(2, "0").toUpperCase())
    .join("")
}

// Android usa los colores de estado y los neutros básicos; los del mapa y el sidebar son del tablero.
const ANDROID = [
  "background", "foreground", "card", "primary", "primary-foreground", "muted", "muted-foreground",
  "border", "destructive",
  "p1", "p1-surface", "p2", "p2-surface", "p3", "p3-surface", "p4", "p4-surface",
  "revisar", "revisar-surface", "ok", "ok-surface", "vencido", "vencido-surface",
]
const nombreKt = (k) => k.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
const paletaKt = (nombre, valores) => [
  `    val ${nombre} = Paleta(`,
  ...ANDROID.map((k) => `        ${nombreKt(k)} = Color(0x${oklchArgb(valores[k])}),`),
  "    )",
]
const kotlin = [
  `// ${AVISO}`,
  "package com.bitchat.android.sard",
  "",
  "import androidx.compose.ui.graphics.Color",
  "",
  "/** Colores de SARD, los mismos del tablero. El color se reserva para el estado. */",
  "object SardColores {",
  "    class Paleta(",
  ...ANDROID.map((k) => `        val ${nombreKt(k)}: Color,`),
  "    )",
  "",
  ...paletaKt("Claro", tokens.claro),
  "",
  ...paletaKt("Oscuro", tokens.oscuro),
  "}",
  "",
].join("\n")

const salidas = [
  ["tablero/app/tokens.css", cssTablero],
  ["simulador/visor/tokens.css", cssVisor],
  ["app/bitchat-android/app/src/main/java/com/bitchat/android/sard/SardColores.kt", kotlin],
]

const revisar = process.argv.includes("--revisar")
let viejos = 0
for (const [ruta, contenido] of salidas) {
  const archivo = new URL(ruta, raiz)
  if (ruta.startsWith("app/") && !existsSync(new URL("app/bitchat-android/app", raiz))) {
    console.log(`omitido ${ruta}: falta el submódulo (git submodule update --init)`)
    continue
  }
  // Con core.autocrlf, Git en Windows deja CRLF en la copia de trabajo: se compara sin él.
  const actual = existsSync(archivo) ? readFileSync(archivo, "utf8").replace(/\r\n/g, "\n") : ""
  if (actual === contenido) continue
  if (revisar) {
    console.error(`desactualizado: ${ruta}`)
    viejos++
  } else {
    writeFileSync(archivo, contenido)
    console.log(`escrito ${ruta}`)
  }
}
if (viejos) {
  console.error("Corre `node diseno/generar.mjs` y sube los archivos generados.")
  process.exit(1)
}
