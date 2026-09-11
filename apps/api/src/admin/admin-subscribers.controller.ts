import { Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { AdminGuard, Modulo } from './admin-auth';
import { PerfexService } from '../integrations/integrations.module';

/**
 * Clientes → Suscriptores: los correos del boletín del pie de página.
 *
 * Cómo funciona: cualquiera deja su correo en el footer (`content.service.subscribe`,
 * idempotente por el índice único) y **cada alta nueva se empuja a Perfex CRM como
 * lead** — ese es el destino del brief, porque **la plataforma NO manda correos**
 * (no hay SMTP): esta pantalla junta contactos, no los contacta.
 *
 * Por eso importa saber si Perfex está conectado: si no lo está, `pushLead()` omite
 * el lead en silencio y el correo se queda aquí sin llegar a ningún lado.
 */
const PAGE_SIZE = 30;

@Modulo('comunidad')
@Controller('admin/subscribers')
@UseGuards(AdminGuard)
export class AdminSubscribersController {
  constructor(private readonly perfex: PerfexService) {}

  @Get()
  async list(@Query('page') page?: string, @Query('search') search?: string) {
    const p = Math.max(1, Number(page ?? 1) || 1);
    const term = search?.trim();
    // `mode: 'insensitive'`: en Postgres `contains` distingue mayúsculas.
    const where = term ? { email: { contains: term, mode: 'insensitive' as const } } : {};

    const [total, rows, all] = await Promise.all([
      prisma.subscribers.count({ where }),
      prisma.subscribers.findMany({ where, orderBy: { id: 'desc' }, skip: (p - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      prisma.subscribers.count(),
    ]);

    // ¿Cuáles ya son clientes registrados? Distingue un lead frío de alguien que ya
    // te conoce. `subscribers` no tiene relación con `users` (esquema legacy sin FKs).
    const emails = rows.map((s) => s.email);
    const known = emails.length
      ? await prisma.users.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } })
      : [];
    const byEmail = new Map(known.map((u) => [u.email.toLowerCase(), u.id]));

    return {
      total,
      page: p,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      counts: { all },
      /** Si es false, los leads nuevos se están omitiendo en silencio. */
      perfexEnabled: this.perfex.enabled,
      items: rows.map((s) => ({
        id: s.id,
        email: s.email,
        // null = del sistema viejo, que no guardaba la fecha.
        createdAt: s.created_at ? s.created_at.toISOString() : null,
        customerId: byEmail.get(s.email.toLowerCase()) ?? null,
      })),
    };
  }

  /**
   * Lista completa para exportar. Va aparte de la paginada a propósito: juntar 22
   * correos que no se pueden sacar del panel no sirve de nada, y el CSV lo arma el
   * navegador (el proxy del admin solo sabe reenviar JSON).
   */
  @Get('export')
  async export() {
    const rows = await prisma.subscribers.findMany({ orderBy: { id: 'desc' } });
    return rows.map((s) => ({ email: s.email, createdAt: s.created_at ? s.created_at.toISOString() : null }));
  }

  /**
   * Empuja TODOS los suscriptores a Perfex. Existía en `admin/perfex/sync-subscribers`
   * pero **sin botón en ningún lado**: los que ya estaban en la tabla cuando se conectó
   * Perfex nunca llegaban al CRM. Se expone aquí, junto a la lista que sincroniza.
   */
  @Post('sync')
  async sync() {
    if (!this.perfex.enabled) {
      return { ok: false, sent: 0, total: 0, message: 'Perfex no está configurado (faltan PERFEX_URL y PERFEX_TOKEN).' };
    }
    const subs = await prisma.subscribers.findMany();
    let sent = 0;
    for (const s of subs) {
      if (await this.perfex.pushLead({ name: s.email, email: s.email, source: 'Newsletter' })) sent++;
    }
    return { ok: true, total: subs.length, sent };
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await prisma.subscribers.delete({ where: { id } });
    return { ok: true };
  }
}
