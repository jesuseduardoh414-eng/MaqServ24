import { redirect } from 'next/navigation';
import { defaultTheme, themeTokensSchema } from '@maqserv/config';
import { adminFetch, getAdmin } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { FooterEditor } from './FooterEditor';

interface ThemeRow { id: number; active: boolean }
interface ThemeDetail { id: number; copys: Record<string, Record<string, string>>; tokens: unknown }

/** Diseño → Footer: contenido del pie de página (boletín, columnas, redes, copyright). */
export default async function FooterDesignPage() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');

  const themes = await adminFetch<ThemeRow[]>('/admin/themes').catch(() => [] as ThemeRow[]);
  const active = (themes ?? []).find((t) => t.active) ?? (themes ?? [])[0] ?? null;
  const detail = active ? await adminFetch<ThemeDetail>(`/admin/themes/${active.id}`) : null;
  const tokens = detail?.tokens ? themeTokensSchema.parse(detail.tokens) : defaultTheme.tokens;
  const brand = detail?.copys?.es?.['site.name'] ?? 'MAQSER24';

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email}>
      <FooterEditor
        themeId={active?.id ?? null}
        copys={detail?.copys ?? { es: {} }}
        tokens={tokens}
        footer={tokens.footer}
        brand={brand}
      />
    </AdminShell>
  );
}
