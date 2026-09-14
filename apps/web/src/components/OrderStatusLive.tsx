'use client';
import { useEffect, useState } from 'react';
import { paymentStatusLabel, toneColors } from '@/lib/order-status';

const MONO = 'var(--font-sans)';

/** Cada cuánto se vuelve a preguntar mientras la pestaña está visible. */
const CADA_MS = 15_000;
/** Estados que ya no cambian: cuando se llega a uno, se deja de preguntar. */
const FINALES = new Set(['paid', 'approved', 'completed', 'cancelled', 'canceled', 'refunded', 'rejected']);

/**
 * Muestra el estado de pago del pedido y lo mantiene al día consultando la API
 * cada 15 s (vía el proxy, con la sesión del cliente). Antes era Supabase
 * Realtime; para un pago que se confirma por webhook, medio minuto de espera es
 * indistinguible de "en vivo".
 */
export function OrderStatusLive({
  orderNumber,
  label,
  initialPaymentStatus,
}: {
  orderNumber: string;
  label: string;
  initialPaymentStatus: string;
}) {
  const [paymentStatus, setPaymentStatus] = useState(initialPaymentStatus);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (FINALES.has(paymentStatus.toLowerCase())) { setLive(false); return; }
    let active = true;
    const consultar = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const r = await fetch(`/api/proxy/orders/${encodeURIComponent(orderNumber)}`, { cache: 'no-store' });
        if (!r.ok || !active) return;
        const d = (await r.json()) as { paymentStatus?: string };
        if (d.paymentStatus) setPaymentStatus(d.paymentStatus);
        setLive(true);
      } catch {
        /* sin red un momento: se vuelve a intentar en el siguiente tic */
      }
    };
    const timer = window.setInterval(consultar, CADA_MS);
    const alVolver = () => { if (document.visibilityState === 'visible') consultar(); };
    document.addEventListener('visibilitychange', alVolver);
    consultar();
    return () => { active = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', alVolver); };
  }, [orderNumber, paymentStatus]);

  const st = paymentStatusLabel(paymentStatus);
  const c = toneColors(st.tone);

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '10px 0' }}>
      <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
        {label}
        {live ? <span style={{ color: 'var(--color-primary)', marginLeft: 6 }} title="Se actualiza solo">· EN VIVO</span> : null}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: c.fg, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 'var(--radius-button)', padding: '5px 12px' }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: c.fg }} />
        {st.text}
      </span>
    </div>
  );
}
