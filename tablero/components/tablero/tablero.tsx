"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { elegirActiva, incidentes, rechazados, recursos, salud, type Nodo } from "@/lib/api/central"
import type { Incidente, Rechazado, Recurso, Salud } from "@/lib/api/tipos"
import { filtrar, porDecidir, type Filtro } from "@/lib/cola"
import { buscadorDeBarrio, cargarGeo, type Barrio, type Geo } from "@/lib/geo"
import { ESCRITORIO, useMedia } from "@/lib/use-media"
import { useNovedades } from "@/lib/use-novedades"
import { enZona, zonasConConteo, type Zona as ZonaFiltro } from "@/lib/zonas"
import { usePreferencia, useSondeo } from "@/lib/use-sondeo"
import { cn } from "@/lib/utils"

import { BarraEstado } from "./barra-estado"
import { Cola } from "./cola"
import { FranjaRecursos } from "./franja-recursos"
import { PanelIncidente } from "./panel-incidente"
import { Rechazados } from "./rechazados"
import { Recursos } from "./recursos"
import { TarjetaMapa } from "./tarjeta-mapa"

// MapLibre pesa ~1 MB y necesita el navegador: se carga aparte, sin prerender.
const Mapa = dynamic(() => import("./mapa").then((m) => m.Mapa), {
  ssr: false,
  loading: () => <div className="h-full bg-mapa-fondo" />,
})

const CADA_MS = 3000

async function leerSaludes(): Promise<Record<Nodo, Salud | null>> {
  const [A, B] = await Promise.all([salud("A"), salud("B")])
  return { A, B }
}

type Vista = "incidente" | "recursos" | "rechazados"
type Zona = "cola" | "mapa" | "panel" // en pantallas angostas se ve una a la vez

export function Tablero() {
  const [coordinador, setCoordinador] = usePreferencia("sard.coordinador", "")
  const [filtro, setFiltro] = useState<Filtro>("todos")
  const [zonaFiltro, setZonaFiltro] = useState<ZonaFiltro | null>(null)
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [vista, setVista] = useState<Vista>("incidente")
  const [zona, setZona] = useState<Zona>("cola")
  const [mapaCompleto, setMapaCompleto] = useState(false)
  const [tarjeta, setTarjeta] = useState(true)
  const [ahora, setAhora] = useState(() => Date.now() / 1000)
  const [geo, setGeo] = useState<Geo | null>(null)
  const escritorio = useMedia(ESCRITORIO)

  useEffect(() => {
    cargarGeo().then(setGeo, () => setGeo(null)) // sin archivos geo, el tablero sigue sin mapa
  }, [])

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now() / 1000), 30_000)
    return () => clearInterval(t)
  }, [])

  // Esc sale de la pantalla completa del mapa.
  useEffect(() => {
    if (!mapaCompleto) return
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setMapaCompleto(false)
    window.addEventListener("keydown", tecla)
    return () => window.removeEventListener("keydown", tecla)
  }, [mapaCompleto])

  const barrio = useMemo(() => (geo ? buscadorDeBarrio(geo.barrios) : (): Barrio | null => null), [geo])

  const saludes = useSondeo(leerSaludes, CADA_MS)
  const activa = saludes.datos ? elegirActiva(saludes.datos) : null
  // Sin central activa no se pregunta: queda a la vista lo último que se leyó (lo dice el aviso).
  const lista = useSondeo<Incidente[]>(() => (activa ? incidentes(activa) : Promise.resolve(undefined)), CADA_MS)
  const recs = useSondeo<Recurso[]>(() => (activa ? recursos(activa) : Promise.resolve(undefined)), CADA_MS)
  const rech = useSondeo<Rechazado[]>(() => (activa ? rechazados(activa) : Promise.resolve(undefined)), CADA_MS)

  // Al cambiar de central, leer enseguida en vez de esperar el siguiente ciclo.
  const { refrescar } = lista
  useEffect(() => {
    if (activa) refrescar()
  }, [activa, refrescar])

  const incs = lista.datos ?? []
  const novedades = useNovedades(lista.datos)
  // La zona elegida filtra la cola y sus conteos; el mapa muestra todo y apaga lo de afuera.
  const enLaZona = zonaFiltro ? incs.filter((i) => enZona(barrio(i.geohash), zonaFiltro)) : incs
  // Sin selección, el primero de lo que deja ver el filtro. Si el elegido desaparece de la cola, no
  // se reemplaza en silencio por otro: el panel lo dice y el coordinador elige de nuevo.
  const elegido = seleccion ? (incs.find((i) => i.id === seleccion) ?? null) : (filtrar(enLaZona, filtro)[0] ?? null)
  const perdido = seleccion !== null && elegido === null && lista.datos !== null
  const sinRecuperar = rech.datos?.filter((r) => !r.recuperado).length ?? 0

  function elegir(id: string) {
    novedades.visto(id)
    setSeleccion(id)
    setVista("incidente")
    setTarjeta(true)
    if (!escritorio && !mapaCompleto) setZona("panel")
  }

  /** Al primero de lo nuevo, en el orden de la central, sin filtros que lo escondan. */
  function verNuevos() {
    const primero = incs.find((i) => novedades.nuevos.includes(i.id))
    novedades.todosVistos()
    if (!primero) return
    setFiltro("todos")
    setZonaFiltro(null)
    elegir(primero.id)
    document.querySelector(`[data-id="${CSS.escape(primero.id)}"]`)?.scrollIntoView({ block: "nearest" })
  }

  function abrirDetalle() {
    setMapaCompleto(false)
    setVista("incidente")
    setZona("panel")
  }

  function abrirRecursos() {
    setMapaCompleto(false)
    setVista("recursos")
    setZona("panel")
  }

  const cola = (
    <Cola
      incidentes={enLaZona}
      cargando={lista.datos === null && !lista.error}
      filtro={filtro}
      onFiltro={setFiltro}
      seleccion={elegido?.id ?? null}
      onSeleccion={elegir}
      ahora={ahora}
      barrio={barrio}
      zona={zonaFiltro}
      onZona={setZonaFiltro}
      zonas={zonasConConteo(incs, barrio)}
      recientes={novedades.recientes}
      nuevos={novedades.nuevos}
      onVerNuevos={verNuevos}
    />
  )

  const mapa = geo ? (
    // El mapa muestra lo que deja ver el filtro de la cola en todas las zonas: la elegida se
    // encuadra y el resto se apaga, para no perder de vista lo que pasa al lado.
    <Mapa
      geo={geo}
      incidentes={filtrar(incs, filtro)}
      seleccion={elegido?.id ?? null}
      onSeleccion={elegir}
      barrio={barrio}
      zona={zonaFiltro}
      onZona={setZonaFiltro}
      completo={mapaCompleto}
      onCompleto={setMapaCompleto}
    />
  ) : (
    <div className="flex h-full items-center justify-center bg-mapa-fondo text-xs text-muted-foreground">Sin datos del mapa.</div>
  )

  const panel = (
    <Tabs value={vista} onValueChange={(v) => setVista(v as Vista)} className="h-full min-h-0 gap-0">
      <TabsList variant="line" className="h-9! w-full shrink-0 justify-start rounded-none border-b px-2">
        <TabsTrigger value="incidente" className="flex-none px-2">Incidente</TabsTrigger>
        <TabsTrigger value="recursos" className="flex-none px-2">Recursos</TabsTrigger>
        <TabsTrigger value="rechazados" className="flex-none px-2">
          Incompletos
          {sinRecuperar > 0 && (
            <span className="rounded-sm bg-revisar-surface px-1 font-mono text-[0.625rem] text-revisar" aria-label={`${sinRecuperar} pendientes`}>
              {sinRecuperar}
            </span>
          )}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="incidente" className="min-h-0">
        {elegido ? (
          <PanelIncidente
            inc={elegido}
            nodo={activa}
            coordinador={coordinador}
            ahora={ahora}
            geo={geo}
            barrio={barrio(elegido.geohash)}
            onDecidido={() => {
              refrescar()
              recs.refrescar()
            }}
          />
        ) : (
          <p className="p-4 text-xs text-muted-foreground">
            {perdido
              ? "El incidente que tenías abierto ya no está en la cola (pudo unirse con otro que habla de lo mismo). Elige uno de la cola."
              : lista.datos === null && !lista.error
                ? "Cargando…"
                : "Elige un incidente de la cola."}
          </p>
        )}
      </TabsContent>
      <TabsContent value="recursos" className="min-h-0">
        <Recursos
          recursos={recs.datos}
          incidentes={incs}
          nodo={activa}
          quien={coordinador}
          ahora={ahora}
          onCambio={() => {
            recs.refrescar()
            refrescar()
          }}
        />
      </TabsContent>
      <TabsContent value="rechazados" className="min-h-0">
        <Rechazados lista={rech.datos} ahora={ahora} />
      </TabsContent>
    </Tabs>
  )

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <BarraEstado
        saludes={saludes.datos}
        activa={activa}
        incidentes={incs}
        pendientes={porDecidir(incs)}
        coordinador={coordinador}
        onCoordinador={setCoordinador}
      />

      {saludes.datos && !activa && (
        <p role="alert" className="shrink-0 border-b border-p1/40 bg-p1-surface px-3 py-1.5 text-xs text-p1">
          No hay conexión con el sistema. Lo que ves es lo último que llegó y puede estar desactualizado.
        </p>
      )}
      {activa === "B" && (
        <p role="status" className="shrink-0 border-b border-p2/40 bg-p2-surface px-3 py-1.5 text-xs text-p2">
          El sistema principal no responde: estás trabajando con el de respaldo. Puedes seguir decidiendo.
        </p>
      )}

      {mapaCompleto ? (
        <main className="relative min-h-0 flex-1">
          {mapa}
          {elegido && tarjeta && (
            <TarjetaMapa
              inc={elegido}
              barrio={barrio(elegido.geohash)}
              ahora={ahora}
              onAbrir={abrirDetalle}
              onCerrar={() => setTarjeta(false)}
            />
          )}
        </main>
      ) : escritorio ? (
        // Tres superficies separadas por una canaleta: se distingue de un vistazo dónde termina
        // la cola, dónde está el mapa y dónde se decide. La canaleta es también la manija.
        <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1 bg-canal p-1.5">
          <ResizablePanel defaultSize="26" minSize="18" className="min-h-0">
            <div className="h-full overflow-hidden rounded-md border bg-card">{cola}</div>
          </ResizablePanel>
          <ResizableHandle className="w-1.5 bg-transparent" />
          <ResizablePanel defaultSize="40" minSize="20" className="min-h-0">
            <div className="h-full overflow-hidden rounded-md border">{mapa}</div>
          </ResizablePanel>
          <ResizableHandle className="w-1.5 bg-transparent" />
          <ResizablePanel defaultSize="34" minSize="24" className="min-h-0">
            <div className="h-full overflow-hidden rounded-md border bg-card">{panel}</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <>
          <nav className="flex h-9 shrink-0 border-b" aria-label="Zona">
            {(
              [
                ["cola", "Cola"],
                ["mapa", "Mapa"],
                ["panel", vista === "incidente" ? "Incidente" : vista === "recursos" ? "Recursos" : "Incompletos"],
              ] as const
            ).map(([z, etiqueta]) => (
              <button
                key={z}
                aria-current={zona === z}
                onClick={() => setZona(z)}
                className={cn(
                  "flex-1 text-xs text-muted-foreground",
                  zona === z && "border-b-2 border-foreground font-medium text-foreground",
                )}
              >
                {etiqueta}
              </button>
            ))}
          </nav>
          <main className="min-h-0 flex-1">{zona === "cola" ? cola : zona === "mapa" ? mapa : panel}</main>
        </>
      )}

      <FranjaRecursos recursos={recs.datos} onAbrir={abrirRecursos} />
    </div>
  )
}
