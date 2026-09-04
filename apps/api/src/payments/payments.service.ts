import { ForbiddenException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { prisma } from '@maqserv/db';
import type { OrderSummary, PaymentMethod } from '@maqserv/types';
import { OrdersService } from '../orders/orders.service';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3000';
const API_PUBLIC_URL = process.env.API_PUBLIC_URL ?? 'http://localhost:4000';

/**
 * Pagos tras una interfaz común.
 * - transferencia: offline (gateway legacy "Deposito bancario"), sin proveedor.
 * - mercadopago: Checkout Pro (preferencia → redirect → webhook), como el
 *   legacy pero con notification_url (el viejo solo usaba back_urls).
 * Requiere MP_ACCESS_TOKEN (credenciales de SANDBOX en dev — pendiente usuario).
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  constructor(private readonly orders: OrdersService) {}

  /** Token de MercadoPago: primero el guardado en el panel, si no el de entorno. */
  private async mpToken(): Promise<string | null> {
    const gw = await prisma.payment_gateways.findFirst({ where: { code: 'mercadopago' } });
    const fromDb = gw?.secret?.trim();
    return fromDb || process.env.MP_ACCESS_TOKEN || null;
  }

  private async mpClient(): Promise<MercadoPagoConfig | null> {
    const token = await this.mpToken();
    return token ? new MercadoPagoConfig({ accessToken: token }) : null;
  }

  /** Métodos habilitados (Panel → Pagos). Nunca expone `secret`. */
  async methods(): Promise<PaymentMethod[]> {
    const rows = await prisma.payment_gateways.findMany();
    const byCode = new Map(rows.map((r) => [r.code, r]));
    const transfer = byCode.get('transferencia');
    const mp = byCode.get('mercadopago');
    const mpToken = (mp?.secret?.trim() || process.env.MP_ACCESS_TOKEN || '').trim();

    return [
      {
        id: 'transferencia',
        title: transfer?.title ?? 'Transferencia bancaria',
        instructions: transfer?.text ?? null,
        available: (transfer?.status ?? 1) === 1,
      },
      {
        id: 'mercadopago',
        title: mp?.title ?? 'MercadoPago',
        instructions: mp?.text ?? null,
        // Solo disponible si está activo Y tiene credencial configurada.
        available: (mp?.status ?? 0) === 1 && mpToken.length > 0,
      },
    ];
  }

  /** Crea la preferencia de Checkout Pro y devuelve la URL de redirección. */
  async createMercadoPagoRedirect(order: OrderSummary): Promise<string> {
    const client = await this.mpClient();
    if (!client) {
      throw new ServiceUnavailableException(
        'MercadoPago no está configurado (falta la credencial en Panel → Pagos)',
      );
    }

    const preference = await new Preference(client).create({
      body: {
        // Igual que el legacy: un solo item con el total
        items: [
          {
            id: order.orderNumber,
            title: 'Total de compra',
            quantity: 1,
            unit_price: order.total,
          },
        ],
        external_reference: order.orderNumber,
        back_urls: {
          success: `${SITE_URL}/pedido/${order.orderNumber}`,
          pending: `${SITE_URL}/pedido/${order.orderNumber}`,
          failure: `${SITE_URL}/checkout`,
        },
        auto_return: 'all',
        notification_url: `${API_PUBLIC_URL}/payments/mercadopago/webhook`,
      },
    });

    const url = preference.init_point ?? preference.sandbox_init_point;
    if (!url) throw new ServiceUnavailableException('MercadoPago no devolvió URL de pago');
    return url;
  }

  /**
   * Valida la firma `x-signature` de MercadoPago (manifiesto oficial:
   * `id:{data.id};request-id:{x-request-id};ts:{ts};` firmado HMAC-SHA256 con
   * el secreto del webhook). Devuelve `null` si no hay MP_WEBHOOK_SECRET
   * configurado — la firma es defensa en profundidad opcional; la defensa
   * principal sigue siendo re-consultar el pago contra la API de MP.
   */
  private verifySignature(headers: Record<string, string | undefined>, dataId: string): boolean | null {
    const secret = process.env.MP_WEBHOOK_SECRET?.trim();
    if (!secret) return null;
    const sig = headers['x-signature'] ?? '';
    const requestId = headers['x-request-id'] ?? '';
    const parts: Record<string, string> = {};
    for (const chunk of sig.split(',')) {
      const i = chunk.indexOf('=');
      if (i > 0) parts[chunk.slice(0, i).trim()] = chunk.slice(i + 1).trim();
    }
    if (!parts['ts'] || !parts['v1']) return false;
    const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts['ts']};`;
    const digest = createHmac('sha256', secret).update(manifest).digest('hex');
    try {
      return timingSafeEqual(Buffer.from(digest), Buffer.from(parts['v1']));
    } catch {
      return false;
    }
  }

  /**
   * Webhook de MercadoPago: verifica el pago CONTRA LA API de MP (nunca
   * confiar en el payload) y marca la orden pagada si está aprobado.
   *
   * REGLA DE CÓDIGOS HTTP — MP decide si reintenta por el CÓDIGO, no por el
   * body. Un fallo INTERNO (sin credencial, red, BD caída) debe ser 5xx para
   * que MP reintente; antes se devolvía `{ok:false}` con 201 y la notificación
   * se archivaba para siempre: pago cobrado, orden eternamente pendiente.
   * 2xx solo cuando la notificación no aplica o ya quedó procesada.
   */
  async handleMercadoPagoWebhook(
    query: Record<string, unknown>,
    body: unknown,
    headers: Record<string, string | undefined> = {},
  ): Promise<{ ok: boolean }> {
    const b = (body ?? {}) as { type?: string; data?: { id?: string } };
    const type = (query['type'] as string) ?? b.type;
    const paymentId = (query['data.id'] as string) ?? b.data?.id;
    if (type !== 'payment' || !paymentId) return { ok: true }; // notificación que no nos aplica

    // Firma inválida = petición forjada: 403 y fuera. (null = sin secreto, se omite.)
    if (this.verifySignature(headers, String(paymentId)) === false) {
      this.logger.warn(`Webhook MP: firma x-signature inválida para el pago ${paymentId}`);
      throw new ForbiddenException('Firma inválida');
    }

    const client = await this.mpClient();
    if (!client) {
      throw new ServiceUnavailableException('MercadoPago no está configurado; reintentar');
    }

    try {
      const payment = await new Payment(client).get({ id: paymentId });
      if (payment.status === 'approved' && payment.external_reference) {
        await this.orders.markPaid(
          payment.external_reference,
          String(payment.id),
          typeof payment.transaction_amount === 'number' ? payment.transaction_amount : null,
        );
        this.logger.log(`Orden ${payment.external_reference} pagada (MP ${payment.id})`);
      }
      return { ok: true };
    } catch (err) {
      this.logger.error(`Webhook MP: error verificando pago ${paymentId}`, err as Error);
      throw new ServiceUnavailableException('No se pudo verificar el pago; reintentar');
    }
  }
}
