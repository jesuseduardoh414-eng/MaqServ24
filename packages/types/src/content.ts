/**
 * DTOs de contenido de la home / CMS ligero (F1).
 * Igual que en catalog: la API traduce el legacy a estas formas limpias.
 */

export interface HomeHero {
  badge: string | null;
  title: string | null;
  subtitle: string | null;
  feature1: string | null;
  feature2: string | null;
  image: string | null;
}

export interface StrategicSector {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  image: string | null;
  /** Video en bucle (2026-11-16): si hay, va en lugar de la imagen, que queda de portada. */
  video: string | null;
}

/** Un renglón de «Servicios incluidos» (igual que ParteListaSector de @maqserv/config). */
export type ParteListaSectorDTO =
  | { tipo: 'grupo'; texto: string }
  | { tipo: 'nota'; texto: string }
  | { tipo: 'item'; nombre: string; detalle: string | null };

/** Un apartado de la página del sector (igual que BloqueSector de @maqserv/config). */
export interface BloqueSectorDTO {
  clave: 'sobre' | 'trayectoria' | 'esencia' | 'servicios' | 'excelencia';
  /** null = el título de siempre. */
  titulo: string | null;
  destacado: string | null;
  html: string | null;
}

export interface StrategicSectorDetail extends StrategicSector {
  trayectoria: string | null;
  esencia: string | null;
  servicios: string | null;
  excelencia: string | null;
  serviciosLista: string[];
  /** Frase corta de la tarjeta y del encabezado (2026-11-16). */
  frase: string | null;
  /** Los cinco apartados de texto, en orden, ya en HTML limpio. */
  bloques: BloqueSectorDTO[];
  /** «Servicios incluidos»: título, frase destacada y sus renglones. */
  lista: { titulo: string | null; destacado: string | null; partes: ParteListaSectorDTO[] };
}

export interface WhyChooseUsItem {
  id: number;
  title: string;
  description: string;
  icon: string | null;
  photo: string | null;
  /** Dónde se muestra: 'both' (default) | 'home' (solo landing) | 'about' (solo /quienes-somos). */
  placement: 'both' | 'home' | 'about';
}

export interface BlogCard {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  image: string | null;
  date: string | null; // ISO
  category: string; // p. ej. "Guías" (por defecto "General")
  author: string | null; // byline (campo `source`), null si vacío
  readTime: string; // calculado del contenido, p. ej. "6 MIN"
  views: number; // para el ranking "Lo más leído"
}

export interface BlogDetail extends BlogCard {
  contentHtml: string;
  metaTitle: string | null;
  metaDescription: string | null;
}

export interface FaqItem {
  id: number;
  question: string;
  answer: string;
}

export interface SiteReview {
  id: number;
  rating: number; // 1..5
  review: string;
  author: string;
  date: string | null;
  /** Producto reseñado (reseñas ligadas a compra); null en reseñas legacy. */
  product?: string | null;
}
