/**
 * CÓMO SE MIDE CADA SERVICIO (documento institucional, sección 16).
 *
 * "La clave no es obligar a todas las categorías a comportarse igual. Una
 * excavadora se renta por hora, día o periodo; un volteo puede medirse por
 * viaje; una pipa por viaje o jornada; un triturado por tonelada o metro
 * cúbico; una plataforma por día, semana o mes. MAQSER24 necesita un núcleo
 * común de solicitud–cotización–asignación–ejecución–cierre, con reglas
 * particulares por categoría."
 *
 * Esto es esa regla particular. El flujo del servicio es el mismo para todos;
 * lo único que cambia es en qué unidad se cierra. Cerrar una pipa "en días" o
 * un triturado "en horas" no es un detalle de forma: es lo que hace que el
 * historial no sirva para comparar ni para facturar.
 */

export interface UnidadServicio {
  clave: string;
  /** Singular, como se escribe en una línea de cotización. */
  singular: string;
  plural: string;
  /** Cuántos decimales tiene sentido capturar. Los viajes no son fraccionarios. */
  decimales: number;
}

export const UNIDADES: Record<string, UnidadServicio> = {
  hora: { clave: 'hora', singular: 'hora', plural: 'horas', decimales: 1 },
  jornada: { clave: 'jornada', singular: 'jornada', plural: 'jornadas', decimales: 1 },
  dia: { clave: 'dia', singular: 'día', plural: 'días', decimales: 0 },
  semana: { clave: 'semana', singular: 'semana', plural: 'semanas', decimales: 0 },
  mes: { clave: 'mes', singular: 'mes', plural: 'meses', decimales: 0 },
  viaje: { clave: 'viaje', singular: 'viaje', plural: 'viajes', decimales: 0 },
  tonelada: { clave: 'tonelada', singular: 'tonelada', plural: 'toneladas', decimales: 2 },
  m3: { clave: 'm3', singular: 'metro cúbico', plural: 'metros cúbicos', decimales: 2 },
  litro: { clave: 'litro', singular: 'litro', plural: 'litros', decimales: 0 },
};

/**
 * Unidades de cada línea, en orden. La PRIMERA es la que se propone al cerrar,
 * porque es la que se usa la mayor parte de las veces en ese giro.
 */
export const UNIDADES_POR_CATEGORIA: Record<string, string[]> = {
  'maquinaria-pesada': ['dia', 'hora', 'semana', 'mes'],
  'equipo-menor': ['dia', 'semana', 'mes', 'hora'],
  'plataformas-de-elevacion': ['dia', 'semana', 'mes'],
  // Una pipa se cobra por viaje casi siempre; la jornada es para obra grande
  // donde la unidad se queda parada todo el día surtiendo.
  'agua-en-pipas': ['viaje', 'jornada', 'litro'],
  'volteos': ['viaje', 'jornada', 'm3'],
  // El triturado se vende por peso; el metro cúbico se usa cuando el material
  // se mide en la caja del camión y no en báscula.
  'triturados': ['tonelada', 'm3', 'viaje'],
};

/** Si la categoría no está mapeada, el día es la unidad menos equivocada. */
const POR_DEFECTO = ['dia', 'hora', 'semana', 'mes', 'viaje'];

export function unidadesDe(categoria: string | null | undefined): UnidadServicio[] {
  const claves = (categoria && UNIDADES_POR_CATEGORIA[categoria]) || POR_DEFECTO;
  return claves.map((k) => UNIDADES[k]).filter(Boolean);
}

export function unidadPorDefectoDe(categoria: string | null | undefined): string {
  return unidadesDe(categoria)[0]?.clave ?? 'dia';
}

/** "3 viajes", "1 día", "12.5 toneladas". */
export function formatearCantidad(cantidad: number, unidadClave: string | null | undefined): string {
  const u = unidadClave ? UNIDADES[unidadClave] : undefined;
  if (!u) return String(cantidad);
  const n = cantidad.toLocaleString('es-MX', {
    minimumFractionDigits: 0,
    maximumFractionDigits: u.decimales,
  });
  return `${n} ${cantidad === 1 ? u.singular : u.plural}`;
}

/**
 * CONVERSIÓN ENTRE UNIDADES.
 *
 * El detalle de producto ofrece día / semana / mes y saca los dos primeros
 * dividiendo el mensual (mes/4 y mes/20). Es una regla real del ramo y se
 * conserva. Pero SOLO aplica entre unidades de tiempo: un viaje de pipa no es
 * una fracción de un mes y una tonelada de triturado tampoco. Convertir ahí
 * daría un número con pinta de precio que no corresponde a nada.
 *
 * Los factores son en días de renta, no de calendario: el mes comercial son 20
 * días hábiles y la semana 5. Es como se cotiza en el ramo, y cambiarlo a 30 y
 * 7 abarataría el día un 33%.
 */
const DIAS: Record<string, number> = {
  hora: 1 / 8, // una jornada de ocho horas
  jornada: 1,
  dia: 1,
  semana: 5,
  mes: 20,
};

export function esUnidadDeTiempo(clave: string | null | undefined): boolean {
  return !!clave && clave in DIAS;
}

/**
 * Precio equivalente en otra unidad, o `null` si no se puede convertir.
 *
 * Devolver null en vez de un número aproximado es deliberado: quien llama tiene
 * que decidir qué enseñar, y "no aplica" es una respuesta honesta que un número
 * inventado no da.
 */
export function precioEnUnidad(
  precio: number,
  unidadOrigen: string | null | undefined,
  unidadDestino: string,
): number | null {
  if (!esUnidadDeTiempo(unidadOrigen) || !esUnidadDeTiempo(unidadDestino)) return null;
  const factor = DIAS[unidadDestino] / DIAS[unidadOrigen!];
  return Math.round(precio * factor * 100) / 100;
}

/** Unidades a las que SÍ se puede pasar desde esta. Vacío = solo la suya. */
export function unidadesEquivalentes(unidad: string | null | undefined): UnidadServicio[] {
  if (!esUnidadDeTiempo(unidad)) return [];
  // La hora se ofrece solo si el precio ya está por hora: proponer "por hora"
  // en un equipo cotizado por mes invita a rentar dos horas de una excavadora.
  return ['dia', 'semana', 'mes']
    .map((k) => UNIDADES[k])
    .filter(Boolean);
}

/** "$4,500 / mes", "$2,500 / viaje". */
export function etiquetaPrecio(precio: number, unidad: string | null | undefined): string {
  const p = `$${precio.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;
  const u = unidad ? UNIDADES[unidad] : undefined;
  return u ? `${p} / ${u.singular}` : p;
}
