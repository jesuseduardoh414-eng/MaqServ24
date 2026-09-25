/**
 * SERVICIOS Y PRODUCTOS (decisión del cliente, 2026-09-25).
 *
 * "Ahorita todo lo que es MAQSER24 es para servicios, pero vamos a dejar
 * también el apartado para productos."
 *
 * Un SERVICIO es lo que se cotiza: se renta, se ejecuta o se surte con
 * traslado, y el precio final sale del cotizador (fechas, obra, aliado). Las
 * cinco líneas de MAQSER24 son servicios. Un PRODUCTO es otra cosa que se
 * vende a precio fijo y va al carrito; hoy no hay ninguno, y por eso el sitio
 * no enseña la sección hasta que exista uno.
 *
 * La regla vive en la categoría, no en cada ficha: una ficha es servicio si
 * su categoría es una de las líneas de servicio; cualquier otra categoría
 * activa es de productos. Así no hace falta columna nueva ni SQL, y una
 * categoría de productos creada mañana desde el panel ya cae del lado
 * correcto.
 */

export const LINEAS_SERVICIO = [
  'maquinaria-pesada',
  'transporte-y-servicios-de-obra',
  'triturados',
  'materiales-para-construccion',
  'soluciones-asfalticas',
] as const;

export type TipoCatalogo = 'servicio' | 'producto';

export function esLineaServicio(slug: string | null | undefined): boolean {
  return !!slug && (LINEAS_SERVICIO as readonly string[]).includes(slug);
}

export function tipoDeCatalogo(slug: string | null | undefined): TipoCatalogo {
  return esLineaServicio(slug) ? 'servicio' : 'producto';
}

/** Listado público de ese tipo: /servicios o /productos. */
export function rutaDeCatalogo(tipo: TipoCatalogo): '/servicios' | '/productos' {
  return tipo === 'servicio' ? '/servicios' : '/productos';
}

/** Ficha pública de un elemento del catálogo. */
export function rutaDeFicha(tipo: TipoCatalogo, slug: string): string {
  return `${rutaDeCatalogo(tipo)}/${slug}`;
}

/** Panel: dónde se gestiona cada tipo. */
export function rutaPanelDeCatalogo(tipo: TipoCatalogo): '/catalogo/servicios' | '/catalogo/productos' {
  return tipo === 'servicio' ? '/catalogo/servicios' : '/catalogo/productos';
}
