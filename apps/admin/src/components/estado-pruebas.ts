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

/**
 * La ronda que se está probando ahora. 0 = las pruebas generales del
 * 2026-10-22 todavía no empiezan: TODO se pinta de rojo ("falta probar").
 */
// 2026-10-28: la revisión por módulos terminó (26 de 26) y el dueño pidió
// quitar los colores del menú. `null` apaga las marcas y la leyenda; la tabla
// de abajo se queda como registro de qué se revisó y cuándo.
export const RONDA_ACTUAL: number | null = null;

/**
 * En qué ronda se prueba cada pantalla, por su ruta (también vale para sus
 * subrutas). 'diseno': vista con datos de ejemplo, no se prueba. 'probado':
 * ya se probó por fuera de su ronda.
 *
 * PRUEBAS GENERALES (2026-10-22): todo desde cero, en el orden en que corre un
 * trabajo por el sistema.
 *
 * REVISIÓN POR MÓDULOS (desde el 2026-10-23): se recorre el menú en su orden
 * con el dueño. Lo revisado se marca 'probado' aquí mismo; el módulo en el que
 * se está, 'probando'. Lo demás sigue con su número de ronda y sale "falta".
 *   1 Accesos y ajustes            5 Un servicio de punta a punta
 *   2 Catálogo y red de aliados    6 Cobrar, pagar y margen
 *   3 Cotizar                      7 Medir (Inicio e Indicadores)
 *   4 Lo que llega del sitio       8 Sitio web, y repaso por rol
 */
const RONDA: Record<string, number | 'diseno' | 'probado' | 'probando'> = {
  // 1 · Accesos y ajustes
  '/admins': 'probado', // revisión por módulos, 2026-10-28 (Equipo del panel: invitación por correo)
  '/correo': 'probado', // revisión por módulos, 2026-10-28 (diseño y textos editables)
  '/zonas': 'probado', // revisión por módulos, 2026-10-28 (con mapa)
  '/cotizador/tarifas': 'probado', // revisión por módulos, 2026-10-28 (por pestañas)
  '/categorias': 'probado', // revisión por módulos, 2026-10-28 (categorías nuevas de aliados)
  // 2 · Catálogo y red de aliados
  '/catalogo': 'probado', // revisión por módulos, 2026-10-28 (Inventario con servicios y productos)
  '/productos': 'probado', // (redirige a /catalogo/servicios)
  '/proveedores': 'probado', // revisión por módulos, 2026-10-28 (invitar, mapa, nada se publica)
  '/disponibilidad': 'probado', // revisión por módulos, 2026-10-26
  // 3 · Cotizar
  '/cotizador': 'probado', // revisión por módulos, 2026-10-26
  '/cotizador/maquinaria': 'probado', // revisión por módulos, 2026-10-26
  '/cotizador/triturados': 'probado', // revisión por módulos, 2026-10-26
  '/cotizador/historial': 'probado', // revisión por módulos, 2026-10-26
  // 4 · Lo que llega del sitio
  '/cotizaciones': 'probado', // revisión por módulos, 2026-10-26
  '/mensajes': 'probado', // revisión por módulos, 2026-10-26
  '/usuarios': 'probado', // revisión por módulos, 2026-10-26
  '/clientes': 'probado', // revisión por módulos, 2026-10-26
  // 5 · Un servicio de punta a punta
  '/servicios': 'probado', // revisión por módulos, 2026-10-26
  '/agenda': 'probado', // revisión por módulos, 2026-10-26
  // 6 · Cobrar, pagar y margen
  '/administracion': 'probado', // revisión por módulos, 2026-10-27 (Cobros y pagos en una sola lista)
  // 7 · Medir
  '/': 'probado', // revisión por módulos, 2026-10-26
  '/indicadores': 'probado', // revisión por módulos, 2026-10-27 («¿Cómo va el negocio?»)
  // 8 · Sitio web (y al final, el repaso por rol)
  '/diseno': 'probado', // ya revisado por el dueño antes (2026-10-28: "no necesita nada")
  '/blog': 'probado',
  '/temas': 'probado',
  '/resenas': 'probado',
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
  if (ronda === 'probando') return { estado: 'probando', titulo: 'Probando ahora' };
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

/** Cuántas pantallas del mapa ya se probaron, para la leyenda del menú. */
export function avancePruebas(): { probadas: number; total: number } {
  const v = Object.values(RONDA).filter((r) => r !== 'diseno');
  const hecha = (r: (typeof v)[number]) => r === 'probado' || (typeof r === 'number' && RONDA_ACTUAL !== null && r < RONDA_ACTUAL);
  return { probadas: v.filter(hecha).length, total: v.length };
}

/** Atributos para el enlace o botón del menú. */
export function atributosPrueba(m: MarcaPrueba | null, label: string): { 'data-prueba'?: EstadoPrueba; title?: string } {
  return m ? { 'data-prueba': m.estado, title: `${label} · ${m.titulo}` } : {};
}
