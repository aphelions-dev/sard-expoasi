import type { NextConfig } from "next"

// Export estático: la app solo habla con la API de las centrales. `out/` lo sirve nginx en la raíz
// del dominio, que es también el alcance del service worker.
const nextConfig: NextConfig = {
  output: "export",
}

export default nextConfig
