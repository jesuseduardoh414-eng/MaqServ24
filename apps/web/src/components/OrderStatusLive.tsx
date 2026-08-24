'use client';
import { useEffect, useState } from 'react';
import { fetchRealtimeToken, supabaseBrowser } from '@/lib/supabase-browser';
import { paymentStatusLabel, toneColors } from '@/lib/order-status';

const MONO = "'Inter', system-ui, sans-serif";

/**
 * Muestra el estado de pago del pedido y lo actualiza EN VIVO vía Supabase Realtime.
 * Se suscribe a UPDATE de `orders` filtrado por order_number; RLS asegura que solo
 * el dueño (o admin) reciba el evento.
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
    let active = true;
    const sb = supabaseBrowser();
    let channel: ReturnType<typeof sb.channel> | null = null;

    (async () => {
      const token = await fetchRealtimeToken();
      if (!token || !active) return;
      sb.realtime.setAuth(token);
      channel = sb
        .channel(`order-${orderNumber}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'orders', filter: `order_number=eq.${orderNumber}` },
          (payload) => {
            const row = payload.new as { payment_status?: string };
            if (row.payment_status) setPaymentStatus(row.payment_status);
          },
        )
        .subscribe((s) => {
          if (s === 'SUBSCRIBED' && active) setLive(true);
        });
    })();

    return () => {
      active = false;
      if (channel) sb.removeChannel(channel);
    };
  }, [orderNumber]);

  const st = paymentStatusLabel(paymentStatus);
  const c = toneColors(st.tone);

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '10px 0' }}>
      <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
        {label}
        {live ? <span style={{ color: 'var(--color-primary)', marginLeft: 6 }} title="Se actualiza solo">· EN VIVO</span> : null}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: c.fg, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 100, padding: '5px 12px' }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: c.fg }} />
        {st.text}
      </span>
    </div>
  );
}
