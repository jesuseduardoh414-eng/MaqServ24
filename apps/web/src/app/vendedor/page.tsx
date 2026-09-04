import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { VendorMe } from '@maqserv/types';
import { getTheme, t } from '@/lib/theme';
import { SESSION_COOKIE } from '@/lib/session';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';
import { formatPrice } from '@/lib/format';
import { VendorApply } from './VendorApply';
import { Badge, DISPLAY, Field, MONO, VendorHeader, VendorMain, cardStyle, eyebrowStyle } from './vendor-kit';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return { title: `${t(theme, 'vendor.panel.title')} — ${t(theme, 'site.name')}` };
}

export default async function VendorPanelPage() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) redirect('/login');

  const [theme, meRes] = await Promise.all([
    getTheme(),
    fetch(`${API_URL}/vendor/me`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(15_000) }),
  ]);
  if (meRes.status === 401) redirect('/login');
  const me = (await meRes.json()) as VendorMe;

  const applyLabels = {
    title: t(theme, 'vendor.apply.title'),
    subtitle: t(theme, 'vendor.apply.subtitle'),
    shopName: t(theme, 'vendor.apply.shopName'),
    shopNumber: t(theme, 'vendor.apply.shopNumber'),
    shopAddress: t(theme, 'vendor.apply.shopAddress'),
    regNumber: t(theme, 'vendor.apply.regNumber'),
    message: t(theme, 'vendor.apply.message'),
    submit: t(theme, 'vendor.apply.submit'),
  };

  /**
   * `status: 0` significa DOS cosas y hay que separarlas: quien nunca solicitó ve el
   * formulario; a quien le rechazaron o revocaron se le explica qué pasó. Antes ambos
   * caían en el formulario en blanco. `application` es lo que los distingue.
   */
  const app = me.application;
  const view = me.status === 2 ? 'panel' : me.status === 1 ? 'revision' : app ? 'inactiva' : 'solicitar';

  return (
    <>
      <SiteHeader theme={theme} />
      <VendorMain>
        <VendorHeader
          eyebrow={t(theme, 'vendor.panel.eyebrow')}
          title={t(theme, 'vendor.panel.title')}
          aside={
            view === 'revision' ? <Badge text={t(theme, 'vendor.apply.pendingTitle')} tone="warn" />
              : view === 'inactiva' ? <Badge text={t(theme, 'vendor.apply.inactiveTitle')} tone="bad" />
                : null
          }
        />

        {/* --- Aprobado: su panel real --- */}
        {view === 'panel' ? (
          <div style={{ display: 'grid', gap: 20 }}>
            <section style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ ...eyebrowStyle, marginBottom: 6 }}>{t(theme, 'vendor.panel.shop')}</div>
                <div style={{ fontFamily: DISPLAY, fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--color-text)' }}>
                  {me.shopName}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ ...eyebrowStyle, marginBottom: 6 }}>{t(theme, 'vendor.panel.balance')}</div>
                <div style={{ fontFamily: MONO, fontSize: 30, fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '-0.02em' }}>
                  {formatPrice(me.balance)}
                </div>
              </div>
            </section>

            <nav className="vn-nav" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {[
                { href: '/vendedor/productos', label: t(theme, 'vendor.panel.products'), hint: t(theme, 'vendor.panel.productsHint') },
                { href: '/vendedor/ordenes', label: t(theme, 'vendor.panel.orders'), hint: t(theme, 'vendor.panel.ordersHint') },
                { href: '/vendedor/retiros', label: t(theme, 'vendor.panel.withdraws'), hint: t(theme, 'vendor.panel.withdrawsHint') },
              ].map((l) => (
                <Link key={l.href} href={l.href} className="vn-card" style={{ ...cardStyle, textDecoration: 'none', display: 'grid', gap: 7, alignContent: 'start' }}>
                  <span style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>{l.label}</span>
                  <span style={{ fontSize: 13.5, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{l.hint}</span>
                  <span className="vn-cta" style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 6, justifySelf: 'start' }}>ABRIR<Icon name="arrowRight" size={11.5} /></span>
                </Link>
              ))}
            </nav>
          </div>
        ) : null}

        {/* --- Pendiente / sin acceso: explicar + mostrar lo que mandó --- */}
        {view === 'revision' || view === 'inactiva' ? (
          <div style={{ display: 'grid', gap: 20 }}>
            <section style={{ ...cardStyle, borderColor: `color-mix(in srgb, ${view === 'revision' ? 'var(--color-primary)' : 'var(--color-error)'} 40%, transparent)`, background: `color-mix(in srgb, ${view === 'revision' ? 'var(--color-primary)' : 'var(--color-error)'} 6%, var(--color-surface))` }}>
              <h2 style={{ fontFamily: DISPLAY, margin: '0 0 8px', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>
                {t(theme, view === 'revision' ? 'vendor.apply.pendingTitle' : 'vendor.apply.inactiveTitle')}
              </h2>
              <p role="status" style={{ margin: 0, fontSize: 15.5, lineHeight: 1.6, color: 'var(--color-text-muted)', maxWidth: '68ch' }}>
                {t(theme, view === 'revision' ? 'vendor.apply.pending' : 'vendor.apply.inactive')}
              </p>
              {view === 'inactiva' ? (
                <Link href="/contacto" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14, fontFamily: MONO, fontSize: 12, letterSpacing: '0.06em', fontWeight: 700, color: 'var(--color-primary)', textDecoration: 'none' }}>
                  {t(theme, 'nav.contact').toUpperCase()}
                  <Icon name="arrowRight" size={12} />
                </Link>
              ) : null}
            </section>

            {/* Lo que mandó: sin esto, "en revisión" no dice de qué. */}
            {app ? (
              <section style={cardStyle}>
                <h2 style={{ fontFamily: DISPLAY, margin: '0 0 18px', fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>
                  {t(theme, 'vendor.apply.sent')}
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 18 }}>
                  <Field label={t(theme, 'vendor.apply.shopName')} value={app.shopName} />
                  <Field label={t(theme, 'vendor.apply.shopNumber')} value={app.shopNumber} />
                  <Field label={t(theme, 'vendor.apply.regNumber')} value={app.regNumber} />
                  <Field label={t(theme, 'vendor.apply.shopAddress')} value={app.shopAddress} />
                </div>
                {app.shopMessage ? (
                  <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 18, paddingTop: 16 }}>
                    <div style={{ ...eyebrowStyle, marginBottom: 6 }}>{t(theme, 'vendor.apply.message')}</div>
                    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--color-text)' }}>{app.shopMessage}</p>
                  </div>
                ) : null}
              </section>
            ) : null}

            {/* Sin acceso: puede corregir y volver a intentar (el formulario llega prellenado). */}
            {view === 'inactiva' ? (
              <section style={cardStyle}>
                <h2 style={{ fontFamily: DISPLAY, margin: '0 0 6px', fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>
                  {t(theme, 'vendor.apply.reapply')}
                </h2>
                <p style={{ margin: '0 0 18px', fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
                  {t(theme, 'vendor.apply.reapplyHint')}
                </p>
                <VendorApply labels={{ ...applyLabels, submit: t(theme, 'vendor.apply.reapply') }} initial={app} bare />
              </section>
            ) : null}
          </div>
        ) : null}

        {/* --- Nunca solicitó: el formulario --- */}
        {view === 'solicitar' ? <VendorApply labels={applyLabels} initial={null} /> : null}
      </VendorMain>
      <SiteFooter theme={theme} />
    </>
  );
}
