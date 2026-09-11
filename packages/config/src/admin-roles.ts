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
 * 1. La sección 24 define DIEZ funciones, no cuatro. Varias no tocan el panel
 *    (Legal, Producto y Tecnología) y otras se solapan en la práctica
 *    (Comercial y Atención atienden la misma pantalla). Aquí quedan los cuatro
 *    equipos que SÍ operan el panel, más Dirección, que es la única que
 *    administra cuentas. El propio documento lo autoriza: "en etapas tempranas
 *    una misma persona puede cubrir varias funciones".
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
  'ordenes',
  'cotizaciones',
  'servicios',
  'agenda',
  'clientes',
  'proveedores',
  'marketplace',
  'comunidad',
  'diseno',
  'configuracion',
  'admins',
] as const;

export type ModuloAdmin = (typeof MODULOS_ADMIN)[number];

export type RolAdmin = 'direccion' | 'operaciones' | 'red' | 'comercial' | 'marca';

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
    descripcion: 'Estrategia, prioridades, alianzas y gobierno. Único rol que administra cuentas y permisos.',
    modulos: null,
  },
  operaciones: {
    clave: 'operaciones',
    nombre: 'Operaciones',
    descripcion: 'Solicitudes, asignaciones, logística, incidencias y cumplimiento.',
    modulos: [
      'inicio', 'indicadores', 'ordenes', 'cotizaciones', 'servicios',
      'agenda', 'clientes', 'disponibilidad', 'proveedores',
    ],
  },
  red: {
    clave: 'red',
    nombre: 'Red de Aliados',
    descripcion: 'Prospección, alta, validación, inventario, disponibilidad y desempeño de proveedores.',
    modulos: ['inicio', 'indicadores', 'catalogo', 'disponibilidad', 'proveedores', 'marketplace'],
  },
  comercial: {
    clave: 'comercial',
    nombre: 'Comercial y Atención',
    descripcion: 'Adquisición de clientes, cuentas, obras, seguimiento, conversión y resolución de fricciones.',
    modulos: ['inicio', 'indicadores', 'cotizaciones', 'clientes', 'comunidad'],
  },
  marca: {
    clave: 'marca',
    nombre: 'Marca y Crecimiento',
    descripcion: 'Comunicación, campañas, contenido y consistencia de identidad.',
    modulos: ['inicio', 'indicadores', 'diseno'],
  },
};

/** El rol con menos alcance. A donde cae cualquier valor que no reconocemos. */
export const ROL_POR_DEFECTO: RolAdmin = 'marca';

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
  return ROL_POR_DEFECTO;
}

/** ¿Este rol puede entrar a este módulo? */
export function puedeVer(rol: RolAdmin, modulo: ModuloAdmin): boolean {
  const def = ROLES_ADMIN[rol];
  if (!def) return false;
  return def.modulos === null || def.modulos.includes(modulo);
}

/** Los módulos de un rol, ya resueltos (Dirección incluida). */
export function modulosDe(rol: RolAdmin): readonly ModuloAdmin[] {
  return ROLES_ADMIN[rol]?.modulos ?? MODULOS_ADMIN;
}
