/**
 * COTIZADORES INTERNOS (maquinaria y triturados).
 *
 * Vienen de dos apps sueltas en Python (FastAPI + SQLite) que el cliente ya
 * usaba por fuera de la plataforma. Aquí quedan unificadas: mismo catálogo
 * versionado, mismo motor de cálculo y la identidad de MAQSER24.
 *
 * TRES DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. EL MOTOR ES UNO SOLO Y VIVE AQUÍ. Las apps originales tenían el cálculo
 *    DUPLICADO —Python para la verdad, JavaScript para la vista previa— y ya
 *    habían divergido (el JS no aplicaba el tope de horas de la jornada). Al
 *    estar en `@maqserv/config`, la API, el panel y el sitio público ejecutan
 *    literalmente las mismas líneas: la vista previa no puede mentir.
 *
 * 2. LA TARIFA NUNCA VIENE DEL NAVEGADOR. El cliente manda QUÉ eligió (ids,
 *    días, toneladas); el precio sale siempre del catálogo guardado en la BD.
 *    Lo único que se puede sobrescribir es lo que el negocio permite negociar:
 *    costo/hora de un equipo y precio del material — y va marcado.
 *
 * 3. EL CATÁLOGO ES DATO, NO CÓDIGO. Los objetos de `quoter-defaults` son solo
 *    el punto de partida: la fila de `quoter_catalogs` manda, y se edita desde
 *    el panel. Cambiar una tarifa no debe requerir un despliegue.
 */
import { z } from 'zod';
import { normalizarNombre } from './cobertura';

/** Los dos cotizadores. El resto del módulo se ramifica por esta clave. */
export const COTIZADOR_TIPOS = ['maquinaria', 'triturados'] as const;
export type CotizadorTipo = (typeof COTIZADOR_TIPOS)[number];

/**
 * Los cotizadores que se OFRECEN hoy (2026-10-08). Un cotizador fuera de esta
 * lista se queda en el código pero ninguna pantalla lo enseña; para
 * reactivarlo basta con agregarlo aquí y encender su tabulador. Triturados se
 * apagó y volvió el mismo día, con su nueva lista de materiales.
 */
export const COTIZADORES_ACTIVOS: readonly CotizadorTipo[] = ['maquinaria', 'triturados'];

export function esCotizadorTipo(v: unknown): v is CotizadorTipo {
  return typeof v === 'string' && (COTIZADOR_TIPOS as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// Esquemas (zod) — la API valida con esto lo que llega del panel y del sitio.
// ---------------------------------------------------------------------------

const empresaSchema = z.object({
  nombre: z.string().max(190),
  rfc: z.string().max(40),
  direccion: z.string().max(300),
  telefono: z.string().max(60),
  correo: z.string().max(190),
  web: z.string().max(190),
});

const firmaSchema = z.object({
  nombre: z.string().max(190),
  puesto: z.string().max(120),
  telefono: z.string().max(60),
});

const bloqueSchema = z.object({
  titulo: z.string().max(190),
  puntos: z.array(z.string().max(1200)).max(30),
});

/**
 * Qué se ve del cotizador FUERA del panel.
 *
 * `habilitado`: si el cotizador existe en el sitio público.
 *
 * `mostrarPrecios` ya no se lee (2026-10-23): el sitio NUNCA enseña precios.
 * El visitante arma su requerimiento y lo envía; el precio lo revisa una
 * persona en Solicitudes y se lo manda para que lo acepte. El campo se queda
 * para que los tabuladores guardados sigan pasando la validación.
 */
const publicoSchema = z.object({
  habilitado: z.boolean(),
  mostrarPrecios: z.boolean(),
});

/**
 * DE QUÉ PROVEEDOR ES ESTA PARTIDA.
 *
 * El tabulador nació como una lista de precios sin dueño: MAQSER24 cotizaba y
 * ya. Pero quien atiende la renta es el proveedor que publica la máquina, y
 * sin este campo una solicitud del sitio no tenía a quién avisarle — llegaba
 * al panel y ahí se quedaba hasta que una persona la viera.
 *
 * Es `id` de la tabla `providers`, no un correo: el proveedor cambia su
 * correo desde su portal (/aliado) y el aviso tiene que seguirlo sin que nadie
 * toque el tabulador.
 *
 * Opcional y nulable A PROPÓSITO: los catálogos que ya existen no lo traen, y
 * una partida sin dueño tiene que seguir cotizándose igual — simplemente su
 * aviso se queda en el interno.
 */
const proveedorDe = () => z.number().int().positive().nullable().optional();

/**
 * QUÉ PRODUCTOS DEL CATÁLOGO CUENTAN COMO ESTE RENGLÓN (2026-09-24).
 *
 * El tabulador y el catálogo eran dos listas sueltas: "Excavadora 20 t c/
 * cucharón" del cotizador no era el producto "Excavadora 20 t" de nadie, y al
 * dueño había que capturarlo dos veces. Ahora el renglón apunta a productos
 * (ids de `products`) y el proveedor sale de quién los tiene publicados.
 * `proveedor_id` se queda como respaldo para los tabuladores viejos.
 */
const productosDe = () => z.array(z.number().int().positive()).max(60).optional();
/**
 * "Sale en el cotizador" apagado desde la ficha del tipo (2026-10-19): el
 * renglón conserva su precio pero no se ofrece al cotizar. También se marca
 * solo, al leer el tabulador, cuando su ficha se da de baja.
 */
const ocultoDe = () => z.boolean().optional();

/** Los tramos día/semana/mes del cobro por día. Desde 2026-10-29 no se usan; se aceptan para leer tabuladores viejos. */
const tierSchema = z.object({
  id: z.string().max(30),
  label: z.string().max(60),
  desde_dias: z.number().int().min(1),
  hasta_dias: z.number().int().min(1).nullable(),
});

const equipoSchema = z.object({
  id: z.string().min(1).max(40),
  nombre: z.string().min(1).max(120),
  icono: z.string().max(40),
  flete_tipo: z.string().min(1).max(60),
  proveedor_id: proveedorDe(),
  productos: productosDe(),
  /**
   * PRECIO POR HORA (2026-10-29): "todos esos costos son por hora, así es
   * como se cobra cada uno". Uno solo, rente 1 día o 30: sin descuentos.
   */
  precio_hora: z.number().min(0).optional(),
  /** El cobro de antes: tarifa por día en cada tramo. Solo se lee si falta `precio_hora`. */
  tarifas: z.object({ dia: z.number().min(0), semana: z.number().min(0), mes: z.number().min(0) }).optional(),
  oculto: ocultoDe(),
});

const servicioSchema = z.object({
  id: z.string().min(1).max(40),
  nombre: z.string().min(1).max(120),
  icono: z.string().max(40),
  unidad: z.string().max(20),
  precio: z.number().min(0),
  presets: z.array(z.number().min(0)).max(20),
  cond: z.string().max(40),
  proveedor_id: proveedorDe(),
  productos: productosDe(),
  /**
   * Línea de servicio (slug de `categories`). Pipa y retiro viven en el
   * cotizador de maquinaria pero son de "transporte y servicios de obra":
   * sin esto la solicitud se registraba como maquinaria y se le ofrecía a
   * quien no le tocaba.
   */
  linea: z.string().max(80).optional(),
  /**
   * PRECIO POR ZONA (2026-10-29, el agua): id de zona (`zonas_precio`) →
   * precio por viaje. Con esto el servicio solo se ofrece en los municipios
   * de esas zonas y `precio` queda como el de referencia.
   */
  precios_zona: z.record(z.string(), z.number().min(0)).optional(),
  oculto: ocultoDe(),
});

/** Una zona de precio de los servicios por viaje: su nombre y los municipios que entran. */
const zonaPrecioSchema = z.object({
  id: z.string().min(1).max(40),
  nombre: z.string().min(1).max(80),
  municipios: z.array(z.string().max(80)).max(200),
});

/**
 * DATOS PARA EL PAGO (2026-10-30, pedido del dueño): a nombre de quién va el
 * depósito y a qué cuentas. Salen en todo documento que lleva precio (nunca en
 * los que van sin importes, como el del aliado). Se editan en Tarifas ›
 * Documento. Sin el campo o sin cuentas, el documento no lleva la sección.
 */
const cuentaPagoSchema = z.object({
  banco: z.string().max(80),
  cuenta: z.string().max(40).default(''),
  clabe: z.string().max(40).default(''),
});
export const pagoSchema = z.object({
  titular: z.string().max(160).default(''),
  rfc: z.string().max(20).default(''),
  cuentas: z.array(cuentaPagoSchema).max(6).default([]),
  /** Lo que acompaña: link de pagos, meses sin intereses… */
  nota: z.string().max(400).default(''),
  telefono: z.string().max(40).default(''),
  correo: z.string().max(160).default(''),
});

export const catalogoMaquinariaSchema = z.object({
  tipo: z.literal('maquinaria'),
  version: z.string().max(40),
  moneda: z.string().max(10),
  iva: z.number().min(0).max(1),
  /** Horas de un día de renta: los días que pide el cliente se cobran como días × jornada. */
  jornada_horas: z.number().int().min(1).max(24),
  /** Horas que se cobran como mínimo por equipo (2026-10-29: una jornada). Sin el campo, una jornada. */
  minimo_horas: z.number().int().min(0).max(240).optional(),
  /**
   * Flete a obra (2026-10-29): "quita el flete por ahora en todos, deja el
   * campo". Apagado, ninguna máquina lo cobra pero cada una conserva su tipo
   * de flete y los montos se guardan para cuando vuelva. Sin el campo, se cobra.
   */
  cobrar_flete: z.boolean().optional(),
  /** Zonas de precio de los servicios que cobran según a dónde se llevan (el agua, 2026-10-29). */
  zonas_precio: z.array(zonaPrecioSchema).max(20).optional(),
  empresa: empresaSchema,
  firma: firmaSchema,
  publico: publicoSchema,
  /** Datos para el pago (2026-10-30). */
  pago: pagoSchema.optional(),
  saludo: z.string().max(800),
  tiers: z.array(tierSchema).optional(),
  municipios: z.array(z.string().max(80)).max(400),
  fletes: z.record(z.string(), z.number().min(0)),
  equipos: z.array(equipoSchema).max(120),
  servicios: z.array(servicioSchema).max(60),
  condiciones: z.record(z.string(), bloqueSchema),
});

const productoSchema = z.object({
  id: z.string().min(1).max(40),
  nombre: z.string().min(1).max(120),
  precio_ton: z.number().min(0),
  proveedor_id: proveedorDe(),
  productos: productosDe(),
  oculto: ocultoDe(),
  /**
   * Ya puesto en obra (2026-11-06, la cal de patio): su precio por tonelada
   * incluye el flete, no se le suma ninguno, y se cotiza en su propia forma
   * («Cal de patio» en «¿Cómo lo quieres?»), no en planta, viaje ni grande.
   */
  en_obra: z.boolean().optional(),
  /** Toneladas que se cobran como mínimo (la cal: se pagan 28 para programar la tolva). */
  minimo_ton: z.number().min(0).max(1000).optional(),
});

const zonaSchema = z.object({
  id: z.string().min(1).max(40),
  nombre: z.string().min(1).max(160),
  flete: z.number().min(0),
  precios: z.record(z.string(), z.number().min(0)).optional(),
  /**
   * Municipios de la zona que su nombre no dice (2026-11-06, el dueño: "cuando
   * hagan falta municipios en triturados, poner un campo para agregarlo"). Se
   * agregan al cotizar en el enlace o el panel, o en Tarifas › Triturados; con
   * ellos la zona del flete se elige sola.
   */
  municipios: z.array(z.string().trim().min(1).max(80)).max(200).optional(),
});

/**
 * LOS CAMIONES DEL PEDIDO GRANDE (2026-11-03, pedido del dueño): "cuando son
 * pedidos de 100 toneladas se puede entregar por tolva o full". Cada uno
 * tiene su flete por tonelada en cada zona (`precios_ton`: id de zona →
 * $/ton). Sin precio en una zona, el flete se confirma aparte: el dueño los
 * manda después y se capturan en Tarifas › Triturados.
 */
const camionSchema = z.object({
  id: z.string().min(1).max(20),
  nombre: z.string().min(1).max(60),
  /** Lo que se lee junto al nombre ("48 a 50 ton"). */
  detalle: z.string().max(120),
  precios_ton: z.record(z.string(), z.number().min(0)),
});

export const catalogoTrituradosSchema = z.object({
  tipo: z.literal('triturados'),
  version: z.string().max(40),
  moneda: z.string().max(10),
  iva: z.number().min(0).max(1),
  iva_por_defecto: z.boolean(),
  empresa: empresaSchema,
  firma: firmaSchema,
  publico: publicoSchema,
  /** Datos para el pago (2026-10-30). */
  pago: pagoSchema.optional(),
  saludo: z.string().max(800),
  municipios: z.array(z.string().max(80)).max(400),
  vehiculos: z.array(z.string().max(80)).max(20),
  productos: z.array(productoSchema).max(120),
  fletes_ton: z.array(z.number().min(0)).max(40),
  material_banco: z.object({
    nombre: z.string().max(120),
    unidad: z.string().max(10),
    precio_m3_default: z.number().min(0),
    camion_m3: z.number().min(0),
    proveedor_id: proveedorDe(),
    productos: productosDe(),
  }),
  unidad_zona: z.string().max(20),
  nota_zona: z.string().max(160),
  ton_por_viaje: z.number().min(1),
  zonas: z.array(zonaSchema).max(60),
  /** Pedido grande en tolva o full (2026-11-03). Sin el campo, los de fábrica, sin precios. */
  camiones: z.array(camionSchema).max(6).optional(),
  /** Toneladas mínimas del pedido grande. Sin el campo, 100. */
  minimo_camion_ton: z.number().min(0).max(100_000).optional(),
  condiciones: z.record(z.string(), bloqueSchema),
});

export const catalogoCotizadorSchema = z.discriminatedUnion('tipo', [
  catalogoMaquinariaSchema,
  catalogoTrituradosSchema,
]);

export type CatalogoMaquinaria = z.infer<typeof catalogoMaquinariaSchema>;
export type CatalogoTriturados = z.infer<typeof catalogoTrituradosSchema>;
export type CatalogoCotizador = z.infer<typeof catalogoCotizadorSchema>;
export type EmpresaCotizador = z.infer<typeof empresaSchema>;
export type PagoCotizador = z.infer<typeof pagoSchema>;
export type FirmaCotizador = z.infer<typeof firmaSchema>;
export type BloqueCondiciones = z.infer<typeof bloqueSchema>;
export type EquipoCotizador = z.infer<typeof equipoSchema>;
export type ServicioCotizador = z.infer<typeof servicioSchema>;
export type ZonaPrecio = z.infer<typeof zonaPrecioSchema>;
export type ProductoTriturado = z.infer<typeof productoSchema>;
export type ZonaTriturado = z.infer<typeof zonaSchema>;
export type CamionTriturado = z.infer<typeof camionSchema>;

// ---------------------------------------------------------------------------
// Partidas (lo que el usuario arma)
// ---------------------------------------------------------------------------

export const partidaMaquinariaSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('equipo'),
    id: z.string().min(1).max(40),
    dias: z.number().int().min(0).max(3650).default(0),
    horas: z.number().int().min(0).max(23).default(0),
    cantidad: z.number().int().min(1).max(99).default(1),
    /** Costo/hora negociado. `null` = usar el del tabulador vigente. */
    precio_hora: z.number().min(0).max(1_000_000).nullable().optional(),
    /**
     * Flete por equipo negociado SOLO para esta cotización (2026-10-23, lápiz
     * del desglose en Solicitudes). `null` o 0 = el del tabulador.
     */
    flete: z.number().min(0).max(10_000_000).nullable().optional(),
  }),
  z.object({
    tipo: z.literal('servicio'),
    /** `custom` = escrito a mano (2026-10-30): no está en el tabulador; trae nombre, unidad y precio. */
    id: z.string().min(1).max(40),
    nombre: z.string().max(120).optional(),
    unidad: z.string().max(20).optional(),
    /**
     * Escrito a mano desde una categoría sin precio de lista (panel y enlace,
     * 2026-11-03: carpeta, block, venta): su clave del sitio. Con ella el
     * saludo del documento y la solicitud saben de qué es.
     */
    categoria: z.string().max(40).optional(),
    /** Escrito a mano (2026-11-10): cómo se entrega (`ENTREGAS_A_MANO` o escrito); sale en el concepto. */
    entrega: z.string().max(60).optional(),
    precio: z.number().min(0).max(10_000_000),
    /** Hasta 100 000 (2026-11-02): el block va por pieza y la carpeta por m². */
    cantidad: z.number().int().min(1).max(100_000).default(1),
    /** A qué zona se lleva (servicios con precio por zona, 2026-10-29). Sale del municipio de la obra. */
    zona: z.string().max(40).optional(),
  }),
]);

export const partidaTrituradosSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('material'),
    id: z.string().min(1).max(40),
    nombre: z.string().max(120).optional(),
    precio: z.number().min(0).max(10_000_000).optional(),
    toneladas: z.number().min(0).max(1_000_000).default(0),
    flete_ton: z.number().min(0).max(100_000).optional(),
    flete_zona: z.string().max(120).optional(),
    /** Pedido grande (2026-11-03): en qué camión (`camiones`) se entrega. El flete sale de su precio en la zona. */
    camion: z.string().max(20).optional(),
  }),
  z.object({
    tipo: z.literal('banco'),
    precio_m3: z.number().min(0).max(1_000_000).default(0),
    m3: z.number().min(0).max(1_000_000).default(0),
  }),
  z.object({
    tipo: z.literal('zona'),
    zona_id: z.string().min(1).max(40),
    producto_id: z.string().min(1).max(40),
    viajes: z.number().int().min(1).max(999).default(1),
    /** Precio por viaje negociado SOLO para esta cotización (2026-10-23). 0 o vacío = el de la tabla de zonas. */
    precio: z.number().min(0).max(10_000_000).optional(),
  }),
]);

export type PartidaMaquinaria = z.infer<typeof partidaMaquinariaSchema>;
export type PartidaTriturados = z.infer<typeof partidaTrituradosSchema>;
export type PartidaCotizador = PartidaMaquinaria | PartidaTriturados;

/**
 * UNA SOLA COTIZACIÓN CON TODO (2026-11-03, pedido del dueño: "se agrega en
 * una sola cotización"). La de maquinaria puede llevar también partidas de
 * triturados: se calculan con SU tabulador, que viaja junto (`triturados`,
 * solo en memoria: nunca se guarda dentro del de maquinaria).
 */
export const partidaCombinadaSchema = z.union([partidaMaquinariaSchema, partidaTrituradosSchema]);
export type CatalogoCombinado = CatalogoMaquinaria & { triturados?: CatalogoTriturados };
export const esDeTriturados = (p: PartidaCotizador): p is PartidaTriturados => p.tipo === 'material' || p.tipo === 'zona' || p.tipo === 'banco';
/** El tabulador de triturados de una cotización: el suyo, o el que trae una de maquinaria combinada. */
export function trituradosDe(cat: CatalogoCotizador): CatalogoTriturados | null {
  return cat.tipo === 'triturados' ? cat : (cat as CatalogoCombinado).triturados ?? null;
}
export function combinar(maq: CatalogoMaquinaria, tri: CatalogoTriturados | null | undefined): CatalogoCombinado {
  return tri ? { ...maq, triturados: tri } : maq;
}

/** Ajustes que el usuario decide y cambian el total (no son partidas). */
export const opcionesCotizadorSchema = z.object({
  /** maquinaria: cómo se presentan las cantidades en el documento. */
  modo_unidad: z.enum(['horas', 'dias']).default('horas'),
  /** triturados: con o sin factura. */
  con_iva: z.boolean().default(true),
});
export type OpcionesCotizador = z.infer<typeof opcionesCotizadorSchema>;

// ---------------------------------------------------------------------------
// Resultado del cálculo
// ---------------------------------------------------------------------------

export interface RenglonCotizacion {
  /** equipo | flete | servicio | material | banco | zona */
  clase: string;
  id?: string;
  nombre?: string;
  concepto: string;
  unidad: string;
  cantidad: number;
  pu: number;
  importe: number;
  /** Nota corta para la pantalla; el documento impreso no la usa. */
  detalle?: string;
  /** Pedido a la medida sin precio todavía (2026-11-06): importe 0, el documento dice «Por cotizar». */
  porCotizar?: boolean;
}

/** ¿Le falta precio a algo? Entonces no se le puede mandar al cliente como cotización. */
export function renglonesPorCotizar(calc: { renglones: RenglonCotizacion[] }): RenglonCotizacion[] {
  return calc.renglones.filter((r) => r.porCotizar);
}

export interface CalculoCotizacion {
  renglones: RenglonCotizacion[];
  /** Por bloque, para el resumen lateral. Lo que no aplique va en 0. */
  desglose: { renta: number; servicios: number; fletes: number; materiales: number };
  subtotal: number;
  iva: number;
  iva_tasa: number;
  con_iva: boolean;
  total: number;
  condiciones: BloqueCondiciones[];
}

const r2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

const entero = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};

const decimal = (v: unknown, min = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, n) : min;
};

// ---------------------------------------------------------------------------
// Motor · maquinaria
// ---------------------------------------------------------------------------

/**
 * Lo que cuesta una hora del equipo. Un tabulador de antes del 2026-10-29 (sin
 * `precio_hora`) se lee como su tarifa día entre la jornada, que es como el
 * motor sacaba la hora entonces: nada cambia de precio hasta que se captura.
 */
export function precioHoraDe(cat: CatalogoMaquinaria, eq: EquipoCotizador): number {
  if (eq.precio_hora !== undefined) return Number(eq.precio_hora) || 0;
  return eq.tarifas ? (Number(eq.tarifas.dia) || 0) / cat.jornada_horas : 0;
}

/** Horas que se cobran como mínimo por equipo. */
export const minimoHorasDe = (cat: CatalogoMaquinaria): number => cat.minimo_horas ?? cat.jornada_horas;

/** Si el flete a obra se cobra (se apagó el 2026-10-29). */
export const cobraFlete = (cat: CatalogoMaquinaria): boolean => cat.cobrar_flete !== false;

/** "8 h" / "1 h": las horas como se leen en la pantalla y en el documento. */
const horasTexto = (n: number) => `${n} ${n === 1 ? 'hora' : 'horas'}`;

export const equipoDe = (cat: CatalogoMaquinaria, id: string): EquipoCotizador | null =>
  cat.equipos.find((e) => e.id === id) ?? null;

export const servicioDe = (cat: CatalogoMaquinaria, id: string): ServicioCotizador | null =>
  cat.servicios.find((s) => s.id === id) ?? null;

// ---- Servicios con precio por zona (el agua, 2026-10-29) ----

/** Si el servicio cobra según la zona de la obra (agua y retiro). */
export const porZona = (sv: ServicioCotizador): boolean => !!sv.precios_zona && Object.keys(sv.precios_zona).length > 0;

export const zonaPrecioDe = (cat: CatalogoMaquinaria, id: string | null | undefined): ZonaPrecio | null =>
  (id && cat.zonas_precio?.find((z) => z.id === id)) || null;

/** La zona de precio de un municipio ("San Nicolás" = "san nicolas"), o null si no entra en ninguna. */
export function zonaDeMunicipio(cat: CatalogoMaquinaria, municipio: string | null | undefined): ZonaPrecio | null {
  const m = normalizarNombre((municipio ?? '').split(',')[0] ?? '');
  if (!m) return null;
  return cat.zonas_precio?.find((z) => z.municipios.some((x) => normalizarNombre(x) === m)) ?? null;
}

/** Las zonas donde se ofrece el servicio: las que tienen precio. */
export const zonasDelServicio = (cat: CatalogoMaquinaria, sv: ServicioCotizador): ZonaPrecio[] =>
  (cat.zonas_precio ?? []).filter((z) => (sv.precios_zona?.[z.id] ?? 0) > 0);

/** Lo que cuesta el servicio por viaje en esa zona. Sin precio por zona, el de siempre; null si no se ofrece ahí. */
export function precioDeServicio(cat: CatalogoMaquinaria, sv: ServicioCotizador, zonaId?: string | null): number | null {
  if (!porZona(sv)) return sv.precio;
  const precio = zonaId ? sv.precios_zona?.[zonaId] : undefined;
  return precio && precio > 0 && zonaPrecioDe(cat, zonaId) ? precio : null;
}

/**
 * La zona que no se eligió a mano sale del municipio de la obra. La usan el
 * cotizador (sitio y panel) y la API al guardar: el municipio ya se pidió en
 * el primer paso, así nadie la captura dos veces.
 */
export function conZonaDeLaObra(cat: CatalogoCotizador, partidas: PartidaCotizador[], municipio: string | null | undefined): PartidaCotizador[] {
  if (cat.tipo !== 'maquinaria') return partidas;
  const zona = zonaDeMunicipio(cat, municipio);
  return partidas.map((p) => {
    if (p.tipo !== 'servicio' || p.zona) return p;
    const sv = servicioDe(cat, p.id);
    return sv && porZona(sv) && zona ? { ...p, zona: zona.id } : p;
  });
}

/** Qué falta para cobrar el agua: la zona, o que la zona sea de las que lo llevan. Null si todo está. */
export function faltaZona(cat: CatalogoCotizador, partidas: PartidaCotizador[], municipio?: string | null): string | null {
  if (cat.tipo !== 'maquinaria') return null;
  for (const p of partidas) {
    if (p.tipo !== 'servicio') continue;
    const sv = servicioDe(cat, p.id);
    if (!sv || !porZona(sv) || Number(p.precio) > 0) continue;
    if (precioDeServicio(cat, sv, p.zona) !== null) continue;
    const donde = (municipio ?? '').trim();
    const zonas = zonasDelServicio(cat, sv).map((z) => z.nombre).join(' y ');
    return p.zona || !donde
      ? `«${sv.nombre}»: elige la zona de la obra (${zonas}).`
      : `«${sv.nombre}» no se ofrece en ${donde}: solo en los municipios de ${zonas}.`;
  }
  return null;
}

/**
 * Lo que cuesta UNA partida de equipo.
 *
 * COBRO POR HORA (2026-10-29): se cobran las horas de trabajo (días × jornada
 * + horas extra) al precio por hora del equipo, con un mínimo de horas por
 * equipo. Si piden menos, se cobra el mínimo y `notaMinimo` lo dice: cobrarlo
 * es correcto solo si el cliente lo ve antes de aceptar.
 *
 * Se exporta porque la pantalla pinta este mismo desglose renglón por renglón
 * mientras el usuario mueve los días: si lo recalculara por su cuenta, sería la
 * segunda implementación del motor y volveríamos al problema original.
 */
export function calcularEquipo(cat: CatalogoMaquinaria, p: Extract<PartidaMaquinaria, { tipo: 'equipo' }>) {
  const eq = equipoDe(cat, p.id);
  const jornada = cat.jornada_horas;
  const dias = entero(p.dias, 0);
  const horas = entero(p.horas, 0, jornada - 1);
  const cantidad = entero(p.cantidad, 1);
  // Override: solo si trae un número > 0. Un campo vacío vuelve al tabulador.
  const negociado = p.precio_hora !== null && p.precio_hora !== undefined && Number(p.precio_hora) > 0;
  const tarifaHora = negociado ? decimal(p.precio_hora) : eq ? precioHoraDe(cat, eq) : 0;
  const tarifaDia = tarifaHora * jornada;
  // Sin duración no se cobra: es un renglón que el usuario acaba de agregar y
  // todavía no configura. Cobrarle el mínimo por eso sería mentirle el total.
  const activo = dias >= 1 || horas >= 1;
  const minimo = minimoHorasDe(cat);
  const horasPedidas = dias * jornada + horas;
  const horasPorEquipo = activo ? Math.max(horasPedidas, minimo) : 0;
  const notaMinimo = activo && horasPedidas < minimo ? `Mínimo ${horasTexto(minimo)} por equipo: se cobran ${horasTexto(minimo)}.` : null;
  const horasTotales = horasPorEquipo * cantidad;
  const tiempo = horasTotales * tarifaHora;
  const fleteNegociado = p.flete !== null && p.flete !== undefined && Number(p.flete) > 0;
  const fleteUnit = !cobraFlete(cat) ? 0 : fleteNegociado ? decimal(p.flete) : eq ? Number(cat.fletes[eq.flete_tipo] ?? 0) : 0;
  const flete = activo ? fleteUnit * cantidad : 0;
  return {
    eq, jornada, dias, horas, cantidad,
    tarifaDia, tarifaHora, horasPedidas, horasPorEquipo, horasTotales, minimo, notaMinimo, tiempo,
    fleteUnit, flete, activo, negociado,
  };
}

/**
 * Orden de los bloques de condiciones en el documento. Un bloque que no esté
 * aquí va al final en vez de perderse: antes la lista era cerrada y las
 * condiciones de material de banco (2026-10-08) no salían en la cotización.
 */
const COND_ORDEN_MAQUINARIA = ['renta', 'retiro', 'banco', 'pipa'] as const;

/** Así empieza la leyenda para negociar; un documento sin precios la quita (`condicionesSinPrecios`). */
export const LEYENDA_NEGOCIAR = 'Si desea negociar el costo';

/**
 * LOS DOS PUNTOS DE LA RENTA QUE ESCRIBE EL TABULADOR (2026-10-29): cómo se
 * cobra (por hora, con su mínimo) y la leyenda para negociar ("no va a haber
 * descuentos; si el cliente quiere mejorar el precio, que se comunique a la
 * línea de MAQSER24"). Salen del mínimo y del teléfono del documento, así no
 * se contradicen con ellos cuando cambian en Tarifas.
 */
function puntosDeRenta(cat: CatalogoMaquinaria): { primero: string; ultimo: string } {
  const minimo = minimoHorasDe(cat);
  const tel = cat.empresa.telefono.trim();
  return {
    primero: `El costo de la renta del equipo es por hora de trabajo${minimo > 0 ? `, con un mínimo de ${horasTexto(minimo)} por equipo` : ''}.`,
    ultimo: `${LEYENDA_NEGOCIAR}, comuníquese a la línea de ${cat.empresa.nombre || 'MAQSER24'}${tel ? `: ${tel}` : ''}.`,
  };
}

function condicionesMaquinaria(cat: CatalogoMaquinaria, partidas: PartidaMaquinaria[]): BloqueCondiciones[] {
  const claves = new Set<string>();
  for (const p of partidas) {
    if (p.tipo === 'equipo') claves.add('renta');
    else {
      const sv = servicioDe(cat, p.id);
      if (sv) claves.add(sv.cond || 'renta');
    }
  }
  const orden: string[] = [...COND_ORDEN_MAQUINARIA, ...[...claves].filter((k) => !(COND_ORDEN_MAQUINARIA as readonly string[]).includes(k))];
  const renta = puntosDeRenta(cat);
  return orden
    .filter((k) => claves.has(k) && cat.condiciones[k])
    .map((k) => (k === 'renta' ? { ...cat.condiciones[k], puntos: [renta.primero, ...cat.condiciones[k].puntos, renta.ultimo] } : cat.condiciones[k]));
}

/** Clave del servicio escrito a mano (panel): no está en el tabulador. */
export const SERVICIO_A_MANO = 'custom';

/**
 * CÓMO SE ENTREGA LO ESCRITO A MANO (2026-11-10, el dueño: "cómo se va a
 * mandar, si por camión, tolva, etc., hace falta más información"): opcional,
 * en todo renglón escrito a mano (block, materiales, lo que no está en el
 * tabulador). Además de estas, se puede escribir otra.
 */
export const ENTREGAS_A_MANO = ['Recoge en planta', 'Camión torton', 'Tráiler', 'Tolva o pipa a granel'] as const;

/** El concepto del renglón escrito a mano: su nombre y, si se dijo, cómo se entrega. */
export function conceptoAMano(nombre: string, entrega?: string | null): string {
  const e = (entrega ?? '').trim();
  if (!e) return nombre.toUpperCase();
  return `${nombre} · ${e === 'Recoge en planta' ? e : `entrega en ${e}`}`.toUpperCase();
}

export function calcularMaquinaria(
  cat: CatalogoMaquinaria,
  partidas: PartidaMaquinaria[],
  opciones: Partial<OpcionesCotizador> = {},
): CalculoCotizacion {
  const modo = opciones.modo_unidad ?? 'horas';
  const jornada = cat.jornada_horas;
  const renglones: RenglonCotizacion[] = [];
  let renta = 0;
  let servicios = 0;
  let fletes = 0;

  for (const p of partidas) {
    if (p.tipo === 'equipo') {
      const c = calcularEquipo(cat, p);
      if (!c.eq || !c.activo) continue;
      renta += c.tiempo;
      fletes += c.flete;

      const unidad = modo === 'dias' ? 'JOR' : 'HRS';
      // Las horas COBRADAS (con el mínimo), no las pedidas: cantidad × P.U. = importe.
      const cantidad = modo === 'dias'
        ? Math.round((c.horasTotales / jornada) * 10_000) / 10_000
        : c.horasTotales;
      const pu = modo === 'dias' ? r2(c.tarifaDia) : r2(c.tarifaHora);

      renglones.push({
        clase: 'equipo',
        id: c.eq.id,
        nombre: c.eq.nombre,
        concepto: `RENTA DE ${c.eq.nombre.toUpperCase()} ( CON OPERACIÓN, INCLUYE DIÉSEL )`,
        unidad,
        cantidad,
        pu,
        importe: r2(c.tiempo),
        detalle: [c.notaMinimo ?? 'Por hora', c.cantidad > 1 ? `${c.cantidad} equipos` : ''].filter(Boolean).join(' · '),
      });
      // Flete apagado (2026-10-29): sin renglón, en vez de un flete en $0.
      if (cobraFlete(cat)) renglones.push({
        clase: 'flete',
        id: c.eq.id,
        concepto: `FLETE ${c.eq.flete_tipo.toUpperCase()} A OBRA (IDA Y VUELTA)`,
        unidad: 'SERV',
        cantidad: c.cantidad,
        pu: r2(c.fleteUnit),
        importe: r2(c.flete),
      });
    } else {
      const sv = servicioDe(cat, p.id);
      if (!sv) {
        // Escrito a mano en el panel (2026-10-30, "agregaron grava 8 y no está"):
        // nombre y precio obligatorios; sin ellos saldría un renglón mudo o en cero.
        const nombre = (p.nombre ?? '').trim();
        const precio = decimal(p.precio);
        const cantidad = entero(p.cantidad, 1);
        if (p.id !== SERVICIO_A_MANO || !nombre) continue;
        if (precio <= 0) {
          /**
           * A LA MEDIDA (2026-11-06, el dueño: "para los clientes, solo escogen
           * el material y después se cotiza"): lo que el cliente pidió de una
           * categoría sin precio de lista lleva su categoría y llega en $0. Sale
           * «por cotizar», sin sumar, para que el panel le ponga precio con el
           * lápiz; sin categoría, un renglón en cero no dice nada y se omite.
           */
          if (!p.categoria) continue;
          renglones.push({
            clase: 'servicio',
            id: SERVICIO_A_MANO,
            nombre,
            concepto: conceptoAMano(nombre, p.entrega),
            unidad: (p.unidad || 'servicio').toUpperCase(),
            cantidad,
            pu: 0,
            importe: 0,
            porCotizar: true,
          });
          continue;
        }
        servicios += precio * cantidad;
        renglones.push({
          clase: 'servicio',
          id: SERVICIO_A_MANO,
          nombre,
          concepto: conceptoAMano(nombre, p.entrega),
          unidad: (p.unidad || 'servicio').toUpperCase(),
          cantidad,
          pu: r2(precio),
          importe: r2(precio * cantidad),
        });
        continue;
      }
      const cantidad = entero(p.cantidad, 1);
      // Un precio en 0 significa "el del catálogo", no "gratis". Importa más de
      // lo que parece: con los precios ocultos en el sitio público, el
      // navegador recibe el tabulador EN CEROS y manda 0 en cada servicio. Si
      // el 0 se respetara, el renglón daría importe 0 y se caería del
      // documento — el visitante pediría tres pipas y llegaría una solicitud
      // sin pipas. Mismo criterio que el material de triturados.
      // Con precio por zona (el agua), el del catálogo es el de su zona; sin
      // zona no hay precio y el renglón no se cobra (la pantalla y la API la piden).
      const zona = porZona(sv) ? zonaPrecioDe(cat, p.zona) : null;
      const precio = decimal(p.precio && Number(p.precio) > 0 ? p.precio : precioDeServicio(cat, sv, p.zona) ?? 0);
      const importe = precio * cantidad;
      if (importe <= 0) continue;
      servicios += importe;
      const concepto = sv.cond === 'retiro' ? `${sv.nombre.toUpperCase()} (TIRO LIBRE)` : sv.nombre.toUpperCase();
      renglones.push({
        clase: 'servicio',
        id: sv.id,
        nombre: sv.nombre,
        concepto: zona ? `${concepto} · ${zona.nombre.toUpperCase()}` : concepto,
        unidad: (sv.unidad || 'viaje').toUpperCase(),
        cantidad,
        pu: r2(precio),
        importe: r2(importe),
      });
    }
  }

  const subtotal = r2(renta + servicios + fletes);
  const iva = r2(subtotal * cat.iva);
  return {
    renglones,
    desglose: { renta: r2(renta), servicios: r2(servicios), fletes: r2(fletes), materiales: 0 },
    subtotal,
    iva,
    iva_tasa: cat.iva,
    con_iva: true,
    total: r2(subtotal + iva),
    condiciones: condicionesMaquinaria(cat, partidas),
  };
}

// ---------------------------------------------------------------------------
// Motor · triturados
// ---------------------------------------------------------------------------

export const productoDe = (cat: CatalogoTriturados, id: string): ProductoTriturado | null =>
  cat.productos.find((p) => p.id === id) ?? null;

export const zonaDe = (cat: CatalogoTriturados, id: string): ZonaTriturado | null =>
  cat.zonas.find((z) => z.id === id) ?? null;

/** Lo que el cotizador escribe en `flete_zona` cuando el material no se lleva a obra. */
export const RECOGE_EN_PLANTA = 'Recoge en planta';

/**
 * ¿El pedido de triturados lleva flete a obra? (2026-10-29) El flete es
 * opcional; si lo pide, hace falta la ubicación de la obra en Google Maps
 * para cotizarlo. Lleva flete el material por tonelada con zona (no "recoge
 * en planta") y todo viaje puesto en obra.
 */
export function llevaFlete(partidas: PartidaCotizador[]): boolean {
  return partidas.some((p) =>
    p.tipo === 'zona'
    // El pedido grande siempre va a obra, aunque su flete aún no tenga precio.
    || (p.tipo === 'material' && !!p.camion)
    || (p.tipo === 'material' && (Number(p.flete_ton ?? 0) > 0
      || (!!(p.flete_zona ?? '').trim() && (p.flete_zona ?? '').trim().toLowerCase() !== RECOGE_EN_PLANTA.toLowerCase()))));
}

/**
 * Un enlace de Google Maps ("Compartir → Copiar enlace") o unas coordenadas
 * ("25.6866, -100.3161"): con eso se mide la distancia para el flete (2026-10-29).
 */
export function esUbicacionDeMapas(v: string | null | undefined): boolean {
  const s = (v ?? '').trim();
  if (!s || s.length > 500) return false;
  if (/^-?\d{1,2}\.\d+\s*,\s*-?\d{1,3}\.\d+$/.test(s)) return true;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const h = u.hostname.toLowerCase();
    if (h === 'maps.app.goo.gl' || (h === 'goo.gl' && u.pathname.startsWith('/maps'))) return true;
    return /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(h) && (h.startsWith('maps.') || u.pathname.startsWith('/maps'));
  } catch {
    return false;
  }
}

/**
 * Precio por viaje de un producto a una zona.
 *
 * Usa el precio explícito de la tabla cuando existe (los que el cliente cotizó
 * a mano) y, para el resto, lo deriva: flete de la zona + $/ton × ton por viaje.
 */
export function precioZona(cat: CatalogoTriturados, z: ZonaTriturado | null, productoId: string): number | null {
  if (!z) return null;
  const override = z.precios?.[productoId];
  if (override !== undefined && override !== null) return Number(override);
  const prod = productoDe(cat, productoId);
  if (!prod) return null;
  return r2(Number(z.flete) + Number(prod.precio_ton) * cat.ton_por_viaje);
}

/**
 * Los camiones del pedido grande: tolva y full (2026-11-03) y los camiones de
 * 7 y 14 m³ (2026-11-06, el dueño: "tolva, full, camión de 7 metros cúbicos,
 * camión de 14 metros cúbicos"). Su flete se escribe en cada cotización.
 */
export const CAMIONES_DE_FABRICA: CamionTriturado[] = [
  { id: 'tolva', nombre: 'Tolva', detalle: '30 m³ · 50 ton', precios_ton: {} },
  { id: 'full', nombre: 'Full', detalle: '90 ton', precios_ton: {} },
  { id: 'camion7', nombre: 'Camión de 7 m³', detalle: '7 m³', precios_ton: {} },
  { id: 'camion14', nombre: 'Camión de 14 m³', detalle: '14 m³', precios_ton: {} },
];
export const MINIMO_CAMION_TON = 100;

export const camionesDe = (cat: CatalogoTriturados): CamionTriturado[] => cat.camiones ?? CAMIONES_DE_FABRICA;
export const minimoCamionDe = (cat: CatalogoTriturados): number => cat.minimo_camion_ton ?? MINIMO_CAMION_TON;
export const camionDe = (cat: CatalogoTriturados, id: string | null | undefined): CamionTriturado | null =>
  (id ? camionesDe(cat).find((c) => c.id === id) : undefined) ?? null;

/** La zona por su nombre: el material guarda el NOMBRE de la zona de su flete (`flete_zona`). */
export function zonaPorNombre(cat: CatalogoTriturados, nombre: string | null | undefined): ZonaTriturado | null {
  const n = (nombre ?? '').trim().toLowerCase();
  return (n ? cat.zonas.find((z) => z.nombre.trim().toLowerCase() === n) : undefined) ?? null;
}

/** Flete por tonelada del camión a esa zona. 0: todavía sin precio, se confirma aparte. */
export function fleteCamion(cat: CatalogoTriturados, camionId: string | null | undefined, zonaNombre: string | null | undefined): number {
  const c = camionDe(cat, camionId);
  const z = zonaPorNombre(cat, zonaNombre);
  return c && z ? Number(c.precios_ton[z.id] ?? 0) : 0;
}

/**
 * EL MÍNIMO DEL PEDIDO GRANDE (2026-11-03, "sí, mínimo 100 ton"): suman todas
 * las toneladas que van en tolva o full. Null si cumple o si no hay pedido grande.
 */
export function faltaMinimoCamion(cat: CatalogoCotizador, partidas: PartidaCotizador[]): string | null {
  const tri = trituradosDe(cat);
  if (!tri) return null;
  const grandes = partidas.filter((p): p is Extract<PartidaTriturados, { tipo: 'material' }> => p.tipo === 'material' && !!(p as { camion?: string }).camion);
  if (!grandes.length) return null;
  const ton = grandes.reduce((s, p) => s + Number(p.toneladas ?? 0), 0);
  const minimo = minimoCamionDe(tri);
  return ton >= minimo
    ? null
    : `El pedido en tolva o full es desde ${minimo} toneladas (llevas ${ton.toLocaleString('es-MX')}). Para menos, elige «Por viaje a mi obra».`;
}

function condicionesTriturados(
  cat: CatalogoTriturados,
  partidas: PartidaTriturados[],
  conIva: boolean,
): BloqueCondiciones[] {
  const bloques: BloqueCondiciones[] = [];
  const general = cat.condiciones.general;
  if (general) {
    bloques.push({
      titulo: general.titulo,
      // La línea del IVA cambia con el switch de factura, así que se antepone
      // aquí en vez de vivir escrita en el catálogo (donde sería mentira la
      // mitad de las veces).
      puntos: [
        conIva
          ? `Costos más IVA (${Math.round(cat.iva * 100)}%).`
          : 'Costos remisionados sin cargo de IVA; más IVA en caso de requerir factura.',
        // Sin la leyenda para negociar el costo (2026-10-30, pedido del dueño): en
        // triturados ya no va. En la renta de maquinaria sigue (puntosDeRenta).
        ...general.puntos,
      ],
    });
  }
  // «Suministro por tonelada» (cargado en planta, usted manda su camión) solo cuando
  // van por el material a la planta (2026-11-06, el dueño: "quitar la nota de suministro
  // por tonelada en donde no sea que vayan por el material a planta").
  const enObra = (p: PartidaTriturados) => p.tipo === 'material' && !!productoDe(cat, p.id)?.en_obra;
  if (partidas.some((p) => p.tipo === 'material' && !p.camion && !enObra(p)) && cat.condiciones.material) bloques.push(cat.condiciones.material);
  // La cal de patio, puesta en obra (2026-11-06): su pedido mínimo, la tolva y el ajuste al llegar.
  if (partidas.some(enObra) && cat.condiciones.cal) bloques.push(cat.condiciones.cal);
  // El pedido grande lo dice el cálculo, no el tabulador: el camión y si el flete ya tiene precio.
  const grandes = partidas.filter((p): p is Extract<PartidaTriturados, { tipo: 'material' }> => p.tipo === 'material' && !!p.camion);
  if (grandes.length) {
    const camiones = [...new Set(grandes.map((p) => (camionDe(cat, p.camion)?.nombre ?? p.camion ?? '').toLowerCase()))].join(' y ');
    // El flete de tolva y full no sale de las zonas (2026-11-06): se escribe en cada cotización.
    const sinPrecio = grandes.some((p) => !(Number(p.flete_ton ?? 0) > 0));
    bloques.push({
      titulo: 'Pedido grande',
      puntos: [
        // Pedido del dueño (2026-11-06): "poner este costo es entregado en obra, en pedidos grandes".
        'Este costo es entregado en obra.',
        `Pedido desde ${minimoCamionDe(cat)} toneladas, entregado en ${camiones}.`,
        sinPrecio
          ? 'El flete se confirma por separado: no está incluido en este total.'
          : 'El flete es por tonelada, según el camión y el lugar de la obra.',
      ],
    });
  }
  if (partidas.some((p) => p.tipo === 'banco') && cat.condiciones.banco) bloques.push(cat.condiciones.banco);
  if (partidas.some((p) => p.tipo === 'zona') && cat.condiciones.zona) bloques.push(cat.condiciones.zona);
  return bloques;
}

export function calcularTriturados(
  cat: CatalogoTriturados,
  partidas: PartidaTriturados[],
  opciones: Partial<OpcionesCotizador> = {},
): CalculoCotizacion {
  const conIva = opciones.con_iva ?? cat.iva_por_defecto;
  const renglones: RenglonCotizacion[] = [];
  let materiales = 0;
  let fletes = 0;

  for (const p of partidas) {
    if (p.tipo === 'material') {
      const prod = productoDe(cat, p.id);
      // `id: 'custom'` es el material que el usuario nombra a mano: no está en
      // el catálogo y el nombre es obligatorio (si no, saldría un renglón mudo).
      const nombre = (p.nombre ?? prod?.nombre ?? '').trim();
      const precioTon = decimal(p.precio && Number(p.precio) > 0 ? p.precio : prod?.precio_ton ?? 0);
      const pedidas = decimal(p.toneladas);
      if (!nombre || pedidas <= 0 || precioTon <= 0) continue;
      // Ya puesta en obra (la cal de patio, 2026-11-06): se cobra el mínimo si piden
      // menos (las 28 ton que se pagan para programar la tolva) y nunca lleva flete aparte.
      const enObra = !!prod?.en_obra;
      const ton = enObra ? Math.max(pedidas, Number(prod?.minimo_ton ?? 0)) : pedidas;
      const importe = precioTon * ton;
      materiales += importe;
      renglones.push({
        clase: 'material',
        id: p.id,
        nombre,
        concepto: enObra ? `${nombre.toUpperCase()} · PUESTA EN OBRA` : nombre.toUpperCase(),
        unidad: 'TON',
        cantidad: ton,
        pu: r2(precioTon),
        importe: r2(importe),
        ...(enObra && ton > pedidas ? { detalle: `Mínimo ${ton} ton (pidió ${pedidas})` } : {}),
      });
      if (enObra) continue;
      // Pedido grande: el flete por tonelada que se escribió en la cotización.
      // Ya no sale de la zona (2026-11-06, el dueño: "en ese tipo de viajes no
      // salen las opciones de las zonas, ya que ahí el flete cambia"); sin él, se confirma aparte.
      const camion = camionDe(cat, p.camion);
      const fleteTon = decimal(p.flete_ton);
      if (fleteTon > 0) {
        const etiqueta = (p.flete_zona ?? '').trim();
        const importeFlete = fleteTon * ton;
        fletes += importeFlete;
        renglones.push({
          clase: 'flete',
          concepto: camion
            ? `FLETE EN ${camion.nombre.toUpperCase()}${etiqueta ? ` · ${etiqueta.toUpperCase()}` : ''}`
            : etiqueta ? `FLETE ${etiqueta.toUpperCase()}` : 'FLETE A OBRA',
          unidad: 'TON',
          cantidad: ton,
          pu: r2(fleteTon),
          importe: r2(importeFlete),
        });
      }
    } else if (p.tipo === 'banco') {
      const b = cat.material_banco;
      const m3 = decimal(p.m3);
      const precio = decimal(Number(p.precio_m3) > 0 ? p.precio_m3 : b.precio_m3_default);
      if (m3 <= 0 || precio <= 0) continue;
      const importe = precio * m3;
      materiales += importe;
      renglones.push({
        clase: 'banco',
        nombre: b.nombre,
        concepto: `${b.nombre.toUpperCase()} (INCLUYE FLETE)`,
        unidad: b.unidad || 'M3',
        cantidad: m3,
        pu: r2(precio),
        importe: r2(importe),
      });
    } else {
      const z = zonaDe(cat, p.zona_id);
      const prod = productoDe(cat, p.producto_id);
      const precio = p.precio && Number(p.precio) > 0 ? decimal(p.precio) : precioZona(cat, z, p.producto_id);
      if (!z || !prod || precio === null) continue;
      const viajes = entero(p.viajes, 1);
      const importe = precio * viajes;
      materiales += importe;
      renglones.push({
        clase: 'zona',
        id: `${z.id}:${prod.id}`,
        nombre: prod.nombre,
        concepto: `${prod.nombre.toUpperCase()} · ${z.nombre}`,
        unidad: cat.unidad_zona || 'VIAJE',
        cantidad: viajes,
        pu: r2(precio),
        importe: r2(importe),
        detalle: cat.nota_zona,
      });
    }
  }

  const subtotal = r2(materiales + fletes);
  const iva = conIva ? r2(subtotal * cat.iva) : 0;
  return {
    renglones,
    desglose: { renta: 0, servicios: 0, fletes: r2(fletes), materiales: r2(materiales) },
    subtotal,
    iva,
    iva_tasa: cat.iva,
    con_iva: conIva,
    total: r2(subtotal + iva),
    condiciones: condicionesTriturados(cat, partidas, conIva),
  };
}

/** Punto de entrada único: la API y las dos pantallas llaman SIEMPRE a esto. */
export function calcularCotizacion(
  catalogo: CatalogoCotizador,
  partidas: PartidaCotizador[],
  opciones: Partial<OpcionesCotizador> = {},
): CalculoCotizacion {
  if (catalogo.tipo === 'triturados') return calcularTriturados(catalogo, partidas as PartidaTriturados[], opciones);
  const calc = calcularMaquinaria(catalogo, partidas.filter((p) => !esDeTriturados(p)) as PartidaMaquinaria[], opciones);
  const tri = (catalogo as CatalogoCombinado).triturados;
  const deTriturados = partidas.filter(esDeTriturados);
  if (!tri || !deTriturados.length) return calc;
  // Combinada: la maquinaria siempre lleva IVA, así que los triturados también.
  return juntarCalculos(calc, calcularTriturados(tri, deTriturados, { con_iva: true }), catalogo.iva);
}

/** Dos cálculos en un documento: renglones uno tras otro, un solo subtotal, un IVA y las condiciones de los dos. */
function juntarCalculos(a: CalculoCotizacion, b: CalculoCotizacion, ivaTasa: number): CalculoCotizacion {
  const subtotal = r2(a.subtotal + b.subtotal);
  const iva = r2(subtotal * ivaTasa);
  const titulos = new Set(a.condiciones.map((c) => c.titulo));
  return {
    renglones: [...a.renglones, ...b.renglones],
    desglose: {
      renta: a.desglose.renta,
      servicios: a.desglose.servicios,
      fletes: r2(a.desglose.fletes + b.desglose.fletes),
      materiales: r2(a.desglose.materiales + b.desglose.materiales),
    },
    subtotal,
    iva,
    iva_tasa: ivaTasa,
    con_iva: true,
    total: r2(subtotal + iva),
    condiciones: [...a.condiciones, ...b.condiciones.filter((c) => !titulos.has(c.titulo))],
  };
}

/** ¿Hay algo que cobrar? Un carrito de renglones en cero no es una cotización. */
export function tieneImporte(calc: CalculoCotizacion): boolean {
  return calc.renglones.length > 0 && calc.total > 0;
}

/**
 * A QUIÉN LE TOCA CADA PARTIDA.
 *
 * Agrupa lo que el cliente pidió por proveedor dueño (`proveedor_id` del
 * tabulador) para que a cada uno le llegue UN correo con lo suyo, y no uno por
 * renglón: pedir tres equipos del mismo proveedor es un solo trabajo para él.
 *
 * Las partidas SIN dueño no salen en la lista. No es un olvido: mientras nadie
 * las haya asignado en Tarifas, el único aviso posible es el interno, y
 * fabricar un destinatario sería mandarle trabajo a quien no le toca.
 *
 * Devuelve los conceptos en texto, ya con cantidades, porque es lo que va en el
 * correo: el proveedor necesita saber qué le piden, no los ids internos.
 */
export function partidasPorProveedor(
  cat: CatalogoCotizador,
  partidas: PartidaCotizador[],
): Array<{ proveedorId: number; conceptos: string[] }> {
  const tri = trituradosDe(cat);
  const mapa = new Map<number, string[]>();
  const sumar = (id: number | null | undefined, concepto: string) => {
    if (!id) return;
    const ya = mapa.get(id) ?? [];
    ya.push(concepto);
    mapa.set(id, ya);
  };

  for (const p of partidas) {
    if (p.tipo === 'equipo' && cat.tipo === 'maquinaria') {
      const eq = cat.equipos.find((e) => e.id === p.id);
      if (!eq) continue;
      const tiempo = [
        p.dias ? `${p.dias} ${p.dias === 1 ? 'día' : 'días'}` : '',
        p.horas ? `${p.horas} h` : '',
      ]
        .filter(Boolean)
        .join(' y ');
      const unidades = (p.cantidad ?? 1) > 1 ? ` × ${p.cantidad}` : '';
      sumar(eq.proveedor_id, `${eq.nombre}${unidades}${tiempo ? ` · ${tiempo}` : ''}`);
    } else if (p.tipo === 'servicio' && cat.tipo === 'maquinaria') {
      const sv = cat.servicios.find((x) => x.id === p.id);
      if (!sv) continue;
      sumar(sv.proveedor_id, `${sv.nombre} · ${p.cantidad ?? 1} ${sv.unidad}(s)`);
    } else if (p.tipo === 'material' && tri) {
      const prod = tri.productos.find((x) => x.id === p.id);
      const nombre = prod?.nombre ?? p.nombre ?? 'Material';
      sumar(prod?.proveedor_id, `${nombre} · ${p.toneladas ?? 0} ton`);
    } else if (p.tipo === 'zona' && tri) {
      const prod = tri.productos.find((x) => x.id === p.producto_id);
      const zona = tri.zonas.find((z) => z.id === p.zona_id);
      if (!prod) continue;
      sumar(
        prod.proveedor_id,
        `${prod.nombre} · ${p.viajes ?? 1} viaje(s)${zona ? ` · ${zona.nombre}` : ''}`,
      );
    } else if (p.tipo === 'banco' && tri) {
      sumar(tri.material_banco.proveedor_id, `${tri.material_banco.nombre} · ${p.m3 ?? 0} m³`);
    }
  }

  return [...mapa].map(([proveedorId, conceptos]) => ({ proveedorId, conceptos }));
}

// ---------------------------------------------------------------------------
// Relación tabulador ↔ líneas ↔ catálogo (2026-09-24)
// ---------------------------------------------------------------------------

export const LINEA_MAQUINARIA = 'maquinaria-pesada';
export const LINEA_TRANSPORTE = 'transporte-y-servicios-de-obra';
export const LINEA_TRITURADOS = 'triturados';
/** Con cotizador desde 2026-11-02: sus fichas ponen precio como servicios del tabulador de maquinaria. */
export const LINEA_ASFALTO = 'soluciones-asfalticas';
export const LINEA_MATERIALES = 'materiales-para-construccion';
export const LINEA_VENTA = 'venta-de-maquinaria';

/**
 * Las unidades en que se cobra un servicio. La ficha elige una; lo que no la
 * trae (los tabuladores de antes) se cobra por viaje.
 */
// El block se vende por pieza, tarima, viaje en Torton y viaje en tráiler (2026-11-06).
export const UNIDADES_DE_SERVICIO = ['viaje', 'm²', 'm³', 'litro', 'pieza', 'tarima', 'millar', 'tonelada', 'viaje Torton', 'viaje tráiler', 'equipo', 'servicio', 'hora', 'día'] as const;

/** Con qué unidad y qué condiciones nace un renglón nuevo de cada línea. */
// La carpeta se cotiza por tonelada aplicada (su página de servicio); el riego de impregnación, por litro (2026-11-06, en su ficha).
const UNIDAD_DE_LINEA: Record<string, string> = { [LINEA_ASFALTO]: 'tonelada', [LINEA_MATERIALES]: 'pieza', [LINEA_VENTA]: 'equipo' };
export const COND_DE_LINEA: Record<string, string> = { [LINEA_ASFALTO]: 'asfalto', [LINEA_MATERIALES]: 'materiales', [LINEA_VENTA]: 'venta' };
export const unidadDeLinea = (linea: string | null | undefined): string => (linea && UNIDAD_DE_LINEA[linea]) || 'viaje';

/** "3 viajes", "1 pieza", "250 m²", "2 viajes Torton": la cantidad con su unidad, para leerse. */
export function conUnidad(cantidad: number, unidad: string): string {
  const u = unidad || 'viaje';
  // De varias palabras (2026-11-06, «viaje Torton»): se pluraliza solo la primera.
  const [primera, ...resto] = u.split(' ');
  if (cantidad === 1 || !/[a-zíá]$/i.test(primera)) return `${cantidad} ${u}`;
  const plural = /[aeiouáéíóú]$/i.test(primera) ? `${primera}s` : `${primera}es`;
  return [String(cantidad), plural, ...resto].join(' ');
}

/** Línea de un servicio del cotizador de maquinaria (con respaldo por su bloque de condiciones). */
export function lineaDeServicio(sv: { linea?: string; cond: string }): string {
  if (sv.linea) return sv.linea;
  return sv.cond === 'pipa' || sv.cond === 'retiro' ? LINEA_TRANSPORTE : LINEA_MAQUINARIA;
}

/** Un renglón del tabulador visto como parte del catálogo: su línea y sus productos. */
export interface RenglonTabulador {
  tipo: CotizadorTipo;
  id: string;
  nombre: string;
  linea: string;
  productos: number[];
  proveedorId: number | null;
}

/** Todos los renglones de un tabulador que se pueden ligar a productos. */
export function renglonesDe(cat: CatalogoCotizador): RenglonTabulador[] {
  if (cat.tipo === 'maquinaria') {
    return [
      ...cat.equipos.map((e) => ({ tipo: cat.tipo, id: e.id, nombre: e.nombre, linea: LINEA_MAQUINARIA, productos: e.productos ?? [], proveedorId: e.proveedor_id ?? null })),
      ...cat.servicios.map((s) => ({ tipo: cat.tipo, id: s.id, nombre: s.nombre, linea: lineaDeServicio(s), productos: s.productos ?? [], proveedorId: s.proveedor_id ?? null })),
    ];
  }
  return [
    ...cat.productos.map((p) => ({ tipo: cat.tipo, id: p.id, nombre: p.nombre, linea: LINEA_TRITURADOS, productos: p.productos ?? [], proveedorId: p.proveedor_id ?? null })),
    { tipo: cat.tipo, id: 'banco', nombre: cat.material_banco.nombre, linea: LINEA_TRITURADOS, productos: cat.material_banco.productos ?? [], proveedorId: cat.material_banco.proveedor_id ?? null },
  ];
}

/**
 * Liga un producto del catálogo a un renglón (lo quita de cualquier otro
 * renglón del mismo tabulador: un producto cuenta como UNA cosa). Devuelve
 * el tabulador nuevo; null si el renglón no existe.
 */
export function ligarProducto(cat: CatalogoCotizador, renglonId: string, productId: number): CatalogoCotizador | null {
  const sin = (l?: number[]) => (l ?? []).filter((x) => x !== productId);
  const con = (l?: number[]) => [...sin(l), productId];
  if (cat.tipo === 'maquinaria') {
    const existe = cat.equipos.some((e) => e.id === renglonId) || cat.servicios.some((s) => s.id === renglonId);
    if (!existe) return null;
    return {
      ...cat,
      equipos: cat.equipos.map((e) => ({ ...e, productos: e.id === renglonId ? con(e.productos) : sin(e.productos) })),
      servicios: cat.servicios.map((s) => ({ ...s, productos: s.id === renglonId ? con(s.productos) : sin(s.productos) })),
    };
  }
  const existe = renglonId === 'banco' || cat.productos.some((p) => p.id === renglonId);
  if (!existe) return null;
  return {
    ...cat,
    productos: cat.productos.map((p) => ({ ...p, productos: p.id === renglonId ? con(p.productos) : sin(p.productos) })),
    material_banco: { ...cat.material_banco, productos: renglonId === 'banco' ? con(cat.material_banco.productos) : sin(cat.material_banco.productos) },
  };
}

/**
 * EL PRECIO VIVE EN LA FICHA DEL TIPO (2026-10-19).
 *
 * "Que cuando se haga un cambio en algo que tiene relación con otro ya no se
 * haga doble trabajo, solo se haga una vez." Antes un equipo se daba de alta
 * en Inventario y OTRA vez en Tarifas y condiciones, y se ligaban a mano.
 * Ahora cada ficha de Inventario sin aliado —el TIPO: la retroexcavadora, la
 * base hidráulica, la pipa de 10 m³— es dueña de sus renglones del tabulador
 * (los que la traen en `productos`): se dan de alta, se editan y se quitan
 * desde la ficha. Tarifas y condiciones solo los enseña y guarda lo general.
 *
 * El motor no cambia: los renglones siguen en el tabulador con el mismo id,
 * así que los documentos ya emitidos y sus totales no se mueven.
 */
export type ClaseRenglon = 'equipo' | 'servicio' | 'material';
export interface SeccionCotizador { tipo: CotizadorTipo; clase: ClaseRenglon }

/**
 * Dónde vive en el cotizador lo de cada línea. Null: la línea no tiene cotizador (se pide con el formulario).
 *
 * Asfalto, materiales y venta (2026-11-02, "que se coticen en automático"):
 * van como servicios del tabulador de maquinaria, cada uno con su unidad
 * (m², pieza, equipo). Basta ponerle precio a su ficha para que su cotizador
 * del sitio lo ofrezca.
 */
export function seccionDeLinea(linea: string | null | undefined): SeccionCotizador | null {
  if (linea === LINEA_MAQUINARIA) return { tipo: 'maquinaria', clase: 'equipo' };
  if (linea === LINEA_TRANSPORTE || linea === LINEA_ASFALTO || linea === LINEA_MATERIALES || linea === LINEA_VENTA) {
    return { tipo: 'maquinaria', clase: 'servicio' };
  }
  if (linea === LINEA_TRITURADOS) return { tipo: 'triturados', clase: 'material' };
  return null;
}

/** Un renglón tal como se edita desde la ficha. */
export interface RenglonDeFicha {
  /** Ausente: renglón nuevo (el id se genera al guardar). */
  id?: string;
  nombre: string;
  /** Equipo: precio por hora de trabajo (2026-10-29). */
  precio_hora?: number;
  /** Equipo: qué flete se cobra (clave de `fletes`). */
  flete_tipo?: string;
  /** Servicio: por su unidad. Material: por tonelada. */
  precio?: number;
  /** Servicio: en qué se cobra (`UNIDADES_DE_SERVICIO`; 2026-11-02). Sin el campo, la que ya tenía. */
  unidad?: string;
  /** Servicio: el bloque de condiciones que se imprime. */
  cond?: string;
  /** Servicio: precio por viaje en cada zona (el agua, 2026-10-29). Null: deja de cobrar por zona. */
  precios_zona?: Record<string, number> | null;
}

const deLaFicha = (productId: number) => (r: { productos?: number[] }) => (r.productos ?? []).includes(productId);

/** Los renglones de una ficha en la sección de su línea, y si están ocultos. */
export function renglonesDeFicha(cat: CatalogoCotizador, clase: ClaseRenglon, productId: number): { renglones: RenglonDeFicha[]; oculto: boolean } {
  const es = deLaFicha(productId);
  if (cat.tipo === 'maquinaria' && clase === 'equipo') {
    const rs = cat.equipos.filter(es);
    return { renglones: rs.map((e) => ({ id: e.id, nombre: e.nombre, precio_hora: Math.round(precioHoraDe(cat, e) * 100) / 100, flete_tipo: e.flete_tipo })), oculto: rs.length > 0 && rs.every((e) => e.oculto) };
  }
  if (cat.tipo === 'maquinaria' && clase === 'servicio') {
    const rs = cat.servicios.filter(es);
    return { renglones: rs.map((s) => ({ id: s.id, nombre: s.nombre, precio: s.precio, unidad: s.unidad || 'viaje', cond: s.cond, ...(porZona(s) ? { precios_zona: { ...s.precios_zona } } : {}) })), oculto: rs.length > 0 && rs.every((s) => s.oculto) };
  }
  if (cat.tipo === 'triturados' && clase === 'material') {
    const rs = cat.productos.filter(es);
    return { renglones: rs.map((p) => ({ id: p.id, nombre: p.nombre, precio: p.precio_ton })), oculto: rs.length > 0 && rs.every((p) => p.oculto) };
  }
  return { renglones: [], oculto: false };
}

/** Un id corto y legible que no choque con los del tabulador (los documentos lo guardan). */
export function idDeRenglon(nombre: string, usados: Iterable<string>): string {
  const base = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32) || 'renglon';
  const ya = new Set(usados);
  if (!ya.has(base)) return base;
  for (let i = 2; ; i++) {
    const id = `${base}_${i}`;
    if (!ya.has(id)) return id;
  }
}

/** Todos los ids del tabulador, de cualquier sección. */
function idsDe(cat: CatalogoCotizador): string[] {
  return cat.tipo === 'maquinaria'
    ? [...cat.equipos.map((e) => e.id), ...cat.servicios.map((s) => s.id)]
    : [...cat.productos.map((p) => p.id), 'banco'];
}

/** Cambia los renglones de la ficha en su lugar; si no tenía, los nuevos van al final. */
function reemplazar<T>(lista: T[], es: (x: T) => boolean, nuevos: T[]): T[] {
  const i = lista.findIndex(es);
  const resto = lista.filter((x) => !es(x));
  if (i < 0) return [...resto, ...nuevos];
  const antes = lista.slice(0, i).filter((x) => !es(x)).length;
  return [...resto.slice(0, antes), ...nuevos, ...resto.slice(antes)];
}

/** Icono de un equipo nuevo, por su nombre (2026-10-29: el Bob Cat salía como excavadora). */
function iconoDeEquipo(nombre: string): string {
  const n = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const martillo = n.includes('martillo');
  if (/bob ?cat|minicargador/.test(n)) return 'minicargador';
  if (n.includes('retro')) return martillo ? 'retro_mart' : 'retro';
  if (n.includes('motoconform')) return 'moto';
  if (/vibro|compactador/.test(n)) return 'vibro';
  return martillo ? 'martillo_exc' : 'excavadora';
}

/** Icono de un servicio nuevo, por su bloque de condiciones (o, si no dice, por su línea). */
const ICONO_SERVICIO: Record<string, string> = { pipa: 'pipa', banco: 'banco', retiro: 'retiro', asfalto: 'asfalto', materiales: 'block', venta: 'venta' };
const ICONO_DE_LINEA: Record<string, string> = { [LINEA_ASFALTO]: 'asfalto', [LINEA_MATERIALES]: 'block', [LINEA_VENTA]: 'venta' };

/**
 * Deja los renglones de la ficha como vienen: actualiza los que traen id,
 * crea los nuevos ligados a ella y quita los que ya no vienen. El resto del
 * tabulador no se toca. Un id que no es de esta ficha cuenta como nuevo: desde
 * una ficha no se puede reescribir el renglón de otra.
 */
export function aplicarRenglonesDeFicha(
  cat: CatalogoCotizador,
  clase: ClaseRenglon,
  productId: number,
  renglones: RenglonDeFicha[],
  opciones: { oculto: boolean; linea: string },
): CatalogoCotizador {
  const es = deLaFicha(productId);
  const usados = new Set(idsDe(cat));
  const oculto = opciones.oculto || undefined;
  const idPara = <T extends { id: string }>(previos: Map<string, T>, r: RenglonDeFicha): { id: string; ya: T | undefined } => {
    const ya = r.id ? previos.get(r.id) : undefined;
    const id = ya?.id ?? idDeRenglon(r.nombre, usados);
    usados.add(id);
    return { id, ya };
  };

  if (cat.tipo === 'maquinaria' && clase === 'equipo') {
    const previos = cat.equipos.filter(es);
    const porId = new Map(previos.map((e) => [e.id, e]));
    const icono = previos[0]?.icono ?? iconoDeEquipo(renglones[0]?.nombre ?? '');
    const nuevos: EquipoCotizador[] = renglones.map((r) => {
      const { id, ya } = idPara(porId, r);
      // Al guardarse con precio por hora, la tarifa por día de antes ya no tiene nada que decir.
      const previo: Partial<EquipoCotizador> = ya ? { ...ya } : { icono, proveedor_id: null, productos: [productId] };
      delete previo.tarifas;
      return {
        ...previo,
        id,
        nombre: r.nombre.trim(),
        flete_tipo: r.flete_tipo ?? ya?.flete_tipo ?? Object.keys(cat.fletes)[0] ?? 'Excavadora',
        precio_hora: r.precio_hora ?? (ya ? precioHoraDe(cat, ya) : 0),
        oculto,
      } as EquipoCotizador;
    });
    return { ...cat, equipos: reemplazar(cat.equipos, es, nuevos) };
  }

  if (cat.tipo === 'maquinaria' && clase === 'servicio') {
    const previos = cat.servicios.filter(es);
    const porId = new Map(previos.map((s) => [s.id, s]));
    const nuevos: ServicioCotizador[] = renglones.map((r) => {
      const { id, ya } = idPara(porId, r);
      const precio = r.precio ?? ya?.precio ?? 0;
      const condLinea = COND_DE_LINEA[opciones.linea];
      const cond = r.cond ?? ya?.cond ?? (condLinea && cat.condiciones[condLinea] ? condLinea : Object.keys(cat.condiciones)[0] ?? 'renta');
      // Con un solo precio sugerido, ese ES el precio; con varios (retiros), se
      // conservan y se suma el nuevo para que siga a la mano en el panel.
      const presets = ya && ya.presets.length > 1
        ? [...new Set([...ya.presets, precio])].sort((a, b) => a - b)
        : [precio];
      return {
        ...(ya ?? { icono: ICONO_SERVICIO[cond] ?? previos[0]?.icono ?? ICONO_DE_LINEA[opciones.linea] ?? 'retiro', proveedor_id: null, productos: [productId] }),
        id,
        nombre: r.nombre.trim(),
        precio,
        presets,
        unidad: r.unidad || ya?.unidad || unidadDeLinea(opciones.linea),
        cond,
        linea: opciones.linea,
        // Por zona: lo que mande la ficha; sin el campo, lo que ya tenía.
        precios_zona: r.precios_zona === null ? undefined : r.precios_zona ?? ya?.precios_zona,
        oculto,
      } as ServicioCotizador;
    });
    return { ...cat, servicios: reemplazar(cat.servicios, es, nuevos) };
  }

  if (cat.tipo === 'triturados' && clase === 'material') {
    const previos = cat.productos.filter(es);
    const porId = new Map(previos.map((p) => [p.id, p]));
    const nuevos: ProductoTriturado[] = renglones.map((r) => {
      const { id, ya } = idPara(porId, r);
      return {
        ...(ya ?? { proveedor_id: null, productos: [productId] }),
        id,
        nombre: r.nombre.trim(),
        precio_ton: r.precio ?? ya?.precio_ton ?? 0,
        oculto,
      } as ProductoTriturado;
    });
    return { ...cat, productos: reemplazar(cat.productos, es, nuevos) };
  }

  return cat;
}

/**
 * Lo que guarda Tarifas y condiciones: lo general del tabulador con los
 * renglones TAL COMO ESTÁN GUARDADOS, porque son de cada ficha. Así una
 * pantalla de Tarifas abierta desde antes no deshace un precio que se acaba
 * de cambiar en una ficha. Un tipo de flete que use algún equipo no se puede
 * perder: si no viene, se conserva con su monto.
 */
export function conRenglonesGuardados(nuevo: CatalogoCotizador, guardado: CatalogoCotizador): CatalogoCotizador {
  if (nuevo.tipo === 'maquinaria' && guardado.tipo === 'maquinaria') {
    const fletes = { ...nuevo.fletes };
    for (const e of guardado.equipos) if (!(e.flete_tipo in fletes)) fletes[e.flete_tipo] = guardado.fletes[e.flete_tipo] ?? 0;
    return { ...nuevo, fletes, equipos: guardado.equipos, servicios: guardado.servicios };
  }
  if (nuevo.tipo === 'triturados' && guardado.tipo === 'triturados') {
    return { ...nuevo, productos: guardado.productos };
  }
  return nuevo;
}

/**
 * El tabulador sin lo oculto, para ELEGIR al cotizar. Lo que ya trae la
 * cotización (`enUso`, al volver a cotizar un documento viejo) se queda
 * aunque esté oculto: si no, la partida no tendría con qué pintarse.
 */
export function soloVisibles(cat: CatalogoCotizador, enUso: Iterable<string> = []): CatalogoCotizador {
  const usa = new Set(enUso);
  const ve = (r: { id: string; oculto?: boolean }) => !r.oculto || usa.has(r.id);
  if (cat.tipo === 'maquinaria') return { ...cat, equipos: cat.equipos.filter(ve), servicios: cat.servicios.filter(ve) };
  return { ...cat, productos: cat.productos.filter(ve) };
}

/** Qué pidió el cliente en un renglón, en texto (para el correo y el alcance). */
export interface PartidaAnalizada {
  partida: PartidaCotizador;
  linea: string;
  concepto: string;
  /** Productos del catálogo ligados al renglón. */
  productos: number[];
  /** Respaldo de los tabuladores viejos: el dueño capturado a mano. */
  proveedorId: number | null;
}

/**
 * Cada partida con su línea, su texto y sus productos. Es la base para
 * partir una solicitud por línea y ofrecer cada parte a quien le toca.
 */
export function analizarPartidas(cat: CatalogoCotizador, partidas: PartidaCotizador[]): PartidaAnalizada[] {
  const tri = trituradosDe(cat);
  const out: PartidaAnalizada[] = [];
  for (const p of partidas) {
    if (p.tipo === 'equipo' && cat.tipo === 'maquinaria') {
      const eq = cat.equipos.find((e) => e.id === p.id);
      if (!eq) continue;
      const tiempo = [p.dias ? `${p.dias} ${p.dias === 1 ? 'día' : 'días'}` : '', p.horas ? `${p.horas} h` : ''].filter(Boolean).join(' y ');
      const unidades = (p.cantidad ?? 1) > 1 ? ` × ${p.cantidad}` : '';
      out.push({ partida: p, linea: LINEA_MAQUINARIA, concepto: `${eq.nombre}${unidades}${tiempo ? ` · ${tiempo}` : ''}`, productos: eq.productos ?? [], proveedorId: eq.proveedor_id ?? null });
    } else if (p.tipo === 'servicio' && cat.tipo === 'maquinaria') {
      const sv = cat.servicios.find((x) => x.id === p.id);
      if (!sv) {
        // Escrito a mano: sin ficha ni proveedor; se reparte como maquinaria.
        if (p.id === SERVICIO_A_MANO && p.nombre?.trim()) {
          out.push({ partida: p, linea: (p.categoria && cotizadorDelSitio(p.categoria)?.linea) || LINEA_MAQUINARIA, concepto: `${p.nombre.trim()} · ${p.cantidad ?? 1} ${p.unidad || 'servicio'}(s)`, productos: [], proveedorId: null });
        }
        continue;
      }
      const zona = porZona(sv) ? zonaPrecioDe(cat, p.zona) : null;
      out.push({ partida: p, linea: lineaDeServicio(sv), concepto: `${sv.nombre} · ${p.cantidad ?? 1} ${sv.unidad}(s)${zona ? ` · ${zona.nombre}` : ''}`, productos: sv.productos ?? [], proveedorId: sv.proveedor_id ?? null });
    } else if (p.tipo === 'material' && tri) {
      const prod = tri.productos.find((x) => x.id === p.id);
      const camion = camionDe(tri, p.camion);
      out.push({ partida: p, linea: LINEA_TRITURADOS, concepto: `${prod?.nombre ?? p.nombre ?? 'Material'} · ${p.toneladas ?? 0} ton${camion ? ` · en ${camion.nombre.toLowerCase()}` : ''}`, productos: prod?.productos ?? [], proveedorId: prod?.proveedor_id ?? null });
    } else if (p.tipo === 'zona' && tri) {
      const prod = tri.productos.find((x) => x.id === p.producto_id);
      const zona = tri.zonas.find((z) => z.id === p.zona_id);
      if (!prod) continue;
      out.push({ partida: p, linea: LINEA_TRITURADOS, concepto: `${prod.nombre} · ${p.viajes ?? 1} viaje(s)${zona ? ` · ${zona.nombre}` : ''}`, productos: prod.productos ?? [], proveedorId: prod.proveedor_id ?? null });
    } else if (p.tipo === 'banco' && tri) {
      out.push({ partida: p, linea: LINEA_TRITURADOS, concepto: `${tri.material_banco.nombre} · ${p.m3 ?? 0} m³`, productos: tri.material_banco.productos ?? [], proveedorId: tri.material_banco.proveedor_id ?? null });
    }
  }
  return out;
}

/** Nombre y descripción de cada cotizador. Lo usan el menú y las dos portadas. */
export const COTIZADORES_META: Record<CotizadorTipo, { titulo: string; resumen: string; icono: string; ruta: string }> = {
  maquinaria: {
    titulo: 'Maquinaria',
    resumen: 'Renta de equipo con operador y diésel. Se cobra por hora de trabajo.',
    icono: 'excavadora',
    ruta: '/cotizador/maquinaria',
  },
  triturados: {
    titulo: 'Triturados',
    // Sin "material de banco" desde 2026-10-21: ya no se cotiza aquí (va por viaje, en maquinaria).
    resumen: 'Grava, arena, base, sub base, sello, piedra y CNC. Por tonelada en planta (sin IVA ni flete); el flete a obra es opcional.',
    icono: 'material',
    ruta: '/cotizador/triturados',
  },
};

/** Un renglón del tabulador, para saber a qué cotizador del sitio pertenece. */
export interface RenglonDelSitio {
  clase: ClaseRenglon;
  linea: string;
  cond?: string;
}

/**
 * LOS COTIZADORES DEL SITIO, UNO POR CATEGORÍA (2026-11-02).
 *
 * Pedido del dueño: "cambiar el menú de cotizadores y acomodarlos por
 * categorías", en este orden, aunque alguna todavía no tenga precios. Por
 * dentro siguen siendo DOS tabuladores: cada cotizador del sitio es una vista
 * de uno de ellos con solo lo de su categoría. El precio sigue en la ficha del
 * tipo, y una categoría sin renglones se llena sola el día que su ficha tenga
 * precio (Inventario › la ficha › Precio en el cotizador).
 *
 * Triturados no venía en la lista del dueño; se queda junto a los materiales
 * para no esconder un cotizador que ya funciona.
 *
 * El panel y los accesos directos siguen con los dos tabuladores completos.
 */
export interface CotizadorDelSitio {
  /** /cotizador/<clave>. */
  clave: string;
  titulo: string;
  /** Una línea bajo el nombre, en el menú y en la portada del cotizador. */
  resumen: string;
  tipo: CotizadorTipo;
  /** La categoría: con ella se pide a la medida mientras no haya nada con precio. */
  linea: string;
  /** A dónde se pide a la medida, si no es el formulario con la categoría puesta. */
  aLaMedida?: string;
  icono: string;
  /** Qué renglones del tabulador entran. */
  incluye: (r: RenglonDelSitio) => boolean;
}

export const COTIZADORES_SITIO: readonly CotizadorDelSitio[] = [
  {
    clave: 'maquinaria',
    titulo: 'Renta de maquinaria',
    resumen: 'Por hora, con operador y diésel',
    tipo: 'maquinaria',
    linea: LINEA_MAQUINARIA,
    icono: 'excavadora',
    incluye: (r) => r.clase === 'equipo',
  },
  {
    clave: 'agua',
    titulo: 'Servicios de agua',
    resumen: 'Pipas de 10 y 20 m³, por viaje',
    tipo: 'maquinaria',
    linea: LINEA_TRANSPORTE,
    icono: 'agua',
    incluye: (r) => r.clase === 'servicio' && r.linea === LINEA_TRANSPORTE && r.cond === 'pipa',
  },
  {
    clave: 'acarreos',
    titulo: 'Acarreos',
    resumen: 'Retiro de material en volteo, por viaje',
    tipo: 'maquinaria',
    linea: LINEA_TRANSPORTE,
    icono: 'retiro',
    incluye: (r) => r.clase === 'servicio' && r.linea === LINEA_TRANSPORTE && r.cond !== 'pipa',
  },
  {
    clave: 'carpeta-asfaltica',
    titulo: 'Carpeta asfáltica',
    resumen: 'Riego de impregnación y carpeta asfáltica',
    tipo: 'maquinaria',
    linea: LINEA_ASFALTO,
    icono: 'asfalto',
    incluye: (r) => r.clase === 'servicio' && r.linea === LINEA_ASFALTO,
  },
  {
    clave: 'materiales',
    titulo: 'Materiales de construcción',
    resumen: 'Block de concreto',
    tipo: 'maquinaria',
    linea: LINEA_MATERIALES,
    icono: 'block',
    incluye: (r) => r.clase === 'servicio' && r.linea === LINEA_MATERIALES,
  },
  {
    clave: 'triturados',
    titulo: 'Triturados',
    resumen: 'Grava, arena y base por tonelada',
    tipo: 'triturados',
    linea: LINEA_TRITURADOS,
    icono: 'material',
    incluye: (r) => r.clase === 'material',
  },
  {
    clave: 'venta-de-maquinaria',
    titulo: 'Venta de maquinaria',
    resumen: 'Equipos a la venta con la red de proveedores',
    tipo: 'maquinaria',
    linea: LINEA_VENTA,
    // Como el botón de su página de venta: Contacto con «Comprar maquinaria» ya elegido.
    aLaMedida: '/contacto?necesidad=Comprar%20maquinaria',
    icono: 'venta',
    incluye: (r) => r.clase === 'servicio' && r.linea === LINEA_VENTA,
  },
];

/** Una pregunta del cuestionario de una categoría. */
export interface PreguntaCuestionario {
  clave: string;
  etiqueta: string;
  ejemplo?: string;
  obligatoria?: boolean;
  /** Texto largo (caja de varias líneas). */
  largo?: boolean;
  max: number;
}

/**
 * CUESTIONARIOS POR CATEGORÍA (2026-11-06, el dueño: "venta de maquinaria, que
 * aparezca una encuesta…; las preguntas son equipo que busca, marca, modelo,
 * año y características; eso es un cuestionario que responde el cliente, y el
 * encargado responde ya con el costo"). En el sitio sale en lugar de los
 * productos; lo contestado va como renglón «Por cotizar» (el equipo, marca,
 * modelo y año) y completo en las notas, y en el panel se le pone el costo.
 */
export const CUESTIONARIOS: Record<string, PreguntaCuestionario[]> = {
  'venta-de-maquinaria': [
    { clave: 'equipo', etiqueta: '¿Qué equipo busca?', ejemplo: 'Ej. Retroexcavadora, excavadora de 20 t', obligatoria: true, max: 80 },
    { clave: 'marca', etiqueta: 'Marca', ejemplo: 'Ej. Caterpillar', max: 40 },
    { clave: 'modelo', etiqueta: 'Modelo', ejemplo: 'Ej. 416F', max: 40 },
    { clave: 'anio', etiqueta: 'Año', ejemplo: 'Ej. 2018, o de 2015 en adelante', max: 30 },
    { clave: 'caracteristicas', etiqueta: 'Características', ejemplo: 'Horas de uso, aditamentos, para qué trabajo, presupuesto…', largo: true, max: 600 },
  ],
};

/** El renglón de lo contestado: «Retroexcavadora · Caterpillar · 416F · 2018» (sin las características, que van en las notas). */
export function renglonDeCuestionario(clave: string, respuestas: Record<string, string>): string {
  const preguntas = CUESTIONARIOS[clave] ?? [];
  return preguntas
    .filter((p) => !p.largo)
    .map((p) => (respuestas[p.clave] ?? '').trim())
    .filter(Boolean)
    .join(' · ')
    .slice(0, 120);
}

/** Lo contestado, pregunta por pregunta, para las notas de la solicitud. */
export function notasDeCuestionario(clave: string, respuestas: Record<string, string>): string {
  return (CUESTIONARIOS[clave] ?? [])
    .map((p) => [p.etiqueta.replace(/^¿|\?$/g, ''), (respuestas[p.clave] ?? '').trim()] as const)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

export function cotizadorDelSitio(clave: string): CotizadorDelSitio | null {
  return COTIZADORES_SITIO.find((c) => c.clave === clave) ?? null;
}

/** A qué cotizador del sitio lleva un renglón del tabulador ("Cotizar" en su ficha). */
export function cotizadorDeRenglon(tipo: CotizadorTipo, r: RenglonDelSitio): CotizadorDelSitio | null {
  return COTIZADORES_SITIO.find((c) => c.tipo === tipo && c.incluye(r)) ?? null;
}

/** El tabulador con solo lo de ese cotizador. El cálculo no cambia: es el mismo motor. */
export function catalogoDelSitio(cat: CatalogoCotizador, c: CotizadorDelSitio): CatalogoCotizador {
  return filtrarTabulador(cat, c.incluye);
}

/**
 * Varios cotizadores del sitio en UNA cotización (2026-11-03, pedido del
 * dueño: "si se quiere otro servicio, poner las demás opciones"): el de agua
 * con acarreos, la renta con agua… Solo los del mismo tabulador; triturados se
 * cotiza aparte.
 */
export function catalogoDeVarios(cat: CatalogoCotizador, claves: readonly string[]): CatalogoCotizador {
  const cotizadores = claves.map(cotizadorDelSitio).filter((c): c is CotizadorDelSitio => !!c && c.tipo === cat.tipo);
  return filtrarTabulador(cat, (r) => cotizadores.some((c) => c.incluye(r)));
}

function filtrarTabulador(cat: CatalogoCotizador, incluye: (r: RenglonDelSitio) => boolean): CatalogoCotizador {
  if (cat.tipo === 'maquinaria') {
    return {
      ...cat,
      equipos: cat.equipos.filter(() => incluye({ clase: 'equipo', linea: LINEA_MAQUINARIA })),
      servicios: cat.servicios.filter((s) => incluye({ clase: 'servicio', linea: lineaDeServicio(s), cond: s.cond })),
    };
  }
  return incluye({ clase: 'material', linea: LINEA_TRITURADOS }) ? cat : { ...cat, productos: [] };
}

/** "renta de maquinaria", "renta de maquinaria y servicios de agua", "a, b y c": las categorías en una frase. */
export function categoriasEnTexto(claves: readonly string[]): string {
  const t = claves.map((k) => cotizadorDelSitio(k)?.titulo.toLowerCase()).filter((x): x is string => !!x);
  return t.length <= 1 ? (t[0] ?? '') : `${t.slice(0, -1).join(', ')} y ${t[t.length - 1]}`;
}

/** ¿Hay algo que elegir? Sin esto, el cotizador de la categoría pide a la medida. */
export function hayQueElegir(cat: CatalogoCotizador): boolean {
  const ve = (r: { oculto?: boolean }) => !r.oculto;
  return cat.tipo === 'maquinaria' ? cat.equipos.some(ve) || cat.servicios.some(ve) : cat.productos.some(ve);
}

/** Los dos tabuladores: una cotización puede llevar cualquier categoría (2026-11-03). */
export interface Tabuladores {
  maquinaria: CatalogoMaquinaria | null;
  triturados: CatalogoTriturados | null;
}

/**
 * EL TABULADOR DE UNA COTIZACIÓN CON VARIAS CATEGORÍAS (2026-11-03): las de
 * maquinaria con solo lo suyo y, si va triturados, su tabulador viajando junto
 * (`combinar`). Lo usan el sitio, el panel y el enlace.
 */
export function catalogoDeCategorias(tab: Tabuladores, activas: readonly string[]): CatalogoCotizador | null {
  const deMaquinaria = activas.filter((k) => cotizadorDelSitio(k)?.tipo === 'maquinaria');
  const conTriturados = activas.includes('triturados') ? tab.triturados : null;
  if (deMaquinaria.length && tab.maquinaria) {
    const base = catalogoDeVarios(tab.maquinaria, deMaquinaria) as CatalogoMaquinaria;
    return conTriturados ? combinar(base, conTriturados) : base;
  }
  return tab.triturados ?? tab.maquinaria;
}

/**
 * LAS PRESENTACIONES DE UNA FICHA QUE ESPERA PRECIO (2026-11-06, el block: "se
 * vende por pieza, tarima, viaje Torton y viaje tráiler; pendiente precio,
 * dejar campo para poner precio"). Son sus renglones del tabulador aunque
 * estén ocultos: mientras no tienen precio, la categoría se cotiza a la medida
 * y cada presentación sale como su propia tarjeta, con su unidad.
 */
export function presentacionesDeFicha(tab: Tabuladores, productId: number): Array<{ id: string; nombre: string; unidad: string }> {
  return (tab.maquinaria?.servicios ?? [])
    .filter((s) => (s.productos ?? []).includes(productId))
    .map((s) => ({ id: s.id, nombre: s.nombre, unidad: s.unidad || 'pieza' }));
}

/**
 * Lo que se ofrece a la medida de una categoría sin precio: cada producto del
 * catálogo y, si su ficha ya tiene presentaciones, una tarjeta por cada una.
 * `clave` distingue las presentaciones de un mismo producto. Lo usan el sitio,
 * el panel y el enlace.
 */
export function productosALaMedida(
  tab: Tabuladores,
  items: Array<{ id: number; name: string; priceUnit: string | null }>,
): Array<{ id: number; clave: string; nombre: string; unidad: string | null }> {
  return items.flatMap((p) => {
    const pres = presentacionesDeFicha(tab, p.id);
    return pres.length
      ? pres.map((r) => ({ id: p.id, clave: `${p.id}:${r.id}`, nombre: r.nombre, unidad: r.unidad }))
      : [{ id: p.id, clave: String(p.id), nombre: p.name, unidad: p.priceUnit }];
  });
}

/** ¿La categoría tiene algo con precio de lista? Entonces se cotiza con su cotizador; si no, a la medida. */
export function categoriaConPrecio(tab: Tabuladores, clave: string): boolean {
  const c = cotizadorDelSitio(clave);
  const cat = c ? tab[c.tipo] : null;
  return !!c && !!cat && hayQueElegir(catalogoDelSitio(cat, c));
}

/** De qué categoría del sitio es una partida; lo escrito a mano no tiene (null). */
function categoriaDePartida(cat: CatalogoCotizador, p: PartidaCotizador): string | null {
  if (cat.tipo === 'triturados' || esDeTriturados(p)) return 'triturados';
  if (p.tipo === 'equipo') return 'maquinaria';
  if (p.tipo === 'servicio' && p.id === SERVICIO_A_MANO) return p.categoria && cotizadorDelSitio(p.categoria) ? p.categoria : null;
  const sv = p.tipo === 'servicio' ? servicioDe(cat, p.id) : undefined;
  return sv ? cotizadorDeRenglon('maquinaria', { clase: 'servicio', linea: lineaDeServicio(sv), cond: sv.cond })?.clave ?? null : null;
}

/** Las categorías que traen unas partidas: con ellas abre una cotización guardada (panel, 2026-11-03). */
export function categoriasDePartidas(cat: CatalogoCotizador, partidas: PartidaCotizador[]): string[] {
  return [...new Set(partidas.map((p) => categoriaDePartida(cat, p)).filter((k): k is string => !!k))];
}

/**
 * EL TÍTULO DEL DOCUMENTO SEGÚN LO QUE LLEVA (2026-11-04): «Cotización de
 * renta de maquinaria y servicios de agua», no «de maquinaria» para todo lo
 * que va en ese tabulador. `extra`: categorías que van sin partida (lo que el
 * sitio pide a la medida). Sin ninguna conocida, el del tabulador.
 */
export function tituloDe(cat: CatalogoCotizador, partidas: PartidaCotizador[], extra: readonly string[] = []): string {
  const texto = categoriasEnTexto([...new Set([...categoriasDePartidas(cat, partidas), ...extra])]);
  return `Cotización de ${texto || COTIZADORES_META[cat.tipo].titulo.toLowerCase()}`;
}

/**
 * EL SALUDO DEL DOCUMENTO SEGÚN LO QUE SE COTIZA (2026-11-02).
 *
 * El del tabulador de maquinaria dice "cotización de renta de maquinaria", y
 * una cotización de solo agua o solo block no lo es. Si todas las partidas son
 * de un mismo cotizador del sitio que no es el de renta, esa frase se cambia
 * por el nombre de su categoría. Si Dirección escribió otro saludo en Tarifas
 * (sin esa frase), sale tal cual; una cotización mezclada, también.
 */
export function saludoDe(cat: CatalogoCotizador, partidas: PartidaCotizador[]): string {
  if (cat.tipo !== 'maquinaria' || !partidas.length) return cat.saludo;
  const claves = new Set(partidas.map((p) => categoriaDePartida(cat, p)));
  // Con algo escrito a mano no se sabe de qué categoría es: el saludo de siempre.
  if (claves.has(null)) return cat.saludo;
  const lista = [...claves] as string[];
  if (lista.length === 1 && lista[0] === 'maquinaria') return cat.saludo;
  // Una sola categoría, o varias juntas ("renta de maquinaria y servicios de agua", 2026-11-03).
  const texto = categoriasEnTexto(lista);
  return texto ? cat.saludo.replace(/renta de maquinaria/i, texto) : cat.saludo;
}
