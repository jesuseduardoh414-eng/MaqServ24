/** Formatos de las pantallas de dinero (2026-10-22): sustituyen a los datos de ejemplo. */

export const dinero = (n: number) => `$${Math.round(n).toLocaleString('es-MX')}`;
export const pct = (n: number) => `${n.toLocaleString('es-MX', { maximumFractionDigits: 1 })}%`;
const dia = (iso: string) => new Date(`${iso}T12:00:00`);
export const fechaCorta = (iso: string) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(dia(iso)).replace('.', '');
export const fechaLarga = (iso: string) => new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(dia(iso));
export const mesCorto = (ym: string) => new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(dia(`${ym}-01`)).replace('.', '');
/** "Octubre de 2026". */
export const mesTitulo = (ym: string) => {
  const t = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(dia(`${ym}-01`));
  return t.charAt(0).toUpperCase() + t.slice(1);
};
/** Hoy en Monterrey, "2026-10-22". */
export const hoyLocal = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey' }).format(new Date());
/** "vence hoy", "hace 3 días", "en 5 días". `dias` positivo = ya pasó. */
export function cuando(dias: number): string {
  if (dias === 0) return 'hoy';
  if (dias > 0) return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
  return `en ${-dias} ${dias === -1 ? 'día' : 'días'}`;
}

export const CREDITOS: Array<{ dias: number; texto: string }> = [
  { dias: 0, texto: 'Paga al cerrar el servicio' },
  { dias: 7, texto: 'Crédito a 7 días' },
  { dias: 15, texto: 'Crédito a 15 días' },
  { dias: 30, texto: 'Crédito a 30 días' },
];
export const FORMAS = ['Transferencia', 'Efectivo', 'Cheque', 'Tarjeta'];
export const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Llama a la API del panel y devuelve el mensaje de error legible, o null si salió bien. */
export async function enviar(url: string, metodo: 'POST' | 'PATCH' | 'PUT', cuerpo: unknown): Promise<string | null> {
  return (await pedir(url, metodo, cuerpo)).error;
}

/** Como `enviar`, pero también con lo que contestó la API (para decir "qué sigue"). */
export async function pedir<T>(url: string, metodo: 'POST' | 'PATCH' | 'PUT', cuerpo: unknown): Promise<{ error: string | null; datos: T | null }> {
  try {
    const r = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo ?? {}) });
    const d = await r.json().catch(() => null);
    if (r.ok) return { error: null, datos: d as T };
    return { error: d?.message ?? 'No se pudo guardar. Inténtalo de nuevo.', datos: null };
  } catch {
    return { error: 'Sin conexión. Inténtalo de nuevo.', datos: null };
  }
}
