import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { VendorOrderRow } from '@maqserv/types';
import { getTheme, t } from '@/lib/theme';
import { SESSION_COOKIE } from '@/lib/session';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { orderStatusLabel } from '@/lib/order-status';
import { formatPrice } from '@/lib/format';
import { Badge, DISPLAY, MONO, VendorHeader, VendorMain, cardStyle, eyebrowStyle } from '../vendor-kit';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return { title: `${t(theme, 'vendor.panel.orders')} — ${t(theme, 'site.name')}` };
}

export default async function VendorOrdersPage() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) redirect('/login');

  const [theme, res] = await Promise.all([
    getTheme(),
    fetch(`${API_URL}/vendor/orders`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(15_000) }),
  ]);
  if (res.status === 401) redirect('/login');
  if (res.status === 403) redirect('/vendedor');
  const orders = (await res.json().catch(() => [])) as VendorOrderRow[];

  const total = orders.reduce((s, o) => s + o.price, 0);

  return (
    <>
      <SiteHeader theme={theme} />
      <VendorMain>
        <VendorHeader
          title={t(theme, 'vendor.orders.title')}
          aside={
            <span style={{ fontFamily: MONO, fontSize: 13, color: 'var(--color-text-muted)' }}>
              {orders.length} VENTA{orders.length === 1 ? '' : 'S'}
            </span>
          }
          back={{ href: '/vendedor', label: t(theme, 'vendor.back') }}
        />

        {orders.length === 0 ? (
          <div style={{ ...cardStyle, padding: '56px 24px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 15.5, color: 'var(--color-text-muted)' }}>{t(theme, 'vendor.orders.empty')}</p>
          </div>
        ) : (
          <>
            <section style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
              <div style={eyebrowStyle}>Total vendido</div>
              <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, color: 'var(--color-primary)' }}>{formatPrice(total)}</div>
            </section>

            <div style={{ display: 'grid', gap: 12 }}>
              {orders.map((o) => {
                // `vendor_orders.status` usa el MISMO enum que las órdenes
                // (pending|processing|completed|declined): se traduce igual, no se
                // pinta crudo en inglés como antes.
                const st = orderStatusLabel(o.status);
                return (
                  <div key={o.id} className="vn-card" style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>{o.orderNumber}</div>
                      <div style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 5, letterSpacing: '0.04em' }}>
                        {o.qty} {o.qty === 1 ? 'PIEZA' : 'PIEZAS'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <Badge text={st.text} tone={st.tone} />
                      <strong style={{ fontFamily: DISPLAY, fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>
                        {formatPrice(o.price)}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </VendorMain>
      <SiteFooter theme={theme} />
    </>
  );
}
