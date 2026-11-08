import { describe, expect, it } from "vitest";
import { ErrorApi, elegirActiva, mensajeDecision } from "./api/central";
import type { Incidente, Prioridad, Salud } from "./api/tipos";
import { conteos, filtrar, porDecidir } from "./cola";
import { haceCuanto } from "./formato";

const ok = (central: "A" | "B"): Salud => ({ estado: "ok", central, jev: "ok" });

describe("elegirActiva", () => {
  it("lee de la A mientras responda", () => expect(elegirActiva({ A: ok("A"), B: ok("B") })).toBe("A"));
  it("pasa a la B si la A cae", () => expect(elegirActiva({ A: null, B: ok("B") })).toBe("B"));
  it("null si caen las dos", () => expect(elegirActiva({ A: null, B: null })).toBeNull());
});

function inc(id: string, prioridad: Prioridad, revisar = false, estado: Incidente["estado"] = "pendiente") {
  return { id, prioridad, estado, incertidumbre: { revisar } } as Incidente;
}

describe("cola", () => {
  const lista = [inc("a", "P1"), inc("b", "P3", true), inc("c", "P2", true, "aprobada"), inc("d", "P4")];

  it("los filtros no reordenan lo que manda la central", () => {
    expect(filtrar(lista, "urgentes").map((i) => i.id)).toEqual(["a", "c"]);
    expect(filtrar(lista, "resto").map((i) => i.id)).toEqual(["b", "d"]);
    expect(filtrar(lista, "revisar").map((i) => i.id)).toEqual(["b", "c"]);
  });

  it("ningún filtro hace desaparecer un incidente del total", () => {
    const n = conteos(lista);
    expect(n.todos).toBe(4);
    expect(n.urgentes + n.resto).toBe(n.todos);
  });

  it("cuenta solo lo pendiente como por decidir", () => expect(porDecidir(lista)).toBe(3));
});

describe("mensajeDecision", () => {
  it("explica el 422 de aprobar sin nota", () => expect(mensajeDecision(new ErrorApi(422, "x"))).toMatch(/nota/));
  it("explica el 409 sin propuesta", () => expect(mensajeDecision(new ErrorApi(409, "x"))).toMatch(/acción propuesta/));
  it("un fallo de red dice que no se registró", () => expect(mensajeDecision(new TypeError("fetch"))).toMatch(/no se registró/));
});

describe("haceCuanto", () => {
  it("minutos y horas", () => {
    expect(haceCuanto(0, 30)).toBe("ahora");
    expect(haceCuanto(0, 5 * 60)).toBe("hace 5 min");
    expect(haceCuanto(0, 130 * 60)).toBe("hace 2 h 10 min");
  });
});
