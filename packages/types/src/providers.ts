/**
 * RED DE ALIADOS.
 *
 * Modelo tomado del documento institucional, sección 15 (Red de aliados y
 * proveedores) y sección 23 (Confianza, documentación y control).
 */

/**
 * Los cuatro niveles que nombra el documento. El orden importa: es una
 * escalera, no una lista de etiquetas sueltas.
 *
 *  registrado — dado de alta, sin verificar nada todavía
 *  validado   — expediente revisado y vigente
 *  activo     — validado y trabajando con la plataforma
 *  preferente — activo con buen historial de cumplimiento
 */
export type ProviderLevel = 'registrado' | 'validado' | 'activo' | 'preferente';

/** Tipos de documento del expediente ("fiscal, legal, técnica y de seguridad"). */
export type ProviderDocumentKind = 'fiscal' | 'legal' | 'seguro' | 'tecnico' | 'seguridad' | 'otro';

export interface ProviderDocument {
  id: number;
  kind: ProviderDocumentKind;
  name: string | null;
  file: string | null;
  issuedAt: string | null;
  /** Null = no vence. */
  expiresAt: string | null;
}

/**
 * Estado del expediente. Se calcula, no se guarda: un papel válido hoy deja de
 * serlo dentro de un mes sin que nadie toque la base de datos, y el documento
 * advierte justamente de eso — no se puede tratar como verificado un expediente
 * desactualizado.
 */
export type DocsStatus = 'al-dia' | 'por-vencer' | 'vencido' | 'sin-documentos';

export interface Provider {
  id: number;
  name: string;
  slug: string;
  level: ProviderLevel;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  /** Municipios que atiende de verdad. */
  coverage: string[];
  /** Slugs de las líneas de servicio que cubre. */
  categories: string[];
  /** Minutos promedio en responder. Null mientras no haya historial. */
  responseMinutes: number | null;
  /** Fecha de alta en la red, en ISO. Alimenta el "N meses en red" del manual. */
  joinedAt: string | null;
  active: boolean;
}

/** Lo que la ficha pública necesita para pintar el sello de confianza. */
export interface ProviderBadge {
  name: string;
  slug: string;
  level: ProviderLevel;
  /** Verificado = nivel al menos 'validado' Y expediente sin vencidos. */
  verified: boolean;
  docsStatus: DocsStatus;
  coverage: string[];
  responseMinutes: number | null;
  /** Meses completos en la red. */
  monthsInNetwork: number | null;
}
