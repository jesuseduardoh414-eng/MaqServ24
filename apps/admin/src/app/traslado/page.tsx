import { redirect } from 'next/navigation';
import type { CheckoutConfig } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { FreightManager } from './FreightManager';

/**
 * Configuración → Traslado: tarifa por km, cobertura y punto de salida.
 * Lee lo PUBLICADO por su propia ruta (2026-10-05), ver Pagos.
 */
export default async function FreightPage() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'configuracion');

  const cfg = await adminFetch<{ checkout: CheckoutConfig; contactAddress: string }>('/admin/checkout-config').catch(() => null);

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      {cfg ? (
        <FreightManager checkout={cfg.checkout} contactAddress={cfg.contactAddress} />
      ) : (
        <p style={{ color: '#f2f4f7', fontSize: 14 }}>No pudimos leer los ajustes del traslado. Recarga la página en unos segundos.</p>
      )}
    </AdminShell>
  );
}
