import type { CobroAliado } from './CobrosAliado';

/**
 * LO QUE EL API LE MANDA AL PORTAL (`GET /aliado`, provider-portal.controller).
 *
 * Separado del componente (rediseño 2026-10-27) porque ahora el portal son
 * varias pantallas (inicio, solicitudes, equipos, cobros, papeles, cuenta) y
 * todas leen de aquí.
 */

/** Lo que se le paga al aliado por un servicio. Ni el precio al cliente ni la comisión (2026-10-23). */
export type Pago = { monto: number; masIva: boolean };

/** Lo que pide el cliente, con las preguntas de su línea. */
export type Pedido = Array<{ label: string; valor: string }>;

/** Una oferta de trabajo que espera su respuesta. */
export interface Solicitud {
  assignmentId: number;
  quoteNumber: string;
  category: string | null;
  address: string | null;
  site: string | null;
  detail: string | null;
  requirements: string[];
  pedido?: Pedido;
  offeredAt: string;
  pago?: Pago | null;
  /** La cotización completa (2026-10-15): folio del documento. */
  documento?: string | null;
  /** Qué y cuánto, sin importes: esos son el precio al cliente (2026-10-23). */
  partidas?: Array<{ concepto: string; cantidad: string }>;
}

/** Un trabajo que ya es suyo y sigue corriendo. */
export interface Servicio {
  assignmentId?: number;
  quoteNumber: string;
  documento?: string | null;
  category: string | null;
  state: string | null;
  stateLabel?: string;
  progress?: number;
  committedAt?: string | null;
  pago?: Pago | null;
  site: string | null;
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
  requirements: string[];
  pedido?: Pedido;
  /** Quién maneja la unidad (2026-10-15). */
  operador?: { nombre: string; telefono: string | null } | null;
}

export interface Equipo {
  id: number;
  name: string;
  state: string;
  location: string | null;
  /** Hasta cuándo sigue ocupado (AAAA-MM-DD), si hoy no está libre. */
  hasta?: string | null;
  /** Su mantenimiento de hoy o el próximo (2026-10-26). */
  mantenimiento?: { id: number; desde: string; hasta: string | null; nota: string | null } | null;
}

/** Lo nuevo que ofreció (no estaba en la lista de tipos): MAQSER24 lo revisa. */
export interface Propuesta {
  id: number;
  name: string;
  brand: string | null;
  image: string | null;
  createdAt: string | null;
}

/** Un trabajo ya contestado: en qué quedó. */
export interface Reciente {
  quoteNumber: string;
  category: string | null;
  site: string | null;
  answer: string;
  reason: string | null;
  respondedAt: string | null;
  stateLabel: string;
  progress: number;
  pago?: Pago | null;
}

export interface Documentos {
  estado: string;
  avisos: Array<{ documentId: number; kind: string; name: string | null; expiresAt: string; texto: string; urgencia: string }>;
  diasAviso: number;
  lista: Array<{ id: number; kind: string; kindLabel: string; name: string | null; expiresAt: string | null }>;
  tipos: Array<{ clave: string; label: string }>;
  /** Los papeles obligatorios que le faltan, por nombre (2026-10-22). */
  faltan?: string[];
}

export interface Cumplimiento {
  resumen: string;
  ofrecidos: number;
  aceptados: number;
  completados: number;
  cancelados: number;
  minutosRespuestaReal: number | null;
  minutosRespuestaDeclarado: number | null;
  confiable: boolean;
}

export interface DatosPortal {
  aliado: {
    id: number;
    name: string;
    contactName: string | null;
    level: string;
    verified: boolean;
    docsStatus: string;
    coverage: string[];
    categories: string[];
    categoryLabels?: string[];
    joinedAt?: string | null;
    monthsInNetwork: number | null;
    phone: string | null;
    email: string | null;
    city: string | null;
    address: string | null;
    responseMinutes: number | null;
  };
  porContestar: Solicitud[];
  enCurso: Servicio[];
  equipos: Equipo[];
  /** Tipos que puede elegir al ofrecer un equipo, por línea (2026-10-22). */
  tipos?: Record<string, Array<{ id: number; nombre: string }>>;
  /** Lo que tiene por facturar y cuándo se le paga (2026-10-22). */
  cobros?: CobroAliado[];
  documentos: Documentos;
  propuestas?: Propuesta[];
  recientes?: Reciente[];
  cumplimiento: Cumplimiento;
}

/** Cómo contactar a MAQSER24 desde el portal (sale de Diseño → Contacto). */
export interface ContactoMaqser {
  phone: string | null;
  email: string | null;
  hours: string | null;
}

/** Las pantallas del portal. El orden es el del menú. */
export type Vista = 'inicio' | 'solicitudes' | 'equipos' | 'cobros' | 'papeles' | 'cuenta';
export const VISTAS: readonly Vista[] = ['inicio', 'solicitudes', 'equipos', 'cobros', 'papeles', 'cuenta'];
export const esVista = (v: unknown): v is Vista => typeof v === 'string' && (VISTAS as readonly string[]).includes(v);

/** Las tres listas de Solicitudes: lo que espera respuesta, lo que trae y lo que ya pasó. */
export type FiltroSolicitudes = 'pendientes' | 'curso' | 'historial';
export const FILTROS_SOLICITUDES: readonly FiltroSolicitudes[] = ['pendientes', 'curso', 'historial'];
export const esFiltro = (f: unknown): f is FiltroSolicitudes => typeof f === 'string' && (FILTROS_SOLICITUDES as readonly string[]).includes(f);

/**
 * Dónde está parado el aliado dentro del portal. Va en la URL (`?v=&f=&s=`)
 * para que el enlace de un correo abra la pantalla correcta, para que
 * "atrás" funcione, y para que al recargar no vuelva al inicio.
 */
export interface Ruta {
  vista: Vista;
  /** Solo en Solicitudes: qué lista. */
  filtro?: FiltroSolicitudes;
  /** Solo en Solicitudes: folio de la solicitud abierta. */
  seleccion?: string;
}

export function rutaDe(q: { v?: string | null; f?: string | null; s?: string | null }): Ruta {
  const vista: Vista = esVista(q.v) ? q.v : 'inicio';
  if (vista !== 'solicitudes') return { vista };
  return { vista, filtro: esFiltro(q.f) ? q.f : undefined, seleccion: q.s?.trim() || undefined };
}

export function urlDeRuta(r: Ruta): string {
  const q = new URLSearchParams();
  if (r.vista !== 'inicio') q.set('v', r.vista);
  if (r.vista === 'solicitudes') {
    if (r.filtro) q.set('f', r.filtro);
    if (r.seleccion) q.set('s', r.seleccion);
  }
  const s = q.toString();
  return s ? `/aliado?${s}` : '/aliado';
}
