import { redirect } from 'next/navigation';
import { defaultTheme, themeTokensSchema } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { HeroEditor } from './HeroEditor';

interface HeroDto {
  id?: number;
  badge: string | null;
  title: string | null;
  subtitle: string | null;
  feature1: string | null;
  feature2: string | null;
  image: string | null;
}
interface ThemeRow { id: number; active: boolean }
interface ThemeDetail { id: number; copys: Record<string, Record<string, string>>; tokens: unknown }

/** Sección 1 del Home: editor del Hero (contenido BD + textos + ajustes del tema). */
export default async function HeroDesignPage() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'diseno');

  const [hero, themes] = await Promise.all([
    adminFetch<HeroDto>('/admin/cms/hero'),
    adminFetch<ThemeRow[]>('/admin/themes'),
  ]);
  const active = (themes ?? []).find((t) => t.active) ?? (themes ?? [])[0] ?? null;
  const detail = active ? await adminFetch<ThemeDetail>(`/admin/themes/${active.id}`) : null;

  // Parseamos con el schema → rellena defaults (branding, hero, etc.) si faltan.
  const tokens = detail?.tokens ? themeTokensSchema.parse(detail.tokens) : defaultTheme.tokens;

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol}>
      <HeroEditor
        hero={hero}
        themeId={active?.id ?? null}
        copys={detail?.copys ?? { es: {} }}
        tokens={tokens}
        heroSettings={tokens.hero}
      />
    </AdminShell>
  );
}
