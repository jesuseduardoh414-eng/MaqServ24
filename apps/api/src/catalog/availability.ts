import type { Availability, AvailabilityState } from '@maqserv/types';

/**
 * Estado de disponibilidad de un equipo (documento institucional, sección 21).
 *
 * ANTES esto vivía en la web y se deducía solo del entero de existencias. Se
 * mueve aquí porque ahora depende de datos que solo la API tiene: los bloqueos
 * por fecha y cuándo se confirmó la disponibilidad por última vez.
 *
 * El orden en que se decide NO es arbitrario; va de lo más concreto a lo más
 * supuesto:
 *
 *   1. ¿Hay un bloqueo vigente hoy? Entonces ese es el estado — da igual el
 *      stock: una máquina en mantenimiento no se asigna aunque figure en el
 *      inventario.
 *   2. ¿Hace cuánto que nadie confirma? Pasado el plazo vuelve a POR CONFIRMAR.
 *      Es el control que el documento pide contra la "disponibilidad
 *      desactualizada": confirmación periódica y marca de antigüedad del dato.
 *      Prometer con un dato de hace meses es justo lo que el manual prohíbe.
 *   3. Si nada de lo anterior aplica, se mira el inventario.
 */

/**
 * Días que una confirmación se considera fresca.
 *
 * Catorce porque es lo que dura un ciclo normal de obra: más allá de eso el dato
 * ya no describe la realidad del patio. Cuando exista el portal del proveedor
 * esto debería bajar.
 */
export const DIAS_FRESCURA = 14;

/** A partir de cuántas piezas se considera holgada la disponibilidad. */
export const UMBRAL_LIMITADA = 3;

/** Bloqueos que impiden asignar el equipo, tal como los enumera el documento. */
const ESTADOS_BLOQUEO: AvailabilityState[] = [
  'reservado',
  'en-traslado',
  'en-servicio',
  'mantenimiento',
  'inactivo',
];

export interface EntradaDisponibilidad {
  stock: number | null;
  location: string | null;
  confirmedAt: Date | null;
  /**
   * Bloqueos del equipo; se filtran por fecha aquí mismo. `note` distingue los
   * que pone un servicio (`reserva:<folio>`) de los que se ponen a mano.
   */
  blocks: Array<{ state: string; starts_on: Date; ends_on: Date | null; note?: string | null }>;
}

/** Nota de los bloqueos que pone y quita solo un servicio (ver quotes/reservas.ts). */
export const PREFIJO_RESERVA = 'reserva:';

/**
 * ¿El bloqueo aparta UNA pieza o para el equipo entero? (2026-10-15)
 *
 * Un servicio aparta las unidades que se llevó: con tres en el patio y una en
 * obra quedan dos para otro cliente. Antes una sola reserva pintaba "reservado"
 * el equipo completo en el catálogo, mientras el recomendador sí contaba
 * piezas: las dos pantallas decían cosas distintas del mismo patio.
 * Mantenimiento o inactivo puestos a mano sí paran el equipo completo.
 */
export function ocupaUnaUnidad(b: { state: string; note?: string | null }): boolean {
  return b.state === 'reservado' || (b.note ?? '').startsWith(PREFIJO_RESERVA);
}

/** Cuando todas las piezas están apartadas, se enseña la etapa más avanzada. */
const PESO_ETAPA: Record<string, number> = { 'en-servicio': 3, 'en-traslado': 2, reservado: 1 };

const soloFecha = (d: Date): string => d.toISOString().slice(0, 10);

export function disponibilidadDe(p: EntradaDisponibilidad, hoy: Date = new Date()): Availability {
  const hoyStr = soloFecha(hoy);
  const confirmedAt = p.confirmedAt ? p.confirmedAt.toISOString() : null;

  const vigentes = p.blocks.filter(
    (b) =>
      ESTADOS_BLOQUEO.includes(b.state as AvailabilityState) &&
      soloFecha(b.starts_on) <= hoyStr &&
      (b.ends_on === null || soloFecha(b.ends_on) >= hoyStr),
  );

  // 1. Bloqueo del equipo entero. Si hay varios, gana el que termina más tarde:
  //    es el que de verdad define cuándo se libera el equipo.
  const totales = vigentes
    .filter((b) => !ocupaUnaUnidad(b))
    .sort((a, b) => {
      if (a.ends_on === null) return -1; // sin fecha de retorno pesa más
      if (b.ends_on === null) return 1;
      return soloFecha(b.ends_on).localeCompare(soloFecha(a.ends_on));
    });

  if (totales.length > 0) {
    const b = totales[0];
    return {
      state: b.state as AvailabilityState,
      location: p.location,
      confirmedAt,
      until: b.ends_on ? soloFecha(b.ends_on) : null,
    };
  }

  // 2. Piezas apartadas. Sin control de stock se cuenta como una sola pieza.
  //    Si ya no queda ninguna, el equipo vuelve cuando regrese la PRIMERA.
  const apartadas = vigentes.filter(ocupaUnaUnidad);
  const piezas = Math.max(1, p.stock ?? 1);
  if (apartadas.length >= piezas) {
    const etapa = [...apartadas].sort((a, b) => (PESO_ETAPA[b.state] ?? 0) - (PESO_ETAPA[a.state] ?? 0))[0];
    const primera = apartadas
      .filter((b) => b.ends_on !== null)
      .map((b) => soloFecha(b.ends_on as Date))
      .sort()[0] ?? null;
    return { state: etapa.state as AvailabilityState, location: p.location, confirmedAt, until: primera };
  }

  const base = { location: p.location, confirmedAt, until: null };

  // 3. Sin confirmar, o con una confirmación vieja: no se promete nada.
  if (p.confirmedAt === null) return { state: 'por-confirmar', ...base };
  const dias = Math.floor((hoy.getTime() - p.confirmedAt.getTime()) / 86_400_000);
  if (dias > DIAS_FRESCURA) return { state: 'por-confirmar', ...base };

  // 4. Recién ahora vale mirar el inventario, ya sin las piezas apartadas.
  if (p.stock === null) return { state: 'por-confirmar', ...base };
  const libres = p.stock - apartadas.length;
  if (libres <= 0) return { state: 'no-disponible', ...base };
  if (libres <= UMBRAL_LIMITADA) return { state: 'limitada', ...base };
  return { state: 'disponible', ...base };
}
