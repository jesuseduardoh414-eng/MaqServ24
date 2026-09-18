/**
 * INICIO DE SESIÓN CON GOOGLE (OAuth 2.0, flujo de código de autorización).
 *
 * Hasta ahora el botón de Google era un adorno: al tocarlo aparecía "estará
 * disponible pronto". Esto es el flujo de verdad.
 *
 * DÓNDE OCURRE CADA COSA, que es lo que no es obvio:
 *
 *   navegador → /api/auth/google (WEB)      redirige a Google
 *   Google    → /api/auth/google/callback (WEB)   trae ?code
 *   WEB       → POST /auth/google (ESTA API)      canjea el código
 *   ESTA API  → devuelve el JWT propio            la WEB lo guarda en su cookie
 *
 * El canje lo hace la API y NO la web porque ahí vive el `client_secret`, que
 * no puede salir del servidor. Y la cookie la pone la WEB y no la API porque
 * son dominios distintos (maqserv24.com y api.maqserv24.com): una cookie puesta
 * por la API no la manda el navegador a la web.
 *
 * SIN VARIABLES NO SE ROMPE NADA: si faltan las credenciales, `googleActivo()`
 * devuelve false, la API responde 503 y el sitio ni siquiera pinta el botón.
 * Es a propósito — un botón que existe y falla es peor que uno que no está.
 */
import { BadRequestException, Logger, ServiceUnavailableException } from '@nestjs/common';

const log = new Logger('GoogleAuth');

const AUTORIZAR = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const PERFIL = 'https://openidconnect.googleapis.com/v1/userinfo';

export interface PerfilGoogle {
  /** Identificador estable de la cuenta en Google. NO es el correo. */
  sub: string;
  email: string;
  emailVerificado: boolean;
  nombre: string;
  foto: string | null;
}

export const googleActivo = (): boolean =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

/** La URL a la que se manda al visitante. `state` lo genera y verifica la web. */
export function urlDeAutorizacion(redirectUri: string, state: string): string {
  if (!googleActivo()) throw new ServiceUnavailableException('El inicio con Google no está configurado.');
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    // Sin esto, quien tenga varias cuentas entra siempre con la última y no
    // entiende por qué; y si revoca el permiso, no se le vuelve a pedir.
    prompt: 'select_account',
  });
  return `${AUTORIZAR}?${q}`;
}

/**
 * Canjea el código por el perfil.
 *
 * `redirectUri` tiene que ser EXACTAMENTE el mismo que se usó al mandar al
 * visitante a Google —incluido el protocolo y la barra final—; Google compara
 * la cadena tal cual y si no coincide responde `redirect_uri_mismatch`, que es
 * el error con el que todo el mundo pierde la primera tarde.
 */
export async function perfilDesdeCodigo(code: string, redirectUri: string): Promise<PerfilGoogle> {
  if (!googleActivo()) throw new ServiceUnavailableException('El inicio con Google no está configurado.');

  const res = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    // El motivo va al LOG, no a la respuesta. El cuerpo de error de Google trae
    // el client_id y frases como "The OAuth client was not found", que son para
    // quien configura el servidor y no para quien intenta entrar — y de paso
    // confirmarían a un curioso que la credencial existe o no.
    const detalle = await res.text().catch(() => '');
    log.error(`Canje con Google rechazado (${res.status}): ${detalle.slice(0, 400)}`);
    throw new BadRequestException('No se pudo validar la cuenta de Google.');
  }

  const { access_token } = (await res.json()) as { access_token?: string };
  if (!access_token) throw new BadRequestException('Google no devolvió un token de acceso.');

  const perfil = await fetch(PERFIL, {
    headers: { Authorization: `Bearer ${access_token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!perfil.ok) throw new BadRequestException('No se pudo leer el perfil de Google.');

  const p = (await perfil.json()) as {
    sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string;
  };
  if (!p.sub || !p.email) throw new BadRequestException('Google no devolvió correo.');

  return {
    sub: p.sub,
    email: p.email.trim().toLowerCase(),
    emailVerificado: p.email_verified !== false,
    nombre: (p.name ?? p.email.split('@')[0]).slice(0, 190),
    foto: p.picture ?? null,
  };
}
