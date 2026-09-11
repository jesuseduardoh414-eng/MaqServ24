import { redirect } from 'next/navigation';
import { defaultTheme, themeTokensSchema } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { BrandsEditor } from './BrandsEditor';

interface ThemeRow { id: number; active: boolean }
interface ThemeDetail { id: number; copys: Record<string, Record<string, string>>; tokens: unknown }

/** Diseño → Marcas: la banda del home y el listado de /quienes-somos (una sola lista). */
export default async function BrandsDesignPage() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'diseno');

  const themes = await adminFetch<ThemeRow[]>('/admin/themes');
  const active = (themes ?? []).find((t) => t.active) ?? (themes ?? [])[0] ?? null;
  const detail = active ? await adminFetch<ThemeDetail>(`/admin/themes/${active.id}`) : null;
  const tokens = detail?.tokens ? themeTokensSchema.parse(detail.tokens) : defaultTheme.tokens;

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol}>
      <BrandsEditor
        themeId={active?.id ?? null}
        copys={detail?.copys ?? { es: {} }}
        tokens={tokens}
        brands={tokens.brands}
      />
    </AdminShell>
  );
}
