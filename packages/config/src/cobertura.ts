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
 * La CABECERA de cada municipio: el punto del pueblo en el mapa (nodo
 * `place` de OpenStreetMap), no el área del municipio. Sacadas de Nominatim
 * el 2026-10-09 y revisadas contra el recuadro de su estado. Mina va a mano:
 * en el mapa el pueblo es un área, no un punto. Las cinco sin pueblo con ese
 * nombre van con el centro del municipio y lo dicen al lado; en Cadereyta,
 * Zuazua y Piedras Negras ese centro cae a menos de 2 km de la ciudad.
 *
 * La primera versión usaba el centro del municipio y en los grandes se iba
 * lejos: Ramos Arizpe quedaba 56 km al norte de su cabecera y un aliado de
 * Saltillo "llegaba" a 93 km en vez de 29.
 *
 * Una tabla fija y no una consulta en vivo: Nominatim pide máximo una consulta
 * por segundo, falla de vez en cuando, y su caché se pierde en cada reinicio.
 * Los 156 municipios de Nuevo León, Coahuila y Chihuahua.
 */
const CENTROS: ReadonlyArray<readonly [estado: string, nombre: string, lat: number, lng: number]> = [
  // Nuevo León (51)
  ['Nuevo León', 'Abasolo', 25.9459, -100.3955],
  ['Nuevo León', 'Agualeguas', 26.3126, -99.5375],
  ['Nuevo León', 'Los Aldamas', 26.0623, -99.1959],
  ['Nuevo León', 'Allende', 25.2803, -100.0198],
  ['Nuevo León', 'Anáhuac', 27.2411, -100.1334],
  ['Nuevo León', 'Apodaca', 25.7817, -100.1888],
  ['Nuevo León', 'Aramberri', 24.1029, -99.8179],
  ['Nuevo León', 'Bustamante', 26.533, -100.5062],
  ['Nuevo León', 'Cadereyta Jiménez', 25.5877, -100.0012], // centro del municipio
  ['Nuevo León', 'El Carmen', 25.9368, -100.3613],
  ['Nuevo León', 'Cerralvo', 26.0863, -99.6158],
  ['Nuevo León', 'Ciénega de Flores', 25.9562, -100.1662],
  ['Nuevo León', 'China', 25.7017, -99.2363],
  ['Nuevo León', 'Doctor Arroyo', 23.6729, -100.1794],
  ['Nuevo León', 'Doctor Coss', 25.9245, -99.1839],
  ['Nuevo León', 'Doctor González', 25.8592, -99.9423],
  ['Nuevo León', 'Galeana', 24.8251, -100.0768],
  ['Nuevo León', 'García', 25.8122, -100.5931],
  ['Nuevo León', 'San Pedro Garza García', 25.6652, -100.4018],
  ['Nuevo León', 'General Bravo', 25.7933, -99.1811],
  ['Nuevo León', 'General Escobedo', 25.8085, -100.3224],
  ['Nuevo León', 'General Terán', 25.2586, -99.6836],
  ['Nuevo León', 'General Treviño', 26.2227, -99.4849],
  ['Nuevo León', 'General Zaragoza', 23.9739, -99.7727],
  ['Nuevo León', 'General Zuazua', 25.8954, -100.1078], // centro del municipio
  ['Nuevo León', 'Guadalupe', 25.6751, -100.2152],
  ['Nuevo León', 'Los Herreras', 25.908, -99.4052],
  ['Nuevo León', 'Higueras', 25.9597, -100.0165],
  ['Nuevo León', 'Hualahuises', 24.8838, -99.674],
  ['Nuevo León', 'Iturbide', 24.7259, -99.9048],
  ['Nuevo León', 'Juárez', 25.6467, -100.0908],
  ['Nuevo León', 'Lampazos de Naranjo', 27.026, -100.5056],
  ['Nuevo León', 'Linares', 24.8596, -99.5683],
  ['Nuevo León', 'Marín', 25.8787, -100.0306],
  ['Nuevo León', 'Melchor Ocampo', 26.0554, -99.5429],
  ['Nuevo León', 'Mier y Noriega', 23.4233, -100.1191],
  ['Nuevo León', 'Mina', 26.0025, -100.53],
  ['Nuevo León', 'Montemorelos', 25.1887, -99.8294],
  ['Nuevo León', 'Monterrey', 25.6802, -100.3153],
  ['Nuevo León', 'Parás', 26.4994, -99.523],
  ['Nuevo León', 'Pesquería', 25.7851, -100.0521],
  ['Nuevo León', 'Los Ramones', 25.6974, -99.6251],
  ['Nuevo León', 'Rayones', 25.0182, -100.0741],
  ['Nuevo León', 'Sabinas Hidalgo', 26.5037, -100.1793],
  ['Nuevo León', 'Salinas Victoria', 25.9634, -100.2923],
  ['Nuevo León', 'San Nicolás de los Garza', 25.7558, -100.2896],
  ['Nuevo León', 'Hidalgo', 25.9743, -100.4506],
  ['Nuevo León', 'Santa Catarina', 25.6745, -100.4616],
  ['Nuevo León', 'Santiago', 25.4244, -100.1513],
  ['Nuevo León', 'Vallecillo', 26.6605, -99.9875],
  ['Nuevo León', 'Villaldama', 26.5007, -100.4265],
  // Coahuila (38)
  ['Coahuila', 'Abasolo', 27.1825, -101.4278],
  ['Coahuila', 'Acuña', 29.3214, -100.9595],
  ['Coahuila', 'Allende', 28.3421, -100.8517],
  ['Coahuila', 'Arteaga', 25.4504, -100.8524],
  ['Coahuila', 'Candela', 26.8388, -100.6645],
  ['Coahuila', 'Castaños', 26.7943, -101.4287],
  ['Coahuila', 'Cuatro Ciénegas', 26.9865, -102.0633],
  ['Coahuila', 'Escobedo', 27.234, -101.4135],
  ['Coahuila', 'Francisco I. Madero', 25.7733, -103.2714],
  ['Coahuila', 'Frontera', 26.9256, -101.4523],
  ['Coahuila', 'General Cepeda', 25.3791, -101.4761],
  ['Coahuila', 'Guerrero', 28.3093, -100.3806],
  ['Coahuila', 'Hidalgo', 27.7877, -99.8758],
  ['Coahuila', 'Jiménez', 29.0674, -100.6792],
  ['Coahuila', 'Juárez', 27.608, -100.7269],
  ['Coahuila', 'Lamadrid', 27.0513, -101.795],
  ['Coahuila', 'Matamoros', 25.5293, -103.232],
  ['Coahuila', 'Monclova', 26.9, -101.4171],
  ['Coahuila', 'Morelos', 28.4066, -100.887],
  ['Coahuila', 'Múzquiz', 27.8781, -101.5156],
  ['Coahuila', 'Nadadores', 27.027, -101.5933],
  ['Coahuila', 'Nava', 28.4217, -100.7674],
  ['Coahuila', 'Ocampo', 27.315, -102.3967],
  ['Coahuila', 'Parras', 25.4437, -102.1782],
  ['Coahuila', 'Piedras Negras', 28.6913, -100.5403], // centro del municipio
  ['Coahuila', 'Progreso', 27.4283, -100.9886],
  ['Coahuila', 'Ramos Arizpe', 25.5408, -100.9467],
  ['Coahuila', 'Sabinas', 27.8524, -101.1184],
  ['Coahuila', 'Sacramento', 27.003, -101.7242],
  ['Coahuila', 'Saltillo', 25.423, -100.9928],
  ['Coahuila', 'San Buenaventura', 27.0598, -101.5467],
  ['Coahuila', 'San Juan de Sabinas', 27.9378, -101.2187],
  ['Coahuila', 'San Pedro', 25.759, -102.9841],
  ['Coahuila', 'Sierra Mojada', 27.2889, -103.7005],
  ['Coahuila', 'Torreón', 25.5427, -103.4105],
  ['Coahuila', 'Viesca', 25.3407, -102.8046],
  ['Coahuila', 'Villa Unión', 28.2228, -100.7269],
  ['Coahuila', 'Zaragoza', 28.4929, -100.9206],
  // Chihuahua (67)
  ['Chihuahua', 'Ahumada', 29.9255, -106.4708],
  ['Chihuahua', 'Aldama', 28.8378, -105.916],
  ['Chihuahua', 'Allende', 26.9369, -105.393],
  ['Chihuahua', 'Aquiles Serdán', 28.595, -105.8868],
  ['Chihuahua', 'Ascensión', 31.091, -107.9969],
  ['Chihuahua', 'Bachíniva', 28.7737, -107.2576],
  ['Chihuahua', 'Balleza', 26.9512, -106.349],
  ['Chihuahua', 'Batopilas', 27.0271, -107.7392],
  ['Chihuahua', 'Bocoyna', 27.8148, -107.5522], // centro del municipio
  ['Chihuahua', 'Buenaventura', 29.8444, -107.4597],
  ['Chihuahua', 'Camargo', 27.6784, -105.1715],
  ['Chihuahua', 'Carichí', 27.9172, -107.0557],
  ['Chihuahua', 'Casas Grandes', 30.3774, -107.9559],
  ['Chihuahua', 'Coronado', 26.7375, -105.1586],
  ['Chihuahua', 'Coyame del Sotol', 29.4615, -105.0946],
  ['Chihuahua', 'La Cruz', 27.8673, -105.2096],
  ['Chihuahua', 'Cuauhtémoc', 28.401, -106.8665],
  ['Chihuahua', 'Cusihuiriachi', 28.2407, -106.8361],
  ['Chihuahua', 'Chihuahua', 28.6369, -106.0767],
  ['Chihuahua', 'Chínipas', 27.3945, -108.5365],
  ['Chihuahua', 'Delicias', 28.1912, -105.4696],
  ['Chihuahua', 'Doctor Belisario Domínguez', 29.8146, -107.076],
  ['Chihuahua', 'Galeana', 30.1145, -107.6147],
  ['Chihuahua', 'Santa Isabel', 28.3431, -106.3685],
  ['Chihuahua', 'Gómez Farías', 29.3608, -107.7372],
  ['Chihuahua', 'Gran Morelos', 28.2499, -106.5091],
  ['Chihuahua', 'Guachochi', 26.8193, -107.0747],
  ['Chihuahua', 'Guadalupe', 31.3887, -106.1058],
  ['Chihuahua', 'Guadalupe y Calvo', 26.0915, -106.9617],
  ['Chihuahua', 'Guazapares', 27.3719, -108.2807],
  ['Chihuahua', 'Guerrero', 28.5497, -107.4827],
  ['Chihuahua', 'Hidalgo del Parral', 26.9287, -105.6674],
  ['Chihuahua', 'Huejotitán', 27.0572, -106.1778],
  ['Chihuahua', 'Ignacio Zaragoza', 29.643, -107.7636],
  ['Chihuahua', 'Janos', 30.8893, -108.193],
  ['Chihuahua', 'Jiménez', 27.1258, -104.9118],
  ['Chihuahua', 'Juárez', 31.739, -106.4832],
  ['Chihuahua', 'Julimes', 28.4242, -105.4276],
  ['Chihuahua', 'López', 27.0031, -105.0336],
  ['Chihuahua', 'Madera', 29.1934, -108.1445],
  ['Chihuahua', 'Maguarichi', 27.8589, -107.9941],
  ['Chihuahua', 'Manuel Benavides', 29.1049, -103.9063],
  ['Chihuahua', 'Matachí', 28.8404, -107.7541],
  ['Chihuahua', 'Matamoros', 26.712, -105.5473], // centro del municipio
  ['Chihuahua', 'Meoqui', 28.2713, -105.4805],
  ['Chihuahua', 'Morelos', 26.6719, -107.6772],
  ['Chihuahua', 'Moris', 28.1538, -108.527],
  ['Chihuahua', 'Namiquipa', 29.2507, -107.4151],
  ['Chihuahua', 'Nonoava', 27.4733, -106.7365],
  ['Chihuahua', 'Nuevo Casas Grandes', 30.4155, -107.9059],
  ['Chihuahua', 'Ocampo', 28.1936, -108.3675],
  ['Chihuahua', 'Ojinaga', 29.5647, -104.416],
  ['Chihuahua', 'Práxedis G. Guerrero', 31.37, -106.0058],
  ['Chihuahua', 'Riva Palacio', 28.5462, -106.5034],
  ['Chihuahua', 'Rosales', 28.1878, -105.5561],
  ['Chihuahua', 'Rosario', 27.3192, -106.2956],
  ['Chihuahua', 'San Francisco de Borja', 27.9012, -106.684],
  ['Chihuahua', 'San Francisco de Conchos', 27.5877, -105.3339],
  ['Chihuahua', 'San Francisco del Oro', 26.8646, -105.8477],
  ['Chihuahua', 'Santa Bárbara', 26.8032, -105.8192],
  ['Chihuahua', 'Satevó', 27.9557, -106.1064],
  ['Chihuahua', 'Saucillo', 28.0292, -105.2923],
  ['Chihuahua', 'Temósachic', 28.9565, -107.8302],
  ['Chihuahua', 'El Tule', 27.0534, -106.2655],
  ['Chihuahua', 'Urique', 27.2123, -107.9147],
  ['Chihuahua', 'Uruachi', 27.8676, -108.2156],
  ['Chihuahua', 'Valle de Zaragoza', 27.4502, -105.8083],
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
