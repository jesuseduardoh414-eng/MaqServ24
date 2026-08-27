import {
  BadRequestException, Body, Controller, Delete, Get, NotFoundException,
  Param, ParseIntPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { z } from 'zod';
import { AdminGuard } from './admin-auth';
import { esEstado, PASOS } from '../quotes/service-flow';
import { FreightService } from '../freight/freight.service';

/**
 * CLIENTES Y OBRAS (documento institucional, sección 17 · Módulo Clientes).
 *
 * "Clientes: datos, obras, contactos, requisitos y comportamiento."
 *
 * CLIENTE no es lo mismo que USUARIO. `users` son cuentas que entran al sitio;
 * de las cotizaciones que hay, la gran mayoría las hizo alguien sin
 * registrarse. El cliente es la empresa que contrata, y existe tenga cuenta o
 * no. Por eso este controlador va aparte de `admin-customers`, que sigue
 * atendiendo las cuentas.
 */

const clienteSchema = z.object({
  name: z.string().min(2).max(190),
  email: z.string().max(190).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  rfc: z.string().max(20).optional().nullable(),
  industry: z.string().max(120).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  status: z.coerce.number().int().min(0).max(1).optional(),
});

const obraSchema = z.object({
  name: z.string().min(2).max(190),
  address: z.string().max(500).optional().nullable(),
  municipality: z.string().max(120).optional().nullable(),
  state: z.string().max(120).optional().nullable(),
  contactName: z.string().max(190).optional().nullable(),
  contactPhone: z.string().max(40).optional().nullable(),
  /** Lo que ESA obra exige: inducción, seguro del operador, torreta. */
  requirements: z.array(z.string().max(160)).max(30).optional(),
  notes: z.string().max(4000).optional().nullable(),
  status: z.coerce.number().int().min(0).max(1).optional(),
});

const vacio = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

@Controller('admin/clients')
@UseGuards(AdminGuard)
export class AdminClientsController {
  constructor(private readonly freight: FreightService) {}

  @Get()
  async list(@Query('search') search?: string) {
    const term = search?.trim();
    const clientes = await prisma.clients.findMany({
      where: term
        ? {
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              { email: { contains: term, mode: 'insensitive' } },
              { rfc: { contains: term, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: [{ status: 'desc' }, { name: 'asc' }],
      take: 300,
    });
    if (clientes.length === 0) return [];

    // Obras y solicitudes de todos, en dos consultas. Una por cliente serían
    // trescientos viajes para pintar una lista.
    const ids = clientes.map((c) => c.id);
    const [obras, solicitudes] = await Promise.all([
      prisma.client_sites.groupBy({
        by: ['client_id'],
        where: { client_id: { in: ids }, status: 1 },
        _count: { _all: true },
      }),
      prisma.quotes.groupBy({
        by: ['client_id'],
        where: { client_id: { in: ids } },
        _count: { _all: true },
        _sum: { total: true },
        _max: { created_at: true },
      }),
    ]);
    const porObras = new Map(obras.map((o) => [o.client_id, o._count._all]));
    const porSolic = new Map(solicitudes.map((s) => [s.client_id, s]));

    return clientes.map((c) => {
      const s = porSolic.get(c.id);
      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        rfc: c.rfc,
        industry: c.industry,
        status: c.status,
        hasAccount: c.user_id !== null,
        sites: porObras.get(c.id) ?? 0,
        quotes: s?._count._all ?? 0,
        quoted: s?._sum.total ? Number(s._sum.total) : 0,
        lastAt: s?._max.created_at ?? null,
      };
    });
  }

  /** Ficha del cliente: sus obras y lo que se le ha servido en cada una. */
  @Get(':id')
  async detail(@Param('id', ParseIntPipe) id: number) {
    const cliente = await prisma.clients.findUnique({
      where: { id },
      include: { client_sites: { orderBy: [{ status: 'desc' }, { name: 'asc' }] } },
    });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');

    const solicitudes = await prisma.quotes.findMany({
      where: { client_id: id },
      orderBy: { id: 'desc' },
      take: 100,
      select: {
        id: true, quote_number: true, site_id: true, service_category: true,
        total: true, status: true, service_state: true, created_at: true,
        accepted_at: true,
      },
    });

    const porObra = new Map<number, typeof solicitudes>();
    for (const q of solicitudes) {
      if (q.site_id === null) continue;
      porObra.set(q.site_id, [...(porObra.get(q.site_id) ?? []), q]);
    }

    const aFila = (q: (typeof solicitudes)[number]) => ({
      id: Number(q.id),
      quoteNumber: q.quote_number,
      category: q.service_category,
      total: Number(q.total),
      status: q.status,
      serviceState: q.service_state,
      // La etiqueta sale del mismo lugar que el tablero: dos textos para el
      // mismo estado se desincronizan en cuanto alguien cambia uno.
      serviceLabel: esEstado(q.service_state) ? PASOS[q.service_state].label : null,
      createdAt: q.created_at,
      acceptedAt: q.accepted_at,
    });

    return {
      id: cliente.id,
      name: cliente.name,
      email: cliente.email,
      phone: cliente.phone,
      rfc: cliente.rfc,
      industry: cliente.industry,
      notes: cliente.notes,
      status: cliente.status,
      hasAccount: cliente.user_id !== null,
      sites: cliente.client_sites.map((s) => ({
        id: s.id,
        name: s.name,
        address: s.address,
        municipality: s.municipality,
        state: s.state,
        lat: s.lat != null ? Number(s.lat) : null,
        lng: s.lng != null ? Number(s.lng) : null,
        contactName: s.contact_name,
        contactPhone: s.contact_phone,
        requirements: s.requirements,
        notes: s.notes,
        status: s.status,
        history: (porObra.get(s.id) ?? []).map(aFila),
      })),
      // Las que no tienen obra: son las de antes de que existieran las obras, o
      // solicitudes sin dirección. Se muestran para que no desaparezcan.
      unassigned: solicitudes.filter((q) => q.site_id === null).map(aFila),
    };
  }

  @Post()
  async create(@Body() body: unknown) {
    const p = clienteSchema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.issues[0]?.message ?? 'Datos inválidos');
    const d = p.data;
    return prisma.clients.create({
      data: {
        name: d.name.trim(),
        email: vacio(d.email),
        phone: vacio(d.phone),
        rfc: vacio(d.rfc),
        industry: vacio(d.industry),
        notes: vacio(d.notes),
        status: d.status ?? 1,
      },
    });
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const p = clienteSchema.partial().safeParse(body);
    if (!p.success) throw new BadRequestException('Datos inválidos');
    const d = p.data;
    return prisma.clients.update({
      where: { id },
      data: {
        ...(d.name !== undefined ? { name: d.name.trim() } : {}),
        ...(d.email !== undefined ? { email: vacio(d.email) } : {}),
        ...(d.phone !== undefined ? { phone: vacio(d.phone) } : {}),
        ...(d.rfc !== undefined ? { rfc: vacio(d.rfc) } : {}),
        ...(d.industry !== undefined ? { industry: vacio(d.industry) } : {}),
        ...(d.notes !== undefined ? { notes: vacio(d.notes) } : {}),
        ...(d.status !== undefined ? { status: d.status } : {}),
        updated_at: new Date(),
      },
    });
  }

  // ── Obras ──────────────────────────────────────────────────────────────

  @Post(':id/sites')
  async createSite(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const p = obraSchema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.issues[0]?.message ?? 'Datos inválidos');
    const d = p.data;
    const cliente = await prisma.clients.findUnique({ where: { id }, select: { id: true } });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');

    return prisma.client_sites.create({
      data: {
        client_id: id,
        name: d.name.trim(),
        address: vacio(d.address),
        municipality: vacio(d.municipality),
        state: vacio(d.state),
        contact_name: vacio(d.contactName),
        contact_phone: vacio(d.contactPhone),
        requirements: (d.requirements ?? []).map((r) => r.trim()).filter(Boolean),
        notes: vacio(d.notes),
        status: d.status ?? 1,
      },
    });
  }

  @Patch('sites/:siteId')
  async updateSite(@Param('siteId', ParseIntPipe) siteId: number, @Body() body: unknown) {
    const p = obraSchema.partial().safeParse(body);
    if (!p.success) throw new BadRequestException('Datos inválidos');
    const d = p.data;
    return prisma.client_sites.update({
      where: { id: siteId },
      data: {
        ...(d.name !== undefined ? { name: d.name.trim() } : {}),
        ...(d.address !== undefined ? { address: vacio(d.address) } : {}),
        ...(d.municipality !== undefined ? { municipality: vacio(d.municipality) } : {}),
        ...(d.state !== undefined ? { state: vacio(d.state) } : {}),
        ...(d.contactName !== undefined ? { contact_name: vacio(d.contactName) } : {}),
        ...(d.contactPhone !== undefined ? { contact_phone: vacio(d.contactPhone) } : {}),
        ...(d.requirements !== undefined
          ? { requirements: d.requirements.map((r) => r.trim()).filter(Boolean) }
          : {}),
        ...(d.notes !== undefined ? { notes: vacio(d.notes) } : {}),
        ...(d.status !== undefined ? { status: d.status } : {}),
        updated_at: new Date(),
      },
    });
  }

  /**
   * Dar de baja una obra NO la borra: sus solicitudes son el historial del
   * cliente, y borrarla los dejaría huérfanos. Se apaga y deja de proponerse.
   */
  @Delete('sites/:siteId')
  async archiveSite(@Param('siteId', ParseIntPipe) siteId: number) {
    await prisma.client_sites.update({
      where: { id: siteId },
      data: { status: 0, updated_at: new Date() },
    });
    return { ok: true };
  }

  /**
   * Poner la obra en el mapa.
   *
   * Es la otra mitad de la cobertura por distancia: sin el punto de la obra,
   * el radio del aliado no tiene contra qué medirse y todo vuelve a decidirse
   * por el nombre del municipio.
   */
  @Post('sites/:siteId/geocodificar')
  async geocodificarObra(@Param('siteId', ParseIntPipe) siteId: number) {
    const s = await prisma.client_sites.findUnique({
      where: { id: siteId },
      select: { name: true, address: true, municipality: true, state: true },
    });
    if (!s) throw new NotFoundException('Obra no encontrada');

    const consulta = [s.address, s.municipality, s.state].map((x) => x?.trim()).filter(Boolean).join(', ');
    if (!consulta) throw new BadRequestException('Sin dirección ni municipio no hay a dónde ubicarla.');

    const punto = await this.freight.geocode(consulta);
    if (!punto) {
      return {
        ok: false,
        mensaje: `No encontramos "${consulta}". Prueba con calle y municipio nada más.`,
      };
    }

    await prisma.client_sites.update({
      where: { id: siteId },
      data: { lat: punto.lat, lng: punto.lon, updated_at: new Date() },
    });
    return { ok: true, lat: punto.lat, lng: punto.lon, mensaje: `${s.name} quedó ubicada.` };
  }

  /** Mover una solicitud suelta a una obra. Es cómo se limpia el histórico. */
  @Patch('quotes/:quoteId/site')
  async assignQuote(@Param('quoteId', ParseIntPipe) quoteId: number, @Body() body: unknown) {
    const p = z.object({ siteId: z.number().int().positive().nullable() }).safeParse(body);
    if (!p.success) throw new BadRequestException('Datos inválidos');

    const site = p.data.siteId
      ? await prisma.client_sites.findUnique({ where: { id: p.data.siteId }, select: { client_id: true } })
      : null;
    if (p.data.siteId && !site) throw new NotFoundException('Obra no encontrada');

    await prisma.quotes.update({
      where: { id: quoteId },
      data: {
        site_id: p.data.siteId,
        // Mover a una obra implica el cliente de esa obra: dejarlos
        // desalineados haría que la solicitud saliera en una ficha y no en la otra.
        ...(site ? { client_id: site.client_id } : {}),
        updated_at: new Date(),
      },
    });
    return { ok: true };
  }
}
