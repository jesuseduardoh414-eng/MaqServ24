import { notFound, redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { BlogForm, type BlogFormData } from '../../BlogForm';

export default async function EditBlogPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'diseno');
  const { id } = await params;
  const blog = await adminFetch<BlogFormData>(`/admin/cms/blogs/${id}`);
  if (!blog) notFound();

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol}>
      <BlogForm initial={blog} />
    </AdminShell>
  );
}
