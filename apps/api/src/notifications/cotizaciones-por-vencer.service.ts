import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { MailerService } from './mailer.service';
import { NotificationsService } from './notifications.service';
import { correoCotizacionPorVencer } from './email-templates';
import { diasParaVencer, estadoCotizacion } from '../quotes/quote-validity';

/** Cuántos días antes de vencer se le avisa. */
const DIAS_ANTES = 2;

/**
 * "TU COTIZACIÓN ESTÁ POR VENCER" (2026-10-21).
 *
 * La plantilla existía desde el principio y nadie la mandaba: el cliente que
 * dejaba pasar la vigencia se enteraba al querer aceptarla y ver "vencida".
 * Ahora la corrida diaria (POST /tareas/recordatorios, 8:00) le escribe UNA
 * vez, cuando faltan 2 días o menos, a quien tiene una cotización respondida,
 * vigente y sin aceptar. También le suena su campana.
 *
 * Una vez por cotización: el registro de correos es la constancia, igual que
 * en los avisos de salida.
 */
@Injectable()
export class CotizacionesPorVencerService {
  private readonly log = new Logger('PorVencer');

  constructor(
    private readonly mailer: MailerService,
    private readonly notifications: NotificationsService,
  ) {}

  async avisar(hoy: Date = new Date()): Promise<{ revisadas: number; avisadas: number }> {
    const resultado = { revisadas: 0, avisadas: 0 };
    // La ventana de la consulta es holgada; el día exacto lo decide diasParaVencer.
    const candidatas = await prisma.quotes.findMany({
      where: {
        status: 'completed',
        accepted_at: null,
        valid_until: { gte: new Date(hoy.getTime() - 2 * 86_400_000), lte: new Date(hoy.getTime() + (DIAS_ANTES + 2) * 86_400_000) },
      },
      select: { id: true, quote_number: true, name: true, email: true, total: true, valid_until: true, accepted_at: true, status: true, user_id: true },
    });

    for (const q of candidatas) {
      resultado.revisadas += 1;
      const dias = diasParaVencer(q.valid_until, hoy);
      if (dias === null || dias < 0 || dias > DIAS_ANTES) continue;
      if (estadoCotizacion({ status: q.status, validUntil: q.valid_until, acceptedAt: q.accepted_at }, hoy) !== 'vigente') continue;

      const ya = await prisma.email_log.findFirst({ where: { kind: 'quote_expiring', quote_id: q.id }, select: { id: true } });
      if (ya) continue;

      const vence = new Date(`${(q.valid_until as Date).toISOString().slice(0, 10)}T12:00:00Z`)
        .toLocaleDateString('es-MX', { day: 'numeric', month: 'long', timeZone: 'UTC' });
      try {
        if (q.email?.trim()) {
          await this.mailer.enviar({
            kind: 'quote_expiring',
            to: q.email,
            toName: q.name,
            quoteId: Number(q.id),
            ...(await correoCotizacionPorVencer({ nombre: q.name, folio: q.quote_number, total: Number(q.total ?? 0), validUntil: vence, dias })),
          });
        } else {
          // Sin correo no queda constancia en el registro: se deja una para no repetirlo mañana.
          await prisma.email_log.create({
            data: { kind: 'quote_expiring', to_email: '', subject: `Por vencer · ${q.quote_number}`, state: 'omitido', detail: 'La solicitud no tiene correo', quote_id: q.id },
          });
        }
        if (q.user_id) {
          await this.notifications.push({
            userId: Number(q.user_id),
            type: 'quote_answered',
            title: `Tu cotización ${q.quote_number} ${dias === 0 ? 'vence hoy' : dias === 1 ? 'vence mañana' : `vence en ${dias} días`}`,
            body: `El precio se sostiene hasta el ${vence}. Acéptala antes para no tener que volver a cotizar.`,
            link: `/cuenta/cotizaciones/${q.quote_number}`,
          });
        }
        resultado.avisadas += 1;
      } catch (e) {
        this.log.warn(`No se pudo avisar que vence ${q.quote_number}: ${(e as Error).message}`);
      }
    }
    return resultado;
  }
}
