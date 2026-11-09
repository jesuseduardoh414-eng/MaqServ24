/**
 * PLANTILLAS DE CORREO.
 *
 * El correo no es la web: Outlook todavía usa el motor de Word, Gmail recorta
 * el `<style>` y ninguno entiende variables CSS. Por eso aquí no se usan los
 * tokens del tema —que es lo primero que uno querría hacer— sino colores
 * literales, tablas y estilos en línea. Es feo por dentro y es la única forma
 * de que se vea igual en los dos.
 *
 * Los colores son los del manual MAQSER24, ajustados a fondo claro: el correo
 * se imprime y se reenvía, y el negro técnico se come el tóner.
 */

import { aplicar, disenoDe, disenoSincrono, textosDe, type DisenoCorreo, type Previa } from './textos-correo';
import { imageUrl } from '../catalog/images';

// Los botones, títulos y acentos toman el color del diseño del panel (Correo › Diseño).
const TINTA = '#11161D';
const TINTA2 = '#333D48';
const GRIS = '#6B7683';
const BORDE = '#DCE3EA';
const FONDO = '#F4F7FA';

const SITIO = process.env.SITE_URL ?? 'https://maqser24.com';
/**
 * `https://maqser24.com` → `maqser24.com`: el dominio que se nombra en los pies.
 * Con try: una SITE_URL mal escrita no debe tumbar la API al arrancar.
 */
const DOMINIO = (() => {
  try {
    return new URL(SITIO).hostname.replace(/^www\./, '');
  } catch {
    return 'maqser24.com';
  }
})();

/** Escapa lo que viene del usuario. Un nombre con `<` rompería el HTML. */
export function esc(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const money = (n: number) =>
  `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * El marco común. Ancho fijo de 600 px porque es lo que cabe en el panel de
 * lectura de Outlook sin barra horizontal.
 *
 * DISEÑO EDITABLE (2026-10-28): logo o nombre, color de la franja y los
 * botones, pie general y firma salen de `correo_diseno` (ver textos-correo.ts).
 * Las plantillas ya pasadas al panel llaman `marcoCon(d, …)` con el diseño
 * leído; las demás siguen con `marco()`, que lee el de fábrica.
 */
function marcoCon(d: DisenoCorreo, contenido: string, pie?: string): string {
  // Con fondo (de fábrica, el negro tecnológico del sitio) el logo va encima y el
  // nombre en blanco; sin fondo, la cabecera es blanca con la franja de color arriba.
  const oscura = Boolean(d.cabecera);
  const cabeza = d.logo
    ? `<img src="${esc(absoluta(d.logo))}" alt="${esc(d.nombre)}" height="40" style="display:block;height:40px;width:auto;max-width:240px;border:0;color:${oscura ? '#F5F7FA' : esc(d.color)};font-size:16px;font-weight:bold;letter-spacing:2px;">`
    : `<div style="font-size:16px;font-weight:bold;color:${oscura ? '#F5F7FA' : esc(d.color)};letter-spacing:2px;">${esc(d.nombre)}</div>`;
  const celdaCabeza = oscura
    ? `<td bgcolor="${esc(d.cabecera)}" style="background:${esc(d.cabecera)};padding:20px 28px;border-bottom:3px solid ${esc(d.color)};border-radius:4px 4px 0 0;">`
    : `<td style="padding:22px 28px 0;border-top:3px solid ${esc(d.color)};">`;
  const firma = d.firma.trim()
    ? `<p style="margin:22px 0 0;padding-top:14px;border-top:1px solid ${BORDE};color:${TINTA2};font-size:14px;line-height:1.5;">${parrafos(d.firma)}</p>`
    : '';
  // Ancho: 100% con tope de 600 (auditoría 2026-10-28). Con 600 fijo el correo
  // medía 632 px en el teléfono y había que deslizarlo de lado. Outlook de
  // escritorio no entiende max-width: a él le toca la tabla fantasma de 600.
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${FONDO};margin:0;padding:24px 8px;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center">
    <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF;border:1px solid ${BORDE};border-radius:4px;">
      <tr>${celdaCabeza}
        ${cabeza}
      </td></tr>
      <tr><td style="padding:18px 28px 28px;color:${TINTA2};font-size:15px;line-height:1.6;">
        ${contenido}${firma}
      </td></tr>
      <tr><td style="padding:16px 28px 22px;border-top:1px solid ${BORDE};color:${GRIS};font-size:12px;line-height:1.55;word-break:break-word;overflow-wrap:anywhere;">
        ${pie ?? esc(d.pie)}
      </td></tr>
    </table>
    <!--[if mso]></td></tr></table><![endif]-->
  </td></tr>
</table>`;
}
/** Las plantillas que aún no están en el editor: el mismo diseño, leído sin esperar. */
function marco(contenido: string, pie?: string): string {
  return marcoCon(disenoSincrono(), contenido, pie);
}

/**
 * "uploads/logo.png" → URL completa; el correo se abre fuera del sitio. Es la
 * misma dirección que usa el sitio para sus imágenes (auditoría 2026-10-28:
 * antes armaba ${MEDIA_URL ?? SITE_URL/media}, que no existe, y el logo
 * subido en Correo › Diseño no salía).
 */
function absoluta(ruta: string): string {
  return imageUrl(ruta) ?? ruta;
}

/** Texto del panel con saltos de línea → párrafos. Escapado: lo escribe una persona, pero no HTML. */
function parrafos(t: string): string {
  return esc(t).split(/\n{2,}/).map((p) => p.replace(/\n/g, '<br>')).join('</p><p style="margin:10px 0 0;">');
}

function titulo(t: string, color: string = disenoSincrono().colorTexto): string {
  return `<h1 style="margin:0 0 14px;font-size:21px;line-height:1.25;color:${esc(color)};font-weight:bold;">${esc(t)}</h1>`;
}

/**
 * Un hueco editable ya con sus datos, listo para el HTML. Los datos se escapan
 * AQUÍ, no antes: así el panel escribe frases y nunca HTML, y un nombre con
 * `<` no rompe nada. `crudo`: valores que ya vienen en HTML (negritas).
 */
function hueco(textos: Record<string, string>, clave: string, datos: Record<string, string | number | null | undefined>, crudo: Record<string, string> = {}): string {
  const escapados = Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, v == null ? '' : esc(String(v))]));
  return aplicar(esc(textos[clave] ?? ''), { ...escapados, ...crudo });
}
/** Lo mismo para el asunto: texto plano, sin escapar. */
function asunto(textos: Record<string, string>, clave: string, datos: Record<string, string | number | null | undefined>): string {
  return aplicar(textos[clave] ?? '', datos);
}
/**
 * Un hueco como TEXTO, para títulos y botones: ellos escapan al pintar. Con
 * `hueco()` se escapaba dos veces y un "&" salía "&amp;" (2026-10-28).
 */
const plano = asunto;
const negrita = (t: string, color: string = TINTA) => `<strong style="color:${esc(color)};">${esc(t)}</strong>`;

function boton(texto: string, url: string, color: string = disenoSincrono().color): string {
  // Escapado y solo http(s)/mailto (auditoría 2026-10-23): hoy todas las URL las
  // arma el servidor, pero por aquí entró el `redirectTo` del restablecimiento.
  const destino = /^(https?:\/\/|mailto:)/i.test(url) ? esc(url) : '#';
  // Sin border-radius grande y con padding en el <a>: Outlook ignora el radio y
  // no hereda el padding de la celda.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 6px;">
    <tr><td style="background:${esc(color)};border-radius:3px;">
      <a href="${destino}" style="display:inline-block;padding:12px 22px;color:#FFFFFF;font-size:15px;font-weight:bold;text-decoration:none;">${esc(texto)}</a>
    </td></tr>
  </table>`;
}

/** Filas etiqueta/valor. Se usa para el desglose de precio. */
function datos(filas: Array<[string, string]>): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;border:1px solid ${BORDE};border-radius:3px;">
    ${filas
      .map(
        ([k, v], i) =>
          `<tr>
            <td style="padding:9px 14px;color:${GRIS};font-size:13px;${i ? `border-top:1px solid ${BORDE};` : ''}">${esc(k)}</td>
            <td style="padding:9px 14px;color:${TINTA};font-size:14px;text-align:right;font-weight:bold;${i ? `border-top:1px solid ${BORDE};` : ''}">${esc(v)}</td>
          </tr>`,
      )
      .join('')}
  </table>`;
}

// ─────────────────────────── Al cliente ───────────────────────────

export async function correoCotizacionRespondida(d: {
  nombre: string;
  folio: string;
  total: number;
  validUntil: string | null;
  included: string | null;
  excluded: string | null;
  /** Folio del documento del cotizador (MQ-/TR-), si se cotizó con el tabulador. */
  documento?: string | null;
}, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('quote_answered', previa), disenoDe(previa)]);
  const v = { nombre: d.nombre, folio: d.folio, documento: d.documento ?? '', vigencia: d.validUntil ?? '', total: money(d.total) };
  const filas: Array<[string, string]> = [['Total', money(d.total)]];
  if (d.documento) filas.push(['Documento', d.documento]);
  if (d.validUntil) filas.push(['El precio vale hasta', d.validUntil]);

  const extras = [
    d.included ? `<p style="margin:14px 0 0;"><strong style="color:${TINTA};">Incluye:</strong> ${esc(d.included)}</p>` : '',
    // Lo que NO incluye va con el mismo peso que lo que sí: es el campo que
    // evita la discusión cuando llega la factura.
    d.excluded ? `<p style="margin:8px 0 0;"><strong style="color:${TINTA};">No incluye:</strong> ${esc(d.excluded)}</p>` : '',
  ].join('');

  const fuertes = { folio: negrita(d.folio, ds.colorTexto), documento: negrita(d.documento ?? '', ds.colorTexto) };
  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0 0 4px;">${hueco(t, 'saludo', v)}</p>
      <p style="margin:0;">${hueco(t, 'intro', v, fuertes)}</p>
      ${datos(filas)}
      ${extras}
      ${d.documento ? `<p style="margin:14px 0 0;">${hueco(t, 'documento', v, fuertes)}</p>` : ''}
      ${boton(plano(t, 'boton', v), `${SITIO}/cuenta/cotizaciones/${encodeURIComponent(d.folio)}`, ds.color)}
      <p style="margin:14px 0 0;font-size:13px;color:${GRIS};">${hueco(t, 'cierre', v)}</p>`,
      d.validUntil ? hueco(t, 'pie', v) : undefined,
    ),
  };
}

export async function correoCotizacionPorVencer(d: {
  nombre: string;
  folio: string;
  total: number;
  validUntil: string;
  dias: number;
}, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('quote_expiring', previa), disenoDe(previa)]);
  const cuando =
    d.dias <= 0 ? 'vence hoy' : d.dias === 1 ? 'vence mañana' : `vence en ${d.dias} días`;
  const v = { nombre: d.nombre, folio: d.folio, cuando, monto: d.total > 0 ? ` por ${money(d.total)}` : '', vigencia: d.validUntil };
  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0 0 4px;">${hueco(t, 'saludo', v)}</p>
      <p style="margin:0;">${hueco(t, 'intro', v, { folio: negrita(d.folio, ds.colorTexto) })}</p>
      <p style="margin:12px 0 0;">${hueco(t, 'aviso', v)}</p>
      ${boton(plano(t, 'boton', v), `${SITIO}/cuenta/cotizaciones/${encodeURIComponent(d.folio)}`, ds.color)}`,
    ),
  };
}

export async function correoServicioAvanzo(d: {
  nombre: string;
  folio: string;
  etapa: string;
  mensaje: string;
  aliados: string[];
  cierre: string | null;
  /** Solo al cerrar: enlace firmado para calificar el servicio sin iniciar sesión. */
  resena?: string | null;
  /** Al quedar asignado: cuándo prometió llegar el aliado ("jueves 16 de octubre, 8:00 a.m."). */
  llegada?: string | null;
  /** El aviso de que un aliado tomó el servicio: se dice "confirmado", no "asignado" (2026-10-15). */
  confirmacion?: boolean;
  /** Qué unidad va ("Eco. 12 · placas RX-12-345"), si el aliado ya lo dijo (2026-11-09). */
  unidad?: string | null;
}, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('service_status', previa), disenoDe(previa)]);
  const v = { nombre: d.nombre, folio: d.folio, etapa: d.etapa.toLowerCase(), aliados: d.aliados.join(' y '), llegada: d.llegada ?? '', cierre: d.cierre ?? '', unidad: d.unidad ?? '' };
  const b = (k: string) => negrita(v[k as keyof typeof v], ds.colorTexto);
  const quien =
    d.aliados.length > 0
      ? `<p style="margin:12px 0 0;">${hueco(t, 'quien', v, { aliados: b('aliados') })}${d.llegada ? ` ${hueco(t, 'llegada', v, { llegada: b('llegada') })}` : ''}${d.unidad ? ` ${hueco(t, 'unidad', v, { unidad: b('unidad') })}` : ''}</p>`
      : '';
  const cierre = d.cierre
    ? `<p style="margin:12px 0 0;">${hueco(t, 'cierre', v, { cierre: b('cierre') })}</p>`
    : '';
  const detalle = `${SITIO}/cuenta/cotizaciones/${encodeURIComponent(d.folio)}`;
  // Al cerrar, lo que se pide es la calificación: va como botón y el detalle como enlace.
  const acciones = d.resena
    ? `<p style="margin:18px 0 0;">${hueco(t, 'calificar', v)}</p>
      ${boton(plano(t, 'botonCalificar', v), `${SITIO}${d.resena}`, ds.color)}
      <p style="margin:6px 0 0;font-size:13px;"><a href="${detalle}" style="color:${esc(ds.color)};">${hueco(t, 'verDetalle', v)}</a></p>`
    : boton(plano(t, 'boton', v), detalle, ds.color);
  return {
    subject: d.resena ? asunto(t, 'asuntoTermino', v) : d.confirmacion ? asunto(t, 'asuntoConfirmado', v) : asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(d.confirmacion ? hueco(t, 'tituloConfirmado', v) : d.etapa, ds.colorTexto)}
      <p style="margin:0 0 4px;">${hueco(t, 'saludo', v)}</p>
      <p style="margin:0;">${esc(d.mensaje)}</p>
      ${quien}
      ${cierre}
      ${acciones}`,
    ),
  };
}

// ─────────────────────────── Al aliado ───────────────────────────

export async function correoOfertaAAliado(d: {
  aliado: string;
  contacto: string | null;
  categoria: string | null;
  zona: string | null;
  folio: string;
  detalle: string | null;
  /** Importe que el cliente ya vio y aceptó (solicitudes del cotizador). */
  total?: number | null;
  /** Lo que se le paga a él (2026-10-22): manda sobre `total`, que es del cliente. */
  pago?: { monto: number; masIva: boolean } | null;
  /** Las partidas de la cotización (2026-10-15): qué y cuánto, sin importes (2026-10-23). */
  partidas?: Array<{ concepto: string; cantidad: string }>;
  /** Folio del documento del cotizador (MQ-/TR-). */
  documento?: string | null;
  /** Se le ofreció a varios a la vez: el primero que acepte se la queda. */
  automatica?: boolean;
  /** Enlace firmado a su portal, donde acepta o rechaza. */
  url?: string | null;
}, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('provider_offer', previa), disenoDe(previa)]);
  const v = { aliado: d.aliado, contacto: d.contacto ?? '', folio: d.folio, zona: d.zona ? ` en ${d.zona}` : '' };
  const filas: Array<[string, string]> = [];
  if (d.categoria) filas.push(['Servicio', d.categoria]);
  if (d.zona) filas.push(['Dónde', d.zona]);
  // Solo lo suyo: ni el precio al cliente ni la comisión (decisión de Dirección, 2026-10-23).
  if (d.pago) filas.push(['Te pagamos', `${money(d.pago.monto)}${d.pago.masIva ? ' + IVA' : ''}`]);
  if (d.documento) filas.push(['Cotización', d.documento]);
  filas.push(['Folio', d.folio]);
  const partidas = d.partidas?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:14px 0 0;border-collapse:collapse;font-size:13.5px;">
        ${d.partidas.map((r) => `<tr>
          <td style="padding:6px 0;border-bottom:1px solid #E5E7EB;color:${TINTA};">${esc(r.concepto)}<div style="color:${GRIS};font-size:12.5px;">${esc(r.cantidad)}</div></td>
        </tr>`).join('')}
      </table>`
    : '';
  const primero = d.automatica
    ? `<p style="margin:16px 0 0;padding:10px 12px;border-radius:3px;background:#FFF7E6;color:${esc(ds.colorTexto)};"><strong>${hueco(t, 'varios', v)}</strong></p>`
    : '';

  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0 0 4px;">${d.contacto ? hueco(t, 'saludo', v) : 'Hola,'}</p>
      <p style="margin:0;">${hueco(t, 'intro', v)}${d.total != null && d.total > 0 ? ` ${hueco(t, 'aceptado', v)}` : ''}</p>
      ${datos(filas)}
      ${partidas}
      ${d.detalle ? `<p style="margin:12px 0 0;color:${TINTA2};">${esc(d.detalle)}</p>` : ''}
      ${primero}
      <p style="margin:16px 0 0;">${hueco(t, 'pedir', v)}</p>
      ${d.url ? boton(plano(t, 'boton', v), d.url, ds.color) : ''}
      <p style="margin:12px 0 0;font-size:13px;color:${GRIS};">${d.url ? hueco(t, 'nota', v) : 'Responde este correo o márcanos. Mientras no contestes, la solicitud sigue abierta para otro aliado.'}</p>`,
      hueco(t, 'pie', v),
    ),
  };
}

/**
 * AL ALIADO: UNA OFERTA SIN CONTESTAR (2026-10-21).
 *
 * Sale una vez, a la mitad del tiempo que se le da para contestar (ver
 * quotes/seguimiento-ofertas.ts). Pasado ese tiempo MAQSER24 puede dárselo a
 * otro aliado: desde el 2026-10-23 ya no se ofrece solo, lo decide una persona.
 */
export async function correoRecordatorioOferta(d: {
  aliado: string;
  contacto: string | null;
  folio: string;
  categoria: string | null;
  zona: string | null;
  /** Cuánto lleva esperando, ya en palabras ("2 h"). */
  esperando: string;
  url?: string | null;
}, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('provider_offer_reminder', previa), disenoDe(previa)]);
  const v = { aliado: d.aliado, contacto: d.contacto ?? '', folio: d.folio, esperando: d.esperando };
  const filas: Array<[string, string]> = [];
  if (d.categoria) filas.push(['Servicio', d.categoria]);
  if (d.zona) filas.push(['Dónde', d.zona]);
  filas.push(['Folio', d.folio]);
  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0 0 4px;">${d.contacto ? hueco(t, 'saludo', v) : 'Hola,'}</p>
      <p style="margin:0;">${hueco(t, 'intro', v)}</p>
      ${datos(filas)}
      <p style="margin:0;padding:10px 12px;border-radius:3px;background:#FFF7E6;color:${esc(ds.colorTexto)};"><strong>${hueco(t, 'aviso', v)}</strong></p>
      ${d.url ? boton(plano(t, 'boton', v), d.url, ds.color) : ''}
      <p style="margin:12px 0 0;font-size:13px;color:${GRIS};">${hueco(t, 'nota', v)}</p>`,
      hueco(t, 'pie', v),
    ),
  };
}

/**
 * MAÑANA ES EL SERVICIO (2026-10-15). Un día antes a las 6 pm, al cliente y
 * al aliado, para que los dos sepan qué viene y a qué hora. El mismo día el
 * aliado recibe además el aviso de hora de salir.
 */
export async function correoRecordatorioServicio(d: {
  para: 'cliente' | 'aliado';
  nombre: string | null;
  folio: string;
  /** "jueves 16 de octubre, 8:00 a.m." */
  llegada: string;
  aliado: string | null;
  obra: string | null;
  direccion: string | null;
  requisitos?: string[];
  /** Cliente: su cuenta. Aliado: su portal. */
  url: string | null;
  /** Qué unidad va, con sus placas, para que el cliente avise en la caseta (2026-11-09). */
  unidad?: string | null;
}, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe(d.para === 'cliente' ? 'service_day_before' : 'provider_day_before', previa), disenoDe(previa)]);
  const v = { nombre: d.nombre ?? '', contacto: d.nombre ?? '', folio: d.folio, llegada: d.llegada };
  const filas: Array<[string, string]> = [['Llegada', d.llegada]];
  if (d.obra) filas.push(['Obra', d.obra]);
  if (d.direccion) filas.push(['Dirección', d.direccion]);
  if (d.para === 'cliente' && d.aliado) filas.push(['Te atiende', d.aliado]);
  if (d.unidad) filas.push(['Unidad', d.unidad]);
  filas.push(['Folio', d.folio]);
  const saludo = `<p style="margin:0 0 4px;">${d.nombre ? hueco(t, 'saludo', v) : 'Hola,'}</p>`;
  if (d.para === 'cliente') {
    return {
      subject: asunto(t, 'asunto', v),
      html: marcoCon(ds,
        `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
        ${saludo}
        <p style="margin:0;">${hueco(t, 'intro', v)}</p>
        ${datos(filas)}
        <p style="margin:14px 0 0;">${hueco(t, 'aviso', v)}</p>
        ${d.url ? boton(plano(t, 'boton', v), d.url, ds.color) : ''}
        <p style="margin:12px 0 0;font-size:13px;color:${GRIS};">${hueco(t, 'cierre', v)}</p>`,
      ),
    };
  }
  const reqs = d.requisitos?.length
    ? `<p style="margin:14px 0 0;"><strong style="color:${esc(ds.colorTexto)};">${hueco(t, 'exige', v)}</strong> ${esc(d.requisitos.join(' · '))}</p>`
    : '';
  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      ${saludo}
      <p style="margin:0;">${hueco(t, 'intro', v)}</p>
      ${datos(filas)}
      ${reqs}
      <p style="margin:14px 0 0;">${hueco(t, 'marcar', v)}</p>
      ${d.url ? boton(plano(t, 'boton', v), d.url, ds.color) : ''}`,
      hueco(t, 'pie', v),
    ),
  };
}

/**
 * HORA DE SALIR (2026-10-15). Al aliado, antes de la hora en que su unidad
 * debe salir para llegar a la hora que prometió; y, si no marca la salida, un
 * segundo aviso. Marcar "Ya salió la unidad" es lo que pone el servicio en
 * traslado: el cliente lo ve en camino y el rastreo arranca.
 */
export async function correoHoraDeSalir(d: {
  contacto: string | null;
  folio: string;
  obra: string | null;
  direccion: string | null;
  /** "8:00 a.m." */
  llegada: string;
  salida: string;
  /** Minutos de camino calculados (null = no se pudo calcular). */
  minutos: number | null;
  url: string | null;
  tarde: boolean;
}, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('provider_departure', previa), disenoDe(previa)]);
  const v = { contacto: d.contacto ?? '', folio: d.folio, llegada: d.llegada, salida: d.salida, camino: d.minutos ? ` (calculamos unos ${d.minutos} min de camino)` : '' };
  const filas: Array<[string, string]> = [];
  if (d.obra) filas.push(['Obra', d.obra]);
  if (d.direccion) filas.push(['Dirección', d.direccion]);
  filas.push(['Llegada comprometida', d.llegada]);
  filas.push(['Debe salir a más tardar', d.salida]);
  filas.push(['Folio', d.folio]);
  const fuertes = { llegada: negrita(d.llegada, ds.colorTexto), salida: negrita(d.salida, ds.colorTexto) };

  // El segundo aviso también se edita en el panel desde el 2026-11-09.
  if (d.tarde) {
    return {
      subject: asunto(t, 'asuntoTarde', v),
      html: marcoCon(ds,
        `${titulo(plano(t, 'tituloTarde', v), ds.colorTexto)}
        <p style="margin:0 0 4px;">${d.contacto ? hueco(t, 'saludo', v) : 'Hola,'}</p>
        <p style="margin:0;">${hueco(t, 'introTarde', v, fuertes)}</p>
        ${datos(filas)}
        <p style="margin:14px 0 0;">${hueco(t, 'marcarTarde', v)}</p>
        ${d.url ? boton(plano(t, 'boton', v), d.url, ds.color) : ''}`,
        hueco(t, 'pie', v),
      ),
    };
  }
  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0 0 4px;">${d.contacto ? hueco(t, 'saludo', v) : 'Hola,'}</p>
      <p style="margin:0;">${hueco(t, 'intro', v, fuertes)}</p>
      ${datos(filas)}
      <p style="margin:14px 0 0;">${hueco(t, 'marcar', v)}</p>
      ${d.url ? boton(plano(t, 'boton', v), d.url, ds.color) : ''}`,
      hueco(t, 'pie', v),
    ),
  };
}

export async function correoAsignacionAAliado(d: {
  aliado: string;
  contacto: string | null;
  folio: string;
  categoria: string | null;
  zona: string | null;
  direccion: string | null;
  contactoObra: string | null;
  telefonoObra: string | null;
  requisitos: string[];
}, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('provider_assigned', previa), disenoDe(previa)]);
  const v = { aliado: d.aliado, contacto: d.contacto ?? '', folio: d.folio };
  const filas: Array<[string, string]> = [];
  if (d.categoria) filas.push(['Servicio', d.categoria]);
  if (d.direccion) filas.push(['Dirección', d.direccion]);
  if (d.contactoObra) filas.push(['En obra pregunta por', d.contactoObra]);
  if (d.telefonoObra) filas.push(['Su teléfono', d.telefonoObra]);
  filas.push(['Folio', d.folio]);

  // Los requisitos de la obra van destacados: es lo que evita que la unidad
  // llegue y no la dejen entrar.
  const reqs =
    d.requisitos.length > 0
      ? `<div style="margin:16px 0 0;padding:12px 14px;border:1px solid ${esc(ds.color)};border-radius:3px;background:#F0F7FF;">
           <div style="font-size:12px;color:${esc(ds.color)};font-weight:bold;letter-spacing:1px;margin-bottom:6px;">${hueco(t, 'exige', v)}</div>
           <div style="color:${esc(ds.colorTexto)};font-size:14px;">${esc(d.requisitos.join(' · '))}</div>
           <div style="margin-top:6px;font-size:12.5px;color:${GRIS};">${hueco(t, 'exigeNota', v)}</div>
         </div>`
      : '';

  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0 0 4px;">${d.contacto ? hueco(t, 'saludo', v) : 'Hola,'}</p>
      <p style="margin:0;">${hueco(t, 'intro', v)}</p>
      ${datos(filas)}
      ${reqs}
      <p style="margin:16px 0 0;font-size:13px;color:${GRIS};">${hueco(t, 'cierre', v)}</p>`,
      hueco(t, 'pie', v),
    ),
  };
}

/**
 * SE CANCELÓ UN SERVICIO QUE YA ERA SUYO (2026-10-22). Sin esto el aliado se
 * enteraba al llegar a la obra.
 */
export async function correoServicioCanceladoAliado(d: {
  contacto: string | null;
  folio: string;
  categoria: string | null;
  direccion: string | null;
  motivo: string | null;
}, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('provider_cancelled', previa), disenoDe(previa)]);
  const v = { contacto: d.contacto ?? '', folio: d.folio };
  const filas: Array<[string, string]> = [];
  if (d.categoria) filas.push(['Servicio', d.categoria]);
  if (d.direccion) filas.push(['Dirección', d.direccion]);
  filas.push(['Folio', d.folio]);
  if (d.motivo) filas.push(['Motivo', d.motivo]);
  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0 0 4px;">${d.contacto ? hueco(t, 'saludo', v) : 'Hola,'}</p>
      <p style="margin:0 0 12px;padding:10px 12px;border-radius:3px;background:#FFF7E6;color:${esc(ds.colorTexto)};"><strong>${hueco(t, 'aviso', v)}</strong></p>
      <p style="margin:0;">${hueco(t, 'intro', v)}</p>
      ${datos(filas)}
      <p style="margin:16px 0 0;font-size:13px;color:${GRIS};">${hueco(t, 'cierre', v)}</p>`,
      hueco(t, 'pie', v),
    ),
  };
}

export async function correoAccesoAliado(d: {
  aliado: string;
  contacto: string | null;
  url: string;
  dias: number;
  porContestar: number;
}, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('provider_access', previa), disenoDe(previa)]);
  const solicitudes = `${d.porContestar} solicitud${d.porContestar === 1 ? '' : 'es'}`;
  const v = { contacto: d.contacto ?? '', aliado: d.aliado, solicitudes, dias: d.dias };
  // Si tiene solicitudes esperando, ESO es el asunto. Un correo que dice
  // "accede a tu panel" se archiva; uno que dice "tienes 2 solicitudes" se abre.
  const pendiente =
    d.porContestar > 0
      ? `<p style="margin:12px 0 0;"><strong style="color:${esc(ds.colorTexto)};">${hueco(t, 'pendientes', v)}</strong></p>`
      : '';

  return {
    subject: d.porContestar > 0 ? asunto(t, 'asuntoPendientes', v) : asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0 0 4px;">${d.contacto ? hueco(t, 'saludo', v) : 'Hola,'}</p>
      <p style="margin:0;">${hueco(t, 'intro', v)}</p>
      ${pendiente}
      ${boton(plano(t, 'boton', v), d.url, ds.color)}
      <p style="margin:14px 0 0;font-size:13px;color:${GRIS};">${hueco(t, 'nota', v)}</p>`,
      hueco(t, 'pie', v),
    ),
  };
}

/**
 * INVITACIÓN A LA RED (2026-10-27). La manda la oficina con solo el nombre y
 * el correo: el enlace abre "Regístrate como proveedor" con sus datos ya
 * puestos, y lo que llene llega al panel como solicitud.
 */
export async function correoInvitacionAliado(d: { nombre: string; contacto: string | null; url: string }, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('provider_invite', previa), disenoDe(previa)]);
  const v = { contacto: d.contacto ?? '', empresa: d.nombre };
  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0 0 4px;">${d.contacto ? hueco(t, 'saludo', v) : 'Hola,'}</p>
      <p style="margin:0;">${hueco(t, 'intro', v, { empresa: negrita(d.nombre, ds.colorTexto) })}</p>
      <p style="margin:12px 0 0;">${hueco(t, 'registro', v)}</p>
      ${boton(plano(t, 'boton', v), d.url, ds.color)}
      <p style="margin:14px 0 0;font-size:13px;color:${GRIS};">${hueco(t, 'nota', v)}</p>`,
      hueco(t, 'pie', v),
    ),
  };
}

export async function correoRecordatorioAliado(d: {
  aliado: string;
  contacto: string | null;
  url: string;
  documentos: Array<{ texto: string; nombre: string }>;
}, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('availability_reminder', previa), disenoDe(previa)]);
  const v = { contacto: d.contacto ?? '', aliado: d.aliado };
  // Solo papeles (2026-10-26): ya no se le pide confirmar sus equipos cada 14
  // días; la confirmación es cuando acepta o rechaza un servicio.
  const papeles = `<div style="margin:18px 0 0;padding:12px 14px;border:1px solid ${esc(ds.color)};border-radius:3px;background:#F0F7FF;">
           <div style="font-size:12px;color:${esc(ds.color)};font-weight:bold;letter-spacing:1px;margin-bottom:6px;">${hueco(t, 'encabezado', v)}</div>
           ${d.documentos.map((x) => `<div style="color:${TINTA};font-size:14px;margin-bottom:3px;">${esc(x.texto)} — ${esc(x.nombre)}</div>`).join('')}
         </div>`;

  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0 0 4px;">${d.contacto ? hueco(t, 'saludo', v) : 'Hola,'}</p>
      <p style="margin:0;">${hueco(t, 'intro', v)}</p>
      ${papeles}
      ${boton(plano(t, 'boton', v), d.url, ds.color)}
      <p style="margin:14px 0 0;font-size:13px;color:${GRIS};">${hueco(t, 'nota', v)}</p>`,
      hueco(t, 'pie', v),
    ),
  };
}

export function correoDePrueba(destino: string): { subject: string; html: string } {
  return {
    subject: 'Prueba de correo · MAQSER24',
    html: marco(
      `${titulo('El correo funciona')}
      <p style="margin:0;">Si estás leyendo esto, la plataforma ya puede mandar correo a <strong style="color:${TINTA};">${esc(destino)}</strong>.</p>
      <p style="margin:12px 0 0;">Este mensaje se mandó desde el panel de administración para comprobar la configuración. No hace falta contestarlo.</p>`,
    ),
  };
}

/** "60 minutos", "24 horas", "7 días": la vigencia de un enlace, en la unidad que se lee. */
const vigencia = (min: number): string =>
  min % 1440 === 0 ? `${min / 1440} día${min === 1440 ? '' : 's'}` : min % 60 === 0 ? `${min / 60} hora${min === 60 ? '' : 's'}` : `${min} minutos`;

/**
 * "Olvidé mi contraseña": el enlace de un solo uso. `desdeElPanel`: lo mandó
 * Dirección desde Equipo del panel (2026-10-28), no la propia persona.
 */
export async function correoRestablecerContrasena(d: { nombre: string; url: string; minutos: number; desdeElPanel?: string }, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('password_reset', previa), disenoDe(previa)]);
  const v = { nombre: d.nombre, vigencia: vigencia(d.minutos), quien: d.desdeElPanel ?? '' };
  return {
    subject: d.desdeElPanel ? asunto(t, 'asuntoPanel', v) : asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0;">${hueco(t, d.desdeElPanel ? 'motivoPanel' : 'motivo', v)}</p>
      ${boton(plano(t, 'boton', v), d.url, ds.color)}
      <p style="margin:12px 0 0;color:${GRIS};font-size:13px;">${hueco(t, 'nota', v)}</p>`,
      `${hueco(t, 'pie', v)} ${esc(d.url)}`,
    ),
  };
}

/**
 * INVITACIÓN AL PANEL (2026-10-28, decisión del dueño: "mejor que mande un
 * correo con la invitación y que ahí genere su contraseña"). La cuenta ya
 * existe con su rol; el botón abre la pantalla de crear contraseña.
 */
export async function correoInvitacionPanel(d: { nombre: string; invitadoPor: string; rolNombre: string; url: string; dias: number }, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('admin_invitacion', previa), disenoDe(previa)]);
  const v = { nombre: d.nombre, quien: d.invitadoPor, rol: d.rolNombre, dias: d.dias };
  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0;">${hueco(t, 'intro', v, { rol: negrita(d.rolNombre, ds.colorTexto) })}</p>
      ${boton(plano(t, 'boton', v), d.url, ds.color)}
      <p style="margin:12px 0 0;color:${GRIS};font-size:13px;">${hueco(t, 'nota', v)}</p>`,
      `${hueco(t, 'pie', v)} ${esc(d.url)}`,
    ),
  };
}

/**
 * CONFIRMAR EL CORREO al registrarse (2026-09-23).
 *
 * Pedido del cliente: el registro con contraseña no entra hasta confirmar el
 * correo. Es el mismo enlace de siempre —un botón que abre el sitio—, y al
 * abrirlo la cuenta queda confirmada Y con sesión iniciada, de vuelta en el
 * punto desde el que se registró (cotizar, por ejemplo).
 */
export async function correoConfirmarCuenta(d: { nombre: string; url: string; horas: number }, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('email_verification', previa), disenoDe(previa)]);
  const v = { nombre: d.nombre, horas: d.horas };
  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0;">${hueco(t, 'intro', v)}</p>
      ${boton(plano(t, 'boton', v), d.url, ds.color)}
      <p style="margin:12px 0 0;color:${GRIS};font-size:13px;">${hueco(t, 'nota', v)}</p>`,
      `${hueco(t, 'pie', v)} ${esc(d.url)}`,
    ),
  };
}

/**
 * BIENVENIDA al crear la cuenta con Google. Google ya confirmó el correo, así
 * que no hay nada que verificar; pero el cliente pidió que la persona se
 * entere de que su cuenta existe y desde dónde la usa.
 */
export async function correoBienvenida(d: { nombre: string; url: string }, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('welcome', previa), disenoDe(previa)]);
  const v = { nombre: d.nombre };
  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0;">${hueco(t, 'intro', v)}</p>
      ${boton(plano(t, 'boton', v), d.url, ds.color)}
      <p style="margin:12px 0 0;color:${GRIS};font-size:13px;">${hueco(t, 'nota', v)}</p>`,
    ),
  };
}

// ─────────────────── Equipos que ofrece el aliado (2026-09-24) ───────────────────

/** A MAQSER24: un aliado ofreció un equipo desde su portal. */
export async function correoEquipoPropuesto(d: {
  aliado: string;
  equipo: string;
  marca: string | null;
  linea: string;
  url: string;
}, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('provider_offer_review', previa), disenoDe(previa)]);
  const v = { aliado: d.aliado, equipo: d.equipo };
  // Una categoría nueva se decide en Categorías, no en Inventario.
  const enCategorias = /\/categorias$/.test(d.url);
  // Solo sale con lo NUEVO (2026-10-28): lo que ya es de un tipo cuenta solo.
  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0;">${hueco(t, 'intro', v, { aliado: negrita(d.aliado, ds.colorTexto) })}</p>
      ${datos(filas([['Equipo', d.equipo], ['Marca', d.marca], ['Línea', d.linea]]))}
      ${d.url ? boton(plano(t, enCategorias ? 'botonCategoria' : 'boton', v), d.url, ds.color) : ''}`,
    ),
  };
}

/** El texto que escribió una persona, en su caja (mensaje, pregunta, respuesta). */
function cita(texto: string, color: string, tinta: string = TINTA): string {
  return `<div style="margin:0 0 6px;padding:14px 16px;border-left:3px solid ${esc(color)};background:${FONDO};color:${tinta};white-space:pre-wrap;">${esc(texto)}</div>`;
}

/**
 * A MAQSER24: alguien escribió en /contacto. Lleva todo lo necesario para
 * contestar desde el propio correo (Responder va directo al cliente, ver
 * `replyTo` en el envío) y el enlace a Mensajes para marcarlo atendido.
 */
export async function correoContactoInterno(d: {
  nombre: string;
  correo: string;
  telefono: string | null;
  empresa: string | null;
  tema: string | null;
  mensaje: string;
  url: string | null;
}, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('contact_internal', previa), disenoDe(previa)]);
  const v = { nombre: d.nombre, tema: d.tema ? ` · ${d.tema}` : '' };
  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0;">${hueco(t, 'intro', v, { nombre: negrita(d.nombre, ds.colorTexto) })}</p>
      ${datos(filas([['Correo', d.correo], ['Teléfono', d.telefono], ['Empresa', d.empresa], ['Tema', d.tema]]))}
      ${cita(d.mensaje, ds.color)}
      ${d.url ? boton(plano(t, 'boton', v), d.url, ds.color) : ''}`,
      hueco(t, 'pie', v),
    ),
  };
}

/** A MAQSER24: alguien pidió entrar a la red desde /proveedores. */
export async function correoSolicitudProveedorInterno(d: {
  nombre: string;
  tipo: string;
  contacto: string | null;
  telefono: string;
  correo: string | null;
  ubicacion: string;
  ofrece: string;
  mensaje: string;
  url: string | null;
}, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('provider_signup_internal', previa), disenoDe(previa)]);
  const v = { nombre: d.nombre };
  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0;">${hueco(t, 'intro', v, { nombre: negrita(d.nombre, ds.colorTexto) })}</p>
      ${datos(filas([['Tipo', d.tipo], ['Contacto', d.contacto], ['Teléfono', d.telefono], ['Correo', d.correo], ['Ubicación', d.ubicacion], ['Ofrece', d.ofrece]]))}
      ${d.mensaje.trim() ? cita(d.mensaje, ds.color) : ''}
      ${d.url ? boton(plano(t, 'boton', v), d.url, ds.color) : ''}`,
      hueco(t, 'pie', v),
    ),
  };
}

/** A quien se registró como proveedor: lo recibimos y qué sigue. */
export async function correoAcuseProveedor(d: { nombre: string }, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('provider_signup_ack', previa), disenoDe(previa)]);
  const v = { nombre: d.nombre, dominio: DOMINIO };
  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0 0 12px;">${hueco(t, 'intro', v)}</p>
      <p style="margin:0 0 12px;">${hueco(t, 'siguiente', v)}</p>
      <p style="margin:0;">${hueco(t, 'cierre', v)}</p>`,
      hueco(t, 'pie', v),
    ),
  };
}

/** A quien escribió en /contacto: lo recibimos y qué sigue. */
export async function correoAcuseContacto(d: { nombre: string; mensaje: string; telefono: string | null }, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('contact_ack', previa), disenoDe(previa)]);
  const v = { nombre: d.nombre, dominio: DOMINIO };
  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0 0 12px;">${hueco(t, 'intro', v)}</p>
      ${d.telefono ? '' : `<p style="margin:14px 0 0;">${hueco(t, 'sinTelefono', v)}</p>`}`,
      hueco(t, 'pie', v),
    ),
  };
}

/**
 * A quien preguntó (en el sitio, en un producto o por correo): ya respondimos.
 * La respuesta va completa en el correo; el enlace es para ver las demás.
 */
export async function correoPreguntaRespondida(d: { nombre: string | null; pregunta: string; respuesta: string; url: string }, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('question_answered', previa), disenoDe(previa)]);
  const v = { nombre: d.nombre ?? '', dominio: DOMINIO };
  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, d.nombre ? 'titulo' : 'tituloSinNombre', v), ds.colorTexto)}
      <p style="margin:0 0 6px;color:${GRIS};font-size:13px;">${hueco(t, 'suPregunta', v)}</p>
      ${cita(d.pregunta, BORDE, TINTA2)}
      <p style="margin:8px 0 6px;color:${GRIS};font-size:13px;">${hueco(t, 'respuesta', v)}</p>
      ${cita(d.respuesta, ds.color)}
      ${boton(plano(t, 'boton', v), `${SITIO}${d.url}`, ds.color)}
      <p style="margin:10px 0 0;">${hueco(t, 'cierre', v)}</p>`,
      hueco(t, 'pie', v),
    ),
  };
}

/** A quien escribió por Contacto: la respuesta, contestada desde Mensajes. */
export async function correoMensajeRespondido(d: { nombre: string | null; mensaje: string; respuesta: string }, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('contact_reply', previa), disenoDe(previa)]);
  const v = { nombre: d.nombre ?? '', dominio: DOMINIO };
  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, d.nombre ? 'titulo' : 'tituloSinNombre', v), ds.colorTexto)}
      <p style="margin:0 0 6px;color:${GRIS};font-size:13px;">${hueco(t, 'suMensaje', v)}</p>
      ${cita(d.mensaje, BORDE, TINTA2)}
      <p style="margin:8px 0 6px;color:${GRIS};font-size:13px;">${hueco(t, 'respuesta', v)}</p>
      ${cita(d.respuesta, ds.color)}
      <p style="margin:16px 0 0;">${hueco(t, 'cierre', v)}</p>`,
      hueco(t, 'pie', v),
    ),
  };
}

/**
 * Al aliado: lo nuevo que ofreció ya quedó dado de alta en un tipo de
 * MAQSER24 (2026-10-28). Antes decía "publicado", pero su equipo no sale en
 * el sitio: lo que cambia es que ya le llegan las solicitudes de ese tipo.
 */
export async function correoEquipoPublicado(d: { contacto: string | null; equipo: string; tipo: string }, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('provider_offer_published', previa), disenoDe(previa)]);
  const v = { contacto: d.contacto ?? '', equipo: d.equipo, tipo: d.tipo };
  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0 0 4px;">${d.contacto ? hueco(t, 'saludo', v) : 'Hola,'}</p>
      <p style="margin:0;">${hueco(t, 'intro', v, { equipo: negrita(d.equipo, ds.colorTexto), tipo: negrita(d.tipo, ds.colorTexto) })}</p>
      <p style="margin:12px 0 0;color:${GRIS};font-size:13px;">${hueco(t, 'nota', v)}</p>`,
    ),
  };
}

/** Al aliado: lo que ofreció no se dio de alta, con el motivo. */
export async function correoEquipoRechazado(d: { contacto: string | null; equipo: string; motivo: string }, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('provider_offer_rejected', previa), disenoDe(previa)]);
  const v = { contacto: d.contacto ?? '', equipo: d.equipo };
  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0 0 4px;">${d.contacto ? hueco(t, 'saludo', v) : 'Hola,'}</p>
      <p style="margin:0;">${hueco(t, 'intro', v, { equipo: negrita(d.equipo, ds.colorTexto) })}</p>
      <p style="margin:12px 0 0;padding:12px 14px;border-left:3px solid ${TINTA2};color:${TINTA};">${esc(d.motivo)}</p>
      <p style="margin:12px 0 0;">${hueco(t, 'cierre', v)}</p>`,
    ),
  };
}

// ─────────────────── Cotizador con tabulador (maquinaria y triturados) ───────────────────

/**
 * Cantidad de un renglón, igual que en el documento impreso: toneladas, m³ y
 * jornadas se venden fraccionados y llevan decimales; horas y viajes son
 * enteros y ponerles ".00" solo hace ruido.
 */
const cant = (valor: number, unidad: string): string =>
  unidad === 'TON' || unidad === 'M3' || unidad === 'JOR'
    ? Number(valor).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Number(valor).toLocaleString('es-MX');

/** Un renglón de la cotización, tal como sale del cálculo congelado. */
export interface RenglonCorreo {
  clase: string;
  concepto: string;
  unidad: string;
  cantidad: number;
  pu: number;
  importe: number;
}

/**
 * La cotización completa, en tabla de correo.
 *
 * NO se reutiliza el generador del documento impreso (`documentoCuerpo`, en
 * `@maqserv/ui`) aunque sería lo primero que uno intenta: ese documento se
 * apoya en un bloque `<style>` con clases, y Gmail lo recorta — el cliente
 * recibiría el desglose como texto amontonado. Aquí va el mismo contenido con
 * estilos en línea, que es la regla de todo este archivo. Es la misma decisión
 * que ya está tomada arriba, aplicada al caso más largo.
 *
 * Los renglones de flete van sin numerar, igual que en el papel: el flete no es
 * una partida que el cliente pidió, es lo que cuesta llevarle la que sí.
 */
function tablaCotizacion(renglones: RenglonCorreo[]): string {
  let n = 0;
  const filas = renglones
    .map((r) => {
      const num = r.clase === 'flete' ? '' : String(++n);
      const tono = r.clase === 'flete' ? `color:${GRIS};font-size:12px;` : `color:${TINTA2};font-size:13px;`;
      const celda = `padding:8px 10px;border-top:1px solid ${BORDE};${tono}`;
      // Dos columnas (auditoría 2026-10-28): con cinco, en el teléfono el P.U.,
      // el importe y el total quedaban fuera de la pantalla.
      return `<tr>
        <td style="${celda}">${num ? `<span style="color:${GRIS};">${num}.</span> ` : ''}${esc(r.concepto)}
          <div style="margin-top:2px;color:${GRIS};font-size:12px;">${esc(cant(r.cantidad, r.unidad))} ${esc(r.unidad)} × ${esc(money(r.pu))}</div></td>
        <td style="${celda}text-align:right;white-space:nowrap;font-weight:bold;vertical-align:top;">${esc(money(r.importe))}</td>
      </tr>`;
    })
    .join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;border:1px solid ${BORDE};border-collapse:collapse;">
    <tr>
      ${['Concepto', 'Importe']
        .map(
          (h, i) =>
            `<th style="padding:8px 10px;background:${TINTA};color:#FFFFFF;font-size:11px;letter-spacing:1px;text-transform:uppercase;text-align:${i >= 1 ? 'right' : 'left'};">${h}</th>`,
        )
        .join('')}
    </tr>
    ${filas}
  </table>`;
}

/** Quita las filas vacías de un bloque etiqueta/valor. */
function filas(pares: Array<[string, string | null | undefined]>): Array<[string, string]> {
  return pares.filter((p): p is [string, string] => Boolean(p[1]?.toString().trim()));
}

/**
 * AL EQUIPO DE MAQSER24: entró una solicitud del sitio.
 *
 * Existe porque sin él la promesa del acuse —"un asesor se pondrá en
 * contacto"— dependía de que alguien abriera el panel por su cuenta. Lleva el
 * contacto completo del cliente y el enlace directo a la cotización: el punto
 * es poder atenderla sin buscarla.
 *
 * Desde el 2026-10-23 el total es un PRECIO ESTIMADO: el cliente no lo vio, y
 * hay que revisarlo y mandárselo desde Solicitudes. A ningún aliado se le
 * avisa todavía: eso pasa cuando el cliente acepta y MAQSER24 elige a quién.
 */
export async function correoSolicitudInterna(d: {
  folio: string;
  cotizador: string;
  cliente: string;
  correo: string | null;
  telefono: string | null;
  municipio: string | null;
  obra: string | null;
  total: number;
  conceptos: string[];
  /** Solo el flujo viejo de máquinas del catálogo avisaba a aliados al entrar. */
  proveedoresAvisados?: string[];
  url: string;
}, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('quoter_request_internal', previa), disenoDe(previa)]);
  const v = { folio: d.folio, cliente: d.cliente, cotizador: d.cotizador };
  const lista = d.conceptos
    .map((c) => `<li style="margin:0 0 5px;color:${TINTA2};font-size:13px;">${esc(c)}</li>`)
    .join('');

  const avisados = d.proveedoresAvisados?.length
    ? `<p style="margin:14px 0 0;font-size:13px;color:${GRIS};">Ya se le avisó a: ${esc(d.proveedoresAvisados.join(', '))}.</p>`
    : `<p style="margin:14px 0 0;font-size:13px;color:${GRIS};">${hueco(t, 'nota', v)}</p>`;

  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0;">${hueco(t, 'intro', v, { folio: negrita(d.folio, ds.colorTexto) })}</p>
      ${datos(
        filas([
          ['Cliente', d.cliente],
          ['Obra', d.obra],
          ['Teléfono', d.telefono],
          ['Correo', d.correo],
          ['Municipio', d.municipio],
          ['Precio estimado', money(d.total)],
        ]),
      )}
      <p style="margin:6px 0 8px;font-weight:bold;color:${esc(ds.colorTexto)};">${hueco(t, 'pidio', v)}</p>
      <ul style="margin:0;padding-left:20px;">${lista}</ul>
      ${boton(plano(t, 'boton', v), d.url, ds.color)}
      ${avisados}`,
    ),
  };
}

/**
 * AL VISITANTE: acuse de que se recibió.
 *
 * El folio solo vivía en la pantalla: quien cerraba la pestaña se quedaba sin
 * manera de referirse a lo que pidió. Nunca lleva importes (2026-10-23: el
 * sitio ya no enseña precios): la cotización con precio la revisa y la manda
 * una persona desde el panel, y el cliente la acepta desde su cuenta.
 */
export async function correoAcuseSolicitud(d: {
  nombre: string;
  folio: string;
  cotizador: string;
  /** Ya no se enseña (2026-10-23); se queda por los llamadores viejos. */
  total?: number | null;
  /** Ya no se enseña (2026-10-23): a ningún aliado se le manda antes de que el cliente acepte. */
  proveedores?: string[];
  /** Enlace absoluto para seguirla desde su cuenta. */
  url?: string | null;
}, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('quoter_request_ack', previa), disenoDe(previa)]);
  const v = { nombre: d.nombre, folio: d.folio, cotizador: d.cotizador };
  const filas: Array<[string, string]> = [['Folio', d.folio]];

  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0 0 4px;">${hueco(t, 'saludo', v)}</p>
      <p style="margin:0;">${hueco(t, 'intro', v)}</p>
      ${datos(filas)}
      <p style="margin:0;">${hueco(t, 'siguiente', v)}</p>
      ${d.url ? boton(plano(t, 'boton', v), d.url, ds.color) : ''}
      <p style="margin:12px 0 0;font-size:13px;color:${GRIS};">${hueco(t, 'cierre', v)}</p>`,
    ),
  };
}

/**
 * AL CLIENTE: SU PAGO (2026-10-22). Sale solo: el día que vence (o 3 días
 * antes si tiene crédito) y cada semana mientras siga vencido. Lleva los datos
 * para transferir cuando están capturados en Margen › Reglas.
 */
export async function correoCobroRecordatorio(d: {
  nombre: string;
  folio: string;
  servicio: string | null;
  saldo: number;
  vence: string;
  /** Días: negativo = faltan; 0 = hoy; positivo = vencido. */
  dias: number;
  datosPago: { banco: string; clabe: string; beneficiario: string } | null;
  url: string;
}, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('cobro_recordatorio', previa), disenoDe(previa)]);
  const cuando = d.dias > 0 ? `venció hace ${d.dias} día${d.dias === 1 ? '' : 's'}` : d.dias === 0 ? 'vence hoy' : `vence el ${d.vence}`;
  const v = { nombre: d.nombre, folio: d.folio, cuando, saldo: money(d.saldo), vence: d.vence };
  const filas: Array<[string, string]> = [['Servicio', `${d.folio}${d.servicio ? ` · ${d.servicio}` : ''}`], ['Por pagar', money(d.saldo)], ['Fecha límite', d.vence]];
  if (d.datosPago) filas.push(['Banco', d.datosPago.banco], ['CLABE', d.datosPago.clabe], ['A nombre de', d.datosPago.beneficiario]);
  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(d.dias > 0 ? hueco(t, 'tituloVencido', v) : hueco(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0 0 4px;">${hueco(t, 'saludo', v)}</p>
      <p style="margin:0;">${hueco(t, 'intro', v, { folio: negrita(d.folio, ds.colorTexto) })}</p>
      ${datos(filas)}
      <p style="margin:0;">${hueco(t, 'comprobante', v)}</p>
      ${boton(plano(t, 'boton', v), d.url, ds.color)}`,
    ),
  };
}

/** AL ALIADO: sube tu factura para que te paguemos (2026-10-22). */
export async function correoFacturaAliadoPendiente(d: {
  contacto: string | null;
  servicios: Array<{ folio: string; monto: number }>;
  url: string | null;
}, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('factura_aliado_pendiente', previa), disenoDe(previa)]);
  const total = d.servicios.reduce((a, s) => a + s.monto, 0);
  const v = { contacto: d.contacto ?? '', folio: d.servicios[0]?.folio ?? '', n: String(d.servicios.length), total: money(total) };
  const lista = d.servicios.map((s) => `<li style="margin:0 0 5px;color:${TINTA2};font-size:13.5px;">${esc(s.folio)} · ${money(s.monto)}</li>`).join('');
  return {
    subject: d.servicios.length === 1 ? asunto(t, 'asuntoUna', v) : asunto(t, 'asuntoVarias', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0 0 4px;">${d.contacto ? hueco(t, 'saludo', v) : 'Hola,'}</p>
      <p style="margin:0;">${hueco(t, 'intro', v)}</p>
      <ul style="margin:12px 0;padding-left:20px;">${lista}</ul>
      <p style="margin:0;">${hueco(t, 'total', v, { total: negrita(money(total), ds.colorTexto) })}</p>
      ${d.url ? boton(plano(t, 'boton', v), d.url, ds.color) : ''}`,
      hueco(t, 'pie', v),
    ),
  };
}

/** AL ALIADO: ya le pagamos (2026-10-22). */
export async function correoPagoAliado(d: {
  contacto: string | null;
  servicios: Array<{ folio: string; monto: number }>;
  referencia: string | null;
  fecha: string;
}, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('pago_aliado', previa), disenoDe(previa)]);
  const total = d.servicios.reduce((a, s) => a + s.monto, 0);
  const v = { contacto: d.contacto ?? '', fecha: d.fecha, total: money(total), referencia: d.referencia ? ` (referencia ${d.referencia})` : '' };
  const lista = d.servicios.map((s) => `<li style="margin:0 0 5px;color:${TINTA2};font-size:13.5px;">${esc(s.folio)} · ${money(s.monto)}</li>`).join('');
  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0 0 4px;">${d.contacto ? hueco(t, 'saludo', v) : 'Hola,'}</p>
      <p style="margin:0;">${hueco(t, 'intro', v, { total: negrita(money(total), ds.colorTexto) })}</p>
      <ul style="margin:12px 0 0;padding-left:20px;">${lista}</ul>`,
      hueco(t, 'pie', v),
    ),
  };
}

/** A DIRECCIÓN: el mes que cerró, en un correo (2026-10-22). Sale solo el día 1. */
export async function correoCierreMes(d: {
  mes: string;
  servicios: number;
  ventas: number;
  pagoAliados: number;
  margen: number;
  porCobrar: number;
  vencido: number;
  porPagar: number;
  url: string;
}, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('cierre_mes', previa), disenoDe(previa)]);
  const v = { mes: d.mes, margen: money(d.margen) };
  const pct = d.ventas > 0 ? `${((d.margen / d.ventas) * 100).toFixed(1)}%` : '—';
  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0;">${hueco(t, 'intro', v)}</p>
      ${datos(filas([
        ['Servicios', String(d.servicios)],
        ['Ventas', money(d.ventas)],
        ['Pago a aliados', money(d.pagoAliados)],
        ['Margen', `${money(d.margen)} (${pct})`],
      ]))}
      <p style="margin:0;">${hueco(t, 'hoy', v)}</p>
      ${datos(filas([
        ['Por cobrar', money(d.porCobrar)],
        ['De eso, vencido', money(d.vencido)],
        ['Por pagar a aliados', money(d.porPagar)],
      ]))}
      ${boton(plano(t, 'boton', v), d.url, ds.color)}`,
    ),
  };
}

/**
 * AL CLIENTE: acuse de una solicitud A LA MEDIDA, la de /cotizar (2026-10-21).
 *
 * Antes solo sonaba su campana: quien no volvía a entrar a su cuenta no sabía
 * si había llegado. Va sin importes, porque todavía no tiene precio.
 */
export async function correoAcuseSolicitudAMedida(d: {
  nombre: string;
  folio: string;
  /** Lo que pidió, en una línea. */
  pidio: string | null;
  url: string;
}, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('quote_request_ack', previa), disenoDe(previa)]);
  const v = { nombre: d.nombre, folio: d.folio };
  const filas: Array<[string, string]> = [['Folio', d.folio]];
  if (d.pidio) filas.push(['Lo que pediste', d.pidio]);
  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0 0 4px;">${hueco(t, 'saludo', v)}</p>
      <p style="margin:0;">${hueco(t, 'intro', v)}</p>
      ${datos(filas)}
      <p style="margin:0;">${hueco(t, 'siguiente', v)}</p>
      ${boton(plano(t, 'boton', v), d.url, ds.color)}
      <p style="margin:12px 0 0;font-size:13px;color:${GRIS};">${hueco(t, 'cierre', v)}</p>`,
    ),
  };
}

/** A MAQSER24: entró una solicitud a la medida (2026-10-21). Hay que ponerle precio. */
export async function correoSolicitudAMedidaInterna(d: {
  folio: string;
  cliente: string;
  empresa: string | null;
  correo: string | null;
  telefono: string | null;
  pidio: string | null;
  direccion: string | null;
  fecha: string | null;
  comentarios: string | null;
  url: string;
}, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('quote_request_internal', previa), disenoDe(previa)]);
  const v = { folio: d.folio, cliente: d.empresa || d.cliente };
  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0;">${hueco(t, 'intro', v)}</p>
      ${datos(
        filas([
          ['Folio', d.folio],
          ['Cliente', d.cliente],
          ['Empresa', d.empresa],
          ['Teléfono', d.telefono],
          ['Correo', d.correo],
          ['Pidió', d.pidio],
          ['Dónde', d.direccion],
          ['Para cuándo', d.fecha],
        ]),
      )}
      ${d.comentarios ? `<p style="margin:0;color:${TINTA2};">${esc(d.comentarios)}</p>` : ''}
      ${boton(plano(t, 'boton', v), d.url, ds.color)}`,
    ),
  };
}

/**
 * AL CLIENTE: la cotización formal, armada desde el panel.
 *
 * Sale cuando una persona aprieta "Enviar al cliente", no al guardar: una
 * cotización se captura, se revisa y luego se manda. Automatizar el envío
 * convertiría cualquier error de captura en un correo ya entregado.
 */
export async function correoCotizacionDelPanel(d: {
  nombre: string;
  folio: string;
  cotizador: string;
  obra: string | null;
  saludo: string;
  renglones: RenglonCorreo[];
  subtotal: number;
  iva: number | null;
  total: number;
  condiciones: Array<{ titulo: string; puntos: string[] }>;
  notas: string | null;
  firma: { nombre: string; puesto: string; telefono: string } | null;
  /** Enlace absoluto para aceptarla sin llamar (2026-10-22). Sin él, el correo no trae botón. */
  aceptarUrl?: string | null;
}, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('quoter_quote_sent', previa), disenoDe(previa)]);
  const v = { nombre: d.nombre, folio: d.folio, cotizador: d.cotizador };
  const aceptar = d.aceptarUrl
    ? `${boton(plano(t, 'botonAceptar', v), d.aceptarUrl, ds.color)}
      <p style="margin:6px 0 0;font-size:13px;color:${GRIS};">${hueco(t, 'notaAceptar', v)}</p>`
    : '';
  const totales = datos(
    filas([
      ['Subtotal', money(d.subtotal)],
      ['I.V.A.', d.iva === null ? null : money(d.iva)],
      ['Total', money(d.total)],
    ]),
  );

  const condiciones = d.condiciones
    .map(
      (b) => `<p style="margin:18px 0 6px;font-size:12px;font-weight:bold;color:${esc(ds.color)};text-transform:uppercase;letter-spacing:1px;">${esc(b.titulo)}</p>
        <ul style="margin:0;padding-left:20px;">${b.puntos
          .map((p) => `<li style="margin:0 0 4px;color:${TINTA2};font-size:12.5px;line-height:1.5;">${esc(p)}</li>`)
          .join('')}</ul>`,
    )
    .join('');

  const notas = d.notas?.trim()
    ? `<p style="margin:16px 0 0;padding:10px 14px;background:${FONDO};border-left:3px solid ${esc(ds.color)};color:${TINTA2};font-size:13px;"><strong style="color:${TINTA};">Notas:</strong> ${esc(d.notas)}</p>`
    : '';

  const firma = d.firma?.nombre
    ? `<p style="margin:22px 0 0;padding-top:14px;border-top:1px solid ${BORDE};color:${TINTA};font-size:14px;">
        <strong>${esc(d.firma.nombre)}</strong><br>
        <span style="color:${GRIS};font-size:12.5px;">${esc([d.firma.puesto, d.firma.telefono].filter(Boolean).join(' · '))}</span>
      </p>`
    : '';

  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0 0 4px;">${hueco(t, 'saludo', v)}</p>
      <p style="margin:0;">${esc(d.saludo)}</p>
      ${d.obra ? `<p style="margin:10px 0 0;font-size:13px;color:${GRIS};">Obra: ${esc(d.obra)}</p>` : ''}
      ${tablaCotizacion(d.renglones)}
      ${totales}
      ${aceptar}
      ${notas}
      ${condiciones}
      ${firma}
      <p style="margin:18px 0 0;font-size:13px;color:${GRIS};">${hueco(t, 'cierre', v)}</p>`,
      hueco(t, 'pie', v),
    ),
  };
}
