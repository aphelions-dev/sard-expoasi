"use client"

import {
  ChevronRight,
  CircleHelp,
  Clock,
  MapPin,
  MessageCircleQuestion,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react"

import { ScrollArea } from "@/components/ui/scroll-area"
import type { Nodo } from "@/lib/api/central"
import type { Corroboracion, Evidencia, Incidente } from "@/lib/api/tipos"
import {
  CORROBORACION,
  fuenteLegible,
  TIPO,
  coordenadas,
  precision,
  haceCuanto,
  horaLocal,
  lugarLegible,
} from "@/lib/formato"
import { cercanos, type Barrio, type Geo } from "@/lib/geo"
import { cn } from "@/lib/utils"

import { ORIGEN_LEGIBLE, citaLegible, enPalabras, senalLegible } from "@/lib/lenguaje"

import { BarraDecision, Propuesta } from "./decision"
import { ICONO_TIPO } from "./iconos"
import { EstadoInsignia, Prioridad } from "./insignias"

interface Props {
  inc: Incidente
  nodo: Nodo | null
  coordinador: string
  ahora: number
  geo: Geo | null
  barrio: Barrio | null
  onDecidido: () => void
}

/** Una sección del panel como tarjeta propia, numerada en el orden en que conviene leerla. */
function Tarjeta({
  n,
  titulo,
  extra,
  children,
}: {
  n?: number
  titulo: string
  extra?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-md border bg-card">
      <h3 className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5 text-xs font-semibold">
        {n !== undefined && (
          <span
            aria-hidden="true"
            className="grid size-4 place-items-center rounded-full bg-foreground font-mono text-[0.625rem] text-background"
          >
            {n}
          </span>
        )}
        {titulo}
        {extra && (
          <span className="ml-auto text-[0.6875rem] font-normal text-muted-foreground">
            {extra}
          </span>
        )}
      </h3>
      <div className="p-3 text-xs">{children}</div>
    </section>
  )
}

/** Bloque plegable: lo que sirve para decidir va a la vista; lo técnico, a un clic. */
function Plegable({
  titulo,
  extra,
  children,
}: {
  titulo: string
  extra?: string
  children: React.ReactNode
}) {
  return (
    <details className="group overflow-hidden rounded-md border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden="true"
          className="size-3.5 transition-transform group-open:rotate-90"
        />
        <span className="font-medium">{titulo}</span>
        {extra && <span className="text-[0.6875rem]">{extra}</span>}
      </summary>
      <div className="border-t px-3 py-3">{children}</div>
    </details>
  )
}

/** Un incidente en orden de lectura: qué es y por qué está ahí; dónde, a cuántos y desde cuándo;
 *  lo que hay que saber antes de decidir; lo que dijo la gente; la propuesta. Los botones quedan
 *  fijos abajo y el detalle técnico, plegado. */
export function PanelIncidente({
  inc,
  nodo,
  coordinador,
  ahora,
  geo,
  barrio,
  onDecidido,
}: Props) {
  const u = inc.incertidumbre
  const Icono = ICONO_TIPO[inc.tipo]
  const lugar = (texto: string) =>
    lugarLegible(texto, inc.geohash, barrio?.nombre ?? null)

  // Los ids de reporte (s52363n07-2) no le dicen nada al coordinador: se cambian por "reporte 1",
  // "reporte 2"…, que es como están numerados abajo, en "Lo que dijo la gente".
  const numero = new globalThis.Map(
    inc.evidencia.map((ev, i) => [ev.reporte_id, `reporte ${i + 1}`])
  )
  // El id más largo primero, y sin tocar un id más largo que lo contenga (a3f9-1 dentro de a3f9-12).
  const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const legible = (texto: string) =>
    [...numero]
      .sort(([a], [b]) => b.length - a.length)
      .reduce(
        (t, [id, etiqueta]) =>
          t.replace(new RegExp(`(?<![\\w-])${escapar(id)}(?![\\w-])`, "g"), etiqueta),
        texto
      )
      .replace(/^reporte/, "Reporte")

  // Todo lo que pide cautela, junto y en lenguaje llano.
  const atencion = [
    ...u.motivos.map((m) => enPalabras(legible(m), inc.evidencia.map((e) => e.texto))),
    ...(u.sin_analisis_ia
      ? ["Sin análisis automático: se clasificó solo con las palabras de alerta."]
      : []),
    ...(u.sin_ubicacion ? ["Sin ubicación: el reporte no trajo GPS."] : []),
    ...(u.contradicciones.length
      ? [`${u.contradicciones.length} contradicción(es) entre reportes.`]
      : []),
    ...(u.posibles_mismo_incidente.length
      ? [
          `Podría ser el mismo que otro incidente (${u.posibles_mismo_incidente.length}).`,
        ]
      : []),
    ...u.discrepancias_entre_centrales.map(
      (d) =>
        `Las centrales no coinciden en el ${numero.get(d.reporte_id) ?? d.reporte_id}: ${d.prioridades.join(" vs ")} (se muestra la más alta).`
    ),
    ...(inc.vigencia.sin_noticias_recientes
      ? [`Sin noticias hace ${inc.vigencia.minutos_sin_noticias} min.`]
      : []),
  ]

  return (
    <article
      className="flex h-full min-h-0 flex-col"
      aria-labelledby="t-incidente"
    >
      <ScrollArea className="min-h-0 flex-1 bg-canal/50">
        <header className="space-y-2 border-b bg-card px-3 pt-3 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Prioridad p={inc.prioridad} grande />
            <Icono aria-hidden="true" className="size-4" />
            <h2 id="t-incidente" className="text-base font-semibold">
              {TIPO[inc.tipo]}
            </h2>
            <EstadoInsignia e={inc.estado} />
          </div>
          <p className="text-xs text-muted-foreground">{inc.motivo_orden}</p>

          {/* Los tres datos que se miran primero. */}
          <dl className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-sm bg-muted/60 px-2 py-1.5">
              <dt className="flex items-center gap-1 text-[0.6875rem] text-muted-foreground">
                <MapPin className="size-3" aria-hidden="true" /> Dónde
              </dt>
              <dd
                className="truncate font-medium"
                title={
                  barrio
                    ? `${barrio.nombre} · comuna ${barrio.comuna}`
                    : undefined
                }
              >
                {inc.geohash ? (
                  (barrio?.nombre ?? "Fuera de los barrios del mapa")
                ) : (
                  <span className="text-p2">Sin ubicación</span>
                )}
              </dd>
            </div>
            <div className="rounded-sm bg-muted/60 px-2 py-1.5">
              <dt className="flex items-center gap-1 text-[0.6875rem] text-muted-foreground">
                <Users className="size-3" aria-hidden="true" /> Personas
              </dt>
              <dd className="font-medium">
                <span className="font-mono">{inc.impacto.personas}</span>
                {inc.impacto.vulnerables && (
                  <span className="text-[0.6875rem] font-normal">
                    {" "}
                    · niños/mayores
                  </span>
                )}
              </dd>
            </div>
            <div className="rounded-sm bg-muted/60 px-2 py-1.5">
              <dt className="flex items-center gap-1 text-[0.6875rem] text-muted-foreground">
                <Clock className="size-3" aria-hidden="true" /> Último reporte
              </dt>
              <dd
                className={cn(
                  "font-medium",
                  inc.vigencia.sin_noticias_recientes && "text-vencido"
                )}
              >
                {haceCuanto(inc.vigencia.ultimo_reporte_unix, ahora)}
              </dd>
            </div>
          </dl>
        </header>

        <div className="space-y-2 p-2">
          <Tarjeta n={1} titulo="Qué tan seguro es">
            <Confianza
              nivel={u.corroboracion}
              celulares={u.dispositivos}
              testigos={u.fuentes_directas}
            />
            {atencion.length > 0 && (
              <div
                className={cn(
                  "mt-2 rounded-sm border p-2",
                  u.revisar
                    ? "border-revisar/40 bg-revisar-surface"
                    : "border-p2/30 bg-p2-surface"
                )}
              >
                <h4
                  className={cn(
                    "flex items-center gap-1 font-medium",
                    u.revisar ? "text-revisar" : "text-p2"
                  )}
                >
                  <TriangleAlert className="size-3.5" aria-hidden="true" />
                  {u.revisar ? "Revisar antes de decidir" : "Tener en cuenta"}
                </h4>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {atencion.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
          </Tarjeta>

          <Tarjeta
            n={2}
            titulo="Lo que dijo la gente"
            extra={`${inc.evidencia.length} reporte${inc.evidencia.length === 1 ? "" : "s"}`}
          >
            <ol className="space-y-2">
              {inc.evidencia.map((ev, i) => (
                <ItemEvidencia
                  key={ev.reporte_id}
                  ev={ev}
                  n={i + 1}
                  ahora={ahora}
                />
              ))}
            </ol>
          </Tarjeta>

          <Tarjeta n={3} titulo="Acción sugerida">
            <Propuesta inc={inc} lugar={lugar} />
          </Tarjeta>

          {geo && inc.geohash && (
            <Plegable
              titulo="Cerca del incidente"
              extra="hospitales y bomberos"
            >
              <Cerca geo={geo} gh={inc.geohash} />
            </Plegable>
          )}

          <Plegable titulo="Detalle técnico">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Incidente</dt>
              <dd className="font-mono">{inc.id}</dd>
              {inc.geohash && (
                <>
                  <dt className="text-muted-foreground">Código de zona</dt>
                  <dd className="font-mono">
                    {inc.geohash} · {coordenadas(inc.geohash)} · {precision(inc.geohash)}
                  </dd>
                </>
              )}
              {barrio && (
                <>
                  <dt className="text-muted-foreground">Comuna</dt>
                  <dd>{barrio.comuna}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Primer reporte</dt>
              <dd className="font-mono">{horaLocal(inc.hora_unix)}</dd>
              <dt className="text-muted-foreground">Reportes</dt>
              <dd className="font-mono break-all">{inc.reportes.join(", ")}</dd>
            </dl>
            {[
              ["Contradicciones", u.contradicciones],
              ["Posiblemente el mismo incidente", u.posibles_mismo_incidente],
            ].map(([titulo, items]) =>
              (items as Record<string, unknown>[]).length ? (
                <div key={titulo as string} className="mt-2 text-xs">
                  <h4 className="font-medium">{titulo as string}</h4>
                  <ul className="mt-0.5 space-y-0.5 text-muted-foreground">
                    {(items as Record<string, unknown>[]).map((it, i) => (
                      <li
                        key={i}
                        className="font-mono text-[0.6875rem] break-all"
                      >
                        {Object.entries(it)
                          .map(
                            ([k, v]) =>
                              `${k.replaceAll("_", " ")}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`
                          )
                          .join(" · ")}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null
            )}
          </Plegable>
        </div>
      </ScrollArea>

      <BarraDecision
        key={inc.accion_propuesta?.id ?? inc.id}
        inc={inc}
        nodo={nodo}
        coordinador={coordinador}
        lugar={lugar}
        onDecidido={onDecidido}
      />
    </article>
  )
}

const NIVEL: Record<
  Corroboracion,
  { n: number; Icono: typeof ShieldCheck; tono: string; dice: string }
> = {
  posible_rumor: {
    n: 1,
    Icono: MessageCircleQuestion,
    tono: "text-p2",
    dice: "Nadie dice haberlo visto en persona.",
  },
  sin_confirmar: {
    n: 2,
    Icono: CircleHelp,
    tono: "text-foreground",
    dice: "Falta otra persona que lo haya visto.",
  },
  corroborado: {
    n: 3,
    Icono: ShieldCheck,
    tono: "text-ok",
    dice: "Lo cuentan varias personas y al menos una lo vio.",
  },
}

/** Qué tan seguro es, de un vistazo: tres escalones, del rumor a lo corroborado. */
function Confianza({
  nivel,
  celulares,
  testigos,
}: {
  nivel: Corroboracion
  celulares: number
  testigos: number
}) {
  const { n, Icono, tono, dice } = NIVEL[nivel]
  return (
    <div className="flex items-center gap-2.5">
      <Icono aria-hidden="true" className={cn("size-5 shrink-0", tono)} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <strong className={cn("font-medium", tono)}>
            {CORROBORACION[nivel]}
          </strong>
          <span
            className="flex gap-0.5"
            role="meter"
            aria-valuemin={1}
            aria-valuemax={3}
            aria-valuenow={n}
            aria-label={`Confianza ${n} de 3`}
          >
            {[1, 2, 3].map((k) => (
              <span
                key={k}
                className={cn(
                  "h-1.5 w-5 rounded-full",
                  k <= n ? "bg-current" : "bg-muted",
                  tono
                )}
              />
            ))}
          </span>
        </p>
        <p className="text-muted-foreground">
          {dice} {celulares} celular{celulares === 1 ? "" : "es"} ·{" "}
          {testigos === 0
            ? "nadie lo vio en persona"
            : `${testigos} lo ${testigos === 1 ? "vio" : "vieron"} en persona`}
        </p>
      </div>
    </div>
  )
}

/** El texto de la persona primero y grande; quién, cuándo y las señales del triaje, debajo y a un clic. */
function ItemEvidencia({
  ev,
  n,
  ahora,
}: {
  ev: Evidencia
  n: number
  ahora: number
}) {
  return (
    <li className="rounded-sm border bg-background/60 text-xs">
      <div className="space-y-1 p-2">
        <p className="text-sm leading-snug">«{ev.texto || "sin texto"}»</p>
        <p className="flex flex-wrap items-center gap-x-1.5 text-[0.6875rem] text-muted-foreground">
          <span className="font-medium text-foreground" title={ev.reporte_id}>
            Reporte {n}
          </span>
          <Prioridad p={ev.prioridad} />
          <span>{fuenteLegible(ev.fuente)}</span>·
          <span>{haceCuanto(ev.hora_unix, ahora)}</span>·
          <span>
            {ev.personas} persona{ev.personas === 1 ? "" : "s"}
          </span>
          {ev.vinculo === "mismo" && ev.similitud !== null && (
            <>· {Math.round(ev.similitud * 100)} % parecido</>
          )}
        </p>
      </div>
      {ev.senales.length > 0 && (
        <details className="group border-t">
          <summary className="flex cursor-pointer list-none items-center gap-1 px-2 py-1 text-[0.6875rem] text-muted-foreground select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRight
              aria-hidden="true"
              className="size-3 transition-transform group-open:rotate-90"
            />
            Por qué esta prioridad ({ev.senales.length} {ev.senales.length === 1 ? "razón" : "razones"})
          </summary>
          <ul className="space-y-1 px-2 pb-2" aria-label="Señales del triaje">
            {ev.senales.map((s, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
              >
                <span
                  className={cn(
                    "rounded-sm px-1 text-[0.625rem] font-medium uppercase",
                    s.origen === "jev"
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {ORIGEN_LEGIBLE[s.origen]}
                </span>
                <span>{senalLegible(s.senal, ev.texto)}</span>
                <Prioridad p={s.prioridad} />
                {s.probabilidad !== null && (
                  <span className="font-mono text-[0.6875rem]">
                    {Math.round(s.probabilidad * 100)} %
                  </span>
                )}
                {s.cita && (
                  <q className="text-muted-foreground italic">{citaLegible(s.cita, ev.texto)}</q>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  )
}

function distancia(m: number): string {
  return m < 1000
    ? `${Math.round(m / 50) * 50} m`
    : `${(m / 1000).toFixed(1).replace(".", ",")} km`
}

/** Lo más cercano según OpenStreetMap, medido desde el centro de la celda: es una referencia. */
function Cerca({ geo, gh }: { geo: Geo; gh: string }) {
  const grupos = [
    {
      titulo: "Hospitales y clínicas",
      lista: cercanos(geo.lugares, gh, ["hospital", "clinica"], 3),
    },
    { titulo: "Bomberos", lista: cercanos(geo.lugares, gh, ["bomberos"], 2) },
  ]
  return (
    <div className="grid gap-2 text-xs">
      {grupos.map((g) => (
        <div key={g.titulo}>
          <h4 className="font-medium">{g.titulo}</h4>
          <ul className="mt-0.5 divide-y">
            {g.lista.map((l) => (
              <li key={l.id} className="flex justify-between gap-2 py-1">
                <span className="truncate">{l.nombre}</span>
                <span className="shrink-0 font-mono text-muted-foreground">
                  {distancia(l.metros)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="text-[0.6875rem] text-muted-foreground">
        En línea recta desde el centro de la zona. Fuente: OpenStreetMap.
      </p>
    </div>
  )
}
