import type { Availability, AvailabilityState } from '@maqserv/types';

/**
 * Presentación de los estados de disponibilidad (manual, 21 / ESTADOS).
 *
 * EL CÁLCULO YA NO VIVE AQUÍ. Lo hace la API, porque depende de datos que solo
 * ella tiene: los bloqueos por fecha y cuándo se confirmó la disponibilidad por
 * última vez. Este archivo solo traduce ese estado a lo que se ve.
 *
 * Regla del manual que no se puede romper: **el color acompaña al texto, nunca
 * lo sustituye**. Por eso cada estado lleva su etiqueta y su nota.
 */

export interface Disponibilidad {
  estado: AvailabilityState;
  /** Etiqueta corta, en mayúsculas, como la usa el manual. */
  etiqueta: string;
  /** Segunda línea: qué significa para quien lo lee. */
  nota: string;
  /** Token de color. Nunca va solo: siempre acompañado de `etiqueta`. */
  color: string;
}

const ESTADOS: Record<AvailabilityState, Omit<Disponibilidad, 'estado'>> = {
  disponible: { etiqueta: 'DISPONIBLE', nota: 'Lista para cotizar', color: 'var(--color-success)' },
  limitada: { etiqueta: 'LIMITADA', nota: 'Ventana reducida', color: 'var(--color-warning)' },
  'por-confirmar': { etiqueta: 'POR CONFIRMAR', nota: 'Validando proveedor', color: 'var(--color-warning)' },
  reservado: { etiqueta: 'RESERVADO', nota: 'Apartado para otra obra', color: 'var(--color-warning)' },
  'en-traslado': { etiqueta: 'EN TRASLADO', nota: 'En camino a una operación', color: 'var(--color-warning)' },
  'en-servicio': { etiqueta: 'EN SERVICIO', nota: 'Trabajando en otra obra', color: 'var(--color-warning)' },
  mantenimiento: { etiqueta: 'MANTENIMIENTO', nota: 'Fuera por condición mecánica', color: 'var(--color-error)' },
  'fuera-de-cobertura': { etiqueta: 'FUERA DE COBERTURA', nota: 'No viable para esa ubicación', color: 'var(--color-error)' },
  'no-disponible': { etiqueta: 'NO DISPONIBLE', nota: 'Buscar alternativa', color: 'var(--color-error)' },
  inactivo: { etiqueta: 'INACTIVO', nota: 'No se considera por ahora', color: 'var(--color-text-muted)' },
};

export function disponibilidad(estado: AvailabilityState): Disponibilidad {
  return { estado, ...ESTADOS[estado] };
}

/**
 * Estado de un producto para pintarlo.
 *
 * `availability` es lo que manda la API. El respaldo por existencias sigue aquí
 * porque la web y la API se despliegan por separado: hay una ventana en la que
 * la web nueva habla con una API que todavía no calcula el estado. Ante la duda
 * se dice POR CONFIRMAR y no DISPONIBLE — el manual prohíbe prometer una
 * disponibilidad que no se puede garantizar.
 */
export function estadoDeProducto(p: {
  availability?: Availability | null;
  stock?: number | null;
  inStock: boolean;
}): Disponibilidad {
  if (p.availability) return disponibilidad(p.availability.state);

  if (p.stock === null || p.stock === undefined) {
    return disponibilidad(p.inStock ? 'por-confirmar' : 'no-disponible');
  }
  if (p.stock <= 0) return disponibilidad('no-disponible');
  if (p.stock <= 3) return disponibilidad('limitada');
  return disponibilidad('disponible');
}

/**
 * Línea de contexto para la ficha: dónde está el equipo y desde cuándo no se
 * confirma. El documento pide que la ubicación forme parte del producto, porque
 * dos máquinas iguales no son la misma solución si una está a 5 km y otra a 150.
 */
export function contextoDisponibilidad(a: Availability | null | undefined): string | null {
  if (!a) return null;
  const partes: string[] = [];
  if (a.location) partes.push(`Ubicación: ${a.location}`);
  if (a.until) partes.push(`Se libera el ${a.until}`);
  if (a.confirmedAt) {
    const dias = Math.floor((Date.now() - new Date(a.confirmedAt).getTime()) / 86_400_000);
    partes.push(
      dias <= 0 ? 'Confirmado hoy' : dias === 1 ? 'Confirmado ayer' : `Confirmado hace ${dias} días`,
    );
  }
  return partes.length ? partes.join(' · ') : null;
}
