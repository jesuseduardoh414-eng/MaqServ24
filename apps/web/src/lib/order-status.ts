/**
 * Los estados vienen mezclados del sistema viejo y de MercadoPago, con mayúsculas
 * inconsistentes ("Pending", "pending", "approved", "Completed", "processing").
 * Aquí se normalizan a español una sola vez para todo el sitio.
 *
 * El estado del ENVÍO no se traduce aquí: sus textos viven en `FULFILLMENT`
 * (@maqserv/types) porque los comparten API, panel y sitio. Aquí solo se le da tono.
 */
export type Tone = 'ok' | 'warn' | 'bad' | 'info';

export interface StatusLabel {
  text: string;
  tone: Tone;
}

export function paymentStatusLabel(raw: string): StatusLabel {
  switch (raw.trim().toLowerCase()) {
    case 'approved':
    case 'completed':
    case 'paid':
      return { text: 'Pagado', tone: 'ok' };
    case 'pending':
    case 'in_process':
    case 'in process':
      return { text: 'Pendiente de pago', tone: 'warn' };
    case 'rejected':
    case 'declined':
    case 'failed':
      return { text: 'Rechazado', tone: 'bad' };
    case 'cancelled':
    case 'canceled':
      return { text: 'Cancelado', tone: 'bad' };
    case 'refunded':
      return { text: 'Reembolsado', tone: 'info' };
    default:
      return { text: raw || '—', tone: 'info' };
  }
}

export function orderStatusLabel(raw: string): StatusLabel {
  switch (raw.trim().toLowerCase()) {
    case 'pending':
      return { text: 'Pendiente', tone: 'warn' };
    case 'processing':
      return { text: 'En proceso', tone: 'info' };
    case 'completed':
    case 'delivered':
      return { text: 'Entregado', tone: 'ok' };
    case 'cancelled':
    case 'canceled':
    case 'declined':
      return { text: 'Cancelado', tone: 'bad' };
    default:
      return { text: raw || '—', tone: 'info' };
  }
}

/** Colores del badge derivados de los tokens del tema (siguen siendo configurables). */
export function toneColors(tone: Tone): { fg: string; bg: string; border: string } {
  const base =
    tone === 'ok' ? 'var(--color-success)'
      : tone === 'bad' ? 'var(--color-error)'
        : tone === 'warn' ? 'var(--color-warning)' // ámbar advierte (identidad MAQSER24); el azul es solo acción/datos
          : 'var(--color-text-muted)';
  return {
    fg: base,
    bg: `color-mix(in srgb, ${base} 12%, transparent)`,
    border: `color-mix(in srgb, ${base} 35%, transparent)`,
  };
}
