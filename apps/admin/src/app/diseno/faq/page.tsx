import { redirect } from 'next/navigation';
import { defaultTheme, themeTokensSchema } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { FaqEditor } from './FaqEditor';

interface ThemeRow { id: number; active: boolean }
interface ThemeDetail { id: number; copys: Record<string, Record<string, string>>; tokens: unknown }
interface AdminQuestion { question: string; answered: boolean; featured: boolean; status: number }

/** Sección 8 · Preguntas frecuentes: presentación de la banda de FAQ del home. */
export default async function FaqDesignPage() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'diseno');

  const [themes, questions] = await Promise.all([
    adminFetch<ThemeRow[]>('/admin/themes'),
    adminFetch<AdminQuestion[]>('/admin/questions').catch(() => []),
  ]);
  const active = (themes ?? []).find((t) => t.active) ?? (themes ?? [])[0] ?? null;
  const detail = active ? await adminFetch<ThemeDetail>(`/admin/themes/${active.id}`) : null;
  const tokens = detail?.tokens ? themeTokensSchema.parse(detail.tokens) : defaultTheme.tokens;

  // El FAQ del home lo alimentan las preguntas de clientes DESTACADAS.
  const featured = (questions ?? []).filter((q) => q.featured && q.answered && q.status === 1);

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol}>
      <FaqEditor
        themeId={active?.id ?? null}
        copys={detail?.copys ?? { es: {} }}
        tokens={tokens}
        faqCfg={tokens.faq}
        sample={featured.slice(0, 4).map((q) => q.question)}
        count={featured.length}
      />
    </AdminShell>
  );
}
