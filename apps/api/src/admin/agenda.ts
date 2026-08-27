/**
 * AGENDA DE OPERACIONES (documento institucional, sección 17).
 *
 * "Operaciones: asignaciones, estatus, agenda, incidencias y cierre." De los
 * cinco, cuatro ya existen. La agenda no: el tablero es una lista de qué está
 * pasando, no un calendario de qué viene, y sin eso no se puede ver un choque
 * de fechas ANTES de comprometerse.
 *
 * TRES DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. Un choque ADVIERTE, no bloquea. Dos compromisos en las mismas fechas a
 *    veces son legítimos —una excavadora que sale de una obra a las once y
 *    entra a otra a las tres— y a veces son un error caro. El sistema no puede
 *    distinguirlos, pero quien opera sí; esconder el traslape o prohibirlo
 *    serían las dos formas de equivocarse.
 *
 * 2. Los rangos se comparan por DÍA y no por instante. Un bloqueo del 3 al 5 y
 *    otro del 5 al 8 chocan: el día 5 la unidad no puede estar en dos obras.
 *    Comparar horas daría "no chocan" porque uno termina a las 00:00 y el otro
 *    empieza a las 00:00, que es cierto en el reloj y falso en la obra.
 *
 * 3. Un bloqueo SIN fecha de fin es indefinido, y choca con todo lo que venga
 *    después. Es lo correcto: una unidad en mantenimiento sin fecha de salida
 *    no se puede prometer, y tratarla como libre a partir de mañana sería
 *    inventar una disponibilidad que nadie confirmó.
 */

/** Un compromiso en el calendario: puede ser un bloqueo o un servicio. */
export interface Compromiso {
  /** Identifica el origen: `bloqueo:12` o `servicio:34`. */
  id: string;
  tipo: 'bloqueo' | 'servicio';
  /** Equipo comprometido. Null en servicios que no apuntan a una unidad. */
  productId: number | null;
  titulo: string;
  /** Con quién: el cliente, o el motivo del bloqueo. */
  detalle: string | null;
  desde: Date;
  /** Null = indefinido. */
  hasta: Date | null;
  estado: string;
}

/** Sólo la fecha, en UTC, para comparar días sin que la hora estorbe. */
export function soloDia(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * ¿Se traslapan dos rangos? Inclusivo en los dos extremos (decisión 2).
 * `hasta` nulo significa que sigue abierto hacia adelante (decisión 3).
 */
export function seTraslapan(
  a: { desde: Date; hasta: Date | null },
  b: { desde: Date; hasta: Date | null },
): boolean {
  const aDesde = soloDia(a.desde);
  const bDesde = soloDia(b.desde);
  const aHasta = a.hasta ? soloDia(a.hasta) : Number.POSITIVE_INFINITY;
  const bHasta = b.hasta ? soloDia(b.hasta) : Number.POSITIVE_INFINITY;
  return aDesde <= bHasta && bDesde <= aHasta;
}

export interface Choque {
  con: Compromiso;
  /** Cómo se lee, con las fechas dentro. */
  texto: string;
}

const fmt = (d: Date) =>
  d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', timeZone: 'UTC' });

/**
 * Compromisos que chocan con el rango propuesto para ese equipo.
 *
 * Se excluye `ignorarId` para poder editar un bloqueo sin que se detecte a sí
 * mismo — el error clásico de estas comprobaciones.
 */
export function choques(
  productId: number,
  rango: { desde: Date; hasta: Date | null },
  existentes: Compromiso[],
  ignorarId?: string,
): Choque[] {
  return existentes
    .filter((c) => c.productId === productId && c.id !== ignorarId && seTraslapan(rango, c))
    .map((c) => ({
      con: c,
      texto: `${c.titulo} · ${fmt(c.desde)}${c.hasta ? ` a ${fmt(c.hasta)}` : ' en adelante'}${c.detalle ? ` (${c.detalle})` : ''}`,
    }));
}

/** Los días de una semana que empieza en lunes. */
export function semanaDe(fecha: Date): Date[] {
  const d = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
  // getUTCDay: 0 = domingo. Se corre al lunes anterior.
  const dia = d.getUTCDay();
  const aLunes = dia === 0 ? -6 : 1 - dia;
  d.setUTCDate(d.getUTCDate() + aLunes);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setUTCDate(d.getUTCDate() + i);
    return x;
  });
}

/** ¿El compromiso toca ese día? */
export function tocaElDia(c: Compromiso, dia: Date): boolean {
  return seTraslapan({ desde: dia, hasta: dia }, c);
}

/**
 * Cuántos compromisos hay por día en el rango. Alimenta la barra que dice
 * dónde está la carga: una agenda sin densidad es una lista con cuadrícula.
 */
export function densidad(dias: Date[], compromisos: Compromiso[]): number[] {
  return dias.map((d) => compromisos.filter((c) => tocaElDia(c, d)).length);
}
