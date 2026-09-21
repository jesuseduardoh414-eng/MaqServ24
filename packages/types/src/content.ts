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
}

export interface StrategicSectorDetail extends StrategicSector {
  trayectoria: string | null;
  esencia: string | null;
  servicios: string | null;
  excelencia: string | null;
  serviciosLista: string[];
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
