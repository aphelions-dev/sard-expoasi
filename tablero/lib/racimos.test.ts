import { describe, expect, it } from "vitest";

import { metrosPorPixel, racimos } from "./racimos";

// Unos 11 m por cada 0,0001° de longitud a esta latitud.
const p = (dato: string, lon: number) => ({ centro: [lon, 5.06] as [number, number], dato });

describe("racimos", () => {
  it("junta lo que queda a menos del radio y deja suelto lo demás", () => {
    const r = racimos([p("a", -75.5), p("b", -75.5001), p("c", -75.51)], 50);
    expect(r.map((x) => x.datos)).toEqual([["a", "b"], ["c"]]);
    expect(r[0].centro).toEqual([-75.5, 5.06]);
    expect(r[0].radio).toBeGreaterThan(5);
    expect(r[1].radio).toBe(0);
  });
  it("con el radio de un zoom cercano, los mismos puntos se separan", () => {
    const puntos = [p("a", -75.5), p("b", -75.5001)];
    expect(racimos(puntos, 34 * metrosPorPixel(14, 5.06))).toHaveLength(1);
    expect(racimos(puntos, 34 * metrosPorPixel(18, 5.06))).toHaveLength(2);
  });
});
