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

const AZUL = '#0068C7';
const TINTA = '#11161D';
const TINTA2 = '#333D48';
const GRIS = '#6B7683';
const BORDE = '#DCE3EA';
const FONDO = '#F4F7FA';

const SITIO = process.env.SITE_URL ?? 'https://servmaq24-web.vercel.app';

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
 */
function marco(contenido: string, pie?: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${FONDO};margin:0;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:#FFFFFF;border:1px solid ${BORDE};border-radius:4px;">
      <tr><td style="padding:22px 28px 0;border-top:3px solid ${AZUL};">
        <div style="font-size:15px;font-weight:bold;color:${AZUL};letter-spacing:2px;">MAQSER24</div>
      </td></tr>
      <tr><td style="padding:18px 28px 28px;color:${TINTA2};font-size:15px;line-height:1.6;">
        ${contenido}
      </td></tr>
      <tr><td style="padding:16px 28px 22px;border-top:1px solid ${BORDE};color:${GRIS};font-size:12px;line-height:1.55;">
        ${pie ?? 'Este mensaje se envió automáticamente desde la plataforma MAQSER24.'}
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

function titulo(t: string): string {
  return `<h1 style="margin:0 0 14px;font-size:21px;line-height:1.25;color:${TINTA};font-weight:bold;">${esc(t)}</h1>`;
}

function boton(texto: string, url: string): string {
  // Sin border-radius grande y con padding en el <a>: Outlook ignora el radio y
  // no hereda el padding de la celda.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 6px;">
    <tr><td style="background:${AZUL};border-radius:3px;">
      <a href="${url}" style="display:inline-block;padding:12px 22px;color:#FFFFFF;font-size:15px;font-weight:bold;text-decoration:none;">${esc(texto)}</a>
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

export function correoCotizacionRespondida(d: {
  nombre: string;
  folio: string;
  total: number;
  validUntil: string | null;
  included: string | null;
  excluded: string | null;
}): { subject: string; html: string } {
  const filas: Array<[string, string]> = [['Total', money(d.total)]];
  if (d.validUntil) filas.push(['El precio vale hasta', d.validUntil]);

  const extras = [
    d.included ? `<p style="margin:14px 0 0;"><strong style="color:${TINTA};">Incluye:</strong> ${esc(d.included)}</p>` : '',
    // Lo que NO incluye va con el mismo peso que lo que sí: es el campo que
    // evita la discusión cuando llega la factura.
    d.excluded ? `<p style="margin:8px 0 0;"><strong style="color:${TINTA};">No incluye:</strong> ${esc(d.excluded)}</p>` : '',
  ].join('');

  return {
    subject: `Tu cotización ${d.folio} ya tiene precio`,
    html: marco(
      `${titulo('Ya tienes precio')}
      <p style="margin:0 0 4px;">Hola ${esc(d.nombre)},</p>
      <p style="margin:0;">Revisamos tu solicitud <strong style="color:${TINTA};">${esc(d.folio)}</strong> y ya está lista.</p>
      ${datos(filas)}
      ${extras}
      ${boton('Ver y aceptar', `${SITIO}/cuenta/cotizaciones/${encodeURIComponent(d.folio)}`)}
      <p style="margin:14px 0 0;font-size:13px;color:${GRIS};">Si algo no cuadra, contéstanos este correo y lo ajustamos.</p>`,
      d.validUntil
        ? `Este precio se sostiene hasta el ${esc(d.validUntil)}. Después habría que actualizarlo.`
        : undefined,
    ),
  };
}

export function correoCotizacionPorVencer(d: {
  nombre: string;
  folio: string;
  total: number;
  validUntil: string;
  dias: number;
}): { subject: string; html: string } {
  const cuando =
    d.dias <= 0 ? 'vence hoy' : d.dias === 1 ? 'vence mañana' : `vence en ${d.dias} días`;
  return {
    subject: `Tu cotización ${d.folio} ${cuando}`,
    html: marco(
      `${titulo(`Tu precio ${cuando}`)}
      <p style="margin:0 0 4px;">Hola ${esc(d.nombre)},</p>
      <p style="margin:0;">La cotización <strong style="color:${TINTA};">${esc(d.folio)}</strong> por ${esc(money(d.total))} se sostiene hasta el ${esc(d.validUntil)}.</p>
      <p style="margin:12px 0 0;">Después de esa fecha ya no se puede aceptar y habría que volver a cotizarla — los precios de traslado y disponibilidad cambian.</p>
      ${boton('Aceptar ahora', `${SITIO}/cuenta/cotizaciones/${encodeURIComponent(d.folio)}`)}`,
    ),
  };
}

export function correoServicioAvanzo(d: {
  nombre: string;
  folio: string;
  etapa: string;
  mensaje: string;
  aliados: string[];
  cierre: string | null;
}): { subject: string; html: string } {
  const quien =
    d.aliados.length > 0
      ? `<p style="margin:12px 0 0;">Te atiende <strong style="color:${TINTA};">${esc(d.aliados.join(' y '))}</strong>.</p>`
      : '';
  const cierre = d.cierre
    ? `<p style="margin:12px 0 0;">Se registraron <strong style="color:${TINTA};">${esc(d.cierre)}</strong>.</p>`
    : '';
  return {
    subject: `Tu servicio ${d.folio}: ${d.etapa.toLowerCase()}`,
    html: marco(
      `${titulo(d.etapa)}
      <p style="margin:0 0 4px;">Hola ${esc(d.nombre)},</p>
      <p style="margin:0;">${esc(d.mensaje)}</p>
      ${quien}
      ${cierre}
      ${boton('Ver el detalle', `${SITIO}/cuenta/cotizaciones/${encodeURIComponent(d.folio)}`)}`,
    ),
  };
}

// ─────────────────────────── Al aliado ───────────────────────────

export function correoOfertaAAliado(d: {
  aliado: string;
  contacto: string | null;
  categoria: string | null;
  zona: string | null;
  folio: string;
  detalle: string | null;
}): { subject: string; html: string } {
  const filas: Array<[string, string]> = [];
  if (d.categoria) filas.push(['Servicio', d.categoria]);
  if (d.zona) filas.push(['Dónde', d.zona]);
  filas.push(['Folio', d.folio]);

  return {
    subject: `Solicitud para ${d.aliado}${d.zona ? ` en ${d.zona}` : ''}`,
    html: marco(
      `${titulo('Tenemos una solicitud para ustedes')}
      <p style="margin:0 0 4px;">${d.contacto ? `Hola ${esc(d.contacto)},` : `Hola,`}</p>
      <p style="margin:0;">Nos entró un trabajo que corresponde a lo que ustedes atienden.</p>
      ${datos(filas)}
      ${d.detalle ? `<p style="margin:12px 0 0;color:${TINTA2};">${esc(d.detalle)}</p>` : ''}
      <p style="margin:16px 0 0;"><strong style="color:${TINTA};">Contéstanos si pueden tomarlo.</strong> Si no pueden, dinos por qué — nos sirve para saber qué le falta a la red y no volver a molestarlos con lo mismo.</p>
      <p style="margin:12px 0 0;font-size:13px;color:${GRIS};">Responde este correo o márcanos. Mientras no contesten, la solicitud sigue abierta para otro aliado.</p>`,
      'Recibes esto porque tu empresa forma parte de la red de aliados MAQSER24.',
    ),
  };
}

export function correoAsignacionAAliado(d: {
  aliado: string;
  contacto: string | null;
  folio: string;
  categoria: string | null;
  zona: string | null;
  direccion: string | null;
  contactoObra: string | null;
  telefonoObra: string | null;
  requisitos: string[];
}): { subject: string; html: string } {
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
      ? `<div style="margin:16px 0 0;padding:12px 14px;border:1px solid ${AZUL};border-radius:3px;background:#F0F7FF;">
           <div style="font-size:12px;color:${AZUL};font-weight:bold;letter-spacing:1px;margin-bottom:6px;">ESTA OBRA EXIGE</div>
           <div style="color:${TINTA};font-size:14px;">${esc(d.requisitos.join(' · '))}</div>
           <div style="margin-top:6px;font-size:12.5px;color:${GRIS};">Sin esto no dejan entrar la unidad.</div>
         </div>`
      : '';

  return {
    subject: `Confirmado: el servicio ${d.folio} es de ustedes`,
    html: marco(
      `${titulo('Quedó asignado a ustedes')}
      <p style="margin:0 0 4px;">${d.contacto ? `Hola ${esc(d.contacto)},` : 'Hola,'}</p>
      <p style="margin:0;">Confirmamos el servicio. Estos son los datos de la obra.</p>
      ${datos(filas)}
      ${reqs}
      <p style="margin:16px 0 0;font-size:13px;color:${GRIS};">Cualquier cambio, avísanos antes de salir: la obra ya está contando con la unidad.</p>`,
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
      <p style="margin:0;">Desde este enlace ves las solicitudes que te ofrecemos, confirmas si tus equipos siguen libres y revisas tus papeles — sin esperar a que te llamemos.</p>
      ${pendiente}
      ${boton('Abrir lo mío', d.url)}
      <p style="margin:14px 0 0;font-size:13px;color:${GRIS};">No hace falta contraseña: el enlace es tuyo y sirve ${d.dias} días. Guarda este correo para volver a entrar.</p>`,
      'Si alguien más de tu equipo debe recibir esto, dinos a qué correo y lo cambiamos.',
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
