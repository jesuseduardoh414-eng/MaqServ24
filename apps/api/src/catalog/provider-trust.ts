import type { DocsStatus } from '@maqserv/types';

/**
 * Reglas de confianza de un aliado.
 *
 * El documento institucional (23 / Confianza, documentación y control) es
 * explícito en dos cosas que aquí se cumplen:
 *
 *  1. "La plataforma requiere alertas y reglas que impidan tratar como
 *     verificado un expediente desactualizado." Por eso `verified` exige que
 *     estén los obligatorios y que NINGÚN documento esté vencido.
 *  2. "La reputación de la marca dependerá de que el sello de confianza tenga
 *     un significado real." Por eso no hay forma de marcar a alguien como
 *     verificado a mano: sale de los papeles y de su vigencia.
 */

/** Días antes del vencimiento en que un documento empieza a avisar. */
export const DIAS_AVISO = 30;

/**
 * Tipos de documento del expediente. Vive aquí, junto a las reglas que los
 * evalúan, porque ahora los usan dos lados: el panel (que da de alta el
 * expediente) y el portal del aliado (que lo renueva). Duplicar la lista era
 * garantizar que un día aceptaran tipos distintos.
 *
 * La etiqueta es para el aliado: "seguro" no le dice qué papel subir.
 */
export const TIPOS_DOC = ['fiscal', 'legal', 'seguro', 'tecnico', 'seguridad', 'otro'] as const;
export type TipoDoc = (typeof TIPOS_DOC)[number];

export const DOC_LABEL: Record<TipoDoc, string> = {
  fiscal: 'Constancia de situación fiscal',
  legal: 'Documento legal (acta, poder)',
  seguro: 'Póliza de seguro',
  tecnico: 'Documento técnico del equipo',
  seguridad: 'Documento de seguridad',
  otro: 'Otro',
};

/**
 * PAPELES OBLIGATORIOS (2026-10-22, Fase B). Antes bastaba UN papel vigente
 * para el sello: una credencial del IMSS y nada más ya daba "verificado". El
 * cuestionario de Dirección (pregunta 7) quedó sin respuesta, así que va lo
 * mínimo que cualquier obra pide a cualquier aliado: su constancia fiscal y su
 * póliza de seguro. Sin ellos el expediente queda "incompleto" y no hay sello.
 */
export const PAPELES_OBLIGATORIOS: readonly TipoDoc[] = ['fiscal', 'seguro'];

/** Los obligatorios que no tiene vigentes (vencidos cuentan como "no los tiene"). */
export function papelesQueFaltan(
  todos: Array<{ kind: string; name: string | null; expires_at: Date | null; id?: number }>,
  hoy: Date = new Date(),
): TipoDoc[] {
  const docs = papelesVigentes(todos);
  return PAPELES_OBLIGATORIOS.filter((k) => !docs.some((d) => d.kind === k && (d.expires_at === null || d.expires_at >= hoy)));
}

/**
 * EL PAPEL RENOVADO REEMPLAZA AL VIEJO (2026-10-19). "Ya cambié la constancia
 * pero no cambió nada": al subir la renovada quedaban las dos, y la vencida
 * seguía quitándole el sello al aliado y avisando que había vencido.
 *
 * Un papel del MISMO TIPO y con el MISMO NOMBRE que otro es su renovación; de
 * cada grupo cuenta solo el que vence más tarde (sin fecha = no vence). La
 * constancia fiscal es una sola por aliado, así que ahí basta el tipo: da igual
 * si una se llamó "CSF 2025" y la otra "Constancia". Los anteriores NO se
 * borran —quedan en el expediente como reemplazados, con su archivo—, pero ya
 * no cuentan para el sello ni para los avisos.
 */
const UNO_POR_ALIADO = new Set<string>(['fiscal']);

const normal = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

export function grupoDocumento(d: { kind: string; name: string | null }): string {
  if (UNO_POR_ALIADO.has(d.kind)) return d.kind;
  return `${d.kind}|${normal(d.name || DOC_LABEL[d.kind as TipoDoc] || d.kind)}`;
}

/** Los ids de los papeles que ya fueron reemplazados por su renovación. */
export function reemplazados<T extends { kind: string; name: string | null; expires_at: Date | null; id?: number }>(docs: T[]): Set<T> {
  const vence = (d: T) => d.expires_at?.getTime() ?? Number.POSITIVE_INFINITY;
  const actual = new Map<string, T>();
  for (const d of docs) {
    const g = grupoDocumento(d);
    const a = actual.get(g);
    // El que vence más tarde; si empatan, el subido después.
    if (!a || vence(d) > vence(a) || (vence(d) === vence(a) && (d.id ?? 0) > (a.id ?? 0))) actual.set(g, d);
  }
  const vigentes = new Set(actual.values());
  return new Set(docs.filter((d) => !vigentes.has(d)));
}

/** Solo los papeles que cuentan: sin los que ya se renovaron. */
export function papelesVigentes<T extends { kind: string; name: string | null; expires_at: Date | null; id?: number }>(docs: T[]): T[] {
  const fuera = reemplazados(docs);
  return docs.filter((d) => !fuera.has(d));
}

export function estadoDocumentos(
  todos: Array<{ kind: string; name: string | null; expires_at: Date | null; id?: number }>,
  hoy: Date = new Date(),
): DocsStatus {
  const docs = papelesVigentes(todos);
  if (docs.length === 0) return 'sin-documentos';

  const conVigencia = docs.filter((d) => d.expires_at !== null);
  const limite = new Date(hoy.getTime() + DIAS_AVISO * 24 * 60 * 60 * 1000);
  if (conVigencia.some((d) => d.expires_at! < hoy)) return 'vencido';

  // Faltan los obligatorios (2026-10-22): no hay sello aunque lo demás esté en regla.
  if (papelesQueFaltan(todos, hoy).length) return 'incompleto';

  // Documentos que no vencen (un acta constitutiva, por ejemplo) cuentan como
  // entregados: si hay papeles y ninguno tiene fecha, el expediente está al día.
  if (conVigencia.some((d) => d.expires_at! <= limite)) return 'por-vencer';
  return 'al-dia';
}

/**
 * Un aliado está verificado si su expediente está completo (constancia fiscal
 * y póliza) y sin vencidos. "Por vencer" todavía cuenta como verificado: el
 * papel sigue siendo válido y lo que corresponde es avisar, no cortar.
 *
 * SIN NIVEL (2026-10-27, revisión de Proveedores). Antes además pedía que
 * alguien subiera al aliado a "validado" a mano, y nadie lo hacía: los aliados
 * salían "sin sello" con o sin papeles. Ahora sale solo de los papeles; si uno
 * no sirve, se quita del expediente y el sello se va con él. La única marca a
 * mano que queda es "preferente" (ver `matching.ts`).
 */
export function estaVerificado(docs: DocsStatus): boolean {
  return docs === 'al-dia' || docs === 'por-vencer';
}

/** Meses completos desde el alta. Alimenta el "N meses en red" del manual (22). */
export function mesesEnRed(joinedAt: Date | null, hoy: Date = new Date()): number | null {
  if (!joinedAt) return null;
  const meses =
    (hoy.getFullYear() - joinedAt.getFullYear()) * 12 + (hoy.getMonth() - joinedAt.getMonth());
  return Math.max(0, meses);
}
