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
  /** Bloqueos del equipo; se filtran por fecha aquí mismo. */
  blocks: Array<{ state: string; starts_on: Date; ends_on: Date | null }>;
}

const soloFecha = (d: Date): string => d.toISOString().slice(0, 10);

export function disponibilidadDe(p: EntradaDisponibilidad, hoy: Date = new Date()): Availability {
  const hoyStr = soloFecha(hoy);

  // 1. Bloqueo vigente. Si hay varios, gana el que termina más tarde: es el que
  //    de verdad define cuándo se libera el equipo.
  const vigentes = p.blocks
    .filter(
      (b) =>
        ESTADOS_BLOQUEO.includes(b.state as AvailabilityState) &&
        soloFecha(b.starts_on) <= hoyStr &&
        (b.ends_on === null || soloFecha(b.ends_on) >= hoyStr),
    )
    .sort((a, b) => {
      if (a.ends_on === null) return -1; // sin fecha de retorno pesa más
      if (b.ends_on === null) return 1;
      return soloFecha(b.ends_on).localeCompare(soloFecha(a.ends_on));
    });

  if (vigentes.length > 0) {
    const b = vigentes[0];
    return {
      state: b.state as AvailabilityState,
      location: p.location,
      confirmedAt: p.confirmedAt ? p.confirmedAt.toISOString() : null,
      until: b.ends_on ? soloFecha(b.ends_on) : null,
    };
  }

  const base = { location: p.location, confirmedAt: p.confirmedAt ? p.confirmedAt.toISOString() : null, until: null };

  // 2. Sin confirmar, o con una confirmación vieja: no se promete nada.
  if (p.confirmedAt === null) return { state: 'por-confirmar', ...base };
  const dias = Math.floor((hoy.getTime() - p.confirmedAt.getTime()) / 86_400_000);
  if (dias > DIAS_FRESCURA) return { state: 'por-confirmar', ...base };

  // 3. Recién ahora vale mirar el inventario.
  if (p.stock === null) return { state: 'por-confirmar', ...base };
  if (p.stock <= 0) return { state: 'no-disponible', ...base };
  if (p.stock <= UMBRAL_LIMITADA) return { state: 'limitada', ...base };
  return { state: 'disponible', ...base };
}
