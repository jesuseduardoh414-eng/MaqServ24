import { redirect } from 'next/navigation';
import { CRM_ACTIVO } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { Bandeja, type ItemBandeja } from './Bandeja';
import { ContactTools } from './MessageActions';

/**
 * MENSAJES — la bandeja de las dudas de los clientes (2026-10-14).
 *
 * Antes eran dos: Mensajes (solo el formulario de Contacto) y Preguntas (las
 * de Preguntas frecuentes y de productos). "Solo vamos a dejar Mensajes: si un
 * cliente pregunta algo, llega a esa bandeja." Ver Bandeja.tsx y
 * admin-bandeja.controller.ts.
 */
export default async function AdminMensajes() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'comunidad');

  const [bandeja, crm] = await Promise.all([
    adminFetch<{ items: ItemBandeja[] }>('/admin/bandeja'),
    // Solo si el CRM externo está en el modelo: lo que quedó sin subir a Perfex.
    CRM_ACTIVO
      ? adminFetch<{ perfexEnabled: boolean; counts: { sinSubir: number } }>('/admin/contact-messages?page=1')
      : Promise.resolve(null),
  ]);

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <Bandeja
        inicial={bandeja?.items ?? []}
        extra={crm ? <ContactTools perfexEnabled={crm.perfexEnabled} pendientes={crm.counts.sinSubir} /> : null}
      />
    </AdminShell>
  );
}
