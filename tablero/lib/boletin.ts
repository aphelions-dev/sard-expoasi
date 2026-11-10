// Boletín de situación: un borrador de texto con lo que la central tiene en este momento, para que
// el coordinador lo revise, lo corrija y lo envíe. Es una plantilla: no redacta ni interpreta nada,
// solo cuenta lo que hay en los incidentes.
import type { Incidente, Prioridad } from "./api/tipos";
import { TIPO } from "./formato";
import type { Barrio } from "./geo";
import { nombreComuna } from "./zonas";

const PRIORIDADES: Prioridad[] = ["P1", "P2", "P3", "P4"];
const MAX_BARRIOS = 10;

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const porDecidir = (i: Incidente) => i.estado === "pendiente" || i.estado === "sin_propuesta";

function porPrioridad(lista: Incidente[]): string {
  return PRIORIDADES.map((p) => [p, lista.filter((i) => i.prioridad === p).length] as const)
    .filter(([, n]) => n > 0)
    .map(([p, n]) => `${n} ${p}`)
    .join(" · ");
}

export interface Corte {
  /** Fecha y hora del corte, ya escritas. */
  cuando: string;
  /** Quién lo elabora; vacío si nadie se ha identificado. */
  quien: string;
}

export function boletin(incidentes: Incidente[], barrio: (gh: string | null) => Barrio | null, corte: Corte): string {
  const pendientes = incidentes.filter(porDecidir);
  const aprobados = incidentes.filter((i) => i.estado === "aprobada");
  const rechazados = incidentes.filter((i) => i.estado === "rechazada");
  const lineas: string[] = [
    "BOLETÍN DE SITUACIÓN",
    `Corte: ${corte.cuando} · Elaboró: ${corte.quien || "(sin identificar)"}`,
    "Borrador generado por SARD con reportes ciudadanos sin verificar en terreno.",
    "",
    "RESUMEN",
  ];

  if (incidentes.length === 0) {
    lineas.push("Sin incidentes registrados.");
    return lineas.join("\n");
  }

  lineas.push(
    `${plural(incidentes.length, "incidente", "incidentes")}: ${porPrioridad(incidentes)}`,
    `${pendientes.length} por decidir · ${plural(aprobados.length, "aprobado", "aprobados")} · ${plural(rechazados.length, "descartado", "descartados")}`,
  );
  const viejos = pendientes.filter((i) => i.vigencia.sin_noticias_recientes).length;
  const revisar = pendientes.filter((i) => i.incertidumbre.revisar).length;
  const sinUbicacion = incidentes.filter((i) => !i.geohash).length;
  const notas = [
    viejos > 0 && `${viejos} por decidir llevan más de una hora sin noticias`,
    revisar > 0 && `${revisar} por decidir están marcados para revisar`,
    sinUbicacion > 0 && `${sinUbicacion} no tienen ubicación`,
  ].filter(Boolean);
  if (notas.length) lineas.push(`${notas.join("; ")}.`);

  // Por barrio, primero los que tienen más por decidir.
  const zonas = new Map<string, { nombre: string; lista: Incidente[] }>();
  for (const i of incidentes) {
    const b = barrio(i.geohash);
    if (!b) continue;
    const z = zonas.get(b.id) ?? { nombre: `${b.nombre} (${nombreComuna(b.comuna)})`, lista: [] };
    z.lista.push(i);
    zonas.set(b.id, z);
  }
  const ordenadas = [...zonas.values()].sort(
    (a, b) => b.lista.filter(porDecidir).length - a.lista.filter(porDecidir).length || b.lista.length - a.lista.length,
  );
  if (ordenadas.length) {
    lineas.push("", "POR BARRIO");
    for (const z of ordenadas.slice(0, MAX_BARRIOS)) {
      lineas.push(`- ${z.nombre}: ${porPrioridad(z.lista)} · ${z.lista.filter(porDecidir).length} por decidir`);
    }
    if (ordenadas.length > MAX_BARRIOS) lineas.push(`- y ${plural(ordenadas.length - MAX_BARRIOS, "barrio", "barrios")} más`);
  }

  lineas.push("", "ACCIONES APROBADAS");
  if (aprobados.length === 0) lineas.push("Ninguna todavía.");
  for (const i of aprobados) {
    const a = i.accion_propuesta;
    const donde = barrio(i.geohash)?.nombre ?? (i.geohash ? "fuera de los barrios del mapa" : "sin ubicación");
    const personas = plural(i.impacto.personas, "persona", "personas");
    const destino = a ? `${a.entidad}${a.recurso ? ` (${a.recurso})` : ""}` : "sin entidad";
    lineas.push(`- ${i.prioridad} ${TIPO[i.tipo]} en ${donde}, ${personas}: ${destino}. Aprobó ${i.decision?.coordinador ?? "—"}.`);
  }

  // Lo que se le ha pedido a cada entidad: una solicitud por acción aprobada con recurso.
  const pedidos = new Map<string, number>();
  for (const i of aprobados) {
    const a = i.accion_propuesta;
    if (a?.recurso) pedidos.set(`${a.entidad}: ${a.recurso}`, (pedidos.get(`${a.entidad}: ${a.recurso}`) ?? 0) + 1);
  }
  if (pedidos.size) {
    lineas.push("", "SOLICITADO A CADA ENTIDAD");
    for (const [que, n] of [...pedidos].sort()) lineas.push(`- ${que} × ${n}`);
  }

  return lineas.join("\n");
}
