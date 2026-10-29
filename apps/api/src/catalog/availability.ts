import type { Availability, AvailabilityState } from '@maqserv/types';

/**
 * Estado de disponibilidad de un equipo (documento institucional, sección 21).
 *
 * ANTES esto vivía en la web y se deducía solo del entero de existencias. Se
 * mueve aquí porque ahora depende de datos que solo la API tiene: los bloqueos
 * por fecha.
 *
 * El orden en que se decide NO es arbitrario; va de lo más concreto a lo más
 * supuesto:
 *
 *   1. ¿Hay un bloqueo vigente hoy? Entonces ese es el estado — da igual el
 *      stock: una máquina en mantenimiento no se asigna aunque figure en el
 *      inventario.
 *   2. Si nada de lo anterior aplica, se mira el inventario.
 *
 * SIN CONFIRMACIÓN PERIÓDICA (2026-10-26). Antes un equipo que nadie confirmaba
 * en 14 días pasaba a "por confirmar". Decisión del dueño: la confirmación de
 * verdad es cuando el aliado acepta o rechaza un servicio concreto; pedirle que
 * confirme cada dos semanas era trabajo de más. Tampoco hay "limitada": una
 * máquina libre está disponible, y cuántas quedan lo dice el conteo de unidades.
 */

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
  /** Ya no decide nada (2026-10-26); se devuelve tal cual para quien lo enseñe. */
  confirmedAt?: Date | null;
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

/** Los bloqueos que cuentan HOY, separados en los que paran todo y los que apartan una pieza. */
function vigentesHoy(p: EntradaDisponibilidad, hoy: Date) {
  const hoyStr = soloFecha(hoy);
  const vigentes = p.blocks.filter(
    (b) =>
      ESTADOS_BLOQUEO.includes(b.state as AvailabilityState) &&
      soloFecha(b.starts_on) <= hoyStr &&
      (b.ends_on === null || soloFecha(b.ends_on) >= hoyStr),
  );
  // Si hay varios que paran todo, gana el que termina más tarde: es el que de
  // verdad define cuándo se libera el equipo.
  const totales = vigentes
    .filter((b) => !ocupaUnaUnidad(b))
    .sort((a, b) => {
      if (a.ends_on === null) return -1; // sin fecha de retorno pesa más
      if (b.ends_on === null) return 1;
      return soloFecha(b.ends_on).localeCompare(soloFecha(a.ends_on));
    });
  return { totales, apartadas: vigentes.filter(ocupaUnaUnidad) };
}

export function disponibilidadDe(p: EntradaDisponibilidad, hoy: Date = new Date()): Availability {
  const confirmedAt = p.confirmedAt ? p.confirmedAt.toISOString() : null;
  const { totales, apartadas } = vigentesHoy(p, hoy);

  // 1. Bloqueo del equipo entero.
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
  const piezas = Math.max(1, p.stock ?? 1);
  if (apartadas.length >= piezas) {
    const etapa = [...apartadas].sort((a, b) => (PESO_ETAPA[b.state] ?? 0) - (PESO_ETAPA[a.state] ?? 0))[0];
    const primera = apartadas
      .filter((b) => b.ends_on !== null)
      .map((b) => soloFecha(b.ends_on as Date))
      .sort()[0] ?? null;
    return { state: etapa.state as AvailabilityState, location: p.location, confirmedAt, until: primera };
  }

  // 3. Queda al menos una pieza libre.
  return { state: 'disponible', location: p.location, confirmedAt, until: null };
}

/**
 * Las unidades del equipo repartidas por estado HOY (2026-10-26): "8 retros,
 * 6 disponibles, 1 reservada, 1 en mantenimiento". Un bloqueo que para el
 * equipo pone todas sus piezas en ese estado; cada reserva aparta una.
 */
export function unidadesPorEstado(p: EntradaDisponibilidad, hoy: Date = new Date()): Partial<Record<AvailabilityState, number>> {
  const piezas = Math.max(1, p.stock ?? 1);
  const { totales, apartadas } = vigentesHoy(p, hoy);
  if (totales.length > 0) return { [totales[0].state as AvailabilityState]: piezas };
  const cuenta: Partial<Record<AvailabilityState, number>> = {};
  for (const b of apartadas.slice(0, piezas)) {
    const s = b.state as AvailabilityState;
    cuenta[s] = (cuenta[s] ?? 0) + 1;
  }
  const libres = piezas - Math.min(apartadas.length, piezas);
  if (libres > 0) cuenta.disponible = libres;
  return cuenta;
}
