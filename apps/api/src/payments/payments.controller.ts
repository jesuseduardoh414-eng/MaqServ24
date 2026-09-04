import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('methods')
  methods() {
    return this.payments.methods();
  }

  /**
   * MercadoPago manda GET o POST según el tipo de notificación.
   *
   * SIN límite a propósito: MP reintenta en ráfagas y todas sus notificaciones llegan
   * desde sus propias IPs, o sea del mismo cupo. Un 429 aquí sería un pago cobrado que
   * nunca se marca como pagado — el peor fallo posible. Abusar de esto no lleva a nada:
   * el handler verifica cada pago CONTRA la API de MP antes de tocar la orden.
   */
  @SkipThrottle()
  @Post('mercadopago/webhook')
  webhook(
    @Query() query: Record<string, unknown>,
    @Body() body: unknown,
    @Headers() headers: Record<string, string | undefined>,
  ) {
    return this.payments.handleMercadoPagoWebhook(query, body, headers);
  }

  @SkipThrottle()
  @Get('mercadopago/webhook')
  webhookGet(
    @Query() query: Record<string, unknown>,
    @Headers() headers: Record<string, string | undefined>,
  ) {
    return this.payments.handleMercadoPagoWebhook(query, null, headers);
  }
}
