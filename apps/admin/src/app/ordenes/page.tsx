import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SHIP_METHODS, fulfillmentStep, shipTracker, toFulfillment, toShipMethod, type OrderShipping } from '@maqserv/types';
import { adminFetch, getAdmin } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
// La paleta y los mapas de estado se importan de módulos SIN 'use client':
// esta página es un componente de servidor y no puede llamar código de cliente.
import { D, FONT } from '@/components/design-tokens';
import { PAY_STATUS, stateColor } from './order-status';
import { OrdersSearch, StatusPicker } from './OrderControls';

interface OrderRow {
  id: number;
  orderNumber: string;
  customer: string | null;
  email: string | null;
  method: string | null;
  total: number;
  status: string;
  paymentStatus: string;
  createdAt: string | null;
  shipping: OrderShipping | null;
}

interface OrdersResponse {
  items: OrderRow[];
  page: number;
  pages: number;
  total: number;
  counts: Record<string, number>;
}

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const GREEN = '#3fbf8f';
const BLUE = '#5b9dff';
const GRID = '1.25fr 1.75fr 0.95fr 1.35fr 1.1fr 1.05fr';
const DAY = 86_400_000;

/**
 * Pestañas del flujo del envío. No están todos los estados: `en_renta` y `recolectado`
 * solo aplican a rentas y `pagado`/`cerrado` se ven dentro del pedido — la lista es
 * para trabajar la cola del día, no para auditar.
 */
const TABS: Array<{ key: string; label: string }> = [
  { key: '', label: 'Todas' },
  { key: 'pendiente', label: 'Sin pagar' },
  { key: 'pagado', label: 'Por preparar' },
  { key: 'preparando', label: 'Preparando' },
  { key: 'enviado', label: 'En camino' },
  { key: 'entregado', label: 'Entregadas' },
];

const th: React.CSSProperties = { fontSize: 10.5, letterSpacing: '1px', fontWeight: 700, color: '#7A7A7F' };
const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const statCard: React.CSSProperties = { minWidth: 150, background: D.card, border: `1px solid ${D.inputBorder}`, borderRadius: 14, padding: '14px 18px' };

const ageLabel = (d: number) => (d === 0 ? 'Hoy' : d === 1 ? 'Ayer' : `hace ${d} días`);

/** Cómo sale el equipo + el dato con el que se sigue (`shipTracker` es compartido). */
function shipSummary(s: OrderShipping): { label: string; value: string } | null {
  const m = toShipMethod(s.method);
  if (!m) return null;
  return { label: SHIP_METHODS[m].label, value: shipTracker(s)?.value ?? 'Sin datos' };
}

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; state?: string; search?: string }>;
}) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  const sp = await searchParams;
  const state = sp.state ?? '';
  const search = sp.search ?? '';

  // Filtros y paginación los resuelve la API: la tabla puede crecer sin límite.
  const qs = new URLSearchParams({ page: String(sp.page ?? 1) });
  if (state) qs.set('state', state);
  if (search) qs.set('search', search);
  const data = await adminFetch<OrdersResponse>(`/admin/orders?${qs.toString()}`);

  const items = data?.items ?? [];
  const counts = data?.counts ?? {};
  const page = data?.page ?? 1;
  const pages = data?.pages ?? 1;

  // La antigüedad se calcula en el SERVIDOR para no romper la hidratación.
  const now = Date.now();
  const link = (patch: Record<string, string | undefined>) => {
    const n = new URLSearchParams();
    const merged = { state, search, page: String(page), ...patch };
    for (const [k, v] of Object.entries(merged)) if (v && v !== '1') n.set(k, v);
    const s = n.toString();
    return s ? `/ordenes?${s}` : '/ordenes';
  };

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email}>
      <div style={{ fontFamily: FONT, color: D.text }}>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" />
        <style>{`
          .or-row:hover{ background: rgba(255,255,255,0.022); }
          .or-tab:hover{ background: rgba(255,255,255,0.05); color:#f5f5f4; }
          .or-opt:hover{ background: rgba(255,255,255,0.07) !important; }
          .or-pg:hover{ background: rgba(255,255,255,0.06); color:#f5f5f4; }
          .or-folio:hover{ color:var(--color-primary); text-decoration: underline; }
          .or-badge:hover{ filter: brightness(1.35); }
          @media (max-width: 1200px){ .or-grid{ grid-template-columns: 1fr 1fr !important; row-gap: 10px !important; } .or-head{ display:none !important; } }
          /* Los 3 contadores piden 150px cada uno: en móvil se reparten en
             rejilla en vez de salirse de la pantalla. */
          @media (max-width: 620px){
            .or-stats{ display:grid !important; grid-template-columns: 1fr 1fr; width:100%; }
            .or-stats > div{ min-width:0 !important; }
            .or-stats > div:first-child{ grid-column: 1 / -1; }
          }
        `}</style>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#8A8A8F', fontWeight: 500 }}>
              <span>Ventas</span><span style={{ color: '#4C4C51' }}>/</span><span style={{ color: '#B4B4B9' }}>Órdenes</span>
            </div>
            <h1 style={{ margin: '8px 0 0', fontSize: 30, fontWeight: 800, letterSpacing: '-0.8px', color: '#FBFBFA' }}>Órdenes</h1>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#8A8A8F' }}>Abre un pedido para gestionar su envío. Cada cambio le avisa al cliente.</p>
          </div>
          <div className="or-stats" style={{ display: 'flex', gap: 12 }}>
            <div style={statCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: D.amber, boxShadow: `0 0 10px ${D.amber}b3` }} />
                <span style={{ fontSize: 12, color: '#8A8A8F', fontWeight: 600 }}>Por preparar</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: D.amber, fontFamily: MONO }}>{counts.pagado ?? 0}</div>
            </div>
            <div style={statCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: BLUE, boxShadow: `0 0 10px ${BLUE}99` }} />
                <span style={{ fontSize: 12, color: '#8A8A8F', fontWeight: 600 }}>En camino</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: BLUE, fontFamily: MONO }}>{counts.enviado ?? 0}</div>
            </div>
            <div style={statCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN, boxShadow: `0 0 10px ${GREEN}99` }} />
                <span style={{ fontSize: 12, color: '#8A8A8F', fontWeight: 600 }}>Entregadas</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: GREEN, fontFamily: MONO }}>{(counts.entregado ?? 0) + (counts.cerrado ?? 0)}</div>
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
                  href={link({ state: t.key || undefined, page: undefined })}
                  className={on ? undefined : 'or-tab'}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', fontSize: 13.5, fontWeight: on ? 700 : 600, padding: '8px 16px', borderRadius: 9, background: on ? D.amber : 'transparent', color: on ? 'var(--color-primary-fg)' : '#9A9A9F' }}
                >
                  {t.label}
                  <span style={{ background: on ? 'rgba(26,18,6,0.22)' : 'rgba(255,255,255,0.08)', padding: '1px 7px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>{n}</span>
                </Link>
              );
            })}
          </div>
          <OrdersSearch initial={search} />
        </div>

        <div style={{ marginTop: 18, background: '#0F0F11', border: `1px solid ${D.inputBorder}`, borderRadius: 16, overflow: 'hidden' }}>
          <div className="or-head" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 16, padding: '15px 24px', borderBottom: `1px solid ${D.cardBorder}`, background: '#131315' }}>
            <div style={th}>ORDEN</div>
            <div style={th}>CLIENTE</div>
            <div style={{ ...th, textAlign: 'right' }}>TOTAL</div>
            <div style={th}>ENVÍO</div>
            <div style={th}>PAGO</div>
            <div style={th}>ESTADO</div>
          </div>

          {items.map((o) => {
            const ts = o.createdAt ? new Date(o.createdAt).getTime() : null;
            const days = ts ? Math.max(0, Math.floor((now - ts) / DAY)) : 0;
            const fs = toFulfillment(o.shipping?.state);
            // El estado del envío manda; el `status` legacy solo se usa si la orden
            // es tan vieja que nunca pasó por el módulo.
            const step = fs ? fulfillmentStep(fs, toShipMethod(o.shipping?.method)) : null;
            const color = fs ? stateColor(fs) : D.muted2;
            const ship = o.shipping ? shipSummary(o.shipping) : null;
            return (
              <div key={o.id} className="or-row or-grid" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 16, padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.045)', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ width: 3, alignSelf: 'stretch', minHeight: 32, borderRadius: 3, background: color, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <Link href={`/ordenes/${o.id}`} className="or-folio" style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: '#EDEDEC', textDecoration: 'none' }}>
                      {o.orderNumber}
                    </Link>
                    <div style={{ fontSize: 11, color: '#5C5C61', marginTop: 4 }}>
                      {ts ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(ts)) : '—'} · {ageLabel(days)}
                    </div>
                  </div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#EDEDEC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.customer ?? '—'}</div>
                  <div style={{ fontSize: 11.5, color: '#7A7A7F', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.email ?? ''}</div>
                </div>

                <div style={{ textAlign: 'right', fontFamily: MONO, fontSize: 14, fontWeight: 600, color: '#FBFBFA' }}>{money(o.total)}</div>

                <div style={{ minWidth: 0 }}>
                  {ship ? (
                    <>
                      <div style={{ fontSize: 12.5, color: '#B4B4B9', fontWeight: 600 }}>{ship.label}</div>
                      <div style={{ fontFamily: MONO, fontSize: 11, color: '#7A7A7F', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ship.value}</div>
                    </>
                  ) : (
                    <span style={{ fontSize: 12.5, color: '#5C5C61' }}>Sin definir</span>
                  )}
                </div>

                <div>
                  <StatusPicker orderId={o.id} field="paymentStatus" value={o.paymentStatus} options={['Pending', 'Completed']} map={PAY_STATUS} />
                </div>
                {/* El envío NO se cambia desde la lista: mover un pedido exige ver sus
                    datos (guía, unidad, sucursal). Por eso aquí solo se muestra. */}
                <div>
                  <Link
                    href={`/ordenes/${o.id}`}
                    className="or-badge"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none',
                      fontSize: 12, fontWeight: 700, color, whiteSpace: 'nowrap',
                      background: `color-mix(in srgb, ${color} 10%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${color} 26%, transparent)`,
                      borderRadius: 20, padding: '5px 11px',
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    {step?.label ?? 'Sin envío'}
                  </Link>
                </div>
              </div>
            );
          })}

          {items.length === 0 ? (
            <div style={{ padding: '56px 24px', textAlign: 'center' }}>
              <i className="ph ph-receipt" style={{ fontSize: 34, opacity: 0.4, display: 'block', marginBottom: 10 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#B4B4B9' }}>{search || state ?'Sin resultados' : 'Aún no hay órdenes'}</div>
              <div style={{ fontSize: 13, color: '#7A7A7F', marginTop: 5 }}>
                {search || state ?'Prueba con otro término o quita el filtro.' : 'Las compras del sitio aparecerán aquí.'}
              </div>
            </div>
          ) : null}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '15px 24px', background: '#131315', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12.5, color: '#7A7A7F' }}>
              <span style={{ color: '#EDEDEC', fontWeight: 600 }}>{data?.total ?? 0}</span> órdenes{state ? ' en este filtro' : ''}{search ? ` para “${search}”` : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link href={link({ page: String(Math.max(1, page - 1)) })} aria-disabled={page <= 1} className="or-pg" style={{ width: 36, height: 36, background: '#1A1A1D', color: '#B4B4B9', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, fontSize: 15, display: 'grid', placeItems: 'center', textDecoration: 'none', opacity: page <= 1 ? 0.4 : 1, pointerEvents: page <= 1 ? 'none' : 'auto' }}>‹</Link>
              <span style={{ fontSize: 13, color: '#B4B4B9', fontWeight: 600, padding: '0 6px' }}>Página {page} / {pages}</span>
              <Link href={link({ page: String(Math.min(pages, page + 1)) })} aria-disabled={page >= pages} className="or-pg" style={{ width: 36, height: 36, background: '#1A1A1D', color: '#B4B4B9', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, fontSize: 15, display: 'grid', placeItems: 'center', textDecoration: 'none', opacity: page >= pages ? 0.4 : 1, pointerEvents: page >= pages ? 'none' : 'auto' }}>›</Link>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
