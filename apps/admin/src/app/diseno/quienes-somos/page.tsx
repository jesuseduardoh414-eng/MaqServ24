import { redirect } from 'next/navigation';
import { defaultTheme, themeTokensSchema } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { QuienesEditor } from './QuienesEditor';

interface ThemeRow { id: number; active: boolean }
interface ThemeDetail { id: number; copys: Record<string, Record<string, string>>; tokens: unknown }
interface Reason { id: number; title: string; text: string; image: string | null; placement: 'both' | 'home' | 'about' }
interface InfSitio { frase: string | null; titulo: string | null; descripcion: string | null; mision: string | null; vision: string | null; objetivos: string | null; imagenes: string[] }

/** Sección 4 · Quiénes somos: la banda "¿Por qué elegirnos?" del home + la página /quienes-somos. */
export default async function QuienesDesignPage() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'diseno');

  const [themes, reasons, infSitio] = await Promise.all([
    adminFetch<ThemeRow[]>('/admin/themes'),
    adminFetch<Reason[]>('/admin/cms/why-choose-us').catch(() => []),
    adminFetch<InfSitio | null>('/admin/cms/inf-sitio').catch(() => null),
  ]);
  const active = (themes ?? []).find((t) => t.active) ?? (themes ?? [])[0] ?? null;
  const detail = active ? await adminFetch<ThemeDetail>(`/admin/themes/${active.id}`) : null;
  const tokens = detail?.tokens ? themeTokensSchema.parse(detail.tokens) : defaultTheme.tokens;

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <QuienesEditor
        themeId={active?.id ?? null}
        copys={detail?.copys ?? { es: {} }}
        tokens={tokens}
        whyChooseUs={tokens.whyChooseUs}
        reasons={reasons ?? []}
        infSitio={infSitio ?? null}
      />
    </AdminShell>
  );
}
