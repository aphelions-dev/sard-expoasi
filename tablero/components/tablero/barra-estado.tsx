"use client"

import { useState } from "react"
import { ChevronDown, Moon, Sun, UserRound } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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

/** Un servicio del sistema: punto de color, nombre y, al pasar el cursor, qué significa. */
function Servicio({ nombre, estado, detalle, activa }: { nombre: string; estado: EstadoPunto; detalle: string; activa?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              "flex h-6 cursor-default items-center gap-1.5 rounded-sm px-2",
              activa && "bg-accent",
              estado === "caido" && "bg-p1-surface text-p1",
              estado === "aviso" && "bg-p2-surface text-p2",
            )}
          />
        }
      >
        <Punto estado={estado} />
        <span className="font-medium">{nombre}</span>
        {estado === "caido" && <span>caída</span>}
        {estado === "aviso" && <span>limitado</span>}
      </TooltipTrigger>
      <TooltipContent>{detalle}</TooltipContent>
    </Tooltip>
  )
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

      <div className="flex items-center gap-0.5 border-l pl-3 md:pl-5" role="status" aria-live="polite" aria-label="Estado del sistema">
        <Servicio
          nombre="Principal"
          estado={nodo("A")}
          activa={activa === "A"}
          detalle={
            nodo("A") === "caido"
              ? "El sistema principal no responde. Lo que decidas queda guardado en el de respaldo."
              : "Sistema principal en línea: aquí llegan los reportes y quedan tus decisiones."
          }
        />
        <Servicio
          nombre="Respaldo"
          estado={nodo("B")}
          activa={activa === "B"}
          detalle={
            nodo("B") === "caido"
              ? "La central B no responde."
              : activa === "B"
                ? "Estás trabajando con el sistema de respaldo porque el principal no responde. Puedes seguir decidiendo."
                : "Sistema de respaldo en línea, al día con el principal. Entra solo si el principal falla."
          }
        />
        <Servicio
          nombre="Análisis automático"
          estado={jev}
          detalle={
            jev === "aviso"
              ? "El análisis automático no responde: los reportes se clasifican solo con las palabras de alerta. Revisa con más cuidado."
              : jev === "ok"
                ? "Lee cada mensaje para encontrar señales de peligro. Puede subir una prioridad, nunca bajarla."
                : "Sin dato todavía."
          }
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
