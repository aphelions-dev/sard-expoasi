// Colores de los tokens para MapLibre. La paleta está en oklch() y MapLibre no la entiende
// ("color expected, lab(...) found"): pintar un píxel y leerlo de vuelta hace que el navegador
// la convierta a rgba(). Tomado de barrio-layer.tsx de lufigir/manizalesdepie.

function aRgba(color: string): string | null {
  const lienzo = document.createElement("canvas")
  lienzo.width = 1
  lienzo.height = 1
  const ctx = lienzo.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`
}

/** Valor de un token de globals.css (`--p1`, `--mapa-fondo`…) como rgba(). */
export function token(nombre: string): string {
  const crudo = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim()
  return (crudo && aRgba(crudo)) || "rgba(128, 128, 128, 1)"
}
