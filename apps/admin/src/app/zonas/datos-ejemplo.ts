/**
 * DATOS DE EJEMPLO — Zonas (diseño, 2026-10-09).
 *
 * "Construye solo el diseño, aún no te metas con funcionalidades: dame diseño
 * ya con datos de cómo se vería." Nada de esto sale de la base: cinco zonas,
 * los municipios que las forman y los seis aliados del resto del panel con la
 * lista de municipios que cada uno dice cubrir. Con eso la pantalla calcula
 * cobertura y huecos igual que lo haría con datos reales.
 *
 * Las coordenadas son las cabeceras municipales de `cobertura.ts` (@maqserv/
 * config), redondeadas. Fletes, recargos, tiempos y solicitudes son inventados.
 *
 * Cuando se apruebe el diseño, esto se sustituye por la API de zonas.
 */

/** "Hoy" fijo: las fechas se leen igual sin importar el día. */
export const HOY = '2026-10-09';

export type Entidad = 'Nuevo León' | 'Coahuila' | 'Chihuahua';

export interface Municipio { nombre: string; entidad: Entidad; lat: number; lng: number }

/**
 * Catálogo de municipios con su punto en el mapa. Trae los de las cinco zonas
 * y algunos más que todavía no están en ninguna, para que el campo "Agregar
 * municipio" del editor tenga qué sugerir.
 */
export const MUNICIPIOS: Municipio[] = [
  // Monterrey metropolitano
  { nombre: 'Monterrey', entidad: 'Nuevo León', lat: 25.680, lng: -100.315 },
  { nombre: 'San Nicolás', entidad: 'Nuevo León', lat: 25.756, lng: -100.290 },
  { nombre: 'Guadalupe', entidad: 'Nuevo León', lat: 25.675, lng: -100.215 },
  { nombre: 'San Pedro', entidad: 'Nuevo León', lat: 25.665, lng: -100.402 },
  { nombre: 'Apodaca', entidad: 'Nuevo León', lat: 25.782, lng: -100.189 },
  { nombre: 'Escobedo', entidad: 'Nuevo León', lat: 25.809, lng: -100.322 },
  { nombre: 'Santa Catarina', entidad: 'Nuevo León', lat: 25.675, lng: -100.462 },
  { nombre: 'Juárez', entidad: 'Nuevo León', lat: 25.647, lng: -100.091 },
  // Periferia norte
  { nombre: 'García', entidad: 'Nuevo León', lat: 25.812, lng: -100.593 },
  { nombre: 'Salinas Victoria', entidad: 'Nuevo León', lat: 25.963, lng: -100.292 },
  { nombre: 'Ciénega de Flores', entidad: 'Nuevo León', lat: 25.956, lng: -100.166 },
  { nombre: 'Pesquería', entidad: 'Nuevo León', lat: 25.747, lng: -100.005 },
  { nombre: 'General Zuazua', entidad: 'Nuevo León', lat: 25.895, lng: -100.108 },
  // Periferia sur
  { nombre: 'Santiago', entidad: 'Nuevo León', lat: 25.424, lng: -100.151 },
  { nombre: 'Cadereyta Jiménez', entidad: 'Nuevo León', lat: 25.588, lng: -100.001 },
  { nombre: 'Allende', entidad: 'Nuevo León', lat: 25.280, lng: -100.020 },
  { nombre: 'Montemorelos', entidad: 'Nuevo León', lat: 25.189, lng: -99.829 },
  // Saltillo–Ramos Arizpe
  { nombre: 'Saltillo', entidad: 'Coahuila', lat: 25.423, lng: -100.993 },
  { nombre: 'Ramos Arizpe', entidad: 'Coahuila', lat: 25.541, lng: -100.947 },
  { nombre: 'Arteaga', entidad: 'Coahuila', lat: 25.450, lng: -100.852 },
  // Chihuahua capital
  { nombre: 'Chihuahua', entidad: 'Chihuahua', lat: 28.637, lng: -106.077 },
  { nombre: 'Aldama', entidad: 'Chihuahua', lat: 28.838, lng: -105.916 },
  { nombre: 'Aquiles Serdán', entidad: 'Chihuahua', lat: 28.595, lng: -105.887 },
  // Todavía en ninguna zona
  { nombre: 'El Carmen', entidad: 'Nuevo León', lat: 25.937, lng: -100.361 },
  { nombre: 'Marín', entidad: 'Nuevo León', lat: 25.879, lng: -100.031 },
  { nombre: 'Hidalgo', entidad: 'Nuevo León', lat: 25.974, lng: -100.451 },
  { nombre: 'Abasolo', entidad: 'Nuevo León', lat: 25.946, lng: -100.396 },
  { nombre: 'Linares', entidad: 'Nuevo León', lat: 24.860, lng: -99.568 },
  { nombre: 'General Cepeda', entidad: 'Coahuila', lat: 25.379, lng: -101.476 },
  { nombre: 'Delicias', entidad: 'Chihuahua', lat: 28.191, lng: -105.470 },
];

/* ── Aliados ──────────────────────────────────────────────────────────── */

export interface Aliado {
  id: number;
  nombre: string;
  /** Municipio donde tiene su base. */
  base: string;
  lineas: string;
  lat: number;
  lng: number;
  /** Los municipios que el aliado dice cubrir (su expediente). */
  municipios: string[];
  /** Hasta dónde llega: la distancia a su municipio más lejano, redondeada hacia arriba. */
  radioKm: number;
}

const ALIADOS_BASE: Array<Omit<Aliado, 'radioKm'>> = [
  {
    id: 1, nombre: 'Rentadora Cerro de la Silla', base: 'Apodaca', lineas: 'Maquinaria', lat: 25.782, lng: -100.189,
    municipios: ['Apodaca', 'Monterrey', 'San Nicolás', 'Guadalupe', 'Escobedo', 'Juárez', 'Pesquería', 'Ciénega de Flores'],
  },
  {
    id: 2, nombre: 'Maquinaria Pesada del Norte', base: 'Escobedo', lineas: 'Maquinaria', lat: 25.809, lng: -100.322,
    municipios: ['Escobedo', 'Monterrey', 'San Nicolás', 'Apodaca', 'García', 'Salinas Victoria', 'Ciénega de Flores', 'Santa Catarina', 'San Pedro'],
  },
  {
    id: 3, nombre: 'Fletes y Pavimentos Regios', base: 'Guadalupe', lineas: 'Pipas, volteos y asfalto', lat: 25.675, lng: -100.215,
    municipios: ['Guadalupe', 'Monterrey', 'San Nicolás', 'San Pedro', 'Apodaca', 'Juárez', 'Santa Catarina', 'Cadereyta Jiménez', 'Santiago'],
  },
  {
    id: 4, nombre: 'Pétreos del Poniente', base: 'Santa Catarina', lineas: 'Triturados y materiales', lat: 25.675, lng: -100.462,
    municipios: ['Santa Catarina', 'San Pedro', 'Monterrey', 'García', 'Escobedo', 'San Nicolás', 'Guadalupe'],
  },
  {
    id: 5, nombre: 'Ferretería Industrial del Norte', base: 'Saltillo', lineas: 'Materiales', lat: 25.423, lng: -100.993,
    municipios: ['Saltillo', 'Ramos Arizpe', 'Arteaga'],
  },
  {
    id: 6, nombre: 'Agregados y Asfaltos de Chihuahua', base: 'Chihuahua', lineas: 'Triturados y asfalto', lat: 28.637, lng: -106.077,
    municipios: ['Chihuahua', 'Aldama'],
  },
];

/* ── Zonas ────────────────────────────────────────────────────────────── */

/**
 * - sitio: se anuncia en el sitio público y se cotiza.
 * - interna: se cotiza a quien la pida (WhatsApp, clientes de siempre), pero
 *   el sitio no la anuncia. Es lo que hoy pasa con Coahuila y Chihuahua.
 * - pausada: no se toman solicitudes nuevas.
 */
export type EstadoZona = 'sitio' | 'interna' | 'pausada';

export interface Zona {
  id: string;
  nombre: string;
  estado: EstadoZona;
  municipios: string[];
  /** Pesos por viaje de volteo 14 m³ puesto en obra, sin IVA. */
  fleteViaje: number;
  /** Porcentaje que se suma a renta y flete de maquinaria. */
  recargoMaquinaria: number;
  /** Horas de la solicitud a la primera propuesta. */
  respuestaObjetivo: number;
  /** Mediana real de los últimos 90 días, en horas. */
  respuestaReal: number;
  solicitudes90: number;
  actualizada: string;
  actualizadaPor: string;
  /** Por qué está como está, cuando no es obvio. */
  nota?: string;
}

export const ZONAS: Zona[] = [
  {
    id: 'mty-metro', nombre: 'Monterrey metropolitano', estado: 'sitio',
    municipios: ['Monterrey', 'San Nicolás', 'Guadalupe', 'San Pedro', 'Apodaca', 'Escobedo', 'Santa Catarina', 'Juárez'],
    fleteViaje: 2200, recargoMaquinaria: 0, respuestaObjetivo: 2, respuestaReal: 1.6, solicitudes90: 214,
    actualizada: '2026-10-02', actualizadaPor: 'Ana Treviño',
  },
  {
    id: 'periferia-norte', nombre: 'Periferia norte', estado: 'sitio',
    municipios: ['García', 'Salinas Victoria', 'Ciénega de Flores', 'Pesquería', 'General Zuazua'],
    fleteViaje: 3400, recargoMaquinaria: 5, respuestaObjetivo: 4, respuestaReal: 3.5, solicitudes90: 47,
    actualizada: '2026-09-26', actualizadaPor: 'Ana Treviño',
  },
  {
    id: 'periferia-sur', nombre: 'Periferia sur', estado: 'sitio',
    municipios: ['Santiago', 'Cadereyta Jiménez', 'Allende', 'Montemorelos'],
    fleteViaje: 3800, recargoMaquinaria: 10, respuestaObjetivo: 8, respuestaReal: 9.5, solicitudes90: 18,
    actualizada: '2026-09-26', actualizadaPor: 'Luis Garza',
  },
  {
    id: 'saltillo-ramos', nombre: 'Saltillo–Ramos Arizpe', estado: 'interna',
    municipios: ['Saltillo', 'Ramos Arizpe', 'Arteaga'],
    fleteViaje: 2500, recargoMaquinaria: 8, respuestaObjetivo: 12, respuestaReal: 6, solicitudes90: 9,
    actualizada: '2026-09-29', actualizadaPor: 'Luis Garza',
    nota: 'Se cotiza a quien la pide por WhatsApp. Se anuncia cuando el cliente active el norte en el sitio.',
  },
  {
    id: 'chihuahua-capital', nombre: 'Chihuahua capital', estado: 'pausada',
    municipios: ['Chihuahua', 'Aldama', 'Aquiles Serdán'],
    fleteViaje: 2400, recargoMaquinaria: 15, respuestaObjetivo: 24, respuestaReal: 31, solicitudes90: 3,
    actualizada: '2026-09-18', actualizadaPor: 'Ana Treviño',
    nota: 'Pausada el 18 sep: el único aliado no tiene volteos libres hasta noviembre.',
  },
];

/* ── Utilidades ───────────────────────────────────────────────────────── */

const R_TIERRA = 6371;
/** Kilómetros en línea recta entre dos puntos (haversine). */
export function kmEntre(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_TIERRA * Math.asin(Math.sqrt(h));
}

export const municipioDe = (nombre: string) => MUNICIPIOS.find((m) => m.nombre === nombre) ?? null;

/** El radio sale de su lista, como en el expediente real del aliado. */
export const ALIADOS: Aliado[] = ALIADOS_BASE.map((a) => ({
  ...a,
  radioKm: Math.ceil(Math.max(5, ...a.municipios.map((n) => { const m = municipioDe(n); return m ? kmEntre(a, m) : 0; }))),
}));

/** "Nuevo León", o "Nuevo León y Coahuila" si la zona cruza estados. */
export function entidadesDe(municipios: readonly string[]): string {
  const e = [...new Set(municipios.map((n) => municipioDe(n)?.entidad).filter(Boolean))] as string[];
  return e.length === 0 ? 'Sin municipios' : e.length === 1 ? e[0] : `${e.slice(0, -1).join(', ')} y ${e[e.length - 1]}`;
}

export const aliadosDeMunicipio = (nombre: string) => ALIADOS.filter((a) => a.municipios.includes(nombre));

/** Aliados con al menos un municipio de la lista. */
export const aliadosQueCubren = (municipios: readonly string[]) =>
  ALIADOS.filter((a) => a.municipios.some((m) => municipios.includes(m)));

export const sinAliado = (municipios: readonly string[]) => municipios.filter((m) => aliadosDeMunicipio(m).length === 0);

export const dinero = (n: number) => `$${Math.round(n).toLocaleString('es-MX')}`;
export const horas = (n: number) => `${n.toLocaleString('es-MX', { maximumFractionDigits: 1 })} h`;
const dia = (iso: string) => new Date(`${iso}T12:00:00`);
export const fechaCorta = (iso: string) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(dia(iso)).replace('.', '');
/** Sin acentos ni mayúsculas: "pesqueria" encuentra "Pesquería". */
export const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
