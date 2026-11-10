"use client"

// App web para reportar desde un celular sin la app Android (iPhone incluido, ADR 0007 y 0008). Arma el
// mismo SARD1 que la app, lo guarda en el navegador y lo sube a la central cuando hay internet.
// No entra a la malla Bluetooth: el navegador no puede (ver el ADR). El botón «Copiar» deja el
// mensaje listo para pegarlo en el chat público de bitchat, que sí la recorre.
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  debidos,
  esperaMs,
  reactivar,
  vencido,
  type Estado,
  type Guardado,
} from "@/lib/cola"
import { subir } from "@/lib/envio"
import {
  NOMBRE_TIPO,
  TIPOS,
  geohashDe,
  leerLista,
  limpiarTexto,
  mensaje,
  palabraCritica,
  prioridad as calcularPrioridad,
  type Datos,
  type Prioridad,
  type Tipo,
} from "@/lib/sard1"
import { cn } from "@/lib/utils"

const CLAVE = {
  reportes: "sard-reportes",
  disp: "sard-disp",
  contador: "sard-contador",
}

const leer = <T,>(clave: string, porDefecto: T): T => {
  try {
    const v = localStorage.getItem(clave)
    return v === null ? porDefecto : (JSON.parse(v) as T)
  } catch {
    return porDefecto
  }
}
const escribir = (clave: string, valor: unknown) => {
  try {
    localStorage.setItem(clave, JSON.stringify(valor))
  } catch {
    // Sin almacenamiento (modo privado): el reporte sigue en memoria mientras la página esté abierta.
  }
}

function dispositivo(): string {
  let d = leer<string | null>(CLAVE.disp, null)
  if (!d) {
    d =
      "w" +
      Math.floor(Math.random() * 0x10000)
        .toString(16)
        .padStart(4, "0")
    escribir(CLAVE.disp, d)
  }
  return d
}

function nuevoId(): string {
  const n = leer<number>(CLAVE.contador, 0) + 1
  escribir(CLAVE.contador, n)
  return `${dispositivo()}-${String(n).padStart(4, "0")}`
}

/** El formulario antes de enviar: el tipo empieza sin elegir, para que nadie mande «Otro» por
 *  descuido. Es el único dato obligatorio. */
type Formulario = Omit<Datos, "tipo"> & { tipo: Tipo | null }

const VACIO: Formulario = {
  tipo: null,
  personas: 1,
  atrapados: false,
  heridos: false,
  vulnerables: false,
  texto: "",
}

// Quien reporta no tiene por qué saber qué es «P1»: se le dice con qué urgencia sale su reporte.
const URGENCIA: Record<Prioridad, string> = {
  P1: "Crítico",
  P2: "Urgente",
  P3: "Importante",
  P4: "Informativo",
}

const TONO: Record<Prioridad, string> = {
  P1: "bg-p1-surface text-p1",
  P2: "bg-p2-surface text-p2",
  P3: "bg-p3-surface text-p3",
  P4: "bg-p4-surface text-p4",
}

const ESTADO: Record<Estado, { texto: string; tono: string }> = {
  pendiente: { texto: "Pendiente", tono: "bg-muted text-muted-foreground" },
  entregado: { texto: "✓ Entregado", tono: "bg-ok-surface text-ok" },
  no_entregado: {
    texto: "No entregado",
    tono: "bg-vencido-surface text-vencido",
  },
  rechazado: { texto: "Rechazado", tono: "bg-p1-surface text-p1" },
}

function suscribirRed(aviso: () => void) {
  window.addEventListener("online", aviso)
  window.addEventListener("offline", aviso)
  return () => {
    window.removeEventListener("online", aviso)
    window.removeEventListener("offline", aviso)
  }
}

type Ubicacion =
  { geohash: string; precisionM: number } | { error: string } | null

export function AppReportar() {
  const [datos, setDatos] = useState<Formulario>(VACIO)
  const [palabras, setPalabras] = useState<string[] | null>(null)
  const [ubicacion, setUbicacion] = useState<Ubicacion>(null)
  const [reportes, setReportes] = useState<Guardado[]>([])
  const enLinea = useSyncExternalStore(
    suscribirRed,
    () => navigator.onLine,
    () => true
  )
  const [copiado, setCopiado] = useState<string | null>(null)
  const subiendo = useRef(false)
  // Copia síncrona de la lista: el ciclo de reintentos la lee sin esperar a que React renderice.
  const actual = useRef<Guardado[]>([])

  const guardar = useCallback(
    (cambio: (l: Guardado[]) => Guardado[]): Guardado[] => {
      const nueva = cambio(actual.current)
      actual.current = nueva
      escribir(CLAVE.reportes, nueva)
      setReportes(nueva)
      return nueva
    },
    []
  )

  useEffect(() => {
    guardar(() => leer<Guardado[]>(CLAVE.reportes, []))
    fetch("/palabras-criticas.txt")
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((t) => setPalabras(leerLista(t)))
      .catch(() => setPalabras([]))
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    // Volver a tener internet hace lo que en la malla hace un vecino nuevo: los vencidos empiezan
    // una ronda nueva (regla 5).
    const conectado = () => guardar((l) => reactivar(l, Date.now()))
    window.addEventListener("online", conectado)
    return () => window.removeEventListener("online", conectado)
  }, [guardar])

  // Cada segundo: marca lo vencido y sube los pendientes cuyo intento ya llegó (reglas 1, 2 y 5).
  useEffect(() => {
    const revisar = async () => {
      const ahora = Date.now()
      const lista = guardar((l) =>
        l.map((g) =>
          g.estado === "pendiente" && vencido(g, ahora)
            ? { ...g, estado: "no_entregado" as const }
            : g
        )
      )
      const toca = debidos(lista, ahora)
      if (!toca.length || subiendo.current || !navigator.onLine) return
      subiendo.current = true
      try {
        const r = await subir(
          toca.map((g) => g.mensaje),
          `web-${dispositivo()}`
        )
        const motivos = new Map(r.rechazados.map((x) => [x.mensaje, x.motivo]))
        guardar((l) =>
          l.map((g) => {
            if (r.sack.includes(g.id))
              return { ...g, estado: "entregado", central: r.central }
            const motivo = motivos.get(g.mensaje)
            if (motivo) return { ...g, estado: "rechazado", motivo }
            return g
          })
        )
      } catch {
        const ids = new Set(toca.map((g) => g.id))
        guardar((l) =>
          l.map((g) =>
            ids.has(g.id)
              ? {
                  ...g,
                  intentos: g.intentos + 1,
                  proximoMs:
                    Date.now() + esperaMs(g.intentos + 1, Math.random()),
                }
              : g
          )
        )
      } finally {
        subiendo.current = false
      }
    }
    const t = setInterval(revisar, 1000)
    return () => clearInterval(t)
  }, [guardar])

  // La ubicación se pide al abrir, sin esperar a que alguien encuentre el botón: es el dato que más
  // sirve a quien va a llegar y el que más se queda sin enviar.
  const [buscando, setBuscando] = useState(true)
  const tomarUbicacion = useCallback(() => {
    const falla = (error: string) => {
      setBuscando(false)
      setUbicacion({ error })
    }
    if (!("geolocation" in navigator)) {
      // Fuera del cuerpo del efecto, como las otras respuestas del GPS.
      queueMicrotask(() =>
        falla(
          "Este navegador no da la ubicación. Escribe abajo la dirección o un punto de referencia."
        )
      )
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setBuscando(false)
        setUbicacion({
          geohash: geohashDe(
            p.coords.latitude,
            p.coords.longitude,
            p.coords.accuracy
          ),
          precisionM: p.coords.accuracy,
        })
      },
      () =>
        falla(
          "No se pudo tomar tu ubicación (sin permiso o sin señal de GPS). Escribe abajo la dirección o un punto de referencia."
        ),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 }
    )
  }, [])
  useEffect(tomarUbicacion, [tomarUbicacion])
  const pedirUbicacion = () => {
    setBuscando(true)
    tomarUbicacion()
  }

  const texto = limpiarTexto(datos.texto)
  const prioridad = calcularPrioridad(
    { ...datos, tipo: datos.tipo ?? "OTRO", texto }, // el tipo no cambia la prioridad
    palabras ?? []
  )
  const palabra = palabraCritica(texto, palabras ?? [])
  const motivo = datos.atrapados
    ? "hay personas atrapadas"
    : palabra
      ? `el texto dice «${palabra}»`
      : datos.heridos
        ? "hay heridos"
        : datos.vulnerables
          ? "hay niños o adultos mayores"
          : datos.personas >= 1
            ? "hay personas afectadas"
            : "nadie afectado"

  const enviar = () => {
    if (!datos.tipo) return
    const r = {
      ...datos,
      tipo: datos.tipo,
      texto,
      id: nuevoId(),
      prioridad,
      geohash: ubicacion && "geohash" in ubicacion ? ubicacion.geohash : "",
      horaUnix: Math.floor(Date.now() / 1000),
    }
    const g: Guardado = {
      id: r.id,
      mensaje: mensaje(r),
      prioridad,
      horaUnix: r.horaUnix,
      estado: "pendiente",
      intentos: 0,
      proximoMs: Date.now(),
      inicioRondaMs: 0,
    }
    guardar((l) => [g, ...l])
    setDatos(VACIO)
  }

  const copiar = async (g: Guardado) => {
    try {
      await navigator.clipboard.writeText(g.mensaje)
      setCopiado(g.id)
    } catch {
      setCopiado(null)
    }
  }

  // Elegir «Atrapados» ya dice que hay personas atrapadas: se marca sola y su casilla no se repite.
  const elegirTipo = (tipo: Tipo) =>
    setDatos({
      ...datos,
      tipo,
      atrapados:
        tipo === "ATRAP" || (datos.tipo === "ATRAP" ? false : datos.atrapados),
    })

  const banderas = (
    [
      ["atrapados", "Personas atrapadas"],
      ["heridos", "Heridos"],
      ["vulnerables", "Niños o adultos mayores"],
    ] as const
  ).filter(([k]) => !(k === "atrapados" && datos.tipo === "ATRAP"))

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-5 text-sm">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Reportar emergencia</h1>
          <p className="text-muted-foreground">SARD · Manizales</p>
        </div>
        <Badge
          className={cn(
            "h-6",
            enLinea
              ? "bg-ok-surface text-ok"
              : "bg-vencido-surface text-vencido"
          )}
        >
          {enLinea ? "Con internet" : "Sin internet"}
        </Badge>
      </header>

      <section className="space-y-1.5 rounded-md border p-3" aria-live="polite">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium">
            {buscando
              ? "Buscando tu ubicación…"
              : ubicacion && "geohash" in ubicacion
                ? `Ubicación lista (±${Math.max(1, Math.round(ubicacion.precisionM))} m)`
                : "Sin ubicación"}
          </p>
          {!buscando && (
            <Button
              variant="outline"
              className="h-9 shrink-0"
              onClick={pedirUbicacion}
            >
              {ubicacion && "geohash" in ubicacion
                ? "Actualizar"
                : "Reintentar"}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {ubicacion && "error" in ubicacion && !buscando
            ? ubicacion.error
            : "Se envía con tu reporte para que los organismos de socorro sepan a dónde ir. No se usa para nada más."}
        </p>
      </section>

      <section className="space-y-2" aria-labelledby="t-tipo">
        <h2 id="t-tipo" className="font-medium">
          Qué pasa
        </h2>
        <ToggleGroup
          variant="outline"
          className="grid w-full grid-cols-3 gap-2"
          value={datos.tipo ? [datos.tipo] : []}
          onValueChange={(v) => v[0] && elegirTipo(v[0] as Tipo)}
        >
          {TIPOS.map((t) => (
            <ToggleGroupItem
              key={t}
              value={t}
              className="h-12 px-1 text-[0.8125rem] leading-tight whitespace-normal aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            >
              {NOMBRE_TIPO[t]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </section>

      <section
        className="flex items-center justify-between gap-3"
        aria-labelledby="t-personas"
      >
        <h2 id="t-personas" className="font-medium">
          Personas afectadas
        </h2>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="size-11 text-lg"
            aria-label="Una persona menos"
            onClick={() =>
              setDatos({ ...datos, personas: Math.max(0, datos.personas - 1) })
            }
          >
            −
          </Button>
          <span
            className="w-8 text-center font-mono text-lg"
            aria-live="polite"
          >
            {datos.personas}
          </span>
          <Button
            variant="outline"
            className="size-11 text-lg"
            aria-label="Una persona más"
            onClick={() => setDatos({ ...datos, personas: datos.personas + 1 })}
          >
            +
          </Button>
        </div>
      </section>

      <section className="space-y-2" aria-labelledby="t-banderas">
        <h2 id="t-banderas" className="font-medium">
          Hay…
        </h2>
        <div className="grid gap-2">
          {banderas.map(([k, nombre]) => (
            <label
              key={k}
              className="flex h-11 items-center gap-3 rounded-md border px-3"
            >
              <input
                type="checkbox"
                className="size-5 accent-[var(--primary)]"
                checked={datos[k]}
                onChange={(e) => setDatos({ ...datos, [k]: e.target.checked })}
              />
              {nombre}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <Label htmlFor="texto" className="font-medium">
          {ubicacion && "error" in ubicacion
            ? "Dónde es y qué pasa"
            : "Detalle (opcional)"}
        </Label>
        <Textarea
          id="texto"
          rows={3}
          className="text-base"
          placeholder={
            ubicacion && "error" in ubicacion
              ? "Dirección o punto de referencia, y qué pasa"
              : "p. ej. casa caída en la calle 23, se oyen voces"
          }
          value={datos.texto}
          onChange={(e) => setDatos({ ...datos, texto: e.target.value })}
        />
      </section>

      <section
        className={cn("space-y-1 rounded-md p-3", TONO[prioridad])}
        aria-live="polite"
      >
        <p className="font-semibold">Saldrá como: {URGENCIA[prioridad]}</p>
        <p className="text-xs">Porque {motivo}.</p>
        {palabras?.length === 0 && (
          <p className="text-xs">
            No se cargó la lista de palabras de alerta: marca las casillas que
            apliquen.
          </p>
        )}
      </section>

      <div className="space-y-1.5">
        <Button
          className="h-12 w-full bg-p1 text-base font-semibold text-white hover:bg-p1/90"
          disabled={!datos.tipo}
          onClick={enviar}
        >
          Enviar reporte
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {datos.tipo
            ? "Si puedes llamar, llama también al 123."
            : "Elige arriba qué pasa para poder enviar."}
        </p>
      </div>

      <section className="space-y-2" aria-labelledby="t-mios">
        <h2 id="t-mios" className="font-medium">
          Mis reportes
        </h2>
        {reportes.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Todavía no has enviado reportes.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Deja esta página abierta mientras haya pendientes: el navegador no
              envía en segundo plano. Sin internet, copia el mensaje y pégalo en
              el chat público de bitchat.
            </p>
            <ul className="space-y-2">
              {reportes.map((g) => (
                <li key={g.id} className="space-y-2 rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={TONO[g.prioridad]}>
                      {URGENCIA[g.prioridad]}
                    </Badge>
                    <Badge className={ESTADO[g.estado].tono}>
                      {ESTADO[g.estado].texto}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {g.id}
                    </span>
                  </div>
                  {g.estado !== "entregado" && (
                    <p className="font-mono text-xs break-all">{g.mensaje}</p>
                  )}
                  {g.estado === "pendiente" && g.intentos > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Intento {g.intentos}, se reintenta solo.
                    </p>
                  )}
                  {g.estado === "entregado" && g.central && (
                    <p className="text-xs text-muted-foreground">
                      Tu reporte llegó a la central de emergencias. Si la
                      situación cambia, envía otro.
                    </p>
                  )}
                  {g.motivo && (
                    <p className="text-xs text-p1">
                      La central lo rechazó: {g.motivo}
                    </p>
                  )}
                  {g.estado !== "entregado" && g.estado !== "rechazado" && (
                    <Button
                      variant="outline"
                      className="h-10 w-full"
                      onClick={() => copiar(g)}
                    >
                      {copiado === g.id
                        ? "Copiado ✓ · pégalo en bitchat"
                        : "Copiar para bitchat"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  )
}
