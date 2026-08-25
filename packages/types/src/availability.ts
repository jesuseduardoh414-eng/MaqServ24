/**
 * DISPONIBILIDAD (documento institucional, sección 21).
 *
 * Los estados son los que enumera el documento. No es una lista decorativa: cada
 * uno responde algo distinto a "¿puedo contar con este equipo?".
 */
export type AvailabilityState =
  /** Puede asignarse dentro de las condiciones registradas. */
  | 'disponible'
  /** Hay, pero poco: la ventana es reducida. */
  | 'limitada'
  /** El sistema conoce el activo, pero requiere validación del proveedor. */
  | 'por-confirmar'
  /** Apartado para una operación que aún no inicia. */
  | 'reservado'
  /** Asignado y movilizándose hacia o desde una operación. */
  | 'en-traslado'
  /** Actualmente ocupado en una renta o servicio. */
  | 'en-servicio'
  /** No disponible por condición mecánica o preventiva. */
  | 'mantenimiento'
  /** Existe capacidad, pero no es viable para la ubicación solicitada. */
  | 'fuera-de-cobertura'
  /** Sin existencias. */
  | 'no-disponible'
  /** No debe considerarse para nuevas solicitudes hasta actualización. */
  | 'inactivo';

export interface Availability {
  state: AvailabilityState;
  /** Municipio donde está el equipo. Sin esto no se puede calcular cercanía ni traslado. */
  location: string | null;
  /**
   * Cuándo se confirmó la disponibilidad por última vez, en ISO.
   * Es la "marca de antigüedad del dato" que pide el documento: una confirmación
   * vieja deja de sostener una promesa y el equipo vuelve a POR CONFIRMAR.
   */
  confirmedAt: string | null;
  /** Si está bloqueado, hasta cuándo. Null = sin fecha de retorno. */
  until: string | null;
}
