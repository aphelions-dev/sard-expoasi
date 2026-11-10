"use client"

import { useState } from "react"
import { Check, Copy, Download, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { Incidente } from "@/lib/api/tipos"
import { boletin } from "@/lib/boletin"
import type { Barrio } from "@/lib/geo"

interface Props {
  incidentes: Incidente[]
  barrio: (gh: string | null) => Barrio | null
  quien: string
}

const fecha = (d: Date) => d.toLocaleString("es-CO", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })

/** Borrador del boletín de situación. Se arma con una plantilla sobre los incidentes del momento y
 *  queda en un cuadro editable: lo que sale de aquí lo revisa y lo envía una persona. */
export function Boletin({ incidentes, barrio, quien }: Props) {
  const armar = () => boletin(incidentes, barrio, { cuando: fecha(new Date()), quien: quien.trim() })
  // null: todavía sin tocar, se muestra el de ahora. Al editar o actualizar queda fijo.
  const [texto, setTexto] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const actual = texto ?? armar()

  async function copiar() {
    await navigator.clipboard.writeText(actual)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  function descargar() {
    const url = URL.createObjectURL(new Blob([actual], { type: "text/plain;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `boletin-sard-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-")}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="flex h-full min-h-0 flex-col" aria-labelledby="t-boletin">
      <header className="space-y-1 px-3 pt-3 pb-2.5">
        <h2 id="t-boletin" className="text-base font-semibold">Boletín de situación</h2>
        <p className="text-xs text-muted-foreground">
          Borrador con lo que hay en el sistema en este momento. Revísalo y corrígelo antes de enviarlo: son reportes ciudadanos, no
          hechos verificados.
        </p>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 border-t p-3">
        <label htmlFor="boletin" className="sr-only">
          Texto del boletín
        </label>
        <Textarea
          id="boletin"
          value={actual}
          onChange={(e) => setTexto(e.target.value)}
          spellCheck={false}
          className="min-h-0 flex-1 resize-none font-mono text-xs leading-relaxed"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={copiar}>
            {copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copiado ? "Copiado" : "Copiar"}
          </Button>
          <Button variant="outline" onClick={descargar}>
            <Download aria-hidden="true" />
            Descargar
          </Button>
          <Button variant="ghost" className="ml-auto" onClick={() => setTexto(armar())} title="Vuelve a armar el boletín con los datos de ahora; se pierde lo que hayas editado">
            <RefreshCw aria-hidden="true" />
            Actualizar
          </Button>
        </div>
        {texto !== null && <p className="text-[0.6875rem] text-muted-foreground">Texto fijo desde que lo editaste o actualizaste. «Actualizar» lo arma de nuevo con los datos de ahora.</p>}
      </div>
    </section>
  )
}
