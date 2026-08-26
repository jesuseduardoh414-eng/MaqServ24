import { redirect } from 'next/navigation';
import { adminFetch, getAdmin } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { ServicesBoard, type ServicioRow } from './ServicesBoard';

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
export default async function AdminServicios() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  const servicios = (await adminFetch<ServicioRow[]>('/admin/services')) ?? [];

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email}>
      <ServicesBoard initial={servicios} />
    </AdminShell>
  );
}
