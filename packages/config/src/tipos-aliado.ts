/**
 * LOS TRES TIPOS DE PROVEEDOR (documento institucional, sección 14;
 * decisión del cliente, 2026-10-08).
 *
 * El documento distingue tres participantes del lado de la oferta, cada uno
 * con una necesidad distinta. En el sistema son el mismo "aliado" con el mismo
 * portal; lo que cambia es QUÉ OFRECE, y eso ya lo dicen sus líneas. Así el
 * tipo no se captura (no puede desfasarse de lo que de verdad ofrece) y un
 * aliado puede ser de varios tipos a la vez: una rentadora que también surte
 * material de banco es rentadora y proveedor de materiales.
 */

export type TipoAliado = 'rentadora' | 'servicios' | 'materiales';

export interface DefinicionTipoAliado {
  clave: TipoAliado;
  nombre: string;
  /** Su necesidad principal, en las palabras del documento. */
  necesidad: string;
  /** Lo que MAQSER24 le debe ofrecer, en las palabras del documento. */
  ofrece: string;
  /** Cómo se le llama a lo que ofrece: "tus equipos", "tus unidades"… */
  oferta: string;
}

export const TIPOS_ALIADO: Record<TipoAliado, DefinicionTipoAliado> = {
  rentadora: {
    clave: 'rentadora',
    nombre: 'Rentadora / propietario',
    necesidad: 'Colocar capacidad disponible y aumentar utilización.',
    ofrece: 'Acceso a demanda, control de inventario, oportunidades y trazabilidad.',
    oferta: 'equipos',
  },
  servicios: {
    clave: 'servicios',
    nombre: 'Proveedor de servicios',
    necesidad: 'Recibir solicitudes compatibles con su capacidad.',
    ofrece: 'Programación, datos completos, geolocalización y condiciones claras.',
    oferta: 'unidades',
  },
  materiales: {
    clave: 'materiales',
    nombre: 'Proveedor de materiales',
    necesidad: 'Vender y entregar con información suficiente.',
    ofrece: 'Especificación, tonelaje o volumen, destino, ventana de entrega y logística.',
    oferta: 'materiales',
  },
};

/**
 * Qué tipo de proveedor atiende cada línea. Asfalto es servicio (suministro y
 * APLICACIÓN); triturados y materiales se venden y se entregan.
 */
export const TIPO_POR_LINEA: Record<string, TipoAliado> = {
  'maquinaria-pesada': 'rentadora',
  'transporte-y-servicios-de-obra': 'servicios',
  'soluciones-asfalticas': 'servicios',
  triturados: 'materiales',
  'materiales-para-construccion': 'materiales',
};

const ORDEN: TipoAliado[] = ['rentadora', 'servicios', 'materiales'];

/** Los tipos de un aliado según sus líneas, sin repetir y en orden fijo. */
export function tiposDeAliado(lineas: readonly string[]): TipoAliado[] {
  const set = new Set(lineas.map((l) => TIPO_POR_LINEA[l]).filter((t): t is TipoAliado => Boolean(t)));
  return ORDEN.filter((t) => set.has(t));
}

/** "equipos", "equipos y unidades", "equipos, unidades y materiales"; sin tipo, "servicios". */
export function ofertaDe(tipos: readonly TipoAliado[]): string {
  const w = tipos.map((t) => TIPOS_ALIADO[t].oferta);
  if (w.length === 0) return 'servicios';
  if (w.length === 1) return w[0];
  return `${w.slice(0, -1).join(', ')} y ${w[w.length - 1]}`;
}
