/**
 * CATÁLOGOS DE ARRANQUE de los dos cotizadores.
 *
 * Son el punto de partida, no la verdad: en cuanto existe la fila de
 * `quoter_catalogs` manda la base de datos y esto no se vuelve a leer. Sirve
 * para tres cosas: sembrar la tabla la primera vez, que el panel tenga un
 * "restaurar valores de fábrica", y que el sitio no se caiga si la fila se
 * borra por accidente.
 *
 * DE DÓNDE SALEN LOS NÚMEROS: del sistema que el cliente ya operaba por fuera
 * (dos apps en Python). Las tarifas, fletes, zonas y condiciones se trasladaron
 * TAL CUAL —cambiarlas no era el encargo— y lo que sí se reemplazó fue la
 * identidad: razón social, firma y textos ahora son de MAQSER24.
 *
 * Los datos fiscales van VACÍOS a propósito. El RFC y el domicilio no estaban
 * en ningún sitio de la plataforma y son lo que un documento de cotización
 * convierte en compromiso: se llenan desde Cotizador → Tarifas, y mientras
 * estén vacíos el documento simplemente no imprime esa línea.
 */
import type { CatalogoMaquinaria, CatalogoTriturados, EmpresaCotizador, FirmaCotizador, PagoCotizador, ZonaPrecio } from './quoter';

/** Contacto publicado del sitio. Se puede sobrescribir desde el panel. */
const EMPRESA: EmpresaCotizador = {
  nombre: 'MAQSER24',
  rfc: '',
  direccion: '',
  telefono: '+52 1 81 4021 3277',
  correo: 'info@maqser24.com',
  web: 'maqser24.com',
};

/**
 * Datos para el pago (2026-10-30, pedido del dueño, tal cual su tarjeta de
 * datos bancarios): salen en todo documento con precio. Se editan en Tarifas.
 */
export const PAGO_DE_FABRICA: PagoCotizador = {
  titular: 'PUCSA Maquinaria S.A. de C.V.',
  rfc: 'PMA-240110-QQ0',
  cuentas: [
    { banco: 'Banco del Bajío', cuenta: '48-756-4310-201', clabe: '030580900045649333' },
    { banco: 'Mercado Pago', cuenta: '', clabe: '722969016340010529' },
  ],
  nota: 'Link de pagos disponible. Pregunta por promociones a meses sin intereses (aplican restricciones).',
  telefono: '811 280 0244',
  correo: 'pagos@pucsa-maquinaria.com',
};

/** Quién firma. Sin nombre, el documento omite el bloque en vez de inventarlo. */
const FIRMA: FirmaCotizador = {
  nombre: '',
  puesto: 'Gerencia de Operaciones',
  telefono: '+52 1 81 4021 3277',
};

/** Área de cobertura declarada en el sitio: Monterrey y zona metropolitana. */
const MUNICIPIOS = [
  'Monterrey', 'Apodaca', 'San Nicolás', 'Guadalupe', 'Santa Catarina', 'San Pedro',
  'Escobedo', 'García', 'Juárez', 'El Carmen', 'Salinas Victoria', 'Ciénega de Flores',
  'Pesquería', 'Zuazua', 'Marín', 'Abasolo', 'Hidalgo', 'Mina',
];

/**
 * TRES ESTADOS DEL NORTE (decisión del cliente, 2026-09-28): la operación se
 * extiende a Nuevo León, Coahuila y Chihuahua. Los de Nuevo León van sin
 * sufijo (como siempre); los de los otros dos llevan el estado para no
 * confundir nombres repetidos ("Juárez" de N.L. y "Juárez, Chih.").
 *
 * PENDIENTE DEL CLIENTE: si las tarifas son las mismas en los tres estados o
 * cada uno tiene su tabla. Hoy el municipio NO cambia el precio: solo sale en
 * el documento. Ver la nota en Cotizador → Tarifas y condiciones.
 */
export const MUNICIPIOS_NORTE: readonly string[] = [
  ...MUNICIPIOS,
  'Cadereyta Jiménez', 'Santiago', 'Montemorelos', 'Linares', 'Sabinas Hidalgo',
  'Saltillo, Coah.', 'Ramos Arizpe, Coah.', 'Arteaga, Coah.', 'General Cepeda, Coah.', 'Parras, Coah.',
  'Torreón, Coah.', 'Matamoros, Coah.', 'Francisco I. Madero, Coah.', 'San Pedro, Coah.', 'Viesca, Coah.',
  'Monclova, Coah.', 'Frontera, Coah.', 'Castaños, Coah.', 'San Buenaventura, Coah.', 'Sabinas, Coah.',
  'Múzquiz, Coah.', 'Nava, Coah.', 'Piedras Negras, Coah.', 'Acuña, Coah.', 'Allende, Coah.',
  'Zaragoza, Coah.', 'Cuatro Ciénegas, Coah.',
  'Chihuahua, Chih.', 'Juárez, Chih.', 'Cuauhtémoc, Chih.', 'Delicias, Chih.', 'Hidalgo del Parral, Chih.',
  'Nuevo Casas Grandes, Chih.', 'Camargo, Chih.', 'Jiménez, Chih.', 'Meoqui, Chih.', 'Aldama, Chih.',
  'Ojinaga, Chih.', 'Saucillo, Chih.', 'Guachochi, Chih.', 'Madera, Chih.', 'Ascensión, Chih.',
];

/** Los estados donde opera MAQSER24 (2026-09-28). */
export const ESTADOS_OPERACION = ['Nuevo León', 'Coahuila', 'Chihuahua'] as const;

/**
 * Lo que el SITIO PÚBLICO dice que cubre (2026-10-05): hoy, todo Nuevo León.
 * Coahuila y Chihuahua siguen en `ESTADOS_OPERACION` (alta de aliados,
 * municipios del cotizador) pero no se anuncian hasta que el cliente active el
 * norte. Para anunciarlos, se agregan aquí y en el texto `ZONA` de landings.ts.
 */
export const ESTADOS_COBERTURA = ['Nuevo León'] as const;

/**
 * LA CAL DE PATIO (2026-11-06), con el texto que mandó el dueño: «Pedido mínimo.
 * En la cal las tolvas vienen entre 25 y 32 toneladas. Se pide el pago de 28
 * toneladas para hacer la programación. Se tarda máximo 48 horas después del
 * pago. Ya cuando llegue se realiza ajuste, para arriba o para abajo.»
 */
export const CONDICIONES_CAL = {
  titulo: 'Cal de patio · puesta en obra',
  puntos: [
    'Precio por tonelada ya puesta en obra, en el área metropolitana de Monterrey.',
    'Pedido mínimo: en la cal, las tolvas vienen entre 25 y 32 toneladas.',
    'Se pide el pago de 28 toneladas para hacer la programación.',
    'Se tarda máximo 48 horas después del pago.',
    'Ya cuando llegue se realiza el ajuste, para arriba o para abajo.',
  ],
};

/**
 * CONDICIONES DE LAS LÍNEAS QUE ENTRARON AL COTIZADOR (2026-11-02): carpeta
 * asfáltica, materiales y venta de maquinaria. Son un punto de partida, sin
 * reglas inventadas: Dirección las ajusta en Tarifas › Condiciones. Las usa el
 * renglón nuevo de cada ficha de esas líneas (`COND_DE_LINEA`).
 */
export const CONDICIONES_POR_LINEA: CatalogoMaquinaria['condiciones'] = {
  asfalto: {
    titulo: 'Condiciones comerciales · Carpeta asfáltica',
    puntos: [
      'La carpeta asfáltica se cobra por tonelada y el riego de impregnación por litro. Las cantidades se calculan con los m² de la superficie y el espesor en cm.',
      'La superficie debe estar lista para recibir el trabajo: base compactada, limpia y seca.',
      'Forma de pago: contado.',
      'Cualquier cambio en el área, el espesor o las condiciones de la obra puede ajustar el costo; se avisa antes.',
    ],
  },
  materiales: {
    titulo: 'Condiciones comerciales · Materiales para construcción',
    puntos: [
      'El precio es por la unidad indicada en la cotización.',
      'Sujeto a disponibilidad al confirmar el pedido.',
      'Forma de pago: contado.',
      'Cualquier cambio en cantidades o lugar de entrega puede ajustar el costo; se avisa antes.',
    ],
  },
  venta: {
    titulo: 'Condiciones comerciales · Venta de maquinaria',
    puntos: [
      'El precio es por equipo y está sujeto a disponibilidad al confirmar la compra.',
      'El equipo lo vende un proveedor de la red de MAQSER24; la entrega y la garantía se confirman con la propuesta.',
      'Forma de pago: contado, al confirmar la compra.',
    ],
  },
};

/**
 * LAS DOS ZONAS DE LOS SERVICIOS POR VIAJE (Dirección, 2026-10-29): el agua y
 * el retiro de material se cobran según la zona de la obra. Guadalupe va en la
 * 2 y Santiago completo también (por la Carretera Nacional). En los demás
 * municipios no se ofrecen.
 */
export const ZONAS_PRECIO: ZonaPrecio[] = [
  { id: 'z1', nombre: 'Zona 1', municipios: ['Escobedo', 'El Carmen', 'Apodaca', 'San Nicolás', 'Salinas Victoria', 'Ciénega de Flores', 'Hidalgo'] },
  { id: 'z2', nombre: 'Zona 2', municipios: ['Monterrey', 'García', 'San Pedro', 'Juárez', 'Santa Catarina', 'Guadalupe', 'Santiago'] },
];

export const CATALOGO_MAQUINARIA_DEFAULT: CatalogoMaquinaria = {
  tipo: 'maquinaria',
  version: '2026-09-17',
  moneda: 'MXN',
  iva: 0.16,
  jornada_horas: 8,
  // Cobro por hora con mínimo de una jornada (2026-10-29); el flete ida y vuelta vuelve el 2026-11-03.
  minimo_horas: 8,
  cobrar_flete: true,
  zonas_precio: ZONAS_PRECIO,
  empresa: EMPRESA,
  firma: FIRMA,
  pago: PAGO_DE_FABRICA,
  // El sitio enseña los precios de lista (2026-10-29); se apaga en Tarifas.
  publico: { habilitado: true, mostrarPrecios: true },
  saludo:
    'Por medio de la presente, y aprovechando para enviarle un cordial saludo, ponemos a su consideración la siguiente cotización de renta de maquinaria para su proyecto.',
  municipios: MUNICIPIOS,
  fletes: {
    // Ida y vuelta, por equipo (lista del dueño, 2026-11-03).
    Retroexcavadora: 6500,
    Excavadora: 30000,
    Motoconformadora: 16000,
    Vibrocompactador: 12500,
    Minicargador: 6000,
  },
  equipos: [
    { id: 'retro_cuch', nombre: 'Retroexcavadora c/ cucharón', icono: 'retro', flete_tipo: 'Retroexcavadora', precio_hora: 850 },
    { id: 'retro_mart', nombre: 'Retroexcavadora c/ martillo', icono: 'retro_mart', flete_tipo: 'Retroexcavadora', precio_hora: 950 },
    { id: 'exc_cuch', nombre: 'Excavadora 20 t c/ cucharón', icono: 'excavadora', flete_tipo: 'Excavadora', precio_hora: 1750 },
    { id: 'exc_mart', nombre: 'Excavadora 20 t c/ martillo', icono: 'martillo_exc', flete_tipo: 'Excavadora', precio_hora: 2150 },
    { id: 'moto', nombre: 'Motoconformadora', icono: 'moto', flete_tipo: 'Motoconformadora', precio_hora: 1750 },
    { id: 'vibro', nombre: 'Vibrocompactador 10 t', icono: 'vibro', flete_tipo: 'Vibrocompactador', precio_hora: 850 },
    { id: 'bobcat_cuch', nombre: 'Bob Cat c/ pala frontal', icono: 'minicargador', flete_tipo: 'Minicargador', precio_hora: 650 },
    { id: 'bobcat_adit', nombre: 'Bob Cat c/ aditamento (mano de chango o martillo)', icono: 'minicargador', flete_tipo: 'Minicargador', precio_hora: 750 },
  ],
  servicios: [
    { id: 'pipa', nombre: 'Pipa de agua 10 m³', icono: 'pipa', unidad: 'viaje', precio: 3500, presets: [3500], cond: 'pipa', linea: 'transporte-y-servicios-de-obra', precios_zona: { z1: 3500, z2: 3500 } },
    { id: 'agua', nombre: 'Pipa de agua 20 m³', icono: 'agua', unidad: 'viaje', precio: 6000, presets: [6000], cond: 'pipa', linea: 'transporte-y-servicios-de-obra', precios_zona: { z1: 6000, z2: 6000 } },
    { id: 'retiro', nombre: 'Retiro de material 14 m³', icono: 'retiro', unidad: 'viaje', precio: 4500, presets: [4500], cond: 'retiro', linea: 'transporte-y-servicios-de-obra', precios_zona: { z1: 4500, z2: 5500 } },
    // Sin servicio hasta nuevo aviso (2026-10-29): conserva su precio para cuando vuelva.
    { id: 'retiro_28', nombre: 'Retiro de material 28 m³', icono: 'retiro', unidad: 'viaje', precio: 5000, presets: [3000, 4000, 5000, 6000, 7000, 8000], cond: 'retiro', linea: 'transporte-y-servicios-de-obra', oculto: true },
  ],
  condiciones: {
    renta: {
      titulo: 'Condiciones comerciales · Renta de maquinaria',
      puntos: [
        'Los costos incluyen operación y diésel.',
        'El operador cuenta con DC3.',
        'El costo de la renta incluye el IMSS del operador y el seguro del equipo.',
        'Hora extra de operador: $200 / hra adicional al costo de la renta del equipo.',
        'Capacitación para acceso a planta (llevar al operador un día antes): $1,500 el día.',
        'Análisis clínicos del operador presentándose en clínica: $1,500 el día.',
        'El equipo cuenta con bitácora de mantenimiento.',
        'Se solicita el pago adelantado de la renta y sus fletes; se paga al recibir los equipos en obra.',
      ],
    },
    retiro: {
      titulo: 'Condiciones comerciales · Retiro de material de escombro',
      puntos: [
        'Forma de pago: todos los servicios se realizan únicamente con pago de contado.',
        'Cotización: los costos presentados corresponden al servicio cotizado y pueden ser para camiones de 14 m³ o 28 m³, según se especifique en la propuesta.',
        'Material: la presente cotización aplica para retiro de material de escombro. En caso de que el material corresponda a basura o residuos no considerados como escombro, el costo del servicio será ajustado de acuerdo con el tipo de material y el sitio de disposición final.',
        'Viaje a tiro libre: los precios presentados corresponden al servicio de viaje a tiro libre, conforme a las condiciones establecidas en la cotización.',
        'Cambios en el servicio: cualquier modificación en el tipo de material, volumen, destino o condiciones de carga podrá generar un ajuste en el costo previamente cotizado.',
      ],
    },
    pipa: {
      titulo: 'Condiciones comerciales · Servicio de pipa',
      puntos: [
        'El precio presentado corresponde a un viaje de pipa con capacidad de 10 m³ o 20 m³, según lo indicado en la cotización. En caso de cotizar una capacidad diferente, el precio aplicará únicamente para el volumen especificado.',
        'El tiempo considerado para la descarga es de 45 minutos por viaje. Una vez excedido este tiempo, se cobrará hora extra conforme a la tarifa vigente.',
        'Forma de pago: contado.',
        'La unidad cuenta con una manguera de 15 a 20 metros. Si el servicio requiere una longitud mayor, se generará un cargo adicional, el cual será cotizado previamente.',
        'La unidad cuenta con póliza de seguro vigente y el operador dispone de la documentación y acreditaciones correspondientes.',
        'Los precios presentados corresponden únicamente al servicio descrito en la cotización. Cualquier cambio en el alcance, tiempos de espera, ubicación o condiciones de operación podrá generar costos adicionales, los cuales serán notificados previamente al cliente.',
        // 2026-11-03: un solo precio en el área metropolitana.
        'Precio por viaje dentro del área metropolitana de Monterrey.',
        'Para pedidos especiales de cantidades mayores, solicite costos especiales.',
      ],
    },
    ...CONDICIONES_POR_LINEA,
  },
};

export const CATALOGO_TRITURADOS_DEFAULT: CatalogoTriturados = {
  tipo: 'triturados',
  version: '2026-09-17',
  moneda: 'MXN',
  iva: 0.16,
  iva_por_defecto: true,
  empresa: EMPRESA,
  firma: FIRMA,
  pago: PAGO_DE_FABRICA,
  // El sitio enseña los precios de lista (2026-10-29); se apaga en Tarifas.
  publico: { habilitado: true, mostrarPrecios: true },
  saludo:
    'Por medio de la presente ponemos a su consideración la cotización correspondiente a los materiales solicitados. Agradecemos la oportunidad de participar en su requerimiento y quedamos a sus órdenes para cualquier aclaración.',
  municipios: MUNICIPIOS,
  vehiculos: ['Volteo 14 m³ (20 ton)', 'Tolva 30 m³ (50 ton)', 'Full (90 ton)'],
  // Por tonelada cargado en planta, sin IVA ni flete (lista del dueño, 2026-11-03).
  productos: [
    { id: 'arena4', nombre: 'Arena #4', precio_ton: 300 },
    { id: 'arena5', nombre: 'Arena #5', precio_ton: 355 },
    { id: 'grava1', nombre: 'Grava 1', precio_ton: 300 },
    { id: 'grava2', nombre: 'Grava 2', precio_ton: 300 },
    { id: 'base', nombre: 'Base hidráulica 1½" a finos', precio_ton: 270 },
    { id: 'subbase', nombre: 'Sub base hidráulica', precio_ton: 265 },
    { id: 'cnc', nombre: 'CNC', precio_ton: 150 },
    { id: 'sello38', nombre: 'Sello 3/8"', precio_ton: 310 },
    { id: 'piedra', nombre: 'Piedra 3" a 12"', precio_ton: 320 },
    // 2026-10-30: mismo precio que la Arena #4.
    { id: 'mixtos', nombre: 'Mixtos', precio_ton: 300 },
    { id: 'arena4b', nombre: 'Arena #4B', precio_ton: 300 },
    // 2026-11-06: ya puesta en obra (área metropolitana de Monterrey), se pagan 28 ton para programar la tolva.
    { id: 'cal_patio', nombre: 'Cal de patio', precio_ton: 1650, en_obra: true, minimo_ton: 28 },
  ],
  fletes_ton: [50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300],
  material_banco: {
    nombre: 'Material de banco',
    unidad: 'M3',
    precio_m3_default: 200,
    camion_m3: 14,
  },
  unidad_zona: 'VIAJE',
  nota_zona: 'Volteo 14 m³ (20 ton), puesto en obra',
  // El viaje puesto en obra = precio por tonelada × 22 + flete de la zona (2026-11-03,
  // "Arena 4 a San Nicolás: $300 × 22 + $3,250 = $9,850"). El flete solo es referencia: no se le enseña al cliente.
  ton_por_viaje: 22,
  zonas: [
    { id: 'z1', nombre: 'Zona 1 · Cerca de pedrera Escobedo', flete: 2500 },
    { id: 'z2', nombre: 'Zona 2 · Escobedo, El Carmen, García', flete: 3000 },
    { id: 'z3', nombre: 'Zona 3 · San Nicolás, Hidalgo', flete: 3250 },
    { id: 'z4', nombre: 'Zona 4 · Apodaca, Santa Catarina', flete: 3500 },
    { id: 'z5', nombre: 'Zona 5 · Salinas Victoria, Ciénega de Flores, Zuazua, Monterrey centro', flete: 4000 },
    { id: 'z6', nombre: 'Zona 6 · San Pedro, zona aeropuerto-OMA', flete: 4500 },
    { id: 'z7', nombre: 'Zona 7 · Carretera Nacional, Estanzuela, Icamole, Mina, Guadalupe', flete: 5000 },
    { id: 'z8', nombre: 'Zona 8 · Pesquería, Juárez, Marín, Cadereyta, San Mateo, Santiago', flete: 5500 },
  ],
  condiciones: {
    general: {
      titulo: 'Condiciones comerciales',
      // 2026-10-30: con tarjetas de crédito y sin "se paga al entregar en su obra".
      puntos: [
        'Pago en efectivo de contado.',
        'Aceptamos tarjetas de crédito.',
      ],
    },
    material: {
      titulo: 'Suministro por tonelada',
      puntos: [
        'Costos de solo suministro, cargado en planta (pedreras Escobedo), si usted envía su volteo de 14 m³ (20 ton), tolva de 30 m³ (50 ton) o full (90 ton).',
        'Si requiere entrega en obra se suma el flete: envíe la ubicación de su obra en Google Maps para cotizarle el costo del flete por tonelada.',
      ],
    },
    zona: {
      titulo: 'Entrega por zona',
      puntos: [
        'Precios por viaje en volteo de 14 m³ (20 ton), puestos en obra.',
        'Los costos ya incluyen suministro y flete a su obra.',
      ],
    },
    // La cal de patio (2026-11-06, el texto del dueño).
    cal: CONDICIONES_CAL,
    banco: {
      titulo: 'Material de banco',
      puntos: [
        'El material de banco se cotiza por m³ (no se pesa); se entrega en camión de 14 m³.',
        'El precio por m³ incluye el material y el flete, puesto en obra.',
        'El costo del material lo valida el cliente.',
      ],
    },
  },
};

export const CATALOGOS_DEFAULT = {
  maquinaria: CATALOGO_MAQUINARIA_DEFAULT,
  triturados: CATALOGO_TRITURADOS_DEFAULT,
} as const;
