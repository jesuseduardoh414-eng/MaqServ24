/**
 * HISTORIAL DE CUMPLIMIENTO (documento institucional, sección 23).
 *
 * "En construcción, la confianza no puede depender únicamente de una
 * calificación de estrellas. Es necesario verificar elementos objetivos: [...]
 * evidencia de servicio e HISTORIAL DE CUMPLIMIENTO."
 *
 * El expediente dice si un aliado tiene los papeles. Esto dice si CUMPLE, que
 * es otra cosa: se puede tener todo en regla y no contestar nunca, o aceptar y
 * después cancelar.
 *
 * TRES DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. Con pocos datos NO se dan porcentajes. Dos de dos no es "100% de
 *    cumplimiento": es dos. Un porcentaje sacado de tres casos se lee con la
 *    misma autoridad que uno sacado de trescientos, y esa es exactamente la
 *    calificación de estrellas que el documento pide no imitar. Debajo de
 *    MINIMO_CONFIABLE se devuelven los conteos crudos y `confiable: false`.
 *
 * 2. El tiempo de respuesta MEDIDO vale más que el declarado. Hoy
 *    `providers.response_minutes` es un número que alguien escribió a mano, y
 *    el emparejamiento lo usa para ordenar. Aquí se calcula el real y se
 *    devuelven los dos: el que se prometió y el que se cumple.
 *
 * 3. Lo que no se puede medir se dice, no se inventa. "Llegó a tiempo" pedía la
 *    actividad, pero no hay fecha comprometida contra la cual comparar: la
 *    solicitud trae una fecha deseada, no un compromiso del aliado. Se reporta
 *    como no medible hasta que exista el dato.
 */

/** Debajo de esto no se calculan porcentajes. */
export const MINIMO_CONFIABLE = 5;

export interface AsignacionHistorica {
  state: string;
  offered_at: Date;
  responded_at: Date | null;
  reason: string | null;
  /** Estado del servicio al que pertenece. */
  serviceState: string | null;
}

export interface HistorialAliado {
  /** Veces que se le ofreció una solicitud. */
  ofrecidos: number;
  aceptados: number;
  rechazados: number;
  /** Ofrecidos que siguen esperando respuesta. */
  sinContestar: number;
  /** Servicios que aceptó y llegaron a cerrarse. */
  completados: number;
  /** Aceptados que terminaron cancelados. Es el dato que más pesa. */
  cancelados: number;
  /** Aceptados que siguen corriendo. */
  enCurso: number;
  /**
   * 0 a 100, o null si no hay muestra suficiente. Ver decisión 1.
   */
  tasaAceptacion: number | null;
  tasaCumplimiento: number | null;
  /** Minutos medianos entre ofrecer y contestar. Null si nunca ha contestado. */
  minutosRespuestaReal: number | null;
  /** Si los números ya significan algo o solo son un arranque. */
  confiable: boolean;
  /** Motivos por los que ha rechazado, del más repetido al menos. */
  motivosRechazo: Array<{ motivo: string; veces: number }>;
}

/**
 * Mediana y no promedio: una sola vez que alguien tardó tres días en contestar
 * arrastra el promedio y hace parecer lento a quien normalmente contesta en
 * veinte minutos. La mediana aguanta ese caso.
 */
function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 === 0
    ? Math.round((orden[medio - 1] + orden[medio]) / 2)
    : orden[medio];
}

const CERRADO = 'cerrado';
const CANCELADO = 'cancelado';

export function historialDe(asignaciones: AsignacionHistorica[]): HistorialAliado {
  const ofrecidos = asignaciones.length;
  const aceptadas = asignaciones.filter((a) => a.state === 'aceptado');
  const rechazados = asignaciones.filter((a) => a.state === 'rechazado').length;
  const sinContestar = asignaciones.filter((a) => a.state === 'propuesto').length;

  const completados = aceptadas.filter((a) => a.serviceState === CERRADO).length;
  const cancelados = aceptadas.filter((a) => a.serviceState === CANCELADO).length;
  const enCurso = aceptadas.length - completados - cancelados;

  // Solo cuentan las que ya tuvieron respuesta: las que siguen esperando no
  // dicen "tardó mucho", dicen "todavía no". Meterlas como un tiempo enorme
  // castigaría a quien tiene una propuesta reciente sobre la mesa.
  const tiempos = asignaciones
    .filter((a) => a.responded_at !== null)
    .map((a) => Math.max(0, Math.round((a.responded_at!.getTime() - a.offered_at.getTime()) / 60000)));

  const contestados = ofrecidos - sinContestar;
  const cerrados = completados + cancelados;
  const confiable = ofrecidos >= MINIMO_CONFIABLE;

  const conteo = new Map<string, number>();
  for (const a of asignaciones) {
    if (a.state !== 'rechazado') continue;
    const m = (a.reason ?? '').trim() || 'Sin motivo registrado';
    conteo.set(m, (conteo.get(m) ?? 0) + 1);
  }

  return {
    ofrecidos,
    aceptados: aceptadas.length,
    rechazados,
    sinContestar,
    completados,
    cancelados,
    enCurso,
    tasaAceptacion:
      confiable && contestados > 0 ? Math.round((aceptadas.length / contestados) * 100) : null,
    // Cumplimiento se mide sobre los que ya TERMINARON, no sobre los aceptados:
    // un servicio en curso todavía no cumplió ni dejó de cumplir, y contarlo
    // como fallo castigaría a quien acaba de empezar.
    tasaCumplimiento: confiable && cerrados > 0 ? Math.round((completados / cerrados) * 100) : null,
    minutosRespuestaReal: mediana(tiempos),
    confiable,
    motivosRechazo: [...conteo.entries()]
      .map(([motivo, veces]) => ({ motivo, veces }))
      .sort((a, b) => b.veces - a.veces),
  };
}

/**
 * Cómo se lee el historial en una línea.
 *
 * Cuando no hay muestra suficiente se cuenta lo que hay en crudo en vez de
 * callar: "2 servicios, 2 completados" es información útil; "—" no lo es, y un
 * "100%" sería mentira estadística.
 */
export function resumenHistorial(h: HistorialAliado): string {
  if (h.ofrecidos === 0) return 'Todavía no se le ha ofrecido ninguna solicitud.';
  if (!h.confiable) {
    const partes = [`${h.ofrecidos} solicitud${h.ofrecidos === 1 ? '' : 'es'}`];
    if (h.aceptados > 0) partes.push(`${h.aceptados} aceptada${h.aceptados === 1 ? '' : 's'}`);
    if (h.completados > 0) partes.push(`${h.completados} completada${h.completados === 1 ? '' : 's'}`);
    if (h.cancelados > 0) partes.push(`${h.cancelados} cancelada${h.cancelados === 1 ? '' : 's'}`);
    return `${partes.join(', ')}. Muy pocos casos para sacar porcentajes.`;
  }
  const t = [`Acepta el ${h.tasaAceptacion}% de lo que se le ofrece`];
  if (h.tasaCumplimiento !== null) t.push(`cumple el ${h.tasaCumplimiento}%`);
  if (h.minutosRespuestaReal !== null) t.push(`contesta en ~${h.minutosRespuestaReal} min`);
  return `${t.join(', ')}.`;
}

/**
 * Qué tanto se desvía lo prometido de lo real, en minutos.
 * Positivo = tarda MÁS de lo que dice. Null si falta alguno de los dos.
 */
export function desviacionRespuesta(
  declarado: number | null,
  real: number | null,
): number | null {
  if (declarado === null || real === null) return null;
  return real - declarado;
}
