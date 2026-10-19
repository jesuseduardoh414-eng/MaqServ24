/**
 * ESTADOS DE DISPONIBILIDAD: cómo se LEEN (2026-10-15).
 *
 * Los estados los define `AvailabilityState` (@maqserv/types, documento
 * institucional, sección 21). Aquí va cómo se muestran, en UN solo lugar.
 *
 * Antes cada pantalla tenía su copia y no coincidían: en el sitio todos los
 * estados intermedios salían en ámbar; en el panel "Reservado" era ámbar en
 * Disponibilidad y Agenda pero azul en Proveedores; "Mantenimiento" era rojo
 * en una y ámbar en otra. Con cinco estados del mismo color no se distinguía
 * un equipo apartado de uno que nadie ha confirmado.
 *
 * Un color por estado, agrupados por lo que responden a "¿puedo contar con
 * este equipo?":
 *   - sí ............ verde (disponible), ámbar (limitada)
 *   - no se sabe .... gris azulado (por confirmar): falta un dato, no es alarma
 *   - ocupado ....... violeta (reservado), azul (en traslado), turquesa (en servicio)
 *   - no ............ naranja (mantenimiento), rojo (no disponible), rosa (fuera de cobertura)
 *   - fuera ......... gris (inactivo)
 *
 * Cada color en dos tonos: `oscuro` para fondos oscuros (el panel y el modo
 * oscuro del sitio) y `claro`, más profundo, para que el texto se lea sobre
 * blanco. Regla del manual que no cambia: el color ACOMPAÑA al texto, nunca
 * lo sustituye; por eso cada estado trae su etiqueta.
 */

export type EstadoDisponibilidad =
  | 'disponible'
  | 'limitada'
  | 'por-confirmar'
  | 'reservado'
  | 'en-traslado'
  | 'en-servicio'
  | 'mantenimiento'
  | 'no-disponible'
  | 'fuera-de-cobertura'
  | 'inactivo';

export interface PresentacionEstado {
  /** En mayúsculas, como lo pide el manual para los estados. */
  etiqueta: string;
  /** En tipo oración, para listas y textos corridos. */
  nombre: string;
  /** Lo que significa para quien va a prometer el equipo. */
  nota: string;
  color: { oscuro: string; claro: string };
}

export const ESTADOS_DISPONIBILIDAD: Record<EstadoDisponibilidad, PresentacionEstado> = {
  disponible: { etiqueta: 'DISPONIBLE', nombre: 'Disponible', nota: 'Lista para cotizar', color: { oscuro: '#22C55E', claro: '#15803D' } },
  limitada: { etiqueta: 'LIMITADA', nombre: 'Limitada', nota: 'Ventana reducida', color: { oscuro: '#F59E0B', claro: '#A16207' } },
  'por-confirmar': { etiqueta: 'POR CONFIRMAR', nombre: 'Por confirmar', nota: 'Falta confirmar que sigue ahí', color: { oscuro: '#94A3B8', claro: '#475569' } },
  reservado: { etiqueta: 'RESERVADO', nombre: 'Reservado', nota: 'Apartado para otra obra', color: { oscuro: '#A78BFA', claro: '#6D28D9' } },
  'en-traslado': { etiqueta: 'EN TRASLADO', nombre: 'En traslado', nota: 'En camino a una operación', color: { oscuro: '#60A5FA', claro: '#1D4ED8' } },
  'en-servicio': { etiqueta: 'EN SERVICIO', nombre: 'En servicio', nota: 'Trabajando en otra obra', color: { oscuro: '#2DD4BF', claro: '#0F766E' } },
  mantenimiento: { etiqueta: 'MANTENIMIENTO', nombre: 'Mantenimiento', nota: 'Fuera por condición mecánica', color: { oscuro: '#FB923C', claro: '#C2410C' } },
  'no-disponible': { etiqueta: 'NO DISPONIBLE', nombre: 'No disponible', nota: 'Buscar alternativa', color: { oscuro: '#F87171', claro: '#C81E1E' } },
  'fuera-de-cobertura': { etiqueta: 'FUERA DE COBERTURA', nombre: 'Fuera de cobertura', nota: 'No viable para esa ubicación', color: { oscuro: '#F472B6', claro: '#BE185D' } },
  inactivo: { etiqueta: 'INACTIVO', nombre: 'Inactivo', nota: 'No se considera por ahora', color: { oscuro: '#8A8A93', claro: '#52525B' } },
};

/** La presentación de un estado; uno desconocido se ve como "por confirmar" con su propio nombre. */
export function presentacionEstado(estado: string): PresentacionEstado {
  const e = ESTADOS_DISPONIBILIDAD[estado as EstadoDisponibilidad];
  if (e) return e;
  const nombre = estado.replace(/-/g, ' ');
  return { ...ESTADOS_DISPONIBILIDAD['por-confirmar'], etiqueta: nombre.toUpperCase(), nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1) };
}

/**
 * Las variables CSS `--estado-<clave>` para el modo claro y el oscuro. El sitio
 * las inyecta junto a los tokens del tema; así una pastilla usa
 * `var(--estado-reservado)` y cambia sola con el modo.
 */
export function cssEstados(modo: 'oscuro' | 'claro'): string {
  return (Object.keys(ESTADOS_DISPONIBILIDAD) as EstadoDisponibilidad[])
    .map((k) => `--estado-${k}:${ESTADOS_DISPONIBILIDAD[k].color[modo]}`)
    .join(';');
}
