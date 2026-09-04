import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { VendorMe, WithdrawRow } from '@maqserv/types';
import { WITHDRAW_STATES, toWithdrawState } from '@maqserv/types';
import { getTheme, t } from '@/lib/theme';
import { SESSION_COOKIE } from '@/lib/session';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { formatPrice } from '@/lib/format';
import { WithdrawForm } from './WithdrawForm';
import { Badge, DISPLAY, MONO, VendorHeader, VendorMain, cardStyle, eyebrowStyle } from '../vendor-kit';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return { title: `${t(theme, 'vendor.panel.withdraws')} — ${t(theme, 'site.name')}` };
}

const day = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(iso)) : '—';

export default async function VendorWithdrawsPage() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) redirect('/login');
  const headers = { Authorization: `Bearer ${token}` };

  const [theme, meRes, listRes] = await Promise.all([
    getTheme(),
    fetch(`${API_URL}/vendor/me`, { headers, cache: 'no-store', signal: AbortSignal.timeout(15_000) }),
    fetch(`${API_URL}/vendor/withdraws`, { headers, cache: 'no-store', signal: AbortSignal.timeout(15_000) }),
  ]);
  if (meRes.status === 401) redirect('/login');
  if (listRes.status === 403) redirect('/vendedor');
  const me = (await meRes.json()) as VendorMe;
  const withdraws = (await listRes.json().catch(() => [])) as WithdrawRow[];

  return (
    <>
      <SiteHeader theme={theme} />
      <VendorMain>
        <VendorHeader
          title={t(theme, 'vendor.withdraws.title')}
          back={{ href: '/vendedor', label: t(theme, 'vendor.back') }}
        />

        <div style={{ display: 'grid', gap: 20 }}>
          <section style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ maxWidth: '46ch' }}>
              <div style={{ ...eyebrowStyle, marginBottom: 6 }}>{t(theme, 'vendor.withdraws.available')}</div>
              <div style={{ fontFamily: MONO, fontSize: 32, fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '-0.02em' }}>
                {formatPrice(me.balance)}
              </div>
              {/* El descuento inmediato sorprende si nadie lo dice. */}
              <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
                {t(theme, 'vendor.panel.balanceHint')}
              </p>
            </div>
          </section>

          <section style={cardStyle}>
            <WithdrawForm
              labels={{
                title: t(theme, 'vendor.withdraws.request'),
                amount: t(theme, 'vendor.withdraws.amount'),
                method: t(theme, 'vendor.withdraws.method'),
                reference: t(theme, 'vendor.withdraws.reference'),
                submit: t(theme, 'vendor.withdraws.submit'),
              }}
              balance={me.balance}
            />
          </section>

          {withdraws.length === 0 ? (
            <div style={{ ...cardStyle, padding: '46px 24px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 15.5, color: 'var(--color-text-muted)' }}>{t(theme, 'vendor.withdraws.empty')}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {withdraws.map((w) => {
                // Antes salía el valor crudo del enum ("pending", "completed").
                const ws = toWithdrawState(w.status);
                const info = ws ? WITHDRAW_STATES[ws] : null;
                return (
                  <div key={w.id} className="vn-card" style={cardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: DISPLAY, fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>
                          {formatPrice(w.amount)}
                        </div>
                        <div style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 5, letterSpacing: '0.04em' }}>
                          {(w.method || '—').toUpperCase()} · {day(w.createdAt)}
                        </div>
                      </div>
                      {info ? <Badge text={info.label} tone={info.tone} /> : null}
                    </div>
                    {/* Por qué se rechazó: antes solo veía "Rechazado" y a adivinar. */}
                    {w.note ? (
                      <p style={{ margin: '14px 0 0', paddingTop: 14, borderTop: '1px solid var(--color-border)', fontSize: 14, lineHeight: 1.55, color: 'var(--color-text-muted)' }}>
                        {w.note}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </VendorMain>
      <SiteFooter theme={theme} />
    </>
  );
}
