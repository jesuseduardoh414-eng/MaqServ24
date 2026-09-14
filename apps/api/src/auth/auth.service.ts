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
