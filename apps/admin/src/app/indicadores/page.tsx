import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { AnalyticsBoard, type Tablero } from './AnalyticsBoard';

const PERIODOS = ['mes', '90', '180', '365'];

/**
 * INDICADORES · ¿CÓMO VA EL NEGOCIO? (documento institucional, sección 25;
 * rediseñado el 2026-10-27).
 *
 * El panel de inicio cuenta pendientes: dice qué hay que atender. Esto dice
 * cómo va el negocio: si llega trabajo, si respondemos rápido, si aceptan y
 * dónde nos falta red.
 */
export default async function AdminIndicadores({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'indicadores');
  const p = (await searchParams).periodo;
  const periodo = p && PERIODOS.includes(p) ? p : '90';
  const tablero = await adminFetch<Tablero>(`/admin/analytics?periodo=${periodo}`);

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <AnalyticsBoard tablero={tablero} periodo={periodo} />
    </AdminShell>
  );
}
