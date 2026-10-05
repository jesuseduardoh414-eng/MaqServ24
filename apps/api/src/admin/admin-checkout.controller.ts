import { BadRequestException, Body, Controller, Get, NotFoundException, Patch, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { prisma } from '@maqserv/db';
import { checkoutFreightSchema, checkoutOperatorSchema, checkoutSchema, checkoutTaxSchema, type CheckoutConfig } from '@maqserv/config';
import { AdminGuard, Modulo, type AdminRequest } from './admin-auth';
import { registrarAccion } from './audit';
import { revalidarSitio } from '../common/revalidar-sitio';

/**
 * AJUSTES DEL CHECKOUT: Panel → Pagos (IVA, operador, nota) y Panel →
 * Traslado (tarifa por km) — 2026-10-05.
 *
 * Antes las dos pantallas guardaban el TEMA ENTERO como borrador y lo
 * publicaban: cualquier cambio de Diseño a medias (un hero sin terminar, un
 * color de prueba) salía al sitio con sólo tocar el IVA. Y pasaban por la ruta
 * de Diseño, así que quien tenía "configuración" sin "diseño" veía los valores
 * de fábrica y no podía guardar.
 *
 * Aquí se toca SÓLO `tokens.checkout`, y sólo las partes que se mandan (Pagos
 * no pisa la tarifa de Traslado ni al revés). Si hay un borrador de Diseño se
 * le aplica el mismo cambio: si no, al publicar Diseño volvería el checkout
 * viejo que traía el borrador.
 */
const parcial = z.object({
  tax: checkoutTaxSchema.optional(),
  operator: checkoutOperatorSchema.optional(),
  freight: checkoutFreightSchema.optional(),
  note: z.string().max(500).optional(),
}).strict();

@Modulo('configuracion')
@Controller('admin/checkout-config')
@UseGuards(AdminGuard)
export class AdminCheckoutController {
  /** Lo PUBLICADO (lo que cobra el carrito hoy), no el borrador de Diseño. */
  @Get()
  async get() {
    const t = await prisma.theme.findFirst({ where: { active: true }, select: { tokens: true, copys: true } });
    if (!t) throw new NotFoundException('No hay tema activo');
    const tokens = (t.tokens ?? {}) as { checkout?: unknown; contact?: { address?: string } };
    return {
      checkout: checkoutSchema.parse(tokens.checkout ?? {}),
      // Traslado enseña de dónde sale el viaje cuando no hay origen propio.
      contactAddress: tokens.contact?.address ?? '',
    };
  }

  @Patch()
  async save(@Req() req: AdminRequest, @Body() body: unknown) {
    const p = parcial.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.issues[0]?.message ?? 'Datos inválidos');
    if (Object.keys(p.data).length === 0) throw new BadRequestException('No hay cambios que guardar');

    const t = await prisma.theme.findFirst({ where: { active: true }, select: { id: true, tokens: true, draftTokens: true } });
    if (!t) throw new NotFoundException('No hay tema activo');

    const aplicar = (tok: unknown) => {
      const base = (tok ?? {}) as Record<string, unknown>;
      const actual = checkoutSchema.parse(base.checkout ?? {});
      const nuevo: CheckoutConfig = { ...actual, ...p.data };
      return { ...base, checkout: nuevo };
    };

    await prisma.theme.update({
      where: { id: t.id },
      data: {
        tokens: aplicar(t.tokens) as never,
        ...(t.draftTokens !== null ? { draftTokens: aplicar(t.draftTokens) as never } : {}),
      },
    });

    const { revalidated, revalidateError } = await revalidarSitio();
    const partes = Object.keys(p.data).join(', ');
    await registrarAccion(req, 'configuracion', 'ajustes del checkout', partes, revalidateError);
    return { ok: true, revalidated, revalidateError };
  }
}
