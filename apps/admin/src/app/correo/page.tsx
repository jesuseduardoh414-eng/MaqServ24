import { redirect } from 'next/navigation';
import { adminFetch, getAdmin } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { MailPanel, type EstadoCorreo, type RegistroCorreo } from './MailPanel';

/**
 * CORREO (documento institucional, sección 17 · Comunicaciones).
 *
 * "Notificaciones, recordatorios y trazabilidad de interacciones."
 *
 * El registro no es un extra: es la mitad del requisito. Cuando un cliente
 * diga "nunca me llegó", la respuesta sale de esta pantalla y no de la memoria
 * de alguien.
 */
export default async function AdminCorreo() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');

  const [estado, registro] = await Promise.all([
    adminFetch<EstadoCorreo>('/admin/mail/status'),
    adminFetch<{ items: RegistroCorreo[]; total: number }>('/admin/mail/log'),
  ]);

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email}>
      <MailPanel estado={estado} registro={registro?.items ?? []} total={registro?.total ?? 0} />
    </AdminShell>
  );
}
