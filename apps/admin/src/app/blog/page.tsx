import { redirect } from 'next/navigation';
import { defaultTheme, themeTokensSchema } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { BlogManager, type BlogRow } from './BlogManager';

interface ThemeRow { id: number; active: boolean }
interface ThemeDetail { id: number; copys: Record<string, Record<string, string>>; tokens: unknown }

export default async function AdminBlog() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'diseno');

  const [blogs, themes] = await Promise.all([
    adminFetch<BlogRow[]>('/admin/cms/blogs').then((r) => r ?? []),
    adminFetch<ThemeRow[]>('/admin/themes').catch(() => [] as ThemeRow[]),
  ]);
  const active = (themes ?? []).find((t) => t.active) ?? (themes ?? [])[0] ?? null;
  const detail = active ? await adminFetch<ThemeDetail>(`/admin/themes/${active.id}`) : null;
  const tokens = detail?.tokens ? themeTokensSchema.parse(detail.tokens) : defaultTheme.tokens;

  // La visibilidad de las secciones se gestiona en Temas; el módulo solo avisa.
  const section = tokens.sections.find((s) => s.key === 'home.blog');

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <BlogManager
        blogs={blogs}
        themeId={active?.id ?? null}
        copys={detail?.copys ?? { es: {} }}
        tokens={tokens}
        sectionEnabled={section ? section.enabled : false}
      />
    </AdminShell>
  );
}
