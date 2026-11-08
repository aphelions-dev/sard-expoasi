// Textos en español para lo que la API entrega como códigos.
import geohash from "ngeohash";
import type { Corroboracion, Estado, Fuente, Tipo } from "./api/tipos";

export const TIPO: Record<Tipo, string> = {
  ATRAP: "Personas atrapadas",
  MEDIC: "Atención médica",
  FUEGO: "Incendio",
  VIA: "Vía afectada",
  DESAP: "Persona desaparecida",
  OTRO: "Otro",
};

export const CORROBORACION: Record<Corroboracion, string> = {
  corroborado: "Corroborado",
  sin_confirmar: "Sin confirmar",
  posible_rumor: "Posible rumor",
};

export const FUENTE: Record<Fuente, string> = {
  directa: "Testigo directo",
  de_oidas: "De oídas",
  incierta: "Fuente incierta",
};

export const ESTADO: Record<Estado, string> = {
  sin_propuesta: "Sin sugerencia",
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

/** "hace 5 min", "hace 2 h 10 min". `ahora` en segundos unix. */
export function haceCuanto(horaUnix: number, ahora: number): string {
  const min = Math.max(0, Math.floor((ahora - horaUnix) / 60));
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `hace ${h} h ${resto} min` : `hace ${h} h`;
}

export function horaLocal(horaUnix: number): string {
  return new Date(horaUnix * 1000).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

/** Centro aproximado de un geohash de 6 caracteres (±0,6 km). */
export function coordenadas(gh: string): string {
  const { latitude, longitude } = geohash.decode(gh);
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

/** La central nombra los lugares por su geohash ("en la zona d2fkcd"), que al coordinador no le dice
 *  nada: se cambia por el barrio. Sin barrio (fuera de Manizales, o mapas sin cargar) el texto queda
 *  como vino: el geohash es la única ubicación y no se borra. */
export function lugarLegible(texto: string, gh: string | null, barrio: string | null): string {
  if (!gh || !barrio) return texto
  return texto.replaceAll(`la zona ${gh}`, barrio).replaceAll(gh, barrio)
}
