import { redirect } from 'next/navigation';
import { getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { Pagos } from './Pagos';

/** PAGOS A ALIADOS — vista de diseño con datos de ejemplo (2026-10-09). Ver ../datos-ejemplo.ts. */
export default async function AdminPagos() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'administracion');
  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <Pagos />
    </AdminShell>
  );
}
