import type { ProviderBadge } from './providers';
import type { Availability } from './availability';

/**
 * DTOs del catálogo (Fase 1). La API traduce el esquema legacy
 * (cprice, cat_name, fotos como filename…) a estas formas limpias;
 * el frontend NUNCA ve nombres de columnas del Laravel viejo.
 */

export interface ProductCard {
  id: number;
  slug: string;
  name: string;
  brand: string | null;
  /** Precio de venta actual (legacy cprice). Null si no aplica. */
  price: number | null;
  /** Precio anterior/tachado (legacy pprice). */
  oldPrice: number | null;
  image: string | null;
  isRental: boolean;
  /**
   * Unidad en la que esta el precio: mes, dia, viaje, tonelada...
   * Null = venta por pieza. Antes todo se pintaba "/mes", que era falso para
   * pipas, volteos y triturados.
   */
  priceUnit: string | null;
  featured: boolean;
  inStock: boolean;
  /**
   * Existencias. `null` = el producto no lleva control de stock.
   *
   * Se expone además de `inStock` porque el manual (21 / ESTADOS DE
   * DISPONIBILIDAD) pide cuatro estados —disponible, limitada, por confirmar y
   * no disponible— y un booleano solo distingue dos. Ver `lib/availability.ts`
   * en la web, que es donde se traduce.
   */
  stock: number | null;
  /**
   * Aliado que suministra el equipo, con su sello de confianza ya resuelto.
   * Null si todavía no se le asignó proveedor. Lo pide el manual en la sección
   * 20 (tarjeta de equipo) y en la 22 (proveedores y confianza).
   */
  provider: ProviderBadge | null;
  /**
   * Estado de disponibilidad ya resuelto por la API: bloqueos por fecha,
   * frescura del dato y existencias. Ver seccion 21 del documento.
   */
  availability: Availability | null;
  categorySlug: string | null;
}

export interface MedicalInfo {
  lote: string | null;
  caducidad: string | null; // ISO date
  fichaTecnica: string | null; // URL del PDF
  certificacionDc3: string | null;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface ProductDetail extends ProductCard {
  description: string;
  /** Resumen corto (columna legacy `Corto`); null si vacío. */
  short: string | null;
  /** Ficha técnica: pares etiqueta/valor. */
  specs: ProductSpec[];
  gallery: string[];
  medical: MedicalInfo;
  rentalFreight: number | null;
  youtube: string | null;
  tags: string[];
  categoryName: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  views: number;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  image: string | null;
  productCount: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export interface SiteSettings {
  email: string | null;
  phone: string | null;
  logo: string | null;
}
