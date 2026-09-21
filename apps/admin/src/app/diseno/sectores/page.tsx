import { redirect } from 'next/navigation';
import { defaultTheme, themeTokensSchema } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { SectorsEditor } from './SectorsEditor';

interface ThemeRow { id: number; active: boolean }
interface ThemeDetail { id: number; copys: Record<string, Record<string, string>>; tokens: unknown }
interface SectorRow { id: number; title: string; status: number; image: string | null }

/** Sección 5 · Sectores estratégicos: presentación de la banda del home + gestión de sectores. */
export default async function SectorsDesignPage() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'diseno');

  const [themes, sectors] = await Promise.all([
    adminFetch<ThemeRow[]>('/admin/themes'),
    adminFetch<SectorRow[]>('/admin/cms/sectors').catch(() => []),
  ]);
  const active = (themes ?? []).find((t) => t.active) ?? (themes ?? [])[0] ?? null;
  const detail = active ? await adminFetch<ThemeDetail>(`/admin/themes/${active.id}`) : null;
  const tokens = detail?.tokens ? themeTokensSchema.parse(detail.tokens) : defaultTheme.tokens;

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <SectorsEditor
        themeId={active?.id ?? null}
        copys={detail?.copys ?? { es: {} }}
        tokens={tokens}
        sectorsCfg={tokens.sectors}
        sectors={sectors ?? []}
      />
    </AdminShell>
  );
}
