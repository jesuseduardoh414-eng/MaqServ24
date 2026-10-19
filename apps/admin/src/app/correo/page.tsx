import { redirect } from 'next/navigation';
import { MODULOS_CON_CORREO, puedeVer } from '@maqserv/config';
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
 *
 * Quien tiene Configuración (Dirección) ve todo: el estado del servidor, la
 * prueba, los recordatorios y todos los correos. Los demás roles ven solo el
 * registro con los correos de sus módulos (2026-10-12).
 */
export default async function AdminCorreo({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  const tiene = (m: (typeof MODULOS_CON_CORREO)[number]) => (admin.modulos?.length ? admin.modulos.includes(m) : puedeVer(admin.rol, m));
  const completo = tiene('configuracion');
  if (!completo && !MODULOS_CON_CORREO.some(tiene)) redirect('/');

  const sp = await searchParams;
  const ver = Number(sp.ver);

  const [estado, registro] = await Promise.all([
    completo ? adminFetch<EstadoCorreo>('/admin/mail/status') : Promise.resolve(null),
    adminFetch<{ items: RegistroCorreo[]; total: number; conteo: Record<string, number> }>('/admin/mail/log'),
  ]);

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <MailPanel
        completo={completo}
        estado={estado}
        registro={registro?.items ?? []}
        total={registro?.total ?? 0}
        conteo={registro?.conteo ?? {}}
        abrir={Number.isInteger(ver) && ver > 0 ? ver : null}
      />
    </AdminShell>
  );
}
