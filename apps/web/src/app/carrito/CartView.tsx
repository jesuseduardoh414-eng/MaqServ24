'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CheckoutConfig } from '@maqserv/config';
import { cartLineKey, cartLineTotal, useCart, type CartItem } from '@/components/CartProvider';
import { Icon } from '@/components/Icon';
import { FREIGHT_ADDRESS_KEY, freightCostOf, useFreightQuote } from '@/components/useFreightQuote';
import { formatPrice } from '@/lib/format';

const MONO = 'var(--font-sans)';
const DISPLAY = 'var(--font-display)';

const STEPS: Array<[string, string]> = [['1', 'Carrito'], ['2', 'Datos'], ['3', 'Pago']];

/** `config` viene del panel (Pagos): define IVA y el cargo de operador. */
export function CartView({ config }: { config: CheckoutConfig }) {
  const cart = useCart();
  const router = useRouter();
  const operator = cart.operator;
  const setOperator = cart.setOperator;

  // Selección: vive en el CartProvider para que el checkout cobre EXACTAMENTE
  // lo seleccionado (antes era estado local y el checkout mandaba todo).
  const deselected = cart.deselected;
  const [couponInput, setCouponInput] = useState('');
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [coupon, setCoupon] = useState<{ discount: number; label: string | null; code: string } | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);

  // Traslado: se cotiza con la ubicación del cliente (Panel → Traslado).
  const freightCfg = config.freight;
  const [addr, setAddr] = useState('');
  const { quote: freight, loading: freightLoading, run: quoteFreight } = useFreightQuote();

  const selectedItems = cart.selectedItems;
  const allSelected = cart.items.length > 0 && selectedItems.length === cart.items.length;
  const selUnits = selectedItems.reduce((n, i) => n + i.qty, 0);
  const subtotal = useMemo(() => selectedItems.reduce((s, i) => s + cartLineTotal(i), 0), [selectedItems]);
  const discount = coupon?.discount ?? 0;
  const operatorCost = operator && config.operator.enabled ? selUnits * config.operator.amount : 0;
  const freightCost = freightCostOf(freight);
  const taxable = Math.max(0, subtotal - discount) + operatorCost + freightCost;
  // El impuesto se SUMA solo si está activo y los precios no lo incluyen ya.
  const taxAdds = config.tax.enabled && !config.tax.included;
  const tax = taxAdds ? taxable * (config.tax.rate / 100) : 0;
  const includedTax = config.tax.enabled && config.tax.included ? taxable - taxable / (1 + config.tax.rate / 100) : 0;
  const total = taxable + tax;

  const toggleSel = cart.toggleSelected;
  const toggleAll = () => cart.setAllSelected(!allSelected);

  // Revalida el cupón contra el endpoint real cuando cambia el código o el subtotal.
  useEffect(() => {
    if (!couponCode || subtotal <= 0) { setCoupon(null); return; }
    let alive = true;
    fetch('/api/proxy/orders/coupon/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: couponCode, subtotal }) })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        if (!alive) return;
        if (d?.valid) { setCoupon({ discount: d.discount, label: d.label, code: d.code }); setCouponMsg(null); }
        else { setCoupon(null); setCouponMsg('Código no válido.'); }
      })
      .catch((status) => { if (!alive) return; setCoupon(null); setCouponMsg(status === 401 ? 'Inicia sesión para usar cupones.' : 'No se pudo validar el cupón.'); });
    return () => { alive = false; };
  }, [couponCode, subtotal]);

  // Cotiza el traslado al cargar: con la dirección que el cliente ya haya dado
  // (se recuerda entre carrito y checkout) o directo si es tarifa única.
  const freightKey = selectedItems.map((i) => `${i.productId}:${i.qty}`).join(',');
  useEffect(() => {
    if (!freightCfg.enabled || freightCfg.mode === 'quote' || !freightKey) return;
    const items = selectedItems.map((i) => ({ productId: i.productId, qty: i.qty }));
    if (freightCfg.mode === 'flat') { quoteFreight('', items); return; }
    const saved = localStorage.getItem(FREIGHT_ADDRESS_KEY) ?? '';
    if (saved) { setAddr((a) => a || saved); quoteFreight(saved, items); }
    // Solo re-cotiza si cambia el carrito; escribir la dirección no dispara nada
    // hasta que el cliente presiona "Calcular".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freightKey, freightCfg.enabled, freightCfg.mode]);

  function calcFreight() {
    const value = addr.trim();
    if (!value || freightLoading) return;
    localStorage.setItem(FREIGHT_ADDRESS_KEY, value);
    quoteFreight(value, selectedItems.map((i) => ({ productId: i.productId, qty: i.qty })));
  }

  function applyCoupon() {
    const code = couponInput.trim().toUpperCase();
    setCouponMsg(null);
    if (!code) return;
    setCouponCode(code);
  }

  async function saveToFav(lines: CartItem[]) {
    let unauth = false;
    for (const line of lines) {
      try {
        const r = await fetch('/api/proxy/wishlist/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: line.productId }) });
        if (r.status === 401) { unauth = true; break; }
      } catch { /* best-effort */ }
      cart.remove(cartLineKey(line));
    }
    if (unauth) router.push('/login');
  }

  const stripe = 'repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-text) 5%, transparent) 0 12px, transparent 12px 24px)';
  const Check = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button type="button" onClick={onClick} aria-pressed={on} style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 5, border: `2px solid ${on ? 'var(--color-text)' : 'var(--color-border)'}`, background: on ? 'var(--color-text)' : 'transparent', color: 'var(--color-bg)', cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 13, lineHeight: 1, padding: 0 }}>{on ? <Icon name="check" size={13} /> : null}</button>
  );

  return (
    <div style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <style>{`
        @media (max-width: 900px){
          .cart-grid{ grid-template-columns:1fr !important; }
          .cart-wrap{ padding-left:22px !important; padding-right:22px !important; }
          .cart-title{ font-size:36px !important; }
          .cart-aside{ position:static !important; }
        }
        @media (max-width: 640px){ .cart-line{ grid-template-columns:26px 84px 1fr !important; } .cart-line-actions{ grid-column:1 / -1; padding-left:110px; } }
      `}</style>

      <main className="cart-wrap" style={{ maxWidth: 1280, margin: '0 auto', padding: '44px 40px 60px' }}>
        {/* Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 40, flexWrap: 'wrap' }}>
          {STEPS.map(([n, name], i) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'grid', placeItems: 'center', gap: 6 }}>
                <span style={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: 14, fontWeight: 700, background: i === 0 ? 'var(--color-text)' : 'transparent', color: i === 0 ? 'var(--color-bg)' : 'var(--color-text-muted)', border: `1px solid ${i === 0 ? 'var(--color-text)' : 'var(--color-border)'}` }}>{n}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', color: i === 0 ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{name}</span>
              </div>
              {i < STEPS.length - 1 ? <span style={{ width: 90, height: 1, background: 'var(--color-border)', margin: '0 4px 18px' }} /> : null}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, borderBottom: '2px solid var(--color-text)', paddingBottom: 20, marginBottom: 28, flexWrap: 'wrap' }}>
          <h1 className="cart-title" style={{ fontFamily: DISPLAY, margin: 0, fontSize: 48, fontWeight: 800, letterSpacing: '-0.04em' }}>Tu carrito</h1>
          <span style={{ fontFamily: MONO, fontSize: 13, color: 'var(--color-text-muted)' }}>{cart.count} EQUIPO(S)</span>
        </div>

        {cart.items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: 56, marginBottom: 20 }}>🛒</div>
            <h2 style={{ fontFamily: DISPLAY, margin: '0 0 12px', fontSize: 30, fontWeight: 700 }}>Tu carrito está vacío</h2>
            <p style={{ margin: '0 0 28px', color: 'var(--color-text-muted)' }}>Explora nuestro catálogo y agrega el equipo que tu obra necesita.</p>
            <Link href="/productos" style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, background: 'var(--color-text)', color: 'var(--color-bg)', textDecoration: 'none', padding: '15px 30px', borderRadius: 'var(--radius-button)' }}>Ver productos</Link>
          </div>
        ) : (
          <div className="cart-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 56, alignItems: 'start' }}>
            <div>
              {/* barra de selección */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 16, borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
                <Check on={allSelected} onClick={toggleAll} />
                <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>{selectedItems.length}/{cart.items.length} seleccionados</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 18 }}>
                  <button type="button" disabled={selectedItems.length === 0} onClick={() => saveToFav(selectedItems)} style={{ background: 'none', border: 'none', fontFamily: MONO, fontSize: 12, letterSpacing: '0.06em', color: selectedItems.length ? 'var(--color-text)' : 'var(--color-text-muted)', cursor: selectedItems.length ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="heart" size={12} />MOVER A FAVORITOS</button>
                  <button type="button" disabled={selectedItems.length === 0} onClick={() => cart.removeLines(selectedItems.map(cartLineKey))} style={{ background: 'none', border: 'none', fontFamily: MONO, fontSize: 12, letterSpacing: '0.06em', color: selectedItems.length ? 'var(--color-error)' : 'var(--color-text-muted)', cursor: selectedItems.length ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="x" size={12} />QUITAR</button>
                </div>
              </div>

              {cart.items.map((item) => (
                <div key={cartLineKey(item)} className="cart-line" style={{ display: 'grid', gridTemplateColumns: '26px 120px 1fr auto', gap: 20, padding: '24px 0', borderBottom: '1px solid var(--color-border)', alignItems: 'center' }}>
                  <Check on={!deselected.has(cartLineKey(item))} onClick={() => toggleSel(cartLineKey(item))} />
                  <Link href={`/productos/${item.slug}`} style={{ height: 100, borderRadius: 3, overflow: 'hidden', background: 'var(--color-surface)', backgroundImage: item.image ? undefined : stripe, display: 'block' }}>
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : null}
                  </Link>
                  <div style={{ minWidth: 0 }}>
                    <Link href={`/productos/${item.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <h3 style={{ fontFamily: DISPLAY, margin: '0 0 8px', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{item.name}</h3>
                    </Link>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>{formatPrice(item.price)}</span>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--color-text-muted)' }}>/ {item.unitLabel ?? 'MES'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontFamily: MONO, fontSize: 12 }}>
                      <button type="button" onClick={() => saveToFav([item])} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="heart" size={13} />Guardar</button>
                      <button type="button" onClick={() => cart.remove(cartLineKey(item))} style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="x" size={13} />Quitar</button>
                    </div>
                  </div>
                  <div className="cart-line-actions" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-button)', overflow: 'hidden' }}>
                      <button type="button" aria-label="Menos" onClick={() => cart.setQty(cartLineKey(item), item.qty - 1)} style={{ background: 'transparent', border: 'none', width: 38, height: 40, fontSize: 20, cursor: 'pointer', color: 'var(--color-text)' }}>−</button>
                      <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, width: 30, textAlign: 'center' }}>{item.qty}</span>
                      <button type="button" aria-label="Más" onClick={() => cart.setQty(cartLineKey(item), item.qty + 1)} style={{ background: 'transparent', border: 'none', width: 38, height: 40, fontSize: 20, cursor: 'pointer', color: 'var(--color-text)' }}>+</button>
                    </div>
                    <div style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>{formatPrice(cartLineTotal(item))}</div>
                  </div>
                </div>
              ))}
              <Link href="/productos" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 24, fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, color: 'var(--color-text)', textDecoration: 'none' }}><Icon name="arrowLeft" size={15} />Seguir explorando</Link>
            </div>

            {/* Columna derecha */}
            <div style={{ display: 'grid', gap: 18 }} className="cart-aside2">
              {/* Cupones */}
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '22px 24px' }}>
                <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.14em', color: 'var(--color-text-muted)', marginBottom: 12 }}>CUPÓN</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={couponInput} onChange={(e) => setCouponInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applyCoupon(); }} placeholder="Código" style={{ flex: 1, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-button)', padding: '11px 16px', fontFamily: MONO, fontSize: 13, background: 'var(--color-bg)', color: 'var(--color-text)' }} />
                  <button type="button" onClick={applyCoupon} style={{ background: 'var(--color-text)', color: 'var(--color-bg)', border: 'none', fontFamily: DISPLAY, fontWeight: 700, fontSize: 13, padding: '10px 18px', borderRadius: 'var(--radius-button)', cursor: 'pointer' }}>Aplicar</button>
                </div>
                {coupon ? <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--color-success)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="check" size={11} /><span>{coupon.code} aplicado{coupon.label ? ` (${coupon.label})` : ''}</span></div> : null}
                {couponMsg ? <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--color-error)', marginTop: 8 }}>{couponMsg}</div> : null}
              </div>

              {/* Operador (opcional; monto y textos definidos en Panel → Pagos) */}
              {config.operator.enabled ? (
                <button type="button" onClick={() => setOperator(!operator)} style={{ textAlign: 'left', cursor: 'pointer', background: operator ? 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg))' : 'var(--color-surface)', border: `1px solid ${operator ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 4, padding: 22, fontFamily: 'inherit', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 5, border: `2px solid ${operator ? 'var(--color-text)' : 'var(--color-border)'}`, background: operator ? 'var(--color-text)' : 'transparent', color: 'var(--color-bg)', display: 'grid', placeItems: 'center', fontSize: 13, marginTop: 2 }}>{operator ? <Icon name="check" size={13} /> : null}</span>
                  <div>
                    <div style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-text)' }}>{config.operator.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.5 }}>{config.operator.help} <strong style={{ color: 'var(--color-text)' }}>+{formatPrice(config.operator.amount)}</strong> por equipo</div>
                  </div>
                </button>
              ) : null}

              {/* Desglose */}
              <aside className="cart-aside" style={{ position: 'sticky', top: 20, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.14em', color: 'var(--color-text-muted)', padding: '18px 24px 0' }}>DESGLOSE ({selUnits} EQUIPO{selUnits === 1 ? '' : 'S'})</div>
                <div style={{ padding: '14px 24px 0' }}>
                  {selectedItems.map((it) => (
                    <div key={it.productId} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', fontSize: 13.5, color: 'var(--color-text-muted)' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.qty} × {it.name}</span>
                      <span style={{ color: 'var(--color-text)', fontWeight: 600, flexShrink: 0 }}>{formatPrice(cartLineTotal(it))}</span>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '14px 24px 0', borderTop: '1px solid var(--color-border)', marginTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14, color: 'var(--color-text-muted)' }}><span>Subtotal</span><span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{formatPrice(subtotal)}</span></div>
                  {discount > 0 ? <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14, color: 'var(--color-success)' }}><span>Descuento {coupon?.code ? `· ${coupon.code}` : ''}</span><span style={{ fontWeight: 600 }}>−{formatPrice(discount)}</span></div> : null}
                  {operatorCost > 0 ? <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14, color: 'var(--color-text-muted)' }}><span>Operador ({selUnits})</span><span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{formatPrice(operatorCost)}</span></div> : null}

                  {/* Traslado: va antes del impuesto porque el impuesto se calcula sobre él. */}
                  {freightCfg.enabled ? (
                    <>
                      {freightCfg.mode === 'km' ? (
                        <div style={{ padding: '10px 0 2px' }}>
                          <label htmlFor="freight-addr" style={{ display: 'block', fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', color: 'var(--color-text-muted)', marginBottom: 7 }}>¿A DÓNDE LO LLEVAMOS?</label>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input id="freight-addr" value={addr} onChange={(e) => setAddr(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') calcFreight(); }} placeholder="Ciudad, estado o dirección" style={{ flex: 1, minWidth: 0, padding: '9px 11px', fontSize: 13, fontFamily: 'inherit', border: '1px solid var(--color-border)', borderRadius: 4, background: 'var(--color-bg)', color: 'var(--color-text)' }} />
                            <button type="button" onClick={calcFreight} disabled={freightLoading || !addr.trim()} style={{ border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', borderRadius: 4, padding: '0 12px', fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', cursor: freightLoading || !addr.trim() ? 'default' : 'pointer', opacity: freightLoading || !addr.trim() ? 0.5 : 1, whiteSpace: 'nowrap' }}>{freightLoading ? '…' : 'CALCULAR'}</button>
                          </div>
                        </div>
                      ) : null}
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', fontSize: 14, color: 'var(--color-text-muted)' }}>
                        <span>
                          {freightCfg.label}
                          {freight?.km != null ? <span style={{ display: 'block', fontFamily: MONO, fontSize: 10, opacity: 0.75, letterSpacing: '0.06em' }}>{freight.km.toLocaleString('es-MX', { maximumFractionDigits: 1 })} KM{freight.estimated ? ' APROX.' : ''}</span> : null}
                        </span>
                        {freightCost > 0
                          ? <span style={{ color: 'var(--color-text)', fontWeight: 600, flexShrink: 0 }}>{formatPrice(freightCost)}</span>
                          : <span style={{ fontFamily: MONO, fontSize: 11, textAlign: 'right', lineHeight: 1.5 }}>{(freight?.message || freightCfg.quoteText).toUpperCase()}</span>}
                      </div>
                    </>
                  ) : null}

                  {taxAdds ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14, color: 'var(--color-text-muted)' }}><span>{config.tax.label} ({config.tax.rate}%)</span><span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{formatPrice(tax)}</span></div>
                  ) : null}
                  {includedTax > 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14, color: 'var(--color-text-muted)' }}><span>{config.tax.label} incluido ({config.tax.rate}%)</span><span style={{ fontFamily: MONO, fontSize: 12 }}>{formatPrice(includedTax)}</span></div>
                  ) : null}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '18px 0 20px', borderTop: '1px solid var(--color-border)', marginTop: 8 }}>
                    <span style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 700 }}>Total</span>
                    <span style={{ fontFamily: DISPLAY, fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em' }}>{formatPrice(total)}</span>
                  </div>
                  <Link href="/checkout" aria-disabled={selectedItems.length === 0} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center', width: '100%', fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, background: 'var(--color-primary)', color: 'var(--color-primary-fg)', border: 'none', padding: 16, borderRadius: 'var(--radius-button)', textDecoration: 'none', boxSizing: 'border-box', opacity: selectedItems.length === 0 ? 0.5 : 1, pointerEvents: selectedItems.length === 0 ? 'none' : 'auto' }}>Proceder al pago<Icon name="arrowRight" size={16} /></Link>
                  {/* Alternativa al pago directo: cotizar todo el carrito con un asesor. */}
                  <Link href="/cotizar" aria-disabled={selectedItems.length === 0} style={{ display: 'block', textAlign: 'center', width: '100%', marginTop: 10, fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)', padding: 14, borderRadius: 'var(--radius-button)', textDecoration: 'none', boxSizing: 'border-box', opacity: selectedItems.length === 0 ? 0.5 : 1, pointerEvents: selectedItems.length === 0 ? 'none' : 'auto' }}>Solicitar cotización</Link>
                  {config.note ? (
                    <p style={{ margin: '16px 0 20px', fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em', color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.6, textTransform: 'uppercase' }}>{config.note}</p>
                  ) : null}
                </div>
              </aside>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
