"use client"

// Qué cambió desde la lectura anterior de la cola, para avisarlo sin que el coordinador tenga que
// comparar listas: lo recién llegado o que cambió de prioridad destella unos segundos, lo nuevo
// queda marcado hasta que lo abre y lo que llega o sube a P1 se avisa arriba hasta que lo abre o lo
// descarta. Cada llegada es además un evento (`llegada`) para el sonido y la pestaña. La primera
// lectura no cuenta como novedad.
import { useCallback, useEffect, useRef, useState } from "react"

import type { Incidente, Prioridad } from "./api/tipos"
import { cambios } from "./zonas"

const DESTELLO_MS = 6000

/** Lo que trajo una lectura: cuántos nuevos y si alguno es (o subió a) P1. `n` cambia con cada una. */
export type Llegada = { n: number; nuevos: number; p1: boolean }

/** Los que llegaron como P1 o subieron a P1 respecto de la lectura anterior. */
export function aP1(
  antes: Map<string, Prioridad>,
  ahora: Incidente[]
): string[] {
  return ahora
    .filter((i) => i.prioridad === "P1" && antes.get(i.id) !== "P1")
    .map((i) => i.id)
}

export function useNovedades(incidentes: Incidente[] | null) {
  const previo = useRef<Map<string, Prioridad> | null>(null)
  const [recientes, setRecientes] = useState<Map<string, number>>(
    () => new Map()
  )
  const [nuevos, setNuevos] = useState<string[]>([])
  const [alertas, setAlertas] = useState<string[]>([])
  const [llegada, setLlegada] = useState<Llegada | null>(null)

  useEffect(() => {
    if (!incidentes) return
    const antes = previo.current
    previo.current = new Map(incidentes.map((i) => [i.id, i.prioridad]))
    if (!antes) return
    const ids = cambios(antes, incidentes)
    if (ids.length === 0) return
    const hasta = Date.now() + DESTELLO_MS
    const recien = ids.filter((id) => !antes.has(id))
    const p1 = aP1(antes, incidentes)
    setRecientes(
      (r) => new Map([...r, ...ids.map((id) => [id, hasta] as const)])
    )
    setNuevos((n) => [...n, ...recien.filter((id) => !n.includes(id))])
    setAlertas((a) => [...a, ...p1.filter((id) => !a.includes(id))])
    if (recien.length || p1.length)
      setLlegada((l) => ({
        n: (l?.n ?? 0) + 1,
        nuevos: recien.length,
        p1: p1.length > 0,
      }))
  }, [incidentes])

  useEffect(() => {
    if (recientes.size === 0) return
    const t = setTimeout(() => {
      const ya = Date.now()
      setRecientes((r) => new Map([...r].filter(([, hasta]) => hasta > ya)))
    }, 1000)
    return () => clearTimeout(t)
  }, [recientes])

  const visto = useCallback((id: string) => {
    setNuevos((n) => n.filter((x) => x !== id))
    setAlertas((a) => a.filter((x) => x !== id))
  }, [])
  const todosVistos = useCallback(() => setNuevos([]), [])
  const descartarAlertas = useCallback(() => setAlertas([]), [])

  // Un nuevo que ya no está en la cola (se unió a otro incidente) deja de contarse.
  const presentes = new Set(incidentes?.map((i) => i.id))
  return {
    recientes: new Set(recientes.keys()),
    nuevos: nuevos.filter((id) => presentes.has(id)),
    alertas: alertas.filter((id) => presentes.has(id)),
    llegada,
    visto,
    todosVistos,
    descartarAlertas,
  }
}
