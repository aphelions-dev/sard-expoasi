import { describe, expect, it } from "vitest";
import { ErrorApi, elegirActiva, mensajeDecision } from "./api/central";
import type { Incidente, Prioridad, Salud } from "./api/tipos";
import { agrupar, conteos, filtrar, porDecidir } from "./cola";
import { haceCuanto, lugarLegible } from "./formato";
import { citaLegible, enPalabras, motivoRechazo, palabraCompleta, senalLegible } from "./lenguaje";

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

describe("lugarLegible", () => {
  it("cambia el geohash por el barrio", () =>
    expect(lugarLegible("Enviar a Cruz Roja en la zona d2fkcd", "d2fkcd", "Centro")).toBe("Enviar a Cruz Roja en Centro"))
  it("sin barrio, remite al mapa en vez de mostrar el código", () =>
    expect(lugarLegible("Bomberos en la zona d2fkcd", "d2fkcd", null)).toBe("Bomberos en la zona marcada en el mapa"))
  it("sin geohash, deja el texto igual", () => expect(lugarLegible("ubicación sin confirmar", null, null)).toBe("ubicación sin confirmar"))
})

describe("enPalabras", () => {
  it("no nombra a Jev", () =>
    expect(enPalabras("Reporte 1: Jev subió la prioridad de P2 a P1")).toBe(
      "Reporte 1: el análisis automático subió la prioridad de P2 a P1: confirma que es así",
    ))
  it("traduce el riesgo dudoso sin números", () =>
    expect(enPalabras("riesgo vital dudoso (0.34)")).toBe("No está claro si hay riesgo para la vida"))
  it("dice qué no coincide con palabras", () =>
    expect(enPalabras("el celular dice MEDIC, Jev ve FUEGO")).toBe(
      "Quien reportó marcó «atención médica», pero el mensaje parece «incendio»",
    ))
  it("las señales salen en palabras", () => {
    expect(senalLegible("riesgo_vital")).toBe("riesgo para la vida")
    expect(senalLegible("palabra crítica «llamas»")).toBe("palabra de alerta «llamas»")
  })
})

describe("palabras del mensaje, no raíces de la lista", () => {
  it("completa la raíz con la palabra del mensaje", () => {
    expect(palabraCompleta("atrap", ["no hay carros atrapados"])).toBe("atrapados")
    expect(senalLegible("palabra crítica «atrap»", "Gente atrapda en el edificio")).toBe("palabra de alerta «atrapda»")
  })
  it("sin mensaje deja la raíz", () => expect(palabraCompleta("atrap", [])).toBe("atrap"))
  it("la cita no parte palabras", () =>
    expect(citaLegible("umbe, no hay carros atrapados", "bloqueada por un derrumbe, no hay carros atrapados")).toBe(
      "…derrumbe, no hay carros atrapados",
    ))
  it("la posible negación se explica con la palabra del mensaje", () =>
    expect(enPalabras("Reporte 1: posible negación de «atrap»: la prioridad no baja, confirmar si aplica", ["no hay carros atrapados"])).toBe(
      "Reporte 1: el mensaje podría estar diciendo que no hay «atrapados»: la prioridad sigue alta hasta que lo confirmes",
    ))
})

describe("motivoRechazo", () => {
  it("cortado", () => expect(motivoRechazo("truncado: 6 de 9 campos")).toBe("Llegó cortado: trae 6 de los 9 datos."))
  it("dato inválido sin nombres del protocolo", () => expect(motivoRechazo("geohash inválido: 'zz'")).toBe("Dato no válido (zona): 'zz'."))
})

describe("cola por estado", () => {
  const inc = (id: string, estado: Incidente["estado"], asignadas: string[] | null = null) =>
    ({ id, estado, recurso: asignadas === null ? null : { asignadas } }) as unknown as Incidente;
  it("separa por lo que falta hacer, sin reordenar dentro de cada sección", () => {
    const s = agrupar([
      inc("a", "aprobada", []), inc("b", "pendiente"), inc("c", "rechazada"),
      inc("d", "aprobada", ["CR-114"]), inc("e", "sin_propuesta"), inc("f", "aprobada"),
    ]);
    expect(s.map((x) => [x.grupo.id, x.incidentes.map((i) => i.id)])).toEqual([
      ["decidir", ["b", "e"]], ["esperando", ["a"]], ["atencion", ["d", "f"]], ["descartados", ["c"]],
    ]);
  });
  it("«Por decidir» aparece aunque esté vacía; las demás, solo si tienen algo", () =>
    expect(agrupar([]).map((x) => x.grupo.id)).toEqual(["decidir"]));
});
