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

/** La primera entrega: los 10 correos que más se leen. Los demás siguen con su texto fijo hasta la segunda. */
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
      cierre: { etiqueta: 'Al cerrar: lo registrado', fabrica: 'Se registraron {cierre}.', variables: { cierre: 'Horas o cantidades del cierre' } },
      calificar: { etiqueta: 'Al terminar: pedir calificación', fabrica: '¿Cómo te fue? Califica el servicio: es un minuto y nos ayuda a mandarte siempre al mejor proveedor.', largo: true },
      botonCalificar: { etiqueta: 'Botón al terminar', fabrica: 'Calificar el servicio' },
      verDetalle: { etiqueta: 'Enlace al detalle', fabrica: 'Ver el detalle del servicio' },
      boton: { etiqueta: 'Botón en las demás etapas', fabrica: 'Ver el detalle' },
    },
    ejemplo: { nombre: 'Laura Treviño', folio: 'COT-7K2M9QXA', etapa: 'en camino', aliados: 'Rentas Norte', llegada: 'jueves 30 de octubre, 8:00 a.m.', cierre: '8 horas de trabajo', mensaje: 'La unidad ya salió hacia tu obra.' },
  },
  provider_offer: {
    nombre: 'Tenemos una solicitud para ustedes',
    para: 'aliado',
    cuando: 'Cuando se le ofrece un servicio a un aliado.',
    huecos: {
      asunto: { etiqueta: 'Asunto', fabrica: 'Solicitud para {aliado}{zona}', variables: { ...VARS_ALIADO, zona: '" en Apodaca" (vacío si no hay municipio)' } },
      titulo: { etiqueta: 'Título', fabrica: 'Tenemos una solicitud para ustedes' },
      saludo: { etiqueta: 'Saludo', fabrica: 'Hola {contacto},', variables: VARS_ALIADO },
      intro: { etiqueta: 'Primer párrafo', fabrica: 'Nos entró un trabajo que corresponde a lo que ustedes atienden.', largo: true },
      aceptado: { etiqueta: 'Si el cliente ya aceptó', fabrica: 'El cliente ya lo aceptó: revisa que todo cuadre.' },
      varios: { etiqueta: 'Si se ofreció a varios', fabrica: 'Se le ofreció a varios aliados: el primero que acepte se lo queda.' },
      pedir: { etiqueta: 'Qué les pedimos', fabrica: 'Dinos si pueden tomarlo. Si no pueden, dinos por qué — nos sirve para saber qué le falta a la red y no volver a molestarlos con lo mismo.', largo: true },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Aceptar o rechazar en mi portal' },
      nota: { etiqueta: 'Nota bajo el botón', fabrica: 'El botón abre tu portal de aliado sin contraseña; el enlace es personal, no lo compartas. Mientras no contesten, la solicitud sigue abierta para otro aliado.', largo: true },
      pie: { etiqueta: 'Pie', fabrica: 'Recibes esto porque tu empresa forma parte de la red de aliados MAQSER24.' },
    },
    ejemplo: { contacto: 'Mario Norte', aliado: 'Rentas Norte', folio: 'COT-7K2M9QXA', zona: ' en Apodaca', categoria: 'Renta de maquinaria pesada', pago: '$41,400.00 + IVA' },
  },
  provider_offer_reminder: {
    nombre: 'Tienen una solicitud sin contestar',
    para: 'aliado',
    cuando: 'A la mitad del plazo, si el aliado no ha contestado una oferta.',
    huecos: {
      asunto: { etiqueta: 'Asunto', fabrica: '¿Pueden tomar la solicitud {folio}?', variables: VARS_ALIADO, obligatorias: ['folio'] },
      titulo: { etiqueta: 'Título', fabrica: 'Tienen una solicitud sin contestar' },
      saludo: { etiqueta: 'Saludo', fabrica: 'Hola {contacto},', variables: VARS_ALIADO },
      intro: { etiqueta: 'Primer párrafo', fabrica: 'Hace {esperando} les mandamos esta solicitud y todavía no nos dicen si la pueden tomar.', variables: { esperando: 'Cuánto lleva esperando ("2 h")' }, largo: true },
      aviso: { etiqueta: 'Aviso destacado', fabrica: 'Si no contestan pronto, podemos dársela a otro aliado.' },
      boton: { etiqueta: 'Texto del botón', fabrica: 'Aceptar o rechazar en mi portal' },
      nota: { etiqueta: 'Nota bajo el botón', fabrica: 'Si no pueden, rechácenla con el motivo: nos sirve para no volver a ofrecerles lo que no atienden.', largo: true },
      pie: { etiqueta: 'Pie', fabrica: 'Recibes esto porque tu empresa forma parte de la red de aliados MAQSER24.' },
    },
    ejemplo: { contacto: 'Mario Norte', aliado: 'Rentas Norte', folio: 'COT-7K2M9QXA', esperando: '2 h', categoria: 'Renta de maquinaria pesada', zona: 'Apodaca' },
  },
  provider_assigned: {
    nombre: 'Quedó asignado a ustedes',
    para: 'aliado',
    cuando: 'Cuando el servicio queda confirmado para el aliado, con los datos de la obra.',
    huecos: {
      asunto: { etiqueta: 'Asunto', fabrica: 'Confirmado: el servicio {folio} es de ustedes', variables: VARS_ALIADO, obligatorias: ['folio'] },
      titulo: { etiqueta: 'Título', fabrica: 'Quedó asignado a ustedes' },
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
