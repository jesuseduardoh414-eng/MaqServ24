import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { CategoriesManager, type CategoryRow } from './CategoriesManager';

/** Gestión de categorías: crear, editar, activar/desactivar y eliminar. */
export default async function AdminCategories() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'catalogo');
  const cats = (await adminFetch<CategoryRow[]>('/admin/catalog/categories')) ?? [];

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol}>
      <CategoriesManager initial={cats} />
    </AdminShell>
  );
}
