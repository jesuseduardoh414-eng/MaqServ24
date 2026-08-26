import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { z } from 'zod';
import { AdminGuard } from './admin-auth';
import { MailerService } from '../notifications/mailer.service';
import { correoDePrueba } from '../notifications/email-templates';

/**
 * CORREO — estado, registro y prueba.
 *
 * "Notificaciones, recordatorios y trazabilidad de interacciones"
 * (documento institucional, sección 17). El registro es la mitad del
 * requisito: un correo que no sale y no avisa es peor que no tener correos,
 * porque la operación cree que informó y nadie informó.
 */
@Controller('admin/mail')
@UseGuards(AdminGuard)
export class AdminMailController {
  constructor(private readonly mailer: MailerService) {}

  /** Cómo está la configuración y qué ha pasado últimamente. */
  @Get('status')
  async status() {
    const [porEstado, ultimoFallo] = await Promise.all([
      prisma.email_log.groupBy({ by: ['state'], _count: { _all: true } }),
      prisma.email_log.findFirst({
        where: { state: 'fallido' },
        orderBy: { id: 'desc' },
        select: { created_at: true, to_email: true, detail: true },
      }),
    ]);
    const conteo: Record<string, number> = {};
    for (const r of porEstado) conteo[r.state] = r._count._all;

    return {
      configurado: this.mailer.configurado,
      habilitado: this.mailer.habilitado,
      // El texto explica qué falta, no sólo que falta: es la diferencia entre
      // un aviso accionable y uno decorativo.
      resumen: !this.mailer.configurado
        ? 'Sin servidor de correo. Faltan SMTP_HOST, SMTP_USER y SMTP_PASS en la API.'
        : !this.mailer.habilitado
          ? 'Configurado, pero apagado: MAIL_ENABLED no está en "true", así que nada sale todavía. Todo se registra como simulado.'
          : 'Encendido. Los correos salen de verdad.',
      conteo,
      ultimoFallo,
    };
  }

  /** Los últimos envíos. Es lo que se mira cuando alguien dice "no me llegó". */
  @Get('log')
  async log(@Query('estado') estado?: string, @Query('page') page?: string) {
    const p = Math.max(1, Number(page ?? 1) || 1);
    const where = estado ? { state: estado } : {};
    const [total, rows] = await Promise.all([
      prisma.email_log.count({ where }),
      prisma.email_log.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (p - 1) * 40,
        take: 40,
      }),
    ]);
    return {
      total,
      page: p,
      pages: Math.max(1, Math.ceil(total / 40)),
      items: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        to: r.to_email,
        toName: r.to_name,
        subject: r.subject,
        state: r.state,
        detail: r.detail,
        quoteId: r.quote_id ? Number(r.quote_id) : null,
        providerId: r.provider_id,
        createdAt: r.created_at,
      })),
    };
  }

  /** ¿El servidor de correo contesta? Antes de encenderlo conviene saberlo. */
  @Get('probar')
  probar() {
    return this.mailer.probarConexion();
  }

  /**
   * Manda un correo de prueba a donde se le diga.
   *
   * A una dirección ESCRITA a mano y nunca a un cliente de la base: probar el
   * correo no puede ser la forma accidental de escribirle a alguien real.
   */
  @Post('prueba')
  async prueba(@Body() body: unknown) {
    const p = z.object({ to: z.string().email() }).safeParse(body);
    if (!p.success) throw new BadRequestException('Escribe un correo válido.');
    const plantilla = correoDePrueba(p.data.to);
    const estado = await this.mailer.enviar({
      kind: 'prueba',
      to: p.data.to,
      ...plantilla,
    });
    return {
      estado,
      mensaje:
        estado === 'enviado'
          ? 'Salió. Revisa la bandeja, y también la carpeta de no deseados.'
          : estado === 'simulado'
            ? 'No salió: el envío sigue apagado. Se registró como simulado para que veas el contenido.'
            : estado === 'omitido'
              ? 'No salió: la dirección no es válida.'
              : 'Falló. Revisa el detalle en el registro de abajo.',
    };
  }
}
