/**
 * CALCULADORAS DE MATERIAL (2026-11-09).
 *
 * El dueño pidió llevar a MAQSER24 dos calculadoras que PUCSA Triturados tenía
 * sueltas: «Calculadora de pavimento» (materiales para una calle) y «De metros
 * cúbicos a toneladas». Por ahora SOLO salen en el enlace de los cotizadores
 * (acceso directo, una persona): "por el momento solo se deben mostrar en el
 * enlace" (la lista del menú es CALCULADORAS_ENLACE, en @maqserv/config).
 * Viven aquí, en el paquete compartido, para poder ponerlas en el sitio el
 * día que se decida sin rehacerlas.
 *
 * Mismos factores que las de PUCSA; si cambian, se cambian solo aquí.
 *  - Abundamiento: 1.30 (lo que crece el material suelto).
 *  - Triturados: cada m³ × 1.65 = toneladas.
 *  - Carpeta asfáltica: cada m³ × 1.30 × 1.80 = toneladas.
 *
 * Son estimaciones por volumen: no llevan precio.
 */

export const ABUNDAMIENTO = 1.3;
export const FACTOR_TRITURADO = 1.65;
export const FACTOR_CARPETA = 1.8;

/** Lo que se escribe; vacío, negativo o texto cuenta como 0. Acepta coma decimal. */
export function numeroDe(valor: string): number {
  const n = Number(valor.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Resultado: 1,234.56 (siempre con dos decimales). */
export function cifra(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Lo que escribió la persona, sin ceros de relleno: 20 → "20", 350.5 → "350.5", 1000 → "1,000". */
export function dato(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString('es-MX', { maximumFractionDigits: 2 });
}

/* ── Pavimento ─────────────────────────────────────────── */

/** Superficie en m² y el espesor de cada capa en centímetros. */
export interface DatosCalle {
  area: number;
  subrasante: number;
  subbase: number;
  base: number;
  carpeta: number;
}

export interface MaterialesCalle {
  /** Tierra de banco, en m³: compacto (área × espesor) y a pedir (× 1.30). */
  subrasante: { compacto: number; m3: number };
  /** Triturado: volumen geométrico en m³ y toneladas (× 1.65 × 1.30). */
  subbase: { m3: number; t: number };
  base: { m3: number; t: number };
  /** Mezcla asfáltica: volumen geométrico en m³ y toneladas (× 1.30 × 1.80). */
  carpeta: { m3: number; t: number };
  /** Subbase + base + carpeta, en toneladas (la subrasante va en m³ y no suma). */
  totalT: number;
}

/** El espesor llega en cm y se pasa a metros (÷ 100) antes de los factores. */
export function materialesCalle(d: DatosCalle): MaterialesCalle {
  const volumen = (cm: number) => d.area * (cm / 100);
  const subbase = volumen(d.subbase);
  const base = volumen(d.base);
  const carpeta = volumen(d.carpeta);
  const r: Omit<MaterialesCalle, 'totalT'> = {
    subrasante: { compacto: volumen(d.subrasante), m3: volumen(d.subrasante) * ABUNDAMIENTO },
    subbase: { m3: subbase, t: subbase * FACTOR_TRITURADO * ABUNDAMIENTO },
    base: { m3: base, t: base * FACTOR_TRITURADO * ABUNDAMIENTO },
    carpeta: { m3: carpeta, t: carpeta * ABUNDAMIENTO * FACTOR_CARPETA },
  };
  return { ...r, totalT: r.subbase.t + r.base.t + r.carpeta.t };
}

/* ── m³ ↔ toneladas ────────────────────────────────────── */

export type MaterialConversion = 'triturados' | 'carpeta';

export const MATERIALES_CONVERSION: Record<MaterialConversion, { nombre: string; factor: number; formula: string; explicacion: string }> = {
  triturados: {
    nombre: 'Triturados',
    factor: FACTOR_TRITURADO,
    formula: '1.65',
    explicacion: 'Triturados: cada m³ se multiplica por 1.65.',
  },
  carpeta: {
    nombre: 'Carpeta asfáltica',
    factor: ABUNDAMIENTO * FACTOR_CARPETA,
    formula: '(1.30 × 1.80)',
    explicacion: 'Carpeta asfáltica: cada m³ se multiplica por 1.30 y después por 1.80.',
  },
};

/** De m³ a toneladas (× factor) o de toneladas a m³ (÷ factor). */
export function convertir(material: MaterialConversion, aToneladas: boolean, valor: number): number {
  const f = MATERIALES_CONVERSION[material].factor;
  return aToneladas ? valor * f : valor / f;
}
