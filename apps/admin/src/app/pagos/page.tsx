import { redirect } from 'next/navigation';
import type { CheckoutConfig } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { PaymentsManager, type Gateway } from './PaymentsManager';

/**
 * Configuración → Pagos: IVA, operador y métodos de pago.
 *
 * Lee lo PUBLICADO por su propia ruta (2026-10-05), no el tema por la de
 * Diseño: quien tiene "configuración" sin "diseño" veía aquí los valores de
 * fábrica y no podía guardar.
 */
export default async function PaymentsPage() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'configuracion');

  const [cfg, gateways] = await Promise.all([
    adminFetch<{ checkout: CheckoutConfig }>('/admin/checkout-config').catch(() => null),
    adminFetch<Gateway[]>('/admin/payments/gateways').catch(() => [] as Gateway[]),
  ]);

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      {/* Sin lo publicado NO se enseñan los valores de fábrica: guardar encima
          de ellos publicaría un IVA y un operador que nadie eligió. */}
      {cfg ? (
        <PaymentsManager checkout={cfg.checkout} gateways={gateways ?? []} />
      ) : (
        <p style={{ color: '#f2f4f7', fontSize: 14 }}>No pudimos leer los ajustes del checkout. Recarga la página en unos segundos.</p>
      )}
    </AdminShell>
  );
}
