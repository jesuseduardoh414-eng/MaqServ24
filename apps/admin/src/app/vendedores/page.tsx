import Link from 'next/link';
import { redirect } from 'next/navigation';
import { adminFetch, getAdmin } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
// Paleta y estados en módulos SIN 'use client': esta página es de servidor y no
// puede llamar funciones que exporte un módulo de cliente.
import { D, FONT } from '@/components/design-tokens';
import { vendorStatus } from './vendor-status';
import { VendorActions } from './VendorActions';

interface VendorRow {
  id: number;
  name: string;
  email: string;
  shopName: string | null;
  status: number;
  balance: number;
  createdAt: string | null;
  products: number;
  sales: number;
  sold: number;
  pendingWithdraws: number;
}

interface VendorsResponse {
  items: VendorRow[];
  counts: Record<string, number>;
}

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const GREEN = '#3fbf8f';
const GRID = '1.7fr 1.5fr 1fr 1fr 0.9fr 1.5fr';

const TABS: Array<{ key: string; label: string }> = [
  { key: '', label: 'Todos' },
  { key: 'pendiente', label: 'Por aprobar' },
  { key: 'aprobado', label: 'Aprobados' },
  { key: 'revocado', label: 'Revocados' },
];

const th: React.CSSProperties = { fontSize: 10.5, letterSpacing: '1px', fontWeight: 700, color: '#7A7A7F' };
const money = (n: number) => `$${n.toLocaleString('es-MX')}`;
const statCard: React.CSSProperties = { minWidth: 150, background: D.card, border: `1px solid ${D.inputBorder}`, borderRadius: 14, padding: '14px 18px' };

/** Marketplace → Vendedores: la puerta de entrada al marketplace. */
export default async function AdminVendors({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  const sp = await searchParams;
  const state = sp.state ?? '';

  const data = await adminFetch<VendorsResponse>(`/admin/vendors${state ? `?state=${state}` : ''}`);
  const items = data?.items ?? [];
  const counts = data?.counts ?? {};

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email}>
      <div style={{ fontFamily: FONT, color: D.text }}>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" />
        <style>{`
          .vn-row:hover{ background: rgba(255,255,255,0.022); }
          .vn-tab:hover{ background: rgba(255,255,255,0.05); color:#f5f5f4; }
          .vn-shop:hover{ color:var(--color-primary); text-decoration: underline; }
          @media (max-width: 1200px){ .vn-grid{ grid-template-columns: 1fr 1fr !important; row-gap: 10px !important; } .vn-head{ display:none !important; } }
        `}</style>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#8A8A8F', fontWeight: 500 }}>
              <span>Marketplace</span><span style={{ color: '#4C4C51' }}>/</span><span style={{ color: '#B4B4B9' }}>Vendedores</span>
            </div>
            <h1 style={{ margin: '8px 0 0', fontSize: 30, fontWeight: 800, letterSpacing: '-0.8px', color: '#FBFBFA' }}>Vendedores</h1>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#8A8A8F' }}>
              Quién puede publicar equipo en el catálogo. Abre una solicitud para leerla antes de aprobar.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={statCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: D.amber, boxShadow: `0 0 10px ${D.amber}b3` }} />
                <span style={{ fontSize: 12, color: '#8A8A8F', fontWeight: 600 }}>Por aprobar</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: D.amber, fontFamily: MONO }}>{counts.pendiente ?? 0}</div>
            </div>
            <div style={statCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN, boxShadow: `0 0 10px ${GREEN}99` }} />
                <span style={{ fontSize: 12, color: '#8A8A8F', fontWeight: 600 }}>Vendiendo</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: GREEN, fontFamily: MONO }}>{counts.aprobado ?? 0}</div>
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
                  href={t.key ? `/vendedores?state=${t.key}` : '/vendedores'}
                  className={on ? undefined : 'vn-tab'}
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
          <div className="vn-head" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 16, padding: '15px 24px', borderBottom: `1px solid ${D.cardBorder}`, background: '#131315' }}>
            <div style={th}>TIENDA</div>
            <div style={th}>TITULAR</div>
            <div style={{ ...th, textAlign: 'right' }}>SALDO</div>
            <div style={th}>ACTIVIDAD</div>
            <div style={th}>ESTADO</div>
            <div style={{ ...th, textAlign: 'right' }}>ACCIONES</div>
          </div>

          {items.map((v) => {
            const st = vendorStatus(v.status);
            return (
              <div key={v.id} className="vn-row vn-grid" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 16, padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.045)', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
                  <span style={{ width: 3, alignSelf: 'stretch', minHeight: 32, borderRadius: 3, background: st.color, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <Link href={`/vendedores/${v.id}`} className="vn-shop" style={{ fontSize: 13.5, fontWeight: 700, color: '#EDEDEC', textDecoration: 'none' }}>
                      {v.shopName ?? '—'}
                    </Link>
                    <div style={{ fontSize: 11, color: '#5C5C61', marginTop: 4 }}>
                      {v.products} {v.products === 1 ? 'producto' : 'productos'} publicados
                    </div>
                  </div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#EDEDEC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</div>
                  <div style={{ fontSize: 11.5, color: '#7A7A7F', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.email}</div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: v.balance > 0 ? '#FBFBFA' : '#5C5C61' }}>{money(v.balance)}</div>
                  {/* Un retiro pendiente es dinero que el vendedor ya pidió: no debe pasar inadvertido. */}
                  {v.pendingWithdraws > 0 ? (
                    <Link href="/retiros" style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 700, color: D.amber, marginTop: 4, textDecoration: 'none' }}>
                      {v.pendingWithdraws} retiro{v.pendingWithdraws === 1 ? '' : 's'} por pagar →
                    </Link>
                  ) : null}
                </div>

                <div>
                  <div style={{ fontFamily: MONO, fontSize: 12.5, color: '#B4B4B9' }}>{v.sales} {v.sales === 1 ? 'venta' : 'ventas'}</div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: '#5C5C61', marginTop: 3 }}>{money(v.sold)}</div>
                </div>

                <div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: st.color, whiteSpace: 'nowrap', background: `color-mix(in srgb, ${st.color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${st.color} 26%, transparent)`, borderRadius: 20, padding: '5px 11px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.color, flexShrink: 0 }} />
                    {st.label}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <VendorActions vendorId={v.id} status={v.status} />
                </div>
              </div>
            );
          })}

          {items.length === 0 ? (
            <div style={{ padding: '56px 24px', textAlign: 'center' }}>
              <i className="ph ph-storefront" style={{ fontSize: 34, opacity: 0.4, display: 'block', marginBottom: 10 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#B4B4B9' }}>
                {state ? 'Sin vendedores en este filtro' : 'Todavía no hay vendedores'}
              </div>
              <div style={{ fontSize: 13, color: '#7A7A7F', marginTop: 5, maxWidth: 460, marginInline: 'auto', lineHeight: 1.5 }}>
                {state
                  ? 'Prueba con otra pestaña.'
                  : 'El marketplace está listo pero nadie ha solicitado vender. Las solicitudes llegan cuando un cliente se registra como vendedor desde el sitio.'}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AdminShell>
  );
}
