/**
 * CADA MÁQUINA CON SU IDENTIFICACIÓN (2026-11-09).
 *
 * El equipo de un aliado es una fila por modelo con `stock` = cuántas iguales
 * tiene ("Volteo 14 m³ Kenworth", 3). Pero la obra pide las placas para dejar
 * entrar y la oficina pregunta "¿cuál va, la 12 o la 14?": cada unidad lleva
 * su número económico, sus placas, su serie y su año. Todo opcional: con uno
 * basta para reconocerla.
 *
 * Sin columnas nuevas (en producción el SQL se corre a mano): la lista vive en
 * `products.attributes.unidades`, junto a la ficha técnica (capacidad,
 * potencia…), que son claves sueltas con texto y no se tocan.
 *
 * LA REGLA DEL CONTEO: al capturar la lista, su largo ES el número de unidades
 * (`stock`). Lo de antes, sin lista, sigue igual: `stock` unidades sin
 * identificar. Si alguna vez `stock` queda mayor que la lista, las que sobran
 * son unidades sin identificar.
 *
 * Lo usan el API (guardar, leer, apartar la que eligió el aliado), el portal
 * del aliado y el panel; por eso vive aquí.
 */

export interface UnidadEquipo {
  /** Número económico: el que el aliado le pinta a su máquina ("12", "V-07"). */
  eco?: string;
  placas?: string;
  /** Número de serie (o VIN). */
  serie?: string;
  /** Año del modelo ("2019"). */
  anio?: string;
}

/** La clave dentro de `products.attributes`. */
export const CLAVE_UNIDADES = 'unidades';

/**
 * Tope de unidades con identificación por fila. Una rentadora con más de cien
 * máquinas iguales del mismo modelo no existe; un error de captura sí.
 */
export const MAX_UNIDADES_IDENTIFICADAS = 100;

/** Los datos de cada unidad, en el orden en que se piden. */
export const CAMPOS_UNIDAD: ReadonlyArray<{ clave: keyof UnidadEquipo; label: string; ejemplo: string; largo: number }> = [
  { clave: 'eco', label: 'Núm. económico', ejemplo: '12', largo: 20 },
  { clave: 'placas', label: 'Placas', ejemplo: 'RX-12-345', largo: 15 },
  { clave: 'serie', label: 'Serie', ejemplo: 'CAT0416F…', largo: 40 },
  { clave: 'anio', label: 'Año', ejemplo: '2019', largo: 4 },
];

/**
 * Las líneas cuyo equipo son máquinas o vehículos que se identifican uno por
 * uno. Triturados, materiales y asfalto se miden en toneladas o piezas: ahí
 * no hay placas que pedir.
 */
export const LINEAS_CON_UNIDADES = ['maquinaria-pesada', 'transporte-y-servicios-de-obra'] as const;

export function llevaIdentificacion(slug: string | null | undefined): boolean {
  return !!slug && (LINEAS_CON_UNIDADES as readonly string[]).includes(slug);
}

const texto = (v: unknown, largo: number): string =>
  typeof v === 'string' || typeof v === 'number' ? String(v).replace(/\s+/g, ' ').trim().slice(0, largo) : '';

/**
 * Una unidad limpia: sin espacios de más, placas y serie en mayúsculas (así
 * las escribe la tarjeta de circulación) y el año solo con sus cuatro cifras.
 * Lo vacío no se guarda.
 */
export function limpiarUnidad(u: unknown): UnidadEquipo {
  const o = (u && typeof u === 'object' ? u : {}) as Record<string, unknown>;
  const eco = texto(o.eco, 20);
  const placas = texto(o.placas, 15).toUpperCase();
  const serie = texto(o.serie, 40).toUpperCase();
  const anio = texto(o.anio, 10).replace(/\D/g, '').slice(0, 4);
  return {
    ...(eco ? { eco } : {}),
    ...(placas ? { placas } : {}),
    ...(serie ? { serie } : {}),
    ...(anio.length === 4 ? { anio } : {}),
  };
}

/** Sin ningún dato: cuenta como unidad, pero sin identificación. */
export const unidadVacia = (u: UnidadEquipo): boolean => !u.eco && !u.placas && !u.serie && !u.anio;

/** Lista limpia (máximo MAX_UNIDADES_IDENTIFICADAS). Lo que no es lista, vacío. */
export function limpiarUnidades(lista: unknown): UnidadEquipo[] {
  return Array.isArray(lista) ? lista.slice(0, MAX_UNIDADES_IDENTIFICADAS).map(limpiarUnidad) : [];
}

/** La identificación guardada de un equipo (`products.attributes`). Sin lista, vacía. */
export function identificacionDe(attributes: unknown): UnidadEquipo[] {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) return [];
  return limpiarUnidades((attributes as Record<string, unknown>)[CLAVE_UNIDADES]);
}

/**
 * Cómo se lee una unidad en una línea: "Eco. 12 · placas RX-12-345 · 2019".
 * La serie va al final (es larga y casi nadie la busca de vista). Vacía, ''.
 */
export function textoUnidad(u: UnidadEquipo): string {
  return [
    u.eco ? `Eco. ${u.eco}` : null,
    u.placas ? `placas ${u.placas}` : null,
    u.anio ?? null,
    u.serie ? `serie ${u.serie}` : null,
  ].filter(Boolean).join(' · ');
}

/** Solo las unidades que traen algún dato, ya en texto ("Eco. 12 · placas…"). */
export function textosIdentificados(attributes: unknown): string[] {
  return identificacionDe(attributes).filter((u) => !unidadVacia(u)).map(textoUnidad);
}

/**
 * Lo que se busca: económico, placas y serie tal cual y sin guiones ni
 * espacios, para que "rx12345" encuentre "RX-12-345". En minúsculas.
 */
export function textoParaBuscar(lista: UnidadEquipo[]): string {
  return lista
    .flatMap((u) => [u.eco, u.placas, u.serie])
    .filter((v): v is string => Boolean(v))
    .flatMap((v) => [v.toLowerCase(), v.toLowerCase().replace(/[^a-z0-9]/g, '')])
    .join(' ');
}

/**
 * La lista con `n` unidades: si faltan, se agregan sin identificar; si sobran,
 * se quitan primero las que no tienen datos (de abajo hacia arriba) y luego las
 * últimas. Para cuando alguien cambia solo el número de unidades.
 */
export function ajustarUnidades(lista: UnidadEquipo[], n: number): UnidadEquipo[] {
  const meta = Math.max(0, Math.min(MAX_UNIDADES_IDENTIFICADAS, Math.floor(n)));
  const out = [...lista];
  while (out.length < meta) out.push({});
  for (let i = out.length - 1; i >= 0 && out.length > meta; i--) if (unidadVacia(out[i])) out.splice(i, 1);
  return out.slice(0, meta);
}

/**
 * `attributes` con la lista puesta (o quitada si nadie trae datos). Las demás
 * claves (la ficha técnica) se quedan como estaban. Null si no queda nada.
 */
export function atributosConUnidades(attributes: unknown, lista: UnidadEquipo[]): Record<string, unknown> | null {
  const base = attributes && typeof attributes === 'object' && !Array.isArray(attributes) ? { ...(attributes as Record<string, unknown>) } : {};
  delete base[CLAVE_UNIDADES];
  const limpia = limpiarUnidades(lista);
  if (limpia.some((u) => !unidadVacia(u))) base[CLAVE_UNIDADES] = limpia;
  return Object.keys(base).length ? base : null;
}
