import { DIAS_AVISO } from './provider-trust';

/**
 * AVISOS DE EXPEDIENTE (documento institucional, sección 23).
 *
 * "La plataforma requiere alertas y reglas que impidan tratar como verificado
 * un expediente desactualizado."
 *
 * Las REGLAS ya existían: `estadoDocumentos` marca vencido y `estaVerificado`
 * le quita el sello a quien tiene papeles caídos. Lo que faltaba era la mitad
 * que da nombre a la frase: nadie avisaba. Un aliado perdía el sello el día que
 * se le vencía la póliza y se descubría cuando ya había pasado —normalmente al
 * ir a asignarle una obra, que es el peor momento posible.
 *
 * DOS DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. El aviso se ordena por URGENCIA REAL, no por fecha. Un documento vencido
 *    de un aliado preferente que hoy tiene tres obras corriendo importa más que
 *    uno por vencer de alguien que nunca ha trabajado. Ordenar por fecha sola
 *    pone arriba lo viejo, no lo que duele.
 *
 * 2. Se avisa aunque el aliado esté inactivo, pero al final y marcado. Darlo de
 *    alta otra vez con papeles caídos es el error que estas alertas existen
 *    para evitar, y esconderlo lo garantiza.
 */

export type Urgencia = 'vencido' | 'por-vencer';

export interface DocumentoConVigencia {
  id: number;
  kind: string;
  name: string | null;
  expires_at: Date | null;
}

export interface AvisoDocumento {
  documentId: number;
  kind: string;
  name: string | null;
  expiresAt: Date;
  /** Negativo si ya venció. */
  diasRestantes: number;
  urgencia: Urgencia;
}

export interface AvisoAliado {
  providerId: number;
  name: string;
  level: string;
  activo: boolean;
  /** Si hoy pierde el sello por estos papeles. */
  pierdeSello: boolean;
  /** Servicios suyos corriendo ahora mismo. Es lo que vuelve urgente el aviso. */
  serviciosActivos: number;
  documentos: AvisoDocumento[];
  /** Lo peor que tiene. Ordena la lista. */
  peor: Urgencia;
  /** Días del documento más apremiante. */
  diasPeor: number;
}

const DIA = 24 * 60 * 60 * 1000;

/** Días entre hoy y la fecha, sin la hora de por medio. */
export function diasHasta(fecha: Date, hoy: Date = new Date()): number {
  const a = Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate());
  const b = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  return Math.round((a - b) / DIA);
}

/**
 * Los documentos de un aliado que piden atención.
 * Los que no vencen nunca (un acta constitutiva) no entran: no hay nada que avisar.
 */
export function documentosQueAvisan(
  docs: DocumentoConVigencia[],
  hoy: Date = new Date(),
): AvisoDocumento[] {
  return docs
    .filter((d): d is DocumentoConVigencia & { expires_at: Date } => d.expires_at !== null)
    .map((d) => {
      const dias = diasHasta(d.expires_at, hoy);
      return {
        documentId: d.id,
        kind: d.kind,
        name: d.name,
        expiresAt: d.expires_at,
        diasRestantes: dias,
        urgencia: (dias < 0 ? 'vencido' : 'por-vencer') as Urgencia,
      };
    })
    .filter((d) => d.diasRestantes <= DIAS_AVISO)
    .sort((a, b) => a.diasRestantes - b.diasRestantes);
}

/**
 * Qué tan urgente es atender a este aliado. Mayor es más urgente.
 *
 * Un vencido pesa mucho más que un por vencer, y tener obras corriendo lo
 * multiplica: ahí el papel caído no es un trámite pendiente, es una obra
 * expuesta.
 */
export function urgencia(a: AvisoAliado): number {
  let p = 0;
  if (a.peor === 'vencido') p += 1000;
  // Cuanto menos días queden, más arriba. Un vencido hace 40 días pesa más que
  // uno de ayer: lleva más tiempo sin que nadie lo mire.
  p += Math.max(0, DIAS_AVISO - a.diasPeor);
  p += a.serviciosActivos * 60;
  if (a.pierdeSello) p += 120;
  if (!a.activo) p -= 2000; // Al final de la lista, pero presente.
  return p;
}

/** Cómo se lee. El plazo va en el texto porque el color por sí solo no comunica. */
export function textoAviso(d: AvisoDocumento): string {
  if (d.diasRestantes < 0) {
    const n = Math.abs(d.diasRestantes);
    return n === 0 ? 'Venció hoy' : `Venció hace ${n} día${n === 1 ? '' : 's'}`;
  }
  if (d.diasRestantes === 0) return 'Vence hoy';
  return `Vence en ${d.diasRestantes} día${d.diasRestantes === 1 ? '' : 's'}`;
}
