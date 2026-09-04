/**
 * VIGENCIA DE UNA COTIZACIÓN (documento institucional, sección 22).
 *
 * "El sistema de cotización debe guardar la versión enviada, vigencia,
 * conceptos incluidos, conceptos excluidos... y cualquier variable que pudiera
 * convertirse después en una diferencia comercial."
 *
 * El punto de todo esto es evitar la discusión cara: una cotización de hace tres
 * meses no puede seguir pareciendo válida, y lo que NO incluye tiene que estar
 * escrito antes, no discutirse después.
 */

export type QuoteState =
  /** Esperando que alguien la responda. */
  | 'pendiente'
  /** Respondida y dentro de su vigencia: el cliente puede aceptarla. */
  | 'vigente'
  /** Respondida pero se le pasó la fecha. El precio ya no se sostiene. */
  | 'vencida'
  /** El cliente la aceptó. */
  | 'aceptada'
  /** Se descartó. */
  | 'rechazada';

/** Días que vale una cotización si nadie define otra cosa. */
export const VIGENCIA_DEFAULT_DIAS = 15;

export interface EntradaVigencia {
  /** `pending` | `completed` | `rejected` en la base. */
  status: string;
  validUntil: Date | null;
  acceptedAt: Date | null;
}

/** Fecha calendario de una fecha GUARDADA (date-only a medianoche): su día UTC. */
const soloFecha = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * Fecha calendario de AHORA en Ciudad de México (UTC-6 fijo: México eliminó el
 * horario de verano en 2022). El servidor corre en UTC: comparar contra el día
 * UTC hacía que una cotización "vigente hasta hoy" muriera a las ~6 pm CDMX.
 */
const CDMX_OFFSET_MS = 6 * 3_600_000;
const fechaCdmx = (d: Date): string => new Date(d.getTime() - CDMX_OFFSET_MS).toISOString().slice(0, 10);

export function estadoCotizacion(q: EntradaVigencia, hoy: Date = new Date()): QuoteState {
  if (q.acceptedAt) return 'aceptada';
  if (q.status === 'rejected') return 'rechazada';
  if (q.status !== 'completed') return 'pendiente';
  // Respondida sin fecha de vigencia: se considera vigente. No se inventa un
  // vencimiento que nadie acordó — eso sería inventar una condición comercial.
  if (!q.validUntil) return 'vigente';
  return soloFecha(q.validUntil) >= fechaCdmx(hoy) ? 'vigente' : 'vencida';
}

/** Solo se puede aceptar una cotización respondida y dentro de su vigencia. */
export function sePuedeAceptar(q: EntradaVigencia, hoy: Date = new Date()): boolean {
  return estadoCotizacion(q, hoy) === 'vigente';
}

/** Días que faltan para que venza. Negativo si ya venció, null si no tiene fecha. */
export function diasParaVencer(validUntil: Date | null, hoy: Date = new Date()): number | null {
  if (!validUntil) return null;
  const a = Date.parse(`${soloFecha(validUntil)}T00:00:00Z`);
  const b = Date.parse(`${fechaCdmx(hoy)}T00:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}

/** Fecha de vigencia por defecto al responder, en formato ISO corto (día CDMX). */
export function vigenciaPorDefecto(hoy: Date = new Date()): string {
  const d = new Date(hoy);
  d.setDate(d.getDate() + VIGENCIA_DEFAULT_DIAS);
  return fechaCdmx(d);
}
