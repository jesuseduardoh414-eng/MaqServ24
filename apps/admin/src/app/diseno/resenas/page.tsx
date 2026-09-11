import { redirect } from 'next/navigation';
import { defaultTheme, themeTokensSchema } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { ReviewsEditor } from './ReviewsEditor';

interface ThemeRow { id: number; active: boolean }
interface ThemeDetail { id: number; copys: Record<string, Record<string, string>>; tokens: unknown }
interface SiteReview { id: number; author: string; rating: number; review: string; status: number }

/** Sección 7 · Reseñas: presentación de la banda "Lo que dicen nuestros clientes". */
export default async function ReviewsDesignPage() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'diseno');

  const [themes, reviews] = await Promise.all([
    adminFetch<ThemeRow[]>('/admin/themes'),
    adminFetch<SiteReview[]>('/admin/site-reviews').catch(() => []),
  ]);
  const active = (themes ?? []).find((t) => t.active) ?? (themes ?? [])[0] ?? null;
  const detail = active ? await adminFetch<ThemeDetail>(`/admin/themes/${active.id}`) : null;
  const tokens = detail?.tokens ? themeTokensSchema.parse(detail.tokens) : defaultTheme.tokens;

  const approved = (reviews ?? []).filter((r) => r.status === 1);

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol}>
      <ReviewsEditor
        themeId={active?.id ?? null}
        copys={detail?.copys ?? { es: {} }}
        tokens={tokens}
        reviewsCfg={tokens.reviews}
        approvedCount={approved.length}
        totalCount={(reviews ?? []).length}
        sample={approved.slice(0, 3)}
      />
    </AdminShell>
  );
}
