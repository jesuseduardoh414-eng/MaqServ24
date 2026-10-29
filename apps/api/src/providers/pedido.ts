import { requestFormFor } from '@maqserv/config';

/**
 * Lo que pidió el cliente, contado para quien va a hacer el trabajo: el aliado
 * en su portal y el operador en su enlace (2026-10-15, antes vivía dentro del
 * portal del aliado).
 */

/** Claves internas de `quotes.requirements` que no le dicen nada al aliado. */
const INTERNAS = new Set(['origen', 'cotizador', 'folio', 'quoterId', 'obra', 'obra_ubicacion', 'productos', 'productId', 'precioAjustado', 'operadorAsignado', 'operadorVersion', 'renglones']);

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
/* ============================================================
   ANTES DE ACEPTAR (auditoría 2026-10-23)
   ------------------------------------------------------------
   La oferta sale a varios aliados a la vez y solo uno se queda con el
   trabajo. Los demás no deben irse sabiendo quién es el cliente y cómo
   llamarle (es la forma de brincarse a MAQSER24): mientras la oferta está
   "por contestar" ven la zona y lo que se pide, no la calle, el nombre de la
   obra ni a quién buscar. Al aceptar lo ven todo, como siempre.

   Y lo que escribió el cliente no viaja tal cual en un correo oficial a
   terceros: sin correos, teléfonos ni enlaces (un "actualiza tu CLABE en
   pagos-maqser.com" con el remitente de MAQSER24 sería un engaño perfecto).
   ============================================================ */

const OCULTO = '[se ve al aceptar]';

/** Lo escrito por el cliente, sin "Atención:", correos, teléfonos ni enlaces. */
export function sinContacto(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const limpio = texto
    .split('\n')
    .filter((l) => !/^\s*Atenci[oó]n\s*:/i.test(l))
    .join('\n')
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, OCULTO)
    .replace(/\bhttps?:\/\/\S+|\bwww\.\S+/gi, '[enlace quitado]')
    .replace(/\b[\w-]+(\.[\w-]+)*\.(com|mx|net|org|info|io|app|co|xyz|online|site|link|me|biz)(\.[a-z]{2})?\b/gi, '[enlace quitado]')
    // Teléfono = 10 dígitos o más; una fecha o una cantidad se quedan.
    .replace(/\(?\+?\d[\d\s().-]{8,}\d/g, (m) => (m.replace(/\D/g, '').length >= 10 ? OCULTO : m))
    .trim();
  return limpio || null;
}

/** La colonia y el municipio, sin la calle ni el número (el primer tramo de la dirección). */
export function zonaAproximada(direccion: string | null | undefined, municipio?: string | null): string | null {
  const partes = (direccion ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  const zona = partes.length >= 2 ? partes.slice(1).join(', ') : municipio?.trim() || null;
  return zona ? sinContacto(zona) : null;
}

/**
 * Las notas sueltas del comentario (lo que escribió el cliente aparte del
 * formulario). El resto del comentario repite lo que ya va en `pedido`.
 */
export function notasDe(comments: string | null): string | null {
  const notas = (comments ?? '').split('\n').map((l) => l.trim()).filter((l) => /^(Notas del cliente|Atención|Comentarios?):/i.test(l));
  return notas.length ? notas.join('\n') : null;
}

/**
 * `conUbicacion`: la ubicación exacta en Google Maps (triturados con flete, 2026-10-29) solo la
 * ve quien ya aceptó; antes, como la dirección, solo la zona.
 */
export function pedidoDe(categoria: string | null, requirements: unknown, comments: string | null, conUbicacion = false): Array<{ label: string; valor: string }> {
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
    if (INTERNAS.has(k) || (k === 'ubicacion_maps' && !conUbicacion)) continue;
    const v = req[k];
    if (v === null || v === undefined || v === '' || typeof v === 'object') continue;
    const c = campos.get(k);
    const label = c?.label ?? (k === 'ubicacion_maps' ? 'Ubicación (Google Maps)' : (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, ' '));
    out.push({ label, valor: `${String(v)}${c?.unit ? ` ${c.unit}` : ''}` });
  }
  return out;
}
