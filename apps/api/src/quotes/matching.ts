/**
 * EMPAREJAMIENTO (documento institucional, secciones 16 y 17).
 *
 * "El sistema identifica proveedores o activos potencialmente compatibles por
 * categoría, zona y capacidad." Es el modulo que el documento llama Matching:
 * "relaciona solicitud con oferta compatible por tipo, zona, capacidad y
 * reglas".
 *
 * Es la pieza que convierte la plataforma en lo que describe la tesis del
 * documento — "su producto no es una excavadora: es la coordinación entre
 * necesidad y capacidad disponible" — y hasta ahora no existía: alguien tenía
 * que acordarse de a quién llamar.
 *
 * DOS DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. Los filtros duros son solo dos: la categoría y que el aliado esté activo.
 *    La ZONA no descarta, ORDENA. Un proveedor de García puede atender una obra
 *    en Juárez cobrando el traslado, y descartarlo dejaría solicitudes sin
 *    cubrir teniendo capacidad disponible. El documento pide precisamente medir
 *    "demanda no cubierta", no fabricarla.
 *
 * 2. El orden no es un número mágico. Cada candidato explica POR QUÉ está donde
 *    está, en palabras. Quien cotiza tiene que poder discrepar con el sistema, y
 *    para eso necesita ver el razonamiento.
 */

export interface ProveedorCandidato {
  id: number;
  name: string;
  slug: string;
  level: string;
  verified: boolean;
  coverage: string[];
  categories: string[];
  /** Lo que el aliado DECLARA que tarda. Es un numero escrito a mano. */
  responseMinutes: number | null;
  /**
   * Lo que tarda de verdad, medido sobre sus propuestas contestadas.
   * Null mientras no haya con que medirlo.
   */
  responseMinutesReal?: number | null;
  /** Servicios que acepto y termino cancelando. */
  canceladosPropios?: number;
  /**
   * Lo que la obra exige, cruzado contra SU expediente. Vacio cuando la obra
   * no exige nada.
   */
  requisitosObra?: Array<{ texto: string; estado: string; nota: string }>;
  monthsInNetwork: number | null;
  /** Equipos que ese aliado tiene en la categoría pedida y su estado. */
  equipos: Array<{ id: number; name: string; state: string; location: string | null }>;
}

export interface SolicitudParaEmparejar {
  /** Slug de la categoría de servicio. */
  categoria: string | null;
  /** Municipio o texto de la ubicación de obra. */
  zona: string | null;
}

export interface Coincidencia {
  proveedor: ProveedorCandidato;
  /** Mayor es mejor. Solo sirve para ordenar; lo que se lee son las razones. */
  puntaje: number;
  /** Por qué está en la lista, en palabras. */
  razones: string[];
  /** Lo que hay que tomar en cuenta antes de asignarlo. */
  advertencias: string[];
  /** Equipos suyos que hoy se podrían asignar. */
  equiposDisponibles: number;
}

/** Compara municipios ignorando acentos, mayúsculas y espacios de sobra. */
export function normalizarZona(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * ¿La cobertura del aliado incluye esta zona?
 *
 * Se compara por inclusión en ambos sentidos porque la ubicación de obra la
 * escribe el cliente en texto libre: "Apodaca, N.L." o "Parque Industrial
 * Apodaca" deben casar con el municipio "Apodaca".
 */
export function cubreZona(coverage: string[], zona: string | null): boolean {
  if (!zona) return false;
  const z = normalizarZona(zona);
  if (!z) return false;
  return coverage.some((m) => {
    const c = normalizarZona(m);
    return c.length > 2 && (z.includes(c) || c.includes(z));
  });
}

/** Estados en los que un equipo se puede comprometer hoy. */
const ASIGNABLES = new Set(['disponible', 'limitada']);

/** Peso de cada nivel. El orden es la escalera del documento. */
const PESO_NIVEL: Record<string, number> = {
  preferente: 30,
  activo: 20,
  validado: 10,
  registrado: 0,
};

export function emparejar(
  solicitud: SolicitudParaEmparejar,
  candidatos: ProveedorCandidato[],
): Coincidencia[] {
  const { categoria, zona } = solicitud;

  return candidatos
    // Filtro duro: si no atiende la categoría, no viene al caso.
    .filter((p) => !categoria || p.categories.includes(categoria))
    .map((p) => {
      const razones: string[] = [];
      const advertencias: string[] = [];
      let puntaje = 0;

      const enZona = cubreZona(p.coverage, zona);
      if (enZona) {
        puntaje += 50;
        razones.push(`Cubre ${zona}`);
      } else if (zona) {
        advertencias.push(`No declara cobertura en ${zona}: habría que cotizar el traslado`);
      }

      if (p.verified) {
        puntaje += 25;
        razones.push('Expediente verificado');
      } else {
        advertencias.push('Sin sello: sus documentos no están completos o vigentes');
      }

      puntaje += PESO_NIVEL[p.level] ?? 0;
      if (p.level === 'preferente') razones.push('Aliado preferente');

      // Tiempo de respuesta: hasta 20 puntos, cae a cero a partir de 2 horas.
      //
      // Manda el MEDIDO sobre el declarado. El declarado es un numero que
      // alguien escribio al dar de alta al aliado; el medido sale de sus
      // propuestas contestadas. Ordenar por una promesa cuando ya existe el
      // dato real es preferir el folleto sobre el historial.
      const minutos = p.responseMinutesReal ?? p.responseMinutes;
      if (minutos !== null && minutos !== undefined) {
        puntaje += Math.max(0, 20 - Math.floor(minutos / 6));
        razones.push(
          p.responseMinutesReal != null
            ? `Contesta en ~${minutos} min (medido)`
            : `Dice responder en ~${minutos} min`,
        );
      } else {
        advertencias.push('Sin historial de tiempo de respuesta');
      }

      // Cancelar despues de aceptar es lo que mas duele: la obra ya contaba con
      // esa unidad. No descarta —puede haber tenido razon— pero pesa y se dice.
      if (p.canceladosPropios && p.canceladosPropios > 0) {
        puntaje -= p.canceladosPropios * 25;
        advertencias.push(
          `Cancelo ${p.canceladosPropios} servicio(s) que ya habia aceptado`,
        );
      }

      /**
       * Lo que la obra exige (documento institucional, 23).
       *
       * NO descarta, advierte — mismo criterio que la zona. Un aliado sin la
       * poliza al dia puede conseguirla en un dia, y a veces la obra la pide
       * como formalidad; esconderlo dejaria solicitudes sin cubrir. Pero resta,
       * porque entre dos que pueden, el que ya acredita llega antes.
       */
      const faltantes = (p.requisitosObra ?? []).filter((r) => r.estado === 'falta');
      const porConfirmar = (p.requisitosObra ?? []).filter((r) => r.estado === 'por-confirmar');
      if (faltantes.length > 0) {
        puntaje -= faltantes.length * 15;
        advertencias.push(
          `La obra exige ${faltantes.map((f) => f.texto).join(', ')} y no lo acredita`,
        );
      }
      if (porConfirmar.length > 0) {
        advertencias.push(
          `Confirmarle: ${porConfirmar.map((f) => f.texto).join(', ')}`,
        );
      }
      if ((p.requisitosObra ?? []).length > 0 && faltantes.length === 0 && porConfirmar.length === 0) {
        razones.push('Acredita todo lo que la obra exige');
      }

      // Antigüedad: hasta 10 puntos, uno por mes hasta los diez.
      if (p.monthsInNetwork !== null) {
        puntaje += Math.min(10, p.monthsInNetwork);
        if (p.monthsInNetwork >= 12) razones.push(`${p.monthsInNetwork} meses en la red`);
      }

      // Capacidad. El documento la nombra junto a tipo y zona, no como detalle:
      // tener la máquina libre HOY es la otra mitad de "¿quién puede atender
      // esto?". Por eso pesa parecido a la zona y no como un desempate: si no,
      // un aliado sin nada libre le gana a otro que sí lo tiene por responder
      // siete minutos antes, que es exactamente la decisión equivocada.
      //
      // No tener equipos registrados NO resta. En pipas, volteos y triturados
      // no se dan de alta unidades —se cobran por viaje o por tonelada—, y
      // castigarlos los volvería irrecomendables. Como el filtro es por
      // categoría, solo se comparan aliados de la misma línea entre sí.
      const equiposDisponibles = p.equipos.filter((e) => ASIGNABLES.has(e.state)).length;
      if (equiposDisponibles > 0) {
        puntaje += Math.min(45, 30 + (equiposDisponibles - 1) * 5);
        razones.push(`${equiposDisponibles} equipo(s) asignable(s) hoy`);
      } else if (p.equipos.length > 0) {
        advertencias.push('Sus equipos de esta categoría están comprometidos o por confirmar');
      } else {
        advertencias.push('No tiene equipos registrados en esta categoría');
      }

      return { proveedor: p, puntaje, razones, advertencias, equiposDisponibles };
    })
    .sort((a, b) => {
      if (b.puntaje !== a.puntaje) return b.puntaje - a.puntaje;
      // A igualdad, el que responde más rápido: es el que resuelve antes.
      const ra = a.proveedor.responseMinutesReal ?? a.proveedor.responseMinutes ?? 9999;
      const rb = b.proveedor.responseMinutesReal ?? b.proveedor.responseMinutes ?? 9999;
      return ra - rb;
    });
}

/**
 * Por qué una solicitud se quedó sin candidatos.
 *
 * El documento pide que cada solicitud no cubierta genere un dato: "qué equipo
 * faltó, en qué municipio, para qué fecha y por qué no se cubrió. Ese dato debe
 * dirigir reclutamiento de proveedores y expansión."
 */
export function motivoSinCobertura(
  solicitud: SolicitudParaEmparejar,
  totalAliados: number,
  enCategoria: number,
): string {
  if (totalAliados === 0) return 'Todavía no hay aliados dados de alta.';
  if (!solicitud.categoria) return 'La solicitud no indica categoría de servicio.';
  if (enCategoria === 0) return `Ningún aliado atiende ${solicitud.categoria}. Aquí hay que reclutar.`;
  return 'Hay aliados en la categoría, pero ninguno declara cobertura ni equipos disponibles.';
}
