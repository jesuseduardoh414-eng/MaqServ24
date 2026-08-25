import { redirect } from 'next/navigation';
import { adminFetch, getAdmin } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { ProvidersManager, type ProviderRow } from './ProvidersManager';

/**
 * RED DE ALIADOS (documento institucional, sección 15).
 *
 * Aquí se dan de alta los proveedores y se lleva su expediente. Lo que NO hay
 * —y es a propósito— es un botón de "marcar como verificado": el sello se
 * calcula del nivel más la vigencia de los documentos.
 */
export default async function AdminProveedores() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  const provs = (await adminFetch<ProviderRow[]>('/admin/providers')) ?? [];

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email}>
      <ProvidersManager initial={provs} />
    </AdminShell>
  );
}
