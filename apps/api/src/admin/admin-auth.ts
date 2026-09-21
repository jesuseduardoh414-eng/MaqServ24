import {
  BadRequestException, Body, CanActivate, Controller, ExecutionContext, ForbiddenException, Get,
  Injectable, Post, Req, SetMetadata, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { prisma } from '@maqserv/db';
import { rolDeAdmin, puedeVerCon, modulosEfectivos, ROLES_ADMIN, type ModuloAdmin, type RolAdmin } from '@maqserv/config';
import {
  firmarRestablecimientoAdmin, hashPassword, huellaDeHash, leerRestablecimientoAdmin,
  passwordGrant, RESTABLECER_ADMIN_MINUTOS, verifyAccessToken,
} from '../common/app-auth';
import { MailerService } from '../notifications/mailer.service';
import { correoRestablecerContrasena } from '../notifications/email-templates';
import { registrarAccion } from './audit';
import { permisosVigentes } from './permisos';

/**
 * Auth de ADMINISTRADORES con JWT propio (ver common/app-auth.ts). El token
 * lleva app_metadata.role='admin' y app_metadata.app_admin_id; un token de
 * cliente (role='customer') jamás pasa el AdminGuard.
 */

export interface AdminRequest {
  headers: Record<string, string | undefined>;
  adminId: number;
  /** Quién es y qué puede. Lo pone el guard; lo leen las rutas y la bitácora. */
  adminRol: RolAdmin;
  adminEmail: string;
  adminNombre: string;
}

/**
 * El módulo al que pertenece una ruta del panel (ver `admin-roles.ts`).
 *
 * Va en el controlador; sólo se repite en un método cuando ese método no
 * pertenece al mismo módulo que sus vecinos (le pasa a `admin-ops`, que sirve
 * el tablero, las órdenes y las cotizaciones desde el mismo archivo).
 */
export const MODULO_KEY = 'modulo_admin';
export const Modulo = (m: ModuloAdmin) => SetMetadata(MODULO_KEY, m);

/**
 * Caché corta de "esta cuenta sigue activa".
 *
 * El guard consultaba `admins` en CADA petición, y cada consulta a Supabase cuesta un
 * viaje de red (~65-100 ms): lo pagaba cada pantalla del panel, varias veces. Se guarda
 * el resultado unos segundos.
 *
 * Por qué NO rompe lo que arreglaba: la consulta existe para que "Desactivar" corte a
 * quien ya está dentro (antes seguía trabajando indefinidamente porque el token de
 * Supabase no sabe nada de `admins.status`). Con la caché sigue cortando — dentro de
 * ADMIN_TTL_MS. 10 segundos para una persona es "al instante", y a cambio el panel se
 * ahorra un viaje por petición.
 */
const ADMIN_TTL_MS = 10_000;

/** Lo que el panel necesita saber de quien está dentro. */
interface CachedAdmin {
  id: number;
  name: string;
  email: string;
  role: string | null;
}
const activeCache = new Map<number, { until: number; admin: CachedAdmin }>();

/** Lo llama cualquier sitio que desactive/borre un admin: la caché no debe sobrevivirlo. */
export function forgetAdmin(id: number): void {
  activeCache.delete(id);
}

/**
 * La cuenta activa, de la caché o de la BD. Fuente ÚNICA para el guard y para
 * `/admin/auth/me`: cada página del panel llama a `me()` antes de pedir sus datos, así
 * que sin esto toda pantalla pagaba dos viajes a la BD en fila (uno del guard y otro de
 * `me`) antes de empezar.
 *
 * @returns null si no existe o está desactivada.
 */
async function activeAdmin(id: number): Promise<CachedAdmin | null> {
  const hit = activeCache.get(id);
  if (hit && hit.until > Date.now()) return hit.admin;

  const a = await prisma.admins.findFirst({
    where: { id, status: 1 },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!a) {
    activeCache.delete(id);
    return null;
  }
  activeCache.set(id, { until: Date.now() + ADMIN_TTL_MS, admin: a });
  return a;
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AdminRequest>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('Falta el token');
    let id: number;
    try {
      const claims = await verifyAccessToken(token);
      if (claims.app_metadata?.role !== 'admin') throw new Error('no admin');
      const claimed = claims.app_metadata?.app_admin_id;
      if (typeof claimed !== 'number') throw new Error('sin app_admin_id');
      id = claimed;
    } catch {
      throw new UnauthorizedException('Token de administrador inválido');
    }

    /**
     * `status` se comprueba en CADA petición, no solo al entrar: el token es de Supabase
     * y no sabe nada de `admins.status`; el middleware del panel lo renueva solo con el
     * refresh token. Sin esto, "Desactivar" no cortaba a quien ya estaba dentro.
     * La caché (ver arriba) evita pagar el viaje a la BD en cada petición.
     */
    const admin = await activeAdmin(id);
    if (!admin) {
      throw new UnauthorizedException('Tu cuenta de administrador está desactivada');
    }

    /**
     * PERMISOS POR ROL. Cierra el riesgo de la sección 30: hasta ahora quien
     * capturaba una cotización podía cambiar el diseño del sitio.
     *
     * Va FAIL-CLOSED a propósito: una ruta que se nos olvide marcar con
     * `@Modulo()` sólo la alcanza Dirección. El olvido se nota como "esto no me
     * aparece" —que se reporta y se arregla— y nunca como un permiso de más,
     * que no se nota hasta que alguien borra algo que no le tocaba.
     */
    const rol = rolDeAdmin(admin.role);
    const modulo = this.reflector.getAllAndOverride<ModuloAdmin | undefined>(MODULO_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    // Los permisos salen de la tabla por defecto MÁS lo que Dirección haya
    // cambiado en el panel (permisos.ts trae su propia caché).
    const permisos = await permisosVigentes();
    if (modulo ? !puedeVerCon(rol, modulo, permisos) : rol !== 'direccion') {
      throw new ForbiddenException('Tu rol no tiene acceso a esta sección del panel');
    }

    req.adminId = id;
    req.adminRol = rol;
    req.adminEmail = admin.email;
    req.adminNombre = admin.name;
    return true;
  }
}

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly mailer: MailerService) {}

  // La puerta del panel: pocos usuarios, ninguna razón para intentar 10 veces por
  // minuto, y el premio de entrar es todo el negocio.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login')
  async login(@Body() body: unknown) {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');
    // `passwordGrant('admin', …)` solo mira `admins`: un cliente con el mismo
    // correo nunca entra aquí, y una cuenta desactivada tampoco (status != 1).
    const session = await passwordGrant('admin', parsed.data.email, parsed.data.password);
    if (!session) throw new UnauthorizedException('Correo o contraseña incorrectos');
    const a = await prisma.admins.findFirst({ where: { id: session.id, status: 1 } });
    if (!a) throw new UnauthorizedException('Correo o contraseña incorrectos');
    return {
      token: session.access_token,
      refresh_token: session.refresh_token,
      admin: { id: a.id, name: a.name, email: a.email, rol: rolDeAdmin(a.role) },
    };
  }

  /**
   * Lo llama CADA página del panel antes de pedir sus datos. Sale de la misma caché que
   * usó el guard un instante antes (`activeAdmin`), así que no cuesta ningún viaje a la
   * BD: antes eran dos por pantalla, en fila, solo para saber quién eres.
   */
  // 'inicio' lo tienen todos los roles: esta ruta es "¿quién soy?", y pedirla
  // es el primer acto de cualquier pantalla. Sin módulo, el fail-closed del
  // guard dejaría el panel entero para Dirección.
  @Modulo('inicio')
  @Get('me')
  @UseGuards(AdminGuard)
  async me(@Req() req: AdminRequest) {
    const a = await activeAdmin(req.adminId);
    if (!a) throw new UnauthorizedException();
    const rol = rolDeAdmin(a.role);
    // El panel dibuja su menú con esto: una sola fuente para API y pantalla.
    return { ...a, rol, modulos: modulosEfectivos(rol, await permisosVigentes()), rolNombre: ROLES_ADMIN[rol].nombre };
  }

  /**
   * "¿Olvidaste tu contraseña?" del panel, paso 1.
   *
   * Responde `ok` SIEMPRE, exista o no el correo: si la respuesta cambiara,
   * esta ruta serviría para averiguar qué correos tienen cuenta de
   * administrador, que es lo primero que busca quien quiere entrar sin permiso.
   * Solo cuentas activas: una desactivada tampoco debe poder volver por aquí.
   *
   * El enlace apunta al PANEL (`ADMIN_URL`), no al sitio: no se acepta un
   * destino desde el cuerpo, para que nadie pueda fabricar enlaces de
   * restablecimiento que lleven a otro dominio.
   */
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('olvide')
  async olvide(@Body() body: unknown) {
    const parsed = z.object({ email: z.string().email() }).safeParse(body);
    if (!parsed.success) throw new BadRequestException('Escribe un correo válido.');
    const correo = parsed.data.email.trim().toLowerCase();

    const a = await prisma.admins.findFirst({
      where: { email: correo, status: 1 },
      select: { id: true, name: true, email: true, password: true },
    });
    if (!a || !a.password) return { ok: true };

    const token = await firmarRestablecimientoAdmin(a.id, a.password);
    const base = (process.env.ADMIN_URL ?? 'http://localhost:3001').replace(/\/$/, '');
    const correoListo = correoRestablecerContrasena({
      nombre: a.name, url: `${base}/restablecer?token=${token}`, minutos: RESTABLECER_ADMIN_MINUTOS,
    });
    await this.mailer.enviar({ kind: 'password_reset', to: a.email, toName: a.name, ...correoListo });
    return { ok: true };
  }

  /**
   * Paso 2: el token viene del enlace del correo. Vale una sola vez porque
   * lleva la huella del hash vigente: en cuanto se guarda la contraseña nueva,
   * la huella cambia y ese mismo enlace deja de coincidir.
   */
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('restablecer')
  async restablecer(@Body() body: unknown) {
    const parsed = z.object({ token: z.string().min(20), password: z.string().min(8).max(200) }).safeParse(body);
    if (!parsed.success) throw new BadRequestException('La contraseña necesita al menos 8 caracteres.');

    const caducado = 'El enlace ya no sirve. Pide uno nuevo desde "¿Olvidaste tu contraseña?".';
    const leido = await leerRestablecimientoAdmin(parsed.data.token);
    if (!leido) throw new UnauthorizedException(caducado);

    const a = await prisma.admins.findFirst({
      where: { id: leido.adminId, status: 1 },
      select: { id: true, name: true, email: true, role: true, password: true },
    });
    if (!a || !a.password || huellaDeHash(a.password) !== leido.pv) throw new UnauthorizedException(caducado);

    await prisma.admins.update({
      where: { id: a.id },
      data: { password: await hashPassword(parsed.data.password), updated_at: new Date() },
    });
    // La caché del guard guarda `role`, no el hash, pero se limpia igual: es
    // barato y evita cualquier sorpresa con una sesión a medio renovar.
    forgetAdmin(a.id);
    // Queda en la bitácora como acción de la propia cuenta: quien restablece
    // es quien tiene el correo, y "¿quién cambió esta contraseña?" es una
    // pregunta que sí se hace.
    await registrarAccion(
      { adminId: a.id, adminRol: rolDeAdmin(a.role), adminEmail: a.email, adminNombre: a.name, headers: {} },
      'admins', 'contrasena.restablecer', a.email, 'Por enlace de "¿Olvidaste tu contraseña?"',
    );
    return { ok: true };
  }
}
