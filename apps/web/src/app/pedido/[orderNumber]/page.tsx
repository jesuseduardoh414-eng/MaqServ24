import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { OrderDetail } from '@maqserv/types';
import { SHIP_METHODS, fulfillmentStep, shipTracker, toShipMethod } from '@maqserv/types';
import { getTheme, t } from '@/lib/theme';
import { SESSION_COOKIE } from '@/lib/session';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';
import { OrderStatusLive } from '@/components/OrderStatusLive';
import { orderStatusLabel, toneColors } from '@/lib/order-status';
import { formatPrice } from '@/lib/format';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const MONO = 'var(--font-sans)';
const DISPLAY = 'var(--font-display)';
const STEPS: Array<[string, string]> = [['1', 'Carrito'], ['2', 'Datos'], ['3', 'Pago']];
const stripe = 'repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-text) 5%, transparent) 0 12px, transparent 12px 24px)';

type Params = { orderNumber: string };

async function fetchOrder(orderNumber: string): Promise<OrderDetail | null | 'unauthorized'> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return 'unauthorized';
  const res = await fetch(`${API_URL}/orders/${orderNumber}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store', signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 401) return 'unauthorized';
  if (!res.ok) return null;
  return (await res.json()) as OrderDetail;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const theme = await getTheme();
  const { orderNumber } = await params;
  return { title: `${t(theme, 'order.title')} ${orderNumber} — ${t(theme, 'site.name')}` };
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 4,
  padding: '22px 24px',
};

const legendStyle: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: 11,
  letterSpacing: '0.14em',
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  margin: '0 0 16px',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: '8px 0',
  fontSize: 14,
  color: 'var(--color-text-muted)',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

/** Solo fecha: la fecha comprometida del envío no tiene hora acordada — mostrar una la inventaría. */
function fmtDay(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(iso));
}

export default async function OrderPage({ params }: { params: Promise<Params> }) {
  const { orderNumber } = await params;
  const [theme, order] = await Promise.all([getTheme(), fetchOrder(orderNumber)]);
  if (order === 'unauthorized') redirect('/login');
  if (!order) notFound();

  // El estado del ENVÍO es el que se muestra; `order.status` (enum legacy) solo se
  // usa si el pedido es tan viejo que nunca pasó por el módulo de envíos.
  const ship = order.shipping;
  const shipMethod = toShipMethod(ship?.method);
  const step = ship ? fulfillmentStep(ship.state, shipMethod) : null;
  const st = step ? { text: step.label, tone: step.tone } : orderStatusLabel(order.status);
  const stc = toneColors(st.tone);
  const tot = order.totals; // null en órdenes del sistema viejo (cart en bzip2)
  const cust = order.customer;
  const shipping = [cust.address, cust.city, cust.zip ? `CP ${cust.zip}` : ''].filter(Boolean).join(', ');
  // Con qué dato sigue el cliente su pedido: guía, unidad o sucursal.
  const shipDetail = ship ? shipTracker(ship) : null;

  return (
    <>
      <SiteHeader theme={theme} />
      <div style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
        <style>{`
          @media (max-width: 900px){
            .or-grid{ grid-template-columns:1fr !important; gap:32px !important; }
            .or-wrap{ padding-left:22px !important; padding-right:22px !important; }
            .or-title{ font-size:34px !important; }
            .or-aside{ position:static !important; }
          }
        `}</style>

        <main className="or-wrap" style={{ maxWidth: 1280, margin: '0 auto', padding: '44px 40px 60px' }}>
          {/* Stepper: el pedido ya se creó, los tres pasos están cumplidos. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 40, flexWrap: 'wrap' }}>
            {STEPS.map(([n, name], i) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'grid', placeItems: 'center', gap: 6 }}>
                  <span style={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 14, fontWeight: 700, background: i === 2 ? 'var(--color-text)' : 'transparent', color: i === 2 ? 'var(--color-bg)' : 'var(--color-text)', border: '1px solid var(--color-text)' }}>{i === 2 ? n : <Icon name="check" size={14} />}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', color: 'var(--color-text)' }}>{name}</span>
                </div>
                {i < STEPS.length - 1 ? <span style={{ width: 90, height: 1, background: 'var(--color-text)', margin: '0 4px 18px' }} /> : null}
              </div>
            ))}
          </div>

          {/* Confirmación */}
          <div style={{ borderBottom: '2px solid var(--color-text)', paddingBottom: 22, marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <span style={{ width: 40, height: 40, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--color-success)', color: 'var(--color-bg)', fontSize: 21, fontWeight: 800 }} aria-hidden><Icon name="check" size={21} /></span>
              <h1 className="or-title" style={{ fontFamily: DISPLAY, margin: 0, fontSize: 44, fontWeight: 800, letterSpacing: '-0.04em' }}>{t(theme, 'order.thanks')}</h1>
            </div>
            <p style={{ margin: 0, fontFamily: MONO, fontSize: 12.5, letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
              {t(theme, 'order.number').toUpperCase()}: <strong style={{ color: 'var(--color-text)' }}>{order.orderNumber}</strong> · {fmtDate(order.createdAt)}
            </p>
          </div>

          <div className="or-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 56, alignItems: 'start' }}>
            {/* Izquierda */}
            <div style={{ display: 'grid', gap: 20 }}>
              <section style={cardStyle}>
                <h2 style={legendStyle}>Estado del pedido</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Pedido</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: stc.fg, background: stc.bg, border: `1px solid ${stc.border}`, borderRadius: 'var(--radius-button)', padding: '5px 12px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: stc.fg }} />
                    {st.text}
                  </span>
                </div>
                {/* El pago se actualiza solo cuando el webhook confirma. */}
                <OrderStatusLive orderNumber={order.orderNumber} label={t(theme, 'order.paymentStatus')} initialPaymentStatus={order.paymentStatus} />
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--color-border)' }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{t(theme, 'order.method')}</span>
                  <strong style={{ fontSize: 14 }}>{order.method || '—'}</strong>
                </div>
                {step ? (
                  <p style={{ margin: 0, padding: '12px 0 0', borderTop: '1px solid var(--color-border)', fontSize: 14, lineHeight: 1.55, color: 'var(--color-text-muted)' }}>
                    {step.hint}
                  </p>
                ) : null}
              </section>

              {/* Envío: qué pasa con el equipo y cómo lo sigue el cliente. */}
              {ship && shipMethod && ship.state !== 'cancelado' ? (
                <section style={cardStyle}>
                  <h2 style={legendStyle}>Envío</h2>
                  <div style={rowStyle}>
                    <span>Entrega</span>
                    <span style={{ color: 'var(--color-text)', fontWeight: 600, textAlign: 'right' }}>{SHIP_METHODS[shipMethod].label}</span>
                  </div>
                  {shipDetail ? (
                    <div style={rowStyle}>
                      <span>{shipDetail.label}</span>
                      <span style={{ fontFamily: MONO, color: 'var(--color-text)', fontWeight: 700, textAlign: 'right', maxWidth: '60%' }}>{shipDetail.value}</span>
                    </div>
                  ) : null}
                  {ship.scheduledAt ? (
                    <div style={rowStyle}>
                      <span>Fecha estimada</span>
                      <span style={{ color: 'var(--color-text)', fontWeight: 600, textAlign: 'right' }}>{fmtDay(ship.scheduledAt)}</span>
                    </div>
                  ) : null}
                  {ship.notes ? (
                    <div style={{ ...rowStyle, borderTop: '1px solid var(--color-border)', marginTop: 6, paddingTop: 14 }}>
                      <span>Indicaciones</span>
                      <span style={{ color: 'var(--color-text)', textAlign: 'right', maxWidth: '65%', lineHeight: 1.55 }}>{ship.notes}</span>
                    </div>
                  ) : null}
                  <Link href={`/rastreo?orden=${encodeURIComponent(order.orderNumber)}&email=${encodeURIComponent(cust.email ?? '')}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14, fontFamily: MONO, fontSize: 12, letterSpacing: '0.06em', fontWeight: 700, color: 'var(--color-primary)', textDecoration: 'none' }}>
                    VER SEGUIMIENTO COMPLETO<Icon name="arrowRight" size={12} />
                  </Link>
                </section>
              ) : null}

              {order.items.length > 0 ? (
                <section style={cardStyle}>
                  <h2 style={legendStyle}>{t(theme, 'order.items.title')}</h2>
                  {order.items.map((i) => (
                    <div key={i.productId} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--color-border)' }}>
                      <span style={{ width: 60, height: 60, flexShrink: 0, borderRadius: 3, overflow: 'hidden', background: 'var(--color-bg)', backgroundImage: i.image ? undefined : stripe, display: 'block' }}>
                        {i.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={i.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : null}
                      </span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: 'block', fontFamily: DISPLAY, fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>{i.name}</span>
                        <span style={{ display: 'block', fontFamily: MONO, fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3 }}>
                          {i.qty} × {formatPrice(i.price)}{i.unitLabel ? ` / ${i.unitLabel}` : ''}
                        </span>
                      </span>
                      <strong style={{ fontSize: 15, flexShrink: 0 }}>{formatPrice(i.price * i.qty)}</strong>
                    </div>
                  ))}
                </section>
              ) : null}

              {/* Datos de entrega: de aquí salió el cálculo del traslado. */}
              <section style={cardStyle}>
                <h2 style={legendStyle}>Datos de entrega</h2>
                <div style={rowStyle}><span>Nombre</span><span style={{ color: 'var(--color-text)', fontWeight: 600, textAlign: 'right' }}>{cust.name || '—'}</span></div>
                <div style={rowStyle}><span>Contacto</span><span style={{ color: 'var(--color-text)', fontWeight: 600, textAlign: 'right' }}>{[cust.phone, cust.email].filter(Boolean).join(' · ') || '—'}</span></div>
                <div style={rowStyle}><span>Dirección</span><span style={{ color: 'var(--color-text)', fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{shipping || '—'}</span></div>
                {order.note ? (
                  <div style={{ ...rowStyle, borderTop: '1px solid var(--color-border)', marginTop: 6, paddingTop: 14 }}>
                    <span>Notas</span><span style={{ color: 'var(--color-text)', textAlign: 'right', maxWidth: '65%', lineHeight: 1.55 }}>{order.note}</span>
                  </div>
                ) : null}
              </section>

              <InstructionsBlock theme={theme} method={order.method} />
            </div>

            {/* Derecha: lo que se cobró (congelado al crear la orden) */}
            <aside className="or-aside" style={{ position: 'sticky', top: 20, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.14em', color: 'var(--color-text-muted)', padding: '18px 24px 0', textTransform: 'uppercase' }}>Desglose cobrado</div>
              <div style={{ padding: '10px 24px 0' }}>
                {tot ? (
                  <>
                    <div style={rowStyle}><span>Subtotal</span><span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{formatPrice(tot.subtotal)}</span></div>
                    {tot.discount > 0 ? (
                      <div style={{ ...rowStyle, color: 'var(--color-success)' }}><span>Descuento</span><span style={{ fontWeight: 600 }}>−{formatPrice(tot.discount)}</span></div>
                    ) : null}
                    {tot.operator > 0 ? (
                      <div style={rowStyle}><span>Operador</span><span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{formatPrice(tot.operator)}</span></div>
                    ) : null}
                    <div style={rowStyle}>
                      <span>
                        {tot.freightLabel || 'Traslado'}
                        {tot.freightKm != null ? <span style={{ display: 'block', fontFamily: MONO, fontSize: 10, opacity: 0.75, letterSpacing: '0.06em' }}>{tot.freightKm.toLocaleString('es-MX', { maximumFractionDigits: 1 })} KM</span> : null}
                      </span>
                      {tot.freight > 0
                        ? <span style={{ color: 'var(--color-text)', fontWeight: 600, flexShrink: 0 }}>{formatPrice(tot.freight)}</span>
                        : <span style={{ fontFamily: MONO, fontSize: 11, textAlign: 'right', lineHeight: 1.5, maxWidth: 160 }}>{(tot.freightNote || 'A cotizar').toUpperCase()}</span>}
                    </div>
                    {tot.tax > 0 ? (
                      <div style={rowStyle}><span>{tot.taxLabel} ({tot.taxRate}%)</span><span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{formatPrice(tot.tax)}</span></div>
                    ) : null}
                    {tot.taxIncluded ? (
                      <div style={rowStyle}><span>{tot.taxLabel} incluido ({tot.taxRate}%)</span><span style={{ fontFamily: MONO, fontSize: 12 }}>—</span></div>
                    ) : null}
                  </>
                ) : (
                  <p style={{ margin: '0 0 6px', fontSize: 12.5, color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
                    Este pedido viene del sistema anterior; solo se conserva el total cobrado.
                  </p>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '18px 0 20px', borderTop: '1px solid var(--color-border)', marginTop: 8 }}>
                  <span style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 700 }}>{t(theme, 'cart.total')}</span>
                  <span style={{ fontFamily: DISPLAY, fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em' }}>{formatPrice(order.total)}</span>
                </div>

                <Link href="/cuenta/pedidos" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center', width: '100%', boxSizing: 'border-box', fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, background: 'var(--color-primary)', color: 'var(--color-primary-fg)', textDecoration: 'none', padding: 15, borderRadius: 'var(--radius-button)' }}>
                  {t(theme, 'account.orders.title')}<Icon name="arrowRight" size={15} />
                </Link>
                <Link href="/productos" style={{ display: 'block', textAlign: 'center', margin: '12px 0 20px', fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', color: 'var(--color-text-muted)', textDecoration: 'none', textTransform: 'uppercase' }}>
                  Seguir explorando equipo
                </Link>
              </div>
            </aside>
          </div>
        </main>
      </div>
      <SiteFooter theme={theme} />
    </>
  );
}

/** Instrucciones de pago para métodos offline (del gateway legacy, editable en Panel → Pagos). */
async function InstructionsBlock({ theme, method }: { theme: Awaited<ReturnType<typeof getTheme>>; method: string }) {
  // Con y sin tilde a proposito: los pedidos guardan el metodo como TEXTO, y en
  // la base conviven "Deposito bancario" (heredado) y "Depósito bancario".
  if (!/dep[oó]sito|transferencia/i.test(method)) return null;
  const methods = (await fetch(`${API_URL}/payments/methods`, { next: { revalidate: 60 } })
    .then((r) => r.json())
    .catch(() => [])) as Array<{ id: string; instructions: string | null }>;
  const instructions = methods.find((m) => m.id === 'transferencia')?.instructions;
  if (!instructions) return null;
  return (
    <section style={{ ...cardStyle, borderColor: 'color-mix(in srgb, var(--color-primary) 40%, var(--color-border))' }}>
      <h2 style={legendStyle}>{t(theme, 'order.instructions.title')}</h2>
      {/* HTML del panel (contenido del administrador), por eso se pinta tal cual. */}
      <div style={{ lineHeight: 1.7, color: 'var(--color-text-muted)', fontSize: 14 }} dangerouslySetInnerHTML={{ __html: instructions }} />
    </section>
  );
}
