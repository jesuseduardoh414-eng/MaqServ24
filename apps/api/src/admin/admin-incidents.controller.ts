import {
  BadRequestException, Body, Controller, Get, NotFoundException,
  Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { z } from 'zod';
import { AdminGuard, type AdminRequest } from './admin-auth';
import { CATALOGO, RESPONSABLES, SEVERIDADES, TIPOS } from '../quotes/incidents';

/**
 * INCIDENCIAS DE CAMPO (documento institucional, sección 30).
 *
 * "Registro, evidencias, responsables, escalamiento y cierre." Una máquina que
 * llega tarde, una unidad que falla a media jornada, un acceso que no permitió
 * entrar: hoy eso vive en llamadas y desaparece. Lo que no se registra no se
 * puede corregir, y lo que no se puede corregir se repite.
 */

const abrirSchema = z.object({
  quoteId: z.number().int().positive(),
  kind: z.enum(TIPOS),
  severity: z.enum(SEVERIDADES).optional(),
  responsible: z.enum(RESPONSABLES).optional(),
  description: z.string().min(4).max(4000),
  evidence: z.array(z.string().max(500)).max(12).optional(),
});

const cerrarSchema = z.object({
  resolution: z.string().min(4).max(4000),
  /** Al cerrar se puede corregir de quién fue: al abrir no siempre se sabe. */
  responsible: z.enum(RESPONSABLES).optional(),
});

@Controller('admin/incidencias')
@UseGuards(AdminGuard)
export class AdminIncidentsController {
  /** El catálogo, para que la pantalla no lo repita y no se desincronicen. */
  @Get('catalogo')
  catalogo() {
    return {
      tipos: Object.values(CATALOGO),
      severidades: SEVERIDADES,
      responsables: RESPONSABLES,
    };
  }

  @Get()
  async list(@Query('estado') estado?: string, @Query('quoteId') quoteId?: string) {
    const where: Record<string, unknown> = {};
    // Por defecto, sólo las abiertas: una lista de incidencias cerradas es un
    // archivo, y lo que hace falta ver es lo que sigue sin resolverse.
    if (estado === 'todas') delete where.state;
    else where.state = estado === 'cerrada' ? 'cerrada' : 'abierta';
    if (quoteId) where.quote_id = Number(quoteId);

    const rows = await prisma.service_incidents.findMany({
      where,
      orderBy: [{ state: 'asc' }, { opened_at: 'desc' }],
      take: 200,
      include: {
        providers: { select: { id: true, name: true } },
        quotes: { select: { quote_number: true, service_category: true, company_name: true, name: true } },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      quoteId: Number(r.quote_id),
      quoteNumber: r.quotes.quote_number,
      cliente: r.quotes.company_name || r.quotes.name,
      categoria: r.quotes.service_category,
      provider: r.providers ? { id: r.providers.id, name: r.providers.name } : null,
      kind: r.kind,
      kindLabel: CATALOGO[r.kind as keyof typeof CATALOGO]?.label ?? r.kind,
      severity: r.severity,
      responsible: r.responsible,
      description: r.description,
      evidence: r.evidence,
      state: r.state,
      resolution: r.resolution,
      openedAt: r.opened_at,
      closedAt: r.closed_at,
    }));
  }

  @Post()
  async abrir(@Body() body: unknown, @Req() req: AdminRequest) {
    const p = abrirSchema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.issues[0]?.message ?? 'Datos inválidos');
    const d = p.data;

    const q = await prisma.quotes.findUnique({
      where: { id: d.quoteId },
      select: { id: true, quote_number: true },
    });
    if (!q) throw new NotFoundException('Servicio no encontrado');

    // Qué aliado estaba atendiendo cuando pasó. Se resuelve aquí y no se pide:
    // quien captura la incidencia está pensando en lo que pasó, no en a quién
    // se le había asignado.
    const asignado = await prisma.service_assignments.findFirst({
      where: { quote_id: d.quoteId, state: 'aceptado' },
      select: { provider_id: true },
      orderBy: { id: 'desc' },
    });

    const inc = await prisma.service_incidents.create({
      data: {
        quote_id: d.quoteId,
        provider_id: asignado?.provider_id ?? null,
        kind: d.kind,
        severity: d.severity ?? 'media',
        // Ver decisión 1 en `incidents.ts`: "nadie" por defecto, a propósito.
        responsible: d.responsible ?? 'nadie',
        description: d.description.trim(),
        evidence: d.evidence ?? [],
        opened_by: req.adminId ?? null,
      },
    });

    // Queda en el historial del servicio: la trazabilidad tiene que poder
    // reconstruir qué pasó, y una incidencia es parte de lo que pasó.
    await prisma.service_events.create({
      data: {
        quote_id: d.quoteId,
        admin_id: req.adminId ?? null,
        to_state: 'incidencia',
        note: `${CATALOGO[d.kind].label}: ${d.description.trim().slice(0, 200)}`,
      },
    });

    return { id: inc.id, ok: true };
  }

  @Patch(':id/cerrar')
  async cerrar(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @Req() req: AdminRequest,
  ) {
    const p = cerrarSchema.safeParse(body);
    if (!p.success) throw new BadRequestException('Escribe cómo se resolvió.');

    const inc = await prisma.service_incidents.findUnique({ where: { id } });
    if (!inc) throw new NotFoundException('Incidencia no encontrada');
    if (inc.state === 'cerrada') throw new BadRequestException('Esta incidencia ya estaba cerrada.');

    await prisma.service_incidents.update({
      where: { id },
      data: {
        state: 'cerrada',
        resolution: p.data.resolution.trim(),
        ...(p.data.responsible ? { responsible: p.data.responsible } : {}),
        closed_by: req.adminId ?? null,
        closed_at: new Date(),
      },
    });

    await prisma.service_events.create({
      data: {
        quote_id: inc.quote_id,
        admin_id: req.adminId ?? null,
        to_state: 'incidencia_cerrada',
        note: p.data.resolution.trim().slice(0, 200),
      },
    });

    return { ok: true };
  }

  @Patch(':id')
  async actualizar(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const p = z
      .object({
        severity: z.enum(SEVERIDADES).optional(),
        responsible: z.enum(RESPONSABLES).optional(),
        description: z.string().min(4).max(4000).optional(),
        evidence: z.array(z.string().max(500)).max(12).optional(),
      })
      .safeParse(body);
    if (!p.success) throw new BadRequestException('Datos inválidos');
    const d = p.data;

    await prisma.service_incidents.update({
      where: { id },
      data: {
        ...(d.severity ? { severity: d.severity } : {}),
        ...(d.responsible ? { responsible: d.responsible } : {}),
        ...(d.description ? { description: d.description.trim() } : {}),
        ...(d.evidence ? { evidence: d.evidence } : {}),
      },
    });
    return { ok: true };
  }
}
