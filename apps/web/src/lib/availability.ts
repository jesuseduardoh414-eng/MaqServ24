/**
 * Los cuatro estados de disponibilidad del manual (21 / ESTADOS DE
 * DISPONIBILIDAD) y su traducción desde los datos que hoy existen.
 *
 * ESTE ARCHIVO ES EL ÚNICO SITIO donde se decide en qué estado está algo. La
 * plataforma todavía guarda la disponibilidad como un entero de existencias,
 * pero el documento institucional (21 · Disponibilidad, geolocalización y
 * capacidad real) la describe como un ESTADO con fecha, ubicación y
 * confiabilidad, alimentado por la confirmación del proveedor.
 *
 * Cuando ese modelo exista, se cambia `estadoDeProducto` y nada más: las
 * tarjetas, la ficha y los filtros ya consumen el resultado, no el stock.
 *
 * Regla del manual que no se puede romper: **el color acompaña al texto, nunca
 * lo sustituye**. Por eso cada estado lleva su etiqueta y su nota; el color es
 * un refuerzo.
 */

export type EstadoDisponibilidad = 'disponible' | 'limitada' | 'por-confirmar' | 'no-disponible';

export interface Disponibilidad {
  estado: EstadoDisponibilidad;
  /** Etiqueta corta, en mayúsculas, como la usa el manual. */
  etiqueta: string;
  /** Segunda línea: qué significa para quien lo lee. */
  nota: string;
  /** Token de color. Nunca va solo: siempre acompañado de `etiqueta`. */
  color: string;
}

/**
 * A partir de cuántas piezas se considera holgada la disponibilidad.
 * Por debajo, el manual pide avisar de la ventana reducida en vez de prometer.
 */
const UMBRAL_LIMITADA = 3;

const ESTADOS: Record<EstadoDisponibilidad, Omit<Disponibilidad, 'estado'>> = {
  disponible: {
    etiqueta: 'DISPONIBLE',
    nota: 'Lista para cotizar',
    color: 'var(--color-success)',
  },
  limitada: {
    etiqueta: 'LIMITADA',
    nota: 'Ventana reducida',
    color: 'var(--color-warning)',
  },
  'por-confirmar': {
    etiqueta: 'POR CONFIRMAR',
    nota: 'Validando proveedor',
    color: 'var(--color-warning)',
  },
  'no-disponible': {
    etiqueta: 'NO DISPONIBLE',
    nota: 'Buscar alternativa',
    color: 'var(--color-error)',
  },
};

export function disponibilidad(estado: EstadoDisponibilidad): Disponibilidad {
  return { estado, ...ESTADOS[estado] };
}

/**
 * Traduce lo que hoy sabemos de un producto a uno de los cuatro estados.
 *
 *   stock null  -> POR CONFIRMAR  (no lleva control: hay que preguntarle al proveedor)
 *   stock 0     -> NO DISPONIBLE
 *   1..3        -> LIMITADA
 *   más de 3    -> DISPONIBLE
 *
 * El caso `null` es el que más se acerca a lo que el manual llama "el sistema
 * conoce el activo, pero requiere validación del proveedor". No se pinta como
 * disponible a secas justamente por eso: el manual prohíbe prometer
 * disponibilidad que la red todavía no puede garantizar.
 */
export function estadoDeProducto(p: {
  // `undefined` a propósito: la web y la API se despliegan por separado, así que
  // hay una ventana en la que la web nueva habla con una API que todavía no
  // manda `stock`. Ante la duda se dice POR CONFIRMAR y no DISPONIBLE — el
  // manual prohíbe prometer disponibilidad que no se puede garantizar.
  stock?: number | null;
  inStock: boolean;
}): Disponibilidad {
  if (p.stock === null || p.stock === undefined) {
    return disponibilidad(p.inStock ? 'por-confirmar' : 'no-disponible');
  }
  if (p.stock <= 0) return disponibilidad('no-disponible');
  if (p.stock <= UMBRAL_LIMITADA) return disponibilidad('limitada');
  return disponibilidad('disponible');
}
