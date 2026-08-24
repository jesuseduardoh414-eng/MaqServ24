import Link from 'next/link';
import { redirect } from 'next/navigation';
import { VENDOR_STATES, type VendorState } from '@maqserv/types';
import { adminFetch, getAdmin } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { D, FONT } from '@/components/design-tokens';
import { CustomersSearch } from './CustomersSearch';

interface UserRow {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  vendorState: VendorState | null;
  orders: number;
  spent: number;
  createdAt: string | null;
}

interface UsersResponse {
  items: UserRow[];
  total: number;
  page: number;
  pages: number;
  counts: Record<string, number>;
}

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const GREEN = '#3fbf8f';
const BLUE = '#5b9dff';
const GRID = '1.7fr 1.8fr 0.8fr 1fr 0.9fr';

const TABS: Array<{ key: string; label: string }> = [
  { key: '', label: 'Todos' },
  { key: 'compradores', label: 'Han comprado' },
  { key: 'vendedores', label: 'Vendedores' },
];

const VENDOR_TONE: Record<'warn' | 'ok' | 'bad', string> = { warn: D.amber, ok: BLUE, bad: '#f55' };
const th: React.CSSProperties = { fontSize: 10.5, letterSpacing: '1px', fontWeight: 700, color: '#7A7A7F' };
const money = (n: number) => `$${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
const statCard: React.CSSProperties = { minWidth: 150, background: D.card, border: `1px solid ${D.inputBorder}`, borderRadius: 14, padding: '14px 18px' };

/** Clientes → la gente registrada. Solo lectura: el cliente edita su perfil en /cuenta. */
export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; segment?: string }>;
}) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  const sp = await searchParams;
  const q = sp.q ?? '';
  const segment = sp.segment ?? '';

  const qs = new URLSearchParams({ page: String(sp.page ?? 1) });
  if (q) qs.set('search', q);
  if (segment) qs.set('segment', segment);
  const data = await adminFetch<UsersResponse>(`/admin/users?${qs.toString()}`);

  const items = data?.items ?? [];
  const counts = data?.counts ?? {};
  const page = data?.page ?? 1;
  const pages = data?.pages ?? 1;

  const link = (patch: Record<string, string | undefined>) => {
    const n = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, segment, page: String(page), ...patch })) {
      if (v && v !== '1') n.set(k, v);
    }
    const s = n.toString();
    return s ? `/usuarios?${s}` : '/usuarios';
  };

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email}>
      <div style={{ fontFamily: FONT, color: D.text }}>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" />
        <style>{`
          .cu-row:hover{ background: rgba(255,255,255,0.022); }
          .cu-tab:hover{ background: rgba(255,255,255,0.05); color:#f5f5f4; }
          .cu-pg:hover{ background: rgba(255,255,255,0.06); color:#f5f5f4; }
          .cu-name:hover{ color:var(--color-primary); text-decoration: underline; }
          @media (max-width: 1100px){ .cu-grid{ grid-template-columns: 1fr 1fr !important; row-gap: 10px !important; } .cu-head{ display:none !important; } }
        `}</style>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#8A8A8F', fontWeight: 500 }}>
              <span>Clientes</span><span style={{ color: '#4C4C51' }}>/</span><span style={{ color: '#B4B4B9' }}>Directorio</span>
            </div>
            <h1 style={{ margin: '8px 0 0', fontSize: 30, fontWeight: 800, letterSpacing: '-0.8px', color: '#FBFBFA' }}>Clientes</h1>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#8A8A8F' }}>Quién está registrado y qué ha hecho. Abre uno para ver sus pedidos.</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={statCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6B6B71' }} />
                <span style={{ fontSize: 12, color: '#8A8A8F', fontWeight: 600 }}>Registrados</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: '#EDEDEC', fontFamily: MONO }}>{counts.all ?? 0}</div>
            </div>
            <div style={statCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN, boxShadow: `0 0 10px ${GREEN}99` }} />
                <span style={{ fontSize: 12, color: '#8A8A8F', fontWeight: 600 }}>Han comprado</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: GREEN, fontFamily: MONO }}>{counts.compradores ?? 0}</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, background: '#111113', border: `1px solid ${D.inputBorder}`, borderRadius: 12, padding: 4, flexWrap: 'wrap' }}>
            {TABS.map((t) => {
              const on = segment === t.key;
              const n = t.key ? (counts[t.key] ?? 0) : (counts.all ?? 0);
              return (
                <Link
                  key={t.key || 'all'}
                  href={link({ segment: t.key || undefined, page: undefined })}
                  className={on ? undefined : 'cu-tab'}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', fontSize: 13.5, fontWeight: on ? 700 : 600, padding: '8px 16px', borderRadius: 9, background: on ? D.amber : 'transparent', color: on ? 'var(--color-primary-fg)' : '#9A9A9F' }}
                >
                  {t.label}
                  <span style={{ background: on ? 'rgba(26,18,6,0.22)' : 'rgba(255,255,255,0.08)', padding: '1px 7px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>{n}</span>
                </Link>
              );
            })}
          </div>
          <CustomersSearch initial={q} />
        </div>

        <div style={{ marginTop: 18, background: '#0F0F11', border: `1px solid ${D.inputBorder}`, borderRadius: 16, overflow: 'hidden' }}>
          <div className="cu-head" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 16, padding: '15px 24px', borderBottom: `1px solid ${D.cardBorder}`, background: '#131315' }}>
            <div style={th}>CLIENTE</div>
            <div style={th}>CONTACTO</div>
            <div style={{ ...th, textAlign: 'right' }}>PEDIDOS</div>
            <div style={{ ...th, textAlign: 'right' }}>EN PEDIDOS</div>
            <div style={{ ...th, textAlign: 'right' }}>ALTA</div>
          </div>

          {items.map((u) => {
            const vs = u.vendorState ? VENDOR_STATES[u.vendorState] : null;
            const vColor = vs ? VENDOR_TONE[vs.tone] : null;
            return (
              <div key={u.id} className="cu-row cu-grid" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 16, padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.045)', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
                  <span style={{ width: 3, alignSelf: 'stretch', minHeight: 30, borderRadius: 3, background: u.orders > 0 ? GREEN : '#2A2A2F', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <Link href={`/usuarios/${u.id}`} className="cu-name" style={{ fontSize: 13.5, fontWeight: 700, color: '#EDEDEC', textDecoration: 'none' }}>
                      {u.name}
                    </Link>
                    {/* El estado real del vendedor, no solo "es vendedor": un solicitante
                        pendiente también hay que verlo. */}
                    {vs && vColor ? (
                      <div style={{ marginTop: 5 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, color: vColor, background: `color-mix(in srgb, ${vColor} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${vColor} 26%, transparent)`, borderRadius: 20, padding: '2px 8px' }}>
                          Vendedor · {vs.label.toLowerCase()}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: '#B4B4B9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                  {u.phone ? <div style={{ fontFamily: MONO, fontSize: 11, color: '#7A7A7F', marginTop: 3 }}>{u.phone}</div> : null}
                </div>

                <div style={{ textAlign: 'right', fontFamily: MONO, fontSize: 14, fontWeight: 600, color: u.orders > 0 ? '#FBFBFA' : '#4C4C51' }}>{u.orders}</div>

                {/* Sustituye a "Ciudad", que estaba vacía en 73 de 75 clientes. */}
                <div style={{ textAlign: 'right', fontFamily: MONO, fontSize: 13.5, fontWeight: 600, color: u.spent > 0 ? D.amber : '#4C4C51' }}>
                  {u.spent > 0 ? money(u.spent) : '—'}
                </div>

                <div style={{ textAlign: 'right', fontSize: 11.5, color: '#5C5C61' }}>
                  {u.createdAt ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(u.createdAt)) : '—'}
                </div>
              </div>
            );
          })}

          {items.length === 0 ? (
            <div style={{ padding: '56px 24px', textAlign: 'center' }}>
              <i className="ph ph-users" style={{ fontSize: 34, opacity: 0.4, display: 'block', marginBottom: 10 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#B4B4B9' }}>{q || segment ? 'Sin resultados' : 'Aún no hay clientes'}</div>
              <div style={{ fontSize: 13, color: '#7A7A7F', marginTop: 5 }}>
                {q || segment ? 'Prueba con otro término o quita el filtro.' : 'Los registros del sitio aparecerán aquí.'}
              </div>
            </div>
          ) : null}

          {/* Antes esto era un texto plano: 55 de 75 clientes eran inalcanzables. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '15px 24px', background: '#131315', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12.5, color: '#7A7A7F' }}>
              <span style={{ color: '#EDEDEC', fontWeight: 600 }}>{data?.total ?? 0}</span> clientes{segment ? ' en este filtro' : ''}{q ? ` para “${q}”` : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link href={link({ page: String(Math.max(1, page - 1)) })} className="cu-pg" style={{ width: 36, height: 36, background: '#1A1A1D', color: '#B4B4B9', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, fontSize: 15, display: 'grid', placeItems: 'center', textDecoration: 'none', opacity: page <= 1 ? 0.4 : 1, pointerEvents: page <= 1 ? 'none' : 'auto' }}>‹</Link>
              <span style={{ fontSize: 13, color: '#B4B4B9', fontWeight: 600, padding: '0 6px' }}>Página {page} / {pages}</span>
              <Link href={link({ page: String(Math.min(pages, page + 1)) })} className="cu-pg" style={{ width: 36, height: 36, background: '#1A1A1D', color: '#B4B4B9', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, fontSize: 15, display: 'grid', placeItems: 'center', textDecoration: 'none', opacity: page >= pages ? 0.4 : 1, pointerEvents: page >= pages ? 'none' : 'auto' }}>›</Link>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
