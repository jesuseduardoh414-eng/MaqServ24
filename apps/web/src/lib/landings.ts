/**
 * Páginas de aterrizaje por línea de servicio (2026-09-30).
 *
 * Existen porque las cinco categorías no tenían una página que Google pudiera
 * indexar: la tarjeta lleva a `/productos?categoria=…` (canonical a
 * /productos) o a `/cotizar?servicio=…` (noindex). Cada una apunta a una
 * búsqueda concreta ("renta de maquinaria pesada Monterrey", "pipas de agua",
 * "grava y arena"…) con la zona donde se opera: NL, Coahuila y Chihuahua
 * (`ESTADOS_OPERACION`).
 *
 * El título y la descripción SEO son copys `seo.landing.<clave>.*` del tema
 * (editables en el panel). El cuerpo vive aquí: es contenido largo y
 * estructurado que el editor de copys no maneja.
 *
 * Página nueva ⇒ entrada aquí + carpeta en app/ con `LandingServicio` +
 * copys en default-theme.ts. Sitemap, llms.txt y el pie la toman de esta lista.
 */
export interface Landing {
  /** Ruta pública, sin barra final. */
  ruta: string;
  /** Sufijo de los copys `seo.landing.<clave>.title|description`. */
  clave: string;
  /** Slug de la categoría (llave de `providers.categories` y `quotes.service_category`). */
  categoria: string;
  /** Nombre corto para menús, migas y el pie. */
  nombre: string;
  /** Una línea bajo el nombre en el submenú «Soluciones». */
  resumen: string;
  eyebrow: string;
  h1: string;
  intro: string[];
  incluye: { titulo: string; items: string[] };
  usos: string[];
  faqs: Array<{ pregunta: string; respuesta: string }>;
  /** A dónde lleva el botón principal. Sin cotizador en línea: el formulario con el servicio puesto. */
  cotizar: { href: string; texto: string };
}

const ZONA = 'Monterrey y su zona metropolitana, el resto de Nuevo León, Coahuila y Chihuahua';

export const LANDINGS: Landing[] = [
  {
    ruta: '/renta-de-maquinaria-pesada',
    clave: 'machinery',
    categoria: 'maquinaria-pesada',
    nombre: 'Renta de maquinaria pesada',
    resumen: 'Excavadoras, retroexcavadoras y más, con operador',
    eyebrow: 'Renta de maquinaria',
    h1: 'Renta de maquinaria pesada en Monterrey y el norte de México',
    intro: [
      'Renta excavadoras, retroexcavadoras, motoconformadoras, compactadores, bulldozers y plataformas de elevación para tu obra. Cotizas en línea con un tabulador estándar y MAQSER24 asigna el equipo de un proveedor de su red.',
      `Atendemos ${ZONA}. Tú nos dices la obra, el equipo y los días; nosotros coordinamos la entrega y damos seguimiento hasta que termina el servicio.`,
    ],
    incluye: {
      titulo: 'Equipos que puedes rentar',
      items: [
        'Excavadoras',
        'Retroexcavadoras',
        'Motoconformadoras',
        'Compactadores y rodillos',
        'Bulldozers (tractores de oruga)',
        'Equipo menor',
        'Plataformas de elevación',
        'Renta con operador y diésel',
      ],
    },
    usos: ['Excavación y movimiento de tierras', 'Nivelación y terracerías', 'Demolición', 'Caminos y urbanización', 'Naves industriales', 'Obra civil y fraccionamientos'],
    faqs: [
      {
        pregunta: '¿La renta de maquinaria incluye operador?',
        respuesta: 'Sí. El cotizador en línea arma la renta con operador y diésel, y el documento te muestra qué incluye cada partida antes de enviarlo.',
      },
      {
        pregunta: '¿En qué zonas rentan maquinaria?',
        respuesta: `En ${ZONA}. Al cotizar eliges el municipio de entrega y aparece en tu documento.`,
      },
      {
        pregunta: '¿Por cuánto tiempo puedo rentar un equipo?',
        respuesta: 'Por días de trabajo. Capturas los días y las horas en el cotizador y el resumen se actualiza al momento.',
      },
      {
        pregunta: '¿Quién me entrega la máquina?',
        respuesta: 'Un proveedor de la red de MAQSER24. Nosotros lo asignamos, coordinamos la entrega y damos seguimiento al servicio.',
      },
    ],
    cotizar: { href: '/cotizador/maquinaria', texto: 'Cotizar maquinaria' },
  },
  {
    ruta: '/pipas-de-agua-y-volteos',
    clave: 'transport',
    categoria: 'transporte-y-servicios-de-obra',
    nombre: 'Pipas de agua y volteos',
    resumen: 'Agua para obra, acarreos y retiro de escombro',
    eyebrow: 'Transporte y servicios de obra',
    h1: 'Pipas de agua y camiones de volteo para tu obra',
    intro: [
      'Solicita agua en pipas para compactación, riego o curado de concreto, y camiones de volteo para acarreos de material, escombro o tierra.',
      `Operamos en ${ZONA}. Nos dices cuántos viajes necesitas y a dónde, y coordinamos al proveedor para que llegue a tu obra.`,
    ],
    incluye: {
      titulo: 'Servicios de transporte',
      items: ['Agua en pipas para obra', 'Agua para compactación y riego', 'Camiones de volteo', 'Acarreo de material pétreo', 'Retiro de escombro', 'Acarreo de tierra y relleno'],
    },
    usos: ['Compactación de terracerías', 'Riego para control de polvo', 'Curado de concreto', 'Limpieza de terreno', 'Movimiento de material entre obras'],
    faqs: [
      {
        pregunta: '¿Cómo se cobra el agua en pipas?',
        respuesta: 'Por viaje. En tu solicitud indicas cuántos viajes necesitas y el municipio de entrega, y te respondemos con la propuesta.',
      },
      {
        pregunta: '¿Los volteos sirven para sacar escombro?',
        respuesta: 'Sí. Los camiones de volteo sirven para acarreo de material, tierra y retiro de escombro de la obra.',
      },
      {
        pregunta: '¿En qué zonas dan servicio?',
        respuesta: `En ${ZONA}.`,
      },
    ],
    cotizar: { href: '/cotizar?servicio=transporte-y-servicios-de-obra', texto: 'Solicitar cotización' },
  },
  {
    ruta: '/triturados',
    clave: 'aggregates',
    categoria: 'triturados',
    nombre: 'Triturados: grava, arena y base',
    resumen: 'Por tonelada en planta o por viaje a obra',
    eyebrow: 'Triturados',
    h1: 'Grava, arena y base hidráulica para construcción',
    intro: [
      'Compra triturados para tu obra: arena, grava, base hidráulica y CNC. Cotizas en línea por tonelada en planta o por viaje puesto en obra.',
      `Surtimos en ${ZONA}. El documento de cotización te llega al momento y lo puedes compartir con tu equipo.`,
    ],
    incluye: {
      titulo: 'Materiales disponibles',
      items: ['Arena', 'Grava', 'Base hidráulica', 'CNC', 'Material de banco y relleno'],
    },
    usos: ['Firmes y losas de concreto', 'Bases para caminos y estacionamientos', 'Rellenos y nivelación', 'Mezclas y aplanados'],
    faqs: [
      {
        pregunta: '¿Venden grava y arena por tonelada o por viaje?',
        respuesta: 'De las dos formas. El cotizador te deja elegir por tonelada en planta o por viaje puesto en tu obra.',
      },
      {
        pregunta: '¿Qué es la base hidráulica?',
        respuesta: 'Es una mezcla de grava y finos que se compacta como capa de apoyo para pavimentos, patios y estacionamientos.',
      },
      {
        pregunta: '¿Hacen entregas fuera de Monterrey?',
        respuesta: `Sí. Surtimos en ${ZONA}.`,
      },
    ],
    cotizar: { href: '/cotizador/triturados', texto: 'Cotizar triturados' },
  },
  {
    ruta: '/materiales-para-construccion',
    clave: 'materials',
    categoria: 'materiales-para-construccion',
    nombre: 'Materiales para construcción',
    resumen: 'Concreto premezclado, acero, block y cemento',
    eyebrow: 'Materiales para construcción',
    h1: 'Concreto premezclado, acero, block y cemento',
    intro: [
      'Pide los materiales de tu obra en un solo lugar: concreto premezclado, acero de refuerzo, block y cemento.',
      `Atendemos ${ZONA}. Nos mandas las cantidades y el lugar de entrega, y te respondemos con la propuesta.`,
    ],
    incluye: {
      titulo: 'Materiales',
      items: ['Concreto premezclado', 'Acero de refuerzo (varilla)', 'Block de concreto', 'Cemento por bulto'],
    },
    usos: ['Cimentaciones', 'Losas y firmes', 'Muros y bardas', 'Obra industrial y comercial'],
    faqs: [
      {
        pregunta: '¿Cómo pido concreto premezclado?',
        respuesta: 'Envías tu solicitud con los metros cúbicos, la resistencia que necesitas y la fecha de colado. Te respondemos con la propuesta.',
      },
      {
        pregunta: '¿Puedo pedir varios materiales a la vez?',
        respuesta: 'Sí. En la misma solicitud anotas todo lo que necesitas y un asesor lo arma contigo.',
      },
      {
        pregunta: '¿En qué zonas entregan?',
        respuesta: `En ${ZONA}.`,
      },
    ],
    cotizar: { href: '/cotizar?servicio=materiales-para-construccion', texto: 'Solicitar cotización' },
  },
  {
    ruta: '/carpeta-asfaltica',
    clave: 'asphalt',
    categoria: 'soluciones-asfalticas',
    nombre: 'Carpeta asfáltica',
    resumen: 'Suministro y aplicación de carpeta asfáltica',
    eyebrow: 'Soluciones asfálticas',
    h1: 'Suministro y aplicación de carpeta asfáltica',
    intro: [
      'Pavimenta caminos, estacionamientos y patios de maniobra con suministro y aplicación de carpeta asfáltica.',
      `Operamos en ${ZONA}. Nos dices los metros cuadrados y el tipo de trabajo, y coordinamos al proveedor.`,
    ],
    incluye: {
      titulo: 'Servicios de asfalto',
      items: ['Suministro de mezcla asfáltica', 'Tendido y compactación de carpeta', 'Pavimentación de estacionamientos', 'Patios de maniobra'],
    },
    usos: ['Estacionamientos', 'Calles y caminos internos', 'Parques industriales', 'Fraccionamientos'],
    faqs: [
      {
        pregunta: '¿Cómo se cotiza la carpeta asfáltica?',
        respuesta: 'Por metro cuadrado. En tu solicitud indicas la superficie, el espesor si lo conoces y el lugar de la obra.',
      },
      {
        pregunta: '¿En qué zonas trabajan?',
        respuesta: `En ${ZONA}.`,
      },
    ],
    cotizar: { href: '/cotizar?servicio=soluciones-asfalticas', texto: 'Solicitar cotización' },
  },
];

export function landingPorRuta(ruta: string): Landing {
  const l = LANDINGS.find((x) => x.ruta === ruta);
  if (!l) throw new Error(`Landing no registrada: ${ruta}`);
  return l;
}
