import { redirect } from 'next/navigation';
import { adminFetch, getAdmin } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { AgendaView, type Agenda } from './AgendaView';

/**
 * AGENDA (documento institucional, sección 17 · Módulo Operaciones).
 *
 * "Asignaciones, estatus, agenda, incidencias y cierre." Era el único de los
 * cinco que faltaba: el tablero de Servicios dice qué está pasando, no qué
 * viene, y sin eso no se ve un choque de fechas antes de comprometerse.
 */
export default async function AdminAgenda({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; semanas?: string }>;
}) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  const sp = await searchParams;

  const qs = new URLSearchParams();
  if (sp.desde) qs.set('desde', sp.desde);
  if (sp.semanas) qs.set('semanas', sp.semanas);

  const agenda = await adminFetch<Agenda>(`/admin/agenda${qs.size ? `?${qs}` : ''}`);

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email}>
      <AgendaView agenda={agenda} filtros={{ desde: sp.desde ?? '', semanas: sp.semanas ?? '2' }} />
    </AdminShell>
  );
}
