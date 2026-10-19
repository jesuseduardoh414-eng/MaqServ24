import { redirect } from 'next/navigation';
import { getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { Margen } from './Margen';

/** MARGEN Y CONCILIACIÓN — vista de diseño con datos de ejemplo (2026-10-09). Ver ../datos-ejemplo.ts. */
export default async function AdminMargen() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'administracion');
  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <Margen />
    </AdminShell>
  );
}
