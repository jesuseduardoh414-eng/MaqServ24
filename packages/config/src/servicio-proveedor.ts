import { z } from 'zod';
import { UNIDADES } from './service-units';

/**
 * EL SERVICIO DE UN PROVEEDOR, COMPLETO (2026-11-12, el dueño: "cuando sea un
 * servicio diferente, que tenga la opción de poner todo completo, sus costos,
 * todo; ese formulario debe ser más completo").
 *
 * Lo que cobra por unidad sigue en `products.costo_aliado` ({ semana: 650 }) y
 * qué incluye ese precio en `attributes.precio_nota`. Todo lo demás —mínimo,
 * flete, cargos extra, IVA, factura, forma de pago, vigencia, anticipación,
 * horario, requisitos en la obra, ficha técnica libre y notas internas— vive
 * en `attributes.servicio`. Sin columnas nuevas: nada de SQL.
 *
 * Nunca sale al cliente: es para que MAQSER24 sepa con qué cotiza.
 */

const texto = (max: number) => z.string().trim().max(max).optional().transform((s) => (s ? s : undefined));
const pesos = z.number().min(0).max(100_000_000);
const unidad = z.string().refine((u) => u in UNIDADES, 'Unidad inválida');

export const detalleServicioSchema = z.object({
  noIncluye: texto(500),
  /** true = los precios ya traen IVA; false o ausente = más IVA. */
  conIva: z.boolean().optional(),
  /** false = no da factura (se avisa: no se puede deducir). */
  factura: z.boolean().optional(),
  minimo: z.object({ cantidad: z.number().min(0).max(100_000), unidad }).nullable().optional(),
  flete: z
    .object({
      incluido: z.boolean().optional(),
      entrega: pesos.nullable().optional(),
      retiro: pesos.nullable().optional(),
      nota: texto(200),
    })
    .nullable()
    .optional(),
  extras: z.array(z.object({ concepto: z.string().trim().min(1).max(120), costo: pesos, por: texto(60) })).max(20).optional(),
  /** Depósito o garantía que pide (se le regresa). */
  deposito: pesos.nullable().optional(),
  pago: z
    .object({
      forma: z.enum(['contado', 'anticipo', 'credito']),
      anticipoPct: z.number().min(0).max(100).nullable().optional(),
      creditoDias: z.number().int().min(0).max(365).nullable().optional(),
    })
    .nullable()
    .optional(),
  /** Hasta cuándo respeta el precio (AAAA-MM-DD). */
  vigencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  /** Con cuánto tiempo hay que pedírselo: «24 horas», «3 días». */
  anticipacion: texto(80),
  horario: texto(120),
  /** Lo que la obra debe tener: acceso, piso firme, toma de agua… */
  requisitos: texto(600),
  /** Ficha técnica libre: medidas, capacidad, modelo… */
  ficha: z.array(z.object({ label: z.string().trim().min(1).max(60), valor: z.string().trim().min(1).max(160) })).max(20).optional(),
  /** Solo para MAQSER24. */
  notas: texto(1000),
});

export type DetalleServicio = z.infer<typeof detalleServicioSchema>;

/** Lo guardado en `attributes.servicio`, limpio (lo roto se ignora, nunca truena). */
export function detalleServicioDe(attributes: unknown): DetalleServicio | null {
  const crudo = (attributes as Record<string, unknown> | null)?.servicio;
  if (!crudo || typeof crudo !== 'object') return null;
  const r = detalleServicioSchema.safeParse(crudo);
  return r.success ? r.data : null;
}

const dinero = (n: number) => `$${n.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;
const nombreUnidad = (u: string, n: number) => (n === 1 ? UNIDADES[u]?.singular : UNIDADES[u]?.plural) ?? u;

/** «31 dic 2026». */
function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d} ${meses[(m ?? 1) - 1]} ${a}`;
}

/**
 * Las condiciones en pedacitos cortos, para una línea bajo el precio:
 * «Mínimo 1 semana · Flete $1,800 · Más IVA · Anticipo 50%». `hoy` en AAAA-MM-DD
 * para decir si el precio ya venció.
 */
export function resumenDetalle(d: DetalleServicio | null | undefined, hoy?: string): string[] {
  if (!d) return [];
  const out: string[] = [];
  if (d.minimo && d.minimo.cantidad > 0) out.push(`Mínimo ${d.minimo.cantidad.toLocaleString('es-MX')} ${nombreUnidad(d.minimo.unidad, d.minimo.cantidad)}`);
  if (d.flete?.incluido) out.push('Flete incluido');
  else if (d.flete && (d.flete.entrega || d.flete.retiro)) {
    const { entrega, retiro } = d.flete;
    out.push(`Flete: ${[entrega ? `entrega ${dinero(entrega)}` : null, retiro ? `retiro ${dinero(retiro)}` : null].filter(Boolean).join(' + ')}`);
  }
  if (d.extras?.length) out.push(d.extras.length === 1 ? `Extra: ${d.extras[0].concepto} ${dinero(d.extras[0].costo)}` : `${d.extras.length} cargos extra`);
  out.push(d.conIva ? 'IVA incluido' : 'Más IVA');
  if (d.factura === false) out.push('Sin factura');
  if (d.pago?.forma === 'anticipo') out.push(d.pago.anticipoPct ? `Anticipo ${d.pago.anticipoPct}%` : 'Con anticipo');
  else if (d.pago?.forma === 'credito') out.push(d.pago.creditoDias ? `Crédito ${d.pago.creditoDias} días` : 'A crédito');
  else if (d.pago?.forma === 'contado') out.push('De contado');
  if (d.deposito) out.push(`Depósito ${dinero(d.deposito)}`);
  if (d.anticipacion) out.push(`Pedir con ${d.anticipacion}`);
  if (d.vigencia) out.push(hoy && d.vigencia < hoy ? `Precio vencido (${fechaCorta(d.vigencia)})` : `Precio hasta ${fechaCorta(d.vigencia)}`);
  return out;
}
