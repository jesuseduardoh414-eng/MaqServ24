import Link from 'next/link';
import { redirect } from 'next/navigation';
import { WITHDRAW_STATES, toWithdrawState } from '@maqserv/types';
import { adminFetch, getAdmin } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { D, FONT } from '@/components/design-tokens';
import { WithdrawActions } from './WithdrawActions';

interface WithdrawRow {
  id: number;
  vendorId: number | null;
  vendor: string | null;
  vendorBalance: number | null;
  amount: number;
  method: string | null;
  reference: string | null;
  status: string;
  note: string | null;
  createdAt: string | null;
}

interface WithdrawsResponse {
  items: WithdrawRow[];
  page: number;
  pages: number;
  total: number;
  counts: Record<string, number>;
  pendingAmount: number;
}

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const GREEN = '#3fbf8f';
const RED = '#f55';
const GRID = '1.4fr 0.9fr 1.6fr 0.9fr 1.5fr';
const DAY = 86_400_000;

const TABS: Array<{ key: string; label: string }> = [
  { key: '', label: 'Todos' },
  { key: 'pending', label: 'Por pagar' },
  { key: 'completed', label: 'Pagados' },
  { key: 'rejected', label: 'Rechazados' },
];

const TONE_COLOR: Record<'warn' | 'ok' | 'bad', string> = { warn: D.warn, ok: GREEN, bad: RED };
const th: React.CSSProperties = { fontSize: 10.5, letterSpacing: '1px', fontWeight: 700, color: '#7A7A7F' };
const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const statCard: React.CSSProperties = { minWidth: 165, background: D.card, border: `1px solid ${D.inputBorder}`, borderRadius: 14, padding: '14px 18px' };
const ageLabel = (d: number) => (d === 0 ? 'Hoy' : d === 1 ? 'Ayer' : `hace ${d} días`);

/** Marketplace → Retiros: pagarle a los vendedores lo que ya se les descontó del saldo. */
export default async function AdminWithdraws({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; page?: string }>;
}) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  const sp = await searchParams;
  const state = sp.state ?? '';

  const qs = new URLSearchParams({ page: String(sp.page ?? 1) });
  if (state) qs.set('state', state);
  const data = await adminFetch<WithdrawsResponse>(`/admin/withdraws?${qs.toString()}`);

  const items = data?.items ?? [];
  const counts = data?.counts ?? {};
  const page = data?.page ?? 1;
  const pages = data?.pages ?? 1;

  const now = Date.now();
  const link = (patch: Record<string, string | undefined>) => {
    const n = new URLSearchParams();
    for (const [k, v] of Object.entries({ state, page: String(page), ...patch })) {
      if (v && v !== '1') n.set(k, v);
    }
    const s = n.toString();
    return s ? `/retiros?${s}` : '/retiros';
  };

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email}>
      <div style={{ fontFamily: FONT, color: D.text }}>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" />
        <style>{`
          .wd-row:hover{ background: rgba(255,255,255,0.022); }
          .wd-tab:hover{ background: rgba(255,255,255,0.05); color:#f5f5f4; }
          .wd-pg:hover{ background: rgba(255,255,255,0.06); color:#f5f5f4; }
          .wd-vendor:hover{ color:var(--color-primary); text-decoration: underline; }
          @media (max-width: 1200px){ .wd-grid{ grid-template-columns: 1fr 1fr !important; row-gap: 10px !important; } .wd-head{ display:none !important; } }
        `}</style>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#8A8A8F', fontWeight: 500 }}>
              <span>Marketplace</span><span style={{ color: '#4C4C51' }}>/</span><span style={{ color: '#B4B4B9' }}>Retiros</span>
            </div>
            <h1 style={{ margin: '8px 0 0', fontSize: 30, fontWeight: 800, letterSpacing: '-0.8px', color: '#FBFBFA' }}>Retiros</h1>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#8A8A8F', maxWidth: '70ch' }}>
              Dinero que los vendedores pidieron. Ya se les descontó del saldo al solicitarlo: marcar pagado lo cierra, rechazar se los regresa.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {/* La pregunta real de esta pantalla: cuánto tengo que pagar. */}
            <div style={statCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: D.amber, boxShadow: `0 0 10px ${D.amber}b3` }} />
                <span style={{ fontSize: 12, color: '#8A8A8F', fontWeight: 600 }}>Por pagar</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: D.accent, fontFamily: MONO }}>{money(data?.pendingAmount ?? 0)}</div>
              <div style={{ fontSize: 11, color: '#5C5C61', marginTop: 3 }}>
                {counts.pending ?? 0} solicitud{(counts.pending ?? 0) === 1 ? '' : 'es'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, background: '#111113', border: `1px solid ${D.inputBorder}`, borderRadius: 12, padding: 4, flexWrap: 'wrap' }}>
            {TABS.map((t) => {
              const on = state === t.key;
              const n = t.key ? (counts[t.key] ?? 0) : (counts.all ?? 0);
              return (
                <Link
                  key={t.key || 'all'}
                  href={t.key ? `/retiros?state=${t.key}` : '/retiros'}
                  className={on ? undefined : 'wd-tab'}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', fontSize: 13.5, fontWeight: on ? 700 : 600, padding: '8px 16px', borderRadius: 9, background: on ? D.amber : 'transparent', color: on ? 'var(--color-primary-fg)' : '#9A9A9F' }}
                >
                  {t.label}
                  <span style={{ background: on ? 'rgba(26,18,6,0.22)' : 'rgba(255,255,255,0.08)', padding: '1px 7px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>{n}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 18, background: '#0F0F11', border: `1px solid ${D.inputBorder}`, borderRadius: 16, overflow: 'hidden' }}>
          <div className="wd-head" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 16, padding: '15px 24px', borderBottom: `1px solid ${D.cardBorder}`, background: '#131315' }}>
            <div style={th}>VENDEDOR</div>
            <div style={{ ...th, textAlign: 'right' }}>MONTO</div>
            <div style={th}>CÓMO PAGARLE</div>
            <div style={th}>ESTADO</div>
            <div style={{ ...th, textAlign: 'right' }}>ACCIONES</div>
          </div>

          {items.map((w) => {
            const ws = toWithdrawState(w.status);
            const info = ws ? WITHDRAW_STATES[ws] : null;
            const color = info ? TONE_COLOR[info.tone] : D.muted2;
            const ts = w.createdAt ? new Date(w.createdAt).getTime() : null;
            const days = ts ? Math.max(0, Math.floor((now - ts) / DAY)) : 0;
            return (
              <div key={w.id} className="wd-row wd-grid" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 16, padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.045)', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
                  <span style={{ width: 3, alignSelf: 'stretch', minHeight: 32, borderRadius: 3, background: color, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    {w.vendorId ? (
                      <Link href={`/vendedores/${w.vendorId}`} className="wd-vendor" style={{ fontSize: 13.5, fontWeight: 700, color: '#EDEDEC', textDecoration: 'none' }}>
                        {w.vendor ?? '—'}
                      </Link>
                    ) : (
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: '#EDEDEC' }}>{w.vendor ?? '—'}</span>
                    )}
                    <div style={{ fontSize: 11, color: '#5C5C61', marginTop: 4 }}>
                      {ts ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(ts)) : '—'} · {ageLabel(days)}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: '#FBFBFA' }}>{money(w.amount)}</div>
                  {w.vendorBalance !== null ? (
                    <div style={{ fontSize: 10.5, color: '#5C5C61', marginTop: 3 }}>saldo: {money(w.vendorBalance)}</div>
                  ) : null}
                </div>

                {/* Sin esto no puedes pagarle: aquí va su CLABE. */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: '#B4B4B9', fontWeight: 600 }}>{w.method || '—'}</div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: '#7A7A7F', marginTop: 3, wordBreak: 'break-word' }}>{w.reference || 'Sin datos de cuenta'}</div>
                </div>

                <div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color, whiteSpace: 'nowrap', background: `color-mix(in srgb, ${color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 26%, transparent)`, borderRadius: 20, padding: '5px 11px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    {info?.adminLabel ?? w.status}
                  </span>
                  {w.note ? (
                    <div style={{ fontSize: 11, color: '#7A7A7F', marginTop: 6, lineHeight: 1.45, maxWidth: 220 }}>{w.note}</div>
                  ) : null}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  {ws === 'pending' ? (
                    <WithdrawActions withdrawId={w.id} amount={money(w.amount)} vendor={w.vendor ?? 'el vendedor'} />
                  ) : (
                    <span style={{ fontSize: 11.5, color: '#5C5C61' }}>Ya procesado</span>
                  )}
                </div>
              </div>
            );
          })}

          {items.length === 0 ? (
            <div style={{ padding: '56px 24px', textAlign: 'center' }}>
              <i className="ph ph-hand-coins" style={{ fontSize: 34, opacity: 0.4, display: 'block', marginBottom: 10 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#B4B4B9' }}>
                {state ? 'Sin retiros en este filtro' : 'No hay retiros'}
              </div>
              <div style={{ fontSize: 13, color: '#7A7A7F', marginTop: 5, maxWidth: 460, marginInline: 'auto', lineHeight: 1.5 }}>
                {state ? 'Prueba con otra pestaña.' : 'Aquí aparecen cuando un vendedor aprobado pide su dinero desde su panel.'}
              </div>
            </div>
          ) : null}

          {pages > 1 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '15px 24px', background: '#131315', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12.5, color: '#7A7A7F' }}>
                <span style={{ color: '#EDEDEC', fontWeight: 600 }}>{data?.total ?? 0}</span> retiros{state ? ' en este filtro' : ''}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Link href={link({ page: String(Math.max(1, page - 1)) })} className="wd-pg" style={{ width: 36, height: 36, background: '#1A1A1D', color: '#B4B4B9', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, fontSize: 15, display: 'grid', placeItems: 'center', textDecoration: 'none', opacity: page <= 1 ? 0.4 : 1, pointerEvents: page <= 1 ? 'none' : 'auto' }}>‹</Link>
                <span style={{ fontSize: 13, color: '#B4B4B9', fontWeight: 600, padding: '0 6px' }}>Página {page} / {pages}</span>
                <Link href={link({ page: String(Math.min(pages, page + 1)) })} className="wd-pg" style={{ width: 36, height: 36, background: '#1A1A1D', color: '#B4B4B9', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, fontSize: 15, display: 'grid', placeItems: 'center', textDecoration: 'none', opacity: page >= pages ? 0.4 : 1, pointerEvents: page >= pages ? 'none' : 'auto' }}>›</Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AdminShell>
  );
}
