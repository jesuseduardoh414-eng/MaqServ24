import { redirect } from 'next/navigation';
import type { TipoCatalogo } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { ProductsManager, type ProductRow } from './ProductsManager';

interface Paged { total: number; page: number; pages: number; items: ProductRow[] }

/**
 * GESTIÓN DEL CATÁLOGO, por tipo (2026-09-25). La comparten /catalogo/servicios
 * y /catalogo/productos: es la misma tabla `products`, filtrada por si la
 * categoría es una línea de servicio o no (ver `tipoDeCatalogo`). Hoy todo son
 * servicios; "Productos" queda listo para lo que se venda a precio fijo.
 */
export async function PaginaCatalogoAdmin({ tipo }: { tipo: TipoCatalogo }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'catalogo');

  // Todo el catálogo en UNA consulta (pageSize alto); el gestor pagina en cliente.
  // Catálogo y categorías en PARALELO.
  const [first, catsRaw] = await Promise.all([
    adminFetch<Paged>('/admin/catalog/products?page=1&pageSize=500'),
    adminFetch<Array<{ id: number; name: string; slug: string }>>('/admin/catalog/categories'),
  ]);
  let items = first?.items ?? [];
  const pages = first?.pages ?? 1;
  for (let p = 2; p <= pages; p++) {
    const next = await adminFetch<Paged>(`/admin/catalog/products?page=${p}&pageSize=500`);
    if (next?.items) items = items.concat(next.items);
  }
  const seen = new Set<number>();
  items = items.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
  const cats = catsRaw ?? [];

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <ProductsManager
        initial={items}
        tipo={tipo}
        // El slug decide el tipo y qué unidades de precio se ofrecen (viaje, tonelada, mes…).
        categories={cats.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))}
      />
    </AdminShell>
  );
}
