import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { QuoteSummary } from '@maqserv/types';
import { getTheme, t } from '@/lib/theme';
import { SESSION_COOKIE } from '@/lib/session';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { toneColors } from '@/lib/order-status';
import { formatPrice } from '@/lib/format';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const MONO = "'Inter', system-ui, sans-serif";
const DISPLAY = 'var(--font-display)';

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: '6px 0',
  fontSize: 13.5,
  color: 'var(--color-text-muted)',
};

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  return { title: `${t(theme, 'account.quotes.title')} — ${t(theme, 'site.name')}` };
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(iso));
}

export default async function MyQuotesPage() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) redirect('/login');

  const [theme, res] = await Promise.all([
    getTheme(),
    fetch(`${API_URL}/quotes/mine`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
  ]);
  if (res.status === 401) redirect('/login');
  const quotes = (await res.json().catch(() => [])) as QuoteSummary[];

  // El texto sigue saliendo de los copys; solo el color lo pone el tono.
  const statusOf = (s: string) =>
    s === 'completed'
      ? { text: t(theme, 'quote.status.completed'), tone: 'ok' as const }
      : { text: t(theme, 'quote.status.pending'), tone: 'warn' as const };

  return (
    <>
      <SiteHeader theme={theme} />
      <div style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" />
        <style>{`
          @media (max-width: 760px){
            .qt-wrap{ padding-left:22px !important; padding-right:22px !important; }
            .qt-title{ font-size:34px !important; }
            .qt-foot{ flex-direction:column !important; align-items:flex-start !important; gap:10px !important; }
          }
        `}</style>

        <main className="qt-wrap" style={{ maxWidth: 1000, margin: '0 auto', padding: '44px 40px 60px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, borderBottom: '2px solid var(--color-text)', paddingBottom: 20, marginBottom: 28, flexWrap: 'wrap' }}>
            <h1 className="qt-title" style={{ fontFamily: DISPLAY, margin: 0, fontSize: 48, fontWeight: 800, letterSpacing: '-0.04em' }}>{t(theme, 'account.quotes.title')}</h1>
            <span style={{ fontFamily: MONO, fontSize: 13, color: 'var(--color-text-muted)' }}>{quotes.length} COTIZACIÓN{quotes.length === 1 ? '' : 'ES'}</span>
            <Link href="/cuenta" style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 12, letterSpacing: '0.06em', color: 'var(--color-text-muted)', textDecoration: 'none' }}>← MI CUENTA</Link>
          </div>

          {quotes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '70px 20px' }}>
              <div style={{ fontSize: 52, marginBottom: 18 }}>📄</div>
              <h2 style={{ fontFamily: DISPLAY, margin: '0 0 12px', fontSize: 28, fontWeight: 700 }}>{t(theme, 'account.quotes.empty')}</h2>
              <p style={{ margin: '0 0 28px', color: 'var(--color-text-muted)' }}>Pide una cotización sin costo y te respondemos con precios y disponibilidad.</p>
              <Link href="/cotizar" style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, background: 'var(--color-text)', color: 'var(--color-bg)', textDecoration: 'none', padding: '15px 30px', borderRadius: 100 }}>Solicitar cotización</Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {quotes.map((q) => {
                const st = statusOf(q.status);
                const c = toneColors(st.tone);
                return (
                  <article key={q.id} style={{ border: '1px solid var(--color-border)', borderRadius: 4, background: 'var(--color-surface)', padding: '20px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: 'var(--color-text-muted)', marginBottom: 5 }}>COTIZACIÓN</div>
                        <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{q.quoteNumber}</div>
                        <div style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 6, letterSpacing: '0.04em' }}>{fmtDate(q.createdAt)}</div>
                      </div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: c.fg, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 100, padding: '4px 10px', whiteSpace: 'nowrap' }}>
                        <span style={{ width: 5, height: 5, borderRadius: 999, background: c.fg }} />
                        {st.text}
                      </span>
                    </div>

                    {/* Desglose: la API ya lo devolvía, antes no se mostraba. */}
                    <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 16, paddingTop: 10 }}>
                      <div style={rowStyle}><span>Subtotal</span><span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{formatPrice(q.subtotal)}</span></div>
                      {q.freightCost > 0 ? (
                        <div style={rowStyle}>
                          <span>
                            Traslado
                            {q.freightDistance ? <span style={{ fontFamily: MONO, fontSize: 10, opacity: 0.75, letterSpacing: '0.06em' }}> · {q.freightDistance} KM</span> : null}
                          </span>
                          <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{formatPrice(q.freightCost)}</span>
                        </div>
                      ) : null}
                      {q.tax > 0 ? (
                        <div style={rowStyle}><span>Impuesto</span><span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{formatPrice(q.tax)}</span></div>
                      ) : null}
                    </div>

                    <div className="qt-foot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, borderTop: '1px solid var(--color-border)', marginTop: 10, paddingTop: 16 }}>
                      <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                        <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.12em', color: 'var(--color-text-muted)' }}>TOTAL</span>
                        <strong style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>{formatPrice(q.total)}</strong>
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.06em', color: 'var(--color-text-muted)', textAlign: 'right', lineHeight: 1.5 }}>
                        {q.status === 'completed' ? 'UN ASESOR YA REVISÓ ESTA COTIZACIÓN' : 'UN ASESOR TE CONTACTARÁ'}
                      </span>
                    </div>
                  </article>
                );
              })}

              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <Link href="/cotizar" style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, background: 'var(--color-primary)', color: 'var(--color-primary-fg)', textDecoration: 'none', padding: '14px 28px', borderRadius: 100, display: 'inline-block' }}>Solicitar otra cotización</Link>
              </div>
            </div>
          )}
        </main>
      </div>
      <SiteFooter theme={theme} />
    </>
  );
}
