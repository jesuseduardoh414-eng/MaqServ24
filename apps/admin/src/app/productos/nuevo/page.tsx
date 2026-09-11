import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { ProductForm } from '@/components/ProductForm';

export default async function NewProductPage() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'catalogo');
  const categories = (await adminFetch<Array<{ id: number; name: string }>>('/admin/catalog/categories')) ?? [];

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol}>
      <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: '1.2rem' }}>Nuevo producto</h1>
      <ProductForm initial={{}} categories={categories} />
    </AdminShell>
  );
}
