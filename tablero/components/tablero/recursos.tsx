"use client"

import { useState } from "react"
import { LoaderCircle, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { mensajeRecurso, registrarUnidad, reportarEstado, type Nodo } from "@/lib/api/central"
import type { EstadoUnidad, Incidente, Recurso, Unidad } from "@/lib/api/tipos"
import { TIPO, haceCuanto } from "@/lib/formato"
import { ESTADO_UNIDAD, candidatos, filas, type FilaRecurso } from "@/lib/recursos"
import { cn } from "@/lib/utils"

interface Props {
  recursos: Recurso[] | null
  incidentes: Incidente[]
  nodo: Nodo | null
  quien: string
  ahora: number
  onCambio: () => void
}

interface Comun {
  nodo: Nodo | null
  quien: string
  ahora: number
  onCambio: () => void
}

const SELECT =
  "h-7 w-full min-w-0 rounded-md border border-input bg-input/20 px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/30"

/** Unidad por unidad, como en el SCI-211. Cada entidad registra las suyas y reporta sus cambios;
 *  aprobar un incidente solo solicita el recurso. */
export function Recursos({ recursos, incidentes, nodo, quien, ahora, onCambio }: Props) {
  return (
    <section className="flex h-full min-h-0 flex-col" aria-labelledby="t-recursos">
      <header className="space-y-1 px-3 pt-3 pb-2.5">
        <h2 id="t-recursos" className="text-base font-semibold">Recursos</h2>
        <p className="text-xs text-muted-foreground">
          Cada entidad registra sus unidades y reporta cuándo quedan asignadas, libres o fuera de servicio. Aprobar un incidente solicita el
          recurso; la unidad la asigna la entidad.
        </p>
        {!quien.trim() && <p className="text-xs text-muted-foreground">Identifícate arriba a la derecha para registrar o reportar.</p>}
      </header>
      {recursos === null ? (
        <p className="border-t p-3 text-xs text-muted-foreground">Cargando…</p>
      ) : (
        <ScrollArea className="min-h-0 flex-1 border-t">
          <ul className="divide-y">
            {filas(recursos).map((f) => (
              <Fila key={`${f.entidad}|${f.recurso}`} f={f} incidentes={incidentes} nodo={nodo} quien={quien} ahora={ahora} onCambio={onCambio} />
            ))}
          </ul>
        </ScrollArea>
      )}
    </section>
  )
}

/** Envía a la central y deja el error o la confirmación a la vista. */
function useEnvio(onCambio: () => void) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function enviar(f: () => Promise<unknown>): Promise<boolean> {
    setEnviando(true)
    setError(null)
    try {
      await f()
      onCambio()
      return true
    } catch (e) {
      setError(mensajeRecurso(e))
      return false
    } finally {
      setEnviando(false)
    }
  }
  return { enviando, error, enviar }
}

function Fila({ f, incidentes, ...comun }: Comun & { f: FilaRecurso; incidentes: Incidente[] }) {
  const r = f.registro
  const abiertas = r?.solicitudes_abiertas ?? []
  return (
    <li className="space-y-2 px-3 py-2.5 text-xs">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium first-letter:uppercase">{f.recurso}</h3>
          <p className="text-muted-foreground">
            {f.entidad}
            {f.tipos.length > 0 && ` · ${f.tipos.map((t) => TIPO[t]).join(", ")}`}
          </p>
        </div>
        {r && (
          <p className="shrink-0 text-right">
            <strong className={cn("font-mono text-lg", r.disponibles === 0 && "text-p1")}>{r.disponibles}</strong>
            <span className="text-muted-foreground"> / {r.unidades.length} disponible{r.disponibles === 1 ? "" : "s"}</span>
          </p>
        )}
      </div>

      {r ? (
        <p className="text-muted-foreground">
          {r.asignadas} asignada{r.asignadas === 1 ? "" : "s"} · {r.no_disponibles} no disponible{r.no_disponibles === 1 ? "" : "s"}
        </p>
      ) : (
        <p className="text-p2">Sin unidades registradas: el sistema sugiere sin saber si hay.</p>
      )}
      {abiertas.length > 0 && (
        <p className={cn("flex items-start gap-1", f.faltan > 0 ? "text-p1" : "text-muted-foreground")} title={abiertas.join(", ")}>
          {f.faltan > 0 && <TriangleAlert className="mt-px size-3 shrink-0" aria-hidden="true" />}
          <span>
            {abiertas.length} solicitud{abiertas.length === 1 ? "" : "es"} sin unidad asignada
            {f.faltan > 0 && ` · faltan ${f.faltan}`}
          </span>
        </p>
      )}

      {r && r.unidades.length > 0 && (
        <ul className="space-y-1.5 border-l pl-2.5">
          {r.unidades.map((u) => (
            <UnidadFila key={u.matricula} u={u} opciones={candidatos(f, incidentes)} {...comun} />
          ))}
        </ul>
      )}

      <Registrar f={f} {...comun} />
    </li>
  )
}

const SIGUIENTE: Record<EstadoUnidad, EstadoUnidad> = { disponible: "asignada", asignada: "disponible", no_disponible: "disponible" }

function UnidadFila({ u, opciones, nodo, quien, ahora, onCambio }: Comun & { u: Unidad; opciones: Incidente[] }) {
  const [abierto, setAbierto] = useState(false)
  const [estado, setEstado] = useState<EstadoUnidad>(SIGUIENTE[u.estado])
  const [incidente, setIncidente] = useState("")
  const [nota, setNota] = useState("")
  const { enviando, error, enviar } = useEnvio(onCambio)
  const elegido = incidente || opciones[0]?.id || ""
  const listo = !!nodo && !!quien.trim() && (estado !== "asignada" || !!elegido)

  async function reportar() {
    if (!nodo || !listo) return
    const ok = await enviar(() =>
      reportarEstado(nodo, u.matricula, {
        estado,
        incidente_id: estado === "asignada" ? elegido : null,
        reportado_por: quien.trim(),
        nota: nota.trim(),
      }),
    )
    if (ok) {
      setAbierto(false)
      setNota("")
      setIncidente("")
      setEstado(SIGUIENTE[estado])
    }
  }

  const id = `u-${u.matricula}`.replace(/\s+/g, "-")
  return (
    <li className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <p>
          <span className="font-mono font-medium">{u.matricula}</span>{" "}
          <span className={cn(u.estado === "disponible" ? "text-ok" : u.estado === "no_disponible" ? "text-muted-foreground" : "")}>
            {ESTADO_UNIDAD[u.estado]}
            {u.incidente_id && <span className="font-mono"> · {u.incidente_id}</span>}
          </span>
        </p>
        <Button variant="ghost" size="xs" aria-expanded={abierto} aria-controls={id} onClick={() => setAbierto(!abierto)}>
          {abierto ? "Cancelar" : "Reportar cambio"}
        </Button>
      </div>
      <p className="text-muted-foreground">
        {u.reportado_por} {haceCuanto(u.reportado_en, ahora)}
        {u.nota && ` · «${u.nota}»`}
      </p>

      {abierto && (
        <div id={id} className="grid gap-1.5 rounded-sm bg-muted/40 p-2">
          <label className="grid gap-1">
            <span className="text-muted-foreground">Estado</span>
            <select className={SELECT} value={estado} onChange={(e) => setEstado(e.target.value as EstadoUnidad)}>
              {(Object.keys(ESTADO_UNIDAD) as EstadoUnidad[]).map((e) => (
                <option key={e} value={e}>
                  {ESTADO_UNIDAD[e]}
                </option>
              ))}
            </select>
          </label>
          {estado === "asignada" &&
            (opciones.length > 0 ? (
              <label className="grid gap-1">
                <span className="text-muted-foreground">Incidente</span>
                <select className={cn(SELECT, "font-mono")} value={elegido} onChange={(e) => setIncidente(e.target.value)}>
                  {opciones.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.id} · {i.prioridad} · {i.estado === "aprobada" ? "solicitado" : "sin aprobar"}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="text-p2">Ningún incidente abierto pide este recurso.</p>
            ))}
          <label className="grid gap-1">
            <span className="text-muted-foreground">Nota (opcional)</span>
            <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder={estado === "no_disponible" ? "p. ej. sin tripulación" : ""} />
          </label>
          <Button size="sm" disabled={!listo || enviando} onClick={reportar}>
            {enviando && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            Reportar
          </Button>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </li>
  )
}

function Registrar({ f, nodo, quien, onCambio }: Comun & { f: FilaRecurso }) {
  const [matricula, setMatricula] = useState("")
  const [hecho, setHecho] = useState<string | null>(null)
  const { enviando, error, enviar } = useEnvio(onCambio)
  const listo = !!nodo && !!quien.trim() && !!matricula.trim()

  async function registrar() {
    if (!nodo || !listo) return
    const m = matricula.trim()
    setHecho(null)
    if (await enviar(() => registrarUnidad(nodo, { entidad: f.entidad, recurso: f.recurso, matricula: m, reportado_por: quien.trim() }))) {
      setHecho(m)
      setMatricula("")
    }
  }

  const id = `reg-${f.entidad}-${f.recurso}`.replace(/\s+/g, "-")
  return (
    <div className="space-y-1">
      <div className="flex items-end gap-2">
        <label htmlFor={id} className="grid flex-1 gap-1">
          <span className="text-muted-foreground">Registrar unidad (matrícula)</span>
          <Input
            id={id}
            value={matricula}
            onChange={(e) => {
              setMatricula(e.target.value)
              setHecho(null)
            }}
            onKeyDown={(e) => e.key === "Enter" && registrar()}
            className="font-mono"
          />
        </label>
        <Button disabled={!listo || enviando} onClick={registrar}>
          {enviando && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          Registrar
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {hecho && (
        <p role="status" className="text-ok">
          {hecho} registrada como disponible.
        </p>
      )}
    </div>
  )
}
