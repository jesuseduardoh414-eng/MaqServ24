import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import type { QuoteDetail, QuoteItem, QuoteRequestInput, QuoteSummary } from '@maqserv/types';
import { formatearCantidad } from '@maqserv/config';
import { imageUrl } from '../catalog/images';
import { FreightService } from '../freight/freight.service';
import { estadoCotizacion, sePuedeAceptar, diasParaVencer } from './quote-validity';
import { PASOS, avance, esEstado, estadoInicial, type EstadoServicio } from './service-flow';

/** Formato legacy: COT- + 8 alfanuméricos mayúsculas. */
function newQuoteNumber(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `COT-${s}`;
}

@Injectable()
export class QuotesService {
  constructor(private readonly freight: FreightService) {}

  private toSummary(q: {
    id: bigint; quote_number: string; status: string;
    subtotal: unknown; freight_cost: unknown; freight_distance: string | null;
    tax: unknown; total: unknown; created_at: Date | null;
    valid_until?: Date | null; accepted_at?: Date | null;
  }): QuoteSummary {
    return {
      id: Number(q.id),
      quoteNumber: q.quote_number,
      status: q.status,
      subtotal: Number(q.subtotal),
      freightCost: Number(q.freight_cost),
      freightDistance: q.freight_distance,
      tax: Number(q.tax),
      total: Number(q.total),
      createdAt: q.created_at ? q.created_at.toISOString() : null,
      state: estadoCotizacion({ status: q.status, validUntil: q.valid_until ?? null, acceptedAt: q.accepted_at ?? null }),
      validUntil: q.valid_until ? q.valid_until.toISOString().slice(0, 10) : null,
      daysToExpire: diasParaVencer(q.valid_until ?? null),
    };
  }

  async create(input: QuoteRequestInput, userId: number | null): Promise<QuoteDetail> {
    // Una cotización necesita equipos O una categoría de servicio. Lo segundo
    // es para agua en pipas y triturados: ahí no hay SKU que elegir — lo que
    // define el precio es volumen, origen, destino y fechas, y eso viene en el
    // texto de la solicitud. Todo lo de abajo ya tolera `items` vacío: los
    // totales dan cero y `cart_data` sale como un objeto vacío.
    if (input.items.length === 0 && !input.service) {
      throw new BadRequestException('La solicitud no tiene productos');
    }

    const ids = input.items.map((i) => i.productId);
    const products = await prisma.products.findMany({
      where: { id: { in: ids }, status: 1 },
      select: { id: true, name: true, cprice: true, photo: true, is_rental: true, rental_freight: true, stock: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    // Distancia para flete (solo si dieron dirección; degrada a null sin API key)
    const dist = input.address ? await this.freight.distanceTo(input.address) : null;
    const distanceKm = dist?.km ?? 0;

    const items: QuoteItem[] = input.items.map((i) => {
      const p = byId.get(i.productId);
      if (!p) throw new BadRequestException(`Producto ${i.productId} no disponible`);
      const qty = Math.max(1, Math.min(999, Math.floor(i.qty)));
      const days = p.is_rental ? Math.max(1, Math.min(365, Math.floor(i.days ?? 1))) : 1;
      // Fórmula legacy: renta → cprice×días + flete (tarifa base × km, o base sin distancia)
      const baseFreight = p.rental_freight ? Number(p.rental_freight) : 0;
      const freightUnit = p.is_rental ? (distanceKm > 0 ? baseFreight * distanceKm : baseFreight) : 0;
      const lineTotal = Math.round(((p.cprice * days + freightUnit) * qty) * 100) / 100;
      return {
        productId: p.id,
        name: p.name,
        price: p.cprice,
        qty,
        days,
        isRental: p.is_rental,
        freight: Math.round(freightUnit * 100) / 100,
        lineTotal,
        image: imageUrl(p.photo),
      };
    });

    const subtotal = Math.round(items.reduce((s, i) => s + i.price * i.days * i.qty, 0) * 100) / 100;
    const freightCost = Math.round(items.reduce((s, i) => s + i.freight * i.qty, 0) * 100) / 100;
    const total = Math.round((subtotal + freightCost) * 100) / 100;

    // cart_data en el formato keyed-map del legacy (el admin viejo lo puede leer)
    const cartData: Record<string, unknown> = {};
    for (const it of items) {
      cartData[String(it.productId)] = {
        qty: it.qty,
        days: it.days,
        price: it.lineTotal,
        item: { id: it.productId, name: it.name, cprice: it.price, photo: it.image },
      };
    }

    const q = await prisma.quotes.create({
      data: {
        user_id: userId ?? null,
        name: input.customer.name,
        email: input.customer.email,
        phone: input.customer.phone,
        company_name: input.customer.company ?? null,
        region: input.customer.region ?? null,
        industry: input.customer.industry ?? null,
        // Sin equipos, lo que el admin necesita ver en el listado es qué
        // servicio se pidió; si no, la fila sale en blanco.
        product_interested: (items.length ? items.map((i) => i.name).join(', ') : (input.service ?? '')).slice(0, 250),
        acquisition_option: input.acquisitionOption ?? null,
        comments: input.comments ?? null,
        service_category: input.serviceCategory ?? null,
        requirements: (input.requirements as never) ?? undefined,
        address: input.address ?? null,
        cart_data: JSON.stringify(cartData),
        subtotal,
        freight_cost: freightCost,
        freight_distance: dist ? String(dist.km) : null,
        tax: 0,
        total,
        status: 'pending',
        quote_number: newQuoteNumber(),
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    return {
      ...this.toSummary(q),
      items,
      customer: {
        name: q.name,
        email: q.email,
        phone: q.phone,
        company: q.company_name,
        region: q.region,
        industry: q.industry,
      },
      address: q.address,
      comments: q.comments,
      conditions: q.conditions,
      state: estadoCotizacion({ status: q.status, validUntil: q.valid_until, acceptedAt: q.accepted_at }),
      validUntil: q.valid_until ? q.valid_until.toISOString().slice(0, 10) : null,
      daysToExpire: diasParaVencer(q.valid_until),
      included: q.included,
      excluded: q.excluded,
      respondedBy: q.responded_by,
      acceptedAt: q.accepted_at ? q.accepted_at.toISOString() : null,
      canAccept: sePuedeAceptar({ status: q.status, validUntil: q.valid_until, acceptedAt: q.accepted_at }),
      // Recién creada no hay servicio que seguir: falta que la respondan y
      // que el cliente la acepte.
      service: null,
    };
  }

  /**
   * El cliente acepta la cotizacion.
   *
   * Se comprueba la vigencia AQUI y no solo en la pantalla: el boton se puede
   * dejar abierto en una pestana y darle dias despues, cuando el precio ya no
   * se sostiene. Aceptar una vencida seria comprometer una cifra que nadie
   * respalda, que es justo la diferencia comercial que el documento pide evitar.
   */
  async accept(userId: number, quoteNumber: string): Promise<QuoteDetail> {
    const q = await prisma.quotes.findFirst({ where: { quote_number: quoteNumber, user_id: userId } });
    if (!q) throw new NotFoundException('Cotizacion no encontrada');

    if (q.accepted_at) return this.byNumber(userId, quoteNumber); // ya aceptada: no se duplica
    const estado = estadoCotizacion({ status: q.status, validUntil: q.valid_until, acceptedAt: q.accepted_at });
    if (estado === 'pendiente') throw new BadRequestException('Esta cotizacion todavia no tiene respuesta');
    if (estado === 'vencida') throw new BadRequestException('Esta cotizacion ya vencio. Pide una actualizacion.');
    if (estado === 'rechazada') throw new BadRequestException('Esta cotizacion fue descartada');

    const ahora = new Date();
    await prisma.quotes.update({
      where: { id: q.id },
      data: {
        accepted_at: ahora,
        updated_at: ahora,
        // Aceptar es lo que mete la operación al tablero. Antes el rastro
        // terminaba aquí: lo que pasaba después vivía en llamadas.
        service_state: estadoInicial(),
      },
    });
    await prisma.service_events.create({
      data: { quote_id: q.id, to_state: estadoInicial(), note: 'El cliente aceptó la cotización' },
    });
    return this.byNumber(userId, quoteNumber);
  }

  async listByUser(userId: number): Promise<QuoteSummary[]> {
    const rows = await prisma.quotes.findMany({
      where: { user_id: userId },
      orderBy: { id: 'desc' },
      take: 50,
    });
    return rows.map((q) => this.toSummary(q));
  }

  async byNumber(userId: number, quoteNumber: string): Promise<QuoteDetail> {
    const q = await prisma.quotes.findFirst({
      where: { quote_number: quoteNumber, user_id: userId },
    });
    if (!q) throw new NotFoundException('Cotización no encontrada');

    let items: QuoteItem[] = [];
    try {
      const cart = JSON.parse(q.cart_data) as Record<string, { qty: number; days?: number; price: number; item: { id: number; name: string; cprice: number; photo: string | null } }>;
      items = Object.values(cart).map((c) => ({
        productId: c.item.id,
        name: c.item.name,
        price: c.item.cprice,
        qty: c.qty,
        days: c.days ?? 1,
        isRental: (c.days ?? 1) > 1,
        freight: 0,
        lineTotal: c.price,
        image: c.item.photo,
      }));
    } catch {
      items = [];
    }

    return {
      ...this.toSummary(q),
      items,
      customer: {
        name: q.name,
        email: q.email,
        phone: q.phone,
        company: q.company_name,
        region: q.region,
        industry: q.industry,
      },
      address: q.address,
      comments: q.comments,
      conditions: q.conditions,
      state: estadoCotizacion({ status: q.status, validUntil: q.valid_until, acceptedAt: q.accepted_at }),
      validUntil: q.valid_until ? q.valid_until.toISOString().slice(0, 10) : null,
      daysToExpire: diasParaVencer(q.valid_until),
      included: q.included,
      excluded: q.excluded,
      respondedBy: q.responded_by,
      acceptedAt: q.accepted_at ? q.accepted_at.toISOString() : null,
      canAccept: sePuedeAceptar({ status: q.status, validUntil: q.valid_until, acceptedAt: q.accepted_at }),
      service: await this.servicioDe(q),
    };
  }

  /**
   * En qué va el servicio, contado para el cliente.
   *
   * Se muestran SOLO los aliados que aceptaron. A quién más se le ofreció y
   * quién dijo que no es información de operaciones: al cliente le importa
   * quién lo va a atender, y enseñarle los rechazos lo haría dudar de una
   * decisión que ya se resolvió.
   */
  private async servicioDe(q: {
    id: bigint; service_state: string | null; service_unit: string | null;
    service_quantity: unknown; service_started_at: Date | null; service_closed_at: Date | null;
  }): Promise<QuoteDetail['service']> {
    if (!esEstado(q.service_state)) return null;
    const estado = q.service_state;

    const [asignaciones, eventos] = await Promise.all([
      prisma.service_assignments.findMany({
        where: { quote_id: q.id, state: 'aceptado' },
        include: { providers: { select: { name: true } } },
      }),
      prisma.service_events.findMany({
        where: { quote_id: q.id },
        orderBy: { id: 'asc' },
        select: { to_state: true, created_at: true },
      }),
    ]);

    const cantidad = q.service_quantity ? Number(q.service_quantity) : null;

    return {
      state: estado,
      label: PASOS[estado].label,
      message: PASOS[estado].cliente,
      progress: avance(estado),
      providers: asignaciones.map((a) => a.providers.name),
      startedAt: q.service_started_at ? q.service_started_at.toISOString() : null,
      closedAt: q.service_closed_at ? q.service_closed_at.toISOString() : null,
      closed: cantidad ? formatearCantidad(cantidad, q.service_unit) : null,
      // Solo los pasos del servicio: las respuestas de los aliados
      // (`propuesto`, `rechazado`) son de operaciones, no del cliente.
      history: eventos
        .filter((e) => esEstado(e.to_state))
        .map((e) => ({
          label: PASOS[e.to_state as EstadoServicio].label,
          note: null,
          at: e.created_at ? e.created_at.toISOString() : null,
        })),
    };
  }
}
