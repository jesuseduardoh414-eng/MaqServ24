import { z } from 'zod';
import { UNIDADES, esUnidadDeTiempo, unidadesDe, type UnidadServicio } from './service-units';

/**
 * LA MÁQUINA COMO UNIDAD DE COTIZACIÓN (decisión del cliente, 2026-09-25).
 *
 * El cotizador por TIPO venía de PUCSA: una sola empresa, sus máquinas, un
 * precio por tipo. En MAQSER24 cada máquina es de un aliado distinto, con su
 * costo, su patio y su horario; un precio por tipo dejaba sin contestar a
 * quién se le manda el trabajo cuando tres aliados tienen "excavadora 20 t".
 *
 * Por eso cada ficha del catálogo trae lo que el cotizador necesita:
 *
 *  - `costo_aliado`: lo que cobra el aliado por unidad. NUNCA sale al cliente.
 *  - `tarifas`: el precio al público por unidad. Lo fija MAQSER24 al publicar,
 *    propuesto como costo + margen (`platform_settings.margen_aliado_pct`).
 *  - `minimo`: unidades mínimas (1 día, 1 viaje, 10 toneladas).
 *  - `horario`: días y horas en que el aliado atiende.
 *
 * El tabulador del cotizador queda como PLANTILLA (tipos, jornada, tramos,
 * condiciones); el precio vive en la máquina.
 */

// ---------------------------------------------------------------------------
// Horario
// ---------------------------------------------------------------------------

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export const horarioSchema = z.object({
  /** Días de la semana que atiende, 0 = domingo … 6 = sábado. */
  dias: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  desde: z.string().regex(HORA, 'Hora inválida (HH:MM)'),
  hasta: z.string().regex(HORA, 'Hora inválida (HH:MM)'),
});
export type Horario = z.infer<typeof horarioSchema>;

/** Lunes a sábado de 8 a 18: lo normal en el ramo cuando el aliado no dice otra cosa. */
export const HORARIO_DEFAULT: Horario = { dias: [1, 2, 3, 4, 5, 6], desde: '08:00', hasta: '18:00' };

export const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

/** Un horario guardado en JSON (o null) como objeto válido; sin dato = el default. */
export function horarioDe(v: unknown): Horario {
  const r = horarioSchema.safeParse(v);
  return r.success ? r.data : HORARIO_DEFAULT;
}

/** "Lun–Sáb · 8:00–18:00". */
export function textoHorario(h: Horario): string {
  const dias = [...h.dias].sort((a, b) => a - b);
  const seguidos = dias.every((d, i) => i === 0 || d === dias[i - 1] + 1);
  const etiqueta = dias.length === 7
    ? 'Todos los días'
    : seguidos && dias.length > 2
      ? `${DIAS_SEMANA[dias[0]]}–${DIAS_SEMANA[dias[dias.length - 1]]}`
      : dias.map((d) => DIAS_SEMANA[d]).join(', ');
  const hora = (s: string) => (s.startsWith('0') ? s.slice(1) : s);
  return `${etiqueta} · ${hora(h.desde)}–${hora(h.hasta)}`;
}

/** ¿Atiende ese día a esa hora? `fecha` en ISO (YYYY-MM-DD), `hora` HH:MM; sin hora = solo el día. */
export function atiendeEn(h: Horario, fecha: string, hora?: string | null): boolean {
  const d = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  if (!h.dias.includes(d.getDay())) return false;
  if (!hora || !HORA.test(hora)) return true;
  return hora >= h.desde && hora <= h.hasta;
}

// ---------------------------------------------------------------------------
// Tarifas
// ---------------------------------------------------------------------------

/** Precio por unidad: { dia: 6500, semana: 36000 }. Solo claves de UNIDADES. */
export const tarifasSchema = z
  .record(z.string(), z.number().min(0).max(100_000_000))
  .transform((t) => Object.fromEntries(Object.entries(t).filter(([k, v]) => k in UNIDADES && v > 0)));
export type Tarifas = Record<string, number>;

export function tarifasDe(v: unknown): Tarifas {
  const r = tarifasSchema.safeParse(v ?? {});
  return r.success ? r.data : {};
}

/**
 * Unidades en las que se puede poner precio a una ficha.
 *
 * Renta: las de su línea (día, semana, mes; viaje y jornada en transporte).
 * Venta: las de su línea que NO son de tiempo (tonelada, m³, pieza…), y pieza
 * siempre, porque vender "por mes" no significa nada.
 */
export function unidadesDeTarifa(linea: string | null | undefined, modalidad: 'renta' | 'venta'): UnidadServicio[] {
  const deLinea = unidadesDe(linea);
  if (modalidad === 'renta') return deLinea.filter((u) => u.clave !== 'litro');
  const sinTiempo = deLinea.filter((u) => !esUnidadDeTiempo(u.clave));
  return sinTiempo.some((u) => u.clave === 'pieza') ? sinTiempo : [...sinTiempo, UNIDADES.pieza];
}

/** Precio al público propuesto: costo del aliado + margen, redondeado a pesos. */
export function precioConMargen(costo: number, margenPct: number): number {
  return Math.round(costo * (1 + Math.max(0, margenPct) / 100));
}

/** Tarifas propuestas a partir del costo del aliado: una por cada unidad que él cotizó. */
export function tarifasPropuestas(costo: Tarifas, margenPct: number): Tarifas {
  return Object.fromEntries(Object.entries(costo).map(([u, c]) => [u, precioConMargen(c, margenPct)]));
}

/** Margen real de una unidad: (precio − costo) / precio, en %. Null si falta un lado. */
export function margenDe(precio: number | null | undefined, costo: number | null | undefined): number | null {
  if (!precio || costo == null) return null;
  return Math.round(((precio - costo) / precio) * 1000) / 10;
}

/**
 * Importe de una máquina para lo que el cliente pide.
 *
 * `unidades` es cuánto pide en `unidad` (3 días, 2 viajes, 15 toneladas) y
 * `equipos` cuántas máquinas iguales. El mínimo se respeta subiendo las
 * unidades cobradas, y se dice: cobrar 1 día cuando pidió 4 horas es correcto
 * solo si el cliente lo ve antes de aceptar.
 */
export function importeMaquina(d: {
  tarifas: Tarifas;
  unidad: string;
  unidades: number;
  equipos?: number;
  minimo?: number | null;
}): { precioUnitario: number; unidadesCobradas: number; equipos: number; subtotal: number; notaMinimo: string | null } | null {
  const precioUnitario = d.tarifas[d.unidad];
  if (!precioUnitario) return null;
  const equipos = Math.max(1, Math.floor(d.equipos ?? 1));
  const pedidas = Math.max(0, d.unidades);
  const minimo = d.minimo && d.minimo > 0 ? d.minimo : 0;
  const unidadesCobradas = Math.max(pedidas, minimo);
  const u = UNIDADES[d.unidad];
  const notaMinimo =
    minimo > pedidas && u
      ? `El mínimo es ${minimo} ${minimo === 1 ? u.singular : u.plural}; se cobra ese mínimo.`
      : null;
  return {
    precioUnitario,
    unidadesCobradas,
    equipos,
    subtotal: Math.round(precioUnitario * unidadesCobradas * equipos * 100) / 100,
    notaMinimo,
  };
}
