import { BadRequestException, Body, Controller, Get, NotFoundException, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { z } from 'zod';
import { lista } from '../common/json-list';
import { ServiceService } from '../quotes/service.service';
import { PASOS, esEstado, siguientes } from '../quotes/service-flow';
import { guardarUbicacion, obraDe } from '../quotes/rastreo';
import { OperadorGuard, operadorDe, type OperadorRequest } from './operador';
import { notasDe, pedidoDe } from './pedido';

/** Lo que el operador va marcando, en orden. Cerrar (con horas o viajes) sigue siendo de MAQSER24. */
const PASOS_OPERADOR = ['en_traslado', 'en_sitio', 'en_curso', 'terminado'] as const;

/**
 * EL ENLACE DEL OPERADOR (2026-10-15, ver operador.ts).
 *
 * UN servicio y nada más: a dónde va, con quién habla en la obra, qué le van a
 * pedir para entrar, cuándo tiene que llegar, y los botones para avisar que
 * salió, que llegó, que empezó y que terminó. Mientras va en camino, su
 * teléfono manda la ubicación: es la que ven el panel y el cliente. No ve
 * precios, ni otros servicios, ni nada del aliado.
 */
@Controller('operador')
@UseGuards(OperadorGuard)
export class OperadorController {
  constructor(private readonly services: ServiceService) {}

  @Get()
  async servicio(@Req() req: OperadorRequest) {
    const q = await prisma.quotes.findUnique({
      where: { id: BigInt(req.quoteId) },
      select: {
        id: true, quote_number: true, service_state: true, service_category: true, address: true, region: true,
        requirements: true, comments: true, product_interested: true,
        client_sites: { select: { name: true, address: true, municipality: true, state: true, lat: true, lng: true, contact_name: true, contact_phone: true, requirements: true } },
        service_assignments: { where: { state: 'aceptado' }, orderBy: { id: 'asc' }, take: 1, select: { committed_at: true, providers: { select: { name: true } } } },
      },
    });
    if (!q) throw new NotFoundException('Servicio no encontrado');
    const estado = esEstado(q.service_state) ? q.service_state : null;
    const obra = obraDe(q);
    const asignado = q.service_assignments[0];
    const equipo = await equipoDe(q.requirements, q.product_interested);
    return {
      folio: q.quote_number,
      estado,
      etapa: estado ? PASOS[estado].label : 'Por asignar',
      siguiente: estado ? siguientes(estado).filter((s) => (PASOS_OPERADOR as readonly string[]).includes(s)).slice(0, 1) : [],
      operador: operadorDe(q.requirements)?.nombre ?? null,
      aliado: asignado?.providers.name ?? null,
      llegada: asignado?.committed_at?.toISOString() ?? null,
      obra: obra ? { nombre: obra.nombre, direccion: obra.direccion, lat: obra.lat, lng: obra.lng, aproximada: obra.aproximada } : null,
      contacto: { nombre: q.client_sites?.contact_name ?? null, telefono: q.client_sites?.contact_phone ?? null },
      requisitos: lista(q.client_sites?.requirements),
      equipo,
      pedido: pedidoDe(q.service_category, q.requirements, q.comments),
      notas: notasDe(q.comments),
    };
  }

  @Patch('avance')
  async avance(@Req() req: OperadorRequest, @Body() body: unknown) {
    const p = z.object({ estado: z.enum(PASOS_OPERADOR) }).safeParse(body);
    if (!p.success) throw new BadRequestException('Paso inválido');
    const q = await prisma.quotes.findUnique({
      where: { id: BigInt(req.quoteId) },
      select: { requirements: true, service_assignments: { where: { state: 'aceptado' }, take: 1, select: { providers: { select: { name: true } } } } },
    });
    const operador = operadorDe(q?.requirements)?.nombre ?? 'El operador';
    const aliado = q?.service_assignments[0]?.providers.name;
    const quien = aliado ? `${operador} (operador de ${aliado})` : operador;
    return this.services.mover(req.quoteId, p.data.estado, { adminId: null, porAliado: quien, note: `Lo reportó ${quien} desde su enlace` });
  }

  @Post('ubicacion')
  async ubicacion(@Req() req: OperadorRequest, @Body() body: unknown) {
    const p = z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      precision: z.number().min(0).max(100_000).optional(),
    }).safeParse(body);
    if (!p.success) throw new BadRequestException('Ubicación inválida');
    const q = await prisma.quotes.findUnique({
      where: { id: BigInt(req.quoteId) },
      select: { id: true, service_state: true, service_assignments: { where: { state: 'aceptado' }, take: 1, select: { provider_id: true } } },
    });
    const aliado = q?.service_assignments[0]?.provider_id;
    if (!q || !aliado) return { ok: false, detener: true };
    return guardarUbicacion(q, aliado, p.data);
  }
}

/** Qué lleva, sin precios: los renglones del documento del cotizador, o lo que pidió el cliente. */
async function equipoDe(requirements: unknown, pidio: string | null): Promise<string[]> {
  const id = (requirements as { quoterId?: unknown } | null)?.quoterId;
  if (typeof id === 'number') {
    const doc = await prisma.quoter_quotes.findUnique({ where: { id }, select: { snapshot: true } });
    const renglones = (doc?.snapshot as { calc?: { renglones?: Array<{ clase?: string; concepto?: string; cantidad?: number; unidad?: string }> } } | null)?.calc?.renglones ?? [];
    const lineas = renglones.filter((r) => r.concepto && r.clase !== 'flete').map((r) => `${r.concepto}${r.cantidad ? ` · ${r.cantidad} ${r.unidad ?? ''}`.trimEnd() : ''}`);
    if (lineas.length) return lineas;
  }
  return pidio ? [pidio.split(' · ')[0]] : [];
}
