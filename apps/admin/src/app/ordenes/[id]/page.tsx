import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { defaultTheme, themeTokensSchema } from '@maqserv/config';
import {
  SHIP_METHODS, fulfillmentFlow, fulfillmentStep, toShipMethod,
  type OrderEvent, type OrderItem, type OrderShipping, type OrderTotals,
} from '@maqserv/types';
import { adminFetch, getAdmin } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { D, FONT } from '@/components/design-tokens';
import { PAY_STATUS, labelOf, stateColor } from '../order-status';
import { ShippingPanel } from './ShippingPanel';

interface OrderDetailRow {
  id: number;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  method: string;
  total: number;
  totalQty: number;
  createdAt: string | null;
  items: OrderItem[];
  totals: OrderTotals | null;
  hasRental: boolean;
  shipping: OrderShipping | null;
  events: OrderEvent[];
  customer: { name: string | null; email: string | null; phone: string | null; address: string | null; city: string | null; zip: string | null };
  note: string | null;
  couponCode: string | null;
}
interface ThemeRow { id: number; active: boolean }
interface ThemeDetail { tokens: unknown }

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const card: React.CSSProperties = { background: D.card, border: `1px solid ${D.inputBorder}`, borderRadius: 16, padding: 22 };
const th: React.CSSProperties = { fontSize: 10.5, letterSpacing: '1px', fontWeight: 700, color: '#7A7A7F', textTransform: 'uppercase' };

const dt = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '—';
const day = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(iso)) : '—';

/** Detalle del pedido: la vista que faltaba para poder gestionar el envío. */
export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  const { id } = await params;

  // Orden y lista de temas en paralelo: son independientes. Antes eran 4 fetch
  // EN SERIE (admin → orden → temas → tema) ≈ 4 RTT a Render por pintar un pedido.
  const [o, themes] = await Promise.all([
    adminFetch<OrderDetailRow>(`/admin/orders/${id}`),
    adminFetch<ThemeRow[]>('/admin/themes').catch(() => [] as ThemeRow[]),
  ]);
  if (!o) notFound();

  // Las sucursales salen de Diseño → Contacto: son las mismas que ve el cliente.
  const active = (themes ?? []).find((t) => t.active) ?? (themes ?? [])[0] ?? null;
  const detail = active ? await adminFetch<ThemeDetail>(`/admin/themes/${active.id}`) : null;
  const tokens = detail?.tokens ? themeTokensSchema.parse(detail.tokens) : defaultTheme.tokens;
  const branches = tokens.contact.branches.map((b) => `${b.city} — ${b.address}`).filter((s) => s.trim() !== '—');

  const pay = labelOf(PAY_STATUS, o.paymentStatus);
  const shipping = o.shipping;
  const method = toShipMethod(shipping?.method);
  const flow = fulfillmentFlow(o.hasRental);
  const at = shipping ? flow.indexOf(shipping.state) : -1;
  const canceled = shipping?.state === 'cancelado';

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email}>
      <div style={{ fontFamily: FONT, color: D.text }}>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" />
        <style>{`
          .od-back:hover{ color:var(--color-primary); }
          @media (max-width: 1000px){ .od-grid{ grid-template-columns: 1fr !important; } }
        `}</style>

        {/* --- Encabezado --- */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#8A8A8F', fontWeight: 500 }}>
          <span>Ventas</span><span style={{ color: '#4C4C51' }}>/</span>
          <Link href="/ordenes" className="od-back" style={{ color: '#8A8A8F', textDecoration: 'none' }}>Órdenes</Link>
          <span style={{ color: '#4C4C51' }}>/</span>
          <span style={{ color: '#B4B4B9', fontFamily: MONO, fontSize: 12.5 }}>{o.orderNumber}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginTop: 8 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: '-0.8px', color: '#FBFBFA', fontFamily: MONO }}>{o.orderNumber}</h1>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#8A8A8F' }}>
              {day(o.createdAt)} · {o.totalQty} {o.totalQty === 1 ? 'equipo' : 'equipos'} · {o.method || 'sin método de pago'}
              {o.hasRental ? <span style={{ color: D.amber, fontWeight: 700 }}> · incluye renta</span> : null}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: pay.color, background: `color-mix(in srgb, ${pay.color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${pay.color} 26%, transparent)`, borderRadius: 20, padding: '6px 12px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: pay.color }} />
              {pay.label}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: '#FBFBFA' }}>{money(o.total)}</span>
          </div>
        </div>

        {/* --- Línea del flujo --- */}
        {shipping && !canceled ? (
          <div style={{ ...card, marginTop: 22, padding: '24px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto' }}>
              {flow.map((s, i) => {
                const done = at >= 0 && i <= at;
                const current = i === at;
                const c = done ? stateColor(s) : '#3A3A3F';
                return (
                  <div key={s} style={{ display: 'flex', alignItems: 'flex-start', flex: 1, minWidth: 92 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <span
                        style={{
                          width: current ? 16 : 12, height: current ? 16 : 12, borderRadius: '50%', flexShrink: 0,
                          background: done ? c : 'transparent', border: `2px solid ${c}`,
                          boxShadow: current ? `0 0 0 4px color-mix(in srgb, ${c} 22%, transparent)` : undefined,
                        }}
                      />
                      <span style={{ fontSize: 11.5, fontWeight: current ? 800 : 600, color: done ? '#EDEDEC' : '#5C5C61', marginTop: 9, textAlign: 'center', lineHeight: 1.3 }}>
                        {fulfillmentStep(s, method).label}
                      </span>
                    </div>
                    {i < flow.length - 1 ? (
                      <span style={{ height: 2, flex: 1, background: i < at ? stateColor(flow[i + 1]) : '#2A2A2F', marginTop: current ? 7 : 5, minWidth: 12 }} />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {canceled ? (
          <div style={{ ...card, marginTop: 22, borderColor: 'rgba(255,85,85,0.35)', background: 'rgba(255,85,85,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#f55' }}>Pedido cancelado</div>
            <div style={{ fontSize: 13, color: '#B4B4B9', marginTop: 4 }}>Ya no forma parte del flujo de envíos.</div>
          </div>
        ) : null}

        <div className="od-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 18, marginTop: 18, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 18 }}>
            {/* --- Productos --- */}
            <div style={card}>
              <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#FBFBFA' }}>Productos</h2>
              {o.items.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: '#7A7A7F' }}>
                  Este pedido viene del sistema anterior: su contenido está comprimido y solo se conserva el total.
                </p>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {o.items.map((it, i) => (
                    <div key={`${it.productId}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 13, paddingBottom: 12, borderBottom: i < o.items.length - 1 ? `1px solid ${D.cardBorder}` : undefined }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={it.image ?? ''} alt="" style={{ width: 46, height: 46, borderRadius: 8, objectFit: 'cover', background: '#1A1A1D', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#EDEDEC' }}>{it.name}</div>
                        <div style={{ fontFamily: MONO, fontSize: 11.5, color: '#7A7A7F', marginTop: 3 }}>
                          {it.qty} × {money(it.price)}{it.unitLabel ? ` / ${it.unitLabel}` : ''}
                        </div>
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 600, color: '#FBFBFA' }}>{money(it.price * it.qty)}</div>
                    </div>
                  ))}
                </div>
              )}

              {o.totals ? (
                <div style={{ borderTop: `1px solid ${D.cardBorder}`, marginTop: 14, paddingTop: 14, display: 'grid', gap: 7, fontSize: 12.5 }}>
                  <Row label="Subtotal" value={money(o.totals.subtotal)} />
                  {o.totals.discount > 0 ? <Row label={`Descuento${o.couponCode ? ` (${o.couponCode})` : ''}`} value={`−${money(o.totals.discount)}`} color="#3fbf8f" /> : null}
                  {o.totals.operator > 0 ? <Row label="Operador" value={money(o.totals.operator)} /> : null}
                  {o.totals.freight > 0 ? <Row label={o.totals.freightLabel || 'Traslado'} value={money(o.totals.freight)} /> : null}
                  {o.totals.tax > 0 ? <Row label={`${o.totals.taxLabel} ${o.totals.taxRate}%`} value={money(o.totals.tax)} /> : null}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${D.cardBorder}`, marginTop: 5, paddingTop: 9 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#EDEDEC' }}>Total</span>
                    <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: D.amber }}>{money(o.totals.total)}</span>
                  </div>
                </div>
              ) : null}
            </div>

            {/* --- Historial --- */}
            <div style={card}>
              <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#FBFBFA' }}>Historial del envío</h2>
              <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#7A7A7F' }}>Quién movió el pedido y cuándo.</p>
              {o.events.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: '#7A7A7F' }}>Todavía no hay movimientos.</p>
              ) : (
                <div style={{ display: 'grid' }}>
                  {[...o.events].reverse().map((e, i, arr) => {
                    const c = stateColor(e.to);
                    return (
                      <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 14, paddingBottom: i === arr.length - 1 ? 0 : 18 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: c, marginTop: 4, flexShrink: 0 }} />
                          {i < arr.length - 1 ? <span style={{ width: 2, flex: 1, background: '#2A2A2F', marginTop: 4 }} /> : null}
                        </div>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#EDEDEC' }}>
                            {fulfillmentStep(e.to, method).label}
                            {e.from ? <span style={{ fontWeight: 500, color: '#5C5C61' }}> · desde {fulfillmentStep(e.from, method).label}</span> : null}
                          </div>
                          {e.note ? <div style={{ fontSize: 12.5, color: '#8A8A8F', marginTop: 3 }}>{e.note}</div> : null}
                          <div style={{ fontFamily: MONO, fontSize: 11, color: '#5C5C61', marginTop: 4 }}>
                            {dt(e.at)} · {e.by ?? 'automático'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* --- Columna derecha --- */}
          <div style={{ display: 'grid', gap: 18 }}>
            {shipping ? (
              <ShippingPanel orderId={o.id} shipping={shipping} hasRental={o.hasRental} branches={branches} />
            ) : (
              <div style={card}>
                <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#FBFBFA' }}>Envío</h2>
                <p style={{ margin: 0, fontSize: 13, color: '#7A7A7F' }}>Este pedido no tiene envío registrado.</p>
              </div>
            )}

            {/* --- Datos de entrega --- */}
            <div style={card}>
              <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#FBFBFA' }}>Datos de entrega</h2>
              <div style={{ display: 'grid', gap: 13, fontSize: 13 }}>
                <Field label="Cliente" value={o.customer.name} />
                <Field label="Correo" value={o.customer.email} mono />
                <Field label="Teléfono" value={o.customer.phone} mono />
                <Field label="Dirección" value={[o.customer.address, o.customer.city, o.customer.zip ? `CP ${o.customer.zip}` : null].filter(Boolean).join(', ') || null} />
              </div>
              {o.note ? (
                <div style={{ borderTop: `1px solid ${D.cardBorder}`, marginTop: 15, paddingTop: 13 }}>
                  <span style={{ ...th, display: 'block', marginBottom: 6 }}>Nota del cliente</span>
                  <p style={{ margin: 0, fontSize: 13, color: '#B4B4B9', lineHeight: 1.5 }}>{o.note}</p>
                </div>
              ) : null}
            </div>

            {/* Fechas selladas por el propio flujo: no se capturan a mano. */}
            {shipping && (shipping.scheduledAt || shipping.shippedAt || shipping.deliveredAt || shipping.returnedAt) ? (
              <div style={card}>
                <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#FBFBFA' }}>Fechas</h2>
                <div style={{ display: 'grid', gap: 13, fontSize: 13 }}>
                  {shipping.scheduledAt ? <Field label="Comprometida" value={day(shipping.scheduledAt)} /> : null}
                  {shipping.shippedAt ? <Field label={method === 'sucursal' ? 'Listo en sucursal' : 'Salió'} value={dt(shipping.shippedAt)} /> : null}
                  {shipping.deliveredAt ? <Field label="Entregado" value={dt(shipping.deliveredAt)} /> : null}
                  {shipping.returnedAt ? <Field label="Recolectado" value={dt(shipping.returnedAt)} /> : null}
                </div>
              </div>
            ) : null}

            {method ? (
              <p style={{ margin: 0, fontSize: 11.5, color: '#5C5C61', lineHeight: 1.55 }}>
                <strong style={{ color: '#7A7A7F' }}>{SHIP_METHODS[method].label}:</strong> {SHIP_METHODS[method].hint}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: '#8A8A8F' }}>{label}</span>
      <span style={{ fontFamily: MONO, color: color ?? '#B4B4B9' }}>{value}</span>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <span style={{ ...th, display: 'block', marginBottom: 4 }}>{label}</span>
      <span style={{ color: value ? '#EDEDEC' : '#5C5C61', fontFamily: mono ? MONO : 'inherit', fontSize: mono ? 12.5 : 13.5, wordBreak: 'break-word' }}>
        {value ?? '—'}
      </span>
    </div>
  );
}
