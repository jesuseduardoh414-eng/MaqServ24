import {
  BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, Put, Query, Req, UseGuards,
} from '@nestjs/common';
import { asignarOperador, operadorDe } from '../providers/operador';
import { zTelefono } from '../common/campos';
import { registrarAccion } from './audit';
import { prisma } from '@maqserv/db';
import { z } from 'zod';
import { UNIDADES, unidadesDe, unidadPorDefectoDe, formatearCantidad } from '@maqserv/config';
import { AdminGuard, type AdminRequest, Modulo } from './admin-auth';
import { ServiceService } from '../quotes/service.service';
import { SUGERIDOS } from '../quoter/quoter-servicio';
import { ESTADOS, PASOS, esEstado, estadoInicial, siguientes, avance } from '../quotes/service-flow';
import { equiposDeServicios } from '../quotes/rastreo';

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
  quantity: z.number().positive().max(1_000_000).optional().nullable(),
  // Solo unidades conocidas (QA 2026-09-28: 'horas' se guardaba y el cliente veía el número sin unidad).
  unit: z.string().max(20).refine((u) => u in UNIDADES, 'Unidad desconocida').optional().nullable(),
  /** Al cancelar: quién lo canceló. Solo "aliado" le cuenta en contra. */
  causa: z.enum(['cliente', 'aliado', 'plataforma']).optional().nullable(),
});

const ofrecerSchema = z.object({
  providerId: z.number().int().positive(),
  scope: z.string().max(500).optional().nullable(),
});

const responderSchema = z.object({
  state: z.enum(['aceptado', 'rechazado', 'retirado']),
  reason: z.string().max(500).optional().nullable(),
});

@Modulo('servicios')
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
        total: true, accepted_at: true, address: true, requirements: true, product_interested: true,
        client_sites: { select: { name: true, municipality: true } },
      },
    });
    // Qué máquina lleva cada uno (2026-10-26, tarjeta corta): lo mismo que dice el mapa.
    const equipoDe = await equiposDeServicios(rows.map((r) => r.requirements));

    // Los aliados de cada servicio, de un solo viaje: uno por servicio serían
    // tantas consultas como filas tenga el tablero.
    const ids = rows.map((r) => r.id);
    const [asignaciones, notasSugeridos] = ids.length
      ? await Promise.all([
          prisma.service_assignments.findMany({
            where: { quote_id: { in: ids } },
            include: { providers: { select: { id: true, name: true, phone: true } } },
            orderBy: { id: 'asc' },
          }),
          // Quién tiene publicado el equipo pedido (lo anota QuoterServicio al
          // abrir el servicio). Se guardaba en el historial pero el tablero no
          // lo enseñaba, que era justo donde se decide a quién asignar.
          prisma.service_events.findMany({
            where: { quote_id: { in: ids }, note: { startsWith: SUGERIDOS } },
            select: { quote_id: true, note: true },
          }),
        ])
      : [[], []];
    const sugeridosDe = new Map(notasSugeridos.map((e) => [String(e.quote_id), (e.note ?? '').slice(SUGERIDOS.length).trim()]));
    // El nombre de la línea: "a 4 aliados de Materiales para construcción" se
    // lee; "materiales-para-construccion" no.
    const slugs = [...new Set(rows.map((r) => r.service_category).filter((c): c is string => !!c))];
    const nombreLinea = new Map(
      (slugs.length ? await prisma.categories.findMany({ where: { cat_slug: { in: slugs } }, select: { cat_slug: true, cat_name: true } }) : [])
        .map((c) => [c.cat_slug, c.cat_name]),
    );
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
        categoryName: q.service_category ? nombreLinea.get(q.service_category) ?? q.service_category : null,
        // El documento del que salió (2026-10-19): una cotización con varias
        // líneas abre un servicio por línea, y el tablero los junta por esto.
        folio: (() => { const f = (q.requirements as { folio?: unknown } | null)?.folio; return typeof f === 'string' && f ? f : null; })(),
        address: q.address,
        /** La obra, para la tarjeta corta (2026-10-26). */
        obra: q.client_sites ? [q.client_sites.name, q.client_sites.municipality].filter(Boolean).join(' · ') : null,
        /** La máquina o el material: de la cotización, o lo que pidió por el formulario. */
        equipo: equipoDe(q.requirements) ?? q.product_interested?.split(/ [·—] /).pop() ?? null,
        state: st,
        stateLabel: PASOS[st].label,
        stateHint: PASOS[st].hint,
        progress: avance(st),
        next: siguientes(st).map((s) => ({ state: s, label: PASOS[s].label })),
        units: unidadesDe(q.service_category).map((u) => ({ clave: u.clave, label: u.plural })),
        defaultUnit: q.service_unit ?? unidadPorDefectoDe(q.service_category),
        // Los días que se cotizaron ("3 días"): el cierre sale con eso ya puesto (2026-10-22).
        quotedDays: (() => { const d = parseInt(String((q.requirements as { duracion?: unknown } | null)?.duracion ?? ''), 10); return d > 0 ? d : null; })(),
        closed: q.service_quantity
          ? formatearCantidad(Number(q.service_quantity), q.service_unit)
          : null,
        total: Number(q.total),
        acceptedAt: q.accepted_at,
        suggested: sugeridosDe.get(String(q.id)) || null,
        startedAt: q.service_started_at,
        closedAt: q.service_closed_at,
        // Quién maneja la unidad (2026-10-15, ver providers/operador.ts).
        operator: (() => { const o = operadorDe(q.requirements); return o ? { name: o.nombre, phone: o.telefono } : null; })(),
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
      causa: b.causa,
    });
  }

  /**
   * El operador de la unidad y su enlace (2026-10-15). Normalmente lo pone el
   * aliado desde su portal; aquí, para cuando no lo hizo o lo pide por
   * teléfono. Volver a mandarlo invalida el enlace anterior.
   */
  /** El aliado se bajó a medio servicio: vuelve a Por asignar para buscar otro (2026-10-26). */
  @Post(':id/se-bajo')
  async seBajo(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @Req() req: AdminRequest) {
    const p = z.object({ nota: z.string().max(1000).optional().nullable() }).safeParse(body ?? {});
    if (!p.success) throw new BadRequestException('Datos inválidos');
    const r = await this.services.seBajoElAliado(id, { adminId: req.adminId, note: p.data.nota ?? null });
    void registrarAccion(req, 'servicios', 'aliado.se_bajo', String(id), p.data.nota ?? undefined);
    return r;
  }

  @Put(':id/operador')
  async operador(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @Req() req: AdminRequest) {
    const p = z.object({ nombre: z.string().trim().min(2, 'Escribe el nombre del operador').max(120), telefono: zTelefono().optional().nullable() }).safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.issues[0]?.message ?? 'Datos inválidos');
    const q = await prisma.quotes.findUnique({ where: { id }, select: { quote_number: true, service_state: true } });
    if (!q) throw new NotFoundException('Servicio no encontrado');
    if (!q.service_state || q.service_state === 'cerrado' || q.service_state === 'cancelado') throw new BadRequestException('Ese servicio no está en curso.');
    const r = await asignarOperador(id, { nombre: p.data.nombre, telefono: p.data.telefono ?? null });
    await registrarAccion(req, 'servicios', 'servicio.operador', q.quote_number, `${r.operador.nombre}${r.operador.telefono ? ` · ${r.operador.telefono}` : ''}`);
    return r;
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
   * MANDAR A TODOS (2026-10-23). Ya nada sale solo cuando el cliente acepta:
   * desde "Buscar aliado" se le ofrece a uno, a varios o, con esto, a todos los
   * que llegan a la obra (primero los que tienen ese tipo). El primero que
   * acepta se la queda. `motivo` dice por qué no salió a nadie.
   */
  /** A quiénes les llegaría "Mandar a todos", sin mandar nada: la pantalla lo enseña antes de confirmar. */
  @Get(':id/ofrecer-todos')
  async candidatosATodos(@Param('id', ParseIntPipe) id: number) {
    const r = await this.services.ofrecerATodos(id, { soloVer: true });
    return { candidatos: r.ofrecidos, motivo: r.motivo };
  }

  @Post(':id/ofrecer-todos')
  async ofrecerATodos(@Param('id', ParseIntPipe) id: number, @Req() req: AdminRequest) {
    const q = await prisma.quotes.findUnique({ where: { id }, select: { quote_number: true, service_state: true } });
    if (!q) throw new NotFoundException('Servicio no encontrado');
    if (q.service_state !== 'por_asignar') throw new BadRequestException('Solo se manda a todos un servicio por asignar.');
    const r = await this.services.ofrecerATodos(id, { adminId: req.adminId ?? null });
    if (r.ofrecidos.length) {
      await registrarAccion(req, 'servicios', 'servicio.ofrecer_todos', q.quote_number, r.ofrecidos.join(', '));
    }
    return { ofrecidos: r.ofrecidos, motivo: r.motivo };
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
