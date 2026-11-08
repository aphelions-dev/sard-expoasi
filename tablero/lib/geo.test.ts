import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { barrioDe, celda, cercanos, metros, type ColeccionBarrios, type ColeccionLugares } from "./geo";

const leer = <T,>(f: string): T => JSON.parse(readFileSync(new URL(`../public/geo/${f}`, import.meta.url), "utf8"));
const barrios = leer<ColeccionBarrios>("barrios.geojson");
const lugares = leer<ColeccionLugares>("lugares.geojson");

describe("barrioDe", () => {
  it("nombra el barrio oficial de la celda", () => {
    expect(barrioDe(barrios, "d2fkcd")).toEqual({ id: "CENTRO", nombre: "Centro", comuna: "03" });
    expect(barrioDe(barrios, "d2fkc7")?.nombre).toBe("Chipre");
  });

  it("no inventa barrio fuera de Manizales (Villamaría o el geohash de Cali)", () => {
    expect(barrioDe(barrios, "d2fk9w")).toBeNull();
    expect(barrioDe(barrios, "d29e4k")).toBeNull();
  });
});

describe("celda", () => {
  it("es un rectángulo cerrado de unos 600 m de alto", () => {
    const c = celda("d2fkcd");
    expect(c).toHaveLength(5);
    expect(c[0]).toEqual(c[4]);
    const alto = metros(c[0], c[3]);
    expect(alto).toBeGreaterThan(550);
    expect(alto).toBeLessThan(650);
  });
});

describe("cercanos", () => {
  it("ordena por distancia y respeta el tipo", () => {
    const b = cercanos(lugares, "d2fkcd", ["bomberos"], 2);
    expect(b.every((l) => l.tipo === "bomberos")).toBe(true);
    expect(b[0].metros).toBeLessThanOrEqual(b[1].metros);
  });
});
