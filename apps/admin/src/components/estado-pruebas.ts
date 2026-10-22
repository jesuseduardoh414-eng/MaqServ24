/**
 * MARCAS DE LAS PRUEBAS GENERALES EN EL MENÚ (solo en local, 2026-10-19).
 *
 * Mientras se recorre el panel ronda por ronda, el menú pinta cada pantalla
 * según cómo va: verde lo ya probado, ámbar lo de la ronda en curso y rojo lo
 * que falta. Solo con `pnpm dev`: en el build de producción NODE_ENV es
 * "production", la condición queda en falso y el menú se ve como siempre.
 *
 * Para avanzar basta con subir RONDA_ACTUAL; `null` apaga las marcas.
 */

export type EstadoPrueba = 'probado' | 'probando' | 'falta' | 'diseno';

/** La ronda que se está probando ahora. */
export const RONDA_ACTUAL: number | null = 8;

/**
 * En qué ronda se prueba cada pantalla, por su ruta (también vale para sus
 * subrutas). 'diseno': vista con datos de ejemplo, no se prueba. 'probado':
 * ya se probó por fuera de su ronda (el sitio web, 2026-10-19).
 *
 *   1 Usuarios, roles y permisos       5 Red de aliados
 *   2 Lo que llega del sitio            6 Un servicio de punta a punta
 *   3 Catálogo                          7 Medir y ajustar (Inicio, sitio web…)
 *   4 Cotizar                           8 Repaso por rol (no tiene pantalla propia)
 */
const RONDA: Record<string, number | 'diseno' | 'probado'> = {
  '/admins': 1,
  '/admins/permisos': 1,
  '/mensajes': 2,
  '/usuarios': 2,
  '/categorias': 3,
  // Cambiaron con la Fase 1 (el precio vive en la ficha, 2026-10-19): se vuelven a probar.
  '/catalogo': 5,
  '/productos': 5,
  '/disponibilidad': 3,
  '/cotizador/tarifas': 5,
  '/cotizaciones': 4,
  '/cotizador/maquinaria': 4,
  '/cotizador/triturados': 4,
  '/cotizador/historial': 4,
  '/clientes': 4,
  '/proveedores': 5,
  '/cobertura': 5,
  '/servicios': 6,
  '/agenda': 6,
  '/': 7,
  '/indicadores': 7,
  '/correo': 7,
  // Todo lo de Sitio web, incluida "Aprobar reseñas".
  '/diseno': 'probado',
  '/blog': 'probado',
  '/temas': 'probado',
  '/resenas': 'probado',
  // Cobranza, Pagos y Margen funcionan desde el 2026-10-22 (Fase A).
  '/administracion': 7,
  // Zonas funciona desde el 2026-10-22 (Fase B).
  '/zonas': 7,
};

export const MARCAR_PRUEBAS = process.env.NODE_ENV === 'development' && RONDA_ACTUAL !== null;

export interface MarcaPrueba {
  estado: EstadoPrueba;
  /** Texto para el `title` del enlace. */
  titulo: string;
}

const TITULO: Record<EstadoPrueba, (r: number | null) => string> = {
  probado: (r) => `Ya probado (Ronda ${r})`,
  probando: (r) => `Probando ahora (Ronda ${r})`,
  falta: (r) => `Falta probar (Ronda ${r})`,
  diseno: () => 'Solo diseño: no se prueba',
};

export function marcaPrueba(href: string): MarcaPrueba | null {
  if (!MARCAR_PRUEBAS || RONDA_ACTUAL === null) return null;
  // La ruta más larga que la contiene: /admins/permisos antes que /admins.
  const clave = Object.keys(RONDA)
    .filter((k) => href === k || (k !== '/' && href.startsWith(`${k}/`)))
    .sort((a, b) => b.length - a.length)[0];
  if (!clave) return null;
  const ronda = RONDA[clave];
  if (ronda === 'diseno') return { estado: 'diseno', titulo: TITULO.diseno(null) };
  if (ronda === 'probado') return { estado: 'probado', titulo: 'Ya probado' };
  const estado: EstadoPrueba = ronda < RONDA_ACTUAL ? 'probado' : ronda === RONDA_ACTUAL ? 'probando' : 'falta';
  return { estado, titulo: TITULO[estado](ronda) };
}

/**
 * Un módulo plegado con varias pantallas: ámbar si alguna se está probando,
 * rojo si alguna falta, verde solo si ya se probaron todas.
 */
export function marcaDeVarias(hrefs: string[]): MarcaPrueba | null {
  const marcas = hrefs.map(marcaPrueba).filter((m): m is MarcaPrueba => m !== null && m.estado !== 'diseno');
  if (!MARCAR_PRUEBAS) return null;
  if (marcas.length === 0) return hrefs.length ? { estado: 'diseno', titulo: TITULO.diseno(null) } : null;
  const estado: EstadoPrueba = marcas.some((m) => m.estado === 'probando')
    ? 'probando'
    : marcas.some((m) => m.estado === 'falta') ? 'falta' : 'probado';
  const titulo = estado === 'probado' ? 'Ya se probó todo' : estado === 'probando' ? 'Se está probando una parte' : 'Falta probar una parte';
  return { estado, titulo };
}

/** Atributos para el enlace o botón del menú. */
export function atributosPrueba(m: MarcaPrueba | null, label: string): { 'data-prueba'?: EstadoPrueba; title?: string } {
  return m ? { 'data-prueba': m.estado, title: `${label} · ${m.titulo}` } : {};
}
