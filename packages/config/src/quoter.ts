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

/** Los dos cotizadores. El resto del módulo se ramifica por esta clave. */
export const COTIZADOR_TIPOS = ['maquinaria', 'triturados'] as const;
export type CotizadorTipo = (typeof COTIZADOR_TIPOS)[number];

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
 * `mostrarPrecios: false` deja el flujo completo en el sitio público pero sin
 * importes: el visitante arma su requerimiento y lo envía, y el precio lo pone
 * una persona desde el panel. Está aquí porque publicar el tabulador completo
 * es una decisión comercial, no técnica, y se cambia sin tocar código.
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
  tarifas: z.object({ dia: z.number().min(0), semana: z.number().min(0), mes: z.number().min(0) }),
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
});

export const catalogoMaquinariaSchema = z.object({
  tipo: z.literal('maquinaria'),
  version: z.string().max(40),
  moneda: z.string().max(10),
  iva: z.number().min(0).max(1),
  jornada_horas: z.number().int().min(1).max(24),
  empresa: empresaSchema,
  firma: firmaSchema,
  publico: publicoSchema,
  saludo: z.string().max(800),
  tiers: z.array(tierSchema).min(1),
  municipios: z.array(z.string().max(80)).max(120),
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
  saludo: z.string().max(800),
  municipios: z.array(z.string().max(80)).max(120),
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
export type FirmaCotizador = z.infer<typeof firmaSchema>;
export type BloqueCondiciones = z.infer<typeof bloqueSchema>;
export type TierTarifa = z.infer<typeof tierSchema>;
export type EquipoCotizador = z.infer<typeof equipoSchema>;
export type ServicioCotizador = z.infer<typeof servicioSchema>;
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
  }),
  z.object({
    tipo: z.literal('servicio'),
    id: z.string().min(1).max(40),
    precio: z.number().min(0).max(10_000_000),
    cantidad: z.number().int().min(1).max(999).default(1),
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

/** Tramo tarifario según los días totales: 1-5 día · 6-15 semana · 16+ mes. */
export function tierDe(cat: CatalogoMaquinaria, dias: number): TierTarifa {
  const d = Math.max(1, entero(dias, 0));
  for (const t of cat.tiers) {
    if (d >= t.desde_dias && (t.hasta_dias === null || d <= t.hasta_dias)) return t;
  }
  return cat.tiers[cat.tiers.length - 1];
}

export const equipoDe = (cat: CatalogoMaquinaria, id: string): EquipoCotizador | null =>
  cat.equipos.find((e) => e.id === id) ?? null;

export const servicioDe = (cat: CatalogoMaquinaria, id: string): ServicioCotizador | null =>
  cat.servicios.find((s) => s.id === id) ?? null;

/**
 * Lo que cuesta UNA partida de equipo, con el tramo ya resuelto.
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
  const tier = tierDe(cat, dias);
  const tarifaDiaCatalogo = eq ? Number(eq.tarifas[tier.id as 'dia' | 'semana' | 'mes'] ?? eq.tarifas.dia) : 0;
  // Override: solo si trae un número > 0. Un campo vacío vuelve al tabulador.
  const negociado = p.precio_hora !== null && p.precio_hora !== undefined && Number(p.precio_hora) > 0;
  const tarifaHora = negociado ? decimal(p.precio_hora) : tarifaDiaCatalogo / jornada;
  const tarifaDia = tarifaHora * jornada;
  // Sin duración no se cobra: es un renglón que el usuario acaba de agregar y
  // todavía no configura. Cobrarle el flete por eso sería mentirle el total.
  const activo = dias >= 1 || horas >= 1;
  const horasTotales = (dias * jornada + horas) * cantidad;
  const tiempo = activo ? (dias * tarifaDia + horas * tarifaHora) * cantidad : 0;
  const fleteUnit = eq ? Number(cat.fletes[eq.flete_tipo] ?? 0) : 0;
  const flete = activo ? fleteUnit * cantidad : 0;
  return {
    eq, tier, jornada, dias, horas, cantidad,
    tarifaDia, tarifaHora, horasTotales, tiempo,
    fleteUnit, flete, activo, negociado,
  };
}

/** Orden fijo de los bloques de condiciones en el documento. */
const COND_ORDEN_MAQUINARIA = ['renta', 'retiro', 'pipa'] as const;

function condicionesMaquinaria(cat: CatalogoMaquinaria, partidas: PartidaMaquinaria[]): BloqueCondiciones[] {
  const claves = new Set<string>();
  for (const p of partidas) {
    if (p.tipo === 'equipo') claves.add('renta');
    else {
      const sv = servicioDe(cat, p.id);
      if (sv) claves.add(sv.cond || 'renta');
    }
  }
  return COND_ORDEN_MAQUINARIA
    .filter((k) => claves.has(k) && cat.condiciones[k])
    .map((k) => cat.condiciones[k]);
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
      const cantidad = modo === 'dias'
        ? Math.round((c.dias + c.horas / jornada) * c.cantidad * 10_000) / 10_000
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
        detalle: `${c.tier.label}${c.cantidad > 1 ? ` · ${c.cantidad} equipos` : ''}`,
      });
      renglones.push({
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
      if (!sv) continue;
      const cantidad = entero(p.cantidad, 1);
      // Un precio en 0 significa "el del catálogo", no "gratis". Importa más de
      // lo que parece: con los precios ocultos en el sitio público, el
      // navegador recibe el tabulador EN CEROS y manda 0 en cada servicio. Si
      // el 0 se respetara, el renglón daría importe 0 y se caería del
      // documento — el visitante pediría tres pipas y llegaría una solicitud
      // sin pipas. Mismo criterio que el material de triturados.
      const precio = decimal(p.precio && Number(p.precio) > 0 ? p.precio : sv.precio);
      const importe = precio * cantidad;
      if (importe <= 0) continue;
      servicios += importe;
      renglones.push({
        clase: 'servicio',
        id: sv.id,
        nombre: sv.nombre,
        concepto: sv.cond === 'retiro' ? `${sv.nombre.toUpperCase()} (TIRO LIBRE)` : sv.nombre.toUpperCase(),
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
      const precio = precioZona(cat, z, p.producto_id);
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
 * El tramo tarifario (día/semana/mes) sale de los días, y los días se piden en
 * el paso 3; por eso elegir equipo y decir cuánto tiempo son pasos distintos.
 * En la app original todo estaba en una sola pantalla y el usuario veía el
 * precio cambiar solo al teclear los días, sin entender por qué.
 */
export const PASOS_MAQUINARIA: PasoCotizador[] = [
  { clave: 'obra', titulo: 'Datos de la obra', ayuda: 'Para quién es y dónde se entrega el equipo.' },
  { clave: 'equipos', titulo: 'Equipos', ayuda: 'Elige la maquinaria. Todas incluyen operador y diésel.' },
  { clave: 'duracion', titulo: 'Duración', ayuda: 'Los días definen la tarifa: 1-5 día, 6-15 semana, 16+ mes.' },
  { clave: 'servicios', titulo: 'Servicios', ayuda: 'Pipas de agua y retiro de material. Este paso es opcional.' },
  { clave: 'resumen', titulo: 'Resumen', ayuda: 'Revisa el documento antes de guardarlo o enviarlo.' },
];

export const PASOS_TRITURADOS: PasoCotizador[] = [
  { clave: 'obra', titulo: 'Datos de la obra', ayuda: 'Para quién es y dónde se entrega el material.' },
  { clave: 'modalidad', titulo: 'Modalidad', ayuda: 'Por tonelada puesto en planta, o por viaje puesto en obra.' },
  { clave: 'materiales', titulo: 'Materiales', ayuda: 'Qué material y cuánto. El precio sale del tabulador vigente.' },
  { clave: 'entrega', titulo: 'Entrega y factura', ayuda: 'Flete por tonelada, zona de entrega y si lleva IVA.' },
  { clave: 'resumen', titulo: 'Resumen', ayuda: 'Revisa el documento antes de guardarlo o enviarlo.' },
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
      if (!sv) continue;
      out.push({ partida: p, linea: lineaDeServicio(sv), concepto: `${sv.nombre} · ${p.cantidad ?? 1} ${sv.unidad}(s)`, productos: sv.productos ?? [], proveedorId: sv.proveedor_id ?? null });
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
    resumen: 'Renta de equipo con operador y diésel, con flete a obra. Tarifa por día, semana o mes.',
    icono: 'excavadora',
    ruta: '/cotizador/maquinaria',
  },
  triturados: {
    titulo: 'Triturados',
    resumen: 'Grava, arena, base y material de banco. Por tonelada en planta o por viaje puesto en obra.',
    icono: 'material',
    ruta: '/cotizador/triturados',
  },
};
