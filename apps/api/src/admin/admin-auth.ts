import {
  BadRequestException, Body, CanActivate, Controller, ExecutionContext, ForbiddenException, Get,
  HttpException, HttpStatus, Injectable, Post, Req, ServiceUnavailableException, SetMetadata, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Reflector } from '@nestjs/core';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { prisma } from '@maqserv/db';
import { problemaContrasena, rolDeAdmin, puedeVerCon, modulosEfectivos, ROLES_ADMIN, type ModuloAdmin, type RolAdmin } from '@maqserv/config';
import {
  firmarRestablecimientoAdmin, hashPassword, huellaDeHash, leerRestablecimientoAdmin,
  passwordGrant, perdonarIntentos, RESTABLECER_ADMIN_MINUTOS, tokensPara, verifyAccessToken, verifyPassword, versionDeSesion,
} from '../common/app-auth';
import { MINUTOS_DE_BLOQUEO, anotarFallo, estaBloqueada, limpiarFallos } from '../common/intentos';
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
  /** Huella de la sesión vigente (contraseña + versión): un token con otra ya no vale. */
  pv: string;
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

  const fila = await prisma.admins.findFirst({
    where: { id, status: 1 },
    select: { id: true, name: true, email: true, role: true, password: true, remember_token: true },
  });
  if (!fila) {
    activeCache.delete(id);
    return null;
  }
  // El hash no se guarda en la caché: solo su huella.
  const a: CachedAdmin = { id: fila.id, name: fila.name, email: fila.email, role: fila.role, pv: versionDeSesion(fila.password, fila.remember_token) };
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
    let pvToken: string | undefined;
    try {
      const claims = await verifyAccessToken(token);
      pvToken = typeof claims.pv === 'string' ? claims.pv : undefined;
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
    // La sesión es de una contraseña anterior o se cerró (auditoría 2026-10-28).
    // Los tokens de antes de este cambio no traen huella y vencen solos en una hora.
    if (pvToken !== undefined && pvToken !== admin.pv) {
      throw new UnauthorizedException('Tu sesión se cerró. Vuelve a entrar.');
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

/**
 * `admins.status`: 1 activo, 0 desactivado y, desde el 2026-10-28, 2 = INVITADO:
 * la cuenta existe con el rol puesto y le llegó el correo, pero la persona
 * todavía no crea su contraseña. No entra (el guard y el login piden 1) hasta
 * que la cree por el enlace del correo; en ese momento pasa a 1.
 */
export const ADMIN_INVITADO = 2;

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
    const { pv: _huella, ...datos } = a;
    // El panel dibuja su menú con esto: una sola fuente para API y pantalla.
    return { ...datos, rol, modulos: modulosEfectivos(rol, await permisosVigentes()), rolNombre: ROLES_ADMIN[rol].nombre };
  }

  /**
   * CERRAR SESIÓN DE VERDAD (auditoría 2026-10-28). Antes solo se borraban las
   * cookies del navegador: un token copiado seguía sirviendo. Ahora cambia la
   * versión de sesión de la cuenta y caen TODAS sus sesiones (en cualquier
   * equipo), igual que al cambiar la contraseña.
   */
  @Modulo('inicio')
  @Post('logout')
  @UseGuards(AdminGuard)
  async logout(@Req() req: AdminRequest) {
    await prisma.admins.update({ where: { id: req.adminId }, data: { remember_token: randomBytes(24).toString('hex') } });
    forgetAdmin(req.adminId);
    return { ok: true };
  }

  /**
   * MI CONTRASEÑA (2026-10-28, decisión del dueño: cambiarla "solo lo puede
   * ver el usuario, no en el panel"). La propia, con la actual en la mano: si
   * alguien deja la sesión abierta, no puede cambiarla quien pase por ahí.
   * Cambiar el hash tumba las demás sesiones (ver common/app-auth.ts).
   */
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Modulo('inicio')
  @Post('mi-contrasena')
  @UseGuards(AdminGuard)
  async miContrasena(@Req() req: AdminRequest, @Body() body: unknown) {
    const parsed = z.object({ actual: z.string().min(1), nueva: z.string().min(8).max(200) }).safeParse(body);
    if (!parsed.success) throw new BadRequestException('Escribe tu contraseña actual y la nueva.');
    // Freno POR CUENTA (auditoría 2026-10-28): el de 5 por minuto es por IP, y
    // quien robara una sesión podía adivinar la actual cambiando de IP.
    const llave = `admin-actual:${req.adminId}`;
    if (estaBloqueada(llave)) {
      throw new HttpException(`Demasiados intentos con la contraseña actual. Espera ${MINUTOS_DE_BLOQUEO} minutos.`, HttpStatus.TOO_MANY_REQUESTS);
    }
    const a = await prisma.admins.findFirst({ where: { id: req.adminId, status: 1 }, select: { id: true, name: true, email: true, password: true, remember_token: true } });
    if (!a || !(await verifyPassword(parsed.data.actual, a.password))) {
      anotarFallo(llave);
      throw new UnauthorizedException('La contraseña actual no es correcta.');
    }
    limpiarFallos(llave);
    if (parsed.data.actual === parsed.data.nueva) throw new BadRequestException('La nueva es igual a la actual.');
    const debil = problemaContrasena(parsed.data.nueva, { nombre: a.name, correo: a.email });
    if (debil) throw new BadRequestException(debil);
    const hash = await hashPassword(parsed.data.nueva);
    await prisma.admins.update({ where: { id: a.id }, data: { password: hash, updated_at: new Date() } });
    forgetAdmin(a.id);
    await registrarAccion(req, 'admins', 'cambio de contraseña', a.email, 'La suya, desde Mi cuenta');
    // Las demás sesiones caen; esta sigue con tokens nuevos (el panel los guarda en sus cookies).
    const nuevos = await tokensPara({ rol: 'admin', id: a.id, hash, sesion: a.remember_token });
    return { ok: true, token: nuevos.access_token, refresh_token: nuevos.refresh_token };
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

    // Sin ADMIN_URL no se manda nada. Antes caía a localhost:3001 y el 21-sep
    // producción salió así: el correo llegó bien, pero el enlace abría el panel
    // LOCAL del desarrollador, cuya API rechazaba un token firmado por otra.
    // Se comprueba ANTES de buscar el correo para no delatar si existe.
    const base = (process.env.ADMIN_URL ?? '').trim().replace(/\/$/, '');
    if (!base) {
      throw new ServiceUnavailableException('Falta ADMIN_URL en las variables de la API: sin ella no se puede armar el enlace del correo.');
    }

    const a = await prisma.admins.findFirst({
      where: { email: correo, status: 1 },
      select: { id: true, name: true, email: true, password: true },
    });
    if (!a || !a.password) return { ok: true };

    const token = await firmarRestablecimientoAdmin(a.id, a.password);
    const correoListo = correoRestablecerContrasena({
      nombre: a.name, url: `${base}/restablecer?token=${token}`, minutos: RESTABLECER_ADMIN_MINUTOS,
    });
    await this.mailer.enviar({ kind: 'admin_password_reset', to: a.email, toName: a.name, ...correoListo });
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
    const debil = problemaContrasena(parsed.data.password);
    if (debil) throw new BadRequestException(debil);

    const pideOtro = 'Pide uno nuevo desde "¿Olvidaste tu contraseña?" o, si es una invitación, pide que te la vuelvan a mandar.';
    const leido = await leerRestablecimientoAdmin(parsed.data.token);
    if (!leido.ok) {
      throw new UnauthorizedException(
        leido.motivo === 'caducado'
          ? `El enlace caducó. ${pideOtro}`
          : `Este enlace no es de este panel o llegó incompleto. ${pideOtro}`,
      );
    }

    // Activa o invitada: la invitación se acepta creando la contraseña por este mismo camino.
    const a = await prisma.admins.findFirst({
      where: { id: leido.adminId, status: { in: [1, ADMIN_INVITADO] } },
      select: { id: true, name: true, email: true, role: true, password: true, status: true },
    });
    // Huella distinta = la contraseña ya cambió después de pedir el enlace: se usó.
    if (!a || !a.password || huellaDeHash(a.password) !== leido.pv) {
      throw new UnauthorizedException(`Este enlace ya se usó, o la contraseña cambió después de pedirlo. ${pideOtro}`);
    }

    const invitada = a.status === ADMIN_INVITADO;
    await prisma.admins.update({
      where: { id: a.id },
      data: { password: await hashPassword(parsed.data.password), status: 1, updated_at: new Date() },
    });
    // La caché del guard guarda `role`, no el hash, pero se limpia igual: es
    // barato y evita cualquier sorpresa con una sesión a medio renovar.
    forgetAdmin(a.id);
    perdonarIntentos('admin', a.email);
    // Queda en la bitácora como acción de la propia cuenta: quien restablece
    // es quien tiene el correo, y "¿quién cambió esta contraseña?" es una
    // pregunta que sí se hace.
    await registrarAccion(
      { adminId: a.id, adminRol: rolDeAdmin(a.role), adminEmail: a.email, adminNombre: a.name, headers: {} },
      'admins',
      invitada ? 'contrasena.crear' : 'contrasena.restablecer',
      a.email,
      invitada ? 'Aceptó la invitación al panel' : 'Por enlace de "¿Olvidaste tu contraseña?"',
    );
    return { ok: true };
  }
}
