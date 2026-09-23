import { randomUUID } from 'node:crypto';
import { ConflictException, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import type { AuthResponse, AuthUser } from '@maqserv/types';
import {
  VERIFICACION_HORAS,
  crearRestablecimiento,
  firmarVerificacionCorreo,
  hashPassword,
  leerVerificacionCorreo,
  passwordGrant,
  refreshGrant,
  restablecerConToken,
  tokensPara,
} from '../common/app-auth';
import { MailerService } from '../notifications/mailer.service';
import { correoBienvenida, correoConfirmarCuenta, correoRestablecerContrasena } from '../notifications/email-templates';

/** Con qué contesta el login cuando la cuenta existe pero no confirmó su correo. */
export const CODIGO_NO_VERIFICADO = 'email_no_verificado';

const sitio = () => (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
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

  /**
   * REGISTRO CON CONTRASEÑA: la cuenta nace SIN sesión y se activa desde el
   * correo (decisión del cliente, 2026-09-23). Antes entraba directo con
   * cualquier correo, real o no. Se devuelve `verificar: true` y no tokens; la
   * sesión la da el enlace de confirmación (`verificarCorreo`).
   */
  async register(input: { name: string; email: string; password: string; next?: string }): Promise<{ verificar: true; email: string }> {
    const email = input.email.trim().toLowerCase();
    const exists = await prisma.users.findFirst({ where: { email } });
    if (exists) throw new ConflictException('Ya existe una cuenta con ese correo');

    const hash = await hashPassword(input.password);
    const u = await prisma.users.create({
      data: { name: input.name, email, password: hash, email_verified_at: null, created_at: new Date(), updated_at: new Date() },
    });
    await this.mandarConfirmacion({ id: u.id, name: u.name, email: u.email }, input.next);
    return { verificar: true, email: u.email };
  }

  /** El correo con el enlace de confirmación. Nunca lanza: si no sale, queda en la bitácora. */
  private async mandarConfirmacion(u: { id: number; name: string; email: string }, next?: string): Promise<void> {
    const destino = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
    const token = await firmarVerificacionCorreo(u.id, u.email, destino);
    const url = `${sitio()}/api/auth/verificar?t=${encodeURIComponent(token)}&next=${encodeURIComponent(destino)}`;
    const correo = correoConfirmarCuenta({ nombre: u.name, url, horas: VERIFICACION_HORAS });
    const estado = await this.mailer.enviar({ kind: 'email_verification', to: u.email, toName: u.name, ...correo });
    if (estado !== 'enviado') this.logger.warn(`Confirmación de ${u.email}: el correo quedó como "${estado}"`);
  }

  /**
   * Segundo paso: el enlace del correo. Marca el correo como confirmado y
   * devuelve la sesión, para que confirmar sea entrar. Idempotente: abrir el
   * enlace dos veces no falla, vuelve a dar sesión.
   */
  async verificarCorreo(token: string): Promise<AuthResponse> {
    const lectura = await leerVerificacionCorreo(token);
    if (!lectura.ok) {
      throw new UnauthorizedException(
        lectura.motivo === 'caducado'
          ? 'El enlace ya caducó. Entra con tu correo y contraseña y te mandamos uno nuevo.'
          : 'Ese enlace no sirve. Entra con tu correo y contraseña y te mandamos uno nuevo.',
      );
    }
    const u = await prisma.users.findUnique({ where: { id: lectura.userId } });
    // El enlace vale para el correo con el que se firmó: si lo cambió, no.
    if (!u || u.email.toLowerCase() !== lectura.email) throw new UnauthorizedException('Ese enlace no sirve.');
    if (!u.email_verified_at) {
      await prisma.users.update({ where: { id: u.id }, data: { email_verified_at: new Date(), updated_at: new Date() } });
    }
    let hash = u.password;
    if (!hash) {
      hash = await hashPassword(randomUUID() + randomUUID());
      await prisma.users.update({ where: { id: u.id }, data: { password: hash, updated_at: new Date() } });
    }
    const tokens = await tokensPara({ rol: 'customer', id: u.id, hash });
    return { token: tokens.access_token, refresh_token: tokens.refresh_token, user: this.toAuthUser(u) };
  }

  /** Reenviar el enlace. Siempre ok, exista o no el correo (anti-enumeración). */
  async reenviarVerificacion(email: string, next?: string): Promise<{ ok: boolean }> {
    const u = await prisma.users.findFirst({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, name: true, email: true, email_verified_at: true },
    });
    if (u && !u.email_verified_at) await this.mandarConfirmacion(u, next);
    return { ok: true };
  }

  async login(input: { email: string; password: string }): Promise<AuthResponse> {
    const session = await passwordGrant('customer', input.email, input.password);
    if (!session) throw new UnauthorizedException('Correo o contraseña incorrectos');
    const u = await prisma.users.findUnique({ where: { id: session.id } });
    if (!u) throw new UnauthorizedException('Correo o contraseña incorrectos');
    /**
     * Contraseña correcta pero correo sin confirmar: no entra. Se dice con
     * un código para que la pantalla ofrezca reenviar el enlace. Va DESPUÉS
     * de comprobar la contraseña a propósito: así no revela si un correo
     * existe a quien no la sabe.
     */
    if (!u.email_verified_at) {
      throw new ForbiddenException({
        statusCode: 403,
        code: CODIGO_NO_VERIFICADO,
        message: 'Falta confirmar tu correo. Te mandamos un enlace al registrarte; ábrelo o pide uno nuevo.',
      });
    }
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
        // Google acaba de acreditar que ese correo es suyo: si la cuenta con
        // contraseña seguía sin confirmar, queda confirmada aquí mismo.
        if (!usuario.email_verified_at) {
          await prisma.users.update({ where: { id: usuario.id }, data: { email_verified_at: new Date(), updated_at: new Date() } });
        }
      } else {
        const hash = await hashPassword(randomUUID() + randomUUID());
        usuario = await prisma.users.create({
          data: {
            name: perfil.nombre,
            email: perfil.email,
            password: hash,
            photo: perfil.foto,
            // Google ya verificó el correo: no hay enlace que confirmar.
            email_verified_at: new Date(),
            created_at: new Date(),
            updated_at: new Date(),
          },
        });
        /**
         * Bienvenida (decisión del cliente, 2026-09-23): con Google no hay
         * nada que confirmar, pero la persona debe enterarse de que su
         * cuenta existe. Solo al CREARLA, nunca en cada inicio de sesión.
         */
        const bienvenida = correoBienvenida({ nombre: usuario.name, url: `${sitio()}/cuenta` });
        void this.mailer
          .enviar({ kind: 'welcome', to: usuario.email, toName: usuario.name, ...bienvenida })
          .catch((e: unknown) => this.logger.warn(`Bienvenida a ${usuario?.email}: ${(e as Error).message}`));
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
