import { requestFormFor } from '@maqserv/config';

/**
 * Lo que pidió el cliente, contado para quien va a hacer el trabajo: el aliado
 * en su portal y el operador en su enlace (2026-10-15, antes vivía dentro del
 * portal del aliado).
 */

/** Claves internas de `quotes.requirements` que no le dicen nada al aliado. */
const INTERNAS = new Set(['origen', 'cotizador', 'folio', 'quoterId', 'obra', 'obra_ubicacion', 'productos', 'productId', 'precioAjustado', 'operadorAsignado']);

/**
 * LO QUE PIDE EL CLIENTE, para el aliado (2026-10-08).
 *
 * El documento (sección 14) dice qué necesita cada proveedor para decidir:
 * la rentadora, equipo y fechas; el de servicios, "datos completos"; el de
 * materiales, "especificación, tonelaje/volumen, destino, ventana". Antes la
 * tarjeta solo traía la categoría y un comentario libre. Ahora trae las
 * respuestas del formulario de SU línea, con su etiqueta, y los conceptos que
 * armó el cotizador ("Retroexcavadora c/ cucharón · 3 días").
 */
/**
 * Las notas sueltas del comentario (lo que escribió el cliente aparte del
 * formulario). El resto del comentario repite lo que ya va en `pedido`.
 */
export function notasDe(comments: string | null): string | null {
  const notas = (comments ?? '').split('\n').map((l) => l.trim()).filter((l) => /^(Notas del cliente|Atención|Comentarios?):/i.test(l));
  return notas.length ? notas.join('\n') : null;
}

export function pedidoDe(categoria: string | null, requirements: unknown, comments: string | null): Array<{ label: string; valor: string }> {
  const out: Array<{ label: string; valor: string }> = [];
  const conceptos = comments?.match(/Conceptos:s*(.+)/)?.[1]?.trim();
  if (conceptos) out.push({ label: 'Lo que pidió', valor: conceptos });
  const req = requirements && typeof requirements === 'object' && !Array.isArray(requirements)
    ? (requirements as Record<string, unknown>)
    : {};
  const form = requestFormFor(categoria);
  const campos = new Map((form?.fields ?? []).map((c) => [c.key, c]));
  // En el orden del formulario de la línea; lo que no esté en él, al final.
  const claves = [...(form?.fields ?? []).map((c) => c.key), ...Object.keys(req).filter((k) => !campos.has(k))];
  for (const k of [...new Set(claves)]) {
    if (INTERNAS.has(k)) continue;
    const v = req[k];
    if (v === null || v === undefined || v === '' || typeof v === 'object') continue;
    const c = campos.get(k);
    const label = c?.label ?? (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, ' ');
    out.push({ label, valor: `${String(v)}${c?.unit ? ` ${c.unit}` : ''}` });
  }
  return out;
}
