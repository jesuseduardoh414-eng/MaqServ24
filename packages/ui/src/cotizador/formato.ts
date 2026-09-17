/** Formatos de dinero y cantidades. Mismos en el panel, el sitio y el documento. */

/** Pesos redondeados: para tarjetas, chips y totales de pantalla. */
export const money = (n: number): string => `$${Math.round(Number(n) || 0).toLocaleString('es-MX')}`;

/** Pesos con centavos: para el documento, donde la suma tiene que cuadrar. */
export const money2 = (n: number): string =>
  `$${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * Cantidad de un renglón.
 *
 * Toneladas y m³ llevan dos decimales (se venden fraccionados); horas, viajes y
 * servicios son enteros y ponerles ".00" solo hace ruido.
 */
export const cantidad = (valor: number, unidad: string): string =>
  unidad === 'TON' || unidad === 'M3' || unidad === 'JOR'
    ? Number(valor).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Number(valor).toLocaleString('es-MX');

export const fechaLarga = (d: Date = new Date()): string =>
  d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

export const fechaCorta = (valor: string | Date | null): string => {
  if (!valor) return '—';
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

/** Escapa texto para meterlo en el HTML del documento. */
export const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
