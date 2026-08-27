/**
 * ATRIBUTOS TÉCNICOS POR LÍNEA (documento institucional, sección 17).
 *
 * "Catálogo: estandariza categorías, tipos de equipo, capacidades, materiales
 * y atributos."
 *
 * La ficha técnica era texto libre, así que nadie podía buscar "excavadora de
 * más de 20 toneladas" — y el emparejamiento no podía descartar un equipo que
 * no alcanza lo que la obra pidió, aunque la solicitud YA preguntaba esa
 * capacidad. Había dos vocabularios sin puente.
 *
 * TRES DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. Las llaves que se pueden cruzar se LLAMAN IGUAL que en el formulario de
 *    solicitud (`request-fields.ts`). Una plataforma tiene `altura` y la
 *    solicitud pregunta `altura`: ese es todo el puente. Ponerles nombres
 *    distintos habría dejado los dos lados hablando de lo mismo sin poder
 *    reconocerse, que es el problema que esto viene a resolver.
 *
 * 2. Comparar sólo lo que se puede comparar. Un número con unidad —metros,
 *    toneladas, litros— se contrasta; "condiciones de acceso" no. Sólo los
 *    atributos marcados `compara` entran al emparejamiento; los demás son
 *    ficha para leer.
 *
 * 3. El equipo debe ALCANZAR lo pedido, no igualarlo. Quien pide 12 m de
 *    altura queda bien servido con una plataforma de 16; el criterio es "al
 *    menos", nunca "exacto". Con igualdad, pedir 12.5 no encontraría nada.
 */

export type TipoAtributo = 'numero' | 'texto' | 'opcion';

export interface AtributoProducto {
  clave: string;
  label: string;
  tipo: TipoAtributo;
  unidad?: string;
  opciones?: string[];
  hint?: string;
  /**
   * Cómo se contrasta contra la solicitud. Ausente = no se compara, es ficha
   * para leer.
   *
   * `alcanza`: el equipo debe ser mayor o igual a lo pedido (altura, carga).
   * `igual`: tiene que coincidir (tipo de plataforma, energía).
   */
  compara?: 'alcanza' | 'igual';
}

export const ATRIBUTOS_POR_CATEGORIA: Record<string, AtributoProducto[]> = {
  'maquinaria-pesada': [
    { clave: 'capacidad', label: 'Capacidad o tonelaje', tipo: 'numero', unidad: 't', compara: 'alcanza', hint: 'Lo que la máquina mueve o pesa en operación.' },
    { clave: 'potencia', label: 'Potencia', tipo: 'numero', unidad: 'HP' },
    { clave: 'año', label: 'Modelo', tipo: 'numero', hint: 'Año del equipo.' },
    { clave: 'implementos', label: 'Implementos que trae', tipo: 'texto', hint: 'Cucharón, martillo, rastrillo…' },
  ],
  'equipo-menor': [
    { clave: 'potencia', label: 'Potencia', tipo: 'numero', unidad: 'HP' },
    { clave: 'peso', label: 'Peso', tipo: 'numero', unidad: 'kg' },
    { clave: 'energia', label: 'Energía', tipo: 'opcion', opciones: ['Eléctrica', 'Gasolina', 'Diésel', 'Neumática'], compara: 'igual' },
  ],
  'plataformas-de-elevacion': [
    // Estas tres son el caso más claro del puente: la solicitud las pregunta
    // como números con la misma unidad y el mismo nombre.
    { clave: 'altura', label: 'Altura de trabajo', tipo: 'numero', unidad: 'm', compara: 'alcanza' },
    { clave: 'alcance', label: 'Alcance horizontal', tipo: 'numero', unidad: 'm', compara: 'alcanza' },
    { clave: 'carga', label: 'Capacidad de carga', tipo: 'numero', unidad: 'kg', compara: 'alcanza' },
    { clave: 'tipo_plataforma', label: 'Tipo', tipo: 'opcion', opciones: ['Tijera', 'Articulada', 'Telescópica', 'Mástil'], compara: 'igual' },
    { clave: 'energia', label: 'Energía', tipo: 'opcion', opciones: ['Eléctrica', 'Diésel', 'Híbrida'], compara: 'igual' },
  ],
  'agua-en-pipas': [
    { clave: 'capacidad_pipa', label: 'Capacidad de la pipa', tipo: 'numero', unidad: 'L', compara: 'alcanza' },
    { clave: 'potabilidad', label: 'Tipo de agua', tipo: 'opcion', opciones: ['Potable', 'Tratada', 'Cruda'], compara: 'igual' },
  ],
  volteos: [
    { clave: 'capacidad_unidad', label: 'Capacidad de la caja', tipo: 'numero', unidad: 'm³', compara: 'alcanza' },
    { clave: 'tipo_caja', label: 'Tipo de caja', tipo: 'opcion', opciones: ['Sencillo', 'Torton', 'Full'] },
  ],
  triturados: [
    { clave: 'material', label: 'Material', tipo: 'texto', hint: 'Base hidráulica, grava, arena…' },
    { clave: 'tamano', label: 'Tamaño', tipo: 'texto', hint: '3/4", 1 1/2", finos…' },
    { clave: 'banco', label: 'Banco de origen', tipo: 'texto' },
  ],
};

export function atributosDe(categoria: string | null | undefined): AtributoProducto[] {
  return (categoria && ATRIBUTOS_POR_CATEGORIA[categoria]) || [];
}

/**
 * Saca el número de un texto escrito por una persona.
 *
 * La solicitud a veces pregunta con un campo de texto —"20 toneladas", "de 20
 * a 25 ton", "10,000 L"— porque obligar a un número puro haría que el cliente
 * abandonara el formulario. Aquí se recupera lo que se pueda: se toma el
 * PRIMER número, que en un rango es el mínimo aceptable, y ese es justo el
 * criterio correcto para "al menos".
 *
 * Devuelve null cuando no hay número. Ver decisión 2: lo que no se puede
 * comparar, no se compara.
 */
export function numeroDe(texto: string | number | null | undefined): number | null {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : null;
  if (!texto) return null;
  // Se quitan los separadores de millar antes de buscar: "10,000" es diez mil,
  // no diez.
  const limpio = String(texto).replace(/(\d)[,\s](?=\d{3}\b)/g, '$1');
  const m = limpio.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

export interface Desajuste {
  clave: string;
  label: string;
  pedido: string;
  tiene: string;
  texto: string;
}

/**
 * ¿Este equipo alcanza lo que la solicitud pide?
 *
 * Devuelve los atributos que NO cumplen. Vacío = sirve, o no hay con qué
 * comparar — y esas dos cosas se tratan igual a propósito: no poder comprobar
 * algo no es motivo para descartar un equipo.
 */
export function desajustes(
  categoria: string | null | undefined,
  atributosDelEquipo: Record<string, unknown> | null | undefined,
  respuestasDeLaSolicitud: Record<string, string> | null | undefined,
): Desajuste[] {
  const attrs = atributosDe(categoria);
  const equipo = atributosDelEquipo ?? {};
  const pide = respuestasDeLaSolicitud ?? {};
  const fuera: Desajuste[] = [];

  for (const a of attrs) {
    if (!a.compara) continue;
    const pedido = pide[a.clave];
    if (pedido === undefined || pedido === null || String(pedido).trim() === '') continue;

    const tiene = equipo[a.clave];
    // Sin el dato en el equipo no se descarta: se desconoce, que no es lo
    // mismo que no cumplir. Quien captura el catálogo va al día siguiente.
    if (tiene === undefined || tiene === null || String(tiene).trim() === '') continue;

    if (a.compara === 'alcanza') {
      const nPide = numeroDe(pedido);
      const nTiene = numeroDe(tiene as string);
      if (nPide === null || nTiene === null) continue;
      if (nTiene < nPide) {
        const u = a.unidad ? ` ${a.unidad}` : '';
        fuera.push({
          clave: a.clave,
          label: a.label,
          pedido: `${nPide}${u}`,
          tiene: `${nTiene}${u}`,
          texto: `${a.label}: piden ${nPide}${u} y tiene ${nTiene}${u}`,
        });
      }
      continue;
    }

    // 'igual': se compara sin acentos ni mayúsculas, porque "Diésel" y "diesel"
    // son lo mismo y quien captura escribe como puede.
    const norm = (s: unknown) =>
      String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    if (norm(tiene) !== norm(pedido)) {
      fuera.push({
        clave: a.clave,
        label: a.label,
        pedido: String(pedido),
        tiene: String(tiene),
        texto: `${a.label}: piden ${pedido} y es ${tiene}`,
      });
    }
  }

  return fuera;
}

/** Ficha legible de un equipo, para pintarla sin repetir el catálogo. */
export function fichaDe(
  categoria: string | null | undefined,
  atributos: Record<string, unknown> | null | undefined,
): Array<{ label: string; valor: string }> {
  const a = atributos ?? {};
  return atributosDe(categoria)
    .filter((x) => a[x.clave] !== undefined && a[x.clave] !== null && String(a[x.clave]).trim() !== '')
    .map((x) => ({
      label: x.label,
      valor: `${a[x.clave]}${x.unidad ? ` ${x.unidad}` : ''}`,
    }));
}
