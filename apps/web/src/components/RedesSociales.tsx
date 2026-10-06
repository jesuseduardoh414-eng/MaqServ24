import { whatsappHref } from '@/lib/telefono';

/**
 * REDES SOCIALES (2026-10-05).
 *
 * Las redes se capturan en Diseño → Footer como pares etiqueta/enlace. Antes se
 * pintaban como letras sueltas ("f", "in", "ig") y, sin enlace, llevaban a "#".
 * Aquí se reconoce cada red por su DIRECCIÓN (no por la etiqueta), se pinta su
 * icono, se quitan los parámetros de rastreo con que se comparten los enlaces
 * ("?mibextid=", "?si=", "?_r="…) y se omite la que no tenga enlace. La entrada
 * de WhatsApp sin enlace toma el número de Diseño → Contacto.
 */

export type Red = 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'whatsapp' | 'threads' | 'x' | 'web';

const NOMBRE: Record<Red, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
  threads: 'Threads',
  x: 'X',
  web: 'Sitio',
};

/** Parámetros que agregan las apps al compartir y que no deben publicarse. */
const RASTREO = /^(utm_\w+|mibextid|si|_r|_t|igsh|igshid|stkn|fbclid|ref|share_id|is_from_webapp|sender_device)$/i;

export function limpiarUrl(href: string): string | null {
  const v = (href ?? '').trim();
  if (!/^https?:\/\//i.test(v)) return null;
  try {
    const u = new URL(v);
    for (const k of [...u.searchParams.keys()]) if (RASTREO.test(k)) u.searchParams.delete(k);
    u.hash = '';
    return u.toString().replace(/\?$/, '');
  } catch {
    return null;
  }
}

export function redDe(href: string, etiqueta = ''): Red {
  const h = href.toLowerCase();
  const e = etiqueta.trim().toLowerCase();
  // Primero la dirección; si no hay, la etiqueta (abreviada o completa).
  if (/facebook\.com|fb\.com|fb\.me/.test(h) || e === 'f' || e === 'fb' || e === 'facebook') return 'facebook';
  if (/instagram\.com/.test(h) || e === 'ig' || e === 'instagram') return 'instagram';
  if (/tiktok\.com/.test(h) || e === 'tt' || e === 'tiktok') return 'tiktok';
  if (/youtube\.com|youtu\.be/.test(h) || e === 'yt' || e === 'youtube') return 'youtube';
  if (/linkedin\.com/.test(h) || e === 'in' || e === 'linkedin') return 'linkedin';
  if (/wa\.me|whatsapp\.com/.test(h) || e === 'wa' || e === 'whatsapp') return 'whatsapp';
  if (/threads\.(net|com)/.test(h)) return 'threads';
  if (/(^|\/\/|\.)x\.com|twitter\.com/.test(h)) return 'x';
  return 'web';
}

/** Lista lista para pintar: con enlace limpio, sin vacías y sin repetidas. */
export function redesParaMostrar(
  lista: Array<{ label: string; href: string }> | null | undefined,
  whatsapp?: string | null,
): Array<{ red: Red; nombre: string; href: string }> {
  const vistas = new Set<string>();
  const salida: Array<{ red: Red; nombre: string; href: string }> = [];
  for (const s of lista ?? []) {
    const red = redDe(s.href ?? '', s.label ?? '');
    let href = limpiarUrl(s.href ?? '');
    if (!href && red === 'whatsapp' && whatsapp) href = whatsappHref(whatsapp);
    if (!href || vistas.has(href)) continue;
    vistas.add(href);
    salida.push({ red, nombre: NOMBRE[red], href });
  }
  return salida;
}

/** Iconos de marca, trazo simple a 24 px (monocromos: toman el color del texto). */
function IconoRed({ red }: { red: Red }) {
  const p = { width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': true } as const;
  switch (red) {
    case 'facebook':
      return <svg {...p} fill="currentColor"><path d="M13.5 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.6-1.5h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H8v3h2.5V21h3z" /></svg>;
    case 'instagram':
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" /></svg>;
    case 'tiktok':
      return <svg {...p} fill="currentColor"><path d="M16.6 3c.3 2.1 1.6 3.6 3.9 3.8v3c-1.4.1-2.7-.3-3.9-1.1v6.1c0 3.4-2.6 5.7-5.7 5.7a5.6 5.6 0 0 1-5.6-5.6c0-3.4 2.9-6 6.4-5.6v3.1c-1.6-.4-3.3.7-3.3 2.4 0 1.4 1.1 2.5 2.5 2.5 1.6 0 2.6-1.1 2.6-2.8V3h3.1z" /></svg>;
    case 'youtube':
      return <svg {...p} fill="currentColor"><path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.8 12 4.8 12 4.8s-6 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9C2 8.9 2 12 2 12s0 3.1.4 4.8a2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9c.4-1.7.4-4.8.4-4.8s0-3.1-.4-4.8zM10 15.1V8.9l5.2 3.1L10 15.1z" /></svg>;
    case 'linkedin':
      return <svg {...p} fill="currentColor"><path d="M4.5 9h3v11h-3zM6 3.8a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6zM10 9h2.9v1.5c.4-.8 1.5-1.7 3.1-1.7 3.3 0 3.9 2.1 3.9 4.9V20h-3v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9V20H10z" /></svg>;
    case 'whatsapp':
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M4 20l1.2-3.6A8 8 0 1 1 8 19.2L4 20z" /><path d="M9.2 8.7c.2-.4.5-.4.8-.4h.5c.2 0 .4.1.5.4l.6 1.5c.1.2 0 .5-.1.7l-.5.5c.5 1 1.3 1.8 2.3 2.3l.5-.5c.2-.2.5-.2.7-.1l1.5.6c.3.1.4.3.4.5v.5c0 .3 0 .6-.4.8-.6.4-1.5.6-2.6.2a8.5 8.5 0 0 1-4.6-4.6c-.4-1.1-.2-2 .2-2.6z" fill="currentColor" stroke="none" /></svg>;
    case 'threads':
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M16.5 11.2c-.4-2.6-2.1-3.7-4.3-3.7-2.3 0-3.8 1.4-4 3.3M16.7 11.4c2.8 1.2 3.1 4.2 1.4 6.1-1.4 1.6-3.6 2.5-6.1 2.5-4.7 0-7.5-3.3-7.5-8s2.8-8 7.5-8c3.6 0 6 1.8 7 4.6" /><path d="M16.7 11.4c-3-1-7.4-.6-7.3 2.1.1 2.4 4.5 2.6 5.9.6.6-.8.9-1.7 1.4-2.7z" /></svg>;
    case 'x':
      return <svg {...p} fill="currentColor"><path d="M17.8 3h3l-6.6 7.6L22 21h-6.1l-4.8-6.3L5.6 21h-3l7.1-8.1L2.4 3h6.2l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z" /></svg>;
    default:
      return <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" /></svg>;
  }
}

/**
 * Fila de iconos de redes. `tono="claro"` para fondos oscuros fijos (el pie,
 * que va sobre --band); `tono="tema"` sigue los colores del tema.
 */
export function RedesSociales({
  redes,
  whatsapp,
  tono = 'tema',
  conNombre = false,
  forma = 'iconos',
}: {
  redes: Array<{ label: string; href: string }> | null | undefined;
  whatsapp?: string | null;
  tono?: 'tema' | 'claro';
  conNombre?: boolean;
  /** `lista`: una debajo de otra con icono y nombre, como las columnas del pie.
   *  `barra`: solo iconos grandes en fila (la franja de redes del pie). */
  forma?: 'iconos' | 'lista' | 'barra';
}) {
  const lista = redesParaMostrar(redes, whatsapp);
  if (lista.length === 0) return null;
  if (forma === 'lista') conNombre = true;
  if (forma === 'barra') conNombre = false;
  return (
    <ul className={`rs-redes rs-${tono}${conNombre ? ' rs-nombre' : ''}${forma === 'lista' ? ' rs-lista' : ''}${forma === 'barra' ? ' rs-barra' : ''}`} aria-label="Redes sociales de MAQSER24">
      <style>{CSS}</style>
      {lista.map((r) => (
        <li key={r.href}>
          <a
            href={r.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${r.nombre} de MAQSER24 (se abre en otra pestaña)`}
            title={r.nombre}
            data-evento={`red_${r.red}`}
          >
            <IconoRed red={r.red} />
            {conNombre ? <span>{r.nombre}</span> : null}
          </a>
        </li>
      ))}
    </ul>
  );
}

const CSS = `
.rs-redes{ list-style:none; margin:0; padding:0; display:flex; flex-wrap:wrap; gap:8px; }
.rs-redes a{ display:inline-flex; align-items:center; justify-content:center; gap:8px; min-width:38px; height:38px; padding:0 10px; border-radius:8px; text-decoration:none; font-size:13.5px; font-weight:600; transition:border-color .18s ease, color .18s ease, background .18s ease; }
.rs-tema a{ border:1px solid var(--color-border); color:var(--color-text-muted); background:var(--color-surface); }
.rs-tema a:hover{ color:var(--color-text); border-color:color-mix(in srgb, var(--color-primary) 55%, var(--color-border)); }
.rs-claro a{ border:1px solid rgba(255,255,255,.16); color:rgba(255,255,255,.78); }
.rs-claro a:hover{ color:#fff; border-color:rgba(255,255,255,.4); background:rgba(255,255,255,.06); }
.rs-nombre a{ padding:0 14px 0 12px; }
.rs-redes a:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; }
/* Lista: igual que los enlaces de las columnas del pie (14 px, peso normal). */
.rs-lista{ flex-direction:column; flex-wrap:nowrap; align-items:flex-start; gap:11px; }
.rs-lista a{ height:auto; min-width:0; padding:0 !important; border:none !important; background:none !important; gap:9px; font-size:14px; font-weight:400; }
.rs-lista a svg{ width:16px; height:16px; flex-shrink:0; }
.rs-claro.rs-lista a{ color:rgba(255,255,255,.7); }
.rs-claro.rs-lista a:hover{ color:#fff; }
/* Barra: iconos grandes en fila, área de toque de 48 px. */
.rs-barra{ gap:12px; }
.rs-barra a{ width:48px; min-width:48px; height:48px; padding:0; border-radius:12px; }
.rs-barra a svg{ width:24px; height:24px; }
`;
