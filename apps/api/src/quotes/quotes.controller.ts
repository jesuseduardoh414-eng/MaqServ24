import { BadRequestException, Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { QuotesService } from './quotes.service';
import { JwtGuard, type AuthedRequest } from '../auth/jwt.guard';

const quoteSchema = z.object({
  // Sin `.min(1)`: transporte, triturados, materiales y asfalto se cotizan por
  // volumen y recorrido, no por un equipo del catálogo, así que llegan sin
  // items y con `service`.
  // La validación de "trae items O trae servicio" vive en el servicio.
  items: z.array(z.object({
    productId: z.number().int().positive(),
    qty: z.number().int().min(1).max(999),
    days: z.number().int().min(1).max(365).optional(),
  })),
  /** Categoría de servicio cuando la cotización no parte de un equipo. */
  service: z.string().max(120).optional(),
  serviceCategory: z.string().max(120).optional(),
  /** Respuestas del formulario propio de la categoría (documento, 8 a 13). */
  requirements: z.record(z.string(), z.string().max(2000)).optional(),
  customer: z.object({
    name: z.string().min(2).max(190),
    email: z.string().email().max(190),
    phone: z.string().min(7).max(30),
    company: z.string().max(190).optional(),
    region: z.string().max(190).optional(),
    industry: z.string().max(190).optional(),
  }),
  acquisitionOption: z.string().max(100).optional(),
  address: z.string().max(400).optional(),
    siteId: z.coerce.number().int().positive().optional(),
  comments: z.string().max(2000).optional(),
});

@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  /**
   * PEDIR COTIZACIÓN EXIGE CUENTA (decisión del 2026-09-23).
   *
   * Antes era público y el Bearer era opcional: los invitados cotizaban y la
   * solicitud quedaba suelta. Se cerró porque el resto del camino ya exigía
   * cuenta —ver, aceptar y seguir la cotización— y un invitado se quedaba con
   * un folio que no podía abrir en ningún lado. Con cuenta, la solicitud nace
   * ligada a quien la pidió y no vuelve a capturar sus datos.
   *
   * El candado va AQUÍ y no solo en la pantalla: si solo lo pusiera el sitio,
   * cualquiera con curl seguiría entrando como invitado.
   */
  // Cotiza flete (sale a la API de Google, que se paga por petición): con o sin
  // cuenta, sin límite es factura ajena.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post()
  @UseGuards(JwtGuard)
  async create(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = quoteSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Datos inválidos');
    }
    return this.quotes.create(parsed.data, req.userId);
  }

  @Get('mine')
  @UseGuards(JwtGuard)
  mine(@Req() req: AuthedRequest) {
    return this.quotes.listByUser(req.userId);
  }

  /**
   * Las obras del cliente de esta cuenta.
   *
   * Sirve para que el cotizador no le vuelva a pedir la ubicacion a quien ya
   * la dio. Va aqui y no en `account` porque es un dato del cotizador: fuera
   * de cotizar, al cliente no le sirve de nada una lista de sus obras.
   */
  @Get('mis-obras')
  @UseGuards(JwtGuard)
  misObras(@Req() req: AuthedRequest) {
    return this.quotes.sitesOfUser(req.userId);
  }

  @Get(':quoteNumber')
  @UseGuards(JwtGuard)
  byNumber(@Req() req: AuthedRequest, @Param('quoteNumber') quoteNumber: string) {
    return this.quotes.byNumber(req.userId, quoteNumber);
  }

  /** El documento imprimible de la cotización (folio, partidas, condiciones, firma). */
  @Get(':quoteNumber/documento')
  @UseGuards(JwtGuard)
  documento(@Req() req: AuthedRequest, @Param('quoteNumber') quoteNumber: string) {
    return this.quotes.documento(req.userId, quoteNumber);
  }

  /**
   * El cliente acepta la cotizacion. Es lo que el documento llama convertir la
   * cotizacion aceptada en compromiso, y queda con fecha para saber QUE VERSION
   * se acepto.
   *
   * Solo se puede aceptar una respondida y dentro de su vigencia: aceptar una
   * vencida seria comprometer un precio que ya nadie sostiene.
   */
  @Post(':quoteNumber/accept')
  @UseGuards(JwtGuard)
  accept(@Req() req: AuthedRequest, @Param('quoteNumber') quoteNumber: string) {
    return this.quotes.accept(req.userId, quoteNumber);
  }
}
