import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { MARKETPLACE_ACTIVO } from '@maqserv/config';

/**
 * Cierra las rutas del marketplace heredado cuando está apagado (ver
 * `marketplace.ts` en @maqserv/config). 404 y no 403 a propósito: para el
 * sitio esas rutas no existen, y decir "prohibido" invitaría a buscar cómo
 * entrar. El panel no necesita esto: su módulo `marketplace` se filtra en el
 * guard de administradores.
 */
@Injectable()
export class MarketplaceGuard implements CanActivate {
  canActivate(): boolean {
    if (!MARKETPLACE_ACTIVO) throw new NotFoundException('El marketplace no está activo.');
    return true;
  }
}
