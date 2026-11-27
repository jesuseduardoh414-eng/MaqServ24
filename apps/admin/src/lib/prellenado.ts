/**
 * LO CALCULADO EN LA DIRECCIÓN (2026-11-27). Las calculadoras del enlace
 * mandan a «Cotizar» lo que salió como `?pre=subbase:264,base:264`: el
 * material del tabulador (o vacío si no se sabe cuál) y sus toneladas. Aquí se
 * escribe y se lee, con topes: viene en una dirección que cualquiera puede
 * editar, así que lo raro se ignora.
 */

export interface Prellenado { id: string; t: number }

const MAX_RENGLONES = 8;
const MAX_TONELADAS = 100_000;

/** Para la dirección: `id:t` separados por coma, con dos decimales. */
export function textoPrellenado(pre: Prellenado[]): string {
  return pre
    .filter((p) => p.t > 0 && Number.isFinite(p.t))
    .slice(0, MAX_RENGLONES)
    .map((p) => `${p.id}:${Math.round(p.t * 100) / 100}`)
    .join(',');
}

/** De la dirección: solo claves cortas de letras, números o guion bajo, y toneladas razonables. */
export function leerPrellenado(texto: string | string[] | undefined): Prellenado[] {
  const t = Array.isArray(texto) ? texto[0] : texto;
  if (!t || t.length > 400) return [];
  const out: Prellenado[] = [];
  for (const parte of t.split(',').slice(0, MAX_RENGLONES)) {
    const m = /^([a-z0-9_]{0,40}):(\d+(?:\.\d+)?)$/.exec(parte.trim());
    if (!m) continue;
    const n = Number(m[2]);
    if (n > 0 && n <= MAX_TONELADAS) out.push({ id: m[1], t: n });
  }
  return out;
}
