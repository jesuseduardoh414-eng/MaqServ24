import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { AdminGuard } from './admin-auth';
import { PerfexService } from '../integrations/integrations.module';

/**
 * Clientes → Mensajes: la bandeja del formulario de /contacto.
 *
 * Existe porque esos mensajes NO se guardaban: el sitio los empujaba a Perfex y,
 * con el CRM sin credenciales, se perdían dándole al visitante un acuse de
 * recibo falso. Ahora se guardan siempre y el CRM es el destino secundario.
 *
 * La pantalla se ordena por lo que importa operativamente —cuántos esperan
 * respuesta— y no por el total histórico.
 */
const PAGE_SIZE = 20;
const ESTADOS = ['nuevo', 'atendido', 'archivado'] as const;
type Estado = (typeof ESTADOS)[number];

@Controller('admin/contact-messages')
@UseGuards(AdminGuard)
export class AdminContactController {
  constructor(private readonly perfex: PerfexService) {}

  @Get()
  async list(@Query('page') page?: string, @Query('search') search?: string, @Query('state') state?: string) {
    const p = Math.max(1, Number(page ?? 1) || 1);
    const term = search?.trim();
    const estado = ESTADOS.includes(state as Estado) ? (state as Estado) : null;

    // `mode: 'insensitive'`: en Postgres `contains` distingue mayúsculas.
    const ci = (v: string) => ({ contains: v, mode: 'insensitive' as const });
    const where = {
      ...(estado ? { state: estado } : {}),
      ...(term ? { OR: [{ name: ci(term) }, { email: ci(term) }, { company: ci(term) }, { message: ci(term) }] } : {}),
    };

    const [total, rows, nuevos, atendidos, archivados, sinSubir] = await Promise.all([
      prisma.contact_messages.count({ where }),
      prisma.contact_messages.findMany({ where, orderBy: { id: 'desc' }, skip: (p - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      prisma.contact_messages.count({ where: { state: 'nuevo' } }),
      prisma.contact_messages.count({ where: { state: 'atendido' } }),
      prisma.contact_messages.count({ where: { state: 'archivado' } }),
      prisma.contact_messages.count({ where: { crm_pushed: false } }),
    ]);

    // ¿El que escribió ya es cliente registrado? Distingue un desconocido de
    // alguien que ya te compra. `contact_messages` no tiene FK a `users` (el
    // esquema legacy no tiene relaciones), así que se cruza por correo.
    const emails = rows.map((m) => m.email);
    const known = emails.length
      ? await prisma.users.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } })
      : [];
    const byEmail = new Map(known.map((u) => [u.email.toLowerCase(), u.id]));

    return {
      total,
      page: p,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      counts: { nuevos, atendidos, archivados, sinSubir },
      /** Si es false, los leads nuevos no están llegando al CRM. */
      perfexEnabled: this.perfex.enabled,
      items: rows.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        phone: m.phone,
        company: m.company,
        need: m.need,
        message: m.message,
        state: m.state,
        handledBy: m.handled_by,
        handledAt: m.handled_at ? m.handled_at.toISOString() : null,
        crmPushed: m.crm_pushed,
        createdAt: m.created_at.toISOString(),
        customerId: byEmail.get(m.email.toLowerCase()) ?? null,
      })),
    };
  }

  /** Mueve un mensaje entre nuevo / atendido / archivado. */
  @Patch(':id')
  async setState(@Param('id', ParseIntPipe) id: number, @Body() body: { state?: string; handledBy?: string }) {
    const estado = body?.state;
    if (!ESTADOS.includes(estado as Estado)) throw new BadRequestException('Estado no válido');
    // Se sella quién atendió y cuándo: sin eso, dos personas contestan el mismo
    // mensaje. Al devolverlo a 'nuevo' se limpia, porque vuelve a estar libre.
    const atendido = estado !== 'nuevo';
    await prisma.contact_messages.update({
      where: { id },
      data: {
        state: estado,
        handled_by: atendido ? (body?.handledBy?.trim() || 'Panel').slice(0, 190) : null,
        handled_at: atendido ? new Date() : null,
      },
    });
    return { ok: true };
  }

  /**
   * Empuja al CRM los mensajes que quedaron sin subir. Es el equivalente al
   * botón de suscriptores: cuando Perfex se configure, el atraso no se queda
   * fuera solo por haber llegado antes que las credenciales.
   */
  @Post('sync')
  async sync() {
    if (!this.perfex.enabled) {
      return { ok: false, sent: 0, total: 0, message: 'Perfex no está configurado (faltan PERFEX_URL y PERFEX_TOKEN).' };
    }
    const pend = await prisma.contact_messages.findMany({ where: { crm_pushed: false }, orderBy: { id: 'asc' } });
    let sent = 0;
    for (const m of pend) {
      const ok = await this.perfex.pushLead({
        name: m.name,
        email: m.email,
        source: `Contacto web${m.need ? ` · ${m.need}` : ''}`,
      });
      if (ok) {
        await prisma.contact_messages.update({ where: { id: m.id }, data: { crm_pushed: true } });
        sent++;
      }
    }
    return { ok: true, total: pend.length, sent };
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await prisma.contact_messages.delete({ where: { id } });
    return { ok: true };
  }
}
