import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { z } from 'zod';
import { AdminGuard, Modulo, type AdminRequest } from './admin-auth';
import { permisosVigentes } from './permisos';
import { avisosDelPanel, marcarAvisosPanel } from '../notifications/panel';

/**
 * La campana del panel (ver `notifications/panel.ts`). Todos los roles la
 * tienen (`inicio`); cada quien recibe solo los avisos de sus módulos. La
 * campana pregunta seguido con `?despues=<último id>`: si no hay nada nuevo la
 * respuesta es mínima.
 */
@Modulo('inicio')
@Controller('admin/avisos')
@UseGuards(AdminGuard)
@SkipThrottle()
export class AdminAvisosController {
  @Get()
  async lista(@Req() req: AdminRequest, @Query('despues') despues?: string) {
    const n = Number(despues);
    return avisosDelPanel(req.adminRol, await permisosVigentes(), Number.isInteger(n) && n > 0 ? n : undefined);
  }

  @Post('leido')
  async leido(@Req() req: AdminRequest, @Body() body: unknown) {
    const p = z.object({ id: z.number().int().positive().optional() }).safeParse(body ?? {});
    return marcarAvisosPanel(req.adminRol, await permisosVigentes(), p.success ? p.data.id : undefined);
  }
}
