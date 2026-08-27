import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { SignJWT, jwtVerify } from 'jose';

/**
 * ENLACE DE ACCESO DEL ALIADO (documento institucional, sección 20).
 *
 * El aliado no es un usuario de software: es el dueño de una rentadora que
 * contesta desde la cabina de una camioneta. Pedirle que recuerde una
 * contraseña de un portal que abre dos veces al mes garantiza que no lo use, y
 * entonces todo vuelve al teléfono — que es justo lo que se quiere quitar.
 *
 * CUATRO DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. El enlace ES la credencial, y por eso vive treinta días y no para
 *    siempre. Un correo reenviado o un teléfono perdido no pueden dar acceso
 *    indefinido a las solicitudes de un aliado.
 *
 * 2. `access_version` revoca de golpe. Subirle uno invalida todos los enlaces
 *    mandados antes sin tocar nada más: es lo que se usa cuando a un aliado se
 *    le va el encargado con el correo en el teléfono.
 *
 * 3. Firma propia y no Supabase Auth. Supabase Auth es para CUENTAS —clientes y
 *    administradores— y ahí la regla del proyecto es no inventar contraseñas
 *    fuera de él. Aquí no hay cuenta que crear: hay un permiso temporal sobre
 *    un aliado que ya existe, que es otra cosa.
 *
 * 4. Un aliado inactivo no entra, aunque su enlace siga vigente. Dar de baja a
 *    alguien tiene que cortarle el acceso el mismo día, no cuando le caduque
 *    el correo.
 */

const DIAS_VIGENCIA = 30;
const EMISOR = 'maqser24/aliado';

/**
 * La llave. Sin `PROVIDER_LINK_SECRET` se cae a `JWT_SECRET` y, si tampoco
 * está, se lanza: firmar con una constante escrita en el código dejaría que
 * cualquiera que vea el repositorio se fabrique un enlace.
 */
function llave(): Uint8Array {
  const s = process.env.PROVIDER_LINK_SECRET ?? process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      'Falta PROVIDER_LINK_SECRET (o JWT_SECRET) con al menos 16 caracteres para firmar los enlaces de aliado.',
    );
  }
  return new TextEncoder().encode(s);
}

export interface AliadoRequest {
  headers: Record<string, string | undefined>;
  query?: Record<string, string | undefined>;
  providerId: number;
}

/** Firma el enlace de un aliado. */
export async function firmarAcceso(providerId: number, version: number): Promise<string> {
  return new SignJWT({ v: version })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(EMISOR)
    .setSubject(String(providerId))
    .setIssuedAt()
    .setExpirationTime(`${DIAS_VIGENCIA}d`)
    .sign(llave());
}

export interface AccesoValido {
  providerId: number;
  name: string;
}

/**
 * Comprueba el enlace. Devuelve null en vez de lanzar cuando no vale, para que
 * la pantalla pueda decir "este enlace ya no sirve, pide otro" en vez de
 * enseñar un error técnico a alguien que sólo quería contestar una solicitud.
 */
export async function validarAcceso(token: string | null | undefined): Promise<AccesoValido | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, llave(), { issuer: EMISOR });
    const id = Number(payload.sub);
    if (!Number.isInteger(id) || id <= 0) return null;

    const p = await prisma.providers.findUnique({
      where: { id },
      select: { id: true, name: true, status: true, access_version: true },
    });
    if (!p) return null;
    // Decisión 4: dar de baja corta el acceso el mismo día.
    if (p.status !== 1) return null;
    // Decisión 2: la versión revoca todo lo emitido antes.
    if (payload.v !== p.access_version) return null;

    return { providerId: p.id, name: p.name };
  } catch {
    return null;
  }
}

/** URL completa que se le manda al aliado. */
export function urlDeAcceso(token: string): string {
  const base = process.env.SITE_URL ?? 'https://servmaq24-web.vercel.app';
  return `${base}/aliado?t=${encodeURIComponent(token)}`;
}

/**
 * Guard del portal del aliado.
 *
 * Acepta el token por cabecera o por query: el enlace del correo llega con
 * `?t=`, y la primera carga tiene que funcionar sin que el navegador haya
 * puesto todavía ninguna cabecera.
 */
@Injectable()
export class ProviderLinkGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AliadoRequest>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : req.query?.t;

    const acceso = await validarAcceso(token);
    if (!acceso) throw new UnauthorizedException('Este enlace ya no sirve. Pídenos uno nuevo.');

    req.providerId = acceso.providerId;
    // Se anota cada entrada, no la primera: sirve para saber qué aliados de
    // verdad usan esto y cuáles siguen esperando la llamada.
    await prisma.providers
      .update({ where: { id: acceso.providerId }, data: { last_access_at: new Date() } })
      .catch(() => undefined);
    return true;
  }
}
