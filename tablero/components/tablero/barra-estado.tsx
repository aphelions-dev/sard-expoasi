"use client"

import { useState } from "react"
import { ChevronDown, Moon, Sun, UserRound } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Nodo } from "@/lib/api/central"
import type { Incidente, Salud } from "@/lib/api/tipos"
import { cn } from "@/lib/utils"

import { Punto } from "./insignias"

interface Props {
  saludes: Record<Nodo, Salud | null> | null
  activa: Nodo | null
  incidentes: Incidente[]
  pendientes: number
  coordinador: string
  onCoordinador: (v: string) => void
}

type EstadoPunto = "ok" | "caido" | "aviso" | "espera"

interface Parte {
  nombre: string
  estado: EstadoPunto
  detalle: string
}

/** El sistema en una sola frase: quien coordina solo necesita saber si puede confiar en lo que ve.
 *  El detalle de cada parte se abre con un clic. */
function Sistema({ partes, resumen, estado }: { partes: Parte[]; resumen: string; estado: EstadoPunto }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-sm px-2 font-medium hover:bg-accent",
              estado === "caido" && "bg-p1-surface text-p1 hover:bg-p1-surface",
              estado === "aviso" && "bg-p2-surface text-p2 hover:bg-p2-surface",
            )}
          />
        }
      >
        <Punto estado={estado} />
        {resumen}
        <ChevronDown aria-hidden="true" className="size-3.5 opacity-60" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-2.5">
        <p className="text-sm font-medium">Estado del sistema</p>
        <ul className="space-y-2">
          {partes.map((p) => (
            <li key={p.nombre} className="flex gap-2">
              <span className="pt-1">
                <Punto estado={p.estado} />
              </span>
              <span>
                <span className="font-medium">{p.nombre}</span>
                <span className="block text-muted-foreground">{p.detalle}</span>
              </span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

/** La frase del indicador: lo más grave manda. */
function resumirSistema(a: EstadoPunto, b: EstadoPunto, analisis: EstadoPunto): { resumen: string; estado: EstadoPunto } {
  if (a === "espera" && b === "espera") return { resumen: "Conectando…", estado: "espera" }
  if (a === "caido" && b === "caido") return { resumen: "Sin conexión", estado: "caido" }
  if (a === "caido") return { resumen: "Funcionando con respaldo", estado: "aviso" }
  if (analisis === "aviso") return { resumen: "Clasificación básica", estado: "aviso" }
  if (b === "caido") return { resumen: "Sin respaldo", estado: "aviso" }
  return { resumen: "Todo en línea", estado: "ok" }
}

/** Un número de la cola con su etiqueta; se colorea solo si pide atención. */
function Cifra({ n, etiqueta, tono }: { n: number; etiqueta: string; tono?: string }) {
  return (
    <span className="flex items-baseline gap-1">
      <strong className={cn("font-mono text-sm font-semibold", n > 0 && tono)}>{n}</strong>
      <span className="text-muted-foreground">{etiqueta}</span>
    </span>
  )
}

/** Quién decide. El contrato pide el nombre del coordinador en cada aprobación o rechazo, y queda
 *  en el registro de eventos (que no se borra): por eso sin nombre no se puede decidir. */
function Identidad({ coordinador, onCoordinador }: { coordinador: string; onCoordinador: (v: string) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [borrador, setBorrador] = useState(coordinador)
  const nombre = coordinador.trim()

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    onCoordinador(borrador.trim())
    setAbierto(false)
  }

  return (
    <Popover
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v)
        if (v) setBorrador(coordinador)
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant={nombre ? "ghost" : "outline"}
            className={cn("h-7 gap-1.5", !nombre && "border-revisar/50 bg-revisar-surface text-revisar hover:bg-revisar-surface hover:text-revisar")}
          />
        }
      >
        <UserRound aria-hidden="true" />
        {nombre ? (
          <span className="max-w-40 truncate">
            <span className="hidden text-muted-foreground lg:inline">Decide: </span>
            {nombre}
          </span>
        ) : (
          <span>Identifícate para decidir</span>
        )}
        <ChevronDown aria-hidden="true" className="opacity-60" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-3">
        <form onSubmit={guardar} className="space-y-2.5">
          <div className="space-y-1">
            <label htmlFor="coordinador" className="text-sm font-medium">
              ¿Quién está decidiendo?
            </label>
            <p className="text-muted-foreground">
              Tu nombre queda registrado en cada aprobación o rechazo, para saber siempre quién decidió qué. Sin nombre los botones de
              decisión no se activan. Se guarda solo en este navegador.
            </p>
          </div>
          <Input
            id="coordinador"
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            placeholder="Nombre y cargo, p. ej. Ana Gómez · CMGRD"
            maxLength={60}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!borrador.trim()}>
              Guardar
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}

/** Franja superior en tres bloques: el sistema (¿puedo confiar en lo que veo?), la cola (¿cuánto
 *  hay por hacer?) y quién decide. */
export function BarraEstado({ saludes, activa, incidentes, pendientes, coordinador, onCoordinador }: Props) {
  const { resolvedTheme, setTheme } = useTheme()
  const salud = activa && saludes ? saludes[activa] : null
  const jev: EstadoPunto = !salud ? "espera" : salud.jev === "ok" ? "ok" : "aviso"
  const nodo = (n: Nodo): EstadoPunto => (!saludes ? "espera" : saludes[n] ? "ok" : "caido")
  const abierto = (i: Incidente) => i.estado === "pendiente" || i.estado === "sin_propuesta"
  const p1 = incidentes.filter((i) => i.prioridad === "P1" && abierto(i)).length
  const revisar = incidentes.filter((i) => i.incertidumbre.revisar && abierto(i)).length

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-card px-3 text-xs md:gap-5">
      <div className="flex shrink-0 items-center gap-2">
        <span className="grid size-7 place-items-center rounded-sm bg-foreground font-mono text-[0.6875rem] font-bold text-background">
          SA
        </span>
        <div className="hidden leading-tight sm:block">
          <p className="text-sm font-semibold">SARD</p>
          <p className="text-[0.6875rem] text-muted-foreground">Coordinación de emergencias</p>
        </div>
      </div>

      <div className="flex items-center border-l pl-3 md:pl-5" role="status" aria-live="polite" aria-label="Estado del sistema">
        <Sistema
          {...resumirSistema(nodo("A"), nodo("B"), jev)}
          partes={[
            {
              nombre: "Sistema principal",
              estado: nodo("A"),
              detalle:
                nodo("A") === "caido"
                  ? "No responde. Lo que decidas queda guardado en el de respaldo."
                  : "En línea: aquí llegan los reportes y quedan tus decisiones.",
            },
            {
              nombre: "Sistema de respaldo",
              estado: nodo("B"),
              detalle:
                nodo("B") === "caido"
                  ? "No responde. Si el principal también falla, el tablero se queda con lo último que leyó."
                  : activa === "B"
                    ? "Estás trabajando con el respaldo porque el principal no responde. Puedes seguir decidiendo."
                    : "En línea y al día con el principal. Entra solo si el principal falla.",
            },
            {
              nombre: "Análisis automático",
              estado: jev,
              detalle:
                jev === "aviso"
                  ? "No responde: los reportes se clasifican solo con las palabras de alerta. Revisa con más cuidado."
                  : jev === "ok"
                    ? "Lee cada mensaje para encontrar señales de peligro. Puede subir una prioridad, nunca bajarla."
                    : "Sin dato todavía.",
            },
          ]}
        />
      </div>

      <div className="hidden items-center gap-4 border-l pl-5 lg:flex" aria-label="Pendientes">
        <Cifra n={pendientes} etiqueta="por decidir" />
        <Cifra n={p1} etiqueta="P1" tono="text-p1" />
        <Cifra n={revisar} etiqueta="para revisar" tono="text-revisar" />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Identidad coordinador={coordinador} onCoordinador={onCoordinador} />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          aria-label="Cambiar entre tema claro y oscuro"
          title="Tema claro para el proyector, oscuro para la sala"
        >
          {/* Por CSS y no por estado: el prerender no sabe qué tema tiene el navegador. */}
          <Sun className="hidden dark:block" />
          <Moon className="dark:hidden" />
        </Button>
      </div>
    </header>
  )
}
