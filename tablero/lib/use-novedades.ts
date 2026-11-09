"use client"

// Qué cambió desde la lectura anterior de la cola, para avisarlo sin que el coordinador tenga que
// comparar listas: lo recién llegado o que cambió de prioridad destella unos segundos, y lo nuevo
// se cuenta hasta que lo mira. La primera lectura no cuenta como novedad.
import { useCallback, useEffect, useRef, useState } from "react"

import type { Incidente, Prioridad } from "./api/tipos"
import { cambios } from "./zonas"

const DESTELLO_MS = 6000

export function useNovedades(incidentes: Incidente[] | null) {
  const previo = useRef<Map<string, Prioridad> | null>(null)
  const [recientes, setRecientes] = useState<Map<string, number>>(() => new Map())
  const [nuevos, setNuevos] = useState<string[]>([])

  useEffect(() => {
    if (!incidentes) return
    const antes = previo.current
    previo.current = new Map(incidentes.map((i) => [i.id, i.prioridad]))
    if (!antes) return
    const ids = cambios(antes, incidentes)
    if (ids.length === 0) return
    const hasta = Date.now() + DESTELLO_MS
    setRecientes((r) => new Map([...r, ...ids.map((id) => [id, hasta] as const)]))
    setNuevos((n) => [...n, ...ids.filter((id) => !antes.has(id) && !n.includes(id))])
  }, [incidentes])

  useEffect(() => {
    if (recientes.size === 0) return
    const t = setTimeout(() => {
      const ya = Date.now()
      setRecientes((r) => new Map([...r].filter(([, hasta]) => hasta > ya)))
    }, 1000)
    return () => clearTimeout(t)
  }, [recientes])

  const visto = useCallback((id: string) => setNuevos((n) => n.filter((x) => x !== id)), [])
  const todosVistos = useCallback(() => setNuevos([]), [])

  // Un nuevo que ya no está en la cola (se unió a otro incidente) deja de contarse.
  const presentes = new Set(incidentes?.map((i) => i.id))
  return {
    recientes: new Set(recientes.keys()),
    nuevos: nuevos.filter((id) => presentes.has(id)),
    visto,
    todosVistos,
  }
}
