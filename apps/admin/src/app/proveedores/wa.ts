/**
 * Teléfono → número para wa.me (52 + 10 dígitos). Acepta "81 1234 5678",
 * "+52 81…" y "+52 1 81…" (el "1" de celular viejo ya no se usa y wa.me no lo
 * quiere). Null si no parece un número mexicano.
 */
export function waDe(tel: string | null | undefined): string | null {
  const d = (tel ?? '').replace(/\D/g, '');
  if (d.length === 10) return `52${d}`;
  if (d.length === 12 && d.startsWith('52')) return d;
  if (d.length === 13 && d.startsWith('521')) return `52${d.slice(3)}`;
  return null;
}
