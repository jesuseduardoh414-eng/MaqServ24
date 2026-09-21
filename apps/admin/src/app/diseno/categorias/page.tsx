import { redirect } from 'next/navigation';
import { defaultTheme, themeTokensSchema } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { CategoriesEditor } from './CategoriesEditor';

interface ThemeRow { id: number; active: boolean }
interface ThemeDetail { id: number; copys: Record<string, Record<string, string>>; tokens: unknown }
interface Cat { id: number; name: string; slug: string; image: string | null; productCount: number }

/** Sección 2 del Home: editor de presentación de la sección de categorías. */
export default async function CategoriesDesignPage() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'diseno');

  const [themes, categories] = await Promise.all([
    adminFetch<ThemeRow[]>('/admin/themes'),
    adminFetch<Cat[]>('/catalog/categories'),
  ]);
  const active = (themes ?? []).find((t) => t.active) ?? (themes ?? [])[0] ?? null;
  const detail = active ? await adminFetch<ThemeDetail>(`/admin/themes/${active.id}`) : null;
  const tokens = detail?.tokens ? themeTokensSchema.parse(detail.tokens) : defaultTheme.tokens;

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <CategoriesEditor
        themeId={active?.id ?? null}
        copys={detail?.copys ?? { es: {} }}
        tokens={tokens}
        settings={tokens.categories}
        view={tokens.categoriesView}
        categories={categories ?? []}
      />
    </AdminShell>
  );
}
