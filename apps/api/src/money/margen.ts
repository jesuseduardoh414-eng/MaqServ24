import { prisma } from '@maqserv/db';
import { aFacturarPorAliado, comoFecha, diaLocal } from './cuentas';

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface ResumenMes {
  mes: string;
  servicios: number;
  /** De esos servicios, cuántos ya pagó el cliente completo (2026-10-27). */
  cobrados: number;
  ventas: number;
  /** De las ventas (sin IVA), lo que ya pagaron los clientes: llena la barra al cobrar (2026-10-27). */
  cobrado: number;
  pagoAliados: number;
  margen: number;
  porLinea: Array<{ linea: string; nombre: string; servicios: number; ventas: number; margen: number }>;
}

/**
 * El margen de un mes (2026-10-22): los servicios CERRADOS en ese mes, sin
 * IVA. Ventas = lo cotizado; pago a aliados = su parte; margen = la
 * diferencia. Es por servicio cerrado y no por dinero cobrado: así el mes se
 * puede leer el día 1, sin esperar a que todos paguen.
 */
export async function resumenDelMes(mes: string): Promise<ResumenMes> {
  const desde = new Date(`${mes}-01T06:00:00Z`); // medianoche en Monterrey
  const [a, m] = mes.split('-').map(Number);
  const hasta = new Date(Date.UTC(m === 12 ? a + 1 : a, m === 12 ? 0 : m, 1, 6));
  const cerrados = await prisma.quotes.findMany({
    where: { service_state: 'cerrado', service_closed_at: { gte: desde, lt: hasta } },
    select: { id: true, service_category: true },
  });
  const cuentas = cerrados.length
    ? await prisma.service_money.findMany({ where: { quote_id: { in: cerrados.map((c) => c.id) } }, select: { quote_id: true, subtotal: true, pago_aliado: true, cobrado_at: true, total: true, cobrado: true } })
    : [];
  const linea = new Map(cerrados.map((c) => [String(c.id), c.service_category ?? 'otra']));
  const cats = await prisma.categories.findMany({ select: { cat_slug: true, cat_name: true } });
  const nombre = new Map(cats.map((c) => [c.cat_slug, c.cat_name]));
  const porLinea = new Map<string, { servicios: number; ventas: number; margen: number }>();
  let ventas = 0;
  let pago = 0;
  let cobrado = 0;
  for (const c of cuentas) {
    const v = Number(c.subtotal);
    const p = Number(c.pago_aliado);
    ventas += v; pago += p;
    // Lo cobrado va con IVA; a la barra entra la misma proporción de la venta sin IVA.
    const total = Number(c.total);
    cobrado += c.cobrado_at ? v : total > 0 ? v * Math.min(1, Number(c.cobrado) / total) : 0;
    const l = linea.get(String(c.quote_id)) ?? 'otra';
    const x = porLinea.get(l) ?? { servicios: 0, ventas: 0, margen: 0 };
    x.servicios += 1; x.ventas += v; x.margen += v - p;
    porLinea.set(l, x);
  }
  return {
    mes,
    servicios: cuentas.length,
    cobrados: cuentas.filter((c) => c.cobrado_at).length,
    ventas: r2(ventas),
    cobrado: r2(cobrado),
    pagoAliados: r2(pago),
    margen: r2(ventas - pago),
    porLinea: [...porLinea.entries()]
      .map(([l, x]) => ({ linea: l, nombre: nombre.get(l) ?? l, servicios: x.servicios, ventas: r2(x.ventas), margen: r2(x.margen) }))
      .sort((p, q) => q.ventas - p.ventas),
  };
}

/** Lo que está abierto hoy, con IVA: por cobrar (y cuánto ya venció) y por pagar a aliados. */
export async function pendientesHoy(): Promise<{ porCobrar: number; vencido: number; porPagar: number }> {
  const hoy = comoFecha(diaLocal());
  const [abiertas, porPagar] = await Promise.all([
    prisma.service_money.findMany({ where: { cobrado_at: null }, select: { total: true, cobrado: true, vence: true } }),
    prisma.service_money.findMany({ where: { pagado_at: null, provider_id: { not: null } }, select: { pago_aliado: true, iva: true } }),
  ]);
  let cobrar = 0;
  let vencido = 0;
  for (const c of abiertas) {
    const s = Math.max(0, Number(c.total) - Number(c.cobrado));
    cobrar += s;
    if (c.vence < hoy) vencido += s;
  }
  return { porCobrar: r2(cobrar), vencido: r2(vencido), porPagar: r2(porPagar.reduce((a, p) => a + aFacturarPorAliado(p), 0)) };
}

/** "2026-10" del mes anterior a una fecha (Monterrey). */
export function mesAnterior(d: Date = new Date()): string {
  const [a, m] = diaLocal(d).split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}
