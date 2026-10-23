import { SignJWT, jwtVerify } from 'jose';
import { VIGENCIA_DEFAULT_DIAS } from '../quotes/quote-validity';

/**
 * ENLACE "ACEPTO LA COTIZACIÓN" (2026-10-22).
 *
 * Las cotizaciones que arma MAQSER24 en su cotizador (clientes que llaman o
 * escriben por WhatsApp) se aceptaban por teléfono y alguien tenía que
 * acordarse de marcarlas "Aceptada" en el panel. El correo de la cotización
 * trae ahora este enlace: sirve para aceptar ESE documento y nada más.
 *
 * Vale lo mismo que la vigencia de una cotización (15 días desde que se manda)
 * y no pide cuenta: muchos de estos clientes nunca se registraron. Misma llave
 * que el enlace de reseña, con su propio emisor, así que uno no sirve por el otro.
 *
 * Abrir el enlace NO acepta nada: la página enseña la cotización y pide
 * confirmar con un botón. Algunos correos abren solos los enlaces para
 * revisarlos, y eso no puede comprometer a nadie.
 */
const EMISOR = 'm24/aceptar';

function llave(): Uint8Array {
  const s = process.env.PROVIDER_LINK_SECRET ?? process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error('Falta PROVIDER_LINK_SECRET (o JWT_SECRET) con al menos 16 caracteres para firmar los enlaces de aceptación.');
  }
  return new TextEncoder().encode(s);
}

export async function firmarAceptacion(docId: number): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(EMISOR)
    .setSubject(String(docId))
    .setExpirationTime(`${VIGENCIA_DEFAULT_DIAS}d`)
    .sign(llave());
}

/** El documento (quoter_quotes.id) que el enlace deja aceptar, o null si no vale. */
export async function leerAceptacion(token: string | null | undefined): Promise<number | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, llave(), { issuer: EMISOR, algorithms: ['HS256'] });
    const id = Number(payload.sub);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

/** La ruta pública (sin dominio) para aceptar ese documento. */
export const rutaAceptar = (token: string) => `/cotizacion/aceptar?t=${token}`;
