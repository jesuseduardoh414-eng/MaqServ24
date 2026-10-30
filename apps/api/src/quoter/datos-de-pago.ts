import { pagoSchema, type PagoCotizador } from '@maqserv/config';
import { prisma } from '@maqserv/db';

/**
 * Los datos para el pago VIGENTES del tabulador (2026-10-30).
 *
 * El documento guardado congela precios y condiciones, pero las cuentas son
 * las de hoy: si un día cambia el banco, una cotización vieja que el cliente
 * abre para pagar tiene que enseñar la cuenta buena. Lo usan el historial del
 * panel y la cuenta del cliente. Sin cuentas, null (el documento omite la sección).
 */
export async function datosDePago(tipo: string): Promise<PagoCotizador | null> {
  const fila = await prisma.quoter_catalogs.findUnique({ where: { kind: tipo }, select: { data: true } });
  const p = pagoSchema.safeParse((fila?.data as { pago?: unknown } | null)?.pago);
  return p.success && p.data.cuentas.length ? p.data : null;
}
