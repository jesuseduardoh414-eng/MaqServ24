import { Logger } from '@nestjs/common';
import { Prisma, prisma } from '@maqserv/db';
import { comisionDe, reglasDinero, type ReglasDinero } from './reglas';

const log = new Logger('Cuentas');
const ZONA = 'America/Monterrey';
const DIA = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' });

/** "2026-10-22" de hoy (o de una fecha) en Monterrey. */
export const diaLocal = (d: Date = new Date()): string => DIA.format(d);
/** Fecha guardada como DATE (medianoche UTC) desde "2026-10-22". */
export const comoFecha = (iso: string): Date => new Date(`${iso}T00:00:00Z`);
export const masDias = (iso: string, n: number): string => {
  const d = comoFecha(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * El siguiente día de pago, contando hoy: si hoy es viernes y el día de pago
 * es viernes, es hoy.
 */
export function siguienteDiaDePago(desdeIso: string, diaDePago: number): string {
  const d = comoFecha(desdeIso);
  const faltan = (diaDePago - d.getUTCDay() + 7) % 7;
  return masDias(desdeIso, faltan);
}

/**
 * LA CUENTA DE UN SERVICIO CERRADO (2026-10-22).
 *
 * Se abre sola al cerrar el servicio (ServiceService.mover) y, por si eso
 * falló o el servicio se cerró antes de que existiera esto, la corrida diaria
 * la abre a los cerrados que no la tengan (`asegurarCuentas`). Idempotente:
 * si ya existe, no la toca —lo que Administración haya ajustado manda—.
 *
 * Montos: lo que se cotizó (subtotal + fletes, IVA y total). El aliado es el
 * que aceptó. El cliente paga al cerrar o a los días de crédito que tenga.
 */
export async function abrirCuenta(quoteId: number): Promise<boolean> {
  try {
    const ya = await prisma.service_money.findUnique({ where: { quote_id: BigInt(quoteId) }, select: { quote_id: true } });
    if (ya) return false;
    const q = await prisma.quotes.findUnique({
      where: { id: quoteId },
      select: {
        id: true, service_state: true, service_category: true, service_closed_at: true, client_id: true,
        subtotal: true, freight_cost: true, tax: true, total: true,
      },
    });
    if (!q || q.service_state !== 'cerrado') return false;
    const aliado = await prisma.service_assignments.findFirst({
      where: { quote_id: q.id, state: 'aceptado' },
      orderBy: { id: 'asc' },
      select: { provider_id: true },
    });
    const cliente = q.client_id ? await prisma.clients.findUnique({ where: { id: q.client_id }, select: { credito_dias: true } }) : null;
    const reglas = await reglasDinero();
    const pct = comisionDe(reglas, q.service_category);
    const subtotal = r2(Number(q.subtotal ?? 0) + Number(q.freight_cost ?? 0));
    const iva = r2(Number(q.tax ?? 0));
    const total = r2(Number(q.total ?? 0)) || r2(subtotal + iva);
    const cerrado = diaLocal(q.service_closed_at ?? new Date());
    await prisma.service_money.create({
      data: {
        quote_id: q.id,
        client_id: q.client_id,
        provider_id: aliado?.provider_id ?? null,
        subtotal: new Prisma.Decimal(subtotal),
        iva: new Prisma.Decimal(iva),
        total: new Prisma.Decimal(total),
        comision_pct: new Prisma.Decimal(pct),
        pago_aliado: new Prisma.Decimal(r2(subtotal * (1 - pct / 100))),
        vence: comoFecha(masDias(cerrado, Math.max(0, cliente?.credito_dias ?? 0))),
      },
    });
    return true;
  } catch (e) {
    // Nunca tumba el cierre: la corrida diaria la vuelve a intentar.
    log.warn(`No se pudo abrir la cuenta del servicio #${quoteId}: ${(e as Error).message}`);
    return false;
  }
}

/** Los servicios cerrados sin cuenta (corrida diaria). */
export async function asegurarCuentas(): Promise<number> {
  const cerrados = await prisma.quotes.findMany({ where: { service_state: 'cerrado' }, select: { id: true } });
  if (cerrados.length === 0) return 0;
  const con = new Set((await prisma.service_money.findMany({ select: { quote_id: true } })).map((m) => String(m.quote_id)));
  let n = 0;
  for (const c of cerrados) if (!con.has(String(c.id)) && (await abrirCuenta(Number(c.id)))) n += 1;
  return n;
}

/**
 * Si ya se puede pagar al aliado (el cliente pagó y él subió su factura), se
 * programa solo para el siguiente día de pago. Devuelve la fecha o null.
 */
export async function programarPago(quoteId: number): Promise<string | null> {
  const m = await prisma.service_money.findUnique({ where: { quote_id: BigInt(quoteId) } });
  if (!m || m.pagado_at || !m.cobrado_at || !m.factura_aliado_at || !m.provider_id) return null;
  if (m.pagar_el) return m.pagar_el.toISOString().slice(0, 10);
  const reglas = await reglasDinero();
  const fecha = siguienteDiaDePago(diaLocal(), reglas.diaDePago);
  await prisma.service_money.update({ where: { quote_id: m.quote_id }, data: { pagar_el: comoFecha(fecha), updated_at: new Date() } });
  return fecha;
}

/**
 * Lo que se le paga al aliado por un servicio, ANTES de que cierre (2026-10-22):
 * es lo que ve en la oferta y en su portal, no el precio al cliente. La misma
 * cuenta que `abrirCuenta`: lo cotizado sin IVA (con fletes) menos la comisión.
 */
export function parteDelAliado(
  q: { subtotal: unknown; freight_cost: unknown; tax: unknown; service_category: string | null },
  reglas: ReglasDinero,
): { monto: number; masIva: boolean; comisionPct: number } | null {
  const base = r2(Number(q.subtotal ?? 0) + Number(q.freight_cost ?? 0));
  if (base <= 0) return null;
  const pct = comisionDe(reglas, q.service_category);
  return { monto: r2(base * (1 - pct / 100)), masIva: Number(q.tax ?? 0) > 0, comisionPct: pct };
}

/** Lo que el aliado factura: su parte más IVA si el servicio llevó IVA. */
export function aFacturarPorAliado(m: { pago_aliado: unknown; iva: unknown }): number {
  const base = Number(m.pago_aliado);
  return Number(m.iva) > 0 ? r2(base * 1.16) : r2(base);
}
