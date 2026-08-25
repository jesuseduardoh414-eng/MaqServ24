import type { DocsStatus, ProviderLevel } from '@maqserv/types';

/**
 * Reglas de confianza de un aliado.
 *
 * El documento institucional (23 / Confianza, documentación y control) es
 * explícito en dos cosas que aquí se cumplen:
 *
 *  1. "La plataforma requiere alertas y reglas que impidan tratar como
 *     verificado un expediente desactualizado." Por eso `verified` exige que
 *     NINGÚN documento esté vencido, no solo que el nivel sea alto.
 *  2. "La reputación de la marca dependerá de que el sello de confianza tenga
 *     un significado real." Por eso no hay forma de marcar a alguien como
 *     verificado a mano: sale de los papeles y de su vigencia.
 */

/** Días antes del vencimiento en que un documento empieza a avisar. */
export const DIAS_AVISO = 30;

/** Niveles que, con el expediente en regla, cuentan como verificados. */
const NIVELES_VERIFICABLES: ProviderLevel[] = ['validado', 'activo', 'preferente'];

export function estadoDocumentos(
  docs: Array<{ expires_at: Date | null }>,
  hoy: Date = new Date(),
): DocsStatus {
  if (docs.length === 0) return 'sin-documentos';

  const conVigencia = docs.filter((d) => d.expires_at !== null);
  // Documentos que no vencen (un acta constitutiva, por ejemplo) cuentan como
  // entregados: si hay papeles y ninguno tiene fecha, el expediente está al día.
  if (conVigencia.length === 0) return 'al-dia';

  const limite = new Date(hoy.getTime() + DIAS_AVISO * 24 * 60 * 60 * 1000);
  if (conVigencia.some((d) => d.expires_at! < hoy)) return 'vencido';
  if (conVigencia.some((d) => d.expires_at! <= limite)) return 'por-vencer';
  return 'al-dia';
}

/**
 * Un aliado está verificado si alcanzó al menos el nivel 'validado' Y su
 * expediente no tiene vencidos. "Por vencer" todavía cuenta como verificado:
 * el papel sigue siendo válido y lo que corresponde es avisar, no cortar.
 */
export function estaVerificado(level: string, docs: DocsStatus): boolean {
  if (!NIVELES_VERIFICABLES.includes(level as ProviderLevel)) return false;
  return docs === 'al-dia' || docs === 'por-vencer';
}

/** Meses completos desde el alta. Alimenta el "N meses en red" del manual (22). */
export function mesesEnRed(joinedAt: Date | null, hoy: Date = new Date()): number | null {
  if (!joinedAt) return null;
  const meses =
    (hoy.getFullYear() - joinedAt.getFullYear()) * 12 + (hoy.getMonth() - joinedAt.getMonth());
  return Math.max(0, meses);
}
