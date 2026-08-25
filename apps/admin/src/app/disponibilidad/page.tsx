import { redirect } from 'next/navigation';
import { adminFetch, getAdmin } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { AvailabilityManager, type EquipoRow } from './AvailabilityManager';

/**
 * DISPONIBILIDAD (documento institucional, 21).
 *
 * Es la pantalla donde se ejerce el control que pide el documento contra el dato
 * viejo: confirmar periódicamente, ubicar el equipo y bloquearlo cuando no se
 * puede asignar. Mientras no exista el acceso del proveedor, esto lo hace
 * operaciones.
 */
export default async function AdminDisponibilidad() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  const equipos = (await adminFetch<EquipoRow[]>('/admin/availability')) ?? [];

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email}>
      <AvailabilityManager initial={equipos} />
    </AdminShell>
  );
}
