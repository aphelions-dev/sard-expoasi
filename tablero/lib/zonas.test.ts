import { describe, expect, it } from "vitest";
import type { Incidente } from "./api/tipos";
import type { Barrio } from "./geo";
import { cambios, enZona, resumenPorBarrio, zonasConConteo } from "./zonas";

const BARRIOS: Record<string, Barrio> = {
  a: { id: "CENTRO", nombre: "Centro", comuna: "03" },
  b: { id: "SAN JOSE", nombre: "San José", comuna: "02" },
  c: { id: "FUNDADORES", nombre: "Fundadores", comuna: "03" },
};
const barrio = (gh: string | null) => (gh ? (BARRIOS[gh] ?? null) : null);

function inc(id: string, gh: string | null, p: Incidente["prioridad"], extra: Partial<Incidente> = {}): Incidente {
  return {
    id, prioridad: p, tipo: "OTRO", geohash: gh, hora_unix: 0, reportes: [], evidencia: [],
    incertidumbre: { revisar: false } as Incidente["incertidumbre"],
    impacto: { personas: 1, vulnerables: false },
    vigencia: { ultimo_reporte_unix: 0, minutos_sin_noticias: 0, sin_noticias_recientes: false },
    motivo_orden: "", recurso: null, estado: "pendiente", accion_propuesta: null, decision: null,
    ...extra,
  };
}

describe("resumenPorBarrio", () => {
  it("pinta el barrio con la prioridad más alta de lo pendiente", () => {
    const r = resumenPorBarrio([
      inc("1", "a", "P3"),
      inc("2", "a", "P1", { estado: "aprobada" }),
      inc("3", "a", "P2", { incertidumbre: { revisar: true } as Incidente["incertidumbre"] }),
      inc("4", "b", "P4"),
      inc("5", null, "P1"),
    ], barrio);
    expect(r.get("CENTRO")).toEqual({ prioridad: "P2", total: 3, pendientes: 2, revisar: true, apagado: false });
    expect(r.get("SAN JOSE")?.prioridad).toBe("P4");
    expect(r.size).toBe(2);
  });

  it("apaga el barrio cuando ya no queda nada por hacer", () => {
    const r = resumenPorBarrio([inc("1", "b", "P1", { estado: "rechazada" })], barrio);
    expect(r.get("SAN JOSE")).toMatchObject({ prioridad: "P1", apagado: true, pendientes: 0 });
  });
});

describe("zonas", () => {
  it("filtra por barrio o por comuna; sin barrio no entra en ninguna zona", () => {
    expect(enZona(BARRIOS.a, { tipo: "barrio", id: "CENTRO", nombre: "Centro" })).toBe(true);
    expect(enZona(BARRIOS.c, { tipo: "comuna", id: "03", nombre: "Comuna 3" })).toBe(true);
    expect(enZona(BARRIOS.b, { tipo: "comuna", id: "03", nombre: "Comuna 3" })).toBe(false);
    expect(enZona(null, { tipo: "barrio", id: "CENTRO", nombre: "Centro" })).toBe(false);
    expect(enZona(null, null)).toBe(true);
  });

  it("cuenta barrios y comunas, primero los de más pendientes", () => {
    const z = zonasConConteo([inc("1", "a", "P1"), inc("2", "c", "P2"), inc("3", "b", "P1", { estado: "aprobada" })], barrio);
    expect(z[0]).toEqual({ zona: { tipo: "comuna", id: "03", nombre: "Comuna 3" }, total: 2, pendientes: 2 });
    expect(z.find((x) => x.zona.id === "SAN JOSE")).toMatchObject({ total: 1, pendientes: 0 });
  });

  it("marca lo nuevo y lo que cambió de prioridad", () => {
    const antes = new Map([["1", "P2" as const], ["2", "P3" as const]]);
    expect(cambios(antes, [inc("1", "a", "P2"), inc("2", "a", "P1"), inc("3", "a", "P4")])).toEqual(["2", "3"]);
  });
});
