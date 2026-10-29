import { TIPOS_ALIADO, esLineaServicio, ofertaDe, tiposDeAliado } from '@maqserv/config';
import type { DatosPortal } from './tipos';

/**
 * QUÉ TIPO DE PROVEEDOR ES (documento, sección 14; 2026-10-08): rentadora,
 * de servicios o de materiales, según sus líneas. Cambia cómo se le habla
 * ("tus equipos", "tus unidades", "tus materiales") y le recuerda qué le
 * ofrece MAQSER24 a alguien como él. Lo usan el menú, Inicio, Equipos y Mi
 * cuenta, por eso vive aparte.
 */
export interface Oferta {
  /** 'equipos', 'unidades', 'materiales'… en minúsculas, para frases. */
  oferta: string;
  /** Para el menú: 'Equipos', 'Unidades', 'Materiales' o 'Tu oferta' si mezcla. */
  ofertaCorta: string;
  /** Título de la pantalla de equipos. */
  tituloEquipos: string;
  /** 'servicios y productos' | 'productos' | 'servicios'. */
  queOfrece: string;
  botonOfrecer: string;
  ofreceServicios: boolean;
  ofreceProductos: boolean;
  /** Las líneas que puede elegir al ofrecer algo. */
  lineasOferta: Array<{ slug: string; label: string }>;
  /** Nombres de sus líneas, para el perfil. */
  lineas: string[];
  /** Qué es (rentadora, de servicios…) y qué le ofrece MAQSER24 a alguien así. */
  tipos: Array<{ clave: string; nombre: string; ofrece: string }>;
}

export function ofertaDeAliado(aliado: DatosPortal['aliado']): Oferta {
  const lineasOferta = aliado.categories.map((slug, i) => ({ slug, label: aliado.categoryLabels?.[i] ?? slug }));
  const lineas = aliado.categoryLabels?.length ? aliado.categoryLabels : aliado.categories;
  // Lo que MAQSER24 le habilitó al darlo de alta: servicios, productos o ambos.
  const ofreceServicios = aliado.categories.some((c) => esLineaServicio(c));
  const ofreceProductos = aliado.categories.some((c) => !esLineaServicio(c));
  const queOfrece = ofreceServicios && ofreceProductos ? 'servicios y productos' : ofreceProductos ? 'productos' : 'servicios';
  const botonOfrecer = ofreceServicios && ofreceProductos ? 'Ofrecer servicio o producto' : ofreceProductos ? 'Ofrecer un producto' : 'Ofrecer un servicio';
  const claves = tiposDeAliado(aliado.categories);
  const oferta = ofertaDe(claves);
  // Para el menú: una palabra. Si mezcla tipos y entre ellos hay equipos, "Equipos" se entiende mejor que "Tu oferta".
  const ofertaCorta = claves.length === 1 ? oferta.charAt(0).toUpperCase() + oferta.slice(1) : oferta.includes('equipos') ? 'Equipos' : 'Tu oferta';
  const tituloEquipos = ofreceProductos && !ofreceServicios ? 'Tus productos' : ofreceProductos ? 'Tus servicios y productos' : `Tus ${oferta}`;
  return {
    oferta,
    ofertaCorta,
    tituloEquipos,
    queOfrece,
    botonOfrecer,
    ofreceServicios,
    ofreceProductos,
    lineasOferta,
    lineas,
    tipos: claves.map((t) => ({ clave: t, nombre: TIPOS_ALIADO[t].nombre, ofrece: TIPOS_ALIADO[t].ofrece })),
  };
}
