import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { prisma } from '@maqserv/db';
import { esLineaServicio, unidadesDe } from '@maqserv/config';
import { z } from 'zod';
import { JwtGuard, type AuthedRequest } from '../auth/jwt.guard';
import { completarTelefono, datosDeCuenta } from '../common/cuenta';
import { RecomendadorService, fechaFin, type MaquinaRecomendada } from './recomendador.service';
import { conCandado } from '../common/candado';
import { MaquinaServicio, type PartidaMaquina } from './maquina-servicio';

/**
 * COTIZADOR GUIADO POR MÁQUINA · lado API (2026-09-25).
 *
 *  GET  /maquinas/tipos?linea=   → qué tipos hay en esa línea (para el paso 1)
 *  POST /maquinas/recomendar     → máquinas que sirven, llegan, pueden y cuánto cuestan
 *  POST /maquinas/documento      → la cotización tal como se imprime, antes de solicitar
 *  POST /maquinas/solicitar      → el cliente eligió una o varias: se abre un servicio por máquina
 *
 * Las tres últimas exigen cuenta (igual que el resto del camino de cotizar) y
 * tienen tope: recomendar geocodifica la obra, y eso sale a un servicio de
 * terceros que se paga por petición.
 */

const obraSchema = z.object({
  siteId: z.number().int().positive().nullable().optional(),
  direccion: z.string().trim().max(300).nullable().optional(),
  municipio: z.string().trim().max(120).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
}).refine(
  // Sin dónde, no hay cobertura ni flete que calcular (QA 2026-09-25: con "obra: {}" se abría un servicio sin dirección).
  (o) => Boolean(o.siteId || o.direccion?.trim() || o.municipio?.trim() || (o.lat != null && o.lng != null)),
  'Dinos dónde es la obra',
);

/** Hoy en Monterrey (YYYY-MM-DD): el servidor puede estar en otra zona horaria. */
function hoyMty(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** Fecha real (no 2026-02-30) y no pasada (QA 2026-09-25). */
const fechaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige la fecha')
  .refine((f) => {
    const d = new Date(`${f}T12:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f;
  }, 'Esa fecha no existe')
  .refine((f) => f >= hoyMty(), 'La fecha ya pasó: elige hoy o una fecha futura');

const entradaSchema = z.object({
  linea: z.string().min(2).max(120),
  tipo: z.string().trim().max(120).nullable().optional(),
  requisitos: z.record(z.string().max(60), z.string().max(500)).nullable().optional(),
  obra: obraSchema,
  fecha: fechaSchema,
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  unidad: z.string().max(20),
  unidades: z.coerce.number().min(0.5).max(1000),
  equipos: z.coerce.number().int().min(1).max(20).optional(),
  productoId: z.number().int().positive().nullable().optional(),
  recoger: z.boolean().nullable().optional(),
});

/** Una máquina elegida con lo que se pide de ella. */
const partidaSchema = entradaSchema.extend({ productoId: z.number().int().positive() });

const contactoSchema = z.object({
  notas: z.string().trim().max(2000).optional(),
  cliente: z.string().trim().max(190).optional(),
  telefono: z.string().trim().max(40).optional(),
});

/**
 * Una solicitud trae VARIAS partidas (excavadora + pipa en la misma
 * cotización, como en el cotizador original) o, por compatibilidad, una sola
 * máquina con sus datos al nivel de arriba.
 */
const solicitudSchema = z.union([
  contactoSchema.extend({ partidas: z.array(partidaSchema).min(1, 'Elige al menos una máquina').max(10) }),
  partidaSchema.merge(contactoSchema).transform((s) => ({ partidas: [s], notas: s.notas, cliente: s.cliente, telefono: s.telefono })),
]);

/** Lo que ve el cliente de una máquina: sin el aliado. */
function publica(m: MaquinaRecomendada) {
  const { providerId: _p, providerName: _n, ...resto } = m;
  return resto;
}

@Controller('maquinas')
export class MaquinasController {
  constructor(
    private readonly recomendador: RecomendadorService,
    private readonly servicio: MaquinaServicio,
  ) {}

  /**
   * LÍNEAS CON SERVICIOS (2026-09-25): el cotizador solo ofrece las categorías
   * que tienen al menos un servicio publicado con aliado. Antes salían las
   * cinco aunque no hubiera nada que cotizar en cuatro de ellas.
   */
  @Get('lineas')
  async lineas() {
    const grupos = await prisma.products.groupBy({
      by: ['category_id'],
      where: { status: 1, provider_id: { not: null } },
      _count: { _all: true },
    });
    if (grupos.length === 0) return [];
    const cats = await prisma.categories.findMany({
      where: { id: { in: grupos.map((g) => g.category_id) }, status: 1 },
      select: { id: true, cat_slug: true },
    });
    // El cotizador es de SERVICIOS: una categoría de productos no es una línea.
    const slug = new Map(cats.filter((c) => esLineaServicio(c.cat_slug)).map((c) => [c.id, c.cat_slug]));
    return grupos
      .filter((g) => slug.has(g.category_id))
      .map((g) => ({ slug: slug.get(g.category_id)!, servicios: g._count._all }));
  }

  /**
   * Los servicios de una línea: SOLO los publicados en el catálogo, por
   * nombre (2026-09-25). Los renglones del tabulador viejo ya no salen: eran
   * tipos genéricos que no correspondían a ninguna máquina real.
   */
  @Get('tipos')
  async tipos(@Query('linea') linea?: string) {
    if (!linea) throw new BadRequestException('Falta la línea');
    const cat = await prisma.categories.findUnique({ where: { cat_slug: linea }, select: { id: true } });
    const tipos = new Map<string, { nombre: string; origen: 'catalogo'; maquinas: number }>();
    if (cat) {
      const productos = await prisma.products.findMany({
        where: { status: 1, provider_id: { not: null }, category_id: cat.id },
        select: { name: true },
      });
      for (const p of productos) {
        const k = p.name.trim().toLowerCase();
        const ya = tipos.get(k);
        if (ya) ya.maquinas += 1;
        else tipos.set(k, { nombre: p.name.trim(), origen: 'catalogo', maquinas: 1 });
      }
    }
    return {
      tipos: [...tipos.values()].sort((x, y) => x.nombre.localeCompare(y.nombre, 'es')),
      unidades: unidadesDe(linea).map((u) => ({ clave: u.clave, singular: u.singular, plural: u.plural })),
    };
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post('recomendar')
  @UseGuards(JwtGuard)
  async recomendar(@Body() body: unknown) {
    const parsed = entradaSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Datos inválidos');
    const r = await this.recomendador.recomendar(parsed.data);
    return { ...r, maquinas: r.maquinas.map(publica) };
  }

  /**
   * Cada partida se vuelve a evaluar SOLO con su máquina en el servidor: el
   * precio, el flete y la disponibilidad nunca se toman de lo que mandó el
   * navegador. Devuelve la zona resuelta para el documento.
   */
  private async resolverPartidas(partidas: z.infer<typeof partidaSchema>[]): Promise<{ partidas: PartidaMaquina[]; zona: string | null }> {
    const out: PartidaMaquina[] = [];
    let zona: string | null = null;
    const nombres = new Map<string, string>();
    // La misma máquina dos veces en fechas que se enciman se apartaba doble
    // (QA 2026-09-25). Para más de una se usa "cuántas máquinas".
    const rangos = partidas.map((p) => ({ id: p.productoId, desde: p.fecha, hasta: fechaFin(p.fecha, p.unidad, Math.max(0.5, Number(p.unidades) || 1)) }));
    for (let i = 0; i < rangos.length; i += 1) {
      for (let j = i + 1; j < rangos.length; j += 1) {
        const a = rangos[i], b = rangos[j];
        if (a.id === b.id && a.desde <= b.hasta && b.desde <= a.hasta) {
          throw new BadRequestException('Agregaste la misma máquina dos veces en fechas que se enciman. Para más de una, usa "cuántas máquinas".');
        }
      }
    }
    for (const p of partidas) {
      const r = await this.recomendador.recomendar({ ...p, soloProductoId: p.productoId });
      const m = r.maquinas[0];
      if (!m) {
        const motivo = r.descartadas.ocupadas ? 'ya está apartada esas fechas' : r.descartadas.fueraDeHorario ? 'no atiende a esa hora' : r.descartadas.noSirven ? 'no alcanza lo que pides' : 'ya no está disponible';
        throw new BadRequestException(`Una de las máquinas ${motivo}. Quítala o elige otra.`);
      }
      zona = zona ?? r.zona;
      if (!nombres.has(p.linea)) {
        const cat = await prisma.categories.findUnique({ where: { cat_slug: p.linea }, select: { cat_name: true } });
        nombres.set(p.linea, cat?.cat_name ?? p.linea);
      }
      out.push({ entrada: p, maquina: m, lineaNombre: nombres.get(p.linea) ?? p.linea, fin: r.fin });
    }
    return { partidas: out, zona };
  }

  /**
   * VISTA PREVIA del documento (2026-09-25): la cotización tal como se
   * imprime, con las máquinas elegidas, ANTES de solicitar. Lo único que
   * falta es el folio.
   */
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post('documento')
  @UseGuards(JwtGuard)
  async documento(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = solicitudSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Datos inválidos');
    const d = parsed.data;
    const cuenta = await datosDeCuenta(req.userId);
    if (!cuenta) throw new ForbiddenException('La cuenta ya no existe.');
    const { partidas, zona } = await this.resolverPartidas(d.partidas);
    return this.servicio.vistaPrevia({ partidas, cliente: d.cliente || cuenta.name, zona, notas: d.notas || null });
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('solicitar')
  @UseGuards(JwtGuard)
  async solicitar(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = solicitudSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Datos inválidos');
    const d = parsed.data;
    const cuenta = await datosDeCuenta(req.userId);
    if (!cuenta) throw new ForbiddenException('La cuenta ya no existe.');
    // Revisar disponibilidad y apartar van bajo candado por cliente y por
    // máquina: dos envíos simultáneos (doble clic, o dos clientes a la vez)
    // veían la máquina libre y la apartaban dos veces (QA 2026-09-25).
    const llaves = [`cliente:${req.userId}`, ...d.partidas.map((p) => `maquina:${p.productoId}`)];
    return conCandado(llaves, async () => {
      const { partidas, zona } = await this.resolverPartidas(d.partidas);
      void completarTelefono(req.userId, d.telefono);
      return this.servicio.abrir({
        partidas,
        zona,
        cuenta,
        userId: req.userId,
        cliente: d.cliente || cuenta.name,
        telefono: d.telefono || cuenta.phone,
        notas: d.notas || null,
      });
    });
  }
}
