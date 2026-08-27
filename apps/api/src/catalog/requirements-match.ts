import type { DocsStatus } from '@maqserv/types';

/**
 * ¿EL ALIADO CUMPLE LO QUE ESA OBRA EXIGE? (documento institucional, 23).
 *
 * "Es necesario verificar elementos objetivos: existencia del proveedor,
 * documentos, seguros cuando correspondan, datos del equipo, operador,
 * condiciones de seguridad."
 *
 * Las obras ya guardan qué exigen para dejar entrar. Faltaba cruzarlo con el
 * expediente del aliado, que es donde eso se vuelve útil: advertir ANTES de
 * asignar, en vez de enterarse cuando la unidad ya está en la puerta.
 *
 * TRES DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. Lo que NO se puede verificar se dice, no se adivina. Un requisito escrito
 *    a mano —"que el operador hable inglés"— no se puede contrastar contra
 *    nada. Sale como "hay que confirmarlo con el aliado", que es información
 *    útil; darlo por bueno sería mentir y darlo por incumplido sería descartar
 *    a alguien por no tener un papel que nadie le pidió.
 *
 * 2. No descarta, ADVIERTE. Un aliado sin la póliza al día puede conseguirla en
 *    un día, y a veces la obra la pide como formalidad. Esconderlo dejaría
 *    solicitudes sin cubrir; enseñarlo deja que quien cotiza decida con el dato
 *    enfrente. Es el mismo criterio que la zona en el emparejamiento.
 *
 * 3. El catálogo reconoce SINÓNIMOS porque quien captura la obra escribe como
 *    habla: "seguro del operador", "póliza de operador" y "seguro vigente del
 *    operador" son lo mismo. Exigir que escriba la etiqueta exacta haría que el
 *    cruce fallara justo cuando más se usa.
 */

/** Qué acredita un requisito: un tipo de documento vigente, o nada verificable. */
export type Acreditacion = { tipo: 'documento'; kind: string } | { tipo: 'no-verificable' };

export interface RequisitoConocido {
  clave: string;
  /** Como se ofrece en el editor de la obra. */
  label: string;
  /** Cómo lo puede haber escrito quien capturó la obra. */
  sinonimos: string[];
  acredita: Acreditacion;
  /** Qué hay que pedirle al aliado cuando no lo acredita. */
  comoSeResuelve: string;
}

export const CATALOGO_REQUISITOS: RequisitoConocido[] = [
  {
    clave: 'induccion',
    label: 'Inducción de seguridad',
    sinonimos: ['induccion', 'induccion de seguridad', 'curso de induccion', 'platica de seguridad'],
    acredita: { tipo: 'documento', kind: 'seguridad' },
    comoSeResuelve: 'Constancia de inducción o programa de seguridad vigente en su expediente.',
  },
  {
    clave: 'seguro_operador',
    label: 'Seguro vigente del operador',
    sinonimos: ['seguro del operador', 'seguro vigente del operador', 'poliza del operador', 'poliza de operador'],
    acredita: { tipo: 'documento', kind: 'seguro' },
    comoSeResuelve: 'Póliza vigente cargada en su expediente.',
  },
  {
    clave: 'responsabilidad_civil',
    label: 'Póliza de responsabilidad civil',
    sinonimos: ['responsabilidad civil', 'poliza de responsabilidad civil', 'rc', 'seguro de rc'],
    acredita: { tipo: 'documento', kind: 'seguro' },
    comoSeResuelve: 'Póliza de RC vigente cargada en su expediente.',
  },
  {
    clave: 'dc3',
    label: 'DC-3 del operador',
    sinonimos: ['dc3', 'dc-3', 'constancia de habilidades', 'certificado del operador'],
    acredita: { tipo: 'documento', kind: 'tecnico' },
    comoSeResuelve: 'DC-3 o constancia de habilidades del operador en su expediente.',
  },
  {
    clave: 'situacion_fiscal',
    label: 'Constancia de situación fiscal',
    sinonimos: ['constancia de situacion fiscal', 'situacion fiscal', 'csf', 'opinion del sat'],
    acredita: { tipo: 'documento', kind: 'fiscal' },
    comoSeResuelve: 'Constancia de situación fiscal vigente.',
  },
  {
    // Del EQUIPO, no del expediente: no hay papel que lo demuestre.
    clave: 'torreta',
    label: 'Vehículo con torreta',
    sinonimos: ['torreta', 'vehiculo con torreta', 'unidad con torreta', 'baliza'],
    acredita: { tipo: 'no-verificable' },
    comoSeResuelve: 'Confírmalo con el aliado al ofrecerle la solicitud.',
  },
  {
    clave: 'extintor',
    label: 'Extintor a bordo',
    sinonimos: ['extintor', 'extintor a bordo', 'extinguidor'],
    acredita: { tipo: 'no-verificable' },
    comoSeResuelve: 'Confírmalo con el aliado al ofrecerle la solicitud.',
  },
];

/** Ignora acentos, mayúsculas y puntuación. */
function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * ¿Qué requisito conocido es este texto? Null si no lo reconocemos.
 *
 * Se compara por inclusión en ambos sentidos: quien captura escribe
 * "seguro del operador vigente" y el sinónimo es "seguro del operador".
 */
export function reconocer(texto: string): RequisitoConocido | null {
  const t = normalizar(texto);
  if (!t) return null;
  for (const r of CATALOGO_REQUISITOS) {
    const candidatos = [normalizar(r.label), ...r.sinonimos.map(normalizar)];
    if (candidatos.some((c) => c.length > 2 && (t.includes(c) || c.includes(t)))) return r;
  }
  return null;
}

export type EstadoRequisito = 'acreditado' | 'falta' | 'por-confirmar';

export interface RequisitoEvaluado {
  texto: string;
  estado: EstadoRequisito;
  /** Qué hacer al respecto, en palabras. */
  nota: string;
}

export interface DocumentoDelAliado {
  kind: string;
  expires_at: Date | null;
}

/**
 * Cruza lo que la obra exige contra el expediente del aliado.
 *
 * Un documento vencido NO acredita: es exactamente el caso que el documento
 * institucional pide impedir —"que impidan tratar como verificado un
 * expediente desactualizado"— y aquí es donde más duele, porque la obra lo va
 * a pedir en la puerta.
 */
export function evaluarRequisitos(
  requisitos: string[],
  docs: DocumentoDelAliado[],
  hoy: Date = new Date(),
): RequisitoEvaluado[] {
  return requisitos.map((texto) => {
    const conocido = reconocer(texto);

    if (!conocido) {
      // Decisión 1: no se adivina.
      return {
        texto,
        estado: 'por-confirmar' as const,
        nota: 'No lo podemos verificar con su expediente. Pregúntaselo al ofrecerle la solicitud.',
      };
    }

    if (conocido.acredita.tipo === 'no-verificable') {
      return { texto, estado: 'por-confirmar' as const, nota: conocido.comoSeResuelve };
    }

    const kind = conocido.acredita.kind;
    const suyos = docs.filter((d) => d.kind === kind);
    const vigente = suyos.some((d) => d.expires_at === null || d.expires_at >= hoy);

    if (vigente) {
      return { texto, estado: 'acreditado' as const, nota: 'Lo tiene vigente en su expediente.' };
    }
    return {
      texto,
      estado: 'falta' as const,
      nota: suyos.length > 0
        ? `Lo tiene, pero vencido. ${conocido.comoSeResuelve}`
        : conocido.comoSeResuelve,
    };
  });
}

/**
 * Resumen para el emparejamiento: cuántos faltan y cómo se lee.
 * Devuelve null cuando la obra no exige nada — no hay nada que advertir.
 */
export function advertenciaDeRequisitos(
  evaluados: RequisitoEvaluado[],
): { faltan: number; porConfirmar: number; texto: string } | null {
  if (evaluados.length === 0) return null;
  const faltan = evaluados.filter((e) => e.estado === 'falta');
  const porConfirmar = evaluados.filter((e) => e.estado === 'por-confirmar');

  if (faltan.length === 0 && porConfirmar.length === 0) return null;

  const partes: string[] = [];
  if (faltan.length > 0) {
    partes.push(`No acredita: ${faltan.map((f) => f.texto).join(', ')}`);
  }
  if (porConfirmar.length > 0) {
    partes.push(`Confirmar con él: ${porConfirmar.map((f) => f.texto).join(', ')}`);
  }
  return {
    faltan: faltan.length,
    porConfirmar: porConfirmar.length,
    texto: `La obra exige. ${partes.join(' · ')}`,
  };
}

/** Marca de verificación por documentos, para reusar la misma regla. */
export function acreditaTodo(evaluados: RequisitoEvaluado[]): boolean {
  return evaluados.every((e) => e.estado === 'acreditado');
}

export type { DocsStatus };
