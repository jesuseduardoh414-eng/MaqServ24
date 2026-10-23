import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { mismoSecreto } from './tasks-secret';

/** Header con el que web/admin nos pasan la IP real del visitante. */
export const CLIENT_IP_HEADER = 'x-client-ip';
/** Header con el que web/admin demuestran ser nuestro proxy (ver PROXY_SECRET). */
export const PROXY_SECRET_HEADER = 'x-proxy-secret';

let warned = false;

/**
 * Límite por VISITANTE, no por servidor.
 *
 * El navegador nunca llama a esta API: siempre pasa por Next (Vercel), que hace la
 * petición del lado del servidor (ver DEPLOY.md). Por eso `req.ip` es la IP de Vercel
 * y es la MISMA para todos los clientes: contar por `req.ip` metería a toda la tienda
 * en un solo cupo y un rato ocupado bloquearía a gente legítima. Por eso los proxies
 * nos mandan la IP real del visitante en `x-client-ip`.
 *
 * Ese header es texto que cualquiera puede inventar, así que solo se cree si viene
 * firmado con `PROXY_SECRET` (mismo valor en la API y en las apps Next). Quien llegue
 * directo a la API sin el secreto cuenta por su IP real y sí queda limitado.
 *
 * Sin `PROXY_SECRET` configurado se acepta `x-client-ip` a secas: es lo que hace
 * funcionar dev y los despliegues simples. Queda avisado en el log, porque en ese modo
 * un atacante puede inventar el header y saltarse el límite.
 */
@Injectable()
export class ClientThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(ClientThrottlerGuard.name);

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const headers = (req.headers ?? {}) as Record<string, string | undefined>;
    const claimed = headers[CLIENT_IP_HEADER]?.trim();
    const secret = process.env.PROXY_SECRET?.trim();

    if (claimed) {
      if (!secret) {
        if (!warned) {
          warned = true;
          this.logger.warn(
            'PROXY_SECRET no está configurado: se confía en x-client-ip sin firma y el límite es evadible. Configúralo en la API y en web/admin.',
          );
        }
        return claimed;
      }
      if (mismoSecreto(headers[PROXY_SECRET_HEADER], secret)) return claimed;
      // Header sin firma válida: no se cree. Se cuenta por la IP real de quien llama.
    }
    return req.ip ?? req.socket?.remoteAddress ?? 'desconocido';
  }
}
