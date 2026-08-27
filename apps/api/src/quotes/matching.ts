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
  /** Coordenadas de su base y hasta donde llega. Null = solo vale su lista. */
  lat?: number | null;
  lng?: number | null;
  coverageRadiusKm?: number | null;
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
  /**
   * Equipos que ese aliado tiene en la categoría pedida y su estado.
   *
   * `noAlcanza` lista los atributos por los que ese equipo NO sirve para esta
   * solicitud: una plataforma de 12 m cuando piden 18. Vacio = sirve, o no hay
   * con que comparar — y las dos cosas se tratan igual, porque no poder
   * comprobar algo no es motivo para descartar.
   */
  equipos: Array<{
    id: number;
    name: string;
    state: string;
    location: string | null;
    noAlcanza?: Array<{ texto: string }>;
  }>;
}

export interface SolicitudParaEmparejar {
  /** Slug de la categoría de servicio. */
  categoria: string | null;
  /** Municipio o texto de la ubicación de obra. */
  zona: string | null;
  /** Coordenadas de la obra, si ya se geocodificó. */
  punto?: { lat: number; lon: number } | null;
}

/** Kilometros en linea recta entre dos puntos. */
export function distanciaKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Linea recta -> carretera. El mismo factor que usa el cotizador de traslado. */
const FACTOR_CARRETERA = 1.32;

export interface Cobertura {
  cubre: boolean;
  /** Kilometros por carretera, cuando se pudo calcular. */
  km: number | null;
  /** Como se decidio: por distancia medida o por la lista de municipios. */
  como: 'distancia' | 'municipio' | 'sin-dato';
}

/**
 * ¿Este aliado alcanza esta obra?
 *
 * Manda la DISTANCIA sobre el texto cuando los dos tienen coordenadas y el
 * aliado declaró un radio: "¿está a menos de 40 km?" es la pregunta real, y
 * "¿escribió este municipio?" era sólo la que se podía contestar. El texto
 * sigue siendo el respaldo, porque cambiar de criterio de golpe dejaría sin
 * cobertura a todo aliado que aún no se ha geocodificado.
 */
export function coberturaDe(
  p: {
    coverage: string[];
    lat?: number | null;
    lng?: number | null;
    coverageRadiusKm?: number | null;
  },
  solicitud: SolicitudParaEmparejar,
): Cobertura {
  if (p.lat != null && p.lng != null && p.coverageRadiusKm && solicitud.punto) {
    const km =
      Math.round(
        distanciaKm({ lat: p.lat, lon: p.lng }, solicitud.punto) * FACTOR_CARRETERA * 10,
      ) / 10;
    return { cubre: km <= p.coverageRadiusKm, km, como: 'distancia' };
  }
  if (solicitud.zona) {
    return { cubre: cubreZona(p.coverage, solicitud.zona), km: null, como: 'municipio' };
  }
  return { cubre: false, km: null, como: 'sin-dato' };
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

      const cob = coberturaDe(p, solicitud);
      if (cob.cubre) {
        puntaje += 50;
        razones.push(
          cob.km !== null ? `A ${cob.km} km de la obra` : `Cubre ${zona}`,
        );
      } else if (cob.km !== null) {
        // Con distancia medida el aviso es concreto: no "no cubre esa zona"
        // sino cuantos kilometros se sale, que es lo que decide si vale la pena.
        advertencias.push(
          `La obra queda a ${cob.km} km y él llega hasta ${p.coverageRadiusKm}: habría que cotizar el traslado`,
        );
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
      /**
       * Solo cuentan los que ademas ALCANZAN lo que la solicitud pide. Una
       * plataforma de 12 m disponible no sirve para una obra que necesita 18:
       * contarla como capacidad inflaria el puntaje del aliado con un equipo
       * que no puede ir.
       */
      const sirven = p.equipos.filter((e) => ASIGNABLES.has(e.state) && (e.noAlcanza ?? []).length === 0);
      const cortos = p.equipos.filter((e) => ASIGNABLES.has(e.state) && (e.noAlcanza ?? []).length > 0);
      const equiposDisponibles = sirven.length;

      if (cortos.length > 0) {
        advertencias.push(
          `${cortos.length} equipo(s) suyo(s) libre(s) no alcanzan lo pedido: ${cortos[0].noAlcanza![0].texto}`,
        );
      }
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
