import { prisma } from '@maqserv/db';

/**
 * RESERVA DE UNA MÁQUINA (2026-09-25).
 *
 * Cuando el cliente solicita una máquina concreta, esa máquina queda apartada
 * esas fechas: un bloqueo `reservado` en `availability_blocks` con la nota
 * `reserva:<folio>`. Así el recomendador no se la ofrece a otro cliente en el
 * mismo periodo (cuenta reservas contra sus unidades) y, si el aliado rechaza
 * o el servicio se cancela, la reserva se libera sola.
 *
 * Se aparta desde la SOLICITUD y no desde la aceptación, a propósito: entre
 * una y otra pueden pasar horas, y dos clientes pidiendo la misma máquina
 * para el mismo viernes acabarían con uno sin máquina.
 */

const nota = (folio: string) => `reserva:${folio}`;

export async function reservar(d: { productId: number; folio: string; desde: string; hasta: string }): Promise<void> {
  await prisma.availability_blocks.create({
    data: {
      product_id: d.productId,
      state: 'reservado',
      starts_on: new Date(`${d.desde}T00:00:00Z`),
      ends_on: new Date(`${d.hasta}T00:00:00Z`),
      note: nota(d.folio),
    },
  });
}

/** Quita la reserva de un servicio (por id de cotización). Nunca lanza. */
export async function liberarReserva(quoteId: number): Promise<void> {
  try {
    const q = await prisma.quotes.findUnique({ where: { id: quoteId }, select: { quote_number: true } });
    if (!q) return;
    await prisma.availability_blocks.deleteMany({ where: { state: 'reservado', note: nota(q.quote_number) } });
  } catch {
    // Una reserva que no se pudo liberar se ve en Disponibilidad y se quita a mano.
  }
}
