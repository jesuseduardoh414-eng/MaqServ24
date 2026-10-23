import { SignJWT, jwtVerify } from 'jose';

/**
 * ENLACE PARA CALIFICAR UN SERVICIO (2026-10-12).
 *
 * La mayoría de los clientes cotiza sin crear cuenta, así que pedirles que
 * inicien sesión para dejar su reseña es pedirles que no la dejen. El enlace
 * del correo de cierre es el permiso: sirve para calificar ESE servicio y nada
 * más, por 120 días.
 *
 * Misma llave que el enlace del aliado, con su propio emisor: un enlace de
 * aliado no sirve para calificar y uno de calificar no abre ningún portal.
 *
 * Corto a propósito (sin `iat`): también va en el aviso de la campana del
 * cliente, cuyo enlace guarda 200 caracteres como mucho.
 */
const EMISOR = 'm24/resena';
const DIAS_VIGENCIA = 120;

function llave(): Uint8Array {
  const s = process.env.PROVIDER_LINK_SECRET ?? process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error('Falta PROVIDER_LINK_SECRET (o JWT_SECRET) con al menos 16 caracteres para firmar los enlaces de reseña.');
  }
  return new TextEncoder().encode(s);
}

export async function firmarResena(quoteId: number): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(EMISOR)
    .setSubject(String(quoteId))
    .setExpirationTime(`${DIAS_VIGENCIA}d`)
    .sign(llave());
}

/** El servicio que el enlace deja calificar, o null si no vale (caducó, alterado, otro emisor). */
export async function leerResena(token: string | null | undefined): Promise<number | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, llave(), { issuer: EMISOR, algorithms: ['HS256'] });
    const id = Number(payload.sub);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

/** La ruta pública (sin dominio) para calificar ese servicio. */
export const rutaResena = (token: string) => `/resena?t=${token}`;
