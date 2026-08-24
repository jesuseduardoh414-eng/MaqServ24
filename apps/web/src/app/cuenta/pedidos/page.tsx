import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { OrderSummary } from '@maqserv/types';
import { getTheme, t } from '@/lib/theme';
import { SESSION_COOKIE } from '@/lib/session';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { orderStatusLabel, paymentStatusLabel, toneColors, type StatusLabel } from '@/lib/order-status';
import { formatPrice } from '@/lib/format';
import { MyReviews } from './MyReviews';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const MONO = "'Inter', system-ui, sans-serif";
const DISPLAY = 'var(--font-display)';

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return { title: `${t(theme, 'account.orders.title')} — ${t(theme, 'site.name')}` };
}

function Badge({ st }: { st: StatusLabel }) {
  const c = toneColors(st.tone);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: c.fg, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 100, padding: '4px 10px', whiteSpace: 'nowrap' }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: c.fg }} />
      {st.text}
    </span>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(iso));
}

export default async function MyOrdersPage() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) redirect('/login');

  const [theme, ordersRes] = await Promise.all([
    getTheme(),
    fetch(`${API_URL}/orders`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
  ]);
  if (ordersRes.status === 401) redirect('/login');
  const orders = (await ordersRes.json().catch(() => [])) as OrderSummary[];

  return (
    <>
      <SiteHeader theme={theme} />
      <div style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" />
        <style>{`
          @media (max-width: 760px){
            .ord-wrap{ padding-left:22px !important; padding-right:22px !important; }
            .ord-title{ font-size:34px !important; }
            .ord-foot{ flex-direction:column !important; align-items:flex-start !important; gap:12px !important; }
          }
          .ord-card{ transition: border-color .15s ease, background .15s ease; }
          .ord-card:hover{ border-color: var(--color-text) !important; background: color-mix(in srgb, var(--color-text) 3%, var(--color-surface)) !important; }
          .ord-card:hover .ord-cta{ color: var(--color-text) !important; }
        `}</style>

        <main className="ord-wrap" style={{ maxWidth: 1000, margin: '0 auto', padding: '44px 40px 60px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, borderBottom: '2px solid var(--color-text)', paddingBottom: 20, marginBottom: 28, flexWrap: 'wrap' }}>
            <h1 className="ord-title" style={{ fontFamily: DISPLAY, margin: 0, fontSize: 48, fontWeight: 800, letterSpacing: '-0.04em' }}>{t(theme, 'account.orders.title')}</h1>
            <span style={{ fontFamily: MONO, fontSize: 13, color: 'var(--color-text-muted)' }}>{orders.length} PEDIDO{orders.length === 1 ? '' : 'S'}</span>
            <Link href="/cuenta" style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 12, letterSpacing: '0.06em', color: 'var(--color-text-muted)', textDecoration: 'none' }}>← MI CUENTA</Link>
          </div>

          {orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '70px 20px' }}>
              <div style={{ fontSize: 52, marginBottom: 18 }}>📦</div>
              <h2 style={{ fontFamily: DISPLAY, margin: '0 0 12px', fontSize: 28, fontWeight: 700 }}>{t(theme, 'account.orders.empty')}</h2>
              <p style={{ margin: '0 0 28px', color: 'var(--color-text-muted)' }}>Cuando rentes o compres equipo, tus pedidos aparecerán aquí.</p>
              <Link href="/productos" style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, background: 'var(--color-text)', color: 'var(--color-bg)', textDecoration: 'none', padding: '15px 30px', borderRadius: 100 }}>Ver productos</Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {orders.map((o) => (
                <Link
                  key={o.id}
                  href={`/pedido/${o.orderNumber}`}
                  className="ord-card"
                  style={{ textDecoration: 'none', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 4, background: 'var(--color-surface)', padding: '20px 24px', display: 'block' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: 'var(--color-text-muted)', marginBottom: 5 }}>PEDIDO</div>
                      <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{o.orderNumber}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Badge st={orderStatusLabel(o.status)} />
                      <Badge st={paymentStatusLabel(o.paymentStatus)} />
                    </div>
                  </div>

                  <div style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 10, letterSpacing: '0.04em' }}>
                    {[fmtDate(o.createdAt), o.method, `${o.totalQty} EQUIPO${o.totalQty === 1 ? '' : 'S'}`].filter(Boolean).join(' · ')}
                  </div>

                  <div className="ord-foot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, borderTop: '1px solid var(--color-border)', marginTop: 16, paddingTop: 16 }}>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.12em', color: 'var(--color-text-muted)' }}>TOTAL</span>
                      <strong style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>{formatPrice(o.total)}</strong>
                    </span>
                    <span className="ord-cta" style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>VER DETALLE →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <MyReviews title="Califica tus compras" />
        </main>
      </div>
      <SiteFooter theme={theme} />
    </>
  );
}
