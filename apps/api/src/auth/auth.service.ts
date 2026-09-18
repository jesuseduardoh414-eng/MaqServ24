import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import type { AuthResponse, AuthUser } from '@maqserv/types';
import {
  crearRestablecimiento,
  hashPassword,
  passwordGrant,
  refreshGrant,
  restablecerConToken,
  tokensPara,
} from '../common/app-auth';
import { MailerService } from '../notifications/mailer.service';
import { correoRestablecerContrasena } from '../notifications/email-templates';
import type { PerfilGoogle } from './google';

/**
 * Auth de CLIENTES con JWT propio (ver common/app-auth.ts). La contraseña se
 * verifica con bcrypt contra `users.password`, que trae el mismo hash que tenía
 * Supabase Auth: nadie tuvo que cambiarla con la migración.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly mailer: MailerService) {}

  private toAuthUser(u: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    address: string | null;
    city: string | null;
    zip: string | null;
    residency?: string | null;
    created_at?: Date | null;
  }): AuthUser {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      address: u.address,
      city: u.city,
      zip: u.zip,
      residency: u.residency ?? null,
      createdAt: u.created_at ? u.created_at.toISOString() : null,
    };
  }

  async register(input: { name: string; email: string; password: string }): Promise<AuthResponse> {
    const email = input.email.trim().toLowerCase();
    const exists = await prisma.users.findFirst({ where: { email } });
    if (exists) throw new ConflictException('Ya existe una cuenta con ese correo');

    const hash = await hashPassword(input.password);
    const u = await prisma.users.create({
      data: { name: input.name, email, password: hash, created_at: new Date(), updated_at: new Date() },
    });
    const tokens = await tokensPara({ rol: 'customer', id: u.id, hash });
    return { token: tokens.access_token, refresh_token: tokens.refresh_token, user: this.toAuthUser(u) };
  }

  async login(input: { email: string; password: string }): Promise<AuthResponse> {
    const session = await passwordGrant('customer', input.email, input.password);
    if (!session) throw new UnauthorizedException('Correo o contraseña incorrectos');
    const u = await prisma.users.findUnique({ where: { id: session.id } });
    if (!u) throw new UnauthorizedException('Correo o contraseña incorrectos');
    return { token: session.access_token, refresh_token: session.refresh_token, user: this.toAuthUser(u) };
  }

  /**
   * Entrar con Google.
   *
   * Tres caminos, en este orden, y el orden importa:
   *
   *  1. Ya se había entrado con Google antes → la fila de `social_providers`
   *     dice qué cuenta es. Se busca por el `sub` de Google y NO por el correo,
   *     porque el correo de una cuenta de Google se puede cambiar y el `sub` no.
   *
   *  2. Existe una cuenta con ese correo, creada con contraseña → se ENLAZA.
   *     La alternativa sería crear una segunda cuenta con el mismo correo, y
   *     entonces quien pidió algo por la vía normal no lo vería al entrar con
   *     Google. Se exige `email_verified` para esto: sin esa comprobación,
   *     cualquiera que registrara ese correo en su propio Google se quedaría
   *     con la cuenta ajena.
   *
   *  3. No existe → se crea, con una contraseña aleatoria que nadie conoce.
   *     No se deja vacía a propósito: `users.password` alimenta la versión del
   *     token (ver `app-auth`), y un hash vacío haría que todas las sesiones
   *     de estas cuentas compartieran versión.
   */
  async loginConGoogle(perfil: PerfilGoogle): Promise<AuthResponse> {
    const enlace = await prisma.social_providers.findFirst({
      where: { provider: 'google', provider_id: perfil.sub },
    });

    let usuario = enlace ? await prisma.users.findUnique({ where: { id: enlace.user_id } }) : null;

    if (!usuario) {
      const porCorreo = await prisma.users.findFirst({ where: { email: perfil.email } });

      if (porCorreo) {
        if (!perfil.emailVerificado) {
          throw new UnauthorizedException(
            'Ya existe una cuenta con ese correo. Entra con tu contraseña, o verifica el correo en Google y vuelve a intentarlo.',
          );
        }
        usuario = porCorreo;
      } else {
        const hash = await hashPassword(randomUUID() + randomUUID());
        usuario = await prisma.users.create({
          data: {
            name: perfil.nombre,
            email: perfil.email,
            password: hash,
            photo: perfil.foto,
            created_at: new Date(),
            updated_at: new Date(),
          },
        });
      }

      // El enlace se guarda SIEMPRE que no existiera, tanto si la cuenta es
      // nueva como si se acaba de reconocer por correo: es lo que hace que la
      // próxima vez entre por el camino 1.
      await prisma.social_providers.create({
        data: {
          user_id: usuario.id,
          provider: 'google',
          provider_id: perfil.sub,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
      this.logger.log(`Google: cuenta ${porCorreo ? 'enlazada' : 'creada'} para ${perfil.email}`);
    }

    // Una cuenta del sistema viejo puede tener `password` en NULL. El hash es
    // lo que da versión al token (ver `app-auth`), así que sin él todas esas
    // sesiones compartirían versión y cerrar una las cerraría todas: se le
    // asigna una contraseña aleatoria que nadie conoce y que no impide nada —
    // quien la quiera usar pasa por "olvidé mi contraseña".
    let hash = usuario.password;
    if (!hash) {
      hash = await hashPassword(randomUUID() + randomUUID());
      await prisma.users.update({ where: { id: usuario.id }, data: { password: hash, updated_at: new Date() } });
    }

    const tokens = await tokensPara({ rol: 'customer', id: usuario.id, hash });
    return { token: tokens.access_token, refresh_token: tokens.refresh_token, user: this.toAuthUser(usuario) };
  }

  /**
   * Renueva la pareja de tokens. Sirve para clientes Y administradores: el
   * refresh token sabe de quién es, y el panel reutiliza esta misma ruta.
   */
  async refresh(refresh_token: string): Promise<{ token: string; refresh_token?: string }> {
    const session = await refreshGrant(refresh_token);
    if (!session) throw new UnauthorizedException('Sesión expirada');
    return { token: session.access_token, refresh_token: session.refresh_token };
  }

  async me(userId: number): Promise<AuthUser> {
    const u = await prisma.users.findUnique({ where: { id: userId } });
    if (!u) throw new UnauthorizedException();
    return this.toAuthUser(u);
  }

  /**
   * "Olvidé mi contraseña": genera el enlace y lo manda por correo. Siempre
   * responde ok, exista o no el correo (anti-enumeración). Si el correo saliente
   * no está configurado, el intento queda en `email_log` como "simulado" — igual
   * que el resto de avisos — y el panel lo muestra.
   */
  async forgotPassword(email: string, redirectTo?: string): Promise<{ ok: boolean }> {
    const r = await crearRestablecimiento(email);
    if (!r) return { ok: true };
    const base = (redirectTo ?? process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    const url = `${base}/restablecer?token=${r.token}`;
    const correo = correoRestablecerContrasena({ nombre: r.name, url, minutos: 60 });
    const estado = await this.mailer.enviar({ kind: 'password_reset', to: r.email, toName: r.name, ...correo });
    if (estado !== 'enviado') {
      this.logger.warn(`Restablecer contraseña de ${r.email}: el correo quedó como "${estado}"`);
    }
    return { ok: true };
  }

  async resetPassword(token: string, password: string): Promise<{ ok: boolean }> {
    const ok = await restablecerConToken(token, password);
    if (!ok) throw new UnauthorizedException('El enlace ya no sirve. Pide uno nuevo desde "¿Olvidaste tu contraseña?".');
    return { ok: true };
  }
}
