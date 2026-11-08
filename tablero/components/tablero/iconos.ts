// Un icono por tipo de incidente del contrato. Se usan en el mapa y en la cola, siempre junto al
// texto del tipo: el icono ayuda a reconocer, no reemplaza la palabra.
import { BrickWall, CircleAlert, Flame, HeartPulse, TrafficCone, UserRoundSearch, type LucideIcon } from "lucide-react"

import type { Tipo } from "@/lib/api/tipos"

export const ICONO_TIPO: Record<Tipo, LucideIcon> = {
  ATRAP: BrickWall,
  MEDIC: HeartPulse,
  FUEGO: Flame,
  VIA: TrafficCone,
  DESAP: UserRoundSearch,
  OTRO: CircleAlert,
}
