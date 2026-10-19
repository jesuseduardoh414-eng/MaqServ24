/**
 * DATOS DE EJEMPLO — Administración (diseño, 2026-10-09).
 *
 * "Construye solo el diseño, aún no te metas con funcionalidades: dame diseño
 * ya con datos de cómo se vería." Nada de esto sale de la base: son diez
 * servicios cerrados inventados que las tres pantallas comparten, para que lo
 * que debe un cliente, lo que se le paga al aliado y el margen cuadren entre sí.
 *
 * Cuando se defina cómo gana dinero MAQSER24, esto se sustituye por la API.
 */

/** "Hoy" fijo: las fechas de vencimiento se leen igual sin importar el día. */
export const HOY = '2026-10-09';
export const IVA = 0.16;

export type Linea = 'Renta de maquinaria pesada' | 'Triturados' | 'Transporte y servicios de obra' | 'Soluciones asfálticas' | 'Materiales para construcción';

export interface Servicio {
  folio: string;
  cliente: string;
  obra: string;
  municipio: string;
  linea: Linea;
  /** Qué se hizo, con la cantidad que se registró al cerrar. */
  detalle: string;
  cerrado: string;
  aliado: string;
  /** Lo que se le cobra al cliente, sin IVA. */
  precioCliente: number;
  /** Lo que se le paga al aliado, sin IVA (acordado al asignarlo). */
  costoAliado: number;
}

export const SERVICIOS: Servicio[] = [
  { folio: 'MQ-2610-0021', cliente: 'Pavimentos Garza', obra: 'Fracc. Las Lomas, 2ª etapa', municipio: 'Apodaca', linea: 'Renta de maquinaria pesada', detalle: 'Vibrocompactador 10 t · 3 días', cerrado: '2026-10-08', aliado: 'Maquinaria Pesada del Norte', precioCliente: 15600, costoAliado: 13200 },
  { folio: 'MQ-2610-0020', cliente: 'Obras Cumbres', obra: 'Calle Hacienda del Sol', municipio: 'García', linea: 'Triturados', detalle: 'Base hidráulica · 140 t', cerrado: '2026-10-07', aliado: 'Pétreos del Poniente', precioCliente: 39200, costoAliado: 35000 },
  { folio: 'MQ-2610-0018', cliente: 'Constructora Regia', obra: 'Nave industrial Apodaca', municipio: 'Apodaca', linea: 'Renta de maquinaria pesada', detalle: 'Excavadora hidráulica 20 t · 6 días + flete', cerrado: '2026-10-06', aliado: 'Rentadora Cerro de la Silla', precioCliente: 66000, costoAliado: 56400 },
  { folio: 'MQ-2610-0016', cliente: 'Grupo Arcos', obra: 'Torre Valle Oriente', municipio: 'Escobedo', linea: 'Triturados', detalle: 'Grava 1 · 84 t', cerrado: '2026-10-03', aliado: 'Pétreos del Poniente', precioCliente: 29400, costoAliado: 26880 },
  { folio: 'MQ-2610-0014', cliente: 'Obras Cumbres', obra: 'Calle Hacienda del Sol', municipio: 'García', linea: 'Transporte y servicios de obra', detalle: 'Pipa de agua 20 m³ · 6 viajes', cerrado: '2026-10-02', aliado: 'Fletes y Pavimentos Regios', precioCliente: 13800, costoAliado: 11400 },
  { folio: 'MQ-2610-0011', cliente: 'Desarrollos del Valle', obra: 'Av. Vasconcelos, tramo 3', municipio: 'San Pedro Garza García', linea: 'Soluciones asfálticas', detalle: 'Carpeta asfáltica · 120 t aplicadas', cerrado: '2026-10-01', aliado: 'Fletes y Pavimentos Regios', precioCliente: 252000, costoAliado: 216000 },
  { folio: 'MQ-2609-0029', cliente: 'Pavimentos Garza', obra: 'Fracc. Las Lomas, 2ª etapa', municipio: 'Apodaca', linea: 'Renta de maquinaria pesada', detalle: 'Motoconformadora · 10 días', cerrado: '2026-09-29', aliado: 'Maquinaria Pesada del Norte', precioCliente: 72000, costoAliado: 61000 },
  { folio: 'MQ-2609-0027', cliente: 'Constructora Regia', obra: 'Nave industrial Apodaca', municipio: 'Apodaca', linea: 'Materiales para construcción', detalle: 'Block de concreto 6" · 4,000 piezas', cerrado: '2026-09-25', aliado: 'Pétreos del Poniente', precioCliente: 54000, costoAliado: 49200 },
  { folio: 'MQ-2609-0025', cliente: 'Inmobiliaria Sierra Madre', obra: 'Residencial Cumbres Elite', municipio: 'Santa Catarina', linea: 'Transporte y servicios de obra', detalle: 'Retiro de material · volteo 14 m³ · 12 viajes', cerrado: '2026-09-22', aliado: 'Fletes y Pavimentos Regios', precioCliente: 25200, costoAliado: 21600 },
  { folio: 'MQ-2609-0022', cliente: 'Grupo Arcos', obra: 'Torre Valle Oriente', municipio: 'Escobedo', linea: 'Renta de maquinaria pesada', detalle: 'Retroexcavadora 4x4 · 5 días + flete', cerrado: '2026-09-18', aliado: 'Rentadora Cerro de la Silla', precioCliente: 38500, costoAliado: 32500 },
];

/* ── Cobranza ─────────────────────────────────────────────────────────── */

export type EstadoCobro = 'sin-factura' | 'por-cobrar' | 'vencida' | 'cobrada';
export interface Movimiento { fecha: string; concepto: string; monto: number; forma: string }
export interface Cobro {
  folio: string;
  factura: string | null;
  condiciones: string;
  vence: string;
  estado: EstadoCobro;
  movimientos: Movimiento[];
}

export const COBROS: Cobro[] = [
  { folio: 'MQ-2610-0021', factura: null, condiciones: 'Contado al cierre', vence: '2026-10-08', estado: 'sin-factura', movimientos: [] },
  { folio: 'MQ-2610-0020', factura: 'A-1047', condiciones: 'Crédito a 30 días', vence: '2026-11-06', estado: 'por-cobrar', movimientos: [] },
  { folio: 'MQ-2610-0018', factura: 'A-1046', condiciones: 'Anticipo 30% · saldo a 15 días', vence: '2026-10-21', estado: 'por-cobrar', movimientos: [{ fecha: '2026-09-29', concepto: 'Anticipo 30%', monto: 22968, forma: 'Transferencia' }] },
  { folio: 'MQ-2610-0016', factura: 'A-1044', condiciones: 'Contado al cierre', vence: '2026-10-03', estado: 'cobrada', movimientos: [{ fecha: '2026-10-03', concepto: 'Pago total', monto: 34104, forma: 'Transferencia' }] },
  { folio: 'MQ-2610-0014', factura: 'A-1043', condiciones: 'Contado al cierre', vence: '2026-10-02', estado: 'vencida', movimientos: [] },
  { folio: 'MQ-2610-0011', factura: 'A-1041', condiciones: 'Anticipo 50% · saldo a 15 días', vence: '2026-10-16', estado: 'por-cobrar', movimientos: [{ fecha: '2026-09-24', concepto: 'Anticipo 50%', monto: 146160, forma: 'Transferencia' }] },
  { folio: 'MQ-2609-0029', factura: 'A-1038', condiciones: 'Crédito a 15 días', vence: '2026-10-14', estado: 'cobrada', movimientos: [{ fecha: '2026-10-06', concepto: 'Pago total', monto: 83520, forma: 'Transferencia' }] },
  { folio: 'MQ-2609-0027', factura: 'A-1036', condiciones: 'Anticipo 50% · saldo contra entrega', vence: '2026-09-25', estado: 'cobrada', movimientos: [{ fecha: '2026-09-15', concepto: 'Anticipo 50%', monto: 31320, forma: 'Transferencia' }, { fecha: '2026-09-25', concepto: 'Saldo', monto: 31320, forma: 'Cheque' }] },
  { folio: 'MQ-2609-0025', factura: 'A-1034', condiciones: 'Crédito a 7 días', vence: '2026-09-29', estado: 'vencida', movimientos: [{ fecha: '2026-09-30', concepto: 'Pago parcial', monto: 10000, forma: 'Transferencia' }] },
  { folio: 'MQ-2609-0022', factura: 'A-1031', condiciones: 'Contado al cierre', vence: '2026-09-18', estado: 'cobrada', movimientos: [{ fecha: '2026-09-19', concepto: 'Pago total', monto: 44660, forma: 'Transferencia' }] },
];

/* ── Pagos a aliados ──────────────────────────────────────────────────── */

export type EstadoPago = 'falta-factura' | 'esperando-cobro' | 'programado' | 'pagado';
export interface Pago {
  folio: string;
  condicion: string;
  /** Factura del aliado a MAQSER24. */
  facturaAliado: string | null;
  estado: EstadoPago;
  /** Fecha programada o de pago. */
  fecha: string | null;
  pagado: number;
  comprobante: string | null;
}

export const PAGOS: Pago[] = [
  { folio: 'MQ-2610-0021', condicion: 'A 15 días del cierre', facturaAliado: null, estado: 'falta-factura', fecha: null, pagado: 0, comprobante: null },
  { folio: 'MQ-2610-0020', condicion: 'A 15 días del cierre', facturaAliado: 'PP-3310', estado: 'programado', fecha: '2026-10-22', pagado: 0, comprobante: null },
  { folio: 'MQ-2610-0018', condicion: 'Al cobrarle al cliente', facturaAliado: 'RCS-0912', estado: 'esperando-cobro', fecha: null, pagado: 0, comprobante: null },
  { folio: 'MQ-2610-0016', condicion: 'A 15 días del cierre', facturaAliado: 'PP-3298', estado: 'pagado', fecha: '2026-10-07', pagado: 31180.8, comprobante: 'SPEI 7781' },
  { folio: 'MQ-2610-0014', condicion: 'Al cobrarle al cliente', facturaAliado: 'FPR-221', estado: 'esperando-cobro', fecha: null, pagado: 0, comprobante: null },
  { folio: 'MQ-2610-0011', condicion: '50% al iniciar · 50% al cobrar', facturaAliado: 'FPR-218', estado: 'programado', fecha: '2026-10-17', pagado: 125280, comprobante: 'SPEI 7754' },
  { folio: 'MQ-2609-0029', condicion: 'A 15 días del cierre', facturaAliado: 'MPN-0145', estado: 'pagado', fecha: '2026-10-02', pagado: 70760, comprobante: 'SPEI 7712' },
  { folio: 'MQ-2609-0027', condicion: 'A 15 días del cierre', facturaAliado: 'PP-3271', estado: 'pagado', fecha: '2026-10-01', pagado: 57072, comprobante: 'SPEI 7706' },
  { folio: 'MQ-2609-0025', condicion: 'Al cobrarle al cliente', facturaAliado: 'FPR-209', estado: 'esperando-cobro', fecha: null, pagado: 0, comprobante: null },
  { folio: 'MQ-2609-0022', condicion: 'A 15 días del cierre', facturaAliado: 'RCS-0897', estado: 'pagado', fecha: '2026-09-26', pagado: 37700, comprobante: 'SPEI 7660' },
];

/* ── Margen ───────────────────────────────────────────────────────────── */

/** Meses anteriores (sin IVA). Septiembre y octubre se calculan de SERVICIOS. */
export const HISTORIAL_MESES: Array<{ mes: string; cobrado: number; pagado: number }> = [
  { mes: '2026-05', cobrado: 138000, pagado: 121200 },
  { mes: '2026-06', cobrado: 162500, pagado: 141200 },
  { mes: '2026-07', cobrado: 214000, pagado: 184300 },
  { mes: '2026-08', cobrado: 176800, pagado: 152900 },
];

export type EstadoConciliacion = 'cuadra' | 'falta-cobrar' | 'falta-pagar' | 'falta-factura' | 'diferencia';
/** Lo que no cuadra en un servicio. Los que no aparecen aquí se derivan de cobro y pago. */
export const DIFERENCIAS: Record<string, string> = {
  'MQ-2609-0027': 'El aliado facturó $49,800 y se acordaron $49,200: $600 de más por revisar.',
};

/* ── Utilidades ───────────────────────────────────────────────────────── */

export const conIva = (n: number) => Math.round(n * (1 + IVA) * 100) / 100;
export const dinero = (n: number) => `$${Math.round(n).toLocaleString('es-MX')}`;
export const pct = (n: number) => `${n.toLocaleString('es-MX', { maximumFractionDigits: 1 })}%`;
const dia = (iso: string) => new Date(`${iso}T12:00:00`);
export const diasEntre = (a: string, b: string) => Math.round((dia(b).getTime() - dia(a).getTime()) / 86400000);
export const fechaCorta = (iso: string) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(dia(iso)).replace('.', '');
export const mesCorto = (ym: string) => new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(dia(`${ym}-01`)).replace('.', '');
export const mesLargo = (ym: string) => new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(dia(`${ym}-01`));
/** "Junio de 2026": solo la primera letra en mayúscula (capitalize subía también la "De"). */
export const mesTitulo = (ym: string) => { const t = mesLargo(ym); return t.charAt(0).toUpperCase() + t.slice(1); };
export const servicioDe = (folio: string) => SERVICIOS.find((s) => s.folio === folio)!;
export const cobroDe = (folio: string) => COBROS.find((c) => c.folio === folio)!;
export const pagoDe = (folio: string) => PAGOS.find((p) => p.folio === folio)!;
export const cobradoDe = (c: Cobro) => c.movimientos.reduce((a, m) => a + m.monto, 0);
