import {
  BadRequestException, Body, Controller, Delete, Get, NotFoundException,
  Param, ParseIntPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { Prisma, prisma } from '@maqserv/db';
import { z } from 'zod';
import { zCorreo, zRfc, zTelefono } from '../common/campos';
import { AdminGuard, Modulo } from './admin-auth';
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
  email: zCorreo().optional().nullable(),
  phone: zTelefono().optional().nullable(),
  rfc: zRfc().optional().nullable(),
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
  contactPhone: zTelefono().optional().nullable(),
  /** Lo que ESA obra exige: inducción, seguro del operador, torreta. */
  requirements: z.array(z.string().max(160)).max(30).optional(),
  notes: z.string().max(4000).optional().nullable(),
  status: z.coerce.number().int().min(0).max(1).optional(),
});

const vacio = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/**
 * DE DÓNDE VINO CADA CLIENTE (2026-10-15).
 *
 * "web": se registró en el sitio, o pidió algo desde el sitio aunque fuera sin
 * cuenta (el sistema anterior lo permitía). "panel": lo dieron de alta aquí o
 * sólo se le ha cotizado por teléfono (`requirements.origen = 'panel'`).
 * Se deduce, no se guarda: así sale bien también para los clientes de antes.
 */
type Origen = 'web' | 'panel';

async function conPedidoWeb(ids: number[]): Promise<Set<number>> {
  if (ids.length === 0) return new Set();
  const filas = await prisma.$queryRaw<Array<{ client_id: number }>>`
    SELECT DISTINCT client_id FROM quotes
    WHERE client_id IN (${Prisma.join(ids)})
      AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(requirements, '$.origen')), '') <> 'panel'`;
  return new Set(filas.map((f) => Number(f.client_id)));
}

const origenDe = (userId: number | null, web: Set<number>, id: number): Origen =>
  userId !== null || web.has(id) ? 'web' : 'panel';

/**
 * El nombre de la línea de cada solicitud (2026-10-23): el historial enseñaba
 * el slug ("transporte-y-servicios-de-obra"). Sin línea es una del formulario
 * a la medida.
 */
async function nombresDeLinea(slugs: Array<string | null>): Promise<Map<string, string>> {
  const unicos = [...new Set(slugs.filter((s): s is string => !!s))];
  if (unicos.length === 0) return new Map();
  const cats = await prisma.categories.findMany({ where: { cat_slug: { in: unicos } }, select: { cat_slug: true, cat_name: true } });
  return new Map(cats.map((c) => [c.cat_slug, c.cat_name]));
}

@Modulo('clientes')
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
              { name: { contains: term } },
              { email: { contains: term } },
              { rfc: { contains: term } },
            ],
          }
        : undefined,
      orderBy: [{ status: 'desc' }, { name: 'asc' }],
      // Desde que cada cuenta del sitio es cliente (2026-10-15) son muchos más;
      // la búsqueda del panel filtra sobre esta lista, así que no se recorta.
      take: 3000,
    });
    if (clientes.length === 0) return [];

    // Obras y solicitudes de todos, en dos consultas. Una por cliente serían
    // trescientos viajes para pintar una lista.
    const ids = clientes.map((c) => c.id);
    // Una cuenta del sitio puede tener varias empresas (2026-10-23): la lista
    // dice de quién es cada una para que se lea cuenta → empresas → obras.
    const idsCuentas = [...new Set(clientes.map((c) => c.user_id).filter((u): u is number => u !== null))];
    const [obras, solicitudes, web, cuentas] = await Promise.all([
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
      conPedidoWeb(ids),
      idsCuentas.length
        ? prisma.users.findMany({ where: { id: { in: idsCuentas } }, select: { id: true, name: true, email: true } })
        : Promise.resolve([]),
    ]);
    const porObras = new Map(obras.map((o) => [o.client_id, o._count._all]));
    const porSolic = new Map(solicitudes.map((s) => [s.client_id, s]));
    const porCuenta = new Map(cuentas.map((u) => [u.id, u]));
    const empresasDe = new Map<number, number>();
    for (const c of clientes) if (c.user_id !== null) empresasDe.set(c.user_id, (empresasDe.get(c.user_id) ?? 0) + 1);

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
        account: c.user_id !== null && porCuenta.has(c.user_id)
          ? { id: c.user_id, name: porCuenta.get(c.user_id)!.name, email: porCuenta.get(c.user_id)!.email, empresas: empresasDe.get(c.user_id) ?? 1 }
          : null,
        origin: origenDe(c.user_id, web, c.id),
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

    // La cuenta del sitio ligada, para saber quién entra por ese cliente.
    const [cuenta, web, otras] = await Promise.all([
      cliente.user_id
        ? prisma.users.findUnique({ where: { id: cliente.user_id }, select: { id: true, name: true, email: true, created_at: true } })
        : null,
      conPedidoWeb([id]),
      // Las demás empresas de la misma cuenta (2026-10-23): una cuenta puede pedir para varias.
      cliente.user_id
        ? prisma.clients.findMany({
            where: { user_id: cliente.user_id, id: { not: id } },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, status: true, _count: { select: { client_sites: { where: { status: 1 } } } } },
          })
        : Promise.resolve([]),
    ]);

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

    const lineas = await nombresDeLinea(solicitudes.map((q) => q.service_category));
    const porObra = new Map<number, typeof solicitudes>();
    for (const q of solicitudes) {
      if (q.site_id === null) continue;
      porObra.set(q.site_id, [...(porObra.get(q.site_id) ?? []), q]);
    }

    const aFila = (q: (typeof solicitudes)[number]) => ({
      id: Number(q.id),
      quoteNumber: q.quote_number,
      // El nombre de la línea, no el slug; sin línea es del formulario (2026-10-23).
      category: q.service_category ? lineas.get(q.service_category) ?? q.service_category : 'Formulario',
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
      account: cuenta ? { id: cuenta.id, name: cuenta.name, email: cuenta.email, createdAt: cuenta.created_at } : null,
      otherClients: otras.map((o) => ({ id: o.id, name: o.name, status: o.status, sites: o._count.client_sites })),
      origin: origenDe(cliente.user_id, web, id),
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
      // Las que no tienen obra: desde el 2026-10-23 toda solicitud nueva exige
      // obra, así que aquí solo quedan viejas. Se muestran para moverlas.
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
    if (!p.success) throw new BadRequestException(p.error.issues[0]?.message ?? 'Datos inválidos');
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
