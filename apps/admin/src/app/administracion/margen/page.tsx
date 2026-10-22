import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { EmptyState, Panel } from '@/components/ui';
import { Margen, type DatosMargen } from './Margen';

/** MARGEN (2026-10-22, Fase A): datos reales de money/ en la API. */
export default async function AdminMargen({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'administracion');
  const mes = (await searchParams).mes;
  const d = await adminFetch<DatosMargen>(`/admin/dinero/margen${mes && /^\d{4}-\d{2}$/.test(mes) ? `?mes=${mes}` : ''}`);
  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      {d ? <Margen d={d} /> : <Panel><EmptyState icon="ph-warning" title="No se pudo cargar el margen" sub="Recarga la página en unos segundos." /></Panel>}
    </AdminShell>
  );
}
