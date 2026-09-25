import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { prisma } from '@maqserv/db';
import { catalogoCotizadorSchema, renglonesDe, unidadesDe } from '@maqserv/config';
import { z } from 'zod';
import { JwtGuard, type AuthedRequest } from '../auth/jwt.guard';
import { completarTelefono, datosDeCuenta } from '../common/cuenta';
import { RecomendadorService, type MaquinaRecomendada } from './recomendador.service';
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
});

const entradaSchema = z.object({
  linea: z.string().min(2).max(120),
  tipo: z.string().trim().max(120).nullable().optional(),
  requisitos: z.record(z.string().max(60), z.string().max(500)).nullable().optional(),
  obra: obraSchema,
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige la fecha'),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  unidad: z.string().max(20),
  unidades: z.coerce.number().min(0.5).max(1000),
  equipos: z.coerce.number().int().min(1).max(20).optional(),
  productoId: z.number().int().positive().nullable().optional(),
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
   * Tipos de una línea: los renglones del tabulador (si la línea tiene
   * cotizador) más los nombres de máquinas publicadas. Sirve para el paso
   * "qué necesitas" sin obligar a escribir.
   */
  @Get('tipos')
  async tipos(@Query('linea') linea?: string) {
    if (!linea) throw new BadRequestException('Falta la línea');
    const cat = await prisma.categories.findUnique({ where: { cat_slug: linea }, select: { id: true } });
    const tipos = new Map<string, { nombre: string; origen: 'tabulador' | 'catalogo'; maquinas: number }>();
    const filas = await prisma.quoter_catalogs.findMany({ select: { data: true } }).catch(() => []);
    for (const f of filas) {
      const parsed = catalogoCotizadorSchema.safeParse(f.data);
      if (!parsed.success) continue;
      for (const r of renglonesDe(parsed.data)) {
        if (r.linea === linea) tipos.set(r.nombre.toLowerCase(), { nombre: r.nombre, origen: 'tabulador', maquinas: r.productos.length });
      }
    }
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
      tipos: [...tipos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
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
  }
}
