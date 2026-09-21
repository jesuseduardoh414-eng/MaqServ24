import { Logger } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import {
  ROLES_ADMIN, esRolFijo, normalizarModulos,
  type ModuloAdmin, type PermisosOverride, type RolAdmin,
} from '@maqserv/config';

/**
 * PERMISOS VIGENTES = tabla por defecto de `@maqserv/config` + lo que Dirección
 * haya cambiado desde el panel (tabla `admin_role_modules`).
 *
 * TRES DECISIONES:
 *
 * 1. SQL en crudo y no `prisma.admin_role_modules`. El cliente de Prisma se
 *    compila aparte y se SUBE ya construido (ver la nota de binaryTargets en
 *    schema.prisma): añadir un modelo obliga a regenerarlo y volver a
 *    desplegarlo en cPanel. Para una tabla de cinco filas no compensa. El
 *    modelo queda escrito en el esquema para que un `db pull` no lo pierda.
 *
 * 2. Si la consulta falla —la tabla todavía no existe en ese entorno, por
 *    ejemplo, porque el código llegó antes que el SQL— NO se cae el panel: se
 *    devuelven los permisos por defecto, que son los restrictivos. Fallar hacia
 *    los defaults es seguro; fallar hacia "todo permitido" no lo sería.
 *
 * 3. Caché corta y compartida. El guard pregunta esto en CADA petición; sin
 *    caché serían dos viajes a la BD por llamada (éste y el de la cuenta
 *    activa). 15 s es "al instante" para quien reparte permisos, y guardar
 *    invalida la caché de esta instancia al momento.
 */
const log = new Logger('AdminPermisos');
const TTL_MS = 15_000;

let cache: { until: number; datos: PermisosOverride } | null = null;

/** La llama quien guarda: lo recién cambiado no debe esperar al TTL. */
export function olvidarPermisos(): void {
  cache = null;
}

export async function permisosVigentes(): Promise<PermisosOverride> {
  if (cache && cache.until > Date.now()) return cache.datos;

  const datos: PermisosOverride = {};
  try {
    const filas = await prisma.$queryRawUnsafe<Array<{ rol: string; modulos: unknown }>>(
      'SELECT rol, modulos FROM admin_role_modules',
    );
    for (const fila of filas) {
      if (!(fila.rol in ROLES_ADMIN)) continue; // rol borrado del código: se ignora
      const crudo = typeof fila.modulos === 'string' ? safeParse(fila.modulos) : fila.modulos;
      if (Array.isArray(crudo)) datos[fila.rol as RolAdmin] = normalizarModulos(crudo.map(String));
    }
    cache = { until: Date.now() + TTL_MS, datos };
  } catch (e) {
    // Sin caché: si es un fallo pasajero, el siguiente intento vuelve a probar.
    log.warn(`Usando permisos por defecto: ${e instanceof Error ? e.message : e}`);
  }
  return datos;
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}

/** Guarda la lista de un rol. Devuelve lo que quedó guardado, ya normalizado. */
export async function guardarPermisos(
  rol: RolAdmin,
  modulos: readonly string[],
  adminId: number,
): Promise<ModuloAdmin[]> {
  // Dirección no se toca: ver la nota de ROLES_FIJOS en admin-roles.ts.
  if (esRolFijo(rol)) throw new Error('El rol de Dirección no se puede restringir');
  const limpios = normalizarModulos(modulos);
  await prisma.$executeRawUnsafe(
    `INSERT INTO admin_role_modules (rol, modulos, updated_at, updated_by)
     VALUES (?, ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE modulos = VALUES(modulos), updated_at = NOW(), updated_by = VALUES(updated_by)`,
    rol,
    JSON.stringify(limpios),
    adminId,
  );
  olvidarPermisos();
  return limpios;
}

/** Vuelve un rol a su lista por defecto (borra la fila guardada). */
export async function restablecerPermisos(rol: RolAdmin): Promise<void> {
  await prisma.$executeRawUnsafe('DELETE FROM admin_role_modules WHERE rol = ?', rol);
  olvidarPermisos();
}
