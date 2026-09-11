import { redirect } from 'next/navigation';
import { defaultTheme, themeTokensSchema } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { PaymentsManager, type Gateway } from './PaymentsManager';

interface ThemeRow { id: number; active: boolean }
interface ThemeDetail { id: number; copys: Record<string, Record<string, string>>; tokens: unknown }

/** Configuración → Pagos: IVA, operador y métodos de pago. */
export default async function PaymentsPage() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'configuracion');

  const [themes, gateways] = await Promise.all([
    adminFetch<ThemeRow[]>('/admin/themes').catch(() => [] as ThemeRow[]),
    adminFetch<Gateway[]>('/admin/payments/gateways').catch(() => [] as Gateway[]),
  ]);
  const active = (themes ?? []).find((t) => t.active) ?? (themes ?? [])[0] ?? null;
  const detail = active ? await adminFetch<ThemeDetail>(`/admin/themes/${active.id}`) : null;
  const tokens = detail?.tokens ? themeTokensSchema.parse(detail.tokens) : defaultTheme.tokens;

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol}>
      <PaymentsManager
        themeId={active?.id ?? null}
        copys={detail?.copys ?? { es: {} }}
        tokens={tokens}
        checkout={tokens.checkout}
        gateways={gateways ?? []}
      />
    </AdminShell>
  );
}
