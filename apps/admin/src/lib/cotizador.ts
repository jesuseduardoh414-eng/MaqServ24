import {
  CATALOGO_MAQUINARIA_DEFAULT,
  CATALOGO_TRITURADOS_DEFAULT,
  categoriaConPrecio,
  COTIZADORES_SITIO,
  productosALaMedida,
  type CatalogoMaquinaria,
  type CatalogoTriturados,
  type Tabuladores,
} from '@maqserv/config';
import type { ProductoALaMedida } from '@maqserv/ui';
import { adminFetch } from './admin';

/**
 * LO QUE NECESITA EL COTIZADOR DEL PANEL Y DEL ENLACE (2026-11-03): los dos
 * tabuladores (una cotización lleva cualquier categoría) y los productos de
 * las categorías que todavía no tienen precio de lista, para cotizarlos con
 * precio a mano. Sin API se cotiza con los de fábrica: el guardado igual lo
 * recalcula en el servidor.
 */
export async function cargarCotizador(): Promise<{ tabuladores: Tabuladores; productos: Record<string, ProductoALaMedida[]> }> {
  const [maquinaria, triturados] = await Promise.all([
    adminFetch<CatalogoMaquinaria>('/admin/quoter/catalog/maquinaria'),
    adminFetch<CatalogoTriturados>('/admin/quoter/catalog/triturados'),
  ]);
  const tabuladores: Tabuladores = {
    maquinaria: maquinaria ?? CATALOGO_MAQUINARIA_DEFAULT,
    triturados: triturados ?? CATALOGO_TRITURADOS_DEFAULT,
  };
  const sinPrecio = COTIZADORES_SITIO.filter((c) => !categoriaConPrecio(tabuladores, c.clave));
  const productos = Object.fromEntries(
    await Promise.all(
      sinPrecio.map(async (c) => {
        const r = await adminFetch<{ items: Array<{ id: number; name: string; priceUnit: string | null }> }>(`/catalog/products?category=${encodeURIComponent(c.linea)}`);
        // Con sus presentaciones, si su ficha ya las tiene (el block, 2026-11-06).
        return [c.clave, productosALaMedida(tabuladores, r?.items ?? [])] as const;
      }),
    ),
  );
  return { tabuladores, productos };
}
