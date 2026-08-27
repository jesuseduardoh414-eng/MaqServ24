'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AuthUser, CheckoutResult, CouponCheck, PaymentMethod, PaymentMethodId } from '@maqserv/types';
import type { CheckoutConfig } from '@maqserv/config';
import { cartLineTotal, useCart } from '@/components/CartProvider';
import { Icon } from '@/components/Icon';
import { FREIGHT_ADDRESS_KEY, freightCostOf, useFreightQuote } from '@/components/useFreightQuote';
import { formatPrice } from '@/lib/format';

const MONO = "'Inter', system-ui, sans-serif";
const DISPLAY = 'var(--font-display)';

const STEPS: Array<[string, string]> = [['1', 'Carrito'], ['2', 'Datos'], ['3', 'Pago']];
const ACTIVE_STEP = 1; // Datos

const stripe = 'repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-text) 5%, transparent) 0 12px, transparent 12px 24px)';

const fieldStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '13px 14px',
  fontSize: 14.5,
  fontFamily: 'inherit',
  color: 'var(--color-text)',
  background: 'var(--color-bg)',
  border: '1px solid var(--color-border)',
  borderRadius: 4,
  outline: 'none',
};

const legendStyle: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: 11,
  letterSpacing: '0.14em',
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  margin: '0 0 14px',
};

/** Las instrucciones del gateway vienen con HTML legacy (`<font>`): se muestran como texto. */
function plainText(html: string | null, max = 130): string {
  if (!html) return '';
  const s = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max).trimEnd()}…` : s;
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: '8px 0',
  fontSize: 14,
  color: 'var(--color-text-muted)',
};

export function CheckoutForm({
  user,
  config,
  methods,
  labels,
}: {
  user: AuthUser;
  config: CheckoutConfig;
  methods: PaymentMethod[];
  labels: {
    title: string;
    contactTitle: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    zip: string;
    note: string;
    methodTitle: string;
    summaryTitle: string;
    submit: string;
    emptyCart: string;
    browse: string;
    total: string;
    couponLabel: string;
    couponApply: string;
    couponApplied: string;
    couponInvalid: string;
    discount: string;
  };
}) {
  const cart = useCart();
  const router = useRouter();
  const available = methods.filter((m) => m.available);
  const [method, setMethod] = useState<PaymentMethodId>(available[0]?.id ?? 'transferencia');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<CouponCheck | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Traslado: se recotiza solo conforme el cliente escribe su dirección.
  const freightCfg = config.freight;
  const { quote: freight, loading: freightLoading, run: quoteFreight } = useFreightQuote();
  const [addr, setAddr] = useState(user.address ?? '');
  const [city, setCity] = useState(user.city ?? '');
  const [zip, setZip] = useState(user.zip ?? '');
  const freightAddress = [addr, city, zip ? `CP ${zip}` : ''].filter(Boolean).join(', ');
  const freightKey = cart.items.map((i) => `${i.productId}:${i.qty}`).join(',');

  useEffect(() => {
    if (!freightCfg.enabled || freightCfg.mode === 'quote' || !freightKey) return;
    const items = cart.items.map((i) => ({ productId: i.productId, qty: i.qty }));
    if (freightCfg.mode === 'flat') { quoteFreight('', items); return; }
    if (freightAddress.trim().length < 5) return;
    const t = setTimeout(() => {
      localStorage.setItem(FREIGHT_ADDRESS_KEY, freightAddress);
      quoteFreight(freightAddress, items);
    }, 700); // no pegarle a la API en cada tecla
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freightAddress, freightKey, freightCfg.enabled, freightCfg.mode]);

  async function applyCoupon() {
    setCouponError(null);
    setCoupon(null);
    const code = couponInput.trim();
    if (!code) return;
    const res = await fetch('/api/proxy/orders/coupon/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotal: cart.total }),
    });
    const data = (await res.json().catch(() => null)) as CouponCheck | null;
    if (res.ok && data?.valid) setCoupon(data);
    else setCouponError(labels.couponInvalid);
  }

  // Mismo cálculo que el carrito y que el servidor (Panel → Pagos manda).
  const discount = coupon?.valid ? coupon.discount : 0;
  const operatorCost = cart.operator && config.operator.enabled ? cart.count * config.operator.amount : 0;
  const freightCost = freightCostOf(freight);
  const taxable = Math.max(0, cart.total - discount) + operatorCost + freightCost;
  const taxAdds = config.tax.enabled && !config.tax.included;
  const tax = taxAdds ? taxable * (config.tax.rate / 100) : 0;
  const includedTax = config.tax.enabled && config.tax.included ? taxable - taxable / (1 + config.tax.rate / 100) : 0;
  const finalTotal = taxable + tax;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart.items.map((i) => ({
          productId: i.productId,
          qty: i.qty,
          ...(i.period ? { period: i.period } : {}),
        })),
        method,
        ...(coupon?.valid ? { couponCode: coupon.code } : {}),
        ...(cart.operator ? { operator: true } : {}),
        customer: {
          name: String(form.get('name') ?? ''),
          email: String(form.get('email') ?? ''),
          phone: String(form.get('phone') ?? ''),
          address: String(form.get('address') ?? ''),
          city: String(form.get('city') ?? ''),
          zip: String(form.get('zip') ?? ''),
        },
        note: String(form.get('note') ?? '') || undefined,
      }),
    });
    const data = (await res.json().catch(() => null)) as CheckoutResult | { message?: string } | null;
    setLoading(false);
    if (!res.ok || !data || !('order' in data)) {
      setError((data as { message?: string } | null)?.message ?? 'No pudimos procesar tu pedido');
      return;
    }
    cart.clear();
    if (data.redirectUrl) {
      window.location.href = data.redirectUrl; // MercadoPago Checkout Pro
      return;
    }
    router.push(`/pedido/${data.order.orderNumber}`);
  }

  const shell = (children: React.ReactNode) => (
    <div style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" />
      <style>{`
        @media (max-width: 900px){
          .co-grid{ grid-template-columns:1fr !important; gap:32px !important; }
          .co-wrap{ padding-left:22px !important; padding-right:22px !important; }
          .co-title{ font-size:36px !important; }
          .co-aside{ position:static !important; }
        }
        @media (max-width: 560px){ .co-two{ grid-template-columns:1fr !important; } }
        .co-field:focus{ border-color: var(--color-text) !important; }
      `}</style>
      <main className="co-wrap" style={{ maxWidth: 1280, margin: '0 auto', padding: '44px 40px 60px' }}>
        {/* Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 40, flexWrap: 'wrap' }}>
          {STEPS.map(([n, name], i) => {
            const done = i < ACTIVE_STEP;
            const on = i === ACTIVE_STEP;
            const strong = done || on;
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'grid', placeItems: 'center', gap: 6 }}>
                  <span style={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 14, fontWeight: 700, background: on ? 'var(--color-text)' : 'transparent', color: on ? 'var(--color-bg)' : strong ? 'var(--color-text)' : 'var(--color-text-muted)', border: `1px solid ${strong ? 'var(--color-text)' : 'var(--color-border)'}` }}>{done ? <Icon name="check" size={14} /> : n}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', color: strong ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{name}</span>
                </div>
                {i < STEPS.length - 1 ? <span style={{ width: 90, height: 1, background: i < ACTIVE_STEP ? 'var(--color-text)' : 'var(--color-border)', margin: '0 4px 18px' }} /> : null}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, borderBottom: '2px solid var(--color-text)', paddingBottom: 20, marginBottom: 28, flexWrap: 'wrap' }}>
          <h1 className="co-title" style={{ fontFamily: DISPLAY, margin: 0, fontSize: 48, fontWeight: 800, letterSpacing: '-0.04em' }}>{labels.title}</h1>
          <Link href="/carrito" style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.06em', color: 'var(--color-text-muted)', textDecoration: 'none', marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="arrowLeft" size={12} />VOLVER AL CARRITO</Link>
        </div>

        {children}
      </main>
    </div>
  );

  if (cart.items.length === 0) {
    return shell(
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>🛒</div>
        <h2 style={{ fontFamily: DISPLAY, margin: '0 0 12px', fontSize: 30, fontWeight: 700 }}>{labels.emptyCart}</h2>
        <p style={{ margin: '0 0 28px', color: 'var(--color-text-muted)' }}>Agrega equipo a tu carrito para poder finalizar la compra.</p>
        <Link href="/productos" style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, background: 'var(--color-text)', color: 'var(--color-bg)', textDecoration: 'none', padding: '15px 30px', borderRadius: 100 }}>{labels.browse}</Link>
      </div>,
    );
  }

  return shell(
    <form onSubmit={onSubmit} className="co-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 56, alignItems: 'start' }}>
      {/* Columna izquierda: datos + método de pago */}
      <div style={{ display: 'grid', gap: 34 }}>
        <section>
          <h2 style={legendStyle}>{labels.contactTitle}</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <input className="co-field" name="name" required defaultValue={user.name} placeholder={labels.name} aria-label={labels.name} autoComplete="name" style={fieldStyle} />
            <div className="co-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input className="co-field" name="email" type="email" required defaultValue={user.email} placeholder={labels.email} aria-label={labels.email} autoComplete="email" style={fieldStyle} />
              <input className="co-field" name="phone" required minLength={7} defaultValue={user.phone ?? ''} placeholder={labels.phone} aria-label={labels.phone} autoComplete="tel" style={fieldStyle} />
            </div>
            <input className="co-field" name="address" required minLength={4} value={addr} onChange={(e) => setAddr(e.target.value)} placeholder={labels.address} aria-label={labels.address} autoComplete="street-address" style={fieldStyle} />
            <div className="co-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input className="co-field" name="city" required value={city} onChange={(e) => setCity(e.target.value)} placeholder={labels.city} aria-label={labels.city} style={fieldStyle} />
              <input className="co-field" name="zip" required value={zip} onChange={(e) => setZip(e.target.value)} placeholder={labels.zip} aria-label={labels.zip} autoComplete="postal-code" style={fieldStyle} />
            </div>
            <textarea className="co-field" name="note" placeholder={labels.note} aria-label={labels.note} rows={3} style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.55 }} />
          </div>
          {/* La dirección alimenta el cotizador de traslado. */}
          {freightCfg.enabled && freightCfg.mode === 'km' ? (
            <p style={{ margin: '12px 0 0', display: 'flex', alignItems: 'center', gap: 8, fontFamily: MONO, fontSize: 11, letterSpacing: '0.04em', color: 'var(--color-text-muted)' }}>
              <span aria-hidden>📍</span>
              {freightLoading
                ? 'CALCULANDO TRASLADO…'
                : freight?.km != null
                  ? `TRASLADO CALCULADO A ${freight.km.toLocaleString('es-MX', { maximumFractionDigits: 1 })} KM${freight.estimated ? ' (APROX.)' : ''}`
                  : 'TU DIRECCIÓN DEFINE EL COSTO DEL TRASLADO'}
            </p>
          ) : null}
        </section>

        <section>
          <h2 style={legendStyle}>{labels.methodTitle}</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {available.map((m) => {
              const on = method === m.id;
              const hint = plainText(m.instructions);
              return (
                <label key={m.id} style={{ display: 'flex', gap: 13, alignItems: 'flex-start', border: `1px solid ${on ? 'var(--color-text)' : 'var(--color-border)'}`, background: on ? 'color-mix(in srgb, var(--color-text) 4%, transparent)' : 'transparent', borderRadius: 4, padding: '15px 16px', cursor: 'pointer' }}>
                  <input type="radio" name="method" value={m.id} checked={on} onChange={() => setMethod(m.id)} style={{ marginTop: 3, accentColor: 'var(--color-text)' }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 700, fontSize: 15 }}>{m.title}</span>
                    {hint ? <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.5 }}>{hint}</span> : null}
                  </span>
                </label>
              );
            })}
            {available.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-text-muted)' }}>No hay métodos de pago activos. Configúralos en el panel.</p>
            ) : null}
          </div>
        </section>
      </div>

      {/* Columna derecha: resumen */}
      <aside className="co-aside" style={{ position: 'sticky', top: 20, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.14em', color: 'var(--color-text-muted)', padding: '18px 24px 0', textTransform: 'uppercase' }}>{labels.summaryTitle}</div>

        <div style={{ padding: '14px 24px 0' }}>
          {cart.items.map((i) => (
            <div key={i.productId} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0' }}>
              <span style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 3, overflow: 'hidden', background: 'var(--color-bg)', backgroundImage: i.image ? undefined : stripe, display: 'block' }}>
                {i.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : null}
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name}</span>
                <span style={{ display: 'block', fontFamily: MONO, fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 2 }}>{i.qty} × {formatPrice(i.price)} / {i.unitLabel ?? 'MES'}</span>
              </span>
              <span style={{ fontWeight: 700, fontSize: 13.5, flexShrink: 0 }}>{formatPrice(cartLineTotal(i))}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: '14px 24px 0', borderTop: '1px solid var(--color-border)', marginTop: 14 }}>
          {/* Cupón: previsualiza el descuento; el servidor lo recalcula al confirmar */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input value={couponInput} onChange={(e) => setCouponInput(e.target.value)} placeholder={labels.couponLabel} aria-label={labels.couponLabel} style={{ ...fieldStyle, flex: 1, minWidth: 0, padding: '9px 11px', fontSize: 13 }} />
            <button type="button" onClick={applyCoupon} style={{ border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', borderRadius: 4, padding: '0 14px', fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', cursor: 'pointer', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>{labels.couponApply}</button>
          </div>
          {couponError ? <p role="alert" style={{ color: 'var(--color-error)', margin: '0 0 6px', fontSize: 12.5 }}>{couponError}</p> : null}

          <div style={{ paddingTop: 8 }}>
            <div style={rowStyle}><span>Subtotal</span><span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{formatPrice(cart.total)}</span></div>

            {discount > 0 ? (
              <div style={{ ...rowStyle, color: 'var(--color-success)' }}>
                <span>{labels.couponApplied} {coupon?.code ? `· ${coupon.code}` : ''}</span>
                <span style={{ fontWeight: 600 }}>−{formatPrice(discount)}</span>
              </div>
            ) : null}

            {operatorCost > 0 ? (
              <div style={rowStyle}><span>{config.operator.label} ({cart.count})</span><span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{formatPrice(operatorCost)}</span></div>
            ) : null}

            {/* Traslado: antes del impuesto, porque el impuesto se calcula sobre él. */}
            {freightCfg.enabled ? (
              <div style={rowStyle}>
                <span>
                  {freightCfg.label}
                  {freight?.km != null ? <span style={{ display: 'block', fontFamily: MONO, fontSize: 10, opacity: 0.75, letterSpacing: '0.06em' }}>{freight.km.toLocaleString('es-MX', { maximumFractionDigits: 1 })} KM{freight.estimated ? ' APROX.' : ''}</span> : null}
                </span>
                {freightCost > 0
                  ? <span style={{ color: 'var(--color-text)', fontWeight: 600, flexShrink: 0 }}>{formatPrice(freightCost)}</span>
                  : <span style={{ fontFamily: MONO, fontSize: 11, textAlign: 'right', lineHeight: 1.5 }}>{freightLoading ? 'CALCULANDO…' : (freight?.message || freightCfg.quoteText).toUpperCase()}</span>}
              </div>
            ) : null}

            {taxAdds ? (
              <div style={rowStyle}><span>{config.tax.label} ({config.tax.rate}%)</span><span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{formatPrice(tax)}</span></div>
            ) : null}
            {includedTax > 0 ? (
              <div style={rowStyle}><span>{config.tax.label} incluido ({config.tax.rate}%)</span><span style={{ fontFamily: MONO, fontSize: 12 }}>{formatPrice(includedTax)}</span></div>
            ) : null}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '18px 0 20px', borderTop: '1px solid var(--color-border)', marginTop: 8 }}>
            <span style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 700 }}>{labels.total}</span>
            <span style={{ fontFamily: DISPLAY, fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em' }}>{formatPrice(finalTotal)}</span>
          </div>

          {error ? (
            <p role="alert" style={{ color: 'var(--color-error)', margin: '0 0 12px', fontSize: 13, textAlign: 'center' }}>{error}</p>
          ) : null}

          <button type="submit" disabled={loading || available.length === 0} style={{ display: 'block', textAlign: 'center', width: '100%', fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, background: 'var(--color-primary)', color: 'var(--color-primary-fg)', border: 'none', padding: 16, borderRadius: 100, cursor: loading || available.length === 0 ? 'default' : 'pointer', opacity: loading || available.length === 0 ? 0.6 : 1 }}>
            {loading ? 'Procesando…' : labels.submit}
          </button>

          {config.note ? (
            <p style={{ margin: '16px 0 20px', fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em', color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.6, textTransform: 'uppercase' }}>{config.note}</p>
          ) : <div style={{ height: 20 }} />}
        </div>
      </aside>
    </form>,
  );
}
