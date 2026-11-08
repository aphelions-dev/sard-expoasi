import { describe, expect, it } from "vitest";
import type { Incidente, Recurso } from "./api/tipos";
import { CATALOGO, filas } from "./recursos";

const declarado = (entidad: string, recurso: string, disponibles: number): Recurso => ({
  entidad, recurso, declarados: disponibles, comprometidos: 0, disponibles, coordinador: "x", declarado_en: 0,
});

const pide = (estado: Incidente["estado"], entidad: string, recurso: string | null) =>
  ({ estado, accion_propuesta: { entidad, recurso } }) as Incidente;

describe("filas de recursos", () => {
  it("muestra todo el catálogo del contrato aunque no esté declarado", () => {
    const f = filas([], []);
    expect(f).toHaveLength(CATALOGO.length);
    expect(f.every((x) => x.declarado === null)).toBe(true);
  });

  it("cuenta solo los incidentes pendientes que piden ese recurso", () => {
    const f = filas(
      [declarado("Cruz Roja", "ambulancia", 1)],
      [pide("pendiente", "Cruz Roja", "ambulancia"), pide("pendiente", "Cruz Roja", "ambulancia"),
       pide("aprobada", "Cruz Roja", "ambulancia"), pide("pendiente", "sala de crisis", null)],
    );
    const amb = f.find((x) => x.recurso === "ambulancia")!;
    expect(amb.declarado?.disponibles).toBe(1);
    expect(amb.piden).toBe(2);
  });

  it("no esconde un recurso declarado que no está en el catálogo", () => {
    const f = filas([declarado("Ejército", "helicóptero", 1)], []);
    expect(f.at(-1)).toMatchObject({ entidad: "Ejército", recurso: "helicóptero" });
  });
});
