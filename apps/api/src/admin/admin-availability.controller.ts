import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { z } from 'zod';
import { AdminGuard } from './admin-auth';
import { disponibilidadDe, DIAS_FRESCURA } from '../catalog/availability';

/**
 * DISPONIBILIDAD — confirmar, ubicar y bloquear equipos.
 *
 * El documento institucional (21) pide tratar la disponibilidad como un estado
 * con fecha, ubicación y confiabilidad, y como control contra el dato viejo,
 * "confirmación periódica y marca de antigüedad". Esta pantalla es donde se
 * ejerce ese control mientras no exista el acceso del proveedor.
 *
 * Confirmar NO cambia el inventario: solo dice "esto sigue siendo cierto hoy".
 * Son dos cosas distintas y mezclarlas haría que confirmar pareciera un ajuste
 * de existencias.
 */

const ESTADOS_BLOQUEO = ['reservado', 'en-traslado', 'en-servicio', 'mantenimiento', 'inactivo'] as const;

const bloqueoSchema = z.object({
  state: z.enum(ESTADOS_BLOQUEO),
  startsOn: z.string().min(8),
  endsOn: z.string().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

const ubicacionSchema = z.object({ location: z.string().max(160).nullable() });

const fecha = (v: string | null | undefined): Date | null =>
  v && v.trim() ? new Date(`${v}T00:00:00Z`) : null;

@Controller('admin/availability')
@UseGuards(AdminGuard)
export class AdminAvailabilityController {
  @Get()
  async list() {
    const productos = await prisma.products.findMany({
      where: { status: 1 },
      select: {
        id: true, name: true, stock: true, location: true,
        availability_confirmed_at: true, category_id: true, provider_id: true,
      },
      orderBy: { name: 'asc' },
    });

    const hoy = new Date();
    const [bloques, cats, provs] = await Promise.all([
      prisma.availability_blocks.findMany({
        where: { starts_on: { lte: hoy }, OR: [{ ends_on: null }, { ends_on: { gte: hoy } }] },
        orderBy: { starts_on: 'desc' },
      }),
      prisma.categories.findMany({ select: { id: true, cat_name: true } }),
      prisma.providers.findMany({ select: { id: true, name: true } }),
    ]);

    const porProducto = new Map<number, typeof bloques>();
    for (const b of bloques) {
      const l = porProducto.get(b.product_id) ?? [];
      l.push(b);
      porProducto.set(b.product_id, l);
    }
    const nombreCat = new Map(cats.map((c) => [c.id, c.cat_name]));
    const nombreProv = new Map(provs.map((p) => [p.id, p.name]));

    return productos.map((p) => {
      const misBloques = porProducto.get(p.id) ?? [];
      const disp = disponibilidadDe(
        {
          stock: p.stock,
          location: p.location,
          confirmedAt: p.availability_confirmed_at,
          blocks: misBloques.map((b) => ({ state: b.state, starts_on: b.starts_on, ends_on: b.ends_on })),
        },
        hoy,
      );
      return {
        id: p.id,
        name: p.name,
        stock: p.stock,
        category: nombreCat.get(p.category_id) ?? null,
        provider: p.provider_id !== null ? (nombreProv.get(p.provider_id) ?? null) : null,
        state: disp.state,
        location: disp.location,
        confirmedAt: disp.confirmedAt,
        until: disp.until,
        blocks: misBloques.map((b) => ({
          id: b.id,
          state: b.state,
          startsOn: b.starts_on.toISOString().slice(0, 10),
          endsOn: b.ends_on ? b.ends_on.toISOString().slice(0, 10) : null,
          note: b.note,
        })),
      };
    });
  }

  /** Días tras los que una confirmación deja de sostener una promesa. */
  @Get('config')
  config() {
    return { diasFrescura: DIAS_FRESCURA, estadosBloqueo: ESTADOS_BLOQUEO };
  }

  /**
   * "Esto sigue siendo cierto hoy". Es la confirmación periódica del documento;
   * no toca las existencias a propósito.
   */
  @Post(':id/confirm')
  async confirm(@Param('id', ParseIntPipe) id: number) {
    const existe = await prisma.products.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new NotFoundException('Equipo no encontrado');
    await prisma.products.update({
      where: { id },
      data: { availability_confirmed_at: new Date() },
    });
    return { ok: true };
  }

  @Patch(':id')
  async setLocation(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const parsed = ubicacionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Ubicación inválida');
    await prisma.products.update({
      where: { id },
      data: { location: parsed.data.location?.trim() || null },
    });
    return { ok: true };
  }

  @Post(':id/block')
  async block(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const parsed = bloqueoSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Datos inválidos');
    const d = parsed.data;
    const desde = fecha(d.startsOn);
    const hasta = fecha(d.endsOn);
    if (!desde) throw new BadRequestException('Falta la fecha de inicio');
    // Un bloqueo que termina antes de empezar no significa nada y ademas nunca
    // se mostraria: se rechaza aqui en vez de guardarlo y confundir despues.
    if (hasta && hasta < desde) throw new BadRequestException('La fecha de retorno es anterior al inicio');

    const b = await prisma.availability_blocks.create({
      data: {
        product_id: id,
        state: d.state,
        starts_on: desde,
        ends_on: hasta,
        note: d.note ?? null,
      },
      select: { id: true },
    });
    return b;
  }

  @Delete('blocks/:blockId')
  async unblock(@Param('blockId', ParseIntPipe) blockId: number) {
    await prisma.availability_blocks.deleteMany({ where: { id: blockId } });
    return { ok: true };
  }
}
