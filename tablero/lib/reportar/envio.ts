// La app web sube sus reportes como su propia pasarela: `POST /reportes` a la central A y, si no
// responde, a la B (`contracts/api-central.md`), igual que `Pasarela.kt` en Android.
import { CENTRALES, type Nodo } from "@/lib/api/central"
import { leerSack } from "./sard1"

export type Subida = {
  central: Nodo
  sack: string[]
  rechazados: { mensaje: string; motivo: string }[]
}

/**
 * La URL de una central vista desde este navegador. Las URLs del build apuntan a `localhost`, que
 * en un celular es el propio celular: ahí se usa el servidor que sirvió la página.
 */
export function urlCentral(
  nodo: Nodo,
  pagina: Location = window.location
): string {
  const url = new URL(CENTRALES[nodo])
  if (url.hostname === "localhost" && pagina.hostname !== "localhost")
    url.hostname = pagina.hostname
  return url.toString().replace(/\/$/, "")
}

async function subirA(
  nodo: Nodo,
  mensajes: string[],
  pasarelaId: string
): Promise<Subida> {
  const r = await fetch(`${urlCentral(nodo)}/reportes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mensajes, pasarela_id: pasarelaId }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!r.ok) throw new Error(`central ${nodo} respondió ${r.status}`)
  const json = (await r.json()) as {
    sack?: string[]
    rechazados?: { mensaje: string; motivo: string }[]
  }
  return {
    central: nodo,
    sack: (json.sack ?? [])
      .map(leerSack)
      .filter((id): id is string => id !== null),
    rechazados: json.rechazados ?? [],
  }
}

/** Sube a la A y, si falla, a la B. Lanza el error de la B si ninguna responde. */
export async function subir(
  mensajes: string[],
  pasarelaId: string
): Promise<Subida> {
  try {
    return await subirA("A", mensajes, pasarelaId)
  } catch {
    return await subirA("B", mensajes, pasarelaId)
  }
}
