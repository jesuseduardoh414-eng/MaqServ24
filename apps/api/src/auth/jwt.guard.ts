import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { verifySupabaseToken } from '../common/supabase-auth';

/** Forma mínima del request que necesitamos (evita depender de @types/express). */
export interface AuthedRequest {
  headers: Record<string, string | undefined>;
  userId: number;
}

/**
 * Valida el access token de Supabase (JWKS ES256) y extrae el id de la app
 * desde app_metadata.app_user_id (inyectado al importar/crear el usuario).
 */
@Injectable()
export class JwtGuard implements CanActivate {
  private readonly logger = new Logger(JwtGuard.name);

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('Falta el token');
    try {
      const claims = await verifySupabaseToken(token);
      const uid = claims.app_metadata?.app_user_id;
      if (typeof uid !== 'number') throw new Error('token sin app_user_id');
      req.userId = uid;
      return true;
    } catch (err) {
      // El MOTIVO va al log: sin esto, un Supabase pausado (JWKS inalcanzable)
      // se reportaba igual que un token vencido y el diagnóstico costaba horas.
      // El 401 al cliente sigue siendo genérico a propósito.
      const msg = (err as Error)?.message ?? String(err);
      if (!/exp|expired/i.test(msg)) this.logger.warn(`Token rechazado: ${msg}`);
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
