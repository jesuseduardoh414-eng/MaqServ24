import { redirect } from 'next/navigation';
import { defaultTheme, themeTokensSchema } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo, SITE_URL } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { FondoEditor } from './FondoEditor';

interface ThemeRow { id: number; active: boolean }
interface ThemeDetail { id: number; tokens: unknown }

/** Fondo animado de todas las páginas del sitio (2026-11-16). */
export default async function FondoPage() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'diseno');

  const themes = await adminFetch<ThemeRow[]>('/admin/themes');
  const active = (themes ?? []).find((t) => t.active) ?? (themes ?? [])[0] ?? null;
  const detail = active ? await adminFetch<ThemeDetail>(`/admin/themes/${active.id}`) : null;
  const tokens = detail?.tokens ? themeTokensSchema.parse(detail.tokens) : defaultTheme.tokens;

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      {/* `sitio`: el video por defecto vive en el sitio (/fondo/…), no en el panel. */}
      <FondoEditor themeId={active?.id ?? null} tokens={tokens} fondo={tokens.fondo} sitio={SITE_URL.replace(/\/+$/, '')} />
    </AdminShell>
  );
}
