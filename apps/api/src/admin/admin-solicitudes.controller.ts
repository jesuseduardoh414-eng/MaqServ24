import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { prisma } from '@maqserv/db';
import { esCotizadorTipo, opcionesCotizadorSchema, puedeVerCon, type RefTarifa } from '@maqserv/config';
import { AdminGuard, type AdminRequest, Modulo } from './admin-auth';
import { permisosVigentes } from './permisos';
import { registrarAccion } from './audit';
import { Recotizar } from '../quoter/recotizar';
import { avisosDeRevision } from '../quotes/revision';

/**
 * REVISAR UNA SOLICITUD ANTES DE MANDARLE EL PRECIO (2026-10-23).
 *
 * Lo que necesita el detalle de una solicitud en el panel: los avisos (lo que
 * antes decidía la aprobación automática), el desglose con de dónde sale cada
 * precio y el lápiz para cambiarlo, solo para esta cotización o corrigiendo la
 * tarifa. Corregir la tarifa es cambiar precios: pide el módulo Tarifas,
 * igual que la ficha del tipo y la pantalla de Tarifas y condiciones.
 */
@Controller('admin')
@UseGuards(AdminGuard)
@Modulo('cotizaciones')
export class AdminSolicitudesController {
  constructor(private readonly recotizar: Recotizar) {}

  /** Los avisos del detalle de una solicitud. */
  @Get('quotes/:id/revision')
  async revision(@Param('id', ParseIntPipe) id: number) {
    return { avisos: await avisosDeRevision(id) };
  }

  @Post('quotes/:id/precio')
  async precio(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @Req() req: AdminRequest) {
    const p = z.object({
      fila: z.number().int().min(0).max(500),
      valor: z.number().positive('Escribe un precio mayor a cero.').max(100_000_000),
      alcance: z.enum(['esta', 'tarifa']),
      /** Solo en una solicitud del formulario: las unidades de esa partida. */
      cantidad: z.number().positive('La cantidad tiene que ser mayor a cero.').max(1_000_000).nullable().optional(),
    }).safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.issues[0]?.message ?? 'Datos inválidos');
    if (p.data.alcance === 'tarifa' && !puedeVerCon(req.adminRol, 'tarifas', await permisosVigentes())) {
      throw new ForbiddenException('Corregir tarifas es del módulo Tarifas. Puedes cambiar el precio solo para esta cotización.');
    }
    const q = await prisma.quotes.findUnique({ where: { id }, select: { quote_number: true } });
    const r = await this.recotizar.cambiarPrecio(id, p.data.fila, p.data.valor, p.data.alcance, req.adminEmail ?? 'panel', p.data.cantidad ?? null);
    if (r.tarifa) {
      await registrarAccion(req, 'tarifas', 'precio.tarifa', r.tarifa.nombre, `${r.tarifa.antes ?? '—'} → ${p.data.valor} · desde ${q?.quote_number ?? id} · ${r.recalculadas} solicitud(es) recalculada(s)`);
    } else {
      await registrarAccion(req, 'cotizaciones', 'solicitud.precio', q?.quote_number ?? String(id), `${r.concepto}: ${r.antes} → ${p.data.valor} (solo esta cotización)`);
    }
    return { ok: true, recalculadas: r.recalculadas, tarifa: r.tarifa?.nombre ?? null };
  }

  /** La ficha de la cotización (2026-10-23): lo que se cotiza a detalle, para ver y editar. */
  @Get('quotes/:id/cotizacion')
  async ficha(@Param('id', ParseIntPipe) id: number, @Req() req: AdminRequest) {
    const [ficha, avisos, puedeTarifas] = await Promise.all([
      this.recotizar.ficha(id),
      avisosDeRevision(id),
      permisosVigentes().then((p) => puedeVerCon(req.adminRol, 'tarifas', p)),
    ]);
    return { ...ficha, avisos, puedeTarifas };
  }

  /** Guardar lo editado en la ficha: sobre el mismo documento, o versión nueva si ya se mandó. */
  @Post('quotes/:id/cotizacion')
  async guardarFicha(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @Req() req: AdminRequest) {
    const p = z.object({
      partidas: z.array(z.unknown()).min(1, 'La cotización se quedó sin partidas.').max(60).optional(),
      opciones: opcionesCotizadorSchema.partial().optional().default({}),
      // Los datos de la entrega (2026-10-23).
      datos: z.object({
        obraId: z.number().int().positive().nullable().optional(),
        obraNueva: z.object({
          nombre: z.string().trim().min(2, 'Ponle nombre a la obra nueva.').max(190),
          direccion: z.string().trim().min(5, 'Escribe la dirección de la obra nueva.').max(300),
          municipio: z.string().trim().max(120).default(''),
        }).nullable().optional(),
        fechaInicio: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Fecha inválida').nullable().optional(),
        atencion: z.string().max(190).nullable().optional(),
        telefono: z.string().max(40).nullable().optional(),
        notas: z.string().max(2000).nullable().optional(),
      }).optional(),
    }).safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.issues[0]?.message ?? 'Datos inválidos');
    if (!p.data.partidas && !p.data.datos) throw new BadRequestException('No hay nada que guardar.');
    const q = await prisma.quotes.findUnique({ where: { id }, select: { quote_number: true } });
    const r = await this.recotizar.guardarPartidas(id, p.data.partidas ?? null, p.data.opciones, { adminId: req.adminId ?? null, adminNombre: req.adminNombre ?? null }, p.data.datos ?? null);
    await registrarAccion(req, 'cotizaciones', r.nuevaVersion ? 'solicitud.nueva_version' : 'solicitud.cotizar', q?.quote_number ?? String(id), `${r.folio ? `documento ${r.folio} · ` : ''}$${r.total}${p.data.datos ? ' · datos de la entrega' : ''}`);
    return { ok: true, ...r };
  }

  /** Corregir una tarifa desde la ficha (pide el módulo Tarifas). */
  @Post('quotes/:id/tarifa')
  async tarifa(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @Req() req: AdminRequest) {
    const p = z.object({
      tipo: z.string(),
      valor: z.number().positive('Escribe un precio mayor a cero.').max(100_000_000),
      ref: z.discriminatedUnion('clase', [
        z.object({ clase: z.literal('equipo'), id: z.string().max(40), tramo: z.string().max(30).optional() }),
        z.object({ clase: z.literal('flete'), tipo: z.string().max(60) }),
        z.object({ clase: z.literal('servicio'), id: z.string().max(40) }),
        z.object({ clase: z.literal('material'), id: z.string().max(40) }),
        z.object({ clase: z.literal('flete_zona'), zonaId: z.string().max(40) }),
        z.object({ clase: z.literal('banco') }),
        z.object({ clase: z.literal('zona'), zonaId: z.string().max(40), productoId: z.string().max(40) }),
      ]),
    }).safeParse(body);
    if (!p.success || !esCotizadorTipo(p.data.tipo)) throw new BadRequestException(p.success ? 'Cotizador desconocido' : p.error.issues[0]?.message ?? 'Datos inválidos');
    if (!puedeVerCon(req.adminRol, 'tarifas', await permisosVigentes())) {
      throw new ForbiddenException('Corregir tarifas es del módulo Tarifas. Puedes cambiar el precio solo para esta cotización.');
    }
    const q = await prisma.quotes.findUnique({ where: { id }, select: { quote_number: true } });
    const r = await this.recotizar.corregirTarifa(p.data.tipo, p.data.ref as RefTarifa, p.data.valor, req.adminEmail ?? 'panel');
    await registrarAccion(req, 'tarifas', 'precio.tarifa', r.nombre, `${r.antes ?? '—'} → ${p.data.valor} · desde la ficha de ${q?.quote_number ?? id} · ${r.recalculadas} solicitud(es) recalculada(s)`);
    return { ok: true, nombre: r.nombre, antes: r.antes, recalculadas: r.recalculadas };
  }

}
