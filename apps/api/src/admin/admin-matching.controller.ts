import { Controller, Get, NotFoundException, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { AdminGuard } from './admin-auth';
import { estadoDocumentos, estaVerificado, mesesEnRed } from '../catalog/provider-trust';
import { disponibilidadDe } from '../catalog/availability';
import { emparejar, motivoSinCobertura, type ProveedorCandidato } from '../quotes/matching';

/**
 * QUIÉN PUEDE ATENDER ESTA SOLICITUD (documento, secciones 16 y 17).
 *
 * Reemplaza el "¿a quién le hablamos?" que hoy vive en la cabeza de quien
 * cotiza. Cruza lo que ya tenemos: la categoría y la zona de la solicitud contra
 * la cobertura, el expediente y la disponibilidad real de cada aliado.
 */

/** Claves donde el cliente escribe dónde es la obra, en orden de preferencia. */
const CLAVES_ZONA = ['obra_ubicacion', 'destino', 'origen'];

@Controller('admin/quotes')
@UseGuards(AdminGuard)
export class AdminMatchingController {
  @Get(':id/matches')
  async matches(@Param('id', ParseIntPipe) id: number) {
    const q = await prisma.quotes.findUnique({ where: { id } });
    if (!q) throw new NotFoundException('Cotización no encontrada');

    // La zona sale de las respuestas del formulario; si no las hay, de la
    // dirección de entrega, que es lo único que siempre se pide.
    const reqs = (q.requirements ?? {}) as Record<string, string>;
    const zona =
      CLAVES_ZONA.map((k) => reqs[k]).find((v) => v && v.trim()) ?? q.address ?? q.region ?? null;
    const categoria = q.service_category;

    const aliados = await prisma.providers.findMany({
      where: { status: 1 },
      include: { provider_documents: { select: { expires_at: true } } },
    });

    const enCategoria = categoria
      ? aliados.filter((a) => a.categories.includes(categoria))
      : aliados;

    // Equipos de esos aliados en la categoría pedida, con su disponibilidad.
    // Se piden todos de golpe: uno por aliado serían tantos viajes como aliados.
    const idsAliados = enCategoria.map((a) => a.id);
    const cat = categoria
      ? await prisma.categories.findUnique({ where: { cat_slug: categoria }, select: { id: true } })
      : null;

    const equipos = idsAliados.length
      ? await prisma.products.findMany({
          where: {
            status: 1,
            provider_id: { in: idsAliados },
            ...(cat ? { category_id: cat.id } : {}),
          },
          select: {
            id: true, name: true, stock: true, location: true,
            availability_confirmed_at: true, provider_id: true,
          },
        })
      : [];

    const hoy = new Date();
    const bloques = equipos.length
      ? await prisma.availability_blocks.findMany({
          where: {
            product_id: { in: equipos.map((e) => e.id) },
            starts_on: { lte: hoy },
            OR: [{ ends_on: null }, { ends_on: { gte: hoy } }],
          },
          select: { product_id: true, state: true, starts_on: true, ends_on: true },
        })
      : [];
    const porEquipo = new Map<number, typeof bloques>();
    for (const b of bloques) {
      const l = porEquipo.get(b.product_id) ?? [];
      l.push(b);
      porEquipo.set(b.product_id, l);
    }

    const equiposPorAliado = new Map<number, ProveedorCandidato['equipos']>();
    for (const e of equipos) {
      if (e.provider_id === null) continue;
      const disp = disponibilidadDe(
        {
          stock: e.stock,
          location: e.location,
          confirmedAt: e.availability_confirmed_at,
          blocks: porEquipo.get(e.id) ?? [],
        },
        hoy,
      );
      const l = equiposPorAliado.get(e.provider_id) ?? [];
      l.push({ id: e.id, name: e.name, state: disp.state, location: disp.location });
      equiposPorAliado.set(e.provider_id, l);
    }

    const candidatos: ProveedorCandidato[] = enCategoria.map((a) => {
      const docs = estadoDocumentos(a.provider_documents);
      return {
        id: a.id,
        name: a.name,
        slug: a.slug,
        level: a.level,
        verified: estaVerificado(a.level, docs),
        coverage: a.coverage,
        categories: a.categories,
        responseMinutes: a.response_minutes,
        monthsInNetwork: mesesEnRed(a.joined_at),
        equipos: equiposPorAliado.get(a.id) ?? [],
      };
    });

    const coincidencias = emparejar({ categoria, zona }, candidatos);

    return {
      quoteNumber: q.quote_number,
      categoria,
      zona,
      total: coincidencias.length,
      // Sin candidatos, lo importante NO es la lista vacía sino el porqué: es el
      // dato que el documento pide para dirigir el reclutamiento de aliados.
      motivo: coincidencias.length === 0
        ? motivoSinCobertura({ categoria, zona }, aliados.length, enCategoria.length)
        : null,
      matches: coincidencias.map((c) => ({
        providerId: c.proveedor.id,
        name: c.proveedor.name,
        level: c.proveedor.level,
        verified: c.proveedor.verified,
        phone: enCategoria.find((a) => a.id === c.proveedor.id)?.phone ?? null,
        contactName: enCategoria.find((a) => a.id === c.proveedor.id)?.contact_name ?? null,
        responseMinutes: c.proveedor.responseMinutes,
        coverage: c.proveedor.coverage,
        score: c.puntaje,
        reasons: c.razones,
        warnings: c.advertencias,
        availableEquipment: c.equiposDisponibles,
        equipment: c.proveedor.equipos,
      })),
    };
  }
}
