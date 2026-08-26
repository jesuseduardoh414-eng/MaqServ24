/**
 * EL SERVICIO, DE PUNTA A PUNTA (documento institucional, sección 16).
 *
 * El documento describe el flujo completo y nombra sus etapas:
 *
 *   "El cliente confirma condiciones y se formaliza la ASIGNACIÓN.
 *    Operaciones coordina traslado, llegada, servicio, viajes, entrega de
 *    material o inicio de renta. La plataforma registra ESTATUS e incidencias
 *    durante la ejecución. Al finalizar, se documenta CIERRE, horas, viajes,
 *    cantidades, evidencias y ajustes si existieron."
 *
 * Hasta ahora la plataforma se detenía en la cotización: se respondía, el
 * cliente aceptaba y ahí terminaba el rastro. Lo que pasaba después vivía en
 * llamadas y WhatsApp, que es justo el problema que el documento señala:
 * "falta de trazabilidad sobre quién cotizó, qué se ofreció, dónde está el
 * equipo y cuál es el estatus de la operación".
 *
 * DOS REGLAS QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. Se puede SALTAR hacia adelante, nunca hacia atrás sin dejar rastro. Una
 *    pipa que llega y descarga no pasa por "en traslado" y luego "en sitio" y
 *    luego "en curso": llega y hace el viaje. Obligar a marcar etapas que no
 *    ocurrieron enseña a la gente a mentirle al sistema.
 *
 * 2. No se cierra sin registrar CUÁNTO. El documento pide documentar "horas,
 *    viajes, cantidades" al finalizar, y es el dato del que dependen la
 *    factura, el historial del aliado y las métricas. Si el cierre fuera
 *    opcional, en tres meses no habría con qué medir nada.
 */

export const ESTADOS = [
  'por_asignar',
  'asignado',
  'en_traslado',
  'en_sitio',
  'en_curso',
  'terminado',
  'cerrado',
  'cancelado',
] as const;

export type EstadoServicio = (typeof ESTADOS)[number];

export interface PasoServicio {
  clave: EstadoServicio;
  /** Como lo ve operaciones en el tablero. */
  label: string;
  /** Qué significa, para quien no vivió la operación. */
  hint: string;
  /** Cómo se le cuenta al cliente. Es otra persona y otra pregunta. */
  cliente: string;
}

export const PASOS: Record<EstadoServicio, PasoServicio> = {
  por_asignar: {
    clave: 'por_asignar',
    label: 'Por asignar',
    hint: 'El cliente aceptó la cotización. Falta confirmar qué aliado lo atiende.',
    cliente: 'Recibimos tu confirmación. Estamos asignando al proveedor que te atenderá.',
  },
  asignado: {
    clave: 'asignado',
    label: 'Asignado',
    hint: 'Ya hay aliado confirmado. Falta programar el traslado o la llegada.',
    cliente: 'Ya tenemos proveedor asignado para tu servicio.',
  },
  en_traslado: {
    clave: 'en_traslado',
    label: 'En traslado',
    hint: 'La unidad va en camino a la obra.',
    cliente: 'La unidad va en camino a tu obra.',
  },
  en_sitio: {
    clave: 'en_sitio',
    label: 'En sitio',
    hint: 'Llegó a la obra. Todavía no arranca el servicio o la renta.',
    cliente: 'La unidad ya llegó a tu obra.',
  },
  en_curso: {
    clave: 'en_curso',
    label: 'En curso',
    hint: 'El servicio está corriendo: la renta arrancó, los viajes están saliendo o el material se está entregando.',
    cliente: 'Tu servicio está en curso.',
  },
  terminado: {
    clave: 'terminado',
    label: 'Terminado',
    hint: 'Se terminó la operación. Falta documentar el cierre para poder facturar.',
    cliente: 'Terminamos tu servicio. Estamos preparando el cierre.',
  },
  cerrado: {
    clave: 'cerrado',
    label: 'Cerrado',
    hint: 'Cierre documentado: cuánto se usó, con qué unidad y con qué observaciones.',
    cliente: 'Tu servicio quedó cerrado.',
  },
  cancelado: {
    clave: 'cancelado',
    label: 'Cancelado',
    hint: 'La operación no se llevó a cabo.',
    cliente: 'Tu servicio fue cancelado.',
  },
};

/** Orden de avance. `cancelado` no está: se puede llegar ahí desde casi cualquier lado. */
const AVANCE: EstadoServicio[] = [
  'por_asignar', 'asignado', 'en_traslado', 'en_sitio', 'en_curso', 'terminado', 'cerrado',
];

/**
 * ¿Se puede pasar de `desde` a `hacia`?
 *
 * Adelante sí, incluso saltando etapas (regla 1 de arriba). Hacia atrás no:
 * el historial se corrige agregando un evento, no reescribiendo el pasado.
 * `cerrado` y `cancelado` son finales.
 */
export function sePuedeMover(desde: EstadoServicio, hacia: EstadoServicio): boolean {
  if (desde === hacia) return false;
  if (desde === 'cerrado' || desde === 'cancelado') return false;
  // Cancelar es válido mientras el servicio no haya terminado: una vez que la
  // unidad trabajó, lo que corresponde es cerrar con lo que se haya usado, no
  // borrar la operación.
  if (hacia === 'cancelado') return desde !== 'terminado';
  const a = AVANCE.indexOf(desde);
  const b = AVANCE.indexOf(hacia);
  return a !== -1 && b > a;
}

/** Los estados a los que se puede mover hoy. Es lo que se pinta como botones. */
export function siguientes(desde: EstadoServicio): EstadoServicio[] {
  return ESTADOS.filter((e) => sePuedeMover(desde, e));
}

/** Cerrar exige el dato del que depende todo lo demás. */
export function puedeCerrar(cantidad: number | null | undefined, unidad: string | null | undefined): boolean {
  return typeof cantidad === 'number' && cantidad > 0 && !!unidad;
}

export function esEstado(v: string | null | undefined): v is EstadoServicio {
  return !!v && (ESTADOS as readonly string[]).includes(v);
}

/** Estado de una cotización que todavía no entra al flujo del servicio. */
export function estadoInicial(): EstadoServicio {
  return 'por_asignar';
}

/**
 * Qué tan avanzado va, de 0 a 1. Sirve para la barra del cliente.
 * Cancelado no tiene avance: no llegó a ningún lado.
 */
export function avance(estado: EstadoServicio): number {
  if (estado === 'cancelado') return 0;
  const i = AVANCE.indexOf(estado);
  return i === -1 ? 0 : i / (AVANCE.length - 1);
}
