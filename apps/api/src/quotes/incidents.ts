/**
 * INCIDENCIAS DE CAMPO (documento institucional, sección 30).
 *
 * "Incidencias de campo: registro, evidencias, responsables, escalamiento y
 * cierre." El documento las lista entre los RIESGOS y sus controles, no entre
 * las funciones deseables: lo que no se registra no se puede corregir, y lo que
 * no se puede corregir se repite.
 *
 * TRES DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. El responsable puede ser NADIE, y ese es el valor por defecto. Muchas
 *    incidencias no son culpa de alguien —una obra inundada, un acceso cerrado
 *    por la constructora, un tráiler volcado en la carretera—. Obligar a
 *    señalar culpable convertiría el registro en un expediente de castigos que
 *    nadie querría llenar, y entonces no habría registro.
 *
 * 2. Sólo cuenta contra el aliado lo que ES del aliado. En su historial de
 *    cumplimiento entran las incidencias donde se le marcó responsable; las
 *    demás quedan en el expediente del servicio. Un aliado que aguantó una obra
 *    caótica no debe salir peor puntuado por haber estado ahí.
 *
 * 3. La puntualidad se mide contra lo COMPROMETIDO, no contra lo deseado. La
 *    solicitud trae una fecha que el cliente quiere; el compromiso lo da el
 *    aliado al aceptar. Medir contra el deseo culparía al aliado de no cumplir
 *    algo que nunca prometió.
 */

export const TIPOS = ['retraso', 'falla', 'acceso', 'seguridad', 'faltante', 'dano', 'otro'] as const;
export type TipoIncidencia = (typeof TIPOS)[number];

export const SEVERIDADES = ['baja', 'media', 'alta'] as const;
export type Severidad = (typeof SEVERIDADES)[number];

export const RESPONSABLES = ['cliente', 'aliado', 'plataforma', 'nadie'] as const;
export type Responsable = (typeof RESPONSABLES)[number];

export interface DescripcionTipo {
  clave: TipoIncidencia;
  label: string;
  /** Qué cae aquí, para que dos personas clasifiquen igual. */
  ejemplo: string;
}

export const CATALOGO: Record<TipoIncidencia, DescripcionTipo> = {
  retraso: { clave: 'retraso', label: 'Llegó tarde', ejemplo: 'La unidad llegó después de la hora comprometida.' },
  falla: { clave: 'falla', label: 'Falla del equipo', ejemplo: 'Se descompuso en obra o no rindió lo esperado.' },
  acceso: { clave: 'acceso', label: 'No lo dejaron entrar', ejemplo: 'Faltó inducción, documentación o el acceso estaba cerrado.' },
  seguridad: { clave: 'seguridad', label: 'Seguridad', ejemplo: 'Incidente, casi-accidente o condición insegura en sitio.' },
  faltante: { clave: 'faltante', label: 'Faltó material o viajes', ejemplo: 'Se entregó menos de lo acordado.' },
  dano: { clave: 'dano', label: 'Daño', ejemplo: 'A la unidad, a la obra o a un tercero.' },
  otro: { clave: 'otro', label: 'Otra cosa', ejemplo: 'Lo que no cabe arriba. Descríbelo con detalle.' },
};

/** Minutos de tolerancia antes de considerar que una llegada fue tarde. */
export const TOLERANCIA_MIN = 30;

export interface Puntualidad {
  /** Minutos de diferencia. Negativo = llegó antes. */
  desfase: number;
  aTiempo: boolean;
  texto: string;
}

/**
 * Cómo se cumplió el compromiso de llegada.
 *
 * La tolerancia no es laxitud: en obra, media hora es el margen normal entre
 * cargar el lowboy y el tráfico. Sin ella, todo servicio sería un retraso y el
 * indicador dejaría de distinguir lo que importa.
 */
export function puntualidad(comprometido: Date, llegada: Date): Puntualidad {
  const desfase = Math.round((llegada.getTime() - comprometido.getTime()) / 60000);
  const aTiempo = desfase <= TOLERANCIA_MIN;

  const legible = (m: number) => {
    const a = Math.abs(m);
    if (a < 60) return `${a} min`;
    const h = Math.floor(a / 60);
    const r = a % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
  };

  const texto =
    desfase <= -15
      ? `Llegó ${legible(desfase)} antes`
      : aTiempo
        ? 'Llegó a tiempo'
        : `Llegó ${legible(desfase)} tarde`;

  return { desfase, aTiempo, texto };
}

export interface AsignacionConLlegada {
  committed_at: Date | null;
  arrived_at: Date | null;
}

export interface ResumenPuntualidad {
  /** Cuántas asignaciones tienen compromiso Y llegada: es la muestra real. */
  medibles: number;
  aTiempo: number;
  /** 0 a 100, o null sin muestra suficiente. */
  tasa: number | null;
  /** Minutos medianos de desfase. Positivo = suele llegar tarde. */
  desfaseMediano: number | null;
}

/** Debajo de esto no se da porcentaje. Misma regla que en todo lo demás. */
const MINIMO = 5;

export function resumenPuntualidad(asignaciones: AsignacionConLlegada[]): ResumenPuntualidad {
  const medibles = asignaciones.filter(
    (a): a is { committed_at: Date; arrived_at: Date } =>
      a.committed_at !== null && a.arrived_at !== null,
  );
  if (medibles.length === 0) {
    return { medibles: 0, aTiempo: 0, tasa: null, desfaseMediano: null };
  }

  const puntos = medibles.map((a) => puntualidad(a.committed_at, a.arrived_at));
  const aTiempo = puntos.filter((p) => p.aTiempo).length;

  const desfases = puntos.map((p) => p.desfase).sort((x, y) => x - y);
  const m = Math.floor(desfases.length / 2);
  const mediano =
    desfases.length % 2 === 0
      ? Math.round((desfases[m - 1] + desfases[m]) / 2)
      : desfases[m];

  return {
    medibles: medibles.length,
    aTiempo,
    tasa: medibles.length >= MINIMO ? Math.round((aTiempo / medibles.length) * 100) : null,
    desfaseMediano: mediano,
  };
}

/** Cómo se lee la puntualidad de un aliado, en una línea. */
export function textoPuntualidad(r: ResumenPuntualidad): string {
  if (r.medibles === 0) {
    return 'Todavía no hay servicios con hora comprometida y llegada registrada.';
  }
  if (r.tasa === null) {
    return `${r.aTiempo} de ${r.medibles} llegada${r.medibles === 1 ? '' : 's'} a tiempo. Muy pocas para sacar un porcentaje.`;
  }
  const cola =
    r.desfaseMediano !== null && r.desfaseMediano > TOLERANCIA_MIN
      ? ` Suele llegar ${r.desfaseMediano} min tarde.`
      : '';
  return `Llega a tiempo el ${r.tasa}% de las veces.${cola}`;
}

export function esTipo(v: string): v is TipoIncidencia {
  return (TIPOS as readonly string[]).includes(v);
}
