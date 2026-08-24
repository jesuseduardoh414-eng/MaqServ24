import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import type { QuoteDetail, QuoteItem, QuoteRequestInput, QuoteSummary } from '@maqserv/types';
import { imageUrl } from '../catalog/images';
import { FreightService } from '../freight/freight.service';

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
    };
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
    };
  }
}
