import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { prisma } from '@maqserv/db';

/**
 * AUTENTICACIÓN PROPIA (clientes y administradores).
 *
 * Sustituye a Supabase Auth. La API firma sus propios JWT (HS256 con
 * AUTH_SECRET, el mismo patrón que ya usan los enlaces de aliado) y verifica la
 * contraseña con bcrypt contra `users.password` / `admins.password`.
 *
 * Los hashes son los MISMOS que tenía Supabase (`auth.users.encrypted_password`,
 * importados por migrate/43-importar-hashes.mjs), así que nadie tuvo que
 * cambiar su contraseña con la migración. bcryptjs verifica `$2a$`, `$2b$` y
 * los `$2y$` del Laravel viejo (normalizados aquí).
 *
 * Contrato con la web y el panel: no cambió. Reciben `{ token, refresh_token }`,
 * leen el `exp` del access token para decidir cuándo renovar y llaman a
 * `/auth/refresh`. Los guards siguen leyendo `app_metadata.app_user_id` /
 * `app_admin_id`, que es la forma que tenían los tokens de Supabase.
 *
 * Revocación sin estado: el refresh token lleva `pv`, una huella del hash de la
 * contraseña. Cambiar la contraseña cambia la huella y todos los refresh
 * emitidos antes dejan de servir (el access vive 1 h como mucho). Desactivar un
 * admin lo corta el AdminGuard en cada petición, como antes.
 */

const EMISOR = 'maqser24/auth';
const AUDIENCIA = 'authenticated';
const ACCESO_TTL = '1h';
const REFRESCO_TTL = '30d';
/** Cuánto vale un enlace de "olvidé mi contraseña". */
const RESTABLECER_MINUTOS = 60;

export type Rol = 'customer' | 'admin';

export interface AppClaims extends JWTPayload {
  app_metadata?: { role?: Rol; app_user_id?: number; app_admin_id?: number };
}

/**
 * La llave. Sin AUTH_SECRET (o JWT_SECRET) se lanza: firmar con una constante
 * del código dejaría que cualquiera con el repositorio se fabricara sesiones.
 */
function llave(): Uint8Array {
  const s = process.env.AUTH_SECRET ?? process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error('Falta AUTH_SECRET con al menos 32 caracteres para firmar las sesiones.');
  }
  return new TextEncoder().encode(s);
}

/** Huella corta del hash: cambia cuando cambia la contraseña. */
const versionDe = (hash: string) => createHash('sha256').update(hash).digest('hex').slice(0, 16);

/** Los `$2y$` del PHP viejo son bcrypt normal; bcryptjs los prefiere como `$2a$`. */
const normalizarHash = (h: string) => h.replace(/^\$2y\$/, '$2a$');

export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, 10);

export async function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash || !plain) return false;
  try {
    return await bcrypt.compare(plain, normalizarHash(hash));
  } catch {
    return false;
  }
}

export interface Identidad {
  rol: Rol;
  id: number;
  /** Hash actual de la contraseña; de aquí sale `pv`. */
  hash: string;
}

export interface Tokens {
  access_token: string;
  refresh_token: string;
}

async function firmar(identidad: Identidad): Promise<Tokens> {
  const meta =
    identidad.rol === 'admin'
      ? { role: 'admin' as const, app_admin_id: identidad.id }
      : { role: 'customer' as const, app_user_id: identidad.id };
  const sub = `${identidad.rol}:${identidad.id}`;
  const access_token = await new SignJWT({ app_metadata: meta })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(EMISOR)
    .setAudience(AUDIENCIA)
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(ACCESO_TTL)
    .sign(llave());
  const refresh_token = await new SignJWT({ typ: 'refresh', pv: versionDe(identidad.hash) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(EMISOR)
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(REFRESCO_TTL)
    .sign(llave());
  return { access_token, refresh_token };
}

/** Emite la pareja de tokens para una identidad ya verificada (p. ej. tras registrarse). */
export const tokensPara = (identidad: Identidad): Promise<Tokens> => firmar(identidad);

/**
 * Verifica un access token. Lanza si no vale; el que llama decide el 401.
 * `audience` fija: un refresh token nunca pasa por aquí como acceso.
 */
export async function verifyAccessToken(token: string): Promise<AppClaims> {
  const { payload } = await jwtVerify(token, llave(), { issuer: EMISOR, audience: AUDIENCIA });
  return payload as AppClaims;
}

interface Fila {
  id: number;
  hash: string | null;
  activo: boolean;
}

async function porId(rol: Rol, id: number): Promise<Fila | null> {
  if (rol === 'admin') {
    const a = await prisma.admins.findUnique({ where: { id }, select: { id: true, password: true, status: true } });
    return a ? { id: a.id, hash: a.password, activo: a.status === 1 } : null;
  }
  const u = await prisma.users.findUnique({ where: { id }, select: { id: true, password: true } });
  return u ? { id: u.id, hash: u.password, activo: true } : null;
}

async function porCorreo(rol: Rol, email: string): Promise<Fila | null> {
  const correo = email.trim().toLowerCase();
  if (rol === 'admin') {
    const a = await prisma.admins.findFirst({ where: { email: correo }, select: { id: true, password: true, status: true } });
    return a ? { id: a.id, hash: a.password, activo: a.status === 1 } : null;
  }
  const u = await prisma.users.findFirst({ where: { email: correo }, select: { id: true, password: true } });
  return u ? { id: u.id, hash: u.password, activo: true } : null;
}

export interface Sesion extends Tokens {
  id: number;
}

/**
 * Login con correo y contraseña. Devuelve null si no coincide o la cuenta no
 * está activa: el que llama responde "correo o contraseña incorrectos" sin
 * distinguir, para no revelar qué correos existen.
 */
export async function passwordGrant(rol: Rol, email: string, password: string): Promise<Sesion | null> {
  const fila = await porCorreo(rol, email);
  if (!fila || !fila.activo || !fila.hash) return null;
  if (!(await verifyPassword(password, fila.hash))) return null;
  return { id: fila.id, ...(await firmar({ rol, id: fila.id, hash: fila.hash })) };
}

/**
 * Renueva la pareja a partir del refresh token. Null si no vale: vencido, de
 * una contraseña anterior, o de una cuenta que ya no existe o se desactivó.
 */
export async function refreshGrant(token: string): Promise<Sesion | null> {
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, llave(), { issuer: EMISOR }));
  } catch {
    return null;
  }
  if (payload.typ !== 'refresh' || typeof payload.sub !== 'string') return null;
  const [rol, idStr] = payload.sub.split(':');
  const id = Number(idStr);
  if ((rol !== 'customer' && rol !== 'admin') || !Number.isInteger(id)) return null;
  const fila = await porId(rol, id);
  if (!fila || !fila.activo || !fila.hash) return null;
  if (versionDe(fila.hash) !== payload.pv) return null;
  return { id: fila.id, ...(await firmar({ rol, id: fila.id, hash: fila.hash })) };
}

/**
 * "Olvidé mi contraseña", paso 1. Genera un token de un solo uso, guarda su
 * huella (no el token) en `users.reset_token` con vencimiento, y devuelve el
 * token en claro para mandarlo por correo. Null si el correo no existe — el
 * que llama responde ok igual (anti-enumeración).
 */
export async function crearRestablecimiento(
  email: string,
): Promise<{ token: string; userId: number; name: string; email: string } | null> {
  const correo = email.trim().toLowerCase();
  const u = await prisma.users.findFirst({ where: { email: correo }, select: { id: true, name: true, email: true } });
  if (!u) return null;
  const token = randomBytes(32).toString('hex');
  await prisma.users.update({
    where: { id: u.id },
    data: {
      reset_token: createHash('sha256').update(token).digest('hex'),
      reset_token_expiry: new Date(Date.now() + RESTABLECER_MINUTOS * 60_000),
    },
  });
  return { token, userId: u.id, name: u.name, email: u.email };
}

/** Paso 2: cambia la contraseña si el token existe y no venció. Devuelve si lo logró. */
export async function restablecerConToken(token: string, nueva: string): Promise<boolean> {
  if (!token || token.length < 32) return false;
  const huella = createHash('sha256').update(token).digest('hex');
  const u = await prisma.users.findFirst({
    where: { reset_token: huella, reset_token_expiry: { gt: new Date() } },
    select: { id: true },
  });
  if (!u) return false;
  await prisma.users.update({
    where: { id: u.id },
    data: { password: await hashPassword(nueva), reset_token: null, reset_token_expiry: null, updated_at: new Date() },
  });
  return true;
}
