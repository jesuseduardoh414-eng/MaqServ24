/**
 * ENLACES A /productos MIENTRAS NO HAY PRODUCTOS (2026-10-05).
 *
 * MAQSER24 hoy sólo publica servicios, y `/productos` redirige a `/servicios`.
 * El tema publicado trae cinco botones y enlaces a `/productos` (hero,
 * bloques, Quiénes somos, pie): funcionaban, pero con un salto de redirección
 * y, en el pie, con la etiqueta "Productos" llevando a servicios.
 *
 * Se corrige AL SERVIR el tema, no en la base: el día que haya productos
 * publicados los enlaces vuelven solos a `/productos`, sin que nadie tenga que
 * acordarse de editar cinco campos. El editor del panel sigue viendo lo
 * guardado (no pasa por aquí).
 *
 * Sólo se tocan la lista (`/productos`, `/productos?…`), nunca una ficha
 * (`/productos/<slug>`), que es la dirección real de un producto.
 */
const LISTA = /^\/productos(?=$|\?)/;

export function enlacesDeCatalogo<T>(valor: T): T {
  return cambiar(valor) as T;
}

function cambiar(v: unknown): unknown {
  if (typeof v === 'string') return LISTA.test(v) ? v.replace(LISTA, '/servicios') : v;
  if (Array.isArray(v)) return v.map(cambiar);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(o)) out[k] = cambiar(x);
    // El renglón del pie "Productos → /productos" pasaría a decir "Productos"
    // llevando a servicios: se renombra con su destino.
    if (typeof o.href === 'string' && LISTA.test(o.href) && typeof o.label === 'string' && o.label.trim().toLowerCase() === 'productos') {
      out.label = 'Servicios';
    }
    return out;
  }
  return v;
}
