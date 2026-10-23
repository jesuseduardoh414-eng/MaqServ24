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
  // Escapado y solo http(s)/mailto (auditoría 2026-10-23): hoy todas las URL las
  // arma el servidor, pero por aquí entró el `redirectTo` del restablecimiento.
  const destino = /^(https?:\/\/|mailto:)/i.test(url) ? esc(url) : '#';
  // Sin border-radius grande y con padding en el <a>: Outlook ignora el radio y
  // no hereda el padding de la celda.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 6px;">
    <tr><td style="background:${AZUL};border-radius:3px;">
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

export function correoCotizacionRespondida(d: {
  nombre: string;
  folio: string;
  total: number;
  validUntil: string | null;
  included: string | null;
  excluded: string | null;
  /** Folio del documento del cotizador (MQ-/TR-), si se cotizó con el tabulador. */
  documento?: string | null;
}): { subject: string; html: string } {
  const filas: Array<[string, string]> = [['Total', money(d.total)]];
  if (d.documento) filas.push(['Documento', d.documento]);
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
      ${d.documento ? `<p style="margin:14px 0 0;">Te preparamos la cotización formal <strong style="color:${TINTA};">${esc(d.documento)}</strong> con el detalle de cada partida: la puedes ver, imprimir o guardar en PDF desde tu cuenta.</p>` : ''}
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
      <p style="margin:0;">La cotización <strong style="color:${TINTA};">${esc(d.folio)}</strong>${d.total > 0 ? ` por ${esc(money(d.total))}` : ''} se sostiene hasta el ${esc(d.validUntil)}.</p>
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
  /** Solo al cerrar: enlace firmado para calificar el servicio sin iniciar sesión. */
  resena?: string | null;
  /** Al quedar asignado: cuándo prometió llegar el aliado ("jueves 16 de octubre, 8:00 a.m."). */
  llegada?: string | null;
  /** El aviso de que un aliado tomó el servicio: se dice "confirmado", no "asignado" (2026-10-15). */
  confirmacion?: boolean;
}): { subject: string; html: string } {
  const quien =
    d.aliados.length > 0
      ? `<p style="margin:12px 0 0;">Te atiende <strong style="color:${TINTA};">${esc(d.aliados.join(' y '))}</strong>.${d.llegada ? ` Llega el <strong style="color:${TINTA};">${esc(d.llegada)}</strong>.` : ''}</p>`
      : '';
  const cierre = d.cierre
    ? `<p style="margin:12px 0 0;">Se registraron <strong style="color:${TINTA};">${esc(d.cierre)}</strong>.</p>`
    : '';
  const detalle = `${SITIO}/cuenta/cotizaciones/${encodeURIComponent(d.folio)}`;
  // Al cerrar, lo que se pide es la calificación: va como botón y el detalle como enlace.
  const acciones = d.resena
    ? `<p style="margin:18px 0 0;"><strong style="color:${TINTA};">¿Cómo te fue?</strong> Califica el servicio: es un minuto y nos ayuda a mandarte siempre al mejor proveedor.</p>
      ${boton('Calificar el servicio', `${SITIO}${d.resena}`)}
      <p style="margin:6px 0 0;font-size:13px;"><a href="${detalle}" style="color:${AZUL};">Ver el detalle del servicio</a></p>`
    : boton('Ver el detalle', detalle);
  return {
    subject: d.resena
      ? `Tu servicio ${d.folio} terminó: ¿cómo te fue?`
      : d.confirmacion ? `Tu cotización ${d.folio} quedó autorizada` : `Tu servicio ${d.folio}: ${d.etapa.toLowerCase()}`,
    html: marco(
      `${titulo(d.confirmacion ? 'Cotización autorizada' : d.etapa)}
      <p style="margin:0 0 4px;">Hola ${esc(d.nombre)},</p>
      <p style="margin:0;">${esc(d.mensaje)}</p>
      ${quien}
      ${cierre}
      ${acciones}`,
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
  /** Lo que se le paga a él (2026-10-22): manda sobre `total`, que es del cliente. */
  pago?: { monto: number; masIva: boolean; comisionPct: number } | null;
  /** Las partidas de la cotización (2026-10-15): el aliado ve la cotización completa. */
  partidas?: Array<{ concepto: string; cantidad: string; importe: number }>;
  /** Folio del documento del cotizador (MQ-/TR-). */
  documento?: string | null;
  /** Se le ofreció a varios a la vez: el primero que acepte se la queda. */
  automatica?: boolean;
  /** Enlace firmado a su portal, donde acepta o rechaza. */
  url?: string | null;
}): { subject: string; html: string } {
  const filas: Array<[string, string]> = [];
  if (d.categoria) filas.push(['Servicio', d.categoria]);
  if (d.zona) filas.push(['Dónde', d.zona]);
  if (d.pago) filas.push(['Te pagamos', `${money(d.pago.monto)}${d.pago.masIva ? ' + IVA' : ''} (ya sin la comisión de ${d.pago.comisionPct}%)`]);
  else if (d.total != null && d.total > 0) filas.push(['Importe cotizado', money(d.total)]);
  if (d.documento) filas.push(['Cotización', d.documento]);
  filas.push(['Folio', d.folio]);
  const partidas = d.partidas?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:14px 0 0;border-collapse:collapse;font-size:13.5px;">
        ${d.partidas.map((r) => `<tr>
          <td style="padding:6px 0;border-bottom:1px solid #E5E7EB;color:${TINTA};">${esc(r.concepto)}<div style="color:${GRIS};font-size:12.5px;">${esc(r.cantidad)}</div></td>
          <td style="padding:6px 0;border-bottom:1px solid #E5E7EB;text-align:right;white-space:nowrap;color:${TINTA};">${money(r.importe)}</td>
        </tr>`).join('')}
      </table>`
    : '';
  const primero = d.automatica
    ? `<p style="margin:16px 0 0;padding:10px 12px;border-radius:3px;background:#FFF7E6;color:${TINTA};"><strong>Se le ofreció a varios aliados: el primero que acepte se lo queda.</strong></p>`
    : '';

  return {
    subject: `Solicitud para ${d.aliado}${d.zona ? ` en ${d.zona}` : ''}`,
    html: marco(
      `${titulo('Tenemos una solicitud para ustedes')}
      <p style="margin:0 0 4px;">${d.contacto ? `Hola ${esc(d.contacto)},` : `Hola,`}</p>
      <p style="margin:0;">Nos entró un trabajo que corresponde a lo que ustedes atienden.${d.total != null && d.total > 0 ? ' El cliente ya vio el precio y lo aceptó: revisa que todo cuadre.' : ''}</p>
      ${datos(filas)}
      ${partidas}
      ${d.detalle ? `<p style="margin:12px 0 0;color:${TINTA2};">${esc(d.detalle)}</p>` : ''}
      ${primero}
      <p style="margin:16px 0 0;"><strong style="color:${TINTA};">Dinos si pueden tomarlo.</strong> Si no pueden, dinos por qué — nos sirve para saber qué le falta a la red y no volver a molestarlos con lo mismo.</p>
      ${d.url ? boton('Aceptar o rechazar en mi portal', d.url) : ''}
      <p style="margin:12px 0 0;font-size:13px;color:${GRIS};">${d.url ? 'El botón abre tu portal de aliado sin contraseña; el enlace es personal, no lo compartas.' : 'Responde este correo o márcanos.'} Mientras no contesten, la solicitud sigue abierta para otro aliado.</p>`,
      'Recibes esto porque tu empresa forma parte de la red de aliados MAQSER24.',
    ),
  };
}

/**
 * AL ALIADO: UNA OFERTA SIN CONTESTAR (2026-10-21).
 *
 * Sale una vez, a la mitad del tiempo que se le da para contestar (ver
 * quotes/seguimiento-ofertas.ts). Dice cuánto queda: pasado ese tiempo el
 * trabajo se le ofrece a más aliados y el primero que acepte se lo queda.
 */
export function correoRecordatorioOferta(d: {
  aliado: string;
  contacto: string | null;
  folio: string;
  categoria: string | null;
  zona: string | null;
  /** Cuánto lleva esperando, ya en palabras ("2 h"). */
  esperando: string;
  url?: string | null;
}): { subject: string; html: string } {
  const filas: Array<[string, string]> = [];
  if (d.categoria) filas.push(['Servicio', d.categoria]);
  if (d.zona) filas.push(['Dónde', d.zona]);
  filas.push(['Folio', d.folio]);
  return {
    subject: `¿Pueden tomar la solicitud ${d.folio}?`,
    html: marco(
      `${titulo('Tienen una solicitud sin contestar')}
      <p style="margin:0 0 4px;">${d.contacto ? `Hola ${esc(d.contacto)},` : `Hola,`}</p>
      <p style="margin:0;">Hace ${esc(d.esperando)} les mandamos esta solicitud y todavía no nos dicen si la pueden tomar.</p>
      ${datos(filas)}
      <p style="margin:0;padding:10px 12px;border-radius:3px;background:#FFF7E6;color:${TINTA};"><strong>Si no contestan pronto, se la ofrecemos a más aliados y el primero que acepte se la queda.</strong></p>
      ${d.url ? boton('Aceptar o rechazar en mi portal', d.url) : ''}
      <p style="margin:12px 0 0;font-size:13px;color:${GRIS};">Si no pueden, rechácenla con el motivo: nos sirve para no volver a ofrecerles lo que no atienden.</p>`,
      'Recibes esto porque tu empresa forma parte de la red de aliados MAQSER24.',
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
export function correoHoraDeSalir(d: {
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
}): { subject: string; html: string } {
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
    subject: `Hora de salir: servicio ${d.folio}, llegada ${d.llegada}`,
    html: marco(
      `${titulo('Ya casi es hora de salir')}
      ${saludo}
      <p style="margin:0;">Para llegar a las <strong style="color:${TINTA};">${esc(d.llegada)}</strong>, la unidad debe salir a más tardar a las <strong style="color:${TINTA};">${esc(d.salida)}</strong>${esc(camino)}.</p>
      ${datos(filas)}
      <p style="margin:14px 0 0;">Cuando la unidad salga, entra a tu portal y marca <strong style="color:${TINTA};">«Ya salió la unidad»</strong>: así el cliente ve que va en camino y la puede seguir en el mapa.</p>
      ${boton_}`,
      'Recibes esto porque tu empresa tiene asignado este servicio en la red de aliados MAQSER24.',
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
           <div style="margin-top:6px;font-size:12.5px;color:${GRIS};">Sin tu constancia fiscal y tu póliza vigentes no tienes el sello de verificado y sales después en las propuestas. Súbelos desde tu portal con el botón de abajo.</div>
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

// ─────────────────── Equipos que ofrece el aliado (2026-09-24) ───────────────────

/** A MAQSER24: un aliado ofreció un equipo desde su portal. */
export function correoEquipoPropuesto(d: {
  aliado: string;
  equipo: string;
  marca: string | null;
  linea: string;
  fotos: number;
  url: string;
}): { subject: string; html: string } {
  return {
    subject: `Equipo por revisar · ${d.aliado}`,
    html: marco(
      `${titulo('Un aliado ofreció un equipo')}
      <p style="margin:0;"><strong style="color:${TINTA};">${esc(d.aliado)}</strong> registró un equipo desde su portal. Está por revisar: no sale en el sitio hasta que lo publiques.</p>
      ${datos(filas([['Equipo', d.equipo], ['Marca', d.marca], ['Línea', d.linea], ['Fotos', String(d.fotos)]]))}
      ${d.url ? boton('Revisarlo en Red de aliados', d.url) : ''}`,
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
      `${titulo(`Hola, ${esc(d.nombre)}`)}
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
export function correoEquipoPublicado(d: { contacto: string | null; equipo: string }): { subject: string; html: string } {
  return {
    subject: `Tu equipo ya está publicado · ${d.equipo}`,
    html: marco(
      `${titulo('Tu equipo ya está en MAQSER24')}
      <p style="margin:0 0 4px;">${d.contacto ? `Hola ${esc(d.contacto)},` : 'Hola,'}</p>
      <p style="margin:0;">Revisamos y publicamos <strong style="color:${TINTA};">${esc(d.equipo)}</strong>. Desde hoy los clientes pueden pedirlo y, cuando lo hagan, te llega la solicitud a tu portal.</p>
      <p style="margin:12px 0 0;color:${GRIS};font-size:13px;">Confirma en tu portal que sigue libre al menos cada 14 días: solo proponemos lo que sabemos que está disponible.</p>`,
    ),
  };
}

/** Al aliado: su equipo no se publicó, con el motivo. */
export function correoEquipoRechazado(d: { contacto: string | null; equipo: string; motivo: string }): { subject: string; html: string } {
  return {
    subject: `Revisamos tu equipo · ${d.equipo}`,
    html: marco(
      `${titulo('Tu equipo necesita cambios')}
      <p style="margin:0 0 4px;">${d.contacto ? `Hola ${esc(d.contacto)},` : 'Hola,'}</p>
      <p style="margin:0;">Revisamos <strong style="color:${TINTA};">${esc(d.equipo)}</strong> y por ahora no lo publicamos:</p>
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
    : 'Se la mandamos a los proveedores de tu zona y, en cuanto uno la acepte, te avisamos por correo y en tu cuenta. No tienes que hacer nada más.';

  return {
    subject: `Recibimos tu cotización ${d.folio}`,
    html: marco(
      `${titulo('Recibimos tu cotización')}
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
 * AL CLIENTE: SU PAGO (2026-10-22). Sale solo: el día que vence (o 3 días
 * antes si tiene crédito) y cada semana mientras siga vencido. Lleva los datos
 * para transferir cuando están capturados en Margen › Reglas.
 */
export function correoCobroRecordatorio(d: {
  nombre: string;
  folio: string;
  servicio: string | null;
  saldo: number;
  vence: string;
  /** Días: negativo = faltan; 0 = hoy; positivo = vencido. */
  dias: number;
  datosPago: { banco: string; clabe: string; beneficiario: string } | null;
  url: string;
}): { subject: string; html: string } {
  const cuando = d.dias > 0 ? `venció hace ${d.dias} día${d.dias === 1 ? '' : 's'}` : d.dias === 0 ? 'vence hoy' : `vence el ${d.vence}`;
  const filas: Array<[string, string]> = [['Servicio', `${d.folio}${d.servicio ? ` · ${d.servicio}` : ''}`], ['Por pagar', money(d.saldo)], ['Fecha límite', d.vence]];
  if (d.datosPago) filas.push(['Banco', d.datosPago.banco], ['CLABE', d.datosPago.clabe], ['A nombre de', d.datosPago.beneficiario]);
  return {
    subject: `Tu pago de ${d.folio} ${cuando}`,
    html: marco(
      `${titulo(d.dias > 0 ? 'Tienes un pago pendiente' : 'Recordatorio de pago')}
      <p style="margin:0 0 4px;">Hola ${esc(d.nombre)},</p>
      <p style="margin:0;">El pago de tu servicio <strong style="color:${TINTA};">${esc(d.folio)}</strong> ${esc(cuando)}.</p>
      ${datos(filas)}
      <p style="margin:0;">Si ya pagaste, contesta este correo con tu comprobante y lo registramos.</p>
      ${boton('Ver mi servicio', d.url)}`,
    ),
  };
}

/** AL ALIADO: sube tu factura para que te paguemos (2026-10-22). */
export function correoFacturaAliadoPendiente(d: {
  contacto: string | null;
  servicios: Array<{ folio: string; monto: number }>;
  url: string | null;
}): { subject: string; html: string } {
  const total = d.servicios.reduce((a, s) => a + s.monto, 0);
  const lista = d.servicios.map((s) => `<li style="margin:0 0 5px;color:${TINTA2};font-size:13.5px;">${esc(s.folio)} · ${money(s.monto)}</li>`).join('');
  return {
    subject: d.servicios.length === 1 ? `Sube tu factura de ${d.servicios[0].folio}` : `Sube tus facturas de ${d.servicios.length} servicios`,
    html: marco(
      `${titulo('Te falta subir tu factura')}
      <p style="margin:0 0 4px;">${d.contacto ? `Hola ${esc(d.contacto)},` : 'Hola,'}</p>
      <p style="margin:0;">Para pagarte, sube en tu portal la factura (PDF y XML) de cada servicio terminado:</p>
      <ul style="margin:12px 0;padding-left:20px;">${lista}</ul>
      <p style="margin:0;">Total a facturar: <strong style="color:${TINTA};">${money(total)}</strong>. En cuanto el cliente pague y esté tu factura, te pagamos el siguiente día de pago.</p>
      ${d.url ? boton('Subir mi factura', d.url) : ''}`,
      'Recibes esto porque tu empresa forma parte de la red de aliados MAQSER24.',
    ),
  };
}

/** AL ALIADO: ya le pagamos (2026-10-22). */
export function correoPagoAliado(d: {
  contacto: string | null;
  servicios: Array<{ folio: string; monto: number }>;
  referencia: string | null;
  fecha: string;
}): { subject: string; html: string } {
  const total = d.servicios.reduce((a, s) => a + s.monto, 0);
  const lista = d.servicios.map((s) => `<li style="margin:0 0 5px;color:${TINTA2};font-size:13.5px;">${esc(s.folio)} · ${money(s.monto)}</li>`).join('');
  return {
    subject: `Te pagamos ${money(total)}`,
    html: marco(
      `${titulo('Ya te pagamos')}
      <p style="margin:0 0 4px;">${d.contacto ? `Hola ${esc(d.contacto)},` : 'Hola,'}</p>
      <p style="margin:0;">El ${esc(d.fecha)} te depositamos <strong style="color:${TINTA};">${money(total)}</strong>${d.referencia ? ` (referencia ${esc(d.referencia)})` : ''} por:</p>
      <ul style="margin:12px 0 0;padding-left:20px;">${lista}</ul>`,
      'Recibes esto porque tu empresa forma parte de la red de aliados MAQSER24.',
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
