import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { EmptyState, Panel } from '@/components/ui';
import { Zonas, type SaludZona, type Zona } from './Zonas';

/** ZONAS (2026-10-22, Fase B): datos reales; ver apps/api/src/common/zonas.ts. */
export default async function AdminZonas() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'configuracion');
  const d = await adminFetch<{ zonas: Zona[]; salud: SaludZona[]; sugerencias: string[] }>('/admin/zonas');
  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      {d ? <Zonas zonas={d.zonas} salud={d.salud} sugerencias={d.sugerencias} /> : <Panel><EmptyState icon="ph-warning" title="No se pudieron cargar las zonas" sub="Recarga la página en unos segundos." /></Panel>}
    </AdminShell>
  );
}
