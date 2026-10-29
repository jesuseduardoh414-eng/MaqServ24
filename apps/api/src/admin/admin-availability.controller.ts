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
  Req,
  UseGuards,
} from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { z } from 'zod';
import { AdminGuard, type AdminRequest, Modulo } from './admin-auth';
import { disponibilidadDe, unidadesPorEstado, PREFIJO_RESERVA } from '../catalog/availability';
import { liberarReservaAMano } from '../quotes/reservas';
import { ESTADO_POR_REVISAR } from '../catalog/ofertas';
import { lista } from '../common/json-list';
import { registrarAccion } from './audit';
import { QuoterService } from '../quoter/quoter.service';

/**
 * DISPONIBILIDAD — ver y editar los equipos de los aliados.
 *
 * El documento institucional (21) pide tratar la disponibilidad como un estado
 * con fecha y ubicación. Desde el 2026-10-26 no hay confirmación periódica: la
 * confirmación es cuando el aliado acepta o rechaza un servicio, y él mismo
 * marca su mantenimiento desde su portal. La pantalla agrupa por tipo ("8
 * retroexcavadoras, 6 libres") y de aquí se puede empezar una cotización.
 *
 * Lo que aparta un servicio (nota `reserva:<folio>`) ya NO se pone aquí: lo
 * pone y lo quita el propio servicio (quotes/reservas.ts). Esta pantalla lo
 * enseña —también lo que viene, no solo lo de hoy— y queda para lo que ningún
 * sistema sabe: mantenimiento, una máquina parada, una ubicación.
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

@Modulo('disponibilidad')
@Controller('admin/availability')
@UseGuards(AdminGuard)
export class AdminAvailabilityController {
  constructor(private readonly quoter: QuoterService) {}

  @Get()
  async list() {
    // Solo máquinas de aliados DE LA RED (2026-10-21; 2026-10-26 sin los que aún
    // son solicitud): sin aliado es la ficha del tipo, que lleva el precio y no
    // ocupa patio ni fechas. Todos sus servicios: también lo que ofreció desde
    // su portal y sigue por revisar, y lo dado de baja (sale inactivo).
    const provs = await prisma.providers.findMany({ select: { id: true, name: true, status: true, categories: true } });
    const red = provs.filter((p) => p.status === 1).map((p) => p.id);
    const productos = await prisma.products.findMany({
      where: { status: { in: [1, ESTADO_POR_REVISAR, 0] }, provider_id: { in: red } },
      select: {
        id: true, name: true, stock: true, location: true, status: true, tipo_id: true,
        category_id: true, provider_id: true,
      },
      orderBy: { name: 'asc' },
    });

    const hoy = new Date();
    const tiposIds = [...new Set(productos.map((p) => p.tipo_id).filter((t): t is number => t !== null))];
    const [bloques, cats, tipos, cotizadores] = await Promise.all([
      // De hoy en adelante: una reserva para la semana que entra no cambia el
      // estado de hoy, pero quien asigna tiene que verla.
      prisma.availability_blocks.findMany({
        where: { product_id: { in: productos.map((p) => p.id) }, OR: [{ ends_on: null }, { ends_on: { gte: hoy } }] },
        orderBy: { starts_on: 'asc' },
      }),
      prisma.categories.findMany({ select: { id: true, cat_name: true, cat_slug: true, status: true, sort_order: true } }),
      tiposIds.length
        ? prisma.products.findMany({ where: { id: { in: tiposIds } }, select: { id: true, name: true } })
        : Promise.resolve([] as Array<{ id: number; name: string }>),
      this.cotizadorDeCadaTipo(tiposIds),
    ]);

    const porProducto = new Map<number, typeof bloques>();
    for (const b of bloques) {
      const l = porProducto.get(b.product_id) ?? [];
      l.push(b);
      porProducto.set(b.product_id, l);
    }
    const nombreCat = new Map(cats.map((c) => [c.id, c.cat_name]));
    const nombreProv = new Map(provs.map((p) => [p.id, p.name]));
    const nombreTipo = new Map(tipos.map((t) => [t.id, t.name]));
    const hoyStr = hoy.toISOString().slice(0, 10);

    const equipos = productos.map((p) => {
      const misBloques = porProducto.get(p.id) ?? [];
      const entrada = {
        stock: p.stock,
        location: p.location,
        blocks: misBloques.map((b) => ({ state: b.state, starts_on: b.starts_on, ends_on: b.ends_on, note: b.note })),
      };
      const disp = disponibilidadDe(entrada, hoy);
      const unidades = Math.max(1, p.stock ?? 1);
      return {
        id: p.id,
        name: p.name,
        stock: p.stock,
        categoryId: p.category_id,
        category: nombreCat.get(p.category_id) ?? null,
        tipoId: p.tipo_id,
        tipo: p.tipo_id !== null ? (nombreTipo.get(p.tipo_id) ?? null) : null,
        /** Con qué cotizador del panel se cotiza su tipo (null = no está en un tabulador). */
        cotizador: p.tipo_id !== null ? (cotizadores.get(p.tipo_id) ?? null) : null,
        unidades,
        /** Sus unidades HOY por estado: "1 reservada, 4 libres". Dado de baja, todas inactivas. */
        porEstado: p.status === 0 ? { inactivo: unidades } : unidadesPorEstado(entrada, hoy),
        providerId: p.provider_id,
        provider: p.provider_id !== null ? (nombreProv.get(p.provider_id) ?? null) : null,
        /** En el catálogo: publicado, por revisar (aún no se le ofrece) o dado de baja. */
        publicacion: p.status === 1 ? 'publicado' : p.status === ESTADO_POR_REVISAR ? 'por_revisar' : 'baja',
        // Dado de baja no se ofrece, tenga o no fechas libres.
        state: p.status === 0 ? 'inactivo' : disp.state,
        location: disp.location,
        until: disp.until,
        blocks: misBloques.map((b) => {
          const startsOn = b.starts_on.toISOString().slice(0, 10);
          const auto = (b.note ?? '').startsWith(PREFIJO_RESERVA);
          return {
            id: b.id,
            state: b.state,
            startsOn,
            endsOn: b.ends_on ? b.ends_on.toISOString().slice(0, 10) : null,
            note: auto ? null : b.note,
            /** Lo puso un servicio: se mueve y se quita solo. */
            folio: auto ? (b.note as string).slice(PREFIJO_RESERVA.length) : null,
            upcoming: startsOn > hoyStr,
          };
        }),
      };
    });

    // Aliados de la red sin nada dado de alta: no se les puede apartar fecha,
    // pero tienen que verse para pedírselo.
    const conAlgo = new Set(productos.map((p) => p.provider_id));
    const porSlug = new Map(cats.map((c) => [c.cat_slug, c]));
    const sinServicios = provs
      .filter((p) => p.status === 1 && !conAlgo.has(p.id))
      .map((p) => {
        const lineas = lista(p.categories).map((s) => porSlug.get(s)).filter((c): c is (typeof cats)[number] => Boolean(c));
        return { id: p.id, name: p.name, categoryIds: lineas.map((c) => c.id), lineas: lineas.map((c) => c.cat_name) };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));

    // Las pestañas: las categorías activas y cualquiera que tenga equipos, en
    // el orden del catálogo (0 = al final, por nombre).
    const usadas = new Set(productos.map((p) => p.category_id));
    const orden = (n: number) => (n > 0 ? n : Number.MAX_SAFE_INTEGER);
    const categorias = cats
      .filter((c) => c.status === 1 || usadas.has(c.id))
      .sort((a, b) => orden(a.sort_order) - orden(b.sort_order) || a.cat_name.localeCompare(b.cat_name, 'es'))
      .map((c) => ({ id: c.id, name: c.cat_name }));

    return { equipos, sinServicios, categorias };
  }

  /**
   * Para "Cotizar" (2026-10-26): qué cotizador del panel tiene cada tipo en su
   * tabulador (un renglón visible ligado a la ficha). Sin renglón no hay botón:
   * se cotiza por el formulario.
   */
  private async cotizadorDeCadaTipo(tiposIds: number[]): Promise<Map<number, 'maquinaria' | 'triturados'>> {
    const mapa = new Map<number, 'maquinaria' | 'triturados'>();
    if (!tiposIds.length) return mapa;
    const liga = (r: { productos?: number[]; oculto?: boolean }) => (r.oculto ? [] : r.productos ?? []);
    try {
      const [maq, tri] = await Promise.all([this.quoter.catalogo('maquinaria'), this.quoter.catalogo('triturados')]);
      const deMaq = maq.tipo === 'maquinaria' ? [...maq.equipos, ...maq.servicios].flatMap(liga) : [];
      const deTri = tri.tipo === 'triturados' ? tri.productos.flatMap(liga) : [];
      for (const id of tiposIds) {
        if (deMaq.includes(id)) mapa.set(id, 'maquinaria');
        else if (deTri.includes(id)) mapa.set(id, 'triturados');
      }
    } catch { /* sin tabulador: sin botón, la pantalla igual sale */ }
    return mapa;
  }

  /** Los motivos de bloqueo que se pueden poner a mano. (Sin confirmación periódica desde 2026-10-26.) */
  @Get('config')
  config() {
    return { estadosBloqueo: ESTADOS_BLOQUEO };
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

  /**
   * Quitar un bloqueo. Si lo puso un servicio, se suelta TODO lo de ese folio
   * y queda anotado en la cotización: si no, la corrida diaria lo volvería a
   * poner. Es la salida para cuando el aliado manda otra máquina o el cliente
   * avisó por teléfono que ya no la necesita.
   */
  @Delete('blocks/:blockId')
  async unblock(@Req() req: AdminRequest, @Param('blockId', ParseIntPipe) blockId: number) {
    const b = await prisma.availability_blocks.findUnique({ where: { id: blockId }, select: { note: true } });
    if (b?.note?.startsWith(PREFIJO_RESERVA)) {
      const folio = b.note.slice(PREFIJO_RESERVA.length);
      await liberarReservaAMano(folio);
      await registrarAccion(req, 'disponibilidad', 'reserva.liberar', folio, 'Liberada a mano: el servicio ya no la vuelve a apartar');
      return { ok: true, folio };
    }
    await prisma.availability_blocks.deleteMany({ where: { id: blockId } });
    return { ok: true };
  }
}
