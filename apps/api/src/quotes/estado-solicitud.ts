/**
 * CÓMO VE EL CLIENTE SU SOLICITUD (2026-09-25).
 *
 * El servicio tiene sus pasos de operación (por asignar, asignado, en
 * traslado…) y las propuestas a los aliados tienen los suyos (propuesto,
 * aceptado, rechazado). Al cliente le importa una sola cosa: ¿ya me la
 * aprobaron? Esto lo resume en seis palabras que entiende cualquiera:
 *
 *   enviada     → la recibimos, nadie la ha tomado todavía
 *   en_revision → un aliado la está viendo
 *   aprobada    → el aliado aceptó
 *   rechazada   → el aliado no pudo; MAQSER24 busca otra opción
 *   cancelada   → se canceló el servicio
 *   completada  → se cerró
 *
 * "Rechazada" no es el final: el modelo de MAQSER24 es coordinar, y una
 * negativa dispara la búsqueda de un alterno. Por eso el mensaje lo dice.
 */

export type EstadoSolicitud = 'enviada' | 'en_revision' | 'aprobada' | 'rechazada' | 'cancelada' | 'completada';

export interface SolicitudCliente {
  state: EstadoSolicitud;
  label: string;
  message: string;
}

const TEXTOS: Record<EstadoSolicitud, { label: string; message: string }> = {
  enviada: { label: 'Enviada', message: 'Recibimos tu solicitud. MAQSER24 la está asignando a un aliado.' },
  en_revision: { label: 'En revisión', message: 'El aliado está revisando tu solicitud. Te avisamos en cuanto responda.' },
  aprobada: { label: 'Aprobada', message: 'El aliado aceptó tu solicitud. Quedamos en coordinar el servicio.' },
  rechazada: { label: 'Rechazada', message: 'El aliado no pudo atenderla. MAQSER24 está buscando otra opción para ti.' },
  cancelada: { label: 'Cancelada', message: 'Este servicio se canceló.' },
  completada: { label: 'Completada', message: 'El servicio se realizó y quedó cerrado.' },
};

export function estadoSolicitud(
  serviceState: string | null | undefined,
  asignaciones: Array<{ state: string }>,
): SolicitudCliente | null {
  if (!serviceState) return null;
  let state: EstadoSolicitud;
  if (serviceState === 'cancelado') state = 'cancelada';
  else if (serviceState === 'cerrado') state = 'completada';
  else if (serviceState !== 'por_asignar') state = 'aprobada';
  else if (asignaciones.some((a) => a.state === 'aceptado')) state = 'aprobada';
  else if (asignaciones.some((a) => a.state === 'propuesto')) state = 'en_revision';
  else if (asignaciones.some((a) => a.state === 'rechazado' || a.state === 'retirado')) state = 'rechazada';
  else state = 'enviada';
  return { state, ...TEXTOS[state] };
}
