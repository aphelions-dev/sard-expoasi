import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { debidos, esperaMs, reactivar, vencido, type Guardado } from "./cola"
import {
  largoGeohash,
  leerLista,
  leerSack,
  limpiarTexto,
  mensaje,
  prioridad,
  type Datos,
} from "./sard1"

const contrato = readFileSync(
  new URL("../../../contracts/palabras-criticas.txt", import.meta.url),
  "utf8"
)
const palabras = leerLista(contrato)
const base: Datos = {
  tipo: "OTRO",
  personas: 1,
  atrapados: false,
  heridos: false,
  vulnerables: false,
  texto: "",
}

describe("prioridad, como en el celular", () => {
  it("P1 si hay atrapados", () =>
    expect(prioridad({ ...base, atrapados: true }, palabras)).toBe("P1"))
  it("P1 por palabra crítica, sin tildes ni mayúsculas", () =>
    expect(prioridad({ ...base, texto: "Están ATRAPADOS" }, palabras)).toBe(
      "P1"
    ))
  it("P2 con heridos", () =>
    expect(prioridad({ ...base, heridos: true }, palabras)).toBe("P2"))
  it("P2 con niños o adultos mayores", () =>
    expect(prioridad({ ...base, vulnerables: true }, palabras)).toBe("P2"))
  it("P3 con personas", () => expect(prioridad(base, palabras)).toBe("P3"))
  it("P4 sin personas", () =>
    expect(prioridad({ ...base, personas: 0 }, palabras)).toBe("P4"))
  it("el tipo no cambia la prioridad", () =>
    expect(prioridad({ ...base, tipo: "FUEGO", personas: 0 }, palabras)).toBe(
      "P4"
    ))
})

describe("mensaje SARD1", () => {
  it("sigue el ejemplo del contrato", () =>
    expect(
      mensaje({
        ...base,
        id: "a3f9-0042",
        prioridad: "P1",
        tipo: "ATRAP",
        personas: 3,
        atrapados: true,
        vulnerables: true,
        geohash: "d2fkcd",
        horaUnix: 1762481000,
        texto: "edificio colapsado calle 23",
      })
    ).toBe(
      "SARD1|a3f9-0042|P1|ATRAP|3|101|d2fkcd|1762481000|edificio colapsado calle 23"
    ))
  it("el texto queda en una línea", () =>
    expect(limpiarTexto(" casa\n caída  ")).toBe("casa caída"))
  it("lee el SACK", () => {
    expect(leerSack("SACK|w1a2b-0001")).toBe("w1a2b-0001")
    expect(leerSack("SACK|")).toBeNull()
  })
  it("geohash según la precisión", () =>
    expect([3, 15, 50, 200].map(largoGeohash)).toEqual([9, 8, 7, 6]))
})

const g = (o: Partial<Guardado>): Guardado => ({
  id: "w1-0001",
  mensaje: "",
  prioridad: "P3",
  horaUnix: 1000,
  estado: "pendiente",
  intentos: 0,
  proximoMs: 0,
  inicioRondaMs: 0,
  ...o,
})

describe("cola de reintentos", () => {
  it("espera 2, 4, 8, 16, 32 y luego 60 s", () =>
    expect([1, 2, 3, 4, 5, 6, 9].map((n) => esperaMs(n, 0.5))).toEqual([
      2000, 4000, 8000, 16000, 32000, 60000, 60000,
    ]))
  it("±20 %", () =>
    expect([esperaMs(1, 0), esperaMs(1, 1)]).toEqual([1600, 2400]))
  it("vence a los 600 s de la hora del reporte", () => {
    expect(vencido(g({}), 1_599_999)).toBe(false)
    expect(vencido(g({}), 1_600_000)).toBe(true)
  })
  it("P1 primero y, en cada prioridad, el más antiguo", () => {
    const l = [
      g({ id: "a-1", prioridad: "P3", horaUnix: 1 }),
      g({ id: "b-1", prioridad: "P1", horaUnix: 5 }),
      g({ id: "c-1", prioridad: "P1", horaUnix: 2 }),
    ]
    expect(debidos(l, 0).map((x) => x.id)).toEqual(["c-1", "b-1", "a-1"])
  })
  it("no reintenta lo entregado ni lo rechazado", () =>
    expect(
      debidos([g({ estado: "entregado" }), g({ estado: "rechazado" })], 0)
    ).toEqual([]))
  it("reactivar abre una ronda nueva desde ahora", () => {
    const [r] = reactivar(
      [g({ estado: "no_entregado", intentos: 14 })],
      5_000_000
    )
    expect(r).toMatchObject({
      estado: "pendiente",
      intentos: 0,
      proximoMs: 5_000_000,
      inicioRondaMs: 5_000_000,
    })
    expect(vencido(r, 5_599_999)).toBe(false)
  })
})

describe("lista de palabras", () => {
  it("la copia de public/ es la del contrato", () =>
    expect(
      readFileSync(
        new URL("../../public/palabras-criticas.txt", import.meta.url),
        "utf8"
      )
    ).toBe(contrato))
})
