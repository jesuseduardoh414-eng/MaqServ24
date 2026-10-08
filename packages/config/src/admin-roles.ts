import { MARKETPLACE_ACTIVO } from './marketplace';

/**
 * ROLES Y PERMISOS DEL PANEL (documento institucional, sección 24 · Organización
 * interna recomendada; sección 30 · Riesgos y controles).
 *
 * Hasta ahora todos los administradores eran iguales: quien capturaba una
 * cotización podía cambiar el diseño del sitio, borrar equipos del catálogo o
 * pagar un retiro. Con tres personas se tolera; el documento lo lista como
 * riesgo de control de acceso, y el riesgo crece con cada cuenta nueva.
 *
 * CUATRO DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. Los roles son los TRES participantes internos de la sección 14 del
 *    documento: Dirección, Operaciones y Administración (decisión del cliente,
 *    2026-10-08). Antes había cinco, sacados de la sección 24 (Red de Aliados,
 *    Comercial y Atención, Marca y Crecimiento); el trabajo de esos tres lo
 *    absorbe Operaciones (proveedores, clientes, mensajes) y Dirección (el
 *    sitio web). El documento lo autoriza: "en etapas tempranas una misma
 *    persona puede cubrir varias funciones".
 *
 * 2. El permiso es por MÓDULO, no por acción. Un rol ve una pantalla o no la
 *    ve. Partirlo en leer/escribir duplicaría la matriz para resolver un
 *    problema que hoy nadie tiene, y la mitad de las pantallas no tienen
 *    lectura útil sin escritura.
 *
 * 3. Esta es la ÚNICA fuente. La API la usa para cerrar rutas y el panel para
 *    dibujar el menú. Si se separan, un día el menú esconde algo que la API
 *    sigue sirviendo — que es precisamente el agujero que esto viene a cerrar.
 *
 * 4. Un rol desconocido NO hereda acceso total. Las cuentas viejas traen el
 *    literal 'Administrator' de Laravel y ésas sí son Dirección (era lo que
 *    significaba cuando se crearon); cualquier otro valor cae en el rol con
 *    menos alcance. Un error de dedo no puede abrir el panel entero.
 */

/** Los módulos del panel. Cada pantalla pertenece a exactamente uno. */
export const MODULOS_ADMIN = [
  'inicio',
  'indicadores',
  'catalogo',
  'disponibilidad',
  // 'ordenes' se retiró con el carrito (2026-10-08): un permiso guardado con
  // ese nombre lo descarta normalizarModulos.
  'cotizaciones',
  // El cotizador interno (maquinaria y triturados) va aparte de 'cotizaciones'.
  // No son lo mismo: 'cotizaciones' es la BANDEJA de lo que pide el cliente;
  // esto es la HERRAMIENTA con la que se arma el precio, y lleva dentro el
  // tabulador de tarifas. Quien atiende la bandeja no tiene por qué poder
  // mover el precio de una excavadora.
  'cotizador',
  'servicios',
  'agenda',
  'clientes',
  // Cobranza, pagos a aliados, margen y conciliación (2026-10-08). El módulo se
  // construye después; el permiso existe ya para el rol Administración.
  'administracion',
  'proveedores',
  'marketplace',
  'comunidad',
  'diseno',
  'configuracion',
  'admins',
] as const;

export type ModuloAdmin = (typeof MODULOS_ADMIN)[number];

/**
 * MÓDULOS APAGADOS.
 *
 * Existen en el código pero nadie los alcanza: ni el menú, ni Permisos, ni el
 * guard de la API, ni Dirección. Hoy es el marketplace heredado (vendedores y
 * retiros), que el modelo MAQSER24 no tiene (ver `marketplace.ts`). Se filtra
 * en un solo sitio —aquí— para que el menú y la API no puedan divergir.
 */
const MODULOS_OCULTOS: readonly ModuloAdmin[] = MARKETPLACE_ACTIVO ? [] : ['marketplace'];

export const esModuloOculto = (m: ModuloAdmin): boolean => MODULOS_OCULTOS.includes(m);

/** Los módulos que sí existen para las personas: la lista de arriba sin los apagados. */
export const MODULOS_VISIBLES: readonly ModuloAdmin[] = MODULOS_ADMIN.filter((m) => !esModuloOculto(m));

/**
 * Cómo se llama cada módulo en pantalla. La clave es para el código; esto es
 * para la persona que reparte los permisos, que no tiene por qué saber que
 * "comunidad" incluye los mensajes del formulario de contacto.
 */
export const MODULOS_META: Record<ModuloAdmin, { nombre: string; detalle: string }> = {
  inicio: { nombre: 'Inicio', detalle: 'Tablero de lo que hay que atender. No se le puede quitar a nadie.' },
  indicadores: { nombre: 'Indicadores', detalle: 'Ventas, cotizaciones y desempeño.' },
  catalogo: { nombre: 'Catálogo', detalle: 'Inventario y categorías.' },
  disponibilidad: { nombre: 'Disponibilidad', detalle: 'Qué equipo está libre y cuándo.' },
  cotizaciones: { nombre: 'Cotizaciones', detalle: 'La bandeja de lo que pide el cliente.' },
  cotizador: { nombre: 'Cotizador', detalle: 'La herramienta de precio y el tabulador de tarifas.' },
  servicios: { nombre: 'Servicios', detalle: 'Lo que está en curso, asignaciones e incidencias.' },
  agenda: { nombre: 'Agenda', detalle: 'Lo que viene en los próximos días.' },
  clientes: { nombre: 'Clientes y obras', detalle: 'Las empresas que contratan y sus frentes abiertos.' },
  administracion: { nombre: 'Administración', detalle: 'Cobranza a clientes, pagos a aliados, margen y conciliación.' },
  proveedores: { nombre: 'Proveedores', detalle: 'La red de aliados, sus papeles y su desempeño.' },
  marketplace: { nombre: 'Marketplace', detalle: 'Vendedores y RETIROS DE DINERO.' },
  comunidad: { nombre: 'Comunidad', detalle: 'Cuentas, reseñas, preguntas, mensajes y suscriptores.' },
  diseno: { nombre: 'Diseño del sitio', detalle: 'Secciones del home, textos, colores, blog y marca.' },
  configuracion: { nombre: 'Configuración', detalle: 'Correo y ajustes generales.' },
  admins: { nombre: 'Administradores', detalle: 'Las cuentas del panel y estos permisos.' },
};

export type RolAdmin = 'direccion' | 'operaciones' | 'administracion';

export interface DefinicionRol {
  clave: RolAdmin;
  nombre: string;
  /** Qué hace ese equipo, en las palabras del documento. */
  descripcion: string;
  /** `null` = todo. Dirección es el único caso. */
  modulos: readonly ModuloAdmin[] | null;
}

export const ROLES_ADMIN: Record<RolAdmin, DefinicionRol> = {
  direccion: {
    clave: 'direccion',
    nombre: 'Dirección General',
    descripcion: 'Medir crecimiento y calidad: KPIs de demanda, oferta, conversión, tiempo, margen, repetición y cumplimiento. Único rol que administra cuentas, permisos, tarifas y el sitio web.',
    modulos: null,
  },
  operaciones: {
    clave: 'operaciones',
    nombre: 'Operaciones',
    descripcion: 'Coordinar sin perder control: solicitudes, cotizaciones, asignaciones, servicios, proveedores, clientes, alertas, documentos y excepciones.',
    // Incluye lo que hacían Red de Aliados (proveedores, inventario,
    // disponibilidad) y Comercial (clientes, mensajes, reseñas, preguntas).
    modulos: [
      'inicio', 'indicadores', 'catalogo', 'disponibilidad', 'cotizaciones', 'cotizador', 'servicios',
      'agenda', 'clientes', 'proveedores', 'comunidad',
    ],
  },
  administracion: {
    clave: 'administracion',
    nombre: 'Administración',
    descripcion: 'Controlar transacciones y evidencias: información de servicio, precios, cargos, documentos y reportes.',
    // Hoy su módulo está en "Pronto". Ver servicios y solicitudes sin poder
    // moverlos necesita el permiso de solo consulta, que todavía no existe:
    // por eso no se le dan aquí (podría editarlos).
    modulos: ['inicio', 'indicadores', 'administracion'],
  },
};

/** El rol con menos alcance. A donde cae cualquier valor que no reconocemos. */
export const ROL_POR_DEFECTO: RolAdmin = 'administracion';

/**
 * Roles que existieron y ya no (2026-10-08). Una cuenta que todavía los traiga
 * cae en el rol que absorbió su trabajo; Marca no sube a Dirección (sería
 * regalar acceso total): cae en el de menos alcance y Dirección decide.
 */
const ROLES_RETIRADOS: Record<string, RolAdmin> = {
  red: 'operaciones',
  comercial: 'operaciones',
  marca: ROL_POR_DEFECTO,
};

/**
 * Normaliza lo que venga de la columna `admins.role`.
 *
 * 'Administrator' es el literal que Laravel escribía en TODAS las cuentas, y
 * cuando se escribió significaba acceso total: respetarlo es lo correcto, y
 * evita que al desplegar esto los administradores actuales se queden fuera.
 */
export function rolDeAdmin(valor: string | null | undefined): RolAdmin {
  const v = (valor ?? '').trim();
  if (v === 'Administrator') return 'direccion';
  if ((Object.keys(ROLES_ADMIN) as RolAdmin[]).includes(v as RolAdmin)) return v as RolAdmin;
  if (v in ROLES_RETIRADOS) return ROLES_RETIRADOS[v];
  return ROL_POR_DEFECTO;
}

/** ¿Este rol puede entrar a este módulo? Un módulo apagado, nadie. */
export function puedeVer(rol: RolAdmin, modulo: ModuloAdmin): boolean {
  if (esModuloOculto(modulo)) return false;
  const def = ROLES_ADMIN[rol];
  if (!def) return false;
  return def.modulos === null || def.modulos.includes(modulo);
}

/** Los módulos de un rol, ya resueltos (Dirección incluida), sin los apagados. */
export function modulosDe(rol: RolAdmin): readonly ModuloAdmin[] {
  return (ROLES_ADMIN[rol]?.modulos ?? MODULOS_ADMIN).filter((m) => !esModuloOculto(m));
}

/* ============================================================
   PERMISOS EDITABLES DESDE EL PANEL
   ------------------------------------------------------------
   La tabla de arriba deja de ser la última palabra y pasa a ser el PUNTO DE
   PARTIDA: Dirección puede reajustar qué ve cada rol desde Administradores →
   Permisos, y eso se guarda en la BD. Un rol sin fila guardada sigue usando su
   lista de arriba, así que un despliegue nuevo no estrena permisos en blanco.

   Dos reglas que no se pueden desactivar, y por qué:
    - Dirección lo ve todo SIEMPRE. Si se le pudiera quitar el módulo de
      cuentas, el primer clic desafortunado dejaría el panel sin nadie que
      pueda volver a repartir permisos.
    - 'inicio' va en todos los roles. Es la primera pantalla tras entrar y la
      ruta `/admin/auth/me` que pide toda página: sin ella, la cuenta entra y
      rebota.
   ============================================================ */

/** Lo que Dirección guarda desde el panel: rol → módulos. */
export type PermisosOverride = Partial<Record<RolAdmin, readonly string[]>>;

/** No se le puede quitar a nadie (ver arriba). */
export const MODULOS_OBLIGATORIOS: readonly ModuloAdmin[] = ['inicio'];

/** Roles cuya lista no se edita. */
export const ROLES_FIJOS: readonly RolAdmin[] = ['direccion'];

export const esRolFijo = (rol: RolAdmin): boolean => ROLES_FIJOS.includes(rol);

/**
 * Deja una lista guardada en forma canónica: tira lo que no reconoce (un
 * módulo renombrado en el código no debe conceder nada), añade los
 * obligatorios y respeta el orden de `MODULOS_ADMIN` para que la pantalla no
 * dependa del orden en que se hicieron clic las casillas.
 */
export function normalizarModulos(lista: readonly string[]): ModuloAdmin[] {
  const set = new Set<ModuloAdmin>(
    lista.filter((m): m is ModuloAdmin => (MODULOS_ADMIN as readonly string[]).includes(m)),
  );
  for (const m of MODULOS_OBLIGATORIOS) set.add(m);
  // Un módulo apagado no se concede aunque venga guardado de cuando existía.
  return MODULOS_VISIBLES.filter((m) => set.has(m));
}

/** Los módulos de un rol AHORA: lo guardado si existe, si no su lista por defecto. */
export function modulosEfectivos(
  rol: RolAdmin,
  overrides?: PermisosOverride | null,
): readonly ModuloAdmin[] {
  if (esRolFijo(rol)) return MODULOS_VISIBLES;
  const guardado = overrides?.[rol];
  return guardado ? normalizarModulos(guardado) : modulosDe(rol);
}

/** ¿Puede entrar, con los permisos vigentes? Es lo que pregunta el guard. */
export function puedeVerCon(
  rol: RolAdmin,
  modulo: ModuloAdmin,
  overrides?: PermisosOverride | null,
): boolean {
  return modulosEfectivos(rol, overrides).includes(modulo);
}
