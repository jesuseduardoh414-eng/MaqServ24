import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AdminGuard, Modulo, type AdminRequest } from './admin-auth';
import {
  CANALES, RESULTADOS, anotarContacto, corregirContacto, exigirEn, lineaDeTiempo, recordatoriosDe,
  type Objetivo, type TipoObjetivo,
} from './trato';

/**
 * EL TRATO CON CLIENTES Y ALIADOS (2026-11-09): llamadas, WhatsApp, correos
 * y visitas, en la solicitud, en el cliente y en el expediente del aliado.
 * La lógica y DÓNDE se guarda (sin SQL) están en `trato.ts`.
 *
 * PERMISOS: la ruta entra con `inicio` (todos los roles) y cada llamada pide
 * el módulo de lo que toca: la solicitud, Solicitudes o Servicios; el cliente,
 * Clientes; el aliado, Proveedores; el documento del cotizador, Cotizador.
 * Un solo `@Modulo` no alcanza porque un mismo renglón es de varias cosas a
 * la vez (la llamada al aliado desde Servicios es de la solicitud y del aliado).
 */
const id = z.coerce.number().int().positive();

const anotacionSchema = z.object({
  solicitud: id.optional(),
  cliente: id.optional(),
  aliado: id.optional(),
  documento: id.optional(),
  con: z.enum(['cliente', 'aliado']),
  canal: z.enum(CANALES),
  a: z.string().trim().max(160).optional().nullable(),
  nota: z.string().max(300).optional().nullable(),
  res: z.enum(RESULTADOS).optional().nullable(),
  recordar: z.string().optional().nullable(),
});

const cambioSchema = z.object({
  nota: z.string().max(300).optional().nullable(),
  res: z.enum(RESULTADOS).optional().nullable(),
  recordar: z.string().optional().nullable(),
  hecho: z.boolean().optional(),
  quitado: z.boolean().optional(),
});

function objetivoDe(d: z.infer<typeof anotacionSchema>): { objetivo: Objetivo; tipos: TipoObjetivo[] } {
  const objetivo: Objetivo = {};
  const tipos: TipoObjetivo[] = [];
  for (const t of ['solicitud', 'cliente', 'aliado', 'documento'] as const) {
    if (d[t]) { objetivo[t] = d[t]; tipos.push(t); }
  }
  if (!tipos.length) throw new BadRequestException('Falta con quién fue.');
  return { objetivo, tipos };
}

@Modulo('inicio')
@Controller('admin/trato')
@UseGuards(AdminGuard)
export class AdminTratoController {
  /** La línea de tiempo de una solicitud, un cliente o un aliado (uno a la vez). */
  @Get()
  async lista(@Req() req: AdminRequest, @Query('solicitud') solicitud?: string, @Query('cliente') cliente?: string, @Query('aliado') aliado?: string) {
    const tipo: 'solicitud' | 'cliente' | 'aliado' | null = solicitud ? 'solicitud' : cliente ? 'cliente' : aliado ? 'aliado' : null;
    const n = Number(solicitud ?? cliente ?? aliado);
    if (!tipo || !Number.isInteger(n) || n <= 0) throw new BadRequestException('Falta de quién.');
    await exigirEn(req, [tipo]);
    return { renglones: await lineaDeTiempo(req, tipo, n) };
  }

  /** Lo que anota una persona ("Ya le hablé por…"). */
  @Post()
  async anotar(@Req() req: AdminRequest, @Body() body: unknown) {
    return this.guardar(req, body, false);
  }

  /**
   * Lo que el panel anota SOLO al apretar un botón que llama o abre WhatsApp.
   * Ruta aparte para que el panel no avise "Listo" ni "No se guardó" por algo
   * que la persona no pidió guardar (ver `silencio` en AdminShell).
   */
  @Post('solo')
  async anotarSolo(@Req() req: AdminRequest, @Body() body: unknown) {
    return this.guardar(req, body, true);
  }

  /** Los recordatorios de quien entra que ya tocan: salen en su Inicio. */
  @Get('recordatorios')
  async recordatorios(@Req() req: AdminRequest) {
    return { recordatorios: await recordatoriosDe(req) };
  }

  /** Nota, resultado, recordatorio, "ya quedó" o quitarlo. Solo quien lo anotó (o Dirección). */
  @Patch(':id')
  async cambiar(@Req() req: AdminRequest, @Param('id', ParseIntPipe) renglon: number, @Body() body: unknown) {
    const p = cambioSchema.safeParse(body ?? {});
    if (!p.success) throw new BadRequestException('Datos inválidos');
    return { ok: true, renglon: await corregirContacto(req, renglon, p.data) };
  }

  private async guardar(req: AdminRequest, body: unknown, auto: boolean) {
    const p = anotacionSchema.safeParse(body ?? {});
    if (!p.success) throw new BadRequestException('Datos inválidos');
    const { objetivo, tipos } = objetivoDe(p.data);
    await exigirEn(req, tipos);
    const renglon = await anotarContacto(req, {
      objetivo,
      con: p.data.con,
      canal: p.data.canal,
      a: p.data.a,
      nota: p.data.nota,
      res: p.data.res,
      recordar: p.data.recordar,
      auto,
    });
    return { ok: true, renglon };
  }
}
