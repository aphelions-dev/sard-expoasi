"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"

/** Llama a `leer` ya y cada `cadaMs`. `refrescar()` fuerza una lectura (p. ej. tras aprobar).
 *  Si `leer` devuelve `undefined` (no hay central a quién preguntar), se conserva lo último que se
 *  mostró. Solo se aplica la respuesta de la lectura más reciente: una lenta que llega tarde no pisa
 *  a la que se pidió después de decidir. */
export function useSondeo<T>(leer: () => Promise<T | undefined>, cadaMs: number) {
  const [datos, setDatos] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [ultima, setUltima] = useState<number | null>(null)
  const leerRef = useRef(leer)
  const turno = useRef(0)
  useLayoutEffect(() => {
    leerRef.current = leer
  })

  const refrescar = useCallback(async () => {
    const mio = ++turno.current
    try {
      const valor = await leerRef.current()
      if (mio !== turno.current || valor === undefined) return
      setDatos(valor)
      setError(null)
      setUltima(Date.now())
    } catch (e) {
      if (mio === turno.current) setError(e)
    }
  }, [])

  useEffect(() => {
    const primera = setTimeout(refrescar, 0)
    const t = setInterval(refrescar, cadaMs)
    return () => {
      clearTimeout(primera)
      clearInterval(t)
    }
  }, [refrescar, cadaMs])

  return { datos, error, ultima, refrescar }
}

// Preferencias del navegador. Si `localStorage` falla (navegación privada, almacenamiento
// bloqueado), quedan en memoria y la página sigue igual.
const enMemoria = new Map<string, string>()
const avisos = new Set<() => void>()

function leerPreferencia(clave: string): string | null {
  if (enMemoria.has(clave)) return enMemoria.get(clave)!
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}

function suscribir(avisar: () => void) {
  avisos.add(avisar)
  return () => avisos.delete(avisar)
}

/** Valor guardado en el navegador. En el prerender (export estático) vale `inicial`. */
export function usePreferencia(clave: string, inicial: string) {
  const valor = useSyncExternalStore(
    suscribir,
    () => leerPreferencia(clave) ?? inicial,
    () => inicial,
  )
  const guardar = useCallback(
    (v: string) => {
      try {
        localStorage.setItem(clave, v)
        enMemoria.delete(clave)
      } catch {
        enMemoria.set(clave, v)
      }
      avisos.forEach((avisar) => avisar())
    },
    [clave],
  )
  return [valor, guardar] as const
}
