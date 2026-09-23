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
  /** Importe que el cliente ya vio y aceptó (solicitudes del cotizador). */
  total?: number | null;
  /** Enlace firmado a su portal, donde acepta o rechaza. */
  url?: string | null;
}): { subject: string; html: string } {
  const filas: Array<[string, string]> = [];
  if (d.categoria) filas.push(['Servicio', d.categoria]);
  if (d.zona) filas.push(['Dónde', d.zona]);
  if (d.total != null && d.total > 0) filas.push(['Importe cotizado', money(d.total)]);
  filas.push(['Folio', d.folio]);

  return {
    subject: `Solicitud para ${d.aliado}${d.zona ? ` en ${d.zona}` : ''}`,
    html: marco(
      `${titulo('Tenemos una solicitud para ustedes')}
      <p style="margin:0 0 4px;">${d.contacto ? `Hola ${esc(d.contacto)},` : `Hola,`}</p>
      <p style="margin:0;">Nos entró un trabajo que corresponde a lo que ustedes atienden.${d.total != null && d.total > 0 ? ' El cliente ya vio el precio y lo aceptó: revisa que todo cuadre.' : ''}</p>
      ${datos(filas)}
      ${d.detalle ? `<p style="margin:12px 0 0;color:${TINTA2};">${esc(d.detalle)}</p>` : ''}
      <p style="margin:16px 0 0;"><strong style="color:${TINTA};">Dinos si pueden tomarlo.</strong> Si no pueden, dinos por qué — nos sirve para saber qué le falta a la red y no volver a molestarlos con lo mismo.</p>
      ${d.url ? boton('Aceptar o rechazar en mi portal', d.url) : ''}
      <p style="margin:12px 0 0;font-size:13px;color:${GRIS};">${d.url ? 'El botón abre tu portal de aliado sin contraseña; el enlace es personal, no lo compartas.' : 'Responde este correo o márcanos.'} Mientras no contesten, la solicitud sigue abierta para otro aliado.</p>`,
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

export function correoRecordatorioAliado(d: {
  aliado: string;
  contacto: string | null;
  url: string;
  equipos: Array<{ nombre: string; cuando: string }>;
  documentos: Array<{ texto: string; nombre: string }>;
  diasFrescura: number;
}): { subject: string; html: string } {
  const equipos =
    d.equipos.length > 0
      ? `<p style="margin:16px 0 6px;"><strong style="color:${TINTA};">Confirmanos si estos siguen libres:</strong></p>
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BORDE};border-radius:3px;">
           ${d.equipos
             .slice(0, 12)
             .map(
               (e, i) =>
                 `<tr>
                    <td style="padding:8px 14px;color:${TINTA};font-size:14px;${i ? `border-top:1px solid ${BORDE};` : ''}">${esc(e.nombre)}</td>
                    <td style="padding:8px 14px;color:${GRIS};font-size:13px;text-align:right;${i ? `border-top:1px solid ${BORDE};` : ''}">${esc(e.cuando)}</td>
                  </tr>`,
             )
             .join('')}
         </table>
         ${d.equipos.length > 12 ? `<p style="margin:8px 0 0;font-size:13px;color:${GRIS};">Y ${d.equipos.length - 12} mas.</p>` : ''}`
      : '';

  // Los papeles van en el MISMO correo: dos mensajes el mismo dia por cosas del
  // mismo expediente ensenan a archivar sin leer.
  const papeles =
    d.documentos.length > 0
      ? `<div style="margin:18px 0 0;padding:12px 14px;border:1px solid ${AZUL};border-radius:3px;background:#F0F7FF;">
           <div style="font-size:12px;color:${AZUL};font-weight:bold;letter-spacing:1px;margin-bottom:6px;">TUS PAPELES</div>
           ${d.documentos.map((x) => `<div style="color:${TINTA};font-size:14px;margin-bottom:3px;">${esc(x.texto)} — ${esc(x.nombre)}</div>`).join('')}
           <div style="margin-top:6px;font-size:12.5px;color:${GRIS};">Un papel vencido te quita el sello de verificado y te saca de las propuestas. Mandanos el renovado y lo subimos.</div>
         </div>`
      : '';

  const asunto =
    d.equipos.length > 0
      ? `${d.aliado}: confirmanos ${d.equipos.length} equipo${d.equipos.length === 1 ? '' : 's'}`
      : `${d.aliado}: revisa tus papeles`;

  return {
    subject: asunto,
    html: marco(
      `${titulo('Ayudanos a ofrecerte mas trabajo')}
      <p style="margin:0 0 4px;">${d.contacto ? `Hola ${esc(d.contacto)},` : 'Hola,'}</p>
      <p style="margin:0;">Solo te proponemos equipos que sabemos que estan libres. Cuando pasan ${d.diasFrescura} dias sin confirmar, dejamos de ofrecerlos — no porque no confiemos, sino porque no queremos comprometerte con algo que ya rentaste.</p>
      ${equipos}
      ${papeles}
      ${boton('Confirmar en un clic', d.url)}
      <p style="margin:14px 0 0;font-size:13px;color:${GRIS};">No hace falta contrasena: el enlace es tuyo.</p>`,
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

/** "Olvidé mi contraseña": el enlace de un solo uso. */
export function correoRestablecerContrasena(d: { nombre: string; url: string; minutos: number }): { subject: string; html: string } {
  return {
    subject: 'Restablece tu contraseña · MAQSER24',
    html: marco(
      `${titulo(`Hola, ${esc(d.nombre)}`)}
      <p style="margin:0;">Recibimos una solicitud para restablecer la contraseña de tu cuenta. Si fuiste tú, entra aquí y elige una nueva:</p>
      ${boton('Elegir nueva contraseña', d.url)}
      <p style="margin:12px 0 0;color:${GRIS};font-size:13px;">El enlace sirve una sola vez y caduca en ${d.minutos} minutos. Si no pediste esto, ignora este correo: tu contraseña sigue igual.</p>`,
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
      `${titulo(`Hola, ${esc(d.nombre)}`)}
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
      `${titulo(`Bienvenido, ${esc(d.nombre)}`)}
      <p style="margin:0;">Tu cuenta quedó creada con tu acceso de Google. Desde ella puedes pedir cotizaciones, solicitar servicios y seguirlos paso a paso.</p>
      ${boton('Ir a mi cuenta', d.url)}
      <p style="margin:12px 0 0;color:${GRIS};font-size:13px;">Si no fuiste tú quien la creó, escríbenos respondiendo este correo.</p>`,
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
      return `<tr>
        <td style="${celda}">${num}</td>
        <td style="${celda}">${esc(r.concepto)}</td>
        <td style="${celda}text-align:right;white-space:nowrap;">${esc(cant(r.cantidad, r.unidad))} ${esc(r.unidad)}</td>
        <td style="${celda}text-align:right;white-space:nowrap;">${esc(money(r.pu))}</td>
        <td style="${celda}text-align:right;white-space:nowrap;font-weight:bold;">${esc(money(r.importe))}</td>
      </tr>`;
    })
    .join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;border:1px solid ${BORDE};border-collapse:collapse;">
    <tr>
      ${['No.', 'Concepto', 'Cant.', 'P.U.', 'Importe']
        .map(
          (h, i) =>
            `<th style="padding:8px 10px;background:${TINTA};color:#FFFFFF;font-size:11px;letter-spacing:1px;text-transform:uppercase;text-align:${i >= 2 ? 'right' : 'left'};">${h}</th>`,
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
  proveedoresAvisados: string[];
  url: string;
}): { subject: string; html: string } {
  const lista = d.conceptos
    .map((c) => `<li style="margin:0 0 5px;color:${TINTA2};font-size:13px;">${esc(c)}</li>`)
    .join('');

  const avisados = d.proveedoresAvisados.length
    ? `<p style="margin:14px 0 0;font-size:13px;color:${GRIS};">Ya se le avisó a: ${esc(d.proveedoresAvisados.join(', '))}.</p>`
    : // Decirlo importa: una partida sin dueño en el tabulador no avisa a nadie,
      // y ese silencio es idéntico al de un correo que no salió.
      `<p style="margin:14px 0 0;font-size:13px;color:${GRIS};">No se avisó a ningún proveedor: las partidas de esta solicitud no tienen dueño asignado en Cotizador → Tarifas.</p>`;

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
          ['Total cotizado', money(d.total)],
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
 * manera de referirse a lo que pidió. No lleva importes aunque el sitio los
 * muestre — la cotización formal la manda una persona desde el panel, y dos
 * documentos con el mismo folio y distinto número es justo lo que hay que
 * evitar.
 */
export function correoAcuseSolicitud(d: {
  nombre: string;
  folio: string;
  cotizador: string;
  /** Importe cotizado, si el cliente lo vio. */
  total?: number | null;
  /** Aliados que ya tienen la solicitud para revisarla. */
  proveedores?: string[];
  /** Enlace absoluto para seguirla desde su cuenta. */
  url?: string | null;
}): { subject: string; html: string } {
  const filas: Array<[string, string]> = [['Folio', d.folio]];
  if (d.total != null && d.total > 0) filas.push(['Importe cotizado', money(d.total)]);
  const quien = d.proveedores?.length
    ? `Ya la tiene <strong style="color:${TINTA};">${esc(d.proveedores.join(' y '))}</strong> para revisarla. En cuanto la acepte te avisamos por correo y en tu cuenta.`
    : 'Estamos buscando al proveedor que la atienda. En cuanto esté asignado te avisamos por correo y en tu cuenta.';

  return {
    subject: `Recibimos tu solicitud de servicio ${d.folio}`,
    html: marco(
      `${titulo('Recibimos tu solicitud de servicio')}
      <p style="margin:0 0 4px;">Hola ${esc(d.nombre)},</p>
      <p style="margin:0;">Ya tenemos tu solicitud del cotizador de ${esc(d.cotizador)}, con la cotización que armaste. Guarda este folio para darle seguimiento:</p>
      ${datos(filas)}
      <p style="margin:0;">${quien}</p>
      ${d.url ? boton('Seguir mi solicitud', d.url) : ''}
      <p style="margin:12px 0 0;font-size:13px;color:${GRIS};">Si algo cambió —fechas, cantidades, la dirección de la obra— contesta este correo y lo ajustamos antes de que salga la unidad.</p>`,
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
}): { subject: string; html: string } {
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
      ${notas}
      ${condiciones}
      ${firma}
      <p style="margin:18px 0 0;font-size:13px;color:${GRIS};">¿Algo no cuadra? Contesta este correo y lo ajustamos.</p>`,
      `Cotización ${esc(d.folio)} del cotizador de ${esc(d.cotizador)}. Los precios son los del tabulador vigente el día en que se emitió.`,
    ),
  };
}
