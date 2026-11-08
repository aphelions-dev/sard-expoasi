import { describe, expect, it } from "vitest";
import type { Incidente, Recurso } from "./api/tipos";
import { CATALOGO, candidatos, filas } from "./recursos";

const registro = (entidad: string, recurso: string, disponibles: number, abiertas: string[] = []): Recurso => ({
  entidad, recurso, disponibles, asignadas: 0, no_disponibles: 0, solicitudes_abiertas: abiertas, unidades: [],
});

const inc = (id: string, estado: Incidente["estado"], entidad = "Cruz Roja", recurso = "ambulancia") =>
  ({ id, estado, recurso: { entidad, recurso } }) as Incidente;

describe("filas de recursos", () => {
  it("muestra todo el catálogo del contrato aunque no haya unidades registradas", () => {
    const f = filas([]);
    expect(f).toHaveLength(CATALOGO.length);
    expect(f.every((x) => x.registro === null && x.faltan === 0)).toBe(true);
  });

  it("falta lo que las solicitudes abiertas piden por encima de lo disponible", () => {
    const amb = filas([registro("Cruz Roja", "ambulancia", 1, ["inc-a", "inc-b", "inc-c"])]).find((x) => x.recurso === "ambulancia")!;
    expect(amb.faltan).toBe(2);
  });

  it("no esconde un recurso registrado que no está en el catálogo", () => {
    expect(filas([registro("Ejército", "helicóptero", 1)]).at(-1)).toMatchObject({ entidad: "Ejército", recurso: "helicóptero" });
  });
});

describe("candidatos para asignar", () => {
  it("pone primero las solicitudes abiertas y deja fuera lo rechazado y otros recursos", () => {
    const f = filas([registro("Cruz Roja", "ambulancia", 1, ["inc-b"])]).find((x) => x.recurso === "ambulancia")!;
    const lista = [inc("inc-a", "pendiente"), inc("inc-b", "aprobada"), inc("inc-c", "rechazada"), inc("inc-d", "pendiente", "Bomberos", "equipo de rescate")];
    expect(candidatos(f, lista).map((i) => i.id)).toEqual(["inc-b", "inc-a"]);
  });
});
