import type { NextConfig } from "next"

// Export estático: el tablero es una página que solo habla con la API de las centrales, así que no
// necesita servidor propio. `out/` se sirve con cualquier servidor estático, en la raíz del dominio
// (las rutas a /_next y /geo son absolutas).
const nextConfig: NextConfig = {
  output: "export",
}

export default nextConfig
