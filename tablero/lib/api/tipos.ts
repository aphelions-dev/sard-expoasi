// Tipos de `contracts/api-central.md`. Si el contrato cambia, se cambia aquí y en ningún otro lado.

export type Prioridad = "P1" | "P2" | "P3" | "P4";
export type Tipo = "ATRAP" | "MEDIC" | "FUEGO" | "VIA" | "DESAP" | "OTRO";
export type Estado = "sin_propuesta" | "pendiente" | "aprobada" | "rechazada";
export type Corroboracion = "corroborado" | "sin_confirmar" | "posible_rumor";
export type Fuente = "directa" | "de_oidas" | "incierta";

export interface Senal {
  senal: string;
  origen: "formulario" | "texto" | "jev";
  prioridad: Prioridad;
  cita: string | null;
  probabilidad: number | null;
}

export interface Evidencia {
  reporte_id: string;
  texto: string;
  tipo: Tipo;
  personas: number;
  hora_unix: number;
  prioridad: Prioridad;
  fuente: Fuente | null;
  vinculo: "nuevo" | "mismo";
  similitud: number | null;
  rutas: number;
  senales: Senal[];
}

export interface Incertidumbre {
  revisar: boolean;
  motivos: string[];
  corroboracion: Corroboracion;
  dispositivos: number;
  fuentes_directas: number;
  contradicciones: Record<string, unknown>[];
  posibles_mismo_incidente: Record<string, unknown>[];
  discrepancias_entre_centrales: { reporte_id: string; prioridades: Prioridad[] }[];
  sin_ubicacion: boolean;
  sin_analisis_ia: boolean;
}

export interface AccionPropuesta {
  id: string;
  entidad: string;
  recurso: string | null;
  accion: string;
  prioridad: Prioridad;
  personas_estimadas: number;
  justificacion: string;
  falta_confirmar: string[];
  requiere_aprobacion: boolean;
}

export interface Decision {
  accion_id: string;
  decision: "aprobar" | "rechazar";
  coordinador: string;
  nota: string;
}

export interface Incidente {
  id: string;
  prioridad: Prioridad;
  tipo: Tipo;
  geohash: string | null;
  hora_unix: number;
  reportes: string[];
  evidencia: Evidencia[];
  incertidumbre: Incertidumbre;
  impacto: { personas: number; vulnerables: boolean };
  vigencia: { ultimo_reporte_unix: number; minutos_sin_noticias: number; sin_noticias_recientes: boolean };
  motivo_orden: string;
  recurso: { recurso: string; entidad: string; disponibles: number | null; compiten: string[] } | null;
  estado: Estado;
  accion_propuesta: AccionPropuesta | null;
  decision: Decision | null;
}

export interface Salud {
  estado: "ok";
  central: "A" | "B";
  jev: "ok" | "caido";
}

export interface Recurso {
  entidad: string;
  recurso: string;
  declarados: number;
  comprometidos: number;
  disponibles: number;
  coordinador: string;
  declarado_en: number;
}

export interface Rechazado {
  reporte_id: string | null;
  motivos: string[];
  campos: Record<string, string>;
  pasarela_id: string | null;
  recibido_en: number;
  recuperado: boolean;
}
