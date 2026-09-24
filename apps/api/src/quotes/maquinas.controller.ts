import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { prisma } from '@maqserv/db';
import { catalogoCotizadorSchema, renglonesDe, unidadesDe } from '@maqserv/config';
import { z } from 'zod';
import { JwtGuard, type AuthedRequest } from '../auth/jwt.guard';
import { completarTelefono, datosDeCuenta } from '../common/cuenta';
import { RecomendadorService, type MaquinaRecomendada } from './recomendador.service';
import { MaquinaServicio } from './maquina-servicio';

/**
 * COTIZADOR GUIADO POR MÁQUINA · lado API (2026-09-25).
 *
 *  GET  /maquinas/tipos?linea=   → qué tipos hay en esa línea (para el paso 1)
 *  POST /maquinas/recomendar     → máquinas que sirven, llegan, pueden y cuánto cuestan
 *  POST /maquinas/solicitar      → el cliente eligió una: se abre el servicio
 *
 * Las dos últimas exigen cuenta (igual que el resto del camino de cotizar) y
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

const solicitudSchema = entradaSchema.extend({
  productoId: z.number().int().positive(),
  notas: z.string().trim().max(2000).optional(),
  cliente: z.string().trim().max(190).optional(),
  telefono: z.string().trim().max(40).optional(),
});

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

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('solicitar')
  @UseGuards(JwtGuard)
  async solicitar(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = solicitudSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Datos inválidos');
    const d = parsed.data;
    const cuenta = await datosDeCuenta(req.userId);
    if (!cuenta) throw new ForbiddenException('La cuenta ya no existe.');

    // Se vuelve a evaluar SOLO esa máquina en el servidor: el precio, el flete y
    // la disponibilidad nunca se toman de lo que mandó el navegador.
    const r = await this.recomendador.recomendar({ ...d, soloProductoId: d.productoId });
    const m = r.maquinas[0];
    if (!m) {
      const motivo = r.descartadas.ocupadas ? 'ya está apartada esas fechas' : r.descartadas.fueraDeHorario ? 'no atiende a esa hora' : r.descartadas.noSirven ? 'no alcanza lo que pides' : 'ya no está disponible';
      throw new BadRequestException(`Esa máquina ${motivo}. Elige otra de la lista.`);
    }
    const cat = await prisma.categories.findUnique({ where: { cat_slug: d.linea }, select: { cat_name: true } });
    void completarTelefono(req.userId, d.telefono);

    return this.servicio.abrir({
      entrada: d,
      maquina: m,
      lineaNombre: cat?.cat_name ?? d.linea,
      fin: r.fin,
      zona: r.zona,
      cuenta,
      userId: req.userId,
      cliente: d.cliente || cuenta.name,
      telefono: d.telefono || cuenta.phone,
      notas: d.notas || null,
    });
  }
}
