/**
 * TELÉFONOS MEXICANOS → ENLACES (2026-10-05).
 *
 * El teléfono se captura a mano en Diseño → Contacto y llega como sea:
 * "81 4021 3277", "+52 81 4021 3277" o "+52 1 81 4021 3277" (el "1" de
 * celular que se usaba antes de 2019). Cada enlace lo quiere distinto y antes
 * cada pantalla lo armaba a su manera: con "+52 1…" el de WhatsApp quedaba
 * `wa.me/5252181…` (inválido) y el de schema.org se perdía.
 *
 * Aquí se reduce a los 10 dígitos nacionales y de ahí sale todo. El texto que
 * se MUESTRA no cambia: es el que escribió el cliente.
 */

/** Los 10 dígitos nacionales, o null si no parece un número de México. */
export function telefonoNacional(valor: string | null | undefined): string | null {
  const d = (valor ?? '').replace(/\D/g, '');
  if (d.length === 10) return d;
  if (d.length === 12 && d.startsWith('52')) return d.slice(2);
  if (d.length === 13 && d.startsWith('521')) return d.slice(3);
  return null;
}

/** `+528140213277` (E.164, como pide schema.org). */
export function telefonoE164(valor: string | null | undefined): string | undefined {
  const n = telefonoNacional(valor);
  return n ? `+52${n}` : undefined;
}

/** Enlace para llamar. Si no se reconoce el número, se marca tal cual se escribió. */
export function telHref(valor: string | null | undefined): string {
  const n = telefonoNacional(valor);
  return n ? `tel:+52${n}` : `tel:${(valor ?? '').replace(/[^\d+]/g, '')}`;
}

/** Enlace de WhatsApp (`wa.me` acepta 52 + 10 dígitos, sin el "1"). */
export function whatsappHref(valor: string | null | undefined, texto?: string): string {
  const n = telefonoNacional(valor);
  const base = n ? `https://wa.me/52${n}` : `https://wa.me/${(valor ?? '').replace(/\D/g, '')}`;
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}
