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

/** El azul del tema claro (acción sobre blanco, AA); los botones y títulos toman el del diseño. */
const AZUL = '#0066CC';
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
}, previa?: Previa): Promise<{ subject: string; html: string }> {
  const [t, ds] = await Promise.all([textosDe('service_status', previa), disenoDe(previa)]);
  const v = { nombre: d.nombre, folio: d.folio, etapa: d.etapa.toLowerCase(), aliados: d.aliados.join(' y '), llegada: d.llegada ?? '', cierre: d.cierre ?? '' };
  const b = (k: string) => negrita(v[k as keyof typeof v], ds.colorTexto);
  const quien =
    d.aliados.length > 0
      ? `<p style="margin:12px 0 0;">${hueco(t, 'quien', v, { aliados: b('aliados') })}${d.llegada ? ` ${hueco(t, 'llegada', v, { llegada: b('llegada') })}` : ''}</p>`
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
      <p style="margin:12px 0 0;font-size:13px;color:${GRIS};">${d.url ? hueco(t, 'nota', v) : 'Responde este correo o márcanos. Mientras no contesten, la solicitud sigue abierta para otro aliado.'}</p>`,
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
export function correoRecordatorioServicio(d: {
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
}): { subject: string; html: string } {
  const filas: Array<[string, string]> = [['Llegada', d.llegada]];
  if (d.obra) filas.push(['Obra', d.obra]);
  if (d.direccion) filas.push(['Dirección', d.direccion]);
  if (d.para === 'cliente' && d.aliado) filas.push(['Te atiende', d.aliado]);
  filas.push(['Folio', d.folio]);
  const saludo = `<p style="margin:0 0 4px;">${d.nombre ? `Hola ${esc(d.nombre)},` : 'Hola,'}</p>`;
  if (d.para === 'cliente') {
    return {
      subject: `Mañana llega tu servicio ${d.folio}`,
      html: marco(
        `${titulo('Mañana es tu servicio')}
        ${saludo}
        <p style="margin:0;">Te recordamos que mañana llega la unidad a tu obra.</p>
        ${datos(filas)}
        <p style="margin:14px 0 0;">Te avisamos en cuanto salga y la puedes seguir en el mapa desde tu cuenta. Ten listo el acceso a la obra.</p>
        ${d.url ? boton('Ver mi servicio', d.url) : ''}
        <p style="margin:12px 0 0;font-size:13px;color:${GRIS};">Si algo cambió, contesta este correo hoy mismo.</p>`,
      ),
    };
  }
  const reqs = d.requisitos?.length
    ? `<p style="margin:14px 0 0;"><strong style="color:${TINTA};">Esta obra exige:</strong> ${esc(d.requisitos.join(' · '))}</p>`
    : '';
  return {
    subject: `Mañana: servicio ${d.folio}, llegada ${d.llegada}`,
    html: marco(
      `${titulo('Mañana tienes servicio')}
      ${saludo}
      <p style="margin:0;">Te recordamos el servicio de mañana. Mañana te avisamos a qué hora debe salir la unidad.</p>
      ${datos(filas)}
      ${reqs}
      <p style="margin:14px 0 0;">Cuando la unidad salga, márcalo en tu portal y ve actualizando el estado: llegué, empecé, terminé.</p>
      ${d.url ? boton('Abrir mi portal', d.url) : ''}`,
      'Recibes esto porque tu empresa tiene asignado este servicio en la red de aliados MAQSER24.',
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
  const camino = d.minutos ? ` (calculamos unos ${d.minutos} min de camino)` : '';
  const saludo = `<p style="margin:0 0 4px;">${d.contacto ? `Hola ${esc(d.contacto)},` : 'Hola,'}</p>`;
  const boton_ = d.url ? boton('Marcar que ya salió', d.url) : '';

  if (d.tarde) {
    return {
      subject: `¿Ya salió la unidad? Servicio ${d.folio}`,
      html: marco(
        `${titulo('¿Ya salió la unidad?')}
        ${saludo}
        <p style="margin:0;">La unidad debía salir a las <strong style="color:${TINTA};">${esc(d.salida)}</strong> para llegar a las ${esc(d.llegada)}, y todavía no se marca la salida.</p>
        ${datos(filas)}
        <p style="margin:14px 0 0;">Si ya va en camino, márcalo en tu portal: el cliente lo está esperando. Si hay un retraso, contéstanos este correo o llámanos.</p>
        ${boton_}`,
        'Recibes esto porque tu empresa tiene asignado este servicio en la red de aliados MAQSER24.',
      ),
    };
  }
  return {
    subject: asunto(t, 'asunto', v),
    html: marcoCon(ds,
      `${titulo(plano(t, 'titulo', v), ds.colorTexto)}
      <p style="margin:0 0 4px;">${d.contacto ? hueco(t, 'saludo', v) : 'Hola,'}</p>
      <p style="margin:0;">${hueco(t, 'intro', v, { llegada: negrita(d.llegada, ds.colorTexto), salida: negrita(d.salida, ds.colorTexto) })}</p>
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
export function correoServicioCanceladoAliado(d: {
  contacto: string | null;
  folio: string;
  categoria: string | null;
  direccion: string | null;
  motivo: string | null;
}): { subject: string; html: string } {
  const filas: Array<[string, string]> = [];
  if (d.categoria) filas.push(['Servicio', d.categoria]);
  if (d.direccion) filas.push(['Dirección', d.direccion]);
  filas.push(['Folio', d.folio]);
  if (d.motivo) filas.push(['Motivo', d.motivo]);
  return {
    subject: `Se canceló el servicio ${d.folio}: no salgan`,
    html: marco(
      `${titulo('Se canceló el servicio')}
      <p style="margin:0 0 4px;">${d.contacto ? `Hola ${esc(d.contacto)},` : 'Hola,'}</p>
      <p style="margin:0;">Este servicio ya no va: <strong style="color:${TINTA};">no manden la unidad</strong>. Su equipo queda libre para otros trabajos.</p>
      ${datos(filas)}
      <p style="margin:16px 0 0;font-size:13px;color:${GRIS};">Si ya habían salido, llámennos para ver los gastos del traslado.</p>`,
      'Recibes esto porque tu empresa forma parte de la red de aliados MAQSER24.',
    ),
  };
}

export function correoAccesoAliado(d: {
  aliado: string;
  contacto: string | null;
  url: string;
  dias: number;
  porContestar: number;
}): { subject: string; html: string } {
  // Si tiene solicitudes esperando, ESO es el asunto. Un correo que dice
  // "accede a tu panel" se archiva; uno que dice "tienes 2 solicitudes" se abre.
  const pendiente =
    d.porContestar > 0
      ? `<p style="margin:12px 0 0;"><strong style="color:${TINTA};">Tienes ${d.porContestar} solicitud${d.porContestar === 1 ? '' : 'es'} esperando tu respuesta.</strong></p>`
      : '';

  return {
    subject:
      d.porContestar > 0
        ? `${d.porContestar} solicitud${d.porContestar === 1 ? '' : 'es'} para ${d.aliado}`
        : `Tu acceso a MAQSER24, ${d.aliado}`,
    html: marco(
      `${titulo('Ya puedes contestarnos directo')}
      <p style="margin:0 0 4px;">${d.contacto ? `Hola ${esc(d.contacto)},` : 'Hola,'}</p>
      <p style="margin:0;">Desde este enlace ves las solicitudes que te ofrecemos, marcas si una máquina entra a mantenimiento y revisas tus papeles — sin esperar a que te llamemos.</p>
      ${pendiente}
      ${boton('Abrir lo mío', d.url)}
      <p style="margin:14px 0 0;font-size:13px;color:${GRIS};">No hace falta contraseña: el enlace es tuyo y sirve ${d.dias} días. Guarda este correo para volver a entrar.</p>`,
      'Si alguien más de tu equipo debe recibir esto, dinos a qué correo y lo cambiamos.',
    ),
  };
}

/**
 * INVITACIÓN A LA RED (2026-10-27). La manda la oficina con solo el nombre y
 * el correo: el enlace abre "Regístrate como proveedor" con sus datos ya
 * puestos, y lo que llene llega al panel como solicitud.
 */
export function correoInvitacionAliado(d: { nombre: string; contacto: string | null; url: string }): { subject: string; html: string } {
  return {
    subject: `${d.nombre}: te invitamos a la red de aliados de MAQSER24`,
    html: marco(
      `${titulo('Te invitamos a trabajar con MAQSER24')}
      <p style="margin:0 0 4px;">${d.contacto ? `Hola ${esc(d.contacto)},` : 'Hola,'}</p>
      <p style="margin:0;">En MAQSER24 recibimos solicitudes de maquinaria, transporte y materiales para obras, y se las pasamos a aliados como tú. Nos gustaría que <strong style="color:${TINTA};">${esc(d.nombre)}</strong> forme parte de la red.</p>
      <p style="margin:12px 0 0;">Llena tu registro: dónde está tu base, a qué municipios llegas y qué equipos tienes. Toma unos minutos y tus datos ya van puestos.</p>
      ${boton('Hacer mi registro', d.url)}
      <p style="margin:14px 0 0;font-size:13px;color:${GRIS};">Cuando lo revisemos te llega el enlace a tu portal: ahí contestas las solicitudes y subes tus papeles.</p>`,
      'Recibes esto porque alguien de MAQSER24 te invitó a su red de aliados. Si no te interesa, ignora este correo.',
    ),
  };
}

export function correoRecordatorioAliado(d: {
  aliado: string;
  contacto: string | null;
  url: string;
  documentos: Array<{ texto: string; nombre: string }>;
}): { subject: string; html: string } {
  // Solo papeles (2026-10-26): ya no se le pide confirmar sus equipos cada 14
  // días; la confirmación es cuando acepta o rechaza un servicio.
  const papeles = `<div style="margin:18px 0 0;padding:12px 14px;border:1px solid ${AZUL};border-radius:3px;background:#F0F7FF;">
           <div style="font-size:12px;color:${AZUL};font-weight:bold;letter-spacing:1px;margin-bottom:6px;">TUS PAPELES</div>
           ${d.documentos.map((x) => `<div style="color:${TINTA};font-size:14px;margin-bottom:3px;">${esc(x.texto)} — ${esc(x.nombre)}</div>`).join('')}
         </div>`;

  return {
    subject: `${d.aliado}: revisa tus papeles`,
    html: marco(
      `${titulo('Tus papeles en MAQSER24')}
      <p style="margin:0 0 4px;">${d.contacto ? `Hola ${esc(d.contacto)},` : 'Hola,'}</p>
      <p style="margin:0;">Sin tu constancia fiscal y tu póliza vigentes no tienes el sello de verificado y sales después cuando ofrecemos un servicio. Súbelos desde tu portal con el botón de abajo.</p>
      ${papeles}
      ${boton('Abrir mi portal', d.url)}
      <p style="margin:14px 0 0;font-size:13px;color:${GRIS};">No hace falta contraseña: el enlace es tuyo.</p>`,
      'Recibes esto porque tu empresa forma parte de la red de aliados MAQSER24.',
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
export function correoRestablecerContrasena(d: { nombre: string; url: string; minutos: number; desdeElPanel?: string }): { subject: string; html: string } {
  const motivo = d.desdeElPanel
    ? `${esc(d.desdeElPanel)} te mandó este enlace desde el panel para que cambies tu contraseña. Entra aquí y elige una nueva:`
    : 'Recibimos una solicitud para restablecer la contraseña de tu cuenta. Si fuiste tú, entra aquí y elige una nueva:';
  return {
    subject: d.desdeElPanel ? 'Cambia tu contraseña del panel · MAQSER24' : 'Restablece tu contraseña · MAQSER24',
    html: marco(
      `${titulo(`Hola, ${d.nombre}`)}
      <p style="margin:0;">${motivo}</p>
      ${boton('Elegir nueva contraseña', d.url)}
      <p style="margin:12px 0 0;color:${GRIS};font-size:13px;">El enlace sirve una sola vez y caduca en ${vigencia(d.minutos)}. Si no pediste esto, ignora este correo: tu contraseña sigue igual.</p>`,
      'Si el botón no abre, copia esta dirección en tu navegador: ' + esc(d.url),
    ),
  };
}

/**
 * INVITACIÓN AL PANEL (2026-10-28, decisión del dueño: "mejor que mande un
 * correo con la invitación y que ahí genere su contraseña"). La cuenta ya
 * existe con su rol; el botón abre la pantalla de crear contraseña.
 */
export function correoInvitacionPanel(d: { nombre: string; invitadoPor: string; rolNombre: string; url: string; dias: number }): { subject: string; html: string } {
  return {
    subject: 'Te invitaron al panel de MAQSER24',
    html: marco(
      `${titulo(`Hola, ${d.nombre}`)}
      <p style="margin:0;">${esc(d.invitadoPor)} te dio acceso al panel de MAQSER24 como <strong style="color:${TINTA};">${esc(d.rolNombre)}</strong>. Para entrar, crea tu contraseña aquí:</p>
      ${boton('Crear mi contraseña', d.url)}
      <p style="margin:12px 0 0;color:${GRIS};font-size:13px;">El enlace sirve una sola vez y caduca en ${d.dias} días. Si no esperabas esto, ignora este correo.</p>`,
      'Si el botón no abre, copia esta dirección en tu navegador: ' + esc(d.url),
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
export function correoConfirmarCuenta(d: { nombre: string; url: string; horas: number }): { subject: string; html: string } {
  return {
    subject: 'Confirma tu cuenta · MAQSER24',
    html: marco(
      `${titulo(`Hola, ${d.nombre}`)}
      <p style="margin:0;">Ya casi está tu cuenta en MAQSER24. Solo falta confirmar que este correo es tuyo:</p>
      ${boton('Confirmar mi cuenta', d.url)}
      <p style="margin:12px 0 0;color:${GRIS};font-size:13px;">Al confirmar entras directo a tu cuenta. El enlace caduca en ${d.horas} horas; si ya venció, entra con tu correo y pide uno nuevo. Si no creaste esta cuenta, ignora este correo.</p>`,
      'Si el botón no abre, copia esta dirección en tu navegador: ' + esc(d.url),
    ),
  };
}

/**
 * BIENVENIDA al crear la cuenta con Google. Google ya confirmó el correo, así
 * que no hay nada que verificar; pero el cliente pidió que la persona se
 * entere de que su cuenta existe y desde dónde la usa.
 */
export function correoBienvenida(d: { nombre: string; url: string }): { subject: string; html: string } {
  return {
    subject: 'Tu cuenta en MAQSER24 está lista',
    html: marco(
      `${titulo(`Bienvenido, ${d.nombre}`)}
      <p style="margin:0;">Tu cuenta quedó creada con tu acceso de Google. Desde ella puedes pedir cotizaciones, solicitar servicios y seguirlos paso a paso.</p>
      ${boton('Ir a mi cuenta', d.url)}
      <p style="margin:12px 0 0;color:${GRIS};font-size:13px;">Si no fuiste tú quien la creó, escríbenos respondiendo este correo.</p>`,
    ),
  };
}

// ─────────────────── Equipos que ofrece el aliado (2026-09-24) ───────────────────

/** A MAQSER24: un aliado ofreció un equipo desde su portal. */
export function correoEquipoPropuesto(d: {
  aliado: string;
  equipo: string;
  marca: string | null;
  linea: string;
  url: string;
}): { subject: string; html: string } {
  // Solo sale con lo NUEVO (2026-10-28): lo que ya es de un tipo cuenta solo.
  return {
    subject: `Algo nuevo de ${d.aliado} · ${d.equipo}`,
    html: marco(
      `${titulo('Un aliado ofreció algo que MAQSER24 no tiene')}
      <p style="margin:0;"><strong style="color:${TINTA};">${esc(d.aliado)}</strong> ofreció desde su portal un equipo que no está en la lista de tipos. En Inventario decides si es igual a uno que ya existe o si se vuelve un servicio nuevo de MAQSER24.</p>
      ${datos(filas([['Equipo', d.equipo], ['Marca', d.marca], ['Línea', d.linea]]))}
      ${d.url ? boton('Verlo en Inventario', d.url) : ''}`,
    ),
  };
}

/**
 * A MAQSER24: alguien escribió en /contacto. Lleva todo lo necesario para
 * contestar desde el propio correo (Responder va directo al cliente, ver
 * `replyTo` en el envío) y el enlace a Mensajes para marcarlo atendido.
 */
export function correoContactoInterno(d: {
  nombre: string;
  correo: string;
  telefono: string | null;
  empresa: string | null;
  tema: string | null;
  mensaje: string;
  url: string | null;
}): { subject: string; html: string } {
  return {
    subject: `Mensaje del sitio · ${d.nombre}${d.tema ? ` · ${d.tema}` : ''}`,
    html: marco(
      `${titulo('Nuevo mensaje desde el sitio')}
      <p style="margin:0;"><strong style="color:${TINTA};">${esc(d.nombre)}</strong> escribió por el formulario de contacto.</p>
      ${datos(filas([['Correo', d.correo], ['Teléfono', d.telefono], ['Empresa', d.empresa], ['Tema', d.tema]]))}
      <div style="margin:0 0 6px;padding:14px 16px;border-left:3px solid ${AZUL};background:${FONDO};color:${TINTA};white-space:pre-wrap;">${esc(d.mensaje)}</div>
      ${d.url ? boton('Verlo en el panel', d.url) : ''}`,
      'Para contestar, responde a este correo: la respuesta le llega a quien escribió.',
    ),
  };
}

/** A MAQSER24: alguien pidió entrar a la red desde /proveedores. */
export function correoSolicitudProveedorInterno(d: {
  nombre: string;
  tipo: string;
  contacto: string | null;
  telefono: string;
  correo: string | null;
  ubicacion: string;
  ofrece: string;
  mensaje: string;
  url: string | null;
}): { subject: string; html: string } {
  return {
    subject: `Solicitud de proveedor · ${d.nombre}`,
    html: marco(
      `${titulo('Quieren entrar a la red')}
      <p style="margin:0;"><strong style="color:${TINTA};">${esc(d.nombre)}</strong> se registró como proveedor desde el sitio.</p>
      ${datos(filas([['Tipo', d.tipo], ['Contacto', d.contacto], ['Teléfono', d.telefono], ['Correo', d.correo], ['Ubicación', d.ubicacion], ['Ofrece', d.ofrece]]))}
      <div style="margin:0 0 6px;padding:14px 16px;border-left:3px solid ${AZUL};background:${FONDO};color:${TINTA};white-space:pre-wrap;">${esc(d.mensaje)}</div>
      ${d.url ? boton('Revisarla en el panel', d.url) : ''}`,
      'La solicitud está en Red de aliados → Solicitudes. No entra a ninguna asignación hasta que la aceptes.',
    ),
  };
}

/** A quien se registró como proveedor: lo recibimos y qué sigue. */
export function correoAcuseProveedor(d: { nombre: string }): { subject: string; html: string } {
  return {
    subject: 'Recibimos tu registro como proveedor · MAQSER24',
    html: marco(
      `${titulo(`Hola, ${d.nombre}`)}
      <p style="margin:0 0 12px;">Recibimos tu registro para formar parte de la red MAQSER24. Nuestro equipo revisará la información.</p>
      <p style="margin:0 0 12px;">Si te aceptamos en la red, te llega a este correo el enlace a tu portal de aliado: ahí subes tus papeles, ofreces tus equipos y contestas las solicitudes de obra.</p>
      <p style="margin:0;">Si quieres agregar algo, responde a este correo.</p>`,
      `Si no te registraste en ${DOMINIO}, ignora este correo.`,
    ),
  };
}

/** A quien escribió en /contacto: lo recibimos y qué sigue. */
export function correoAcuseContacto(d: { nombre: string; mensaje: string; telefono: string | null }): { subject: string; html: string } {
  return {
    subject: 'Recibimos tu mensaje · MAQSER24',
    html: marco(
      `${titulo(`Hola, ${d.nombre}`)}
      <p style="margin:0 0 12px;">Recibimos tu mensaje. Un asesor de MAQSER24 te contesta en horario de atención, de lunes a sábado de 8:00 a 18:00.</p>
      ${d.telefono ? '' : `<p style="margin:14px 0 0;">Si nos dejas un teléfono respondiendo a este correo, podemos llamarte.</p>`}`,
      `Si no escribiste en ${DOMINIO}, ignora este correo.`,
    ),
  };
}

/**
 * A quien preguntó (en el sitio, en un producto o por correo): ya respondimos.
 * La respuesta va completa en el correo; el enlace es para ver las demás.
 */
export function correoPreguntaRespondida(d: { nombre: string | null; pregunta: string; respuesta: string; url: string }): { subject: string; html: string } {
  return {
    subject: 'Respondimos tu pregunta · MAQSER24',
    html: marco(
      `${titulo(d.nombre ? `Hola, ${d.nombre}` : 'Respondimos tu pregunta')}
      <p style="margin:0 0 6px;color:${GRIS};font-size:13px;">Tu pregunta:</p>
      <div style="margin:0 0 14px;padding:12px 16px;border-left:3px solid ${BORDE};background:${FONDO};color:${TINTA2};white-space:pre-wrap;">${esc(d.pregunta)}</div>
      <p style="margin:0 0 6px;color:${GRIS};font-size:13px;">Nuestra respuesta:</p>
      <div style="margin:0;padding:12px 16px;border-left:3px solid ${AZUL};background:${FONDO};color:${TINTA};white-space:pre-wrap;">${esc(d.respuesta)}</div>
      ${boton('Ver más preguntas frecuentes', `${SITIO}${d.url}`)}
      <p style="margin:10px 0 0;">Si te queda alguna duda, responde a este correo.</p>`,
      `Recibes este correo porque hiciste una pregunta en ${DOMINIO}.`,
    ),
  };
}

/** A quien escribió por Contacto: la respuesta, contestada desde Mensajes. */
export function correoMensajeRespondido(d: { nombre: string | null; mensaje: string; respuesta: string }): { subject: string; html: string } {
  return {
    subject: 'Respondimos tu mensaje · MAQSER24',
    html: marco(
      `${titulo(d.nombre ? `Hola, ${d.nombre}` : 'Respondimos tu mensaje')}
      <p style="margin:0 0 6px;color:${GRIS};font-size:13px;">Nos escribiste:</p>
      <div style="margin:0 0 14px;padding:12px 16px;border-left:3px solid ${BORDE};background:${FONDO};color:${TINTA2};white-space:pre-wrap;">${esc(d.mensaje)}</div>
      <p style="margin:0 0 6px;color:${GRIS};font-size:13px;">Nuestra respuesta:</p>
      <div style="margin:0;padding:12px 16px;border-left:3px solid ${AZUL};background:${FONDO};color:${TINTA};white-space:pre-wrap;">${esc(d.respuesta)}</div>
      <p style="margin:16px 0 0;">Si te queda alguna duda, responde a este correo.</p>`,
      `Recibes este correo porque nos escribiste desde ${DOMINIO}.`,
    ),
  };
}

/** Al aliado: su equipo ya está publicado. */
/**
 * Al aliado: lo nuevo que ofreció ya quedó dado de alta en un tipo de
 * MAQSER24 (2026-10-28). Antes decía "publicado", pero su equipo no sale en
 * el sitio: lo que cambia es que ya le llegan las solicitudes de ese tipo.
 */
export function correoEquipoPublicado(d: { contacto: string | null; equipo: string; tipo: string }): { subject: string; html: string } {
  return {
    subject: `Tu equipo ya está dado de alta · ${d.equipo}`,
    html: marco(
      `${titulo('Tu equipo ya está en MAQSER24')}
      <p style="margin:0 0 4px;">${d.contacto ? `Hola ${esc(d.contacto)},` : 'Hola,'}</p>
      <p style="margin:0;">Revisamos <strong style="color:${TINTA};">${esc(d.equipo)}</strong> y quedó como <strong style="color:${TINTA};">${esc(d.tipo)}</strong>. Desde hoy, cuando un cliente pida ${esc(d.tipo)} en tu zona, te llega la solicitud a tu portal.</p>
      <p style="margin:12px 0 0;color:${GRIS};font-size:13px;">Si entra a mantenimiento, márcalo en tu portal: solo te ofrecemos lo que está libre.</p>`,
    ),
  };
}

/** Al aliado: su equipo no se publicó, con el motivo. */
export function correoEquipoRechazado(d: { contacto: string | null; equipo: string; motivo: string }): { subject: string; html: string } {
  return {
    subject: `Revisamos tu equipo · ${d.equipo}`,
    html: marco(
      `${titulo('Por ahora no lo manejamos')}
      <p style="margin:0 0 4px;">${d.contacto ? `Hola ${esc(d.contacto)},` : 'Hola,'}</p>
      <p style="margin:0;">Revisamos <strong style="color:${TINTA};">${esc(d.equipo)}</strong> y por ahora MAQSER24 no lo maneja:</p>
      <p style="margin:12px 0 0;padding:12px 14px;border-left:3px solid ${TINTA2};color:${TINTA};">${esc(d.motivo)}</p>
      <p style="margin:12px 0 0;">Puedes volver a ofrecerlo desde tu portal con los cambios, o contestar este correo si tienes dudas.</p>`,
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
 * AL PROVEEDOR: alguien pidió lo que él publica.
 *
 * Lleva QUÉ le piden y DÓNDE — y a propósito NO lleva el teléfono ni el correo
 * del cliente. MAQSER24 es quien coordina la renta; si el contacto viajara en
 * este correo, el proveedor podría cerrar por fuera y la plataforma se quedaría
 * fuera de su propia operación. Compartirlo es una decisión de una persona,
 * desde el panel.
 */
export function correoSolicitudAProveedor(d: {
  contacto: string | null;
  folio: string;
  cotizador: string;
  municipio: string | null;
  obra: string | null;
  conceptos: string[];
}): { subject: string; html: string } {
  const lista = d.conceptos
    .map((c) => `<li style="margin:0 0 6px;color:${TINTA};font-size:14px;">${esc(c)}</li>`)
    .join('');

  return {
    subject: `Te solicitaron equipo · ${d.folio}`,
    html: marco(
      `${titulo('Te solicitaron un servicio')}
      <p style="margin:0 0 4px;">Hola${d.contacto ? ` ${esc(d.contacto)}` : ''},</p>
      <p style="margin:0;">Entró una solicitud en el cotizador de ${esc(d.cotizador)} que incluye equipo tuyo. Folio <strong style="color:${TINTA};">${esc(d.folio)}</strong>.</p>
      <p style="margin:16px 0 8px;font-weight:bold;color:${TINTA};">Lo que te toca:</p>
      <ul style="margin:0;padding-left:20px;">${lista}</ul>
      ${datos(filas([['Obra', d.obra], ['Entrega en', d.municipio]]))}
      <p style="margin:14px 0 0;">Un coordinador de MAQSER24 te contactará para confirmar disponibilidad y fechas. Si ya sabes que <strong style="color:${TINTA};">no</strong> puedes atenderlo, contesta este correo cuanto antes: así se le ofrece a otro aliado sin que el cliente espere.</p>`,
      'Recibes este aviso porque tienes equipo asignado en el tabulador de MAQSER24. Tu correo lo administras desde tu portal de aliado.',
    ),
  };
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
export function correoSolicitudInterna(d: {
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
}): { subject: string; html: string } {
  const lista = d.conceptos
    .map((c) => `<li style="margin:0 0 5px;color:${TINTA2};font-size:13px;">${esc(c)}</li>`)
    .join('');

  const avisados = d.proveedoresAvisados?.length
    ? `<p style="margin:14px 0 0;font-size:13px;color:${GRIS};">Ya se le avisó a: ${esc(d.proveedoresAvisados.join(', '))}.</p>`
    : `<p style="margin:14px 0 0;font-size:13px;color:${GRIS};">El cliente no vio el precio. Revísalo en Solicitudes, corrígelo si hace falta y mándale la cotización; cuando la acepte eliges a qué aliado se le da.</p>`;

  return {
    subject: `Nueva solicitud ${d.folio} · ${d.cliente}`,
    html: marco(
      `${titulo('Entró una solicitud del sitio')}
      <p style="margin:0;">Cotizador de ${esc(d.cotizador)}, folio <strong style="color:${TINTA};">${esc(d.folio)}</strong>.</p>
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
      <p style="margin:6px 0 8px;font-weight:bold;color:${TINTA};">Pidió:</p>
      <ul style="margin:0;padding-left:20px;">${lista}</ul>
      ${boton('Abrir en el panel', d.url)}
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
export function correoAcuseSolicitud(d: {
  nombre: string;
  folio: string;
  cotizador: string;
  /** Ya no se enseña (2026-10-23); se queda por los llamadores viejos. */
  total?: number | null;
  /** Ya no se enseña (2026-10-23): a ningún aliado se le manda antes de que el cliente acepte. */
  proveedores?: string[];
  /** Enlace absoluto para seguirla desde su cuenta. */
  url?: string | null;
}): { subject: string; html: string } {
  const filas: Array<[string, string]> = [['Folio', d.folio]];

  return {
    subject: `Recibimos tu solicitud ${d.folio}`,
    html: marco(
      `${titulo('Recibimos tu solicitud')}
      <p style="margin:0 0 4px;">Hola ${esc(d.nombre)},</p>
      <p style="margin:0;">Ya tenemos lo que armaste en el cotizador de ${esc(d.cotizador)}. Guarda este folio para darle seguimiento:</p>
      ${datos(filas)}
      <p style="margin:0;">Un asesor de MAQSER24 la revisa y te mandamos la cotización con precio y vigencia por correo. Si te conviene, la aceptas desde tu cuenta y asignamos al proveedor que te atiende.</p>
      ${d.url ? boton('Seguir mi solicitud', d.url) : ''}
      <p style="margin:12px 0 0;font-size:13px;color:${GRIS};">Si algo cambió —fechas, cantidades, la dirección de la obra— contesta este correo y lo ajustamos antes de que salga la unidad.</p>`,
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
export function correoCierreMes(d: {
  mes: string;
  servicios: number;
  ventas: number;
  pagoAliados: number;
  margen: number;
  porCobrar: number;
  vencido: number;
  porPagar: number;
  url: string;
}): { subject: string; html: string } {
  const pct = d.ventas > 0 ? `${((d.margen / d.ventas) * 100).toFixed(1)}%` : '—';
  return {
    subject: `Cierre de ${d.mes}: margen ${money(d.margen)}`,
    html: marco(
      `${titulo(`Cierre de ${d.mes}`)}
      <p style="margin:0;">Servicios cerrados en el mes, sin IVA:</p>
      ${datos(filas([
        ['Servicios', String(d.servicios)],
        ['Ventas', money(d.ventas)],
        ['Pago a aliados', money(d.pagoAliados)],
        ['Margen', `${money(d.margen)} (${pct})`],
      ]))}
      <p style="margin:0;">Hoy, con IVA:</p>
      ${datos(filas([
        ['Por cobrar', money(d.porCobrar)],
        ['De eso, vencido', money(d.vencido)],
        ['Por pagar a aliados', money(d.porPagar)],
      ]))}
      ${boton('Ver el margen', d.url)}`,
    ),
  };
}

/**
 * AL CLIENTE: acuse de una solicitud A LA MEDIDA, la de /cotizar (2026-10-21).
 *
 * Antes solo sonaba su campana: quien no volvía a entrar a su cuenta no sabía
 * si había llegado. Va sin importes, porque todavía no tiene precio.
 */
export function correoAcuseSolicitudAMedida(d: {
  nombre: string;
  folio: string;
  /** Lo que pidió, en una línea. */
  pidio: string | null;
  url: string;
}): { subject: string; html: string } {
  const filas: Array<[string, string]> = [['Folio', d.folio]];
  if (d.pidio) filas.push(['Lo que pediste', d.pidio]);
  return {
    subject: `Recibimos tu solicitud ${d.folio}`,
    html: marco(
      `${titulo('Recibimos tu solicitud')}
      <p style="margin:0 0 4px;">Hola ${esc(d.nombre)},</p>
      <p style="margin:0;">Ya la tenemos. Guarda este folio para darle seguimiento:</p>
      ${datos(filas)}
      <p style="margin:0;">Un asesor de MAQSER24 la revisa y te mandamos la cotización con precio y vigencia por correo. Después la aceptas desde tu cuenta y asignamos al proveedor que te atiende.</p>
      ${boton('Ver mi solicitud', d.url)}
      <p style="margin:12px 0 0;font-size:13px;color:${GRIS};">Si algo cambió —fechas, cantidades, la dirección de la obra— contesta este correo y lo ajustamos.</p>`,
    ),
  };
}

/** A MAQSER24: entró una solicitud a la medida (2026-10-21). Hay que ponerle precio. */
export function correoSolicitudAMedidaInterna(d: {
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
}): { subject: string; html: string } {
  return {
    subject: `Solicitud a la medida ${d.folio} · ${d.empresa || d.cliente}`,
    html: marco(
      `${titulo('Entró una solicitud a la medida')}
      <p style="margin:0;">Llegó sin precio por el formulario "Cotizar". Hay que responderla en Solicitudes.</p>
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
      ${boton('Abrir en el panel', d.url)}`,
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
export function correoCotizacionDelPanel(d: {
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
}): { subject: string; html: string } {
  const aceptar = d.aceptarUrl
    ? `${boton('Acepto la cotización', d.aceptarUrl)}
      <p style="margin:6px 0 0;font-size:13px;color:${GRIS};">Al aceptarla asignamos al proveedor y te avisamos por correo quién va y cuándo. El botón vale 15 días.</p>`
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
      (b) => `<p style="margin:18px 0 6px;font-size:12px;font-weight:bold;color:${AZUL};text-transform:uppercase;letter-spacing:1px;">${esc(b.titulo)}</p>
        <ul style="margin:0;padding-left:20px;">${b.puntos
          .map((p) => `<li style="margin:0 0 4px;color:${TINTA2};font-size:12.5px;line-height:1.5;">${esc(p)}</li>`)
          .join('')}</ul>`,
    )
    .join('');

  const notas = d.notas?.trim()
    ? `<p style="margin:16px 0 0;padding:10px 14px;background:${FONDO};border-left:3px solid ${AZUL};color:${TINTA2};font-size:13px;"><strong style="color:${TINTA};">Notas:</strong> ${esc(d.notas)}</p>`
    : '';

  const firma = d.firma?.nombre
    ? `<p style="margin:22px 0 0;padding-top:14px;border-top:1px solid ${BORDE};color:${TINTA};font-size:14px;">
        <strong>${esc(d.firma.nombre)}</strong><br>
        <span style="color:${GRIS};font-size:12.5px;">${esc([d.firma.puesto, d.firma.telefono].filter(Boolean).join(' · '))}</span>
      </p>`
    : '';

  return {
    subject: `Tu cotización ${d.folio} · MAQSER24`,
    html: marco(
      `${titulo(`Cotización ${d.folio}`)}
      <p style="margin:0 0 4px;">Hola ${esc(d.nombre)},</p>
      <p style="margin:0;">${esc(d.saludo)}</p>
      ${d.obra ? `<p style="margin:10px 0 0;font-size:13px;color:${GRIS};">Obra: ${esc(d.obra)}</p>` : ''}
      ${tablaCotizacion(d.renglones)}
      ${totales}
      ${aceptar}
      ${notas}
      ${condiciones}
      ${firma}
      <p style="margin:18px 0 0;font-size:13px;color:${GRIS};">¿Algo no cuadra? Contesta este correo y lo ajustamos.</p>`,
      `Cotización ${esc(d.folio)} del cotizador de ${esc(d.cotizador)}. Los precios son los del tabulador vigente el día en que se emitió.`,
    ),
  };
}
