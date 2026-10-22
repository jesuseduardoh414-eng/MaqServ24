import { BadRequestException, Body, Controller, Get, Headers, NotFoundException, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { prisma } from '@maqserv/db';
import { formatearCantidad } from '@maqserv/config';
import { avisarPanel } from '../notifications/panel';
import { leerResena } from './resena-link';

const resenaSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional().default(''),
});

const tokenDe = (auth?: string) => (auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null);

/**
 * CALIFICAR UN SERVICIO (2026-10-12) — público, con el enlace del correo de cierre.
 *
 * Solo se califica un servicio CERRADO: antes no hay nada que calificar, y
 * una reseña a medio servicio es una queja que debe ir a Operaciones, no al
 * sitio. Una por servicio: volver a enviar la cambia, y la regresa a
 * "por revisar" para que nadie publique un texto que no se leyó.
 */
@Controller('resenas/servicio')
export class ServiceReviewsController {
  private async servicio(auth?: string) {
    const id = await leerResena(tokenDe(auth));
    if (!id) throw new NotFoundException('Este enlace ya no sirve. Puede haber caducado.');
    const q = await prisma.quotes.findUnique({
      where: { id },
      select: {
        id: true, quote_number: true, name: true, product_interested: true, service_category: true,
        user_id: true, service_state: true, service_closed_at: true, service_quantity: true, service_unit: true,
      },
    });
    if (!q || q.service_state !== 'cerrado') throw new NotFoundException('Este servicio todavía no se puede calificar.');
    const aliados = await prisma.service_assignments.findMany({
      where: { quote_id: q.id, state: 'aceptado' },
      select: { provider_id: true, providers: { select: { name: true } } },
    });
    return { q, aliados };
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get()
  async ver(@Headers('authorization') auth?: string) {
    const { q, aliados } = await this.servicio(auth);
    const r = await prisma.service_reviews.findUnique({ where: { quote_id: q.id }, select: { rating: true, comment: true } });
    // A la persona de la cuenta por su nombre de pila; sin cuenta, el nombre
    // completo: muchas veces es la empresa ("Gracias, Constructora" no).
    const cuenta = q.user_id ? await prisma.users.findUnique({ where: { id: Number(q.user_id) }, select: { name: true } }) : null;
    return {
      folio: q.quote_number,
      nombre: cuenta?.name?.trim() ? cuenta.name.trim().split(/\s+/)[0] : q.name.trim(),
      // Solo la línea: lo que sigue a " · " es interno ("cotizador de maquinaria · MQ-…").
      servicio: q.product_interested?.split(' · ')[0] || q.service_category || 'Tu servicio',
      aliados: aliados.map((a) => a.providers.name),
      cerradoEl: q.service_closed_at,
      cantidad: q.service_quantity ? formatearCantidad(Number(q.service_quantity), q.service_unit ?? '') : null,
      resena: r ? { rating: r.rating, comment: r.comment ?? '' } : null,
    };
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post()
  async calificar(@Headers('authorization') auth: string | undefined, @Body() body: unknown) {
    const p = resenaSchema.safeParse(body);
    if (!p.success) throw new BadRequestException('Elige de 1 a 5 estrellas. El comentario puede tener hasta 1,000 caracteres.');
    const { q, aliados } = await this.servicio(auth);
    const ahora = new Date();
    const datos = { rating: p.data.rating, comment: p.data.comment || null, status: 0, updated_at: ahora };
    const antes = await prisma.service_reviews.findUnique({ where: { quote_id: q.id }, select: { id: true } });
    await prisma.service_reviews.upsert({
      where: { quote_id: q.id },
      create: { quote_id: q.id, provider_id: aliados[0]?.provider_id ?? null, author: q.name.slice(0, 190), created_at: ahora, ...datos },
      update: datos,
    });
    void avisarPanel({
      modulo: 'comunidad',
      evento: 'resena',
      titulo: `${antes ? 'Reseña cambiada' : 'Reseña nueva'}: ${'★'.repeat(p.data.rating)} · ${q.quote_number}`,
      cuerpo: p.data.comment ? p.data.comment.slice(0, 300) : `${q.name} calificó el servicio sin comentario.`,
      link: '/resenas',
    });
    return { ok: true };
  }
}
