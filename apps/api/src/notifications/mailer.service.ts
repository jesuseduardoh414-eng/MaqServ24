import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { createTransport, type Transporter } from 'nodemailer';

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
  | 'provider_offer'      // al aliado: te ofrecemos esta solicitud
  | 'provider_assigned'   // al aliado: quedó tuya
  | 'provider_access'     // al aliado: tu enlace para entrar
  | 'prueba';

export interface CorreoParaEnviar {
  kind: TipoCorreo;
  to: string;
  toName?: string | null;
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
        to: c.toName ? `"${c.toName}" <${destino}>` : destino,
        subject: c.subject,
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
      await this.anotar(c, 'fallido', detalle.slice(0, 900));
      return 'fallido';
    }
  }

  /**
   * Anota el intento. Si ni esto se puede, se traga el error: el registro
   * existe para explicar la operación, no para detenerla.
   */
  private async anotar(c: CorreoParaEnviar, state: EstadoEnvio, detail: string | null) {
    try {
      await prisma.email_log.create({
        data: {
          kind: c.kind,
          to_email: (c.to ?? '').slice(0, 190),
          to_name: c.toName?.slice(0, 190) ?? null,
          subject: c.subject.slice(0, 500),
          state,
          detail,
          quote_id: c.quoteId ?? null,
          order_id: c.orderId ?? null,
          provider_id: c.providerId ?? null,
        },
      });
    } catch (e) {
      this.log.error(`No se pudo registrar el correo: ${e instanceof Error ? e.message : e}`);
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
