/**
 * Páginas de aterrizaje por línea de servicio (2026-09-30).
 *
 * Existen porque las cinco categorías no tenían una página que Google pudiera
 * indexar: la tarjeta lleva a `/servicios?categoria=…` (canonical a
 * /servicios; antes /productos, que desde 2026-10-08 solo redirige) o a
 * `/cotizar?servicio=…` (noindex). Cada una apunta a una
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
  /** Sin «Ver catálogo»: el catálogo de su categoría es de otra cosa (venta usa la foto de renta). */
  sinCatalogo?: boolean;
  /** Recuadro lateral cuando el de cotizar no aplica (venta no es un servicio que "termina"). */
  aside?: { titulo: string; texto: string; secundario: { href: string; texto: string } };
}

// Cobertura que se anuncia (2026-10-05): todo Nuevo León. Coahuila y Chihuahua
// vuelven aquí y en ESTADOS_COBERTURA cuando el cliente active el norte.
const ZONA = 'Monterrey, su zona metropolitana y el resto de Nuevo León';

export const LANDINGS: Landing[] = [
  {
    ruta: '/renta-de-maquinaria-pesada',
    clave: 'machinery',
    categoria: 'maquinaria-pesada',
    nombre: 'Renta de maquinaria pesada',
    resumen: 'Excavadoras, retroexcavadoras, motoconformadoras y vibrocompactadores',
    eyebrow: 'Renta de maquinaria',
    h1: 'Renta de maquinaria pesada en Monterrey y el norte de México',
    // Oferta vigente (2026-10-06, lista del cliente): solo estos cuatro equipos.
    intro: [
      'Renta excavadoras, retroexcavadoras, motoconformadoras y vibrocompactadores para tu obra. Cotizas en línea con un tabulador estándar y MAQSER24 asigna el equipo de un proveedor de su red.',
      `Atendemos ${ZONA}. Tú nos dices la obra, el equipo y los días; nosotros coordinamos la entrega y damos seguimiento hasta que termina el servicio.`,
    ],
    incluye: {
      titulo: 'Equipos que puedes rentar',
      items: [
        'Excavadoras',
        'Retroexcavadoras',
        'Motoconformadoras',
        'Vibrocompactadores',
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
  // Venta (2026-10-06, pedido del cliente). MAQSER24 no tiene inventario propio:
  // la compra se resuelve con la red de proveedores, así que el botón lleva a
  // Contacto con «Comprar maquinaria» ya elegido (queda en Mensajes del panel).
  {
    ruta: '/venta-de-maquinaria-pesada',
    clave: 'machinerySale',
    categoria: 'maquinaria-pesada',
    nombre: 'Venta de maquinaria pesada',
    resumen: 'Maquinaria, camiones de volteo y pipas con proveedores de la red',
    eyebrow: 'Venta de maquinaria',
    h1: 'Venta de maquinaria pesada en Monterrey y Nuevo León',
    intro: [
      'Compra excavadoras, retroexcavadoras, motoconformadoras, vibrocompactadores, Bobcat, camiones de volteo y pipas a través de la red de proveedores de MAQSER24. Nos dices qué equipo buscas y te presentamos las opciones disponibles.',
      `Atendemos ${ZONA}. Cuéntanos el tipo de equipo, el uso que le vas a dar, tu presupuesto y para cuándo lo necesitas; un asesor te contacta para continuar.`,
    ],
    incluye: {
      titulo: 'Equipos que puedes comprar',
      items: [
        'Excavadoras',
        'Retroexcavadoras',
        'Motoconformadoras',
        'Vibrocompactadores',
        'Bobcat (minicargador)',
        'Camión de volteo 14 m³',
        'Camión pipa 10 m³',
        'Camión pipa 20 m³',
      ],
    },
    usos: ['Excavación y movimiento de tierras', 'Terracerías y nivelación', 'Caminos y urbanización', 'Obra civil y fraccionamientos', 'Industria y minería', 'Agroindustria'],
    faqs: [
      {
        pregunta: '¿MAQSER24 vende la maquinaria directamente?',
        respuesta: 'La venta se hace con proveedores de la red de MAQSER24. Nosotros buscamos las opciones que encajan con lo que pides y te acompañamos durante el proceso.',
      },
      {
        pregunta: '¿Venden equipo nuevo o usado?',
        respuesta: 'De los dos, según lo que tengan los proveedores de la red en ese momento. Dinos si buscas equipo nuevo, seminuevo o te sirve cualquiera de los dos.',
      },
      {
        pregunta: '¿Qué datos necesito para pedir una opción de compra?',
        respuesta: 'El tipo de equipo, el uso que le darás, tu presupuesto aproximado, la ciudad donde lo necesitas y para cuándo.',
      },
      {
        pregunta: '¿Puedo vender mi maquinaria a través de MAQSER24?',
        respuesta: 'Sí. Regístrate como proveedor en maqserv24.com/proveedores y nuestro equipo revisará tu información para incorporarte a la red.',
      },
    ],
    cotizar: { href: '/contacto?necesidad=Comprar%20maquinaria', texto: 'Quiero comprar maquinaria' },
    sinCatalogo: true,
    aside: {
      titulo: '¿Buscas un equipo?',
      texto: 'Dinos qué necesitas y un asesor te presenta las opciones de la red de proveedores.',
      secundario: { href: '/proveedores', texto: 'Quiero vender mi maquinaria' },
    },
  },
  {
    ruta: '/pipas-de-agua-y-volteos',
    clave: 'transport',
    categoria: 'transporte-y-servicios-de-obra',
    nombre: 'Pipas de agua y volteos',
    resumen: 'Agua en pipa, material de banco y retiros de material',
    eyebrow: 'Transporte y servicios de obra',
    h1: 'Pipas de agua y camiones de volteo para tu obra',
    intro: [
      'Solicita agua en pipas de 10 o 20 m³, entregas de material de banco y retiros de material en camiones de 14 o 28 m³.',
      `Operamos en ${ZONA}. Nos dices cuántos viajes necesitas y a dónde, y coordinamos al proveedor para que llegue a tu obra.`,
    ],
    incluye: {
      titulo: 'Servicios de transporte',
      items: [
        'Entrega de agua en pipa de 10 m³',
        'Entrega de agua en pipa de 20 m³',
        'Entrega de material de banco en 14 m³',
        'Entrega de material de banco en 28 m³',
        'Retiro de material en 14 m³',
        'Retiro de material en 28 m³',
      ],
    },
    usos: ['Compactación de terracerías', 'Riego para control de polvo', 'Curado de concreto', 'Rellenos y nivelación', 'Limpieza de terreno'],
    faqs: [
      {
        pregunta: '¿Cómo se cobra el agua en pipas?',
        respuesta: 'Por viaje, en pipa de 10 o 20 m³. En tu solicitud indicas cuántos viajes necesitas y el municipio de entrega, y te respondemos con la propuesta.',
      },
      {
        pregunta: '¿De qué tamaño son los viajes de material?',
        respuesta: 'Las entregas de material de banco y los retiros de material se hacen en camiones de 14 m³ o de 28 m³.',
      },
      {
        pregunta: '¿En qué zonas dan servicio?',
        respuesta: `En ${ZONA}.`,
      },
    ],
    // Pipas, material de banco y retiros tienen precio en el cotizador de
    // maquinaria (2026-10-08): el botón lleva ahí y no al formulario sin precio.
    cotizar: { href: '/cotizador/maquinaria', texto: 'Cotizar en línea' },
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
      'Compra triturados para tu obra: arena 4, arena 5, grava 1, grava 2, base hidráulica y CNC. Cotizas en línea por tonelada en planta o por viaje puesto en obra.',
      `Surtimos en ${ZONA}. El documento de cotización te llega al momento y lo puedes compartir con tu equipo.`,
    ],
    incluye: {
      titulo: 'Materiales disponibles',
      items: ['Arena 4', 'Arena 5', 'Grava 1', 'Grava 2', 'Base hidráulica', 'CNC'],
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
    resumen: 'Block de concreto de 6"',
    eyebrow: 'Materiales para construcción',
    h1: 'Block de concreto de 6" para tu obra',
    intro: [
      'Pide block de concreto de 6" puesto en tu obra.',
      `Atendemos ${ZONA}. Nos mandas la cantidad de piezas y el lugar de entrega, y te respondemos con la propuesta.`,
    ],
    incluye: {
      titulo: 'Materiales',
      items: ['Block de concreto de 6"'],
    },
    usos: ['Muros y bardas', 'Vivienda', 'Bodegas y locales', 'Obra industrial y comercial'],
    faqs: [
      {
        pregunta: '¿Cómo pido block?',
        respuesta: 'Envías tu solicitud con la cantidad de piezas, el lugar de entrega y la fecha. Te respondemos con la propuesta.',
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
    resumen: 'Riego de impregnación y carpeta asfáltica',
    eyebrow: 'Soluciones asfálticas',
    h1: 'Riego de impregnación y carpeta asfáltica',
    intro: [
      'Pavimenta caminos, estacionamientos y patios de maniobra con riego de impregnación y carpeta asfáltica normal.',
      `Operamos en ${ZONA}. Nos dices los metros cuadrados y el tipo de trabajo, y coordinamos al proveedor.`,
    ],
    incluye: {
      titulo: 'Servicios de asfalto',
      items: ['Riego de impregnación', 'Carpeta asfáltica normal'],
    },
    usos: ['Estacionamientos', 'Calles y caminos internos', 'Parques industriales', 'Fraccionamientos'],
    faqs: [
      {
        pregunta: '¿Cómo se cotiza la carpeta asfáltica?',
        respuesta: 'Te cotizamos por tonelada aplicada. Te ayudamos a sacar el volumen: solo indícanos los m² de la superficie, el espesor en cm y el lugar de aplicación o la obra.',
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
