import { redirect } from 'next/navigation';
import { defaultTheme, themeTokensSchema, LEGAL_DEFAULTS } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { LegalEditor } from './LegalEditor';

interface ThemeRow { id: number; active: boolean }
interface ThemeDetail { id: number; copys: Record<string, Record<string, string>>; tokens: unknown }

/** Diseño → Legal: Términos y Condiciones + Aviso de Privacidad editables. */
export default async function LegalDesignPage() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'diseno');

  const themes = await adminFetch<ThemeRow[]>('/admin/themes').catch(() => [] as ThemeRow[]);
  const active = (themes ?? []).find((t) => t.active) ?? (themes ?? [])[0] ?? null;
  const detail = active ? await adminFetch<ThemeDetail>(`/admin/themes/${active.id}`) : null;
  const tokens = detail?.tokens ? themeTokensSchema.parse(detail.tokens) : defaultTheme.tokens;

  // Si aún no se ha editado (sin secciones), partimos de la plantilla por defecto.
  const legal = {
    terms: tokens.legal.terms.sections.length > 0 ? tokens.legal.terms : LEGAL_DEFAULTS.terms,
    privacy: tokens.legal.privacy.sections.length > 0 ? tokens.legal.privacy : LEGAL_DEFAULTS.privacy,
  };

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol}>
      <LegalEditor
        themeId={active?.id ?? null}
        copys={detail?.copys ?? { es: {} }}
        tokens={tokens}
        legal={legal}
      />
    </AdminShell>
  );
}
