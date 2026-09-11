import { redirect } from 'next/navigation';
import { defaultTheme, themeTokensSchema } from '@maqserv/config';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { ContactEditor } from './ContactEditor';

interface ThemeRow { id: number; active: boolean }
interface ThemeDetail { id: number; copys: Record<string, Record<string, string>>; tokens: unknown }

/** Diseño → Contacto: página /contacto + canales que alimentan barra superior. */
export default async function ContactDesignPage() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'diseno');

  const themes = await adminFetch<ThemeRow[]>('/admin/themes').catch(() => [] as ThemeRow[]);
  const active = (themes ?? []).find((t) => t.active) ?? (themes ?? [])[0] ?? null;
  const detail = active ? await adminFetch<ThemeDetail>(`/admin/themes/${active.id}`) : null;
  const tokens = detail?.tokens ? themeTokensSchema.parse(detail.tokens) : defaultTheme.tokens;

  // Si el token aún no tiene dirección, la traemos de la legacy (origen de fletes)
  // para que la migración desde Ajustes sea transparente.
  const settings = await adminFetch<{ street?: string | null }>('/admin/cms/settings').catch(() => null);
  const contact = { ...tokens.contact, address: tokens.contact.address || (settings?.street ?? '') };

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol}>
      <ContactEditor
        themeId={active?.id ?? null}
        copys={detail?.copys ?? { es: {} }}
        tokens={tokens}
        contact={contact}
      />
    </AdminShell>
  );
}
