import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { checkoutFreightSchema } from '@maqserv/config';
import { AdminGuard, Modulo } from './admin-auth';
import { FreightService } from '../freight/freight.service';

const testInput = z.object({
  address: z.string().min(3).max(300),
  /** Config en edición: permite probar antes de publicar. */
  config: checkoutFreightSchema.optional(),
});

/** Probador del cotizador de traslado (Panel → Traslado). */
@Modulo('configuracion')
@Controller('admin/freight')
@UseGuards(AdminGuard)
export class AdminFreightController {
  constructor(private readonly freight: FreightService) {}

  @Post('test')
  async test(@Body() body: unknown) {
    const parsed = testInput.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Escribe una dirección para probar');
    const { address, config } = parsed.data;
    const [quote, origin] = await Promise.all([
      this.freight.quote({ address, config }),
      this.freight.resolveOrigin(config),
    ]);
    return {
      ...quote,
      origin,
      provider: process.env.GOOGLE_DISTANCE_MATRIX_API_KEY ? 'google' : 'osm',
    };
  }
}
