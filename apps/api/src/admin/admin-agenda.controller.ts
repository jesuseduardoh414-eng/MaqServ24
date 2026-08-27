import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { AdminGuard } from './admin-auth';
import { PASOS, esEstado } from '../quotes/service-flow';
import { choques, densidad, semanaDe, type Compromiso } from './agenda';

/**
 * AGENDA (documento institucional, sección 17 · Módulo Operaciones).
 *
 * "Asignaciones, estatus, agenda, incidencias y cierre." La agenda era el
 * único de los cinco que faltaba: el tablero dice qué está pasando, no qué
 * viene, y sin eso no se ve un choque de fechas antes de comprometerse.
 *
 * Junta las dos cosas que ocupan una unidad y que hasta hoy vivían separadas:
 * los bloqueos de disponibilidad y los servicios comprometidos.
 */
@Controller('admin/agenda')
@UseGuards(AdminGuard)
export class AdminAgendaController {
  @Get()
  async agenda(@Query('desde') desdeParam?: string, @Query('semanas') semanasParam?: string) {
    const base = desdeParam ? new Date(`${desdeParam}T00:00:00Z`) : new Date();
    const semanas = Math.min(6, Math.max(1, Number(semanasParam ?? 2) || 2));

    const dias = Array.from({ length: semanas }, (_, i) => {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() + i * 7);
      return semanaDe(d);
    }).flat();

    const desde = dias[0];
    const hasta = dias[dias.length - 1];

    const [bloques, asignaciones] = await Promise.all([
      // Bloqueos que TOCAN la ventana: uno que empezó hace un mes y sigue
      // abierto ocupa la semana que viene, y filtrarlo por fecha de inicio lo
      // dejaría fuera justo cuando importa.
      prisma.availability_blocks.findMany({
        where: {
          starts_on: { lte: hasta },
          OR: [{ ends_on: null }, { ends_on: { gte: desde } }],
        },
        orderBy: { starts_on: 'asc' },
      }),
      prisma.service_assignments.findMany({
        where: {
          state: 'aceptado',
          committed_at: { gte: desde, lte: new Date(hasta.getTime() + 86400000) },
        },
        include: {
          providers: { select: { name: true } },
          quotes: {
            select: {
              quote_number: true, service_category: true, service_state: true,
              company_name: true, name: true,
              client_sites: { select: { name: true, municipality: true } },
            },
          },
        },
        orderBy: { committed_at: 'asc' },
      }),
    ]);

    /**
     * Los nombres de los equipos, en una consulta aparte.
     *
     * `availability_blocks` se creo sin llave foranea contra `products` —el
     * esquema viene del Laravel viejo y ahi casi nada la tiene—, asi que
     * Prisma no ofrece la relacion y hay que resolverla a mano. Se piden todos
     * de golpe: uno por bloqueo serian tantos viajes como bloqueos.
     */
    const nombres = new Map<number, string>(
      bloques.length
        ? (
            await prisma.products.findMany({
              where: { id: { in: [...new Set(bloques.map((b) => b.product_id))] } },
              select: { id: true, name: true },
            })
          ).map((x) => [x.id, x.name])
        : [],
    );

    const compromisos: Compromiso[] = [
      ...bloques.map((b) => ({
        id: `bloqueo:${b.id}`,
        tipo: 'bloqueo' as const,
        productId: b.product_id,
        titulo: nombres.get(b.product_id) ?? `Equipo #${b.product_id}`,
        detalle: b.note ?? null,
        desde: b.starts_on,
        hasta: b.ends_on,
        estado: b.state,
      })),
      ...asignaciones.map((a) => ({
        id: `servicio:${a.id}`,
        tipo: 'servicio' as const,
        // El servicio no apunta todavía a una unidad concreta: eso llega con
        // el inventario por unidad. Se muestra igual, sin equipo.
        productId: null,
        titulo: a.quotes.client_sites?.name ?? a.quotes.service_category ?? a.quotes.quote_number,
        detalle: `${a.quotes.company_name || a.quotes.name} · ${a.providers.name}`,
        desde: a.committed_at!,
        hasta: a.committed_at!,
        estado: esEstado(a.quotes.service_state) ? PASOS[a.quotes.service_state].label : 'Asignado',
      })),
    ];

    return {
      desde: desde.toISOString().slice(0, 10),
      hasta: hasta.toISOString().slice(0, 10),
      semanas: Array.from({ length: semanas }, (_, i) => {
        const d = dias.slice(i * 7, i * 7 + 7);
        return {
          dias: d.map((x) => x.toISOString().slice(0, 10)),
          densidad: densidad(d, compromisos),
        };
      }),
      compromisos: compromisos.map((c) => ({
        ...c,
        desde: c.desde.toISOString().slice(0, 10),
        hasta: c.hasta ? c.hasta.toISOString().slice(0, 10) : null,
      })),
      /** Cuántas unidades están ocupadas hoy, para leer la ventana. */
      contexto: {
        equiposActivos: await prisma.products.count({ where: { status: 1 } }),
        bloqueosVigentes: bloques.length,
        serviciosComprometidos: asignaciones.length,
      },
    };
  }

  /**
   * ¿Choca con algo? Se consulta ANTES de crear un bloqueo o de comprometer.
   *
   * Advierte, no bloquea: dos compromisos en las mismas fechas a veces son
   * legítimos —una excavadora que sale de una obra a las once y entra a otra a
   * las tres— y a veces son un error caro. El sistema no puede distinguirlos;
   * quien opera sí.
   */
  @Get('choques')
  async choques(
    @Query('productId') productIdParam: string,
    @Query('desde') desdeParam: string,
    @Query('hasta') hastaParam?: string,
    @Query('ignorar') ignorar?: string,
  ) {
    const productId = Number(productIdParam);
    if (!Number.isInteger(productId) || !desdeParam) return { choques: [] };

    const desde = new Date(`${desdeParam}T00:00:00Z`);
    const hasta = hastaParam ? new Date(`${hastaParam}T00:00:00Z`) : null;

    const [bloques, equipo] = await Promise.all([
      prisma.availability_blocks.findMany({
        where: {
          product_id: productId,
          ...(hasta ? { starts_on: { lte: hasta } } : {}),
          OR: [{ ends_on: null }, { ends_on: { gte: desde } }],
        },
      }),
      prisma.products.findUnique({ where: { id: productId }, select: { name: true } }),
    ]);

    const existentes: Compromiso[] = bloques.map((b) => ({
      id: `bloqueo:${b.id}`,
      tipo: 'bloqueo',
      productId: b.product_id,
      titulo: equipo?.name ?? `Equipo #${productId}`,
      detalle: b.note ?? null,
      desde: b.starts_on,
      hasta: b.ends_on,
      estado: b.state,
    }));

    const encontrados = choques(productId, { desde, hasta }, existentes, ignorar);
    return {
      choques: encontrados.map((c) => ({ id: c.con.id, estado: c.con.estado, texto: c.texto })),
      // El texto va aquí y no en la pantalla: la regla vive donde se calcula.
      aviso:
        encontrados.length === 0
          ? null
          : `Ese equipo ya tiene ${encontrados.length} compromiso(s) en esas fechas. Revísalo antes de prometerlo.`,
    };
  }
}
