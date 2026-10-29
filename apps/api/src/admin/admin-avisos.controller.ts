import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { z } from 'zod';
import { AdminGuard, Modulo, type AdminRequest } from './admin-auth';
import { permisosVigentes } from './permisos';
import { avisosDelPanel, marcarAvisosPanel } from '../notifications/panel';
import { ultimoCambio } from '../common/cambios';

/**
 * La campana del panel (ver `notifications/panel.ts`). Todos los roles la
 * tienen (`inicio`); cada quien recibe solo los avisos de sus módulos. La
 * campana pregunta seguido con `?despues=<último id>`: si no hay nada nuevo la
 * respuesta es mínima. Lleva además `cambio`, la hora del último guardado en
 * el sistema, con la que la pantalla abierta se pone al día (common/cambios.ts).
 */
@Modulo('inicio')
@Controller('admin/avisos')
@UseGuards(AdminGuard)
@SkipThrottle()
export class AdminAvisosController {
  @Get()
  async lista(@Req() req: AdminRequest, @Query('despues') despues?: string) {
    const n = Number(despues);
    const avisos = await avisosDelPanel(req.adminId, req.adminRol, await permisosVigentes(), Number.isInteger(n) && n > 0 ? n : undefined);
    return { ...avisos, cambio: ultimoCambio() };
  }

  @Post('leido')
  async leido(@Req() req: AdminRequest, @Body() body: unknown) {
    // Un id inválido NO es "marcar todos" (QA 2026-09-25).
    const p = z.object({ id: z.number().int().positive().optional() }).safeParse(body ?? {});
    if (!p.success) throw new BadRequestException('Aviso inválido');
    return marcarAvisosPanel(req.adminId, req.adminRol, await permisosVigentes(), p.data.id);
  }
}
