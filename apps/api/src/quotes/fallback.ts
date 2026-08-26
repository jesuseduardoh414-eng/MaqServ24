/**
 * PROVEEDOR ALTERNO (documento institucional, secciones 16 y 24).
 *
 * "El flujo debe considerar alternativas" y "se construyen una o varias
 * alternativas". Hoy, cuando un aliado rechaza o simplemente no contesta, la
 * solicitud se queda parada hasta que alguien se acuerda de ella. El
 * emparejamiento ya sabe quién más puede; lo que falta es que el sistema lo
 * ofrezca ANTES de que el cliente llame a preguntar.
 *
 * TRES DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. El sistema PREPARA al siguiente, no le habla solo. La actividad pide "que
 *    el sistema ya tenga a quién seguirle", y eso es tener listo al candidato,
 *    no ofrecer por su cuenta. Ofrecer automáticamente a dos aliados a la vez
 *    termina con dos unidades en la misma obra o con un aliado que aparta una
 *    máquina para nada — y el que paga esa cuenta es la relación con el
 *    proveedor, que es el activo del modelo.
 *
 * 2. "No contesta" NO es un plazo fijo. Se mide contra lo que ESE aliado suele
 *    tardar (historial de cumplimiento): a uno que normalmente responde en 11
 *    minutos, cuatro horas de silencio dicen algo; a uno que siempre tarda dos
 *    horas y media, no dicen nada todavía. Un timeout único trataría igual dos
 *    situaciones que no se parecen.
 *
 * 3. A quien ya rechazó NO se le vuelve a ofrecer lo mismo. Suena obvio, pero
 *    es la falla clásica de estas listas: el candidato mejor puntuado sigue
 *    siendo el mejor puntuado después de decir que no, y sin excluirlo el
 *    sistema lo propone en bucle.
 */

/** Nunca se marca estancada antes de esto, aunque el aliado sea rapidísimo. */
export const ESPERA_MINIMA_MIN = 60;
/** Ni se espera más que esto, aunque el aliado sea lentísimo. */
export const ESPERA_MAXIMA_MIN = 24 * 60;
/**
 * Cuánto se SUPONE que tarda un aliado del que no sabemos nada. No es la
 * espera: es la base que después se multiplica por la holgura. Se puso en una
 * hora —y no en dos— porque con la holgura de abajo eso ya da tres horas de
 * silencio antes de avisar, y en obra tres horas es bastante.
 */
export const RESPUESTA_SUPUESTA_MIN = 60;
/** Cuántas veces su tiempo normal se le concede antes de considerarlo silencio. */
const HOLGURA = 3;

export interface OfertaViva {
  assignmentId: number;
  providerId: number;
  providerName: string;
  offeredAt: Date;
  /** Lo que ese aliado suele tardar (medido). Null si aún no hay historial. */
  minutosRespuestaReal: number | null;
  /** Lo que declaró al darse de alta. */
  minutosRespuestaDeclarado: number | null;
}

export interface OfertaEvaluada extends OfertaViva {
  minutosEsperando: number;
  /** Cuánto se le concede antes de considerarlo silencio. */
  margenMin: number;
  estancada: boolean;
  /** Cómo se lee. El plazo va en el texto, no solo en el color. */
  texto: string;
}

/**
 * Cuánto se le concede a este aliado antes de dar su silencio por respuesta.
 *
 * Manda el tiempo MEDIDO sobre el declarado, por lo mismo que en el
 * emparejamiento: uno es lo que prometió, el otro lo que cumple.
 */
export function margenDeEspera(
  minutosReal: number | null,
  minutosDeclarado: number | null,
): number {
  const base = minutosReal ?? minutosDeclarado ?? RESPUESTA_SUPUESTA_MIN;
  return Math.min(ESPERA_MAXIMA_MIN, Math.max(ESPERA_MINIMA_MIN, base * HOLGURA));
}

function legible(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas} h`;
  const dias = Math.floor(horas / 24);
  return `${dias} día${dias === 1 ? '' : 's'}`;
}

export function evaluarOferta(o: OfertaViva, ahora: Date = new Date()): OfertaEvaluada {
  const minutosEsperando = Math.max(0, Math.round((ahora.getTime() - o.offeredAt.getTime()) / 60000));
  const margenMin = margenDeEspera(o.minutosRespuestaReal, o.minutosRespuestaDeclarado);
  const estancada = minutosEsperando > margenMin;

  // El texto dice contra QUÉ se está midiendo. "Lleva 4 h sin contestar" solo
  // alarma; "lleva 4 h y normalmente contesta en 11 min" permite decidir.
  const referencia = o.minutosRespuestaReal ?? o.minutosRespuestaDeclarado;
  const texto = estancada
    ? referencia !== null
      ? `Lleva ${legible(minutosEsperando)} sin contestar y normalmente responde en ${legible(referencia)}`
      : `Lleva ${legible(minutosEsperando)} sin contestar`
    : `Esperando respuesta desde hace ${legible(minutosEsperando)}`;

  return { ...o, minutosEsperando, margenMin, estancada, texto };
}

/**
 * A quién se le puede ofrecer ahora, del emparejamiento, quitando a los que ya
 * pasaron por aquí.
 *
 * `descartados` incluye a los que rechazaron, a los que se retiraron y a los
 * que ya tienen una propuesta viva: volver a ofrecerle al mismo no es una
 * alternativa, y al que ya dijo que no, insistir es solo ruido.
 */
export function siguientesCandidatos<T extends { providerId: number }>(
  candidatos: T[],
  descartados: Set<number>,
): T[] {
  return candidatos.filter((c) => !descartados.has(c.providerId));
}

/**
 * Qué hay que hacer con esta solicitud, en una línea.
 *
 * Devuelve `null` cuando no hay nada que empujar: un servicio con aliado que ya
 * aceptó no necesita alterno, y un tablero que avisa de todo no avisa de nada.
 */
export function accionSugerida(opciones: {
  tieneAceptado: boolean;
  ofertasVivas: OfertaEvaluada[];
  rechazos: number;
  hayAlternativa: boolean;
}): string | null {
  const { tieneAceptado, ofertasVivas, rechazos, hayAlternativa } = opciones;
  if (tieneAceptado) return null;

  const estancadas = ofertasVivas.filter((o) => o.estancada);

  if (ofertasVivas.length === 0) {
    if (rechazos === 0) return hayAlternativa ? 'Falta ofrecérselo a alguien.' : null;
    return hayAlternativa
      ? `${rechazos} aliado(s) dijeron que no. Hay a quién seguirle.`
      : `${rechazos} aliado(s) dijeron que no y no queda nadie más en la red para esta zona.`;
  }

  if (estancadas.length === 0) return null;

  return hayAlternativa
    ? `${estancadas.length === 1 ? 'El aliado' : `${estancadas.length} aliados`} no contesta${estancadas.length === 1 ? '' : 'n'}. Conviene ofrecérselo a otro.`
    : 'Sin respuesta, y no queda nadie más en la red para esta zona.';
}
