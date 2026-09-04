import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { supabase } from './supabase';

const base = () => process.env.SUPABASE_URL ?? '';
const anon = () => process.env.SUPABASE_ANON_KEY ?? '';

export interface SupabaseClaims extends JWTPayload {
  app_metadata?: { role?: string; app_user_id?: number; app_admin_id?: number };
}

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
/**
 * Verifica un access token de Supabase contra el JWKS público (ES256).
 * `issuer`/`audience` fijados (endurecimiento estándar): además de la firma,
 * el token debe haber sido emitido por ESTE proyecto y para usuarios
 * autenticados — no cualquier JWT que pase el JWKS.
 */
export async function verifySupabaseToken(token: string): Promise<SupabaseClaims> {
  if (!_jwks) _jwks = createRemoteJWKSet(new URL(base() + '/auth/v1/.well-known/jwks.json'));
  const { payload } = await jwtVerify(token, _jwks, {
    issuer: base() + '/auth/v1',
    audience: 'authenticated',
  });
  return payload as SupabaseClaims;
}

export interface Grant {
  access_token?: string;
  refresh_token?: string;
  user?: { id: string; app_metadata?: SupabaseClaims['app_metadata'] };
  error?: string;
  /** El servicio no contestó (o falló del suyo). NO es culpa de las credenciales. */
  unavailable?: boolean;
}

/**
 * Supabase Auth es un TERCERO, y el login es la ruta que más se pulsa.
 *
 * Un `fetch` sin tope aquí no es "lento": ocupa un worker hasta que el otro
 * extremo conteste. En un plan con poca concurrencia, unos cuantos intentos
 * atorados dejan sin acceso a TODO el mundo, no solo a quien intentaba entrar.
 * Es el mismo fallo que ya tumbó el panel con el 504 del middleware.
 *
 * Y se devuelve `unavailable` en vez de un error a secas porque el que llama
 * traduce cualquier fallo a "correo o contraseña incorrectos": sin esa marca,
 * una caída de Supabase le dice al cliente que su contraseña está mal y lo manda
 * a restablecerla sin motivo.
 */
const TOPE_AUTH_MS = 10_000;

async function tokenGrant(qs: string, bodyObj: Record<string, string>): Promise<Grant> {
  let r: Response;
  try {
    r = await fetch(base() + '/auth/v1/token?' + qs, {
      method: 'POST',
      headers: { apikey: anon(), 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj),
      signal: AbortSignal.timeout(TOPE_AUTH_MS),
    });
  } catch (err) {
    const motivo = (err as Error)?.name === 'TimeoutError' ? 'no respondió a tiempo' : 'no está disponible';
    return { error: `El servicio de acceso ${motivo}.`, unavailable: true };
  }
  const b = await r.json().catch(() => ({}));
  if (r.ok) return b as Grant;
  // Un 5xx es de Supabase, no de quien intenta entrar.
  return {
    error: b.error_description || b.msg || b.message || `HTTP ${r.status}`,
    unavailable: r.status >= 500,
  };
}

export const passwordGrant = (email: string, password: string) =>
  tokenGrant('grant_type=password', { email, password });

export const refreshGrant = (refresh_token: string) =>
  tokenGrant('grant_type=refresh_token', { refresh_token });

/** Crea un usuario en auth.users (service_role) con password y metadata; email ya confirmado. */
export async function adminCreateUser(email: string, password: string, app_metadata: Record<string, unknown>) {
  const { data, error } = await supabase().auth.admin.createUser({ email, password, email_confirm: true, app_metadata });
  if (error || !data.user) throw new Error(error?.message ?? 'No se pudo crear el usuario');
  return data.user;
}

/** Actualiza app_metadata de un usuario (aparece en el JWT del siguiente login). */
export async function adminSetMetadata(id: string, app_metadata: Record<string, unknown>) {
  const { error } = await supabase().auth.admin.updateUserById(id, { app_metadata });
  if (error) throw new Error(error.message);
}

/**
 * Cambia la contraseña REAL, la que valida el login.
 *
 * `admins.password` / `users.password` son hashes heredados del Laravel viejo: el
 * login ya NO los lee (va por `passwordGrant` de Supabase). Reescribir solo esa
 * columna no cambia nada — la contraseña vive aquí.
 */
export async function adminSetPassword(id: string, password: string) {
  const { error } = await supabase().auth.admin.updateUserById(id, { password });
  if (error) throw new Error(error.message);
}

/** Borra un usuario de auth.users. Se usa para no dejar cuentas a medias. */
export async function adminDeleteUser(id: string) {
  const { error } = await supabase().auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);
}

/**
 * Envía el correo de restablecimiento de contraseña (Supabase /recover).
 * Supabase responde 200 aunque el correo no exista (evita enumeración de cuentas),
 * así que siempre resolvemos ok. Requiere SMTP configurado en Supabase para el envío real.
 */
export async function sendPasswordReset(email: string, redirectTo?: string): Promise<{ ok: boolean }> {
  const qs = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : '';
  try {
    await fetch(`${base()}/auth/v1/recover${qs}`, {
      method: 'POST',
      headers: { apikey: anon(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(TOPE_AUTH_MS),
    });
  } catch {
    /* no revelamos fallos de red al cliente por seguridad */
  }
  return { ok: true };
}
