import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { ProductForm } from '@/components/ProductForm';

/**
 * Alta de producto. Con `?proveedor=<id>` (el botón "Agregar equipo" del
 * expediente del aliado) la ficha nace ya a nombre de ese aliado.
 */
export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ proveedor?: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'catalogo');
  const sp = await searchParams;
  const [categories, providers] = await Promise.all([
    adminFetch<Array<{ id: number; name: string }>>('/admin/catalog/categories').then((c) => c ?? []),
    adminFetch<Array<{ id: number; name: string; level?: string }>>('/admin/catalog/providers').then((p) => p ?? []),
  ]);
  const pid = Number(sp.proveedor);
  const proveedor = Number.isInteger(pid) ? providers.find((p) => p.id === pid) : undefined;

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: proveedor ? '.4rem' : '1.2rem' }}>Nuevo producto</h1>
      {proveedor ? (
        <p style={{ margin: '0 0 1.2rem', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          Equipo de <strong style={{ color: 'var(--color-text)' }}>{proveedor.name}</strong>. Llena tipo, marca, ficha técnica y fotos.
        </p>
      ) : null}
      <ProductForm initial={proveedor ? { providerId: proveedor.id } : {}} categories={categories} providers={providers} />
    </AdminShell>
  );
}
