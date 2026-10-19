import { kmCarretera, normalizarNombre } from '@maqserv/config';

/**
 * MAPA Y COBERTURA — tipos y reglas de la pantalla (2026-10-14).
 *
 * Los datos los arma la API (admin-cobertura.controller.ts); aquí está cómo
 * se leen: qué línea es cada slug, y si un aliado llega a un municipio.
 */

/** El slug de la categoría: maquinaria-pesada, triturados… */
export type LineaId = string;
export const LINEAS: Record<string, { nombre: string; corto: string }> = {
  'maquinaria-pesada': { nombre: 'Renta de maquinaria pesada', corto: 'Maquinaria' },
  'transporte-y-servicios-de-obra': { nombre: 'Transporte y servicios de obra', corto: 'Transporte' },
  triturados: { nombre: 'Triturados', corto: 'Triturados' },
  'materiales-para-construccion': { nombre: 'Materiales para construcción', corto: 'Materiales' },
  'soluciones-asfalticas': { nombre: 'Soluciones asfálticas', corto: 'Asfalto' },
};
/** El orden del menú y del documento institucional. */
export const ORDEN_LINEAS: readonly LineaId[] = Object.keys(LINEAS);

export type MunicipioId = string;
export interface Municipio { id: MunicipioId; nombre: string; estado: string; lat: number; lng: number }

export interface Aliado {
  id: number;
  nombre: string;
  /** Para las celdas angostas. */
  corto: string;
  /** Municipio de su base; null si no se reconoció. */
  municipio: MunicipioId | null;
  /** Su patio o bodega. Null: no está ubicado (cuenta solo por su lista). */
  lat: number | null;
  lng: number | null;
  lineas: LineaId[];
  /** Los municipios que declaró, ya reconocidos. */
  municipios: MunicipioId[];
  /** Lo que escribió, normalizado, para lo que no está en la tabla de cabeceras. */
  municipiosTexto: string[];
  /** Km por carretera hasta donde llega. Null sin ubicación. */
  radioKm: number | null;
  /** Demasiado lejos para el mapa (se cuenta igual en las tablas). */
  fuera: boolean;
}

export interface Obra { id: string; nombre: string; cliente: string; municipio: MunicipioId; lat: number | null; lng: number | null }

export interface Solicitud {
  folio: string;
  fecha: string;
  obra: string;
  linea: LineaId;
  detalle: string;
  /** Quién la atendió. Null: sin aliado. */
  aliado: number | null;
  /** cubierta: con aliado · pendiente: se está trabajando · perdida: se canceló o venció. */
  estado: 'cubierta' | 'pendiente' | 'perdida';
  nota?: string;
}

export interface DatosCobertura {
  hoy: string;
  desde: string;
  municipios: Municipio[];
  aliados: Aliado[];
  obras: Obra[];
  solicitudes: Solicitud[];
  fueraDelMapa: Array<{ nombre: string; plaza: string }>;
  /** Aliados activos sin ubicar. */
  sinUbicar: number;
  /** Solicitudes cuyo lugar no se reconoció como municipio. */
  sinUbicacion: number;
  /** Solicitudes sin línea de servicio (no entran a la cobertura). */
  sinLinea: number;
}

/**
 * ¿Llega el aliado a este municipio? La misma regla que el emparejamiento: su
 * lista manda, y si no, que la cabecera quede dentro de su radio por carretera.
 */
export function alcance(a: Aliado, m: Municipio): { llega: boolean; km: number | null; como: 'lista' | 'distancia' } {
  const n = normalizarNombre(m.nombre);
  const enLista = a.municipios.includes(m.id) || a.municipiosTexto.some((t) => t === n || n.includes(t) || t.includes(n));
  const km = a.lat != null && a.lng != null ? kmCarretera({ lat: a.lat, lng: a.lng }, m) : null;
  return { llega: enLista || (km != null && a.radioKm != null && km <= a.radioKm), km, como: enLista ? 'lista' : 'distancia' };
}

const dia = (iso: string) => new Date(`${iso}T12:00:00`);
export const fechaCorta = (iso: string) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(dia(iso)).replace('.', '');
/** Km redondeados: un decimal no cambia ninguna decisión en esta pantalla. */
export const kmTexto = (km: number | null) => (km == null ? 'sin ubicar' : `${Math.round(km)} km`);
