// Un icono por tipo de incidente del contrato, de Tabler: tiene símbolos de emergencia que lucide no
// (botiquín, vía cortada, salvavidas de rescate). Van siempre junto al texto del tipo: el icono
// ayuda a reconocer, no reemplaza la palabra.
import {
  IconAlertCircle,
  IconFirstAidKit,
  IconFlame,
  IconLifebuoy,
  IconMountain,
  IconRipple,
  IconRoadOff,
  IconUserSearch,
  IconWind,
  type Icon,
} from "@tabler/icons-react"

import type { Tipo } from "@/lib/api/tipos"

export const ICONO_TIPO: Record<Tipo, Icon> = {
  ATRAP: IconLifebuoy,
  MEDIC: IconFirstAidKit,
  FUEGO: IconFlame,
  DESLIZ: IconMountain,
  INUND: IconRipple,
  GAS: IconWind,
  VIA: IconRoadOff,
  DESAP: IconUserSearch,
  OTRO: IconAlertCircle,
}
