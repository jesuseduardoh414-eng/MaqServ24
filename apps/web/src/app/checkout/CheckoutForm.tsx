'use client';

import { evento } from '@/lib/analitica';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AuthUser, CheckoutResult, CouponCheck, PaymentMethod, PaymentMethodId } from '@maqserv/types';
import type { CheckoutConfig } from '@maqserv/config';
import { cartLineKey, cartLineTotal, useCart } from '@/components/CartProvider';
import { Icon } from '@/components/Icon';
import { FREIGHT_ADDRESS_KEY, freightCostOf, useFreightQuote } from '@/components/useFreightQuote';
import { formatPrice } from '@/lib/format';

const STEPS: Array<[string, string]> = [['1', 'Carrito'], ['2', 'Datos'], ['3', 'Pago']];
const ACTIVE_STEP = 1; // Datos

const stripe = 'repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-text) 5%, transparent) 0 12px, transparent 12px 24px)';

/** Las instrucciones del gateway vienen con HTML legacy (`<font>`): se muestran como texto. */
function plainText(html: string | null, max = 130): string {
  if (!html) return '';
  const s = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max).trimEnd()}…` : s;
}

export function CheckoutForm({
  user,
  config,
  methods,
  catalogo = '/servicios',
  labels,
}: {
  user: AuthUser;
  config: CheckoutConfig;
  methods: PaymentMethod[];
  /** A dónde manda "seguir viendo" con el carrito vacío (ver `rutaCatalogo`). */
  catalogo?: string;
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

  // Se cobra EXACTAMENTE lo seleccionado en el paso Carrito (antes se mandaba
  // el carrito completo aunque el paso 1 mostrara un total por menos líneas).
  const items = cart.selectedItems;
  const subtotal = items.reduce((s, i) => s + cartLineTotal(i), 0);
  const units = items.reduce((n, i) => n + i.qty, 0);

  // Traslado: se recotiza solo conforme el cliente escribe su dirección.
  const freightCfg = config.freight;
  const { quote: freight, loading: freightLoading, run: quoteFreight } = useFreightQuote();
  const [addr, setAddr] = useState(user.address ?? '');
  const [city, setCity] = useState(user.city ?? '');
  const [zip, setZip] = useState(user.zip ?? '');
  const freightAddress = [addr, city, zip ? `CP ${zip}` : ''].filter(Boolean).join(', ');
  const freightKey = items.map((i) => `${i.productId}:${i.qty}`).join(',');

  /**
   * Clave de idempotencia: una por INTENTO de compra. Si el proxy agota su
   * tiempo pero la petición llegó (Render despertando), el reintento del
   * cliente lleva la MISMA clave y el servidor devuelve la orden ya creada en
   * vez de duplicar stock retenido y usos de cupón. Cambiar el contenido del
   * intento (items, método, cupón) genera clave nueva.
   */
  const idempotencyKey = useMemo(
    () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `ck-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [freightKey, method, coupon?.code, cart.operator],
  );

  useEffect(() => {
    if (!freightCfg.enabled || freightCfg.mode === 'quote' || !freightKey) return;
    const payload = items.map((i) => ({ productId: i.productId, qty: i.qty }));
    if (freightCfg.mode === 'flat') { quoteFreight('', payload); return; }
    if (freightAddress.trim().length < 5) return;
    const t = setTimeout(() => {
      localStorage.setItem(FREIGHT_ADDRESS_KEY, freightAddress);
      quoteFreight(freightAddress, payload);
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
      body: JSON.stringify({ code, subtotal }),
    });
    const data = (await res.json().catch(() => null)) as CouponCheck | null;
    if (res.ok && data?.valid) setCoupon(data);
    else setCouponError(labels.couponInvalid);
  }

  // Mismo cálculo que el carrito y que el servidor (Panel → Pagos manda).
  const discount = coupon?.valid ? coupon.discount : 0;
  const operatorCost = cart.operator && config.operator.enabled ? units * config.operator.amount : 0;
  const freightCost = freightCostOf(freight);
  const taxable = Math.max(0, subtotal - discount) + operatorCost + freightCost;
  const taxAdds = config.tax.enabled && !config.tax.included;
  const tax = taxAdds ? taxable * (config.tax.rate / 100) : 0;
  const includedTax = config.tax.enabled && config.tax.included ? taxable - taxable / (1 + config.tax.rate / 100) : 0;
  const finalTotal = taxable + tax;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Candado del traslado por km: no se confirma hasta que el resumen muestre
    // el costo que el servidor va a cobrar. Antes, enviar antes del cálculo
    // mostraba "a cotizar" y la orden cobraba el traslado de todos modos.
    if (freightCfg.enabled && freightCfg.mode === 'km' && freightAddress.trim().length >= 5) {
      if (freightLoading) {
        setError('Estamos calculando el costo del traslado; espera unos segundos.');
        return;
      }
      if (!freight) {
        setError('Aún no se calcula el traslado a tu dirección; espera a que aparezca en el resumen.');
        return;
      }
    }

    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map((i) => ({
          productId: i.productId,
          qty: i.qty,
          ...(i.period ? { period: i.period } : {}),
        })),
        method,
        idempotencyKey,
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
    // Solo salen del carrito las líneas COMPRADAS: lo deseleccionado se queda.
    cart.removeLines(items.map(cartLineKey));
    // El pago se mide aparte (pago_completado, en la página del pedido) cuando lo confirma la pasarela.
    evento('pedido_creado', { pago_en_linea: !!data.redirectUrl, lineas: items.length });
    if (data.redirectUrl) {
      window.location.href = data.redirectUrl; // MercadoPago Checkout Pro
      return;
    }
    router.push(`/pedido/${data.order.orderNumber}`);
  }

  /**
   * Contenedor de la página: mismo encabezado que el carrito (título a la
   * izquierda, pasos arriba a la derecha) con el paso 2 activo y el 1 hecho.
   */
  const shell = (children: React.ReactNode, vacio = false) => (
    <div className="ms-page">
      <style>{CSS}</style>
      <main className="ms-wrap">
        <header className="ms-head">
          <div className="ms-head-txt">
            <h1 className="ms-title">{labels.title}</h1>
            <p className="ms-desc">
              {vacio ? 'No hay equipos seleccionados para pagar.' : `${units} ${units === 1 ? 'equipo' : 'equipos'} · confirma tus datos y elige cómo pagar.`}
            </p>
          </div>
          {!vacio ? (
            <ol className="ms-steps" aria-label="Pasos de la compra">
              {STEPS.map(([n, name], i) => (
                <li key={n} data-on={i === ACTIVE_STEP} data-done={i < ACTIVE_STEP} aria-current={i === ACTIVE_STEP ? 'step' : undefined}>
                  <span>{i < ACTIVE_STEP ? <Icon name="check" size={12} /> : n}</span>{name}
                </li>
              ))}
            </ol>
          ) : null}
        </header>

        {children}
      </main>
    </div>
  );

  if (items.length === 0) {
    return shell(
      <div className="ms-empty co-empty">
        <span className="ms-ico ms-ico-lg" aria-hidden><Icon name="cart" size={22} /></span>
        <h2 className="ms-empty-t">{labels.emptyCart}</h2>
        <p className="ms-empty-p">Agrega equipo a tu carrito para poder finalizar la compra.</p>
        <div className="ms-empty-acts">
          <Link href={catalogo} className="ms-btn">{labels.browse}</Link>
          <Link href="/carrito" className="ms-link ms-link-muted"><Icon name="arrowLeft" size={14} />Volver al carrito</Link>
        </div>
      </div>,
      true,
    );
  }

  return shell(
    <form onSubmit={onSubmit} className="ms-split">
      {/* Columna izquierda: datos + método de pago */}
      <div className="co-main">
        <section className="ms-panel" aria-labelledby="co-contacto">
          <h2 id="co-contacto" className="co-sec-t">{labels.contactTitle}</h2>
          <div className="ms-grid2">
            <div className="ms-field ms-span">
              <label className="ms-label" htmlFor="co-name">{labels.name}</label>
              <input id="co-name" className="ms-input" name="name" required defaultValue={user.name} autoComplete="name" />
            </div>
            <div className="ms-field">
              <label className="ms-label" htmlFor="co-email">{labels.email}</label>
              <input id="co-email" className="ms-input" name="email" type="email" required defaultValue={user.email} autoComplete="email" />
            </div>
            <div className="ms-field">
              <label className="ms-label" htmlFor="co-phone">{labels.phone}</label>
              <input id="co-phone" className="ms-input" name="phone" required minLength={7} defaultValue={user.phone ?? ''} autoComplete="tel" />
            </div>
            <div className="ms-field ms-span">
              <label className="ms-label" htmlFor="co-address">{labels.address}</label>
              <input id="co-address" className="ms-input" name="address" required minLength={4} value={addr} onChange={(e) => setAddr(e.target.value)} autoComplete="street-address" />
              {/* La dirección alimenta el cotizador de traslado. */}
              {freightCfg.enabled && freightCfg.mode === 'km' ? (
                <p className="ms-hint co-freight-hint">
                  <Icon name="mapPin" size={14} />
                  {freightLoading
                    ? 'Calculando traslado…'
                    : freight?.km != null
                      ? `Traslado calculado a ${freight.km.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km${freight.estimated ? ' (aprox.)' : ''}`
                      : 'Tu dirección define el costo del traslado'}
                </p>
              ) : null}
            </div>
            <div className="ms-field">
              <label className="ms-label" htmlFor="co-city">{labels.city}</label>
              <input id="co-city" className="ms-input" name="city" required value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" />
            </div>
            <div className="ms-field">
              <label className="ms-label" htmlFor="co-zip">{labels.zip}</label>
              <input id="co-zip" className="ms-input" name="zip" required value={zip} onChange={(e) => setZip(e.target.value)} autoComplete="postal-code" />
            </div>
            <div className="ms-field ms-span">
              <label className="ms-label" htmlFor="co-note">{labels.note}</label>
              <textarea id="co-note" className="ms-textarea co-note" name="note" rows={3} />
            </div>
          </div>
        </section>

        <section className="ms-panel" aria-labelledby="co-metodo">
          <h2 id="co-metodo" className="co-sec-t">{labels.methodTitle}</h2>
          <div className="co-methods" role="radiogroup" aria-labelledby="co-metodo">
            {available.map((m) => {
              const on = method === m.id;
              const hint = plainText(m.instructions);
              return (
                <label key={m.id} className="co-method" data-on={on}>
                  <input type="radio" name="method" value={m.id} checked={on} onChange={() => setMethod(m.id)} />
                  <span className="co-method-txt">
                    <span className="co-method-t">{m.title}</span>
                    {hint ? <span className="co-method-d">{hint}</span> : null}
                  </span>
                </label>
              );
            })}
            {available.length === 0 ? (
              <div className="ms-alert ms-alert-warn">
                <span className="co-alert-ico co-warn"><Icon name="warning" size={16} /></span>
                <span>Por el momento no hay métodos de pago disponibles. Escríbenos y con gusto te ayudamos a completar tu pedido.</span>
              </div>
            ) : null}
          </div>
        </section>

        <Link href="/carrito" className="ms-link ms-link-muted co-back"><Icon name="arrowLeft" size={15} />Volver al carrito</Link>
      </div>

      {/* Columna derecha: resumen (380 px, como en el carrito) */}
      <aside className="ms-panel co-sum" aria-label={labels.summaryTitle}>
        <h2 className="co-sum-t">{labels.summaryTitle} <span>{units} {units === 1 ? 'equipo' : 'equipos'}</span></h2>

        <div className="co-items">
          {items.map((i) => (
            <div key={cartLineKey(i)} className="co-item">
              <span className="co-thumb" style={i.image ? undefined : { backgroundImage: stripe }}>
                {i.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.image} alt="" />
                ) : null}
              </span>
              <span className="co-item-txt">
                <span className="co-item-n">{i.name}</span>
                <span className="co-item-d">{i.qty} × {formatPrice(i.price)} / {(i.unitLabel ?? 'mes').toLowerCase()}</span>
              </span>
              <b className="co-item-p">{formatPrice(cartLineTotal(i))}</b>
            </div>
          ))}
        </div>

        {/* Cupón: previsualiza el descuento; el servidor lo recalcula al confirmar */}
        <div className="ms-field co-sep">
          <label className="ms-label" htmlFor="co-coupon">{labels.couponLabel}</label>
          <div className="co-inline">
            <input id="co-coupon" className="ms-input" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} placeholder="Escribe tu código" />
            <button type="button" onClick={applyCoupon} className="ms-btn ms-btn-sec">{labels.couponApply}</button>
          </div>
          {couponError ? <p role="alert" className="ms-error">{couponError}</p> : null}
        </div>

        <div className="co-sep">
          <div className="ms-kv"><span>Subtotal</span><b>{formatPrice(subtotal)}</b></div>

          {discount > 0 ? (
            <div className="ms-kv co-ok">
              <span>{labels.couponApplied} {coupon?.code ? `· ${coupon.code}` : ''}</span>
              <b>−{formatPrice(discount)}</b>
            </div>
          ) : null}

          {operatorCost > 0 ? (
            <div className="ms-kv"><span>{config.operator.label} ({units})</span><b>{formatPrice(operatorCost)}</b></div>
          ) : null}

          {/* Traslado: antes del impuesto, porque el impuesto se calcula sobre él. */}
          {freightCfg.enabled ? (
            <div className="ms-kv">
              <span>
                {freightCfg.label}
                {freight?.km != null ? <small className="co-small">{freight.km.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km{freight.estimated ? ' aprox.' : ''}</small> : null}
              </span>
              {freightCost > 0
                ? <b>{formatPrice(freightCost)}</b>
                : <span className="co-note-r">{freightLoading ? 'Calculando…' : (freight?.message || freightCfg.quoteText)}</span>}
            </div>
          ) : null}

          {taxAdds ? (
            <div className="ms-kv"><span>{config.tax.label} ({config.tax.rate}%)</span><b>{formatPrice(tax)}</b></div>
          ) : null}
          {includedTax > 0 ? (
            <div className="ms-kv"><span>{config.tax.label} incluido ({config.tax.rate}%)</span><span className="ms-num">{formatPrice(includedTax)}</span></div>
          ) : null}
        </div>

        <div className="co-total">
          <span>{labels.total}</span>
          <strong>{formatPrice(finalTotal)}</strong>
        </div>

        {error ? (
          <div role="alert" className="ms-alert ms-alert-bad co-err">
            <span className="co-alert-ico"><Icon name="warning" size={16} /></span>
            <span>{error}</span>
          </div>
        ) : null}

        <button type="submit" disabled={loading || available.length === 0} className="ms-btn ms-btn-lg ms-btn-block">
          {loading ? 'Procesando…' : labels.submit}
        </button>

        {config.note ? <p className="ms-hint co-fine">{config.note}</p> : null}
      </aside>
    </form>,
  );
}

/* Estilos propios del checkout (prefijo `co-`). Lo común sale de `ms-*`. */
const CSS = `
.co-main{ display:grid; grid-template-columns:minmax(0,1fr); gap:16px; min-width:0; }
.co-sec-t{ margin:0 0 18px; font-family:var(--font-display); font-size:17px; font-weight:700; letter-spacing:-.01em; }
.co-note{ min-height:96px; }
.co-freight-hint{ display:flex; align-items:center; gap:6px; }
.co-freight-hint svg{ color:var(--color-primary); flex-shrink:0; }
.co-methods{ display:grid; gap:10px; }
.co-method{ display:flex; gap:12px; align-items:flex-start; padding:15px 16px; border:1px solid var(--color-border); border-radius:12px; background:var(--color-bg); cursor:pointer; transition:border-color .18s ease, background .18s ease; }
.co-method:hover{ border-color:color-mix(in srgb, var(--color-text) 30%, var(--color-border)); }
.co-method[data-on="true"]{ border-color:color-mix(in srgb, var(--color-primary) 55%, var(--color-border)); background:color-mix(in srgb, var(--color-primary) 7%, var(--color-surface)); }
.co-method input{ margin:3px 0 0; width:16px; height:16px; flex-shrink:0; accent-color:var(--color-primary); }
.co-method input:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; }
.co-method-txt{ min-width:0; display:grid; gap:3px; }
.co-method-t{ font-size:14.5px; font-weight:600; }
.co-method-d{ font-size:13px; line-height:1.5; color:var(--color-text-muted); }
.co-alert-ico{ color:var(--color-error); flex-shrink:0; margin-top:2px; display:inline-flex; }
.co-warn{ color:var(--color-warning); }
.co-back{ margin-top:4px; justify-self:start; }

.co-sum{ position:sticky; top:104px; padding:20px 22px 22px; }
.co-sum-t{ margin:0 0 12px; font-size:16px; font-weight:700; display:flex; align-items:baseline; justify-content:space-between; gap:12px; }
.co-sum-t span{ font-size:13px; font-weight:500; color:var(--color-text-muted); }
.co-items{ display:grid; gap:10px; }
.co-item{ display:flex; gap:12px; align-items:center; min-width:0; }
.co-thumb{ width:48px; height:48px; flex-shrink:0; border-radius:8px; overflow:hidden; background:var(--color-bg); border:1px solid var(--color-border); display:block; }
.co-thumb img{ width:100%; height:100%; object-fit:cover; display:block; }
.co-item-txt{ min-width:0; flex:1; display:grid; gap:2px; }
.co-item-n{ font-size:13.5px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.co-item-d{ font-size:12.5px; color:var(--color-text-muted); font-variant-numeric:tabular-nums; }
.co-item-p{ font-size:13.5px; font-weight:600; flex-shrink:0; font-variant-numeric:tabular-nums; }
.co-sep{ border-top:1px solid var(--color-border); margin-top:14px; padding-top:14px; }
.co-inline{ display:flex; gap:8px; }
.co-inline .ms-input{ flex:1; min-width:0; }
.co-ok, .co-ok b{ color:var(--color-success) !important; }
.co-small{ display:block; font-size:12px; opacity:.85; }
.co-note-r{ font-size:12.5px; text-align:right; max-width:60%; line-height:1.45; }
.co-total{ display:flex; justify-content:space-between; align-items:baseline; gap:12px; margin:12px 0 16px; padding-top:14px; border-top:1px solid var(--color-border); }
.co-total span{ font-size:15px; font-weight:600; }
.co-total strong{ font-family:var(--font-display); font-size:28px; font-weight:800; letter-spacing:-.03em; font-variant-numeric:tabular-nums; }
.co-err{ margin-bottom:12px; font-size:13.5px; }
.co-fine{ margin-top:14px; text-align:center; }
.co-empty{ max-width:760px; }

@media (max-width: 960px){
  .co-sum{ position:static; }
}
`;
