import type { Metadata } from 'next';
import { NOINDEX } from '@/lib/seo';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { OrderDetail } from '@maqserv/types';
import { SHIP_METHODS, fulfillmentStep, shipTracker, toShipMethod } from '@maqserv/types';
import { getTheme, t } from '@/lib/theme';
import { pedirOr, rutaCatalogo } from '@/lib/api';
import { SESSION_COOKIE } from '@/lib/session';
import { SiteHeader, SiteFooter } from '@/components/SiteHeader';
import { Icon } from '@/components/Icon';
import { OrderStatusLive } from '@/components/OrderStatusLive';
import { orderStatusLabel, toneColors } from '@/lib/order-status';
import { formatPrice } from '@/lib/format';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

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
  return { robots: NOINDEX, title: `${t(theme, 'order.title')} ${orderNumber} — ${t(theme, 'site.name')}` };
}

/** Estilos propios de la confirmación del pedido (prefijo `or-`). */
const CSS = `
.or-steps{ margin-bottom:28px; }
.or-title-row{ display:flex; align-items:center; gap:14px; }
.or-ok{ color:var(--color-success); background:color-mix(in srgb, var(--color-success) 10%, transparent); border-color:color-mix(in srgb, var(--color-success) 30%, transparent); }
.or-col{ display:grid; gap:16px; min-width:0; }
.or-card-t{ margin:0 0 12px; }
.or-line{ border-top:1px solid var(--color-border); }
.or-kv-v{ color:var(--color-text); font-weight:600; text-align:right; min-width:0; overflow-wrap:anywhere; }
.or-item{ display:flex; gap:14px; align-items:center; padding:12px 0; border-top:1px solid var(--color-border); }
.or-thumb{ width:56px; height:56px; flex-shrink:0; border-radius:8px; overflow:hidden; background:var(--color-bg); border:1px solid var(--color-border); display:block; }
.or-thumb img{ width:100%; height:100%; object-fit:cover; display:block; }
.or-aside{ position:sticky; top:20px; }
.or-total{ display:flex; justify-content:space-between; align-items:baseline; gap:12px; padding:16px 0 20px; border-top:1px solid var(--color-border); margin-top:8px; }
.or-instr{ line-height:1.7; color:var(--color-text-muted); font-size:14px; overflow-wrap:anywhere; }
@media (max-width: 960px){ .or-aside{ position:static; } }
`;

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
  const [theme, order, catalogo] = await Promise.all([getTheme(), fetchOrder(orderNumber), rutaCatalogo()]);
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
      <style>{CSS}</style>
      <div className="ms-page">
        <main className="ms-wrap">
          {/* Pasos: el pedido ya se creó, los tres están cumplidos. */}
          <ol className="ms-steps or-steps" aria-label="Pasos de la compra">
            {STEPS.map(([n, name], i) => (
              <li key={n} data-done={i < 2} data-on={i === 2}>
                <span>{i === 2 ? n : <Icon name="check" size={12} />}</span>
                {name}
              </li>
            ))}
          </ol>

          {/* Confirmación */}
          <header className="ms-head">
            <div className="ms-head-txt">
              <div className="or-title-row">
                <span className="ms-ico or-ok" aria-hidden><Icon name="check" size={20} /></span>
                <h1 className="ms-title">{t(theme, 'order.thanks')}</h1>
              </div>
              <p className="ms-desc">
                {t(theme, 'order.number')}: <strong className="ms-num" style={{ color: 'var(--color-text)' }}>{order.orderNumber}</strong> · {fmtDate(order.createdAt)}
              </p>
            </div>
          </header>

          <div className="ms-split">
            {/* Izquierda */}
            <div className="or-col">
              <section className="ms-panel">
                <h2 className="ms-h3 or-card-t">Estado del pedido</h2>
                <div className="ms-kv" style={{ alignItems: 'center', padding: '10px 0' }}>
                  <span>Pedido</span>
                  <span className="ms-chip ms-chip-dot" style={{ color: stc.fg, background: stc.bg, borderColor: stc.border }}>{st.text}</span>
                </div>
                {/* El pago se actualiza solo cuando el webhook confirma. */}
                <div className="or-line">
                  <OrderStatusLive orderNumber={order.orderNumber} label={t(theme, 'order.paymentStatus')} initialPaymentStatus={order.paymentStatus} />
                </div>
                <div className="ms-kv or-line" style={{ alignItems: 'center', padding: '10px 0' }}>
                  <span>{t(theme, 'order.method')}</span>
                  <span className="or-kv-v">{order.method || '—'}</span>
                </div>
                {step ? (
                  <p className="or-line" style={{ margin: 0, padding: '12px 0 0', fontSize: 14, lineHeight: 1.55, color: 'var(--color-text-muted)' }}>
                    {step.hint}
                  </p>
                ) : null}
              </section>

              {/* Envío: qué pasa con el equipo y cómo lo sigue el cliente. */}
              {ship && shipMethod && ship.state !== 'cancelado' ? (
                <section className="ms-panel">
                  <h2 className="ms-h3 or-card-t">Envío</h2>
                  <div className="ms-kv">
                    <span>Entrega</span>
                    <span className="or-kv-v">{SHIP_METHODS[shipMethod].label}</span>
                  </div>
                  {shipDetail ? (
                    <div className="ms-kv">
                      <span>{shipDetail.label}</span>
                      <span className="or-kv-v ms-num" style={{ maxWidth: '60%' }}>{shipDetail.value}</span>
                    </div>
                  ) : null}
                  {ship.scheduledAt ? (
                    <div className="ms-kv">
                      <span>Fecha estimada</span>
                      <span className="or-kv-v">{fmtDay(ship.scheduledAt)}</span>
                    </div>
                  ) : null}
                  {ship.notes ? (
                    <div className="ms-kv or-line" style={{ marginTop: 6, paddingTop: 14 }}>
                      <span>Indicaciones</span>
                      <span className="or-kv-v" style={{ maxWidth: '65%', lineHeight: 1.55, fontWeight: 400 }}>{ship.notes}</span>
                    </div>
                  ) : null}
                  <Link href={`/rastreo?orden=${encodeURIComponent(order.orderNumber)}&email=${encodeURIComponent(cust.email ?? '')}`} className="ms-link" style={{ marginTop: 14 }}>
                    Ver seguimiento completo<Icon name="arrowRight" size={14} />
                  </Link>
                </section>
              ) : null}

              {order.items.length > 0 ? (
                <section className="ms-panel">
                  <h2 className="ms-h3 or-card-t">{t(theme, 'order.items.title')}</h2>
                  {order.items.map((i) => (
                    <div key={i.productId} className="or-item">
                      <span className="or-thumb" style={{ backgroundImage: i.image ? undefined : stripe }}>
                        {i.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={i.image} alt="" />
                        ) : null}
                      </span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: 'block', fontSize: 15.5, fontWeight: 600, overflowWrap: 'anywhere' }}>{i.name}</span>
                        <span className="ms-small ms-muted ms-num" style={{ display: 'block', marginTop: 3 }}>
                          {i.qty} × {formatPrice(i.price)}{i.unitLabel ? ` / ${i.unitLabel}` : ''}
                        </span>
                      </span>
                      <strong className="ms-num" style={{ fontSize: 15, flexShrink: 0 }}>{formatPrice(i.price * i.qty)}</strong>
                    </div>
                  ))}
                </section>
              ) : null}

              {/* Datos de entrega: de aquí salió el cálculo del traslado. */}
              <section className="ms-panel">
                <h2 className="ms-h3 or-card-t">Datos de entrega</h2>
                <div className="ms-kv"><span>Nombre</span><span className="or-kv-v">{cust.name || '—'}</span></div>
                <div className="ms-kv"><span>Contacto</span><span className="or-kv-v">{[cust.phone, cust.email].filter(Boolean).join(' · ') || '—'}</span></div>
                <div className="ms-kv"><span>Dirección</span><span className="or-kv-v" style={{ maxWidth: '60%' }}>{shipping || '—'}</span></div>
                {order.note ? (
                  <div className="ms-kv or-line" style={{ marginTop: 6, paddingTop: 14 }}>
                    <span>Notas</span><span className="or-kv-v" style={{ maxWidth: '65%', lineHeight: 1.55, fontWeight: 400 }}>{order.note}</span>
                  </div>
                ) : null}
              </section>

              <InstructionsBlock theme={theme} method={order.method} />
            </div>

            {/* Derecha: lo que se cobró (congelado al crear la orden) */}
            <aside className="ms-panel or-aside">
              <h2 className="ms-h3 or-card-t">Desglose cobrado</h2>
              {tot ? (
                <>
                  <div className="ms-kv"><span>Subtotal</span><b>{formatPrice(tot.subtotal)}</b></div>
                  {tot.discount > 0 ? (
                    <div className="ms-kv" style={{ color: 'var(--color-success)' }}><span>Descuento</span><b style={{ color: 'var(--color-success)' }}>−{formatPrice(tot.discount)}</b></div>
                  ) : null}
                  {tot.operator > 0 ? (
                    <div className="ms-kv"><span>Operador</span><b>{formatPrice(tot.operator)}</b></div>
                  ) : null}
                  <div className="ms-kv">
                    <span>
                      {tot.freightLabel || 'Traslado'}
                      {tot.freightKm != null ? <span className="ms-num" style={{ display: 'block', fontSize: 12.5, opacity: 0.8 }}>{tot.freightKm.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km</span> : null}
                    </span>
                    {tot.freight > 0
                      ? <b style={{ flexShrink: 0 }}>{formatPrice(tot.freight)}</b>
                      : <span style={{ fontSize: 13, textAlign: 'right', lineHeight: 1.5, maxWidth: 170 }}>{tot.freightNote || 'A cotizar'}</span>}
                  </div>
                  {tot.tax > 0 ? (
                    <div className="ms-kv"><span>{tot.taxLabel} ({tot.taxRate}%)</span><b>{formatPrice(tot.tax)}</b></div>
                  ) : null}
                  {tot.taxIncluded ? (
                    <div className="ms-kv"><span>{tot.taxLabel} incluido ({tot.taxRate}%)</span><span>—</span></div>
                  ) : null}
                </>
              ) : (
                <p className="ms-small ms-muted" style={{ margin: '0 0 6px', lineHeight: 1.55 }}>
                  Este pedido viene del sistema anterior; solo se conserva el total cobrado.
                </p>
              )}

              <div className="or-total">
                <span style={{ fontSize: 16, fontWeight: 600 }}>{t(theme, 'cart.total')}</span>
                <span className="ms-stat-n" style={{ fontSize: 28 }}>{formatPrice(order.total)}</span>
              </div>

              <Link href="/cuenta/pedidos" className="ms-btn ms-btn-block">
                {t(theme, 'account.orders.title')}<Icon name="arrowRight" size={15} />
              </Link>
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <Link href={catalogo} className="ms-link ms-link-muted">Seguir explorando equipo</Link>
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
  const methods = await pedirOr<Array<{ id: string; instructions: string | null }>>(
    `${API_URL}/payments/methods`,
    { next: { revalidate: 60 } },
    [],
    Array.isArray,
  );
  const instructions = methods.find((m) => m.id === 'transferencia')?.instructions;
  if (!instructions) return null;
  return (
    <section className="ms-panel" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 40%, var(--color-border))' }}>
      <h2 className="ms-h3 or-card-t">{t(theme, 'order.instructions.title')}</h2>
      {/* HTML del panel (contenido del administrador), por eso se pinta tal cual. */}
      <div className="or-instr" dangerouslySetInnerHTML={{ __html: instructions }} />
    </section>
  );
}
