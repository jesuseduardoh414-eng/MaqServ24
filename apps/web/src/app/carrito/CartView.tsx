'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CheckoutConfig } from '@maqserv/config';
import { cartLineKey, cartLineTotal, useCart, type CartItem } from '@/components/CartProvider';
import { Icon } from '@/components/Icon';
import { FREIGHT_ADDRESS_KEY, freightCostOf, useFreightQuote } from '@/components/useFreightQuote';
import { formatPrice } from '@/lib/format';


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
  const Check = ({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) => (
    <button type="button" onClick={onClick} aria-pressed={on} aria-label={label} className="ct-check" data-on={on}>
      {on ? <Icon name="check" size={13} /> : null}
    </button>
  );
  const vacio = cart.items.length === 0;
  const nada = selectedItems.length === 0;

  return (
    <div className="ct-page">
      <style>{CSS}</style>
      <main className="ct-wrap">
        <header className="ct-head">
          <div>
            <h1 className="ct-title">Tu carrito</h1>
            <p className="ct-sub">
              {vacio ? 'Aquí juntas lo que compras o rentas directo, sin cotización.' : `${cart.count} ${cart.count === 1 ? 'equipo' : 'equipos'} · revisa cantidades y el total antes de pagar.`}
            </p>
          </div>
          {!vacio ? (
            <ol className="ct-steps" aria-label="Pasos de la compra">
              {STEPS.map(([n, name], i) => (
                <li key={n} data-on={i === 0} aria-current={i === 0 ? 'step' : undefined}>
                  <span>{n}</span>{name}
                </li>
              ))}
            </ol>
          ) : null}
        </header>

        {vacio ? (
          <div className="ct-empty">
            <span className="ct-empty-ico" aria-hidden><Icon name="cart" size={22} /></span>
            <h2>Tu carrito está vacío</h2>
            <p>
              Casi todo en MAQSER24 se cotiza: pides el servicio, ves el precio y te asignamos el equipo. El carrito es solo para lo que se compra
              o renta directo.
            </p>
            <div className="ct-empty-acts">
              <Link href="/cotizador" className="ct-btn">Cotizar un servicio</Link>
              <Link href="/servicios" className="ct-link">Ver servicios <Icon name="arrowRight" size={14} /></Link>
            </div>
            <ul className="ct-empty-tips">
              <li><Icon name="calculator" size={15} /><span><b>Maquinaria</b> por día, semana o mes, con precio al momento.</span></li>
              <li><Icon name="truck" size={15} /><span><b>Pipas, volteos y triturados</b> por viaje o por tonelada.</span></li>
              <li><Icon name="chat" size={15} /><span><b>¿Algo especial?</b> <Link href="/cotizar">Pídelo a la medida</Link> y te respondemos.</span></li>
            </ul>
          </div>
        ) : (
          <div className="ct-grid">
            <section aria-label="Equipos en tu carrito">
              <div className="ct-bar">
                <Check on={allSelected} onClick={toggleAll} label={allSelected ? 'Quitar selección' : 'Seleccionar todo'} />
                <span className="ct-muted">{selectedItems.length} de {cart.items.length} seleccionados</span>
                <div className="ct-bar-acts">
                  <button type="button" disabled={nada} onClick={() => saveToFav(selectedItems)} className="ct-txtbtn"><Icon name="heart" size={14} />Mover a favoritos</button>
                  <button type="button" disabled={nada} onClick={() => cart.removeLines(selectedItems.map(cartLineKey))} className="ct-txtbtn ct-danger"><Icon name="x" size={14} />Quitar</button>
                </div>
              </div>

              <div className="ct-lines">
                {cart.items.map((item) => {
                  const key = cartLineKey(item);
                  return (
                    <article key={key} className="ct-line" data-off={deselected.has(key)}>
                      <Check on={!deselected.has(key)} onClick={() => toggleSel(key)} label={`Seleccionar ${item.name}`} />
                      <Link href={`/productos/${item.slug}`} className="ct-img" style={{ backgroundImage: stripe }}>
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        ) : null}
                      </Link>
                      <div className="ct-info">
                        <Link href={`/productos/${item.slug}`} className="ct-name">{item.name}</Link>
                        <p className="ct-price">{formatPrice(item.price)} <span>/ {(item.unitLabel ?? 'mes').toLowerCase()}</span></p>
                        <div className="ct-line-acts">
                          <button type="button" onClick={() => saveToFav([item])} className="ct-txtbtn"><Icon name="heart" size={13} />Guardar</button>
                          <button type="button" onClick={() => cart.remove(key)} className="ct-txtbtn ct-danger"><Icon name="x" size={13} />Quitar</button>
                        </div>
                      </div>
                      <div className="ct-right">
                        <div className="ct-qty" role="group" aria-label={`Cantidad de ${item.name}`}>
                          <button type="button" aria-label="Menos" onClick={() => cart.setQty(key, item.qty - 1)}>−</button>
                          <span aria-live="polite">{item.qty}</span>
                          <button type="button" aria-label="Más" onClick={() => cart.setQty(key, item.qty + 1)}>+</button>
                        </div>
                        <div className="ct-line-total">{formatPrice(cartLineTotal(item))}</div>
                      </div>
                    </article>
                  );
                })}
              </div>
              <Link href="/servicios" className="ct-back"><Icon name="arrowLeft" size={15} />Seguir explorando</Link>
            </section>

            <div className="ct-side">
              {config.operator.enabled ? (
                <button type="button" onClick={() => setOperator(!operator)} className="ct-card ct-op" data-on={operator}>
                  <span className="ct-check" data-on={operator} aria-hidden>{operator ? <Icon name="check" size={13} /> : null}</span>
                  <span>
                    <span className="ct-op-t">{config.operator.label}</span>
                    <span className="ct-op-d">{config.operator.help} <b>+{formatPrice(config.operator.amount)}</b> por equipo</span>
                  </span>
                </button>
              ) : null}

              <aside className="ct-card ct-sum" aria-label="Resumen de la compra">
                <h2 className="ct-sum-t">Resumen <span>{selUnits} {selUnits === 1 ? 'equipo' : 'equipos'}</span></h2>
                <div className="ct-rows">
                  {selectedItems.map((it) => (
                    <div key={cartLineKey(it)} className="ct-row ct-row-sm">
                      <span className="ct-ell">{it.qty} × {it.name}</span>
                      <b>{formatPrice(cartLineTotal(it))}</b>
                    </div>
                  ))}
                </div>
                <div className="ct-rows ct-sep">
                  <div className="ct-row"><span>Subtotal</span><b>{formatPrice(subtotal)}</b></div>
                  {discount > 0 ? <div className="ct-row ct-ok"><span>Descuento {coupon?.code ? `· ${coupon.code}` : ''}</span><b>−{formatPrice(discount)}</b></div> : null}
                  {operatorCost > 0 ? <div className="ct-row"><span>Operador ({selUnits})</span><b>{formatPrice(operatorCost)}</b></div> : null}

                  {/* Traslado: va antes del impuesto porque el impuesto se calcula sobre él. */}
                  {freightCfg.enabled ? (
                    <>
                      {freightCfg.mode === 'km' ? (
                        <div className="ct-field">
                          <label htmlFor="freight-addr">¿A dónde lo llevamos?</label>
                          <div className="ct-inline">
                            <input id="freight-addr" value={addr} onChange={(e) => setAddr(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') calcFreight(); }} placeholder="Ciudad, estado o dirección" />
                            <button type="button" onClick={calcFreight} disabled={freightLoading || !addr.trim()} className="ct-btn-sec">{freightLoading ? 'Calculando…' : 'Calcular'}</button>
                          </div>
                        </div>
                      ) : null}
                      <div className="ct-row">
                        <span>
                          {freightCfg.label}
                          {freight?.km != null ? <small>{freight.km.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km{freight.estimated ? ' aprox.' : ''}</small> : null}
                        </span>
                        {freightCost > 0 ? <b>{formatPrice(freightCost)}</b> : <span className="ct-note">{freight?.message || freightCfg.quoteText}</span>}
                      </div>
                    </>
                  ) : null}

                  {taxAdds ? <div className="ct-row"><span>{config.tax.label} ({config.tax.rate}%)</span><b>{formatPrice(tax)}</b></div> : null}
                  {includedTax > 0 ? <div className="ct-row"><span>{config.tax.label} incluido ({config.tax.rate}%)</span><span>{formatPrice(includedTax)}</span></div> : null}
                </div>

                <div className="ct-field ct-sep">
                  <label htmlFor="coupon">Cupón de descuento</label>
                  <div className="ct-inline">
                    <input id="coupon" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applyCoupon(); }} placeholder="Escribe tu código" />
                    <button type="button" onClick={applyCoupon} className="ct-btn-sec">Aplicar</button>
                  </div>
                  {coupon ? <p className="ct-msg ct-ok"><Icon name="check" size={13} />{coupon.code} aplicado{coupon.label ? ` (${coupon.label})` : ''}</p> : null}
                  {couponMsg ? <p className="ct-msg ct-danger">{couponMsg}</p> : null}
                </div>

                <div className="ct-total">
                  <span>Total</span>
                  <strong>{formatPrice(total)}</strong>
                </div>
                <Link href="/checkout" aria-disabled={nada} className="ct-btn ct-full" data-off={nada}>Continuar al pago<Icon name="arrowRight" size={16} /></Link>
                {/* Alternativa al pago directo: cotizar todo el carrito con un asesor. */}
                <Link href="/cotizar" aria-disabled={nada} className="ct-btn-sec ct-full" data-off={nada}>Prefiero que me coticen</Link>
                {config.note ? <p className="ct-fine">{config.note}</p> : null}
              </aside>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const CSS = `
.ct-page{ background:var(--color-bg); color:var(--color-text); }
.ct-wrap{ max-width:1180px; margin:0 auto; padding:40px 32px 80px; }
.ct-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:20px; flex-wrap:wrap; margin-bottom:28px; }
.ct-title{ margin:0; font-family:var(--font-display); font-size:30px; font-weight:700; letter-spacing:-.025em; }
.ct-sub{ margin:8px 0 0; font-size:14.5px; color:var(--color-text-muted); }
.ct-steps{ list-style:none; margin:0; padding:0; display:flex; align-items:center; gap:8px; font-size:13px; color:var(--color-text-muted); }
.ct-steps li{ display:flex; align-items:center; gap:7px; }
.ct-steps li + li::before{ content:''; width:24px; height:1px; background:var(--color-border); margin-right:1px; }
.ct-steps li span{ width:22px; height:22px; border-radius:50%; display:grid; place-items:center; font-size:11.5px; font-weight:700; border:1px solid var(--color-border); }
.ct-steps li[data-on="true"]{ color:var(--color-text); font-weight:600; }
.ct-steps li[data-on="true"] span{ background:var(--color-primary); border-color:var(--color-primary); color:var(--color-primary-fg); }

.ct-empty{ border:1px dashed var(--color-border); border-radius:14px; padding:48px 36px; display:grid; justify-items:start; gap:6px; max-width:760px; }
.ct-empty-ico{ width:48px; height:48px; border-radius:12px; display:grid; place-items:center; color:var(--color-primary); background:color-mix(in srgb, var(--color-primary) 10%, transparent); border:1px solid color-mix(in srgb, var(--color-primary) 25%, transparent); margin-bottom:10px; }
.ct-empty h2{ margin:0; font-family:var(--font-display); font-size:21px; font-weight:700; letter-spacing:-.015em; }
.ct-empty p{ margin:0; font-size:14.5px; line-height:1.6; color:var(--color-text-muted); max-width:56ch; }
.ct-empty-acts{ display:flex; align-items:center; gap:20px; flex-wrap:wrap; margin-top:18px; }
.ct-empty-tips{ list-style:none; margin:28px 0 0; padding:20px 0 0; border-top:1px solid var(--color-border); display:grid; gap:10px; width:100%; }
.ct-empty-tips li{ display:flex; gap:10px; align-items:flex-start; font-size:13.5px; color:var(--color-text-muted); line-height:1.5; }
.ct-empty-tips svg{ color:var(--color-primary); margin-top:2px; flex-shrink:0; }
.ct-empty-tips b{ color:var(--color-text); font-weight:600; }
.ct-empty-tips a{ color:var(--color-primary); }

.ct-btn{ display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:46px; padding:0 22px; border-radius:var(--radius-button, 8px); border:none; background:var(--color-primary); color:var(--color-primary-fg); font-family:var(--font-sans); font-size:15px; font-weight:600; text-decoration:none; cursor:pointer; transition:filter .18s ease, transform .12s ease; }
.ct-btn:hover{ filter:brightness(1.08); }
.ct-btn:active{ transform:translateY(1px); }
.ct-btn-sec{ display:inline-flex; align-items:center; justify-content:center; min-height:40px; padding:0 14px; border-radius:var(--radius-button, 8px); border:1px solid var(--color-border); background:transparent; color:var(--color-text); font-family:var(--font-sans); font-size:13.5px; font-weight:600; text-decoration:none; cursor:pointer; white-space:nowrap; transition:border-color .18s ease; }
.ct-btn-sec:hover:not(:disabled){ border-color:var(--color-text-muted); }
.ct-btn-sec:disabled{ opacity:.5; cursor:default; }
.ct-full{ width:100%; box-sizing:border-box; }
.ct-full + .ct-full{ margin-top:10px; min-height:44px; }
.ct-full[data-off="true"]{ opacity:.45; pointer-events:none; }
.ct-link{ display:inline-flex; align-items:center; gap:6px; font-size:14px; font-weight:600; color:var(--color-primary); text-decoration:none; }
.ct-btn:focus-visible, .ct-btn-sec:focus-visible, .ct-link:focus-visible, .ct-check:focus-visible, .ct-txtbtn:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; }

.ct-grid{ display:grid; grid-template-columns:minmax(0,1fr) 380px; gap:40px; align-items:start; }
.ct-bar{ display:flex; align-items:center; gap:12px; padding:0 4px 14px; flex-wrap:wrap; }
.ct-bar-acts{ margin-left:auto; display:flex; gap:16px; }
.ct-muted{ font-size:13px; color:var(--color-text-muted); }
.ct-txtbtn{ display:inline-flex; align-items:center; gap:6px; padding:0; border:none; background:none; font:inherit; font-size:13px; font-weight:600; color:var(--color-text-muted); cursor:pointer; }
.ct-txtbtn:hover:not(:disabled){ color:var(--color-text); }
.ct-txtbtn:disabled{ opacity:.45; cursor:default; }
.ct-danger, .ct-txtbtn.ct-danger:hover:not(:disabled){ color:var(--color-error); }
.ct-check{ width:22px; height:22px; flex-shrink:0; border-radius:6px; border:1.5px solid var(--color-border); background:transparent; color:var(--color-primary-fg); display:grid; place-items:center; padding:0; cursor:pointer; transition:background .15s ease, border-color .15s ease; }
.ct-check[data-on="true"]{ background:var(--color-primary); border-color:var(--color-primary); }

.ct-lines{ display:grid; gap:10px; }
.ct-line{ display:grid; grid-template-columns:22px 104px minmax(0,1fr) auto; gap:18px; align-items:center; padding:16px 18px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:12px; transition:opacity .18s ease; }
.ct-line[data-off="true"]{ opacity:.55; }
.ct-img{ height:84px; border-radius:10px; overflow:hidden; background:var(--color-bg); border:1px solid var(--color-border); display:block; }
.ct-img img{ width:100%; height:100%; object-fit:cover; }
.ct-info{ min-width:0; }
.ct-name{ display:block; font-family:var(--font-display); font-size:17px; font-weight:700; letter-spacing:-.01em; color:inherit; text-decoration:none; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ct-name:hover{ color:var(--color-primary); }
.ct-price{ margin:4px 0 10px; font-size:14px; font-weight:600; font-variant-numeric:tabular-nums; }
.ct-price span{ font-weight:400; color:var(--color-text-muted); font-size:13px; }
.ct-line-acts{ display:flex; gap:16px; }
.ct-right{ display:grid; justify-items:end; gap:10px; }
.ct-qty{ display:flex; align-items:center; border:1px solid var(--color-border); border-radius:8px; overflow:hidden; background:var(--color-bg); }
.ct-qty button{ width:36px; height:36px; border:none; background:transparent; color:var(--color-text); font-size:18px; cursor:pointer; }
.ct-qty button:hover{ background:color-mix(in srgb, var(--color-text) 6%, transparent); }
.ct-qty span{ min-width:28px; text-align:center; font-weight:700; font-size:14.5px; font-variant-numeric:tabular-nums; }
.ct-line-total{ font-family:var(--font-display); font-size:18px; font-weight:700; letter-spacing:-.02em; font-variant-numeric:tabular-nums; }
.ct-back{ display:inline-flex; align-items:center; gap:7px; margin-top:18px; font-size:14px; font-weight:600; color:var(--color-text-muted); text-decoration:none; }
.ct-back:hover{ color:var(--color-text); }

.ct-side{ display:grid; gap:14px; position:sticky; top:104px; min-width:0; }
.ct-card{ min-width:0; width:100%; box-sizing:border-box; background:var(--color-surface); border:1px solid var(--color-border); border-radius:14px; }
.ct-op{ display:flex; gap:12px; align-items:flex-start; padding:16px 18px; text-align:left; cursor:pointer; font:inherit; color:inherit; }
.ct-op[data-on="true"]{ border-color:color-mix(in srgb, var(--color-primary) 55%, var(--color-border)); background:color-mix(in srgb, var(--color-primary) 7%, var(--color-surface)); }
.ct-op > span:last-child{ display:grid; gap:3px; }
.ct-op-t{ font-size:14.5px; font-weight:600; }
.ct-op-d{ font-size:13px; line-height:1.5; color:var(--color-text-muted); }
.ct-op-d b{ color:var(--color-text); }
.ct-sum{ padding:20px 22px 22px; }
.ct-sum-t{ margin:0 0 12px; font-size:16px; font-weight:700; display:flex; align-items:baseline; justify-content:space-between; }
.ct-sum-t span{ font-size:13px; font-weight:500; color:var(--color-text-muted); }
.ct-rows{ display:grid; grid-template-columns:minmax(0,1fr); gap:2px; }
.ct-sep{ border-top:1px solid var(--color-border); margin-top:12px; padding-top:12px; }
.ct-row{ display:flex; justify-content:space-between; gap:12px; padding:5px 0; font-size:14px; color:var(--color-text-muted); }
.ct-row b{ color:var(--color-text); font-weight:600; flex-shrink:0; font-variant-numeric:tabular-nums; }
.ct-row small{ display:block; font-size:12px; opacity:.85; }
.ct-row-sm{ font-size:13px; }
.ct-ell{ min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ct-note{ font-size:12.5px; text-align:right; max-width:60%; }
.ct-ok{ color:var(--color-success) !important; }
.ct-field{ display:grid; gap:7px; padding:6px 0; }
.ct-field label{ font-size:13px; font-weight:500; color:var(--color-text); }
.ct-inline{ display:flex; gap:8px; }
.ct-inline input{ flex:1; min-width:0; min-height:40px; padding:0 12px; font:inherit; font-size:14px; color:var(--color-text); background:var(--color-bg); border:1px solid var(--color-border); border-radius:8px; }
.ct-inline input:focus{ outline:none; border-color:var(--color-primary); box-shadow:0 0 0 3px color-mix(in srgb, var(--color-primary) 22%, transparent); }
.ct-msg{ margin:0; display:flex; align-items:center; gap:6px; font-size:12.5px; }
.ct-total{ display:flex; justify-content:space-between; align-items:baseline; margin:14px 0 16px; padding-top:14px; border-top:1px solid var(--color-border); }
.ct-total span{ font-size:15px; font-weight:600; }
.ct-total strong{ font-family:var(--font-display); font-size:28px; font-weight:800; letter-spacing:-.03em; font-variant-numeric:tabular-nums; }
.ct-fine{ margin:14px 0 0; font-size:12px; line-height:1.55; color:var(--color-text-muted); text-align:center; }

@media (max-width: 960px){
  .ct-grid{ grid-template-columns:minmax(0,1fr); gap:24px; }
  .ct-side{ position:static; }
}
@media (max-width: 640px){
  .ct-wrap{ padding:24px 16px 64px; }
  .ct-title{ font-size:25px; }
  .ct-empty{ padding:32px 20px; }
  .ct-line{ grid-template-columns:22px 72px minmax(0,1fr); gap:12px; padding:14px; }
  .ct-img{ height:64px; }
  .ct-right{ grid-column:2 / -1; display:flex; justify-content:space-between; align-items:center; }
  .ct-bar-acts{ margin-left:0; width:100%; }
}
`;
