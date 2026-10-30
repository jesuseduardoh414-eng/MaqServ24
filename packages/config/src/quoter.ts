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
});

const zonaSchema = z.object({
  id: z.string().min(1).max(40),
  nombre: z.string().min(1).max(160),
  flete: z.number().min(0),
  precios: z.record(z.string(), z.number().min(0)).optional(),
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
    precio: z.number().min(0).max(10_000_000),
    cantidad: z.number().int().min(1).max(999).default(1),
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
        if (p.id !== SERVICIO_A_MANO || !nombre || precio <= 0) continue;
        servicios += precio * cantidad;
        renglones.push({
          clase: 'servicio',
          id: SERVICIO_A_MANO,
          nombre,
          concepto: nombre.toUpperCase(),
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
  if (partidas.some((p) => p.tipo === 'material') && cat.condiciones.material) bloques.push(cat.condiciones.material);
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
      const ton = decimal(p.toneladas);
      if (!nombre || ton <= 0 || precioTon <= 0) continue;
      const importe = precioTon * ton;
      materiales += importe;
      renglones.push({
        clase: 'material',
        id: p.id,
        nombre,
        concepto: nombre.toUpperCase(),
        unidad: 'TON',
        cantidad: ton,
        pu: r2(precioTon),
        importe: r2(importe),
      });
      const fleteTon = decimal(p.flete_ton);
      if (fleteTon > 0) {
        const etiqueta = (p.flete_zona ?? '').trim();
        const importeFlete = fleteTon * ton;
        fletes += importeFlete;
        renglones.push({
          clase: 'flete',
          concepto: etiqueta ? `FLETE ${etiqueta.toUpperCase()}` : 'FLETE A OBRA',
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
  return catalogo.tipo === 'maquinaria'
    ? calcularMaquinaria(catalogo, partidas as PartidaMaquinaria[], opciones)
    : calcularTriturados(catalogo, partidas as PartidaTriturados[], opciones);
}

/** ¿Hay algo que cobrar? Un carrito de renglones en cero no es una cotización. */
export function tieneImporte(calc: CalculoCotizacion): boolean {
  return calc.renglones.length > 0 && calc.total > 0;
}

// ---------------------------------------------------------------------------
// Los pasos del flujo (el "por procesos" que pidió el cliente)
// ---------------------------------------------------------------------------

export interface PasoCotizador {
  clave: string;
  titulo: string;
  /** Una línea que dice qué se hace aquí. Se pinta bajo el título del paso. */
  ayuda: string;
}

/**
 * El orden NO es cosmético: cada paso depende del anterior.
 *
 * Las horas que se cobran (con su mínimo; antes, el tramo día/semana/mes) se
 * piden en el paso 3; por eso elegir equipo y decir cuánto tiempo son pasos distintos.
 * En la app original todo estaba en una sola pantalla y el usuario veía el
 * precio cambiar solo al teclear los días, sin entender por qué.
 */
export const PASOS_MAQUINARIA: PasoCotizador[] = [
  { clave: 'obra', titulo: 'Datos de la obra', ayuda: 'Para quién es y dónde se entrega el equipo.' },
  { clave: 'equipos', titulo: 'Equipos y servicios', ayuda: 'Elige la maquinaria, el agua en pipas o el retiro de material. La maquinaria incluye operador y diésel.' },
  { clave: 'duracion', titulo: 'Duración', ayuda: 'Se cobra por hora de trabajo: cada día es una jornada, con un mínimo por equipo.' },
  { clave: 'servicios', titulo: 'Servicios', ayuda: 'Pipas de agua y retiro de material. Este paso es opcional.' },
  { clave: 'resumen', titulo: 'Resumen', ayuda: 'Revisa el documento antes de guardarlo o enviarlo.' },
];

export const PASOS_TRITURADOS: PasoCotizador[] = [
  // Tres pasos (2026-10-15): antes eran cinco, con una "Modalidad" abstracta
  // al frente y el flete por tonelada en un paso aparte. Ver pasos-triturados.tsx.
  { clave: 'obra', titulo: 'Datos de la obra', ayuda: 'Para quién es y dónde se entrega el material.' },
  { clave: 'pedido', titulo: 'Material', ayuda: 'Qué material y cuánto. Puedes combinar las dos formas: en planta por tonelada y puesto en obra por viaje.' },
  { clave: 'resumen', titulo: 'Factura y resumen', ayuda: 'Con o sin factura, y el documento tal como sale.' },
];

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
    } else if (p.tipo === 'material' && cat.tipo === 'triturados') {
      const prod = cat.productos.find((x) => x.id === p.id);
      const nombre = prod?.nombre ?? p.nombre ?? 'Material';
      sumar(prod?.proveedor_id, `${nombre} · ${p.toneladas ?? 0} ton`);
    } else if (p.tipo === 'zona' && cat.tipo === 'triturados') {
      const prod = cat.productos.find((x) => x.id === p.producto_id);
      const zona = cat.zonas.find((z) => z.id === p.zona_id);
      if (!prod) continue;
      sumar(
        prod.proveedor_id,
        `${prod.nombre} · ${p.viajes ?? 1} viaje(s)${zona ? ` · ${zona.nombre}` : ''}`,
      );
    } else if (p.tipo === 'banco' && cat.tipo === 'triturados') {
      sumar(cat.material_banco.proveedor_id, `${cat.material_banco.nombre} · ${p.m3 ?? 0} m³`);
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

/** Dónde vive en el cotizador lo de cada línea. Null: la línea no tiene cotizador (se pide con el formulario). */
export function seccionDeLinea(linea: string | null | undefined): SeccionCotizador | null {
  if (linea === LINEA_MAQUINARIA) return { tipo: 'maquinaria', clase: 'equipo' };
  if (linea === LINEA_TRANSPORTE) return { tipo: 'maquinaria', clase: 'servicio' };
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
  /** Servicio: por viaje. Material: por tonelada. */
  precio?: number;
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
    return { renglones: rs.map((s) => ({ id: s.id, nombre: s.nombre, precio: s.precio, cond: s.cond, ...(porZona(s) ? { precios_zona: { ...s.precios_zona } } : {}) })), oculto: rs.length > 0 && rs.every((s) => s.oculto) };
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

/** Icono de un servicio nuevo, por su bloque de condiciones. */
const ICONO_SERVICIO: Record<string, string> = { pipa: 'pipa', banco: 'banco', retiro: 'retiro' };

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
      const cond = r.cond ?? ya?.cond ?? Object.keys(cat.condiciones)[0] ?? 'renta';
      // Con un solo precio sugerido, ese ES el precio; con varios (retiros), se
      // conservan y se suma el nuevo para que siga a la mano en el panel.
      const presets = ya && ya.presets.length > 1
        ? [...new Set([...ya.presets, precio])].sort((a, b) => a - b)
        : [precio];
      return {
        ...(ya ?? { icono: ICONO_SERVICIO[cond] ?? previos[0]?.icono ?? 'retiro', unidad: 'viaje', proveedor_id: null, productos: [productId] }),
        id,
        nombre: r.nombre.trim(),
        precio,
        presets,
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
          out.push({ partida: p, linea: LINEA_MAQUINARIA, concepto: `${p.nombre.trim()} · ${p.cantidad ?? 1} ${p.unidad || 'servicio'}(s)`, productos: [], proveedorId: null });
        }
        continue;
      }
      const zona = porZona(sv) ? zonaPrecioDe(cat, p.zona) : null;
      out.push({ partida: p, linea: lineaDeServicio(sv), concepto: `${sv.nombre} · ${p.cantidad ?? 1} ${sv.unidad}(s)${zona ? ` · ${zona.nombre}` : ''}`, productos: sv.productos ?? [], proveedorId: sv.proveedor_id ?? null });
    } else if (p.tipo === 'material' && cat.tipo === 'triturados') {
      const prod = cat.productos.find((x) => x.id === p.id);
      out.push({ partida: p, linea: LINEA_TRITURADOS, concepto: `${prod?.nombre ?? p.nombre ?? 'Material'} · ${p.toneladas ?? 0} ton`, productos: prod?.productos ?? [], proveedorId: prod?.proveedor_id ?? null });
    } else if (p.tipo === 'zona' && cat.tipo === 'triturados') {
      const prod = cat.productos.find((x) => x.id === p.producto_id);
      const zona = cat.zonas.find((z) => z.id === p.zona_id);
      if (!prod) continue;
      out.push({ partida: p, linea: LINEA_TRITURADOS, concepto: `${prod.nombre} · ${p.viajes ?? 1} viaje(s)${zona ? ` · ${zona.nombre}` : ''}`, productos: prod.productos ?? [], proveedorId: prod.proveedor_id ?? null });
    } else if (p.tipo === 'banco' && cat.tipo === 'triturados') {
      out.push({ partida: p, linea: LINEA_TRITURADOS, concepto: `${cat.material_banco.nombre} · ${p.m3 ?? 0} m³`, productos: cat.material_banco.productos ?? [], proveedorId: cat.material_banco.proveedor_id ?? null });
    }
  }
  return out;
}

export function pasosDe(tipo: CotizadorTipo): PasoCotizador[] {
  return tipo === 'maquinaria' ? PASOS_MAQUINARIA : PASOS_TRITURADOS;
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
