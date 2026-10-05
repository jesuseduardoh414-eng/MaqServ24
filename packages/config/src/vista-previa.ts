import type { ThemeTokens } from './schema';

/**
 * VISTA PREVIA REAL DEL PANEL (2026-10-05).
 *
 * Las vistas previas de Diseño eran dibujos hechos a mano dentro del panel y
 * se desfasaban del sitio cada vez que se rediseñaba una sección. Ahora el
 * panel carga `/vista-previa` del sitio en un iframe y le manda por
 * `postMessage` los cambios SIN publicar; el sitio pinta el componente real
 * (el mismo que usa el home) con esos cambios encima del tema publicado.
 *
 * Este archivo es el contrato entre las dos apps: qué se puede previsualizar y
 * qué viaja en cada mensaje.
 */

/** Lo que se puede previsualizar: secciones del home, páginas y el pie. */
export const VISTAS_PREVIA = [
  'home.hero',
  'home.categories',
  'home.featured-products',
  'home.why-choose-us',
  'home.strategic-sectors',
  'home.offer',
  'home.reviews',
  'home.faq',
  'home.brands',
  'pagina.categorias',
  'pagina.catalogo',
  'pagina.quienes-somos',
  'sitio.footer',
] as const;
export type VistaPrevia = (typeof VISTAS_PREVIA)[number];

/** Texto e imagen del hero: viven en su tabla, no en el tema. */
export interface HeroVistaPrevia {
  badge: string | null;
  title: string | null;
  subtitle: string | null;
  image: string | null;
}

/** Una razón de «¿Por qué elegirnos?», con la forma que usa el sitio. */
export interface RazonVistaPrevia {
  id: number;
  title: string;
  description: string;
  icon: string | null;
  photo: string | null;
  placement: 'both' | 'home' | 'about';
}

/** Contenido de la página /quienes-somos (tabla `inf_sitio`). */
export interface InfSitioVistaPrevia {
  frase: string | null;
  titulo: string | null;
  descripcion: string | null;
  mision: string | null;
  vision: string | null;
  objetivos: string | null;
  imagenes: string[];
}

/** Cambios sin publicar que el panel manda al sitio. */
export interface BorradorVistaPrevia {
  vista: VistaPrevia;
  /** Modo de color con el que se pinta (el sitio tiene claro y oscuro). */
  modo: 'light' | 'dark';
  /** Tokens del tema que cambian; se ponen ENCIMA del tema publicado. */
  tokens?: Partial<ThemeTokens>;
  /** Copys en español que cambian (`home.hero.title` → texto). */
  copys?: Record<string, string>;
  /** Datos que no viven en el tema. */
  datos?: {
    hero?: HeroVistaPrevia | null;
    razones?: RazonVistaPrevia[];
    infSitio?: InfSitioVistaPrevia | null;
  };
}

/** Tipos de mensaje entre el panel (padre) y el sitio (iframe). */
export const MENSAJE_VISTA_PREVIA = {
  /** Sitio → panel: el iframe cargó y ya escucha. */
  lista: 'maqser-vp:lista',
  /** Sitio → panel: alto del contenido pintado, en px. */
  alto: 'maqser-vp:alto',
  /** Panel → sitio: pinta con este borrador. */
  borrador: 'maqser-vp:borrador',
} as const;
