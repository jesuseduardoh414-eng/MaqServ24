import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { BrandingEditor } from './BrandingEditor';

/** Identidad de marca: logos y favicon del tema activo. */
export default async function BrandingPage() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'diseno');
  const branding = (await adminFetch<Record<string, string | null>>('/admin/cms/branding')) ?? {};

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <BrandingEditor initial={branding} />
    </AdminShell>
  );
}
