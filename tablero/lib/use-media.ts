import { useSyncExternalStore } from "react"

export const ESCRITORIO = "(min-width: 1100px)"

/** Si la consulta de medios se cumple; `false` en el servidor (export estático). */
export function useMedia(consulta: string): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const m = matchMedia(consulta)
      m.addEventListener("change", avisar)
      return () => m.removeEventListener("change", avisar)
    },
    () => matchMedia(consulta).matches,
    () => false,
  )
}
