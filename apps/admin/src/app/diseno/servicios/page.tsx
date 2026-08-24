import Link from 'next/link';
import { redirect } from 'next/navigation';
import { defaultTheme, themeTokensSchema } from '@maqserv/config';
import { adminFetch, getAdmin } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { D, FONT } from '@/components/design-tokens';
import { ServicesEditor, type ServiceItem } from './ServicesEditor';

interface ThemeRow { id: number; active: boolean }
interface ThemeDetail { id: number; tokens: unknown }

/**
 * Diseño → Servicios: los servicios que se listan en el home (`home.services`).
 *
 * Estaba en `/contenido`, una ruta HUÉRFANA: no aparecía en el menú ni la enlazaba
 * nadie, así que solo se llegaba escribiendo la URL. El contenido vive en la tabla
 * `services`, no en los tokens.
 */
export default async function ServicesDesignPage() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');

  const [themes, items] = await Promise.all([
    adminFetch<ThemeRow[]>('/admin/themes'),
    adminFetch<ServiceItem[]>('/admin/cms/services'),
  ]);
  const active = (themes ?? []).find((t) => t.active) ?? (themes ?? [])[0] ?? null;
  const detail = active ? await adminFetch<ThemeDetail>(`/admin/themes/${active.id}`) : null;
  const tokens = detail?.tokens ? themeTokensSchema.parse(detail.tokens) : defaultTheme.tokens;

  // La visibilidad de las secciones se gestiona en Temas; aquí solo se avisa, porque
  // editar servicios que el home no pinta es trabajo tirado a la basura.
  const section = tokens.sections.find((s) => s.key === 'home.services');
  const hidden = section ? !section.enabled : false;

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email}>
      <div style={{ fontFamily: FONT, color: D.text }}>
        <style>{`.sv-link:hover{ color:var(--color-primary); text-decoration: underline; }`}</style>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#8A8A8F', fontWeight: 500 }}>
          <span>Diseño</span><span style={{ color: '#4C4C51' }}>/</span><span style={{ color: '#B4B4B9' }}>Servicios</span>
        </div>
        <h1 style={{ margin: '8px 0 0', fontSize: 30, fontWeight: 800, letterSpacing: '-0.8px', color: '#FBFBFA' }}>Servicios</h1>
        <p style={{ margin: '6px 0 0 0', fontSize: 13.5, color: '#8A8A8F', maxWidth: '70ch' }}>
          Lo que ofreces, listado en el home. Los cambios se guardan al instante (no pasan por borrador).
        </p>

        {hidden ? (
          <div style={{ marginTop: 20, display: 'flex', alignItems: 'flex-start', gap: 11, background: `color-mix(in srgb, ${D.amber} 7%, ${D.card})`, border: `1px solid color-mix(in srgb, ${D.amber} 30%, transparent)`, borderRadius: 12, padding: '13px 17px' }}>
            <i className="ph ph-eye-slash" style={{ color: D.amber, fontSize: 16, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: '#D4D4D8', lineHeight: 1.55 }}>
              <strong style={{ color: '#FBFBFA' }}>La sección de Servicios está oculta en el home.</strong> Puedes editarla aquí, pero
              nadie la verá hasta que la actives en{' '}
              <Link href="/temas" className="sv-link" style={{ color: D.amber, fontWeight: 700, textDecoration: 'none' }}>Temas y colores</Link>, en la lista de secciones.
            </div>
          </div>
        ) : null}

        <div style={{ marginTop: 20 }}>
          <ServicesEditor items={items ?? []} />
        </div>
      </div>
    </AdminShell>
  );
}
