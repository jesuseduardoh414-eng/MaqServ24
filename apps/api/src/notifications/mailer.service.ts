import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { moduloDeCorreo } from '@maqserv/config';
import { createTransport, type Transporter } from 'nodemailer';
import { avisarPanel } from './panel';

/**
 * CORREO SALIENTE (documento institucional, sección 17 · Comunicaciones).
 *
 * "Notificaciones, recordatorios y trazabilidad de interacciones."
 *
 * Hasta ahora la plataforma juntaba contactos pero no contactaba a nadie: los
 * avisos existían y llegaban a un solo lugar —la campana dentro del sitio—, así
 * que un cliente que cotizaba y cerraba la pestaña no se enteraba de nada.
 *
 * CUATRO DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. SMTP y no un proveedor concreto. El cliente todavía no elige con qué
 *    manda correo, y SMTP funciona con todos —Google Workspace, Zoho, Resend,
 *    SendGrid, su propio hosting—. Amarrarnos a una API hoy sería elegir por
 *    él una decisión que no es técnica sino de contrato.
 *
 * 2. Un FRENO explícito. En la base hay cincuenta cotizaciones con correos de
 *    clientes reales; un error de mi parte les manda correo de verdad. Mientras
 *    `MAIL_ENABLED` no diga `true`, nada sale: se registra como "simulado" y se
 *    ve completo en el panel. Encenderlo es una decisión consciente, no un
 *    descuido.
 *
 * 3. Nunca tumba la operación. Si el correo falla, la cotización se responde
 *    igual y el servicio avanza igual. El correo es un aviso de lo que pasó, no
 *    la cosa que pasó; cambiar el orden haría que un servidor de correo caído
 *    detuviera la obra.
 *
 * 4. TODO envío se registra, incluidos los que no salieron. Un correo que no
 *    sale y no avisa es peor que no tener correos: la operación cree que
 *    informó y nadie informó.
 */

export type TipoCorreo =
  | 'quote_answered'      // ya tiene precio
  | 'quote_expiring'      // se le va a vencer
  | 'service_status'      // avanzó su servicio
  | 'quote_request_ack'      // al cliente: recibimos tu solicitud a la medida (/cotizar)
  | 'quote_request_internal' // a MAQSER24: entró una solicitud a la medida
  | 'provider_offer'      // al aliado: te ofrecemos esta solicitud
  | 'provider_offer_reminder' // al aliado: no has contestado la oferta
  // Cobros y pagos (2026-10-22, money/).
  | 'cobro_recordatorio'      // al cliente: tu pago vence / venció
  | 'factura_aliado_pendiente' // al aliado: sube tu factura para pagarte
  | 'pago_aliado'             // al aliado: ya te pagamos
  | 'cierre_mes'              // a Dirección: el mes que cerró
  | 'provider_assigned'   // al aliado: quedó tuya
  | 'provider_cancelled'  // al aliado: se canceló un servicio que era suyo
  | 'provider_departure'      // al aliado: ya casi es hora de salir a la obra
  | 'provider_day_before'     // al aliado: mañana tienes servicio
  | 'service_day_before'      // al cliente: mañana llega tu servicio
  | 'provider_departure_late' // al aliado: debía salir y no ha marcado la salida
  | 'provider_access'     // al aliado: tu enlace para entrar
  | 'provider_invite'     // a quien la oficina invita a la red: haz tu registro
  | 'availability_reminder' // al aliado: confirma que sigue libre
  | 'password_reset'      // al cliente: enlace para restablecer su contraseña
  | 'email_verification'  // al cliente: confirma tu correo (registro con contraseña)
  | 'welcome'             // al cliente: tu cuenta está lista (creada con Google)
  | 'provider_offer_review'    // a MAQSER24: un aliado ofreció un equipo
  | 'provider_offer_published' // al aliado: tu equipo ya está publicado
  | 'provider_offer_rejected'  // al aliado: tu equipo no se publicó (con motivo)
  // Cotizador con tabulador (maquinaria y triturados). Los tres primeros salen
  // solos al recibir una solicitud del sitio; el último lo dispara una persona.
  | 'quoter_request_provider'  // al proveedor: te pidieron lo que publicas
  | 'quoter_request_internal'  // a MAQSER24: entró una solicitud
  | 'quoter_request_ack'       // al visitante: la recibimos, este es tu folio
  | 'quoter_quote_sent'        // al cliente: aquí está tu cotización
  // Formulario de /contacto (2026-09-30): antes solo quedaba en el panel.
  | 'contact_internal'         // a MAQSER24: alguien escribió por el sitio
  | 'contact_ack'              // a quien escribió: lo recibimos
  // "Regístrate como proveedor" (2026-10-06).
  | 'provider_signup_internal' // a MAQSER24: alguien pidió entrar a la red
  | 'provider_signup_ack'      // a quien se registró: lo recibimos
  | 'admin_password_reset'     // a un administrador: restablecer su contraseña del panel
  | 'admin_invitacion'         // a quien se invita al panel: crear su contraseña (2026-10-28)
  | 'question_answered'        // a quien preguntó en el sitio: ya respondimos
  | 'contact_reply'            // a quien escribió por Contacto: la respuesta desde Mensajes
  | 'prueba';

export interface CorreoParaEnviar {
  kind: TipoCorreo;
  to: string;
  toName?: string | null;
  /** A dónde va "Responder". Por defecto, al remitente de la plataforma. */
  replyTo?: string | null;
  subject: string;
  /** Cuerpo en HTML. El texto plano se deriva de aquí. */
  html: string;
  quoteId?: number | null;
  orderId?: number | null;
  providerId?: number | null;
}

/** Cómo terminó el intento. Es lo que se guarda y lo que se lee en el panel. */
export type EstadoEnvio = 'enviado' | 'fallido' | 'omitido' | 'simulado';

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * ENLACES PERSONALES, FUERA DEL REGISTRO (2026-10-12).
 *
 * El registro guarda el correo para poder abrirlo desde el panel, pero algunos
 * llevan un enlace que ES la llave de alguien: restablecer una contraseña,
 * confirmar una cuenta, entrar al portal del aliado (`?t=` / `?token=`).
 * Guardarlos tal cual dejaría a cualquiera con acceso al panel —o a la base—
 * entrar como esa persona. Se guardan con la llave tachada; esos correos se
 * leen pero no se reenvían desde el registro.
 */
export const ENLACE_OCULTO = '[enlace-personal]';
const ENLACE_PERSONAL = /([?&](?:amp;)?(?:t|token)=)[^&"'\s<>]+/gi;
const sinEnlacesPersonales = (html: string): string => html.replace(ENLACE_PERSONAL, `$1${ENLACE_OCULTO}`);

@Injectable()
export class MailerService {
  private readonly log = new Logger(MailerService.name);
  private transporte: Transporter | null = null;
  private avisoDeApagado = false;

  /** ¿Está configurado el servidor de correo? */
  get configurado(): boolean {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  }

  /**
   * ¿Se permite mandar de verdad?
   *
   * Configurado no basta: hace falta encenderlo a propósito. Es el freno de la
   * decisión 2 y no tiene valor por defecto que lo active.
   */
  get habilitado(): boolean {
    return this.configurado && process.env.MAIL_ENABLED === 'true';
  }

  private get remitente(): string {
    const nombre = process.env.MAIL_FROM_NAME ?? 'MAQSER24';
    const correo = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? 'no-reply@maqser24.mx';
    return `"${nombre}" <${correo}>`;
  }

  private obtenerTransporte(): Transporter | null {
    if (!this.configurado) return null;
    if (this.transporte) return this.transporte;
    const puerto = Number(process.env.SMTP_PORT ?? 587);
    this.transporte = createTransport({
      host: process.env.SMTP_HOST,
      port: puerto,
      // 465 es TLS implícito; 587 empieza en claro y sube con STARTTLS.
      secure: puerto === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    return this.transporte;
  }

  /**
   * Manda un correo. Devuelve cómo terminó; nunca lanza.
   *
   * El llamador no tiene que envolver esto en try/catch ni comprobar nada: si
   * algo sale mal, aquí se registra y la operación sigue.
   */
  async enviar(c: CorreoParaEnviar): Promise<EstadoEnvio> {
    const destino = (c.to ?? '').trim().toLowerCase();

    // Un destinatario inválido no es un fallo del servidor: es un dato malo, y
    // conviene que se lea distinto en el registro.
    if (!CORREO_VALIDO.test(destino)) {
      await this.anotar(c, 'omitido', `Correo inválido: "${c.to}"`);
      return 'omitido';
    }

    if (!this.habilitado) {
      const motivo = this.configurado
        ? 'MAIL_ENABLED no está en "true": no se manda correo real todavía.'
        : 'Sin servidor de correo configurado (faltan SMTP_HOST, SMTP_USER o SMTP_PASS).';
      if (!this.avisoDeApagado) {
        // Una vez por arranque: repetirlo por cada correo llenaría el log de la
        // API sin decir nada nuevo.
        this.log.warn(`Correo apagado — ${motivo}`);
        this.avisoDeApagado = true;
      }
      await this.anotar(c, 'simulado', motivo);
      return 'simulado';
    }

    try {
      await this.obtenerTransporte()!.sendMail({
        from: this.remitente,
        // Nombre y asunto sin saltos de línea ni comillas (QA 2026-09-28): los
        // escribe el cliente o el aliado, y pegados en una cabecera podían
        // colar destinatarios o cabeceras. El nombre va como campo aparte.
        to: c.toName ? { name: c.toName.replace(/[\r\n"<>,;]+/g, ' ').trim().slice(0, 120), address: destino } : destino,
        subject: c.subject.replace(/[\r\n]+/g, ' ').slice(0, 250),
        // "Responder" va a esta dirección (p. ej. al cliente que escribió en
        // /contacto). Solo si es un correo válido: la escribe un visitante.
        ...(c.replyTo && CORREO_VALIDO.test(c.replyTo) ? { replyTo: c.replyTo } : {}),
        html: c.html,
        // Muchos clientes de correo y filtros piden la versión de texto; sin
        // ella el mensaje pesa más para el filtro de spam.
        text: aTexto(c.html),
      });
      await this.anotar(c, 'enviado', null);
      return 'enviado';
    } catch (e) {
      const detalle = e instanceof Error ? e.message : String(e);
      this.log.error(`No se pudo enviar "${c.subject}" a ${destino}: ${detalle}`);
      const id = await this.anotar(c, 'fallido', detalle.slice(0, 900));
      // La prueba se manda desde la misma pantalla del registro: ahí ya se ve.
      if (c.kind !== 'prueba') {
        void avisarPanel({
          modulo: moduloDeCorreo(c.kind),
          evento: 'correo_fallido',
          titulo: `No salió un correo a ${c.toName?.trim() || destino}`,
          cuerpo: `${c.subject} · ${detalle.slice(0, 300)}`,
          link: id ? `/correo?ver=${id}` : '/correo',
          // Con el servidor caído fallan todos: un aviso por módulo cada 15
          // minutos basta, el resto está en el registro.
          unoCadaMinutos: 15,
        });
      }
      return 'fallido';
    }
  }

  /**
   * Anota el intento y devuelve su id. Si ni esto se puede, se traga el error:
   * el registro existe para explicar la operación, no para detenerla.
   */
  private async anotar(c: CorreoParaEnviar, state: EstadoEnvio, detail: string | null): Promise<number | null> {
    const data = {
      kind: c.kind,
      to_email: (c.to ?? '').slice(0, 190),
      to_name: c.toName?.slice(0, 190) ?? null,
      subject: c.subject.slice(0, 500),
      state,
      detail,
      quote_id: c.quoteId ?? null,
      order_id: c.orderId ?? null,
      provider_id: c.providerId ?? null,
    };
    try {
      return (await prisma.email_log.create({ data: { ...data, body_html: sinEnlacesPersonales(c.html) }, select: { id: true } })).id;
    } catch {
      // Sin la columna del contenido (falta correr sql/correo-contenido.sql)
      // se registra igual, sin contenido: el registro no puede perderse por eso.
      try {
        return (await prisma.email_log.create({ data, select: { id: true } })).id;
      } catch (e) {
        this.log.error(`No se pudo registrar el correo: ${e instanceof Error ? e.message : e}`);
        return null;
      }
    }
  }

  /** Comprueba que el servidor de correo contesta. Para el panel. */
  async probarConexion(): Promise<{ ok: boolean; detalle: string }> {
    if (!this.configurado) {
      return { ok: false, detalle: 'Faltan SMTP_HOST, SMTP_USER o SMTP_PASS.' };
    }
    try {
      await this.obtenerTransporte()!.verify();
      return {
        ok: true,
        detalle: this.habilitado
          ? 'El servidor contesta y el envío está encendido.'
          : 'El servidor contesta, pero MAIL_ENABLED no está en "true": todavía no sale correo real.',
      };
    } catch (e) {
      return { ok: false, detalle: e instanceof Error ? e.message : String(e) };
    }
  }
}

/**
 * Versión de texto del cuerpo.
 *
 * Es deliberadamente simple —quitar etiquetas y normalizar espacios— porque el
 * HTML lo escribimos nosotros y es plano. Un conversor completo sería peso
 * muerto para plantillas que controlamos.
 */
function aTexto(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h1|h2|h3|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
