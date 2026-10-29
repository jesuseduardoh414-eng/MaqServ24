import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { ServicesBoard, type ServicioRow } from './ServicesBoard';
import type { Rastreo } from './UnidadesEnCamino';

/**
 * TABLERO DE OPERACIONES (documento institucional, secciones 16 y 17).
 *
 * "Asignaciones, estatus, agenda, incidencias y cierre."
 *
 * La plataforma se detenía al responder la cotización: a partir de ahí, quién
 * atendía, si ya había llegado la unidad y cuántos viajes hizo vivía en
 * llamadas y WhatsApp. Es el hueco que el documento llama por su nombre —
 * "falta de trazabilidad sobre quién cotizó, qué se ofreció, dónde está el
 * equipo y cuál es el estatus de la operación"— y esta pantalla es donde se
 * cierra.
 */
export default async function AdminServicios({ searchParams }: { searchParams: Promise<{ historial?: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'servicios');
  // ?historial=1 trae también cerrados y cancelados (la API ya lo sabía hacer con ?todos=1).
  const historial = (await searchParams).historial === '1';
  const [servicios, rastreo] = await Promise.all([
    adminFetch<ServicioRow[]>(`/admin/services${historial ? '?todos=1' : ''}`).then((r) => r ?? []),
    // El mapa de servicios (2026-10-14 en camino; 2026-10-26 todos): se pinta si hay algo que enseñar.
    historial ? Promise.resolve(null) : adminFetch<Rastreo>('/admin/rastreo'),
  ]);

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <ServicesBoard
        initial={servicios}
        historial={historial}
        rastreo={rastreo}
      />
    </AdminShell>
  );
}
