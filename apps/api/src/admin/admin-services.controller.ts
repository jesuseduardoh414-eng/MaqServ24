import {
  Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { z } from 'zod';
import { unidadesDe, unidadPorDefectoDe, formatearCantidad } from '@maqserv/config';
import { AdminGuard, type AdminRequest } from './admin-auth';
import { ServiceService } from '../quotes/service.service';
import { ESTADOS, PASOS, esEstado, estadoInicial, siguientes, avance } from '../quotes/service-flow';

/**
 * TABLERO DE OPERACIONES (documento institucional, secciones 16 y 17).
 *
 * "Asignaciones, estatus, agenda, incidencias y cierre." Es donde se ve qué
 * servicios están vivos y en qué van, después de que el cliente aceptó.
 *
 * Va aparte de `admin-ops` a propósito, igual que el de envíos: el estatus del
 * servicio SOLO se mueve por `ServiceService.mover()`. Si se pudiera tocar
 * desde varios lados, el historial dejaría de ser confiable — y el historial es
 * el punto.
 */

const moverSchema = z.object({
  state: z.enum(ESTADOS),
  note: z.string().max(1000).optional().nullable(),
  quantity: z.number().positive().optional().nullable(),
  unit: z.string().max(20).optional().nullable(),
});

const ofrecerSchema = z.object({
  providerId: z.number().int().positive(),
  scope: z.string().max(500).optional().nullable(),
});

const responderSchema = z.object({
  state: z.enum(['aceptado', 'rechazado', 'retirado']),
  reason: z.string().max(500).optional().nullable(),
});

@Controller('admin/services')
@UseGuards(AdminGuard)
export class AdminServicesController {
  constructor(private readonly services: ServiceService) {}

  /**
   * Los servicios vivos. Por defecto NO trae los cerrados ni los cancelados:
   * el tablero es para lo que hay que atender hoy, no para el archivo.
   */
  @Get()
  async listar(@Query('estado') estado?: string, @Query('todos') todos?: string) {
    const where = estado && esEstado(estado)
      ? { service_state: estado }
      : todos === '1'
        ? { service_state: { not: null } }
        : { service_state: { notIn: ['cerrado', 'cancelado'] as string[] } };

    const rows = await prisma.quotes.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      take: 200,
      select: {
        id: true, quote_number: true, name: true, company_name: true, phone: true,
        service_category: true, service_state: true, service_unit: true,
        service_quantity: true, service_started_at: true, service_closed_at: true,
        total: true, accepted_at: true, address: true, requirements: true,
      },
    });

    // Los aliados de cada servicio, de un solo viaje: uno por servicio serían
    // tantas consultas como filas tenga el tablero.
    const ids = rows.map((r) => r.id);
    const asignaciones = ids.length
      ? await prisma.service_assignments.findMany({
          where: { quote_id: { in: ids } },
          include: { providers: { select: { id: true, name: true, phone: true } } },
          orderBy: { id: 'asc' },
        })
      : [];
    const porServicio = new Map<string, typeof asignaciones>();
    for (const a of asignaciones) {
      const k = String(a.quote_id);
      porServicio.set(k, [...(porServicio.get(k) ?? []), a]);
    }

    return rows.map((q) => {
      const st = esEstado(q.service_state) ? q.service_state : estadoInicial();
      const mias = porServicio.get(String(q.id)) ?? [];
      return {
        id: Number(q.id),
        quoteNumber: q.quote_number,
        client: q.company_name || q.name,
        phone: q.phone,
        category: q.service_category,
        address: q.address,
        state: st,
        stateLabel: PASOS[st].label,
        stateHint: PASOS[st].hint,
        progress: avance(st),
        next: siguientes(st).map((s) => ({ state: s, label: PASOS[s].label })),
        units: unidadesDe(q.service_category).map((u) => ({ clave: u.clave, label: u.plural })),
        defaultUnit: q.service_unit ?? unidadPorDefectoDe(q.service_category),
        closed: q.service_quantity
          ? formatearCantidad(Number(q.service_quantity), q.service_unit)
          : null,
        total: Number(q.total),
        acceptedAt: q.accepted_at,
        startedAt: q.service_started_at,
        closedAt: q.service_closed_at,
        assignments: mias.map((a) => ({
          id: a.id,
          providerId: a.providers.id,
          provider: a.providers.name,
          phone: a.providers.phone,
          state: a.state,
          scope: a.scope,
          reason: a.reason,
          offeredAt: a.offered_at,
          respondedAt: a.responded_at,
        })),
      };
    });
  }

  /** Historial completo de un servicio. Es la "trazabilidad" del documento. */
  @Get(':id/historial')
  historial(@Param('id', ParseIntPipe) id: number) {
    return this.services.historial(id);
  }

  @Patch(':id')
  async mover(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @Req() req: AdminRequest,
  ) {
    const b = moverSchema.parse(body);
    return this.services.mover(id, b.state, {
      adminId: req.adminId,
      note: b.note,
      quantity: b.quantity,
      unit: b.unit,
    });
  }

  @Post(':id/ofrecer')
  async ofrecer(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @Req() req: AdminRequest,
  ) {
    const b = ofrecerSchema.parse(body);
    await this.services.ofrecer(id, b.providerId, { scope: b.scope, adminId: req.adminId });
    return { ok: true };
  }

  /**
   * La respuesta del aliado. Hoy la captura operaciones después de la llamada;
   * cuando exista el acceso del proveedor, la contestará él mismo y este
   * endpoint no cambia.
   */
  @Patch('asignaciones/:assignmentId')
  async responder(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Body() body: unknown,
    @Req() req: AdminRequest,
  ) {
    const b = responderSchema.parse(body);
    return this.services.responder(assignmentId, b.state, { reason: b.reason, adminId: req.adminId });
  }
}
