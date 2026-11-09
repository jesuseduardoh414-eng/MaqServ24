import { prisma } from '@maqserv/db';
import { themeTokensSchema } from '@maqserv/config';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';

const SITIO = process.env.SITE_URL ?? 'https://maqser24.com';

/**
 * TEXTOS Y DISEÑO DE LOS CORREOS, EDITABLES DESDE EL PANEL (2026-10-28).
 *
 * "Quiero editar todo, de todos los correos que se mandan." Cada correo tiene
 * un ESQUELETO fijo (qué bloques calculados lleva —tabla de datos, lista de
 * servicios, botón— y en qué orden) y unos HUECOS de texto: asunto, título,
 * párrafos, texto del botón y pie. Aquí viven los huecos: su texto de fábrica
 * y las etiquetas `{nombre}`, `{folio}`, `{total}`… que cada uno admite. Lo
 * que Dirección edita en Correo se guarda en `platform_settings`
 * (`correo_textos`) y pisa el de fábrica hueco por hueco; nada de SQL.
 *
 * Las etiquetas son lo que vuelve esto seguro: el panel no escribe HTML ni
 * datos, escribe frases; el sistema pone los datos reales (ya escapados) al
 * mandar. Un hueco marcado `obligatoria` tiene que conservar esa etiqueta
 * (p. ej. el enlace de acceso), o el panel no deja guardar.
 *
 * El diseño común (logo, colores, pie general) va en `correo_diseno`, y lo
 * lee `marco()` en email-templates.ts.
 */

export const AJUSTE_TEXTOS = 'correo_textos';
export const AJUSTE_DISENO = 'correo_diseno';

export interface Hueco {
  /** Para qué sirve, en palabras del panel. */
  etiqueta: string;
  fabrica: string;
  /** Las etiquetas que puede usar, con su explicación. */
  variables?: Record<string, string>;
  /** Etiquetas que no pueden faltar. */
  obligatorias?: string[];
  /** Varias líneas (párrafo largo). */
  largo?: boolean;
}

export interface DefinicionCorreo {
  /** Nombre para la lista del panel. */
  nombre: string;
  /** A quién le llega. */
  para: 'cliente' | 'aliado' | 'sitio' | 'interno';
  /** Cuándo sale. */
  cuando: string;
  huecos: Record<string, Hueco>;
  /** Datos de ejemplo para la vista previa. */
  ejemplo: Record<string, string>;
}

const VARS_CLIENTE = { nombre: 'Nombre del cliente', folio: 'Folio de la solicitud' };
const VARS_ALIADO = { contacto: 'Nombre del contacto del aliado', aliado: 'Nombre de la empresa aliada', folio: 'Folio del servicio' };

/** Variables comunes de un correo, para no repetirlas hueco por hueco. */
function con(vars: Record<string, string>, huecos: Record<string, Omit<Hueco, 'variables'> & { variables?: Record<string, string> }>): Record<string, Hueco> {
  return Object.fromEntries(Object.entries(huecos).map(([k, h]) => [k, { ...h, variables: h.variables ?? vars }]));
}

const PIE_ALIADO = 'Recibes esto porque tu empresa forma parte de la red de aliados MAQSER24.';
const PIE_ENLACE = 'Si el botón no abre, copia esta dirección en tu navegador:';

/**
 * Primera entrega (2026-10-28): los 10 correos que más se leen. Segunda
 * (2026-11-09): los otros 25, abajo. Así se edita TODO lo que manda el
 * sistema, menos el correo de prueba del panel, que solo comprueba el envío.
 */
export const CORREOS: Record<string, DefinicionCorreo> = {
  quote_answered: {
    nombre: 'Tu cotización ya tiene precio',
    para: 'cliente',
    cuando: 'Cuando MAQSER24 le manda el precio a una solicitud.',
    huecos: {
      asunto: { etiqueta: 'Asunto', fabrica: 'Tu cotización {folio} ya tiene precio', variables: VARS_CLIENTE, obligatorias: ['folio'] },
      titulo: { etiqueta: 'Título', fabrica: 'Ya tienes precio', variables: VARS_CLIENTE },
      saludo: { etiqueta: 'Saludo', fabrica: 'Hola {nombre},', variables: VARS_CLIENTE },
      intro: { etiqueta: 'Primer párrafo', fabrica: 'Revisamos tu solicitud {folio} y ya está lista.', variables: VARS_CLIENTE, largo: true },
      documento: { etiqueta: 'Si hay cotización formal', fabrica: 'Te preparamos la cotización formal {documento} con el detalle de cada partida: la puedes ver, imprimir o guardar en PDF desde tu cuenta.', variables: { ...VARS_CLIENTE, documento: 'Folio del documento (MQ-/TR-)' }, largo: true },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Ver y aceptar' },
      cierre: { etiqueta: 'Nota final', fabrica: 'Si algo no cuadra, contéstanos este correo y lo ajustamos.', largo: true },
      pie: { etiqueta: 'Pie (si tiene vigencia)', fabrica: 'Este precio se sostiene hasta el {vigencia}. Después habría que actualizarlo.', variables: { vigencia: 'Fecha hasta la que vale el precio' } },
    },
    ejemplo: { nombre: 'Laura Treviño', folio: 'COT-7K2M9QXA', documento: 'MQ-2610-0014', vigencia: '15 de noviembre', total: '$48,720.00' },
  },
  quote_expiring: {
    nombre: 'Tu cotización está por vencer',
    para: 'cliente',
    cuando: 'Dos días antes de que venza una cotización que no se ha aceptado.',
    huecos: {
      asunto: { etiqueta: 'Asunto', fabrica: 'Tu cotización {folio} {cuando}', variables: { ...VARS_CLIENTE, cuando: '"vence hoy", "vence mañana" o "vence en N días"' }, obligatorias: ['folio'] },
      titulo: { etiqueta: 'Título', fabrica: 'Tu precio {cuando}', variables: { cuando: '"vence hoy", "vence mañana" o "vence en N días"' } },
      saludo: { etiqueta: 'Saludo', fabrica: 'Hola {nombre},', variables: VARS_CLIENTE },
      intro: { etiqueta: 'Primer párrafo', fabrica: 'La cotización {folio}{monto} se sostiene hasta el {vigencia}.', variables: { ...VARS_CLIENTE, monto: '" por $X" (vacío si no hay monto)', vigencia: 'Fecha límite' }, largo: true },
      aviso: { etiqueta: 'Segundo párrafo', fabrica: 'Después de esa fecha ya no se puede aceptar y habría que volver a cotizarla — los precios de traslado y disponibilidad cambian.', largo: true },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Aceptar ahora' },
    },
    ejemplo: { nombre: 'Laura Treviño', folio: 'COT-7K2M9QXA', cuando: 'vence mañana', monto: ' por $48,720.00', vigencia: '15 de noviembre' },
  },
  service_status: {
    nombre: 'Tu servicio avanzó',
    para: 'cliente',
    cuando: 'Cada vez que el servicio cambia de etapa (asignado, en camino, en obra, terminado).',
    huecos: {
      asunto: { etiqueta: 'Asunto', fabrica: 'Tu servicio {folio}: {etapa}', variables: { ...VARS_CLIENTE, etapa: 'La etapa, en minúsculas' }, obligatorias: ['folio'] },
      asuntoConfirmado: { etiqueta: 'Asunto cuando un aliado lo toma', fabrica: 'Tu cotización {folio} quedó autorizada', variables: VARS_CLIENTE, obligatorias: ['folio'] },
      asuntoTermino: { etiqueta: 'Asunto al terminar', fabrica: 'Tu servicio {folio} terminó: ¿cómo te fue?', variables: VARS_CLIENTE, obligatorias: ['folio'] },
      tituloConfirmado: { etiqueta: 'Título cuando un aliado lo toma', fabrica: 'Cotización autorizada' },
      saludo: { etiqueta: 'Saludo', fabrica: 'Hola {nombre},', variables: VARS_CLIENTE },
      quien: { etiqueta: 'Quién lo atiende', fabrica: 'Te atiende {aliados}.', variables: { aliados: 'Nombre(s) del aliado' } },
      llegada: { etiqueta: 'Cuándo llega', fabrica: 'Llega el {llegada}.', variables: { llegada: 'Fecha y hora comprometidas' } },
      // Las placas, para que el cliente avise en la caseta de la obra (2026-11-09).
      unidad: { etiqueta: 'Qué unidad va', fabrica: 'Va la unidad {unidad}.', variables: { unidad: 'Número económico y placas ("Eco. 12 · placas RX-12-345")' }, obligatorias: ['unidad'] },
      cierre: { etiqueta: 'Al cerrar: lo registrado', fabrica: 'Se registraron {cierre}.', variables: { cierre: 'Horas o cantidades del cierre' } },
      calificar: { etiqueta: 'Al terminar: pedir calificación', fabrica: '¿Cómo te fue? Califica el servicio: es un minuto y nos ayuda a mandarte siempre al mejor proveedor.', largo: true },
      botonCalificar: { etiqueta: 'Botón al terminar', fabrica: 'Calificar el servicio' },
      verDetalle: { etiqueta: 'Enlace al detalle', fabrica: 'Ver el detalle del servicio' },
      boton: { etiqueta: 'Botón en las demás etapas', fabrica: 'Ver el detalle' },
    },
    ejemplo: { nombre: 'Laura Treviño', folio: 'COT-7K2M9QXA', etapa: 'en camino', aliados: 'Rentas Norte', llegada: 'jueves 30 de octubre, 8:00 a.m.', cierre: '8 horas de trabajo', mensaje: 'La unidad ya salió hacia tu obra.', unidad: 'Eco. 12 · placas RX-12-345' },
  },
  // Al aliado se le habla de TÚ en todos los correos (2026-11-09, auditoría del
  // 28 de octubre): se mezclaban «ustedes» y «tú» en la misma frase.
  provider_offer: {
    nombre: 'Tenemos una solicitud para ti',
    para: 'aliado',
    cuando: 'Cuando se le ofrece un servicio a un aliado.',
    huecos: {
      asunto: { etiqueta: 'Asunto', fabrica: 'Solicitud para {aliado}{zona}', variables: { ...VARS_ALIADO, zona: '" en Apodaca" (vacío si no hay municipio)' } },
      titulo: { etiqueta: 'Título', fabrica: 'Tenemos una solicitud para ti' },
      saludo: { etiqueta: 'Saludo', fabrica: 'Hola {contacto},', variables: VARS_ALIADO },
      intro: { etiqueta: 'Primer párrafo', fabrica: 'Nos entró un trabajo que corresponde a lo que tú atiendes.', largo: true },
      aceptado: { etiqueta: 'Si el cliente ya aceptó', fabrica: 'El cliente ya lo aceptó: revisa que todo cuadre.' },
      varios: { etiqueta: 'Si se ofreció a varios', fabrica: 'Se le ofreció a varios aliados: el primero que acepte se lo queda.' },
      pedir: { etiqueta: 'Qué le pedimos', fabrica: 'Dinos si puedes tomarlo. Si no puedes, dinos por qué: nos sirve para saber qué le falta a la red y no volver a ofrecerte lo mismo.', largo: true },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Aceptar o rechazar en mi portal' },
      nota: { etiqueta: 'Nota bajo el botón', fabrica: 'El botón abre tu portal de aliado sin contraseña; el enlace es personal, no lo compartas. Mientras no contestes, la solicitud sigue abierta para otro aliado.', largo: true },
      pie: { etiqueta: 'Pie', fabrica: 'Recibes esto porque tu empresa forma parte de la red de aliados MAQSER24.' },
    },
    ejemplo: { contacto: 'Mario Norte', aliado: 'Rentas Norte', folio: 'COT-7K2M9QXA', zona: ' en Apodaca', categoria: 'Renta de maquinaria pesada', pago: '$41,400.00 + IVA' },
  },
  provider_offer_reminder: {
    nombre: 'Tienes una solicitud sin contestar',
    para: 'aliado',
    cuando: 'A la mitad del plazo, si el aliado no ha contestado una oferta.',
    huecos: {
      asunto: { etiqueta: 'Asunto', fabrica: '¿Puedes tomar la solicitud {folio}?', variables: VARS_ALIADO, obligatorias: ['folio'] },
      titulo: { etiqueta: 'Título', fabrica: 'Tienes una solicitud sin contestar' },
      saludo: { etiqueta: 'Saludo', fabrica: 'Hola {contacto},', variables: VARS_ALIADO },
      intro: { etiqueta: 'Primer párrafo', fabrica: 'Hace {esperando} te mandamos esta solicitud y todavía no nos dices si la puedes tomar.', variables: { esperando: 'Cuánto lleva esperando ("2 h")' }, largo: true },
      aviso: { etiqueta: 'Aviso destacado', fabrica: 'Si no contestas pronto, podemos dársela a otro aliado.' },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Aceptar o rechazar en mi portal' },
      nota: { etiqueta: 'Nota bajo el botón', fabrica: 'Si no puedes, recházala con el motivo: nos sirve para no volver a ofrecerte lo que no atiendes.', largo: true },
      pie: { etiqueta: 'Pie', fabrica: 'Recibes esto porque tu empresa forma parte de la red de aliados MAQSER24.' },
    },
    ejemplo: { contacto: 'Mario Norte', aliado: 'Rentas Norte', folio: 'COT-7K2M9QXA', esperando: '2 h', categoria: 'Renta de maquinaria pesada', zona: 'Apodaca' },
  },
  provider_assigned: {
    nombre: 'El servicio es tuyo',
    para: 'aliado',
    cuando: 'Cuando el servicio queda confirmado para el aliado, con los datos de la obra.',
    huecos: {
      asunto: { etiqueta: 'Asunto', fabrica: 'Confirmado: el servicio {folio} es tuyo', variables: VARS_ALIADO, obligatorias: ['folio'] },
      titulo: { etiqueta: 'Título', fabrica: 'El servicio es tuyo' },
      saludo: { etiqueta: 'Saludo', fabrica: 'Hola {contacto},', variables: VARS_ALIADO },
      intro: { etiqueta: 'Primer párrafo', fabrica: 'Confirmamos el servicio. Estos son los datos de la obra.', largo: true },
      exige: { etiqueta: 'Encabezado de requisitos', fabrica: 'ESTA OBRA EXIGE' },
      exigeNota: { etiqueta: 'Nota de requisitos', fabrica: 'Sin esto no dejan entrar la unidad.' },
      cierre: { etiqueta: 'Nota final', fabrica: 'Cualquier cambio, avísanos antes de salir: la obra ya está contando con la unidad.', largo: true },
      pie: { etiqueta: 'Pie', fabrica: 'Recibes esto porque tu empresa forma parte de la red de aliados MAQSER24.' },
    },
    ejemplo: { contacto: 'Mario Norte', aliado: 'Rentas Norte', folio: 'COT-7K2M9QXA', categoria: 'Renta de maquinaria pesada', direccion: 'Av. Industrial 1500, Apodaca', requisitos: 'Casco · Chaleco · DC-3 del operador' },
  },
  provider_departure: {
    nombre: 'Ya casi es hora de salir',
    para: 'aliado',
    cuando: 'Antes de la hora en que la unidad debe salir para llegar a tiempo.',
    huecos: {
      asunto: { etiqueta: 'Asunto', fabrica: 'Hora de salir: servicio {folio}, llegada {llegada}', variables: { ...VARS_ALIADO, llegada: 'Hora de llegada comprometida' }, obligatorias: ['folio'] },
      titulo: { etiqueta: 'Título', fabrica: 'Ya casi es hora de salir' },
      saludo: { etiqueta: 'Saludo', fabrica: 'Hola {contacto},', variables: VARS_ALIADO },
      intro: { etiqueta: 'Primer párrafo', fabrica: 'Para llegar a las {llegada}, la unidad debe salir a más tardar a las {salida}{camino}.', variables: { llegada: 'Hora de llegada', salida: 'Hora de salida', camino: '" (calculamos unos N min de camino)" o vacío' }, largo: true },
      marcar: { etiqueta: 'Qué hacer', fabrica: 'Cuando la unidad salga, entra a tu portal y marca «Ya salió la unidad»: así el cliente ve que va en camino y la puede seguir en el mapa.', largo: true },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Marcar que ya salió' },
      pie: { etiqueta: 'Pie', fabrica: 'Recibes esto porque tu empresa tiene asignado este servicio en la red de aliados MAQSER24.' },
      // El segundo aviso, si pasó la hora y no marcó la salida (2026-11-09).
      asuntoTarde: { etiqueta: 'Segundo aviso (no ha salido): asunto', fabrica: '¿Ya salió la unidad? Servicio {folio}', variables: VARS_ALIADO, obligatorias: ['folio'] },
      tituloTarde: { etiqueta: 'Segundo aviso: título', fabrica: '¿Ya salió la unidad?' },
      introTarde: { etiqueta: 'Segundo aviso: primer párrafo', fabrica: 'La unidad debía salir a las {salida} para llegar a las {llegada}, y todavía no se marca la salida.', variables: { llegada: 'Hora de llegada', salida: 'Hora de salida' }, largo: true },
      marcarTarde: { etiqueta: 'Segundo aviso: qué hacer', fabrica: 'Si ya va en camino, márcalo en tu portal: el cliente lo está esperando. Si hay un retraso, contéstanos este correo o llámanos.', largo: true },
    },
    ejemplo: { contacto: 'Mario Norte', aliado: 'Rentas Norte', folio: 'COT-7K2M9QXA', llegada: '8:00 a.m.', salida: '6:40 a.m.', camino: ' (calculamos unos 55 min de camino)', obra: 'Torre Valle', direccion: 'Av. Industrial 1500, Apodaca' },
  },
  cobro_recordatorio: {
    nombre: 'Recordatorio de pago al cliente',
    para: 'cliente',
    cuando: 'Antes de que venza el pago de un servicio, y después si no ha pagado.',
    huecos: {
      asunto: { etiqueta: 'Asunto', fabrica: 'Tu pago de {folio} {cuando}', variables: { ...VARS_CLIENTE, cuando: '"vence hoy", "vence el 30 de octubre" o "venció hace 3 días"' }, obligatorias: ['folio'] },
      titulo: { etiqueta: 'Título antes de vencer', fabrica: 'Recordatorio de pago' },
      tituloVencido: { etiqueta: 'Título ya vencido', fabrica: 'Tienes un pago pendiente' },
      saludo: { etiqueta: 'Saludo', fabrica: 'Hola {nombre},', variables: VARS_CLIENTE },
      intro: { etiqueta: 'Primer párrafo', fabrica: 'El pago de tu servicio {folio} {cuando}.', variables: { ...VARS_CLIENTE, cuando: '"vence hoy", "vence el…" o "venció hace…"' }, largo: true },
      comprobante: { etiqueta: 'Si ya pagó', fabrica: 'Si ya pagaste, contesta este correo con tu comprobante y lo registramos.', largo: true },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Ver mi servicio' },
    },
    ejemplo: { nombre: 'Laura Treviño', folio: 'COT-7K2M9QXA', cuando: 'vence el 30 de octubre', saldo: '$48,720.00', vence: '30 de octubre' },
  },
  factura_aliado_pendiente: {
    nombre: 'Sube tu factura',
    para: 'aliado',
    cuando: 'Cuando el cliente ya pagó y al aliado le falta subir su factura.',
    huecos: {
      asuntoUna: { etiqueta: 'Asunto (una factura)', fabrica: 'Sube tu factura de {folio}', variables: VARS_ALIADO, obligatorias: ['folio'] },
      asuntoVarias: { etiqueta: 'Asunto (varias)', fabrica: 'Sube tus facturas de {n} servicios', variables: { n: 'Cuántos servicios' } },
      titulo: { etiqueta: 'Título', fabrica: 'Te falta subir tu factura' },
      saludo: { etiqueta: 'Saludo', fabrica: 'Hola {contacto},', variables: VARS_ALIADO },
      intro: { etiqueta: 'Primer párrafo', fabrica: 'Para pagarte, sube en tu portal la factura (PDF y XML) de cada servicio terminado:', largo: true },
      total: { etiqueta: 'Después de la lista', fabrica: 'Total a facturar: {total}. En cuanto el cliente pague y esté tu factura, te pagamos el siguiente día de pago.', variables: { total: 'Suma de los servicios' }, largo: true },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Subir mi factura' },
      pie: { etiqueta: 'Pie', fabrica: 'Recibes esto porque tu empresa forma parte de la red de aliados MAQSER24.' },
    },
    ejemplo: { contacto: 'Mario Norte', aliado: 'Rentas Norte', folio: 'COT-7K2M9QXA', n: '2', total: '$57,669.00' },
  },
  pago_aliado: {
    nombre: 'Ya te pagamos',
    para: 'aliado',
    cuando: 'Cuando Administración registra el pago al aliado.',
    huecos: {
      asunto: { etiqueta: 'Asunto', fabrica: 'Te pagamos {total}', variables: { total: 'Monto pagado' } },
      titulo: { etiqueta: 'Título', fabrica: 'Ya te pagamos' },
      saludo: { etiqueta: 'Saludo', fabrica: 'Hola {contacto},', variables: VARS_ALIADO },
      intro: { etiqueta: 'Primer párrafo', fabrica: 'El {fecha} te depositamos {total}{referencia} por:', variables: { fecha: 'Fecha del pago', total: 'Monto', referencia: '" (referencia XXX)" o vacío' }, largo: true },
      pie: { etiqueta: 'Pie', fabrica: 'Recibes esto porque tu empresa forma parte de la red de aliados MAQSER24.' },
    },
    ejemplo: { contacto: 'Mario Norte', aliado: 'Rentas Norte', fecha: '31 de octubre', total: '$16,269.00', referencia: ' (referencia SPEI 4471)' },
  },

  // ───────── Segunda entrega (2026-11-09): los otros 25 ─────────

  // Al cliente
  quoter_request_ack: {
    nombre: 'Recibimos tu solicitud (cotizador)',
    para: 'cliente',
    cuando: 'Cuando un cliente manda una solicitud desde el cotizador del sitio.',
    huecos: con({ ...VARS_CLIENTE, cotizador: 'Qué cotizador usó ("triturados")' }, {
      asunto: { etiqueta: 'Asunto', fabrica: 'Recibimos tu solicitud {folio}', obligatorias: ['folio'] },
      titulo: { etiqueta: 'Título', fabrica: 'Recibimos tu solicitud' },
      saludo: { etiqueta: 'Saludo', fabrica: 'Hola {nombre},' },
      intro: { etiqueta: 'Primer párrafo', fabrica: 'Ya tenemos lo que armaste en el cotizador de {cotizador}. Guarda este folio para darle seguimiento:', largo: true },
      siguiente: { etiqueta: 'Qué sigue', fabrica: 'Un asesor de MAQSER24 la revisa y te mandamos la cotización con precio y vigencia por correo. Si te conviene, la aceptas desde tu cuenta y asignamos al proveedor que te atiende.', largo: true },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Seguir mi solicitud' },
      cierre: { etiqueta: 'Nota final', fabrica: 'Si algo cambió (fechas, cantidades, la dirección de la obra), contesta este correo y lo ajustamos antes de que salga la unidad.', largo: true },
    }),
    ejemplo: { nombre: 'Laura Treviño', folio: 'COT-7K2M9QXA', cotizador: 'triturados' },
  },
  quote_request_ack: {
    nombre: 'Recibimos tu solicitud (a la medida)',
    para: 'cliente',
    cuando: 'Cuando un cliente pide algo a la medida, todavía sin precio.',
    huecos: con(VARS_CLIENTE, {
      asunto: { etiqueta: 'Asunto', fabrica: 'Recibimos tu solicitud {folio}', obligatorias: ['folio'] },
      titulo: { etiqueta: 'Título', fabrica: 'Recibimos tu solicitud' },
      saludo: { etiqueta: 'Saludo', fabrica: 'Hola {nombre},' },
      intro: { etiqueta: 'Primer párrafo', fabrica: 'Ya la tenemos. Guarda este folio para darle seguimiento:', largo: true },
      siguiente: { etiqueta: 'Qué sigue', fabrica: 'Un asesor de MAQSER24 la revisa y te mandamos la cotización con precio y vigencia por correo. Después la aceptas desde tu cuenta y asignamos al proveedor que te atiende.', largo: true },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Ver mi solicitud' },
      cierre: { etiqueta: 'Nota final', fabrica: 'Si algo cambió (fechas, cantidades, la dirección de la obra), contesta este correo y lo ajustamos.', largo: true },
    }),
    ejemplo: { nombre: 'Laura Treviño', folio: 'COT-7K2M9QXA', pidio: 'Grúa de 30 t con operador, 2 días' },
  },
  quoter_quote_sent: {
    nombre: 'La cotización formal',
    para: 'cliente',
    cuando: 'Cuando alguien del panel aprieta «Enviar al cliente» en una cotización con folio MQ- o TR-.',
    huecos: con({ ...VARS_CLIENTE, folio: 'Folio del documento (MQ-/TR-)', cotizador: 'Qué cotizador ("maquinaria")' }, {
      asunto: { etiqueta: 'Asunto', fabrica: 'Tu cotización {folio} · MAQSER24', obligatorias: ['folio'] },
      titulo: { etiqueta: 'Título', fabrica: 'Cotización {folio}' },
      saludo: { etiqueta: 'Saludo', fabrica: 'Hola {nombre},' },
      botonAceptar: { etiqueta: 'Botón para aceptar', fabrica: 'Acepto la cotización' },
      notaAceptar: { etiqueta: 'Nota bajo el botón', fabrica: 'Al aceptarla asignamos al proveedor y te avisamos por correo quién va y cuándo. El botón vale 15 días.', largo: true },
      cierre: { etiqueta: 'Nota final', fabrica: '¿Algo no cuadra? Contesta este correo y lo ajustamos.', largo: true },
      pie: { etiqueta: 'Pie', fabrica: 'Cotización {folio} del cotizador de {cotizador}. Los precios son los del tabulador vigente el día en que se emitió.' },
    }),
    ejemplo: { nombre: 'Laura Treviño', folio: 'MQ-2611-0007', cotizador: 'maquinaria', obra: 'Bodega Escobedo' },
  },
  service_day_before: {
    nombre: 'Mañana llega tu servicio',
    para: 'cliente',
    cuando: 'Un día antes del servicio, a las 6 de la tarde.',
    huecos: con({ ...VARS_CLIENTE, llegada: 'Fecha y hora de llegada' }, {
      asunto: { etiqueta: 'Asunto', fabrica: 'Mañana llega tu servicio {folio}', obligatorias: ['folio'] },
      titulo: { etiqueta: 'Título', fabrica: 'Mañana es tu servicio' },
      saludo: { etiqueta: 'Saludo', fabrica: 'Hola {nombre},' },
      intro: { etiqueta: 'Primer párrafo', fabrica: 'Te recordamos que mañana llega la unidad a tu obra.', largo: true },
      aviso: { etiqueta: 'Qué tener listo', fabrica: 'Te avisamos en cuanto salga y la puedes seguir en el mapa desde tu cuenta. Ten listo el acceso a la obra.', largo: true },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Ver mi servicio' },
      cierre: { etiqueta: 'Nota final', fabrica: 'Si algo cambió, contesta este correo hoy mismo.', largo: true },
    }),
    ejemplo: { nombre: 'Laura Treviño', folio: 'COT-7K2M9QXA', llegada: 'jueves 13 de noviembre, 8:00 a.m.', aliado: 'Rentas Norte', obra: 'Bodega Escobedo', direccion: 'Av. Industrial 1500, Apodaca' },
  },

  // Al aliado
  provider_day_before: {
    nombre: 'Mañana tienes servicio',
    para: 'aliado',
    cuando: 'Un día antes del servicio, a las 6 de la tarde.',
    huecos: con({ contacto: VARS_ALIADO.contacto, folio: VARS_ALIADO.folio, llegada: 'Fecha y hora de llegada' }, {
      asunto: { etiqueta: 'Asunto', fabrica: 'Mañana: servicio {folio}, llegada {llegada}', obligatorias: ['folio'] },
      titulo: { etiqueta: 'Título', fabrica: 'Mañana tienes servicio' },
      saludo: { etiqueta: 'Saludo', fabrica: 'Hola {contacto},' },
      intro: { etiqueta: 'Primer párrafo', fabrica: 'Te recordamos el servicio de mañana. Mañana te avisamos a qué hora debe salir la unidad.', largo: true },
      exige: { etiqueta: 'Antes de los requisitos de la obra', fabrica: 'Esta obra exige:' },
      marcar: { etiqueta: 'Qué hacer', fabrica: 'Cuando la unidad salga, márcalo en tu portal y ve actualizando el estado: llegué, empecé, terminé.', largo: true },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Abrir mi portal' },
      pie: { etiqueta: 'Pie', fabrica: 'Recibes esto porque tu empresa tiene asignado este servicio en la red de aliados MAQSER24.' },
    }),
    ejemplo: { contacto: 'Mario Norte', folio: 'COT-7K2M9QXA', llegada: 'jueves 13 de noviembre, 8:00 a.m.', obra: 'Bodega Escobedo', direccion: 'Av. Industrial 1500, Apodaca', requisitos: 'Casco · Chaleco · DC-3 del operador' },
  },
  provider_cancelled: {
    nombre: 'Se canceló el servicio',
    para: 'aliado',
    cuando: 'Cuando se cancela un servicio que ya era del aliado.',
    huecos: con({ contacto: VARS_ALIADO.contacto, folio: VARS_ALIADO.folio }, {
      asunto: { etiqueta: 'Asunto', fabrica: 'Se canceló el servicio {folio}: no salgas', obligatorias: ['folio'] },
      titulo: { etiqueta: 'Título', fabrica: 'Se canceló el servicio' },
      saludo: { etiqueta: 'Saludo', fabrica: 'Hola {contacto},' },
      aviso: { etiqueta: 'Aviso destacado', fabrica: 'No mandes la unidad.' },
      intro: { etiqueta: 'Primer párrafo', fabrica: 'Este servicio ya no va y tu equipo queda libre para otros trabajos.', largo: true },
      cierre: { etiqueta: 'Nota final', fabrica: 'Si la unidad ya había salido, llámanos para ver los gastos del traslado.', largo: true },
      pie: { etiqueta: 'Pie', fabrica: PIE_ALIADO },
    }),
    ejemplo: { contacto: 'Mario Norte', folio: 'COT-7K2M9QXA', categoria: 'Renta de maquinaria pesada', direccion: 'Av. Industrial 1500, Apodaca', motivo: 'El cliente pospuso la obra' },
  },
  provider_access: {
    nombre: 'Tu acceso al portal',
    para: 'aliado',
    cuando: 'Cuando el panel le manda al aliado el enlace a su portal (Proveedores › Acceso).',
    huecos: con({ contacto: VARS_ALIADO.contacto, aliado: VARS_ALIADO.aliado, solicitudes: '"1 solicitud" o "3 solicitudes"', dias: 'Días que sirve el enlace' }, {
      asunto: { etiqueta: 'Asunto', fabrica: 'Tu acceso a MAQSER24, {aliado}' },
      asuntoPendientes: { etiqueta: 'Asunto si tiene solicitudes esperando', fabrica: '{solicitudes} para {aliado}', obligatorias: ['solicitudes'] },
      titulo: { etiqueta: 'Título', fabrica: 'Ya puedes contestarnos directo' },
      saludo: { etiqueta: 'Saludo', fabrica: 'Hola {contacto},' },
      intro: { etiqueta: 'Primer párrafo', fabrica: 'Desde este enlace ves las solicitudes que te ofrecemos, marcas si una máquina entra a mantenimiento y revisas tus papeles, sin esperar a que te llamemos.', largo: true },
      pendientes: { etiqueta: 'Si tiene solicitudes esperando', fabrica: 'Tienes {solicitudes} esperando tu respuesta.', obligatorias: ['solicitudes'] },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Abrir mi portal' },
      nota: { etiqueta: 'Nota bajo el botón', fabrica: 'No hace falta contraseña: el enlace es tuyo y sirve {dias} días. Guarda este correo para volver a entrar.', largo: true },
      pie: { etiqueta: 'Pie', fabrica: 'Si alguien más de tu equipo debe recibir esto, dinos a qué correo y lo cambiamos.' },
    }),
    ejemplo: { contacto: 'Mario Norte', aliado: 'Rentas Norte', solicitudes: '2 solicitudes', dias: '30' },
  },
  provider_invite: {
    nombre: 'Te invitamos a la red',
    para: 'aliado',
    cuando: 'Cuando el panel invita por correo a un aliado nuevo (Proveedores › Invitar aliado).',
    huecos: con({ contacto: VARS_ALIADO.contacto, empresa: 'Nombre de la empresa invitada' }, {
      asunto: { etiqueta: 'Asunto', fabrica: '{empresa}: te invitamos a la red de aliados de MAQSER24' },
      titulo: { etiqueta: 'Título', fabrica: 'Te invitamos a trabajar con MAQSER24' },
      saludo: { etiqueta: 'Saludo', fabrica: 'Hola {contacto},' },
      intro: { etiqueta: 'Primer párrafo', fabrica: 'En MAQSER24 recibimos solicitudes de maquinaria, transporte y materiales para obras, y se las pasamos a aliados como tú. Nos gustaría que {empresa} forme parte de la red.', largo: true },
      registro: { etiqueta: 'Qué le pedimos', fabrica: 'Llena tu registro: dónde está tu base, a qué municipios llegas y qué equipos tienes. Toma unos minutos y tus datos ya van puestos.', largo: true },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Hacer mi registro' },
      nota: { etiqueta: 'Nota bajo el botón', fabrica: 'Cuando lo revisemos te llega el enlace a tu portal: ahí contestas las solicitudes y subes tus papeles.', largo: true },
      pie: { etiqueta: 'Pie', fabrica: 'Recibes esto porque alguien de MAQSER24 te invitó a su red de aliados. Si no te interesa, ignora este correo.' },
    }),
    ejemplo: { contacto: 'Mario', empresa: 'Grúas del Valle' },
  },
  availability_reminder: {
    nombre: 'Revisa tus papeles',
    para: 'aliado',
    cuando: 'Cuando a un aliado le falta o se le vence la constancia fiscal o la póliza de seguro.',
    huecos: con({ contacto: VARS_ALIADO.contacto, aliado: VARS_ALIADO.aliado }, {
      asunto: { etiqueta: 'Asunto', fabrica: '{aliado}: revisa tus papeles' },
      titulo: { etiqueta: 'Título', fabrica: 'Tus papeles en MAQSER24' },
      saludo: { etiqueta: 'Saludo', fabrica: 'Hola {contacto},' },
      intro: { etiqueta: 'Primer párrafo', fabrica: 'Sin tu constancia fiscal y tu póliza vigentes no tienes el sello de verificado y sales después cuando ofrecemos un servicio. Súbelos desde tu portal con el botón de abajo.', largo: true },
      encabezado: { etiqueta: 'Encabezado de la lista', fabrica: 'TUS PAPELES' },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Abrir mi portal' },
      nota: { etiqueta: 'Nota bajo el botón', fabrica: 'No hace falta contraseña: el enlace es tuyo.' },
      pie: { etiqueta: 'Pie', fabrica: PIE_ALIADO },
    }),
    ejemplo: { contacto: 'Mario Norte', aliado: 'Rentas Norte' },
  },
  provider_offer_published: {
    nombre: 'Tu equipo ya está dado de alta',
    para: 'aliado',
    cuando: 'Cuando MAQSER24 acepta algo nuevo que ofreció el aliado y lo liga a un tipo.',
    huecos: con({ contacto: VARS_ALIADO.contacto, equipo: 'Lo que ofreció', tipo: 'El tipo de MAQSER24 en que quedó' }, {
      asunto: { etiqueta: 'Asunto', fabrica: 'Tu equipo ya está dado de alta · {equipo}' },
      titulo: { etiqueta: 'Título', fabrica: 'Tu equipo ya está en MAQSER24' },
      saludo: { etiqueta: 'Saludo', fabrica: 'Hola {contacto},' },
      intro: { etiqueta: 'Primer párrafo', fabrica: 'Revisamos {equipo} y quedó como {tipo}. Desde hoy, cuando un cliente lo pida en tu zona, te llega la solicitud a tu portal.', largo: true },
      nota: { etiqueta: 'Nota final', fabrica: 'Si entra a mantenimiento, márcalo en tu portal: solo te ofrecemos lo que está libre.', largo: true },
    }),
    ejemplo: { contacto: 'Mario Norte', equipo: 'Bobcat S70', tipo: 'Minicargador' },
  },
  provider_offer_rejected: {
    nombre: 'Por ahora no lo manejamos',
    para: 'aliado',
    cuando: 'Cuando MAQSER24 no acepta un equipo o una categoría que propuso el aliado (va con el motivo).',
    huecos: con({ contacto: VARS_ALIADO.contacto, equipo: 'Lo que ofreció' }, {
      asunto: { etiqueta: 'Asunto', fabrica: 'Revisamos lo que nos ofreciste · {equipo}' },
      titulo: { etiqueta: 'Título', fabrica: 'Por ahora no lo manejamos' },
      saludo: { etiqueta: 'Saludo', fabrica: 'Hola {contacto},' },
      intro: { etiqueta: 'Antes del motivo', fabrica: 'Revisamos {equipo} y por ahora MAQSER24 no lo maneja:', largo: true },
      cierre: { etiqueta: 'Después del motivo', fabrica: 'Puedes volver a ofrecerlo desde tu portal con los cambios, o contestar este correo si tienes dudas.', largo: true },
    }),
    ejemplo: { contacto: 'Mario Norte', equipo: 'Vibrocompactador 1 t', motivo: 'Ya tenemos suficientes en tu zona.' },
  },

  // A quien se registra o escribe en el sitio
  provider_signup_ack: {
    nombre: 'Recibimos tu registro como proveedor',
    para: 'sitio',
    cuando: 'Cuando alguien se registra como proveedor en el sitio.',
    huecos: con({ nombre: 'Nombre de quien se registró', dominio: 'El dominio del sitio' }, {
      asunto: { etiqueta: 'Asunto', fabrica: 'Recibimos tu registro como proveedor · MAQSER24' },
      titulo: { etiqueta: 'Título', fabrica: 'Hola, {nombre}' },
      intro: { etiqueta: 'Primer párrafo', fabrica: 'Recibimos tu registro para formar parte de la red MAQSER24. Nuestro equipo revisará la información.', largo: true },
      siguiente: { etiqueta: 'Qué sigue', fabrica: 'Si te aceptamos en la red, te llega a este correo el enlace a tu portal de aliado: ahí subes tus papeles, ofreces tus equipos y contestas las solicitudes de obra.', largo: true },
      cierre: { etiqueta: 'Nota final', fabrica: 'Si quieres agregar algo, responde a este correo.' },
      pie: { etiqueta: 'Pie', fabrica: 'Si no te registraste en {dominio}, ignora este correo.' },
    }),
    ejemplo: { nombre: 'Mario' },
  },
  contact_ack: {
    nombre: 'Recibimos tu mensaje',
    para: 'sitio',
    cuando: 'Cuando alguien escribe en Contacto del sitio.',
    huecos: con({ nombre: 'Nombre de quien escribió', dominio: 'El dominio del sitio' }, {
      asunto: { etiqueta: 'Asunto', fabrica: 'Recibimos tu mensaje · MAQSER24' },
      titulo: { etiqueta: 'Título', fabrica: 'Hola, {nombre}' },
      intro: { etiqueta: 'Primer párrafo', fabrica: 'Recibimos tu mensaje. Un asesor de MAQSER24 te contesta en horario de atención, de lunes a sábado de 8:00 a 18:00.', largo: true },
      sinTelefono: { etiqueta: 'Si no dejó teléfono', fabrica: 'Si nos dejas un teléfono respondiendo a este correo, podemos llamarte.', largo: true },
      pie: { etiqueta: 'Pie', fabrica: 'Si no escribiste en {dominio}, ignora este correo.' },
    }),
    ejemplo: { nombre: 'Pedro' },
  },
  contact_reply: {
    nombre: 'Respondimos tu mensaje',
    para: 'sitio',
    cuando: 'Cuando se contesta desde Mensajes un mensaje que llegó por Contacto.',
    huecos: con({ nombre: 'Nombre de quien escribió', dominio: 'El dominio del sitio' }, {
      asunto: { etiqueta: 'Asunto', fabrica: 'Respondimos tu mensaje · MAQSER24' },
      titulo: { etiqueta: 'Título', fabrica: 'Hola, {nombre}' },
      tituloSinNombre: { etiqueta: 'Título si no hay nombre', fabrica: 'Respondimos tu mensaje' },
      suMensaje: { etiqueta: 'Antes de su mensaje', fabrica: 'Nos escribiste:' },
      respuesta: { etiqueta: 'Antes de la respuesta', fabrica: 'Nuestra respuesta:' },
      cierre: { etiqueta: 'Nota final', fabrica: 'Si te queda alguna duda, responde a este correo.' },
      pie: { etiqueta: 'Pie', fabrica: 'Recibes este correo porque nos escribiste desde {dominio}.' },
    }),
    ejemplo: { nombre: 'Pedro', mensaje: '¿Rentan retroexcavadora por semana en Apodaca?', respuesta: 'Sí. Te mandamos la cotización a tu correo hoy mismo.' },
  },
  question_answered: {
    nombre: 'Respondimos tu pregunta',
    para: 'sitio',
    cuando: 'Cuando se contesta una pregunta hecha en el sitio o en un producto.',
    huecos: con({ nombre: 'Nombre de quien preguntó', dominio: 'El dominio del sitio' }, {
      asunto: { etiqueta: 'Asunto', fabrica: 'Respondimos tu pregunta · MAQSER24' },
      titulo: { etiqueta: 'Título', fabrica: 'Hola, {nombre}' },
      tituloSinNombre: { etiqueta: 'Título si no hay nombre', fabrica: 'Respondimos tu pregunta' },
      suPregunta: { etiqueta: 'Antes de su pregunta', fabrica: 'Tu pregunta:' },
      respuesta: { etiqueta: 'Antes de la respuesta', fabrica: 'Nuestra respuesta:' },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Ver más preguntas frecuentes' },
      cierre: { etiqueta: 'Nota final', fabrica: 'Si te queda alguna duda, responde a este correo.' },
      pie: { etiqueta: 'Pie', fabrica: 'Recibes este correo porque hiciste una pregunta en {dominio}.' },
    }),
    ejemplo: { nombre: 'Pedro', pregunta: '¿La excavadora incluye operador?', respuesta: 'Sí: la renta por hora incluye operador y diésel.' },
  },
  email_verification: {
    nombre: 'Confirma tu cuenta',
    para: 'sitio',
    cuando: 'Cuando alguien se registra en el sitio con correo y contraseña.',
    huecos: con({ nombre: 'Primer nombre', horas: 'Horas que sirve el enlace' }, {
      asunto: { etiqueta: 'Asunto', fabrica: 'Confirma tu cuenta · MAQSER24' },
      titulo: { etiqueta: 'Título', fabrica: 'Hola, {nombre}' },
      intro: { etiqueta: 'Primer párrafo', fabrica: 'Ya casi está tu cuenta en MAQSER24. Solo falta confirmar que este correo es tuyo:', largo: true },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Confirmar mi cuenta' },
      nota: { etiqueta: 'Nota bajo el botón', fabrica: 'Al confirmar entras directo a tu cuenta. El enlace caduca en {horas} horas; si ya venció, entra con tu correo y pide uno nuevo. Si no creaste esta cuenta, ignora este correo.', largo: true },
      pie: { etiqueta: 'Pie (antes del enlace)', fabrica: PIE_ENLACE },
    }),
    ejemplo: { nombre: 'Laura', horas: '24' },
  },
  welcome: {
    nombre: 'Tu cuenta está lista (con Google)',
    para: 'sitio',
    cuando: 'Cuando alguien crea su cuenta del sitio con Google.',
    huecos: con({ nombre: 'Nombre de la persona' }, {
      asunto: { etiqueta: 'Asunto', fabrica: 'Tu cuenta en MAQSER24 está lista' },
      // Sin «Bienvenido»: no sabemos si es él o ella (2026-11-09).
      titulo: { etiqueta: 'Título', fabrica: 'Te damos la bienvenida, {nombre}' },
      intro: { etiqueta: 'Primer párrafo', fabrica: 'Tu cuenta quedó creada con tu acceso de Google. Desde ella puedes pedir cotizaciones, solicitar servicios y seguirlos paso a paso.', largo: true },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Ir a mi cuenta' },
      nota: { etiqueta: 'Nota final', fabrica: 'Si no fuiste tú quien la creó, escríbenos respondiendo este correo.', largo: true },
    }),
    ejemplo: { nombre: 'Laura Treviño' },
  },
  password_reset: {
    nombre: 'Restablecer la contraseña',
    para: 'sitio',
    cuando: 'Cuando alguien pide «¿Olvidaste tu contraseña?» en el sitio o en el panel, o Dirección le manda el enlace desde Equipo del panel.',
    huecos: con({ nombre: 'Nombre de la persona', vigencia: 'Cuánto sirve el enlace ("60 minutos")', quien: 'Quién lo mandó desde el panel' }, {
      asunto: { etiqueta: 'Asunto', fabrica: 'Restablece tu contraseña · MAQSER24' },
      asuntoPanel: { etiqueta: 'Asunto si lo manda Dirección', fabrica: 'Cambia tu contraseña del panel · MAQSER24' },
      titulo: { etiqueta: 'Título', fabrica: 'Hola, {nombre}' },
      motivo: { etiqueta: 'Primer párrafo', fabrica: 'Recibimos una solicitud para restablecer la contraseña de tu cuenta. Si fuiste tú, entra aquí y elige una nueva:', largo: true },
      motivoPanel: { etiqueta: 'Primer párrafo si lo manda Dirección', fabrica: '{quien} te mandó este enlace desde el panel para que cambies tu contraseña. Entra aquí y elige una nueva:', largo: true },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Elegir nueva contraseña' },
      nota: { etiqueta: 'Nota bajo el botón', fabrica: 'El enlace sirve una sola vez y caduca en {vigencia}. Si no pediste esto, ignora este correo: tu contraseña sigue igual.', largo: true },
      pie: { etiqueta: 'Pie (antes del enlace)', fabrica: PIE_ENLACE },
    }),
    ejemplo: { nombre: 'Laura', vigencia: '60 minutos', quien: 'Carlos' },
  },

  // A MAQSER24
  quoter_request_internal: {
    nombre: 'Entró una solicitud del cotizador',
    para: 'interno',
    cuando: 'Cuando un cliente manda una solicitud desde el cotizador del sitio.',
    huecos: con({ folio: 'Folio de la solicitud', cliente: 'Nombre del cliente', cotizador: 'Qué cotizador usó' }, {
      asunto: { etiqueta: 'Asunto', fabrica: 'Nueva solicitud {folio} · {cliente}', obligatorias: ['folio'] },
      titulo: { etiqueta: 'Título', fabrica: 'Entró una solicitud del sitio' },
      intro: { etiqueta: 'Primer párrafo', fabrica: 'Cotizador de {cotizador}, folio {folio}.', largo: true },
      pidio: { etiqueta: 'Antes de la lista', fabrica: 'Pidió:' },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Abrir en el panel' },
      nota: { etiqueta: 'Nota final', fabrica: 'El cliente no vio el precio. Revísalo en Solicitudes, corrígelo si hace falta y mándale la cotización; cuando la acepte eliges a qué aliado se le da.', largo: true },
    }),
    ejemplo: { folio: 'COT-7K2M9QXA', cliente: 'Laura Treviño', cotizador: 'triturados' },
  },
  quote_request_internal: {
    nombre: 'Entró una solicitud a la medida',
    para: 'interno',
    cuando: 'Cuando un cliente pide algo a la medida, sin precio.',
    huecos: con({ folio: 'Folio de la solicitud', cliente: 'Empresa o nombre del cliente' }, {
      asunto: { etiqueta: 'Asunto', fabrica: 'Solicitud a la medida {folio} · {cliente}', obligatorias: ['folio'] },
      titulo: { etiqueta: 'Título', fabrica: 'Entró una solicitud a la medida' },
      intro: { etiqueta: 'Primer párrafo', fabrica: 'Llegó sin precio por el formulario «Cotizar». Hay que responderla en Solicitudes.', largo: true },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Abrir en el panel' },
    }),
    ejemplo: { folio: 'COT-7K2M9QXA', cliente: 'Constructora Treviño' },
  },
  contact_internal: {
    nombre: 'Nuevo mensaje del sitio',
    para: 'interno',
    cuando: 'Cuando alguien escribe en Contacto del sitio.',
    huecos: con({ nombre: 'Nombre de quien escribió', tema: '" · Tema" (vacío si no eligió tema)' }, {
      asunto: { etiqueta: 'Asunto', fabrica: 'Mensaje del sitio · {nombre}{tema}' },
      titulo: { etiqueta: 'Título', fabrica: 'Nuevo mensaje desde el sitio' },
      intro: { etiqueta: 'Primer párrafo', fabrica: '{nombre} escribió por el formulario de contacto.', largo: true },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Verlo en el panel' },
      pie: { etiqueta: 'Pie', fabrica: 'Para contestar, responde a este correo: la respuesta le llega a quien escribió.' },
    }),
    ejemplo: { nombre: 'Pedro Ramírez', tema: ' · Renta de maquinaria' },
  },
  provider_signup_internal: {
    nombre: 'Quieren entrar a la red',
    para: 'interno',
    cuando: 'Cuando alguien se registra como proveedor en el sitio.',
    huecos: con({ nombre: 'Nombre de la empresa' }, {
      asunto: { etiqueta: 'Asunto', fabrica: 'Solicitud de proveedor · {nombre}' },
      titulo: { etiqueta: 'Título', fabrica: 'Quieren entrar a la red' },
      intro: { etiqueta: 'Primer párrafo', fabrica: '{nombre} se registró como proveedor desde el sitio.', largo: true },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Revisarla en el panel' },
      pie: { etiqueta: 'Pie', fabrica: 'La solicitud está en Proveedores. No entra a ninguna asignación hasta que la aceptes.' },
    }),
    ejemplo: { nombre: 'Grúas del Valle' },
  },
  provider_offer_review: {
    nombre: 'Un aliado ofreció algo nuevo',
    para: 'interno',
    cuando: 'Cuando un aliado ofrece desde su portal un equipo o una categoría que MAQSER24 no tiene.',
    huecos: con({ aliado: 'Nombre del aliado', equipo: 'Lo que ofreció' }, {
      asunto: { etiqueta: 'Asunto', fabrica: 'Algo nuevo de {aliado} · {equipo}' },
      titulo: { etiqueta: 'Título', fabrica: 'Un aliado ofreció algo que MAQSER24 no tiene' },
      intro: { etiqueta: 'Primer párrafo', fabrica: '{aliado} ofreció desde su portal un equipo que no está en la lista de tipos. En Inventario decides si es igual a uno que ya existe o si se vuelve un servicio nuevo de MAQSER24.', largo: true },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Verlo en Inventario' },
      botonCategoria: { etiqueta: 'Botón si propuso una categoría nueva', fabrica: 'Verlo en Categorías' },
    }),
    ejemplo: { aliado: 'Rentas Norte', equipo: 'Bobcat S70', marca: 'Bobcat', linea: 'Renta de maquinaria pesada' },
  },
  admin_invitacion: {
    nombre: 'Invitación al panel',
    para: 'interno',
    cuando: 'Cuando Dirección invita a alguien al panel (Equipo del panel).',
    huecos: con({ nombre: 'Nombre de la persona invitada', quien: 'Quién la invitó', rol: 'Su rol ("Operaciones")', dias: 'Días que sirve el enlace' }, {
      asunto: { etiqueta: 'Asunto', fabrica: 'Te invitaron al panel de MAQSER24' },
      titulo: { etiqueta: 'Título', fabrica: 'Hola, {nombre}' },
      intro: { etiqueta: 'Primer párrafo', fabrica: '{quien} te dio acceso al panel de MAQSER24 como {rol}. Para entrar, crea tu contraseña aquí:', largo: true },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Crear mi contraseña' },
      nota: { etiqueta: 'Nota bajo el botón', fabrica: 'El enlace sirve una sola vez y caduca en {dias} días. Si no esperabas esto, ignora este correo.', largo: true },
      pie: { etiqueta: 'Pie (antes del enlace)', fabrica: PIE_ENLACE },
    }),
    ejemplo: { nombre: 'Ana', quien: 'Carlos', rol: 'Operaciones', dias: '7' },
  },
  cierre_mes: {
    nombre: 'Cierre del mes',
    para: 'interno',
    cuando: 'Del día 1 al 5 de cada mes, a Dirección y Administración, con lo del mes que cerró.',
    huecos: con({ mes: 'El mes ("octubre de 2026")', margen: 'Margen del mes' }, {
      asunto: { etiqueta: 'Asunto', fabrica: 'Cierre de {mes}: margen {margen}' },
      titulo: { etiqueta: 'Título', fabrica: 'Cierre de {mes}' },
      intro: { etiqueta: 'Antes de las cifras del mes', fabrica: 'Servicios cerrados en el mes, sin IVA:' },
      hoy: { etiqueta: 'Antes de lo pendiente', fabrica: 'Hoy, con IVA:' },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Ver el margen' },
    }),
    ejemplo: { mes: 'octubre de 2026', margen: '$71,700.00' },
  },
};

/** El diseño común de todos los correos. */
export interface DisenoCorreo {
  /** URL del logo (de `uploads/` o completa), o vacío para el nombre en texto. */
  logo: string;
  nombre: string;
  /** La franja de arriba y los botones. */
  color: string;
  /** El texto de los títulos. */
  colorTexto: string;
  /** El fondo de la cabecera donde va el logo; vacío = cabecera blanca. */
  cabecera: string;
  /** El pie general, para los correos que no traen uno propio. */
  pie: string;
  /** Firma al final del cuerpo; vacío = sin firma. */
  firma: string;
}

/**
 * EL DISEÑO DE FÁBRICA ES EL DEL SISTEMA (2026-10-28, lo pediste tú: "todos
 * deben tener los colores y diseños del sistema, además del logo"). Sale del
 * tema activo del sitio: el logo de la marca sobre la cabecera en negro
 * tecnológico (el fondo oscuro del tema), el azul del tema claro en la franja
 * y los botones (sobre blanco cumple AA; el eléctrico no), y el negro del tema
 * en los títulos. Si el tema no se puede leer, estos valores (la identidad
 * MAQSER24 del manual) son la red de seguridad.
 */
export const DISENO_FABRICA: DisenoCorreo = {
  logo: `${SITIO}/brand/maqser24-logo.png`,
  nombre: 'MAQSER24',
  color: '#0066CC',
  colorTexto: '#07090C',
  cabecera: '#07090C',
  pie: 'Este mensaje se envió automáticamente desde la plataforma MAQSER24.',
  firma: '',
};

const TTL_TEMA_MS = 60_000;
let sistemaCache: { diseno: DisenoCorreo; en: number } | null = null;

/** El diseño que dicta el tema activo del sitio (con caché de un minuto). */
export async function disenoDelSistema(): Promise<DisenoCorreo> {
  if (sistemaCache && Date.now() - sistemaCache.en < TTL_TEMA_MS) return sistemaCache.diseno;
  let diseno = DISENO_FABRICA;
  try {
    const tema = await prisma.theme.findFirst({ where: { active: true }, select: { tokens: true } });
    const t = tema ? themeTokensSchema.safeParse(tema.tokens) : null;
    if (t?.success) {
      const hex = (v: string | null | undefined, si: string) => (v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : si);
      // El logo del tema solo si está en nuestros dominios: el correo se abre fuera y
      // un archivo de un almacén viejo (Supabase) puede desaparecer sin avisar.
      const logoTema = t.data.branding?.logoDark ?? t.data.branding?.logoLight ?? '';
      const propio = /^https?:\/\/([a-z0-9-]+\.)*maqser24\.com\//i.test(logoTema) || (logoTema.startsWith(SITIO) && logoTema.length > SITIO.length);
      diseno = {
        ...DISENO_FABRICA,
        logo: propio ? logoTema : DISENO_FABRICA.logo,
        color: hex(t.data.colors.light.primary, DISENO_FABRICA.color),
        colorTexto: hex(t.data.colors.light.text, DISENO_FABRICA.colorTexto),
        cabecera: hex(t.data.colors.dark.background, DISENO_FABRICA.cabecera),
      };
    }
  } catch {
    // Sin base (o el tema roto): la identidad fija.
  }
  sistemaCache = { diseno, en: Date.now() };
  return diseno;
}

type Textos = Record<string, Record<string, string>>;

export async function leerTextos(): Promise<Textos> {
  const t = await leerAjuste<Textos>(AJUSTE_TEXTOS, {});
  return t && typeof t === 'object' ? t : {};
}
export async function guardarTextos(textos: Textos, por: string): Promise<void> {
  await guardarAjuste(AJUSTE_TEXTOS, textos, por);
}
/** Lo guardado en el panel encima de lo que dicta el tema del sitio. */
export async function leerDiseno(): Promise<DisenoCorreo> {
  const [sistema, d] = await Promise.all([disenoDelSistema(), leerAjuste<Partial<DisenoCorreo>>(AJUSTE_DISENO, {})]);
  const diseno = { ...sistema, ...(d && typeof d === 'object' ? d : {}) };
  actualCache = { diseno, en: Date.now() };
  return diseno;
}
export async function guardarDiseno(d: DisenoCorreo, por: string): Promise<void> {
  await guardarAjuste(AJUSTE_DISENO, d, por);
  actualCache = { diseno: d, en: Date.now() };
}

/**
 * Para las plantillas que todavía arman el correo sin esperar (las que no
 * están en el editor): el último diseño leído. Si lleva más de un minuto, se
 * refresca en segundo plano; al arrancar la API se lee una vez.
 */
let actualCache: { diseno: DisenoCorreo; en: number } | null = null;
export function disenoSincrono(): DisenoCorreo {
  if (!actualCache || Date.now() - actualCache.en > TTL_TEMA_MS) void leerDiseno().catch(() => undefined);
  return actualCache?.diseno ?? DISENO_FABRICA;
}
void leerDiseno().catch(() => undefined);

/**
 * Lo que la vista previa del panel le pasa a una plantilla: los textos que se
 * están escribiendo y el diseño, sin guardarlos. Si viene, la plantilla lo usa
 * en vez de leer el ajuste.
 */
export interface Previa {
  textos: Record<string, string>;
  diseno: DisenoCorreo;
}

/**
 * Los textos de un correo, con lo editado encima de lo de fábrica. Las
 * plantillas lo llaman al armar cada correo: un cambio en el panel aplica al
 * siguiente envío sin reiniciar.
 */
export async function textosDe(kind: string, previa?: Previa): Promise<Record<string, string>> {
  const def = Object.prototype.hasOwnProperty.call(CORREOS, kind) ? CORREOS[kind] : undefined;
  if (!def) return {};
  const editados = previa ? previa.textos : (await leerTextos())[kind] ?? {};
  return Object.fromEntries(Object.entries(def.huecos).map(([k, h]) => [k, typeof editados[k] === 'string' && editados[k].trim() ? editados[k] : h.fabrica]));
}

/** Diseño para una plantilla: el de la vista previa si viene, si no el guardado. */
export async function disenoDe(previa?: Previa): Promise<DisenoCorreo> {
  return previa ? previa.diseno : leerDiseno();
}

/**
 * Pone los datos en las etiquetas. Los datos llegan YA escapados para HTML
 * por quien arma el correo (o son texto para el asunto); una etiqueta sin
 * dato queda vacía, nunca el nombre entre llaves.
 */
export function aplicar(texto: string, datos: Record<string, string | number | null | undefined>): string {
  return texto.replace(/\{([a-zA-Z]+)\}/g, (_, k: string) => {
    const v = datos[k];
    return v == null ? '' : String(v);
  });
}

/** Qué le falta a un texto editado para ser válido; null si está bien. */
export function problemaDeTexto(kind: string, hueco: string, texto: string): string | null {
  const h = Object.prototype.hasOwnProperty.call(CORREOS, kind) && Object.prototype.hasOwnProperty.call(CORREOS[kind].huecos, hueco) ? CORREOS[kind].huecos[hueco] : undefined;
  if (!h) return 'Ese texto no existe.';
  if (texto.length > 1200) return 'Es demasiado largo (máximo 1,200 caracteres).';
  for (const v of h.obligatorias ?? []) {
    if (!texto.includes(`{${v}}`)) return `Tiene que llevar la etiqueta {${v}}.`;
  }
  const permitidas = new Set(Object.keys(h.variables ?? {}));
  const usadas = [...texto.matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1]);
  const ajena = usadas.find((u) => !permitidas.has(u));
  if (ajena) return `La etiqueta {${ajena}} no existe en este texto. Puedes usar: ${[...permitidas].map((p) => `{${p}}`).join(', ') || 'ninguna'}.`;
  return null;
}
