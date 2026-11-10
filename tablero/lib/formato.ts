// Textos en español para lo que la API entrega como códigos.
import geohash from "ngeohash";
import type { Corroboracion, Estado, Fuente, Tipo } from "./api/tipos";

export const TIPO: Record<Tipo, string> = {
  ATRAP: "Personas atrapadas",
  MEDIC: "Atención médica",
  FUEGO: "Incendio",
  DESLIZ: "Deslizamiento",
  INUND: "Inundación",
  GAS: "Fuga de gas",
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
  directa: "Lo vio en persona",
  de_oidas: "Lo supo por otros",
  incierta: "No está claro si lo vio",
};

/** Quién cuenta lo que pasó, también cuando el análisis automático no pudo saberlo. */
export const fuenteLegible = (f: Fuente | null) => (f ? FUENTE[f] : "No se sabe si lo vio");

export const ESTADO: Record<Estado, string> = {
  sin_propuesta: "Sin sugerencia",
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

/** "hace 5 min", "hace 2 h 10 min". `ahora` en segundos unix. */
/** Minutos en palabras de la sala: «45 min», «2 h 5 min», «30 h». Pasada la hora, los minutos sueltos
 *  sobran cuando ya son muchas horas. */
export function duracion(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto && h < 6 ? `${h} h ${resto} min` : `${h} h`;
}

export function haceCuanto(horaUnix: number, ahora: number): string {
  const min = Math.max(0, Math.floor((ahora - horaUnix) / 60));
  return min < 1 ? "ahora" : `hace ${duracion(min)}`;
}

export function horaLocal(horaUnix: number): string {
  return new Date(horaUnix * 1000).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

/** Cuánto se puede alejar el sitio real del centro de la zona, según el largo del geohash
 *  (protocolo, «Ubicación»): de 6 caracteres (~1,2 × 0,6 km) a 9 (~5 m). */
export function precision(gh: string): string {
  return ({ 6: "±600 m", 7: "±75 m", 8: "±20 m" } as Record<number, string>)[gh.length] ?? "±3 m";
}

/** Centro de la zona de un geohash. */
export function coordenadas(gh: string): string {
  const { latitude, longitude } = geohash.decode(gh);
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

/** La central nombra los lugares por su geohash ("en la zona d2fkcd"), que al coordinador no le dice
 *  nada: se cambia por el barrio. Sin barrio (fuera de Manizales, o mapas sin cargar) se remite al
 *  mapa, que sí muestra la zona; el código queda en el detalle técnico. */
export function lugarLegible(texto: string, gh: string | null, barrio: string | null): string {
  if (!gh) return texto
  const nombre = barrio ?? "la zona marcada en el mapa"
  return texto.replaceAll(`la zona ${gh}`, nombre).replaceAll(gh, nombre)
}
