/**
 * LOS DOCE INDICADORES (documento institucional, sección 25).
 *
 * "MAQSER24 debe diseñarse como una empresa de datos desde el principio. Cada
 * interacción genera información que puede mejorar decisiones: qué pide el
 * mercado, qué equipos faltan, en qué zonas hay demanda, qué proveedores
 * contestan rápido, qué categorías convierten mejor y dónde se pierden
 * oportunidades."
 *
 * Casi todos los datos ya se venían guardando; lo que no existía era la
 * pantalla que los suma. El panel de hoy cuenta pendientes, que es otra cosa:
 * dice qué hay que atender, no si lo que se hizo sirvió.
 *
 * CUATRO DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. Un indicador sin muestra suficiente NO da número. Dos de dos no es "100%
 *    de conversión": son dos. Es la misma regla del historial de cumplimiento,
 *    y aquí importa más: un tablero es lo que alguien enseña en una junta, y un
 *    porcentaje sacado de tres casos se defiende igual que uno sacado de
 *    trescientos hasta que alguien lo revisa.
 *
 * 2. Lo que NO se puede medir se dice, con su motivo y qué haría falta. Tres de
 *    los doce no son calculables todavía. Rellenarlos con una aproximación
 *    silenciosa sería peor que dejarlos en blanco: nadie volvería a
 *    preguntarse por ellos.
 *
 * 3. Mediana y no promedio para los tiempos. Una cotización que tardó tres
 *    semanas porque el cliente no contestaba arrastra el promedio y hace
 *    parecer lenta a una operación que normalmente responde el mismo día.
 *
 * 4. El periodo se compara contra el anterior del mismo largo. Un número solo
 *    no dice si vamos bien; "18 solicitudes" significa una cosa después de 30
 *    y otra después de 6.
 */

/** Debajo de esto no se calculan porcentajes ni medianas. */
export const MINIMO_MUESTRA = 5;

export type EstadoIndicador = 'ok' | 'sin-muestra' | 'no-medible' | 'bloqueado';
export type Formato = 'conteo' | 'porcentaje' | 'dias' | 'horas' | 'dinero';

export interface Indicador {
  clave: string;
  /** Cómo se llama en el documento. */
  label: string;
  /** Qué revela, también del documento. */
  revela: string;
  valor: number | null;
  formato: Formato;
  estado: EstadoIndicador;
  /** Cuántos casos lo respaldan. Se muestra siempre: es la letra chica. */
  muestra: number;
  /** Por qué no hay número, o qué matiza al que hay. */
  nota: string | null;
  /** El mismo indicador en el periodo anterior, para comparar. */
  anterior: number | null;
  /** Si subir es bueno. Null cuando no aplica (un conteo no es bueno ni malo). */
  subirEsBueno: boolean | null;
}

/** Mediana entera. Null con la lista vacía. */
export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const o = [...valores].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 === 0 ? Math.round((o[m - 1] + o[m]) / 2) : o[m];
}

/**
 * Porcentaje, sólo con muestra suficiente.
 *
 * Devolver null en vez de un número es la decisión 1: quien pinta la pantalla
 * tiene que decidir qué enseñar, y "muy pocos casos" es una respuesta honesta
 * que un porcentaje frágil no da.
 */
export function porcentaje(parte: number, total: number): number | null {
  if (total < MINIMO_MUESTRA) return null;
  return Math.round((parte / total) * 100);
}

/** Días completos entre dos fechas. */
export function dias(desde: Date, hasta: Date): number {
  return Math.max(0, Math.round((hasta.getTime() - desde.getTime()) / 86400000));
}

/** Horas entre dos fechas, con un decimal de resolución. */
export function horas(desde: Date, hasta: Date): number {
  return Math.max(0, Math.round(((hasta.getTime() - desde.getTime()) / 3600000) * 10) / 10);
}

/**
 * Arma un indicador ya resuelto.
 *
 * Centraliza la regla de la muestra: si un indicador se construye por aquí, no
 * puede saltársela por accidente.
 */
export function indicador(base: {
  clave: string;
  label: string;
  revela: string;
  valor: number | null;
  formato: Formato;
  muestra: number;
  anterior?: number | null;
  subirEsBueno?: boolean | null;
  nota?: string | null;
  /** Para los que no dependen de muestra: conteos y estados fijos. */
  exigeMuestra?: boolean;
}): Indicador {
  const exige = base.exigeMuestra ?? true;
  const sinMuestra = exige && base.muestra < MINIMO_MUESTRA;

  return {
    clave: base.clave,
    label: base.label,
    revela: base.revela,
    valor: sinMuestra ? null : base.valor,
    formato: base.formato,
    estado: sinMuestra ? 'sin-muestra' : base.valor === null ? 'sin-muestra' : 'ok',
    muestra: base.muestra,
    nota: sinMuestra
      ? base.muestra === 0
        ? 'Todavía no hay casos.'
        : `Sólo ${base.muestra} caso${base.muestra === 1 ? '' : 's'}: muy pocos para un número que signifique algo.`
      : base.nota ?? null,
    anterior: base.anterior ?? null,
    subirEsBueno: base.subirEsBueno ?? null,
  };
}

/** Un indicador que hoy no se puede calcular, y por qué. */
export function noMedible(base: {
  clave: string;
  label: string;
  revela: string;
  formato: Formato;
  motivo: string;
  bloqueado?: boolean;
}): Indicador {
  return {
    clave: base.clave,
    label: base.label,
    revela: base.revela,
    valor: null,
    formato: base.formato,
    estado: base.bloqueado ? 'bloqueado' : 'no-medible',
    muestra: 0,
    nota: base.motivo,
    anterior: null,
    subirEsBueno: null,
  };
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

/** Variación porcentual contra el periodo anterior. Null si no hay con qué. */
export function variacion(actual: number | null, anterior: number | null): number | null {
  if (actual === null || anterior === null || anterior === 0) return null;
  return Math.round(((actual - anterior) / anterior) * 100);
}
