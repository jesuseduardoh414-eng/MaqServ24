import { pedirOr } from '@/lib/api';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export interface ProveedoresAuth {
  google: boolean;
}

/**
 * Qué inicios de sesión externos están realmente configurados.
 *
 * Se le pregunta a la API en vez de mirar `process.env` aquí porque quien tiene
 * que poder canjear el código es ELLA: el sitio puede tener el `client_id`
 * puesto y la API no tener el `client_secret`, y entonces el botón llevaría a
 * Google para acabar fallando al volver. La única respuesta que sirve es la de
 * quien hace el canje.
 *
 * Ante cualquier fallo, `false`: sin botón. Un acceso que no aparece es una
 * molestia; uno que aparece y no funciona es una queja.
 */
export async function getAuthProviders(): Promise<ProveedoresAuth> {
  return pedirOr<ProveedoresAuth>(
    `${API_URL}/auth/providers`,
    { cache: 'no-store', signal: AbortSignal.timeout(5_000) },
    { google: false },
    (v) => typeof v === 'object' && v !== null && 'google' in (v as Record<string, unknown>),
  );
}
