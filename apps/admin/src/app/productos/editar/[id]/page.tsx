import { notFound, redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { ProductForm, type ProductFormData } from '@/components/ProductForm';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'catalogo');
  const { id } = await params;
  const [product, categories, providers] = await Promise.all([
    adminFetch<ProductFormData>(`/admin/catalog/products/${id}`),
    adminFetch<Array<{ id: number; name: string }>>('/admin/catalog/categories'),
    adminFetch<Array<{ id: number; name: string; level?: string }>>('/admin/catalog/providers'),
  ]);
  if (!product) notFound();

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: '1.2rem' }}>Editar: {product.name}</h1>
      <ProductForm initial={product} categories={categories ?? []} providers={providers ?? []} />
    </AdminShell>
  );
}
