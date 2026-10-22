import { guardarAjuste, leerAjuste } from '../common/platform-settings';

/**
 * LAS REGLAS DEL DINERO (2026-10-22).
 *
 * Dirección no había contestado cómo cobra y gana MAQSER24, y el dueño pidió
 * decidirlo "de la mejor manera, con lo menos que haga el usuario". Lo de aquí
 * son las propuestas del propio cuestionario (Preguntas para Dirección, 1.1 a
 * 4.4), todas editables desde Margen › Reglas sin tocar código:
 *
 *  - MAQSER24 le factura al cliente el total y le paga al aliado su parte.
 *  - La parte del aliado es el precio sin IVA menos una comisión (por línea, si
 *    se quiere distinta). Así nadie captura costos: sale del precio cotizado.
 *  - El cliente paga al cerrar el servicio, salvo los que tienen crédito.
 *  - Al aliado se le paga el siguiente día de pago, ya que el cliente pagó y
 *    él subió su factura.
 */
export interface ReglasDinero {
  /** % de comisión de MAQSER24 sobre el precio sin IVA. */
  comisionPct: number;
  /** Comisión distinta por línea (slug → %). Vacío = la general. */
  comisionPorLinea: Record<string, number>;
  /** Día de la semana en que se paga a los aliados: 0 domingo … 5 viernes. */
  diaDePago: number;
  /** Para que el cliente transfiera: va en los recordatorios. */
  datosPago: { banco: string; clabe: string; beneficiario: string } | null;
}

export const REGLAS_DEFAULT: ReglasDinero = {
  comisionPct: 15,
  comisionPorLinea: {},
  diaDePago: 5,
  datosPago: null,
};

const CLAVE = 'reglas_dinero';

export async function reglasDinero(): Promise<ReglasDinero> {
  const r = await leerAjuste<Partial<ReglasDinero>>(CLAVE, REGLAS_DEFAULT);
  return {
    comisionPct: num(r.comisionPct, REGLAS_DEFAULT.comisionPct),
    comisionPorLinea: Object.fromEntries(
      Object.entries(r.comisionPorLinea ?? {}).filter(([, v]) => Number.isFinite(Number(v))).map(([k, v]) => [k, Number(v)]),
    ),
    diaDePago: Number.isInteger(r.diaDePago) && (r.diaDePago as number) >= 0 && (r.diaDePago as number) <= 6 ? (r.diaDePago as number) : REGLAS_DEFAULT.diaDePago,
    datosPago: r.datosPago?.clabe ? r.datosPago : null,
  };
}

export async function guardarReglasDinero(r: ReglasDinero, por: string): Promise<void> {
  await guardarAjuste(CLAVE, r, por);
}

export function comisionDe(r: ReglasDinero, linea: string | null): number {
  const p = linea ? r.comisionPorLinea[linea] : undefined;
  return p !== undefined ? p : r.comisionPct;
}

/** Días de crédito que se pueden dar a un cliente. 0 = paga al cerrar. */
export const CREDITOS = [0, 7, 15, 30] as const;

function num(v: unknown, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n < 100 ? n : d;
}
