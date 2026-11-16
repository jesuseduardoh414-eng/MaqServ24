/**
 * CONTENIDO DE LA PÁGINA DE UN SECTOR (2026-11-16).
 *
 * El dueño escribe los textos de cada sector como un documento: un título, una
 * frase corta y seis apartados (Sobre este sector, Trayectoria, Esencia,
 * Servicios, Excelencia y Servicios incluidos), cada uno con su frase destacada
 * y sus párrafos; la lista de servicios con «* » y a veces por grupos. El panel
 * pedía HTML en cajas sueltas con títulos fijos, y pegar ese texto salía en un
 * solo párrafo.
 *
 * Aquí vive lo que comparten la API (al servir la página), el sitio (la vista
 * previa con lo que aún no se guarda) y el panel (acomodar un texto pegado):
 *  - el texto normal se convierte en párrafos (cada renglón, uno);
 *  - la lista se entiende con «* », grupos y notas;
 *  - un documento pegado completo se reparte en sus campos.
 */

export const BLOQUES_SECTOR = [
  { clave: 'sobre', titulo: 'Sobre este sector' },
  { clave: 'trayectoria', titulo: 'Trayectoria' },
  { clave: 'esencia', titulo: 'Esencia' },
  { clave: 'servicios', titulo: 'Servicios' },
  { clave: 'excelencia', titulo: 'Excelencia' },
  { clave: 'lista', titulo: 'Servicios incluidos' },
] as const;
export type ClaveBloqueSector = (typeof BLOQUES_SECTOR)[number]['clave'];
export const CLAVES_BLOQUE_SECTOR = BLOQUES_SECTOR.map((b) => b.clave) as ClaveBloqueSector[];
/** Los cinco apartados de texto (todos menos la lista). */
export type ClaveTextoSector = Exclude<ClaveBloqueSector, 'lista'>;

/**
 * Lo que no cabe en las columnas de `strategic_sectors`: la frase corta y el
 * título y la frase destacada de cada apartado. Se guarda en los ajustes de la
 * plataforma (clave `sectores_textos`), para no pedir SQL al subir.
 */
export interface TextosSector {
  frase: string | null;
  titulos: Partial<Record<ClaveBloqueSector, string>>;
  destacados: Partial<Record<ClaveBloqueSector, string>>;
}

export const TEXTOS_SECTOR_VACIOS: TextosSector = { frase: null, titulos: {}, destacados: {} };

/** Un renglón de «Servicios incluidos», ya entendido. */
export type ParteListaSector =
  | { tipo: 'grupo'; texto: string }
  | { tipo: 'nota'; texto: string }
  | { tipo: 'item'; nombre: string; detalle: string | null };

export interface BloqueSector {
  clave: ClaveTextoSector;
  /** null = el título de siempre (BLOQUES_SECTOR / el tema). */
  titulo: string | null;
  destacado: string | null;
  html: string | null;
}

export interface ListaSector {
  titulo: string | null;
  destacado: string | null;
  partes: ParteListaSector[];
}

/* ------------------------------------------------------------------ */

const ETIQUETAS_HTML = /<\/?(p|br|div|ul|ol|li|h[1-6]|strong|b|em|i|u|span|a|table|tr|td|blockquote)\b[^>]*>/i;
/** ¿Lo guardado es HTML (contenido de antes) o texto normal? */
export function pareceHtml(s: string | null | undefined): boolean {
  return !!s && ETIQUETAS_HTML.test(s);
}

const VIÑETA = /^(?:[*•·▪●◦‣⁃–-]|\d{1,2}[.)])\s+/;
const SEPARADOR = /^[\s⸻—–_=*·•.-]*$/;

function escapar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renglones(texto: string): string[] {
  return texto.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\s+/g, ' ').trim());
}

/**
 * Texto de un apartado → HTML. Cada renglón es un párrafo y los renglones
 * seguidos que empiezan con «* » o «- » forman una lista. Si ya es HTML (lo
 * capturado antes), se deja igual: quien lo pinta lo limpia.
 */
export function textoSectorAHtml(texto: string | null | undefined): string | null {
  if (!texto || !texto.trim()) return null;
  if (pareceHtml(texto)) return texto;
  const partes: string[] = [];
  let lista: string[] = [];
  const cerrarLista = () => {
    if (lista.length) partes.push(`<ul>${lista.map((x) => `<li>${escapar(x)}</li>`).join('')}</ul>`);
    lista = [];
  };
  for (const l of renglones(texto)) {
    if (!l || SEPARADOR.test(l)) { cerrarLista(); continue; }
    if (VIÑETA.test(l)) { lista.push(l.replace(VIÑETA, '')); continue; }
    cerrarLista();
    partes.push(`<p>${escapar(l)}</p>`);
  }
  cerrarLista();
  return partes.length ? partes.join('') : null;
}

const ENTIDADES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', Uuml: 'Ü', iexcl: '¡',
  iquest: '¿', laquo: '«', raquo: '»', ordm: 'º', ordf: 'ª', deg: '°', hellip: '…', ndash: '–', mdash: '—', ldquo: '“',
  rdquo: '”', lsquo: '‘', rsquo: '’', bull: '•', middot: '·', copy: '©', reg: '®',
};

/** HTML de antes → texto normal, para editarlo en el panel sin ver etiquetas. */
export function htmlATexto(html: string | null | undefined): string {
  if (!html) return '';
  if (!pareceHtml(html)) return html;
  const t = html
    .replace(/\r\n?/g, '\n')
    .replace(/\n/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n* ')
    .replace(/<\/li>/gi, '')
    .replace(/<\/(p|div|h[1-6]|ul|ol|tr|blockquote)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : m;
      }
      return ENTIDADES[e] ?? m;
    });
  return renglones(t).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * «Servicios incluidos» → partes. Con viñetas («* Excavadoras»): cada viñeta
 * es un servicio; un renglón corto sin viñeta justo arriba de otras viñetas es
 * el nombre de un grupo; cualquier otro renglón sin viñeta, una nota. Sin
 * ninguna viñeta (como se capturaba antes, o una lista en JSON), cada renglón
 * es un servicio. «Nombre: detalle» separa el nombre (va en negritas).
 */
export function partesListaSector(texto: string | null | undefined): ParteListaSector[] {
  if (!texto || !texto.trim()) return [];
  let crudo = texto;
  try {
    const j = JSON.parse(texto);
    if (Array.isArray(j)) crudo = j.map(String).join('\n');
  } catch { /* texto normal */ }
  if (pareceHtml(crudo)) crudo = htmlATexto(crudo);
  const ls = renglones(crudo).filter((l) => l && !SEPARADOR.test(l));
  const conVinetas = ls.some((l) => VIÑETA.test(l));
  const item = (l: string): ParteListaSector => {
    const m = /^(.{2,70}?):\s+(\S.*)$/.exec(l);
    return m ? { tipo: 'item', nombre: m[1]!.trim(), detalle: m[2]!.trim() } : { tipo: 'item', nombre: l, detalle: null };
  };
  if (!conVinetas) return ls.map(item);
  return ls.map((l, i): ParteListaSector => {
    if (VIÑETA.test(l)) return item(l.replace(VIÑETA, ''));
    const siguienteEsVineta = VIÑETA.test(ls[i + 1] ?? '');
    if (siguienteEsVineta && l.length <= 70 && !/\.$/.test(l)) return { tipo: 'grupo', texto: l.replace(/:$/, '').trim() };
    return { tipo: 'nota', texto: l };
  });
}

const limpio = (s: string | null | undefined): string | null => {
  const t = (s ?? '').trim();
  return t ? t : null;
};

/** Normaliza lo que llega del panel: sin vacíos y sin títulos iguales al de siempre. */
export function normalizarTextosSector(t: Partial<TextosSector> | null | undefined): TextosSector {
  const titulos: TextosSector['titulos'] = {};
  const destacados: TextosSector['destacados'] = {};
  for (const b of BLOQUES_SECTOR) {
    const ti = limpio(t?.titulos?.[b.clave]);
    if (ti && sinAcentos(ti) !== sinAcentos(b.titulo)) titulos[b.clave] = ti;
    const de = limpio(t?.destacados?.[b.clave]);
    if (de) destacados[b.clave] = de;
  }
  return { frase: limpio(t?.frase), titulos, destacados };
}

/** Columnas de la tabla que llevan el texto de cada apartado. */
export interface ColumnasSector {
  description: string | null;
  trayectoria: string | null;
  esencia: string | null;
  servicios: string | null;
  excelencia: string | null;
  servicios_lista: string | null;
}

const COLUMNA: Record<ClaveTextoSector, keyof ColumnasSector> = {
  sobre: 'description', trayectoria: 'trayectoria', esencia: 'esencia', servicios: 'servicios', excelencia: 'excelencia',
};

/**
 * Arma lo que pinta la página del sector. `limpiar` es el limpiador de HTML de
 * quien lo pinta (la API o la vista previa del sitio): el texto pasa por él ya
 * convertido, así que lo de antes en HTML también queda limpio.
 */
export function contenidoSector(
  c: ColumnasSector,
  textos: TextosSector | null | undefined,
  limpiar: (html: string | null) => string | null,
): { frase: string | null; bloques: BloqueSector[]; lista: ListaSector } {
  const t = normalizarTextosSector(textos);
  const bloques = BLOQUES_SECTOR.filter((b) => b.clave !== 'lista').map((b): BloqueSector => {
    const clave = b.clave as ClaveTextoSector;
    return { clave, titulo: t.titulos[clave] ?? null, destacado: t.destacados[clave] ?? null, html: limpiar(textoSectorAHtml(c[COLUMNA[clave]])) };
  });
  return {
    frase: t.frase,
    bloques,
    lista: { titulo: t.titulos.lista ?? null, destacado: t.destacados.lista ?? null, partes: partesListaSector(c.servicios_lista) },
  };
}

/** Texto plano (para la tarjeta, el encabezado y la descripción de Google). */
export function textoPlanoSector(s: string | null | undefined): string {
  if (!s) return '';
  return (pareceHtml(s) ? htmlATexto(s) : s).replace(/^\s*[*•·-]\s+/gm, '').replace(/\s+/g, ' ').trim();
}

/** Recorta sin partir palabras. */
export function recortarSector(s: string, max: number): string {
  if (s.length <= max) return s;
  const corte = s.slice(0, max + 1).replace(/\s+\S*$/, '');
  return `${(corte || s.slice(0, max)).replace(/[\s,;:.–-]+$/, '')}…`;
}

/* ------------------------- Pegar el texto completo ------------------------- */

function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** «1. SOBRE ESTE SECTOR», «II .- Construcción», «4) Servicios» → sin el número. */
const NUMERACION = /^\s*(?:\d{1,2}|[ivxlc]{1,5})\s*(?:[.)]\s*[-–—:]?|[-–—:])\s*/i;

const ENCABEZADOS: Array<[ClaveBloqueSector, RegExp]> = [
  ['sobre', /^sobre (?:este|el) sector$/],
  ['trayectoria', /^(?:nuestra )?trayectoria$/],
  ['esencia', /^(?:nuestra )?esencia$/],
  ['servicios', /^(?:nuestros )?servicios$/],
  ['excelencia', /^(?:nuestra )?excelencia$|^(?:nuestro )?diferencial$/],
  ['lista', /^servicios incluidos$|^soluciones (?:para|incluidas|disponibles)\b/],
];

function encabezadoDe(l: string): ClaveBloqueSector | null {
  if (VIÑETA.test(l) && !NUMERACION.test(l)) return null;
  const t = l.replace(NUMERACION, '').replace(/:$/, '').trim();
  if (!t || t.length > 45 || /\.$/.test(t)) return null;
  const n = sinAcentos(t);
  for (const [clave, re] of ENCABEZADOS) if (re.test(n)) return clave;
  return null;
}

const esMayusculas = (s: string) => /[A-ZÁÉÍÓÚÑ]{3}/.test(s) && s === s.toUpperCase();
const comoOracion = (s: string) => {
  const t = esMayusculas(s) ? s.toLocaleLowerCase('es') : s;
  return t.charAt(0).toLocaleUpperCase('es') + t.slice(1);
};
const PREFIJO_MARCA = /^maqser\s*24\s*[|—–:-]\s*/i;

export interface TextoSectorSeparado {
  /** Si el texto empieza con el nombre del sector («CONSTRUCCIÓN INDUSTRIAL»). */
  titulo: string | null;
  frase: string | null;
  textos: Record<ClaveBloqueSector, string>;
  titulos: Partial<Record<ClaveBloqueSector, string>>;
  destacados: Partial<Record<ClaveBloqueSector, string>>;
  /** Cuántos apartados se reconocieron por su título. */
  reconocidos: number;
}

/**
 * Reparte un documento pegado en los campos del sector. Reconoce los títulos de
 * los apartados con o sin número («1. SOBRE ESTE SECTOR», «Nuestra esencia»,
 * «Nuestro diferencial», «Soluciones para infraestructura»…), en orden. Lo de
 * antes del primero es el nombre del sector (si va en mayúsculas o igual al
 * actual), la frase corta y una introducción que se suma a «Sobre este
 * sector». En cada apartado, un primer renglón corto seguido de más texto es
 * su frase destacada.
 */
export function separarTextoSector(texto: string, tituloActual = ''): TextoSectorSeparado {
  const ls = renglones(texto);
  const secciones: Array<{ clave: ClaveBloqueSector | null; encabezado: string | null; lineas: string[] }> = [{ clave: null, encabezado: null, lineas: [] }];
  let orden = -1;
  for (const l of ls) {
    const clave = l ? encabezadoDe(l) : null;
    const pos = clave ? CLAVES_BLOQUE_SECTOR.indexOf(clave) : -1;
    if (clave && pos > orden) {
      orden = pos;
      secciones.push({ clave, encabezado: l.replace(NUMERACION, '').replace(/:$/, '').trim(), lineas: [] });
    } else secciones[secciones.length - 1]!.lineas.push(l);
  }

  const textos = Object.fromEntries(CLAVES_BLOQUE_SECTOR.map((c) => [c, ''])) as Record<ClaveBloqueSector, string>;
  const titulos: TextoSectorSeparado['titulos'] = {};
  const destacados: TextoSectorSeparado['destacados'] = {};

  // Lo de antes del primer apartado: nombre, frase corta e introducción.
  const previo = secciones[0]!.lineas.filter((l) => l && !SEPARADOR.test(l));
  let titulo: string | null = null;
  if (previo.length) {
    const primera = previo[0]!.replace(NUMERACION, '').trim();
    const igual = tituloActual && sinAcentos(primera) === sinAcentos(tituloActual);
    if (primera && primera.length <= 60 && (esMayusculas(primera) || igual || NUMERACION.test(previo[0]!))) {
      titulo = comoOracion(primera);
      previo.shift();
    }
  }
  const resto = previo.map((l) => ({ texto: l.replace(PREFIJO_MARCA, ''), deMarca: PREFIJO_MARCA.test(l) }));
  const elegida = resto.find((r) => r.texto.length <= 180 && /\.$/.test(r.texto)) ?? resto.find((r) => r.texto.length <= 180) ?? null;
  const frase = elegida?.texto ?? null;
  const intro = resto.filter((r) => r !== elegida && !(r.deMarca && elegida)).map((r) => r.texto);

  for (const s of secciones.slice(1)) {
    const clave = s.clave!;
    const def = BLOQUES_SECTOR.find((b) => b.clave === clave)!.titulo;
    if (s.encabezado && sinAcentos(s.encabezado) !== sinAcentos(def)) titulos[clave] = comoOracion(s.encabezado);
    const lineas = s.lineas.filter((l) => !SEPARADOR.test(l) || !l);
    if (clave === 'lista') {
      textos.lista = lineas.join('\n').replace(/\n{3,}/g, '\n\n').trim();
      continue;
    }
    const parrafos = lineas.filter(Boolean);
    if (parrafos.length >= 2 && parrafos[0]!.length <= 110 && !VIÑETA.test(parrafos[0]!)) destacados[clave] = parrafos.shift()!;
    textos[clave] = parrafos.join('\n\n');
  }
  if (intro.length) textos.sobre = [...intro, textos.sobre].filter(Boolean).join('\n\n');

  return { titulo, frase, textos, titulos, destacados, reconocidos: secciones.length - 1 };
}
