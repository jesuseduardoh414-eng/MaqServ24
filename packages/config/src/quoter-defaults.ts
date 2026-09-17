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
import type { CatalogoMaquinaria, CatalogoTriturados, EmpresaCotizador, FirmaCotizador } from './quoter';

/** Contacto publicado del sitio. Se puede sobrescribir desde el panel. */
const EMPRESA: EmpresaCotizador = {
  nombre: 'MAQSER24',
  rfc: '',
  direccion: '',
  telefono: '833 224 56 78',
  correo: 'info@maqserv24.com',
  web: 'maqserv24.com',
};

/** Quién firma. Sin nombre, el documento omite el bloque en vez de inventarlo. */
const FIRMA: FirmaCotizador = {
  nombre: '',
  puesto: 'Gerencia de Operaciones',
  telefono: '833 224 56 78',
};

/** Área de cobertura declarada en el sitio: Monterrey y zona metropolitana. */
const MUNICIPIOS = [
  'Monterrey', 'Apodaca', 'San Nicolás', 'Guadalupe', 'Santa Catarina', 'San Pedro',
  'Escobedo', 'García', 'Juárez', 'El Carmen', 'Salinas Victoria', 'Ciénega de Flores',
  'Pesquería', 'Zuazua', 'Marín', 'Abasolo', 'Hidalgo', 'Mina',
];

export const CATALOGO_MAQUINARIA_DEFAULT: CatalogoMaquinaria = {
  tipo: 'maquinaria',
  version: '2026-09-17',
  moneda: 'MXN',
  iva: 0.16,
  jornada_horas: 8,
  empresa: EMPRESA,
  firma: FIRMA,
  publico: { habilitado: true, mostrarPrecios: true },
  saludo:
    'Por medio de la presente, y aprovechando para enviarle un cordial saludo, ponemos a su consideración la siguiente cotización de renta de maquinaria para su proyecto.',
  tiers: [
    { id: 'dia', label: 'Tarifa día', desde_dias: 1, hasta_dias: 5 },
    { id: 'semana', label: 'Tarifa semana', desde_dias: 6, hasta_dias: 15 },
    { id: 'mes', label: 'Tarifa mes', desde_dias: 16, hasta_dias: null },
  ],
  municipios: MUNICIPIOS,
  fletes: {
    Retroexcavadora: 6000,
    Excavadora: 25000,
    Motoconformadora: 15000,
    Vibrocompactador: 10000,
  },
  equipos: [
    { id: 'retro_cuch', nombre: 'Retroexcavadora c/ cucharón', icono: 'retro', flete_tipo: 'Retroexcavadora', tarifas: { dia: 6500, semana: 6000, mes: 5600 } },
    { id: 'retro_mart', nombre: 'Retroexcavadora c/ martillo', icono: 'retro_mart', flete_tipo: 'Retroexcavadora', tarifas: { dia: 7500, semana: 6800, mes: 6400 } },
    { id: 'exc_cuch', nombre: 'Excavadora 20 t c/ cucharón', icono: 'excavadora', flete_tipo: 'Excavadora', tarifas: { dia: 13200, semana: 12800, mes: 12400 } },
    { id: 'exc_mart', nombre: 'Excavadora 20 t c/ martillo', icono: 'martillo_exc', flete_tipo: 'Excavadora', tarifas: { dia: 15600, semana: 15200, mes: 14800 } },
    { id: 'moto', nombre: 'Motoconformadora', icono: 'moto', flete_tipo: 'Motoconformadora', tarifas: { dia: 13200, semana: 12800, mes: 12400 } },
    { id: 'vibro', nombre: 'Vibrocompactador 10 t', icono: 'vibro', flete_tipo: 'Vibrocompactador', tarifas: { dia: 6400, semana: 6000, mes: 5600 } },
  ],
  servicios: [
    { id: 'pipa', nombre: 'Pipa de agua 10 m³', icono: 'pipa', unidad: 'viaje', precio: 3000, presets: [3000], cond: 'pipa' },
    { id: 'agua', nombre: 'Entrega de agua 20 m³', icono: 'agua', unidad: 'viaje', precio: 5000, presets: [5000], cond: 'pipa' },
    { id: 'retiro', nombre: 'Retiro de material 14 m³', icono: 'retiro', unidad: 'viaje', precio: 3500, presets: [2000, 2500, 3000, 3500, 4000, 4500], cond: 'retiro' },
    { id: 'retiro_28', nombre: 'Retiro de material 28 m³', icono: 'retiro', unidad: 'viaje', precio: 5000, presets: [3000, 4000, 5000, 6000, 7000, 8000], cond: 'retiro' },
  ],
  condiciones: {
    renta: {
      titulo: 'Condiciones comerciales · Renta de maquinaria',
      puntos: [
        'El costo de la renta del equipo es por jornada de 8 hrs de trabajo.',
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
      ],
    },
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
  publico: { habilitado: true, mostrarPrecios: true },
  saludo:
    'Por medio de la presente ponemos a su consideración la cotización correspondiente a los materiales solicitados. Agradecemos la oportunidad de participar en su requerimiento y quedamos a sus órdenes para cualquier aclaración.',
  municipios: MUNICIPIOS,
  vehiculos: ['Volteo 20 a 22 ton', 'Tolva 48 a 50 ton'],
  productos: [
    { id: 'grava2_mix_a4', nombre: 'Grava 2 / mixto / arena 4', precio_ton: 280 },
    { id: 'arena5', nombre: 'Arena #5', precio_ton: 345 },
    { id: 'arena4b', nombre: 'Arena #4B', precio_ton: 290 },
    { id: 'cnc', nombre: 'CNC', precio_ton: 125 },
    { id: 'base', nombre: 'Base', precio_ton: 260 },
    { id: 'subbase', nombre: 'Sub base', precio_ton: 255 },
    { id: 'sello38', nombre: 'Sello 3/8"', precio_ton: 300 },
    { id: 'piedra', nombre: 'Piedra 3" a 12"', precio_ton: 310 },
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
  ton_por_viaje: 20,
  zonas: [
    { id: 'z1', nombre: '15–20 km · cerca de pedreras', flete: 2400 },
    { id: 'z2', nombre: '20–25 km · Escobedo, El Carmen', flete: 2900 },
    { id: 'z3', nombre: '25–30 km · San Nicolás, García', flete: 3400 },
    { id: 'z4', nombre: '35–40 km · Santa Catarina, Apodaca, Hidalgo', flete: 3900 },
    { id: 'z5', nombre: '40–45 km · Salinas Victoria, San Pedro, Ciénega, Mty centro, Zuazua', flete: 4400 },
    { id: 'z6', nombre: '50–55 km · Carr. Nacional, Estanzuela, Guadalupe, Icamole, Mina', flete: 4900 },
    { id: 'z7', nombre: '55–60 km · Pesquería, Juárez, Salinas, Marín, San Mateo', flete: 5400 },
  ],
  condiciones: {
    general: {
      titulo: 'Condiciones comerciales',
      puntos: [
        'Pago en efectivo de contado.',
        'Se paga al entregar el material en su obra.',
      ],
    },
    material: {
      titulo: 'Suministro por tonelada',
      puntos: [
        'El costo del material es cargado en planta.',
        'El flete se cotiza por tonelada según el área de entrega.',
        'Entregas en volteos de 20 a 22 ton o tolvas de 48 a 50 ton.',
      ],
    },
    zona: {
      titulo: 'Entrega por zona',
      puntos: [
        'Precios por viaje en volteo de 14 m³ (20 ton), puestos en obra.',
        'Los costos ya incluyen suministro y flete a su obra.',
      ],
    },
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
