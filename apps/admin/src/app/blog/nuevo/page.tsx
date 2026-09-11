import { redirect } from 'next/navigation';
import { getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { BlogForm } from '../BlogForm';

export default async function NewBlogPage() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'diseno');
  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol}>
      <BlogForm initial={{}} />
    </AdminShell>
  );
}
