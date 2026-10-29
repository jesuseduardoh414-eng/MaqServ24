/**
 * CUENTAS DE INDICADORES (documento institucional, sección 25; la pantalla se
 * rediseñó el 2026-10-27 como "¿Cómo va el negocio?", ver
 * admin-analytics.controller.ts).
 *
 * Dos decisiones que siguen en pie:
 *
 * 1. Mediana y no promedio para los tiempos. Una cotización que tardó tres
 *    semanas porque el cliente no contestaba arrastra el promedio y hace
 *    parecer lenta a una operación que normalmente responde el mismo día.
 *
 * 2. El periodo se compara contra el anterior del mismo largo. Un número solo
 *    no dice si vamos bien; "18 solicitudes" significa una cosa después de 30
 *    y otra después de 6.
 */

/** Mediana entera. Null con la lista vacía. */
export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const o = [...valores].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 === 0 ? Math.round((o[m - 1] + o[m]) / 2) : o[m];
}

/** Horas entre dos fechas, con un decimal de resolución. */
export function horas(desde: Date, hasta: Date): number {
  return Math.max(0, Math.round(((hasta.getTime() - desde.getTime()) / 3600000) * 10) / 10);
}

/**
 * El periodo anterior, del mismo largo y pegado al actual.
 *
 * Del mismo LARGO a propósito: comparar una semana contra un mes haría que
 * cualquier semana pareciera una caída.
 */
export function periodoAnterior(desde: Date, hasta: Date): { desde: Date; hasta: Date } {
  const largo = hasta.getTime() - desde.getTime();
  return { desde: new Date(desde.getTime() - largo), hasta: new Date(desde.getTime() - 1) };
}
