/**
 * HASTA DÓNDE LLEGA UN ALIADO, CALCULADO (decisión del cliente, 2026-10-09).
 *
 * "Que ponga la dirección exacta, municipio y municipios que cubre; en
 * automático se calculan los kilómetros que cubre."
 *
 * Antes se capturaba dos veces lo mismo: la lista de municipios en el alta y,
 * en el expediente, un radio en km escrito a mano que nadie sabía de dónde
 * sacar. Ahora el radio SALE de la lista: la distancia por carretera de su base
 * al municipio más lejano que declaró, más un margen porque un municipio no es
 * un punto. Lo usan la API (al guardar) y el panel (para enseñarlo mientras se
 * escribe), así que los dos dan siempre la misma cifra.
 *
 * La lista sigue mandando por su cuenta: una obra en un municipio que el aliado
 * escribió cuenta como cubierta aunque quede fuera del círculo (ver
 * `coberturaDe` en la API). El radio sirve para lo que la lista no alcanza a
 * decir: el municipio vecino que no se le ocurrió escribir.
 */

/** Línea recta → carretera. El mismo factor que usa el emparejamiento. */
export const FACTOR_CARRETERA = 1.32;
/** Lo que se extiende un municipio más allá de su cabecera. */
export const MARGEN_MUNICIPIO_KM = 10;
/** Nadie cubre menos que su propio municipio. */
export const RADIO_MINIMO_KM = 15;

export interface Punto {
  lat: number;
  lng: number;
}

/**
 * Punto de referencia de cada municipio: su cabecera (o el centro del
 * municipio, donde OpenStreetMap no distingue). Sacados de Nominatim el
 * 2026-10-09 y revisados contra el recuadro de su estado. Una tabla fija y no
 * una consulta en vivo: Nominatim pide máximo una consulta por segundo, falla
 * solo de vez en cuando, y su caché se pierde en cada reinicio del servidor.
 *
 * Los 51 de Nuevo León y los de Coahuila y Chihuahua de `MUNICIPIOS_NORTE`.
 */
const CENTROS: ReadonlyArray<readonly [estado: string, nombre: string, lat: number, lng: number]> = [
  // Nuevo León (51)
  ["Nuevo León", "Abasolo", 25.9395, -100.4111],
  ["Nuevo León", "Agualeguas", 26.2953, -99.7013],
  ["Nuevo León", "Los Aldamas", 26.0962, -99.2763],
  ["Nuevo León", "Allende", 25.2988, -100.0452],
  ["Nuevo León", "Anáhuac", 27.3228, -100.0663],
  ["Nuevo León", "Apodaca", 25.7871, -100.1851],
  ["Nuevo León", "Aramberri", 24.2217, -99.9241],
  ["Nuevo León", "Bustamante", 26.5713, -100.5701],
  ["Nuevo León", "Cadereyta Jiménez", 25.5877, -100.0012],
  ["Nuevo León", "El Carmen", 25.9161, -100.3584],
  ["Nuevo León", "Cerralvo", 26.0605, -99.7572],
  ["Nuevo León", "Ciénega de Flores", 25.9533, -100.1874],
  ["Nuevo León", "China", 25.4916, -98.9811],
  ["Nuevo León", "Doctor Arroyo", 23.8042, -100.2257],
  ["Nuevo León", "Doctor Coss", 25.9712, -99.042],
  ["Nuevo León", "Doctor González", 25.8448, -99.8188],
  ["Nuevo León", "Galeana", 24.7583, -100.3814],
  ["Nuevo León", "García", 25.8055, -100.6396],
  ["Nuevo León", "San Pedro Garza García", 25.6524, -100.3726],
  ["Nuevo León", "General Bravo", 25.8244, -98.8835],
  ["Nuevo León", "General Escobedo", 25.8085, -100.3224],
  ["Nuevo León", "General Terán", 25.2707, -99.409],
  ["Nuevo León", "General Treviño", 26.214, -99.4723],
  ["Nuevo León", "General Zaragoza", 23.8803, -99.7403],
  ["Nuevo León", "General Zuazua", 25.8954, -100.1078],
  ["Nuevo León", "Guadalupe", 25.6751, -100.2152],
  ["Nuevo León", "Los Herreras", 25.9409, -99.4339],
  ["Nuevo León", "Higueras", 26.0355, -100.0074],
  ["Nuevo León", "Hualahuises", 24.8816, -99.6794],
  ["Nuevo León", "Iturbide", 24.6417, -99.848],
  ["Nuevo León", "Juárez", 25.6076, -100.1568],
  ["Nuevo León", "Lampazos de Naranjo", 27.0124, -100.3159],
  ["Nuevo León", "Linares", 24.853, -99.4103],
  ["Nuevo León", "Marín", 25.8861, -100.0233],
  ["Nuevo León", "Melchor Ocampo", 26.0444, -99.4938],
  ["Nuevo León", "Mier y Noriega", 23.4022, -100.1389],
  ["Nuevo León", "Mina", 26.2994, -100.8025],
  ["Nuevo León", "Montemorelos", 25.1887, -99.8294],
  ["Nuevo León", "Monterrey", 25.6802, -100.3153],
  ["Nuevo León", "Parás", 26.6253, -99.5866],
  ["Nuevo León", "Pesquería", 25.7469, -100.0045],
  ["Nuevo León", "Los Ramones", 25.6544, -99.5974],
  ["Nuevo León", "Rayones", 25.0752, -100.144],
  ["Nuevo León", "Sabinas Hidalgo", 26.5749, -100.155],
  ["Nuevo León", "Salinas Victoria", 26.1217, -100.3271],
  ["Nuevo León", "San Nicolás de los Garza", 25.7558, -100.2896],
  ["Nuevo León", "Hidalgo", 26.0045, -100.4267],
  ["Nuevo León", "Santa Catarina", 25.6745, -100.4616],
  ["Nuevo León", "Santiago", 25.3744, -100.2609],
  ["Nuevo León", "Vallecillo", 26.6408, -99.9078],
  ["Nuevo León", "Villaldama", 26.4707, -100.3707],
  // Coahuila (22)
  ["Coahuila", "Saltillo", 25.423, -100.9928],
  ["Coahuila", "Ramos Arizpe", 25.9235, -101.3129],
  ["Coahuila", "Arteaga", 25.3454, -100.6832],
  ["Coahuila", "General Cepeda", 25.5439, -101.5243],
  ["Coahuila", "Parras", 25.5919, -102.384],
  ["Coahuila", "Torreón", 25.5427, -103.4105],
  ["Coahuila", "Matamoros", 25.5732, -103.1949],
  ["Coahuila", "Francisco I. Madero", 26.2376, -103.0997],
  ["Coahuila", "San Pedro", 26.1249, -102.7746],
  ["Coahuila", "Viesca", 25.19, -102.8609],
  ["Coahuila", "Monclova", 26.8792, -101.1992],
  ["Coahuila", "Frontera", 26.9542, -101.5537],
  ["Coahuila", "Castaños", 26.5419, -101.3046],
  ["Coahuila", "San Buenaventura", 27.8415, -101.9366],
  ["Coahuila", "Sabinas", 27.9425, -101.0728],
  ["Coahuila", "Múzquiz", 28.3493, -101.6741],
  ["Coahuila", "Nava", 28.4931, -100.6429],
  ["Coahuila", "Piedras Negras", 28.6913, -100.5403],
  ["Coahuila", "Acuña", 29.3214, -100.9595],
  ["Coahuila", "Allende", 28.2857, -100.9322],
  ["Coahuila", "Zaragoza", 28.8695, -101.5245],
  ["Coahuila", "Cuatro Ciénegas", 26.6665, -102.3792],
  // Chihuahua (15)
  ["Chihuahua", "Chihuahua", 28.6369, -106.0767],
  ["Chihuahua", "Juárez", 31.739, -106.4832],
  ["Chihuahua", "Cuauhtémoc", 28.401, -106.8665],
  ["Chihuahua", "Delicias", 28.1227, -105.4685],
  ["Chihuahua", "Hidalgo del Parral", 27.1154, -105.7643],
  ["Chihuahua", "Nuevo Casas Grandes", 30.5063, -107.6654],
  ["Chihuahua", "Camargo", 28.0582, -104.3801],
  ["Chihuahua", "Jiménez", 26.9657, -104.3673],
  ["Chihuahua", "Meoqui", 28.3584, -105.5215],
  ["Chihuahua", "Aldama", 29.1141, -105.6501],
  ["Chihuahua", "Ojinaga", 29.5456, -104.5871],
  ["Chihuahua", "Saucillo", 28.0116, -105.2919],
  ["Chihuahua", "Guachochi", 27.1447, -107.2053],
  ["Chihuahua", "Madera", 29.3467, -108.2944],
  ["Chihuahua", "Ascensión", 31.2674, -107.5701],
];

/** Compara nombres sin acentos, mayúsculas ni signos: "Gral. Escobedo" ≈ "general escobedo". */
export function normalizarNombre(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bgral\b\.?/g, 'general')
    .replace(/\bcd\b\.?/g, 'ciudad')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Lo que suele venir después de la coma: "Saltillo, Coah." / "Juárez, N.L.". */
const SUFIJOS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^(n l|nl|nuevo leon)$/, 'Nuevo León'],
  [/^(coah|coahuila)$/, 'Coahuila'],
  [/^(chih|chihuahua)$/, 'Chihuahua'],
];

function separarEstado(texto: string): { nombre: string; estado: string | null } {
  const i = texto.lastIndexOf(',');
  if (i < 0) return { nombre: texto, estado: null };
  const cola = normalizarNombre(texto.slice(i + 1));
  const hit = SUFIJOS.find(([re]) => re.test(cola));
  return hit ? { nombre: texto.slice(0, i), estado: hit[1] } : { nombre: texto, estado: null };
}

const contiene = (a: string, b: string) => ` ${a} `.includes(` ${b} `);

/**
 * El punto de un municipio escrito a mano. Primero en su estado (el que trae
 * después de la coma, o el del aliado), con nombre exacto y luego por palabras
 * completas ("Escobedo" → General Escobedo, "Ciudad Juárez" → Juárez). Si ahí
 * no está, en los otros estados pero solo con nombre exacto: "Saltillo" sin
 * más es el de Coahuila; "San Pedro" sin más no se adivina fuera de su estado.
 */
export function centroDeMunicipio(texto: string, estadoDelAliado?: string | null): (Punto & { nombre: string; estado: string }) | null {
  const { nombre, estado } = separarEstado(texto);
  const q = normalizarNombre(nombre);
  if (q.length < 3) return null;
  const propio = estado ?? estadoDelAliado ?? 'Nuevo León';
  const enEstado = CENTROS.filter((c) => c[0] === propio);
  const hit =
    enEstado.find((c) => normalizarNombre(c[1]) === q) ??
    enEstado.find((c) => contiene(normalizarNombre(c[1]), q) || contiene(q, normalizarNombre(c[1]))) ??
    (estado ? undefined : CENTROS.find((c) => c[0] !== propio && normalizarNombre(c[1]) === q));
  return hit ? { estado: hit[0], nombre: hit[1], lat: hit[2], lng: hit[3] } : null;
}

/** Km por carretera entre dos puntos (línea recta × factor), con un decimal. */
export function kmCarretera(a: Punto, b: Punto): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  const recta = 2 * 6371 * Math.asin(Math.sqrt(h));
  return Math.round(recta * FACTOR_CARRETERA * 10) / 10;
}

export interface RadioCalculado {
  /** Null si ningún municipio de la lista se pudo ubicar. */
  km: number | null;
  /** El que marcó el radio. */
  masLejano: string | null;
  /** Los que no están en la tabla: la API intenta ubicarlos por su cuenta. */
  sinUbicar: string[];
}

/**
 * Radio de cobertura = km por carretera de la base al municipio más lejano
 * de la lista + el margen del municipio, nunca menos del mínimo.
 * `extra` son municipios que la API ya ubicó fuera de la tabla.
 */
export function radioDeCobertura(
  base: Punto,
  municipios: readonly string[],
  estadoDelAliado?: string | null,
  extra: ReadonlyArray<Punto & { nombre: string }> = [],
): RadioCalculado {
  const puntos: Array<Punto & { nombre: string }> = [...extra];
  const sinUbicar: string[] = [];
  for (const m of municipios) {
    const limpio = m.trim();
    if (!limpio) continue;
    const c = centroDeMunicipio(limpio, estadoDelAliado);
    if (c) puntos.push(c);
    else sinUbicar.push(limpio);
  }
  let lejos: { km: number; nombre: string } | null = null;
  for (const p of puntos) {
    const d = kmCarretera(base, p);
    if (!lejos || d > lejos.km) lejos = { km: d, nombre: p.nombre };
  }
  if (!lejos) return { km: null, masLejano: null, sinUbicar };
  return { km: Math.max(RADIO_MINIMO_KM, Math.ceil(lejos.km + MARGEN_MUNICIPIO_KM)), masLejano: lejos.nombre, sinUbicar };
}
