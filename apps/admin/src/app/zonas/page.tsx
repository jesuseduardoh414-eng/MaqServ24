import { redirect } from 'next/navigation';
import { getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { Zonas } from './Zonas';

/** ZONAS — vista de diseño con datos de ejemplo (2026-10-09). Ver ./datos-ejemplo.ts. */
export default async function AdminZonas() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'configuracion');
  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <Zonas />
    </AdminShell>
  );
}
