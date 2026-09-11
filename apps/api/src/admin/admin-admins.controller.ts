import {
  BadRequestException, Body, Controller, Get, NotFoundException, Param,
  ParseIntPipe, Patch, Post, Req, UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@maqserv/db';
import { rolDeAdmin, ROLES_ADMIN, ROL_POR_DEFECTO, type RolAdmin } from '@maqserv/config';
import { AdminGuard, forgetAdmin, type AdminRequest, Modulo } from './admin-auth';
import { adminCreateUser, adminSetPassword } from '../common/supabase-auth';
import { registrarAccion } from './audit';

/**
 * Quién puede entrar al panel.
 *
 * ⚠️ LO QUE HAY QUE ENTENDER ANTES DE TOCAR ESTO: el login de admin **NO valida
 * `admins.password`**. Va por `passwordGrant` de Supabase Auth (ver `admin-auth.ts`);
 * la columna `password` es un hash heredado del Laravel viejo que ya nadie lee.
 *
 * Una cuenta de administrador vive en DOS lados y necesita los dos:
 *   1. la fila en `admins` (id, nombre, rol, `status`),
 *   2. el usuario en `auth.users` con `app_metadata.role = 'admin'` y `app_admin_id`,
 *      enlazado por `admins.auth_id`.
 *
 * Antes esto solo hacía (1): la creación respondía 201 y el administrador nuevo
 * **no podía entrar jamás** (401). Era deuda de la migración a Supabase — el módulo
 * se escribió antes y nunca se re-cableó.
 */
const ROLES_VALIDOS = Object.keys(ROLES_ADMIN) as [RolAdmin, ...RolAdmin[]];

@Modulo('admins')
@Controller('admin/admins')
@UseGuards(AdminGuard)
export class AdminAdminsController {
  @Get()
  async list(@Req() req: AdminRequest) {
    const rows = await prisma.admins.findMany({ orderBy: { id: 'asc' } });
    return rows.map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      role: a.role,
      rol: rolDeAdmin(a.role),
      rolNombre: ROLES_ADMIN[rolDeAdmin(a.role)].nombre,
      status: a.status,
      /** Sin `auth_id` no existe en Supabase ⇒ no puede entrar por más activo que se vea. */
      canLogin: a.auth_id !== null,
      isMe: a.id === req.adminId,
      createdAt: a.created_at ? a.created_at.toISOString() : null,
    }));
  }

  /**
   * La bitácora, en la misma pantalla que reparte los permisos.
   *
   * Registrar sin enseñar no es un control: es un archivo que nadie abre. Va
   * aquí y no en su propio menú porque se consulta cuando ya pasó algo raro, y
   * lo primero que se mira entonces es quién tenía acceso.
   */
  @Get('bitacora')
  async bitacora() {
    const filas = await prisma.admin_audit.findMany({
      orderBy: { id: 'desc' },
      take: 60,
    });
    return filas.map((f) => ({
      id: f.id,
      quien: f.admin_email,
      rol: f.admin_rol,
      modulo: f.modulo,
      accion: f.accion,
      objetivo: f.objetivo,
      detalle: f.detalle,
      cuando: f.created_at.toISOString(),
    }));
  }

  @Post()
  async create(@Req() req: AdminRequest, @Body() body: unknown) {
    const schema = z.object({
      name: z.string().min(2).max(100),
      email: z.string().email().max(190),
      password: z.string().min(8).max(100),
      phone: z.string().max(50).optional(),
      // Sin rol explícito cae en el de MENOS alcance, no en el de más: una
      // cuenta con permisos de sobra no se nota hasta que alguien borra algo.
      rol: z.enum(ROLES_VALIDOS).default(ROL_POR_DEFECTO),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Datos inválidos');
    const email = parsed.data.email.trim().toLowerCase();

    if (await prisma.admins.findUnique({ where: { email } })) {
      throw new BadRequestException('Ya existe un administrador con ese correo');
    }

    const a = await prisma.admins.create({
      data: {
        name: parsed.data.name,
        email,
        phone: parsed.data.phone ?? '',
        // Se conserva por compatibilidad con el sistema viejo; el login NO lo usa.
        password: await bcrypt.hash(parsed.data.password, 10),
        role: parsed.data.rol,
        status: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // La cuenta que SÍ da acceso. `app_admin_id` es lo que el AdminGuard lee del JWT.
    try {
      const user = await adminCreateUser(email, parsed.data.password, {
        role: 'admin',
        provider_role: 'admin',
        app_admin_id: a.id,
      });
      await prisma.admins.update({ where: { id: a.id }, data: { auth_id: user.id } });
    } catch (e) {
      // Sin usuario de Supabase la fila es inservible: se deshace en vez de dejar
      // un administrador fantasma que aparenta estar activo y no puede entrar.
      await prisma.admins.delete({ where: { id: a.id } });
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      throw new BadRequestException(
        /already|exists|registered/i.test(msg)
          ? 'Ese correo ya está registrado en el sistema (quizá como cliente). Usa otro.'
          : `No se pudo crear la cuenta de acceso: ${msg}`,
      );
    }

    await registrarAccion(req, 'admins', 'alta de administrador', email, ROLES_ADMIN[parsed.data.rol].nombre);
    return { id: a.id };
  }

  @Patch(':id')
  async update(@Req() req: AdminRequest, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const schema = z.object({
      name: z.string().min(2).max(100).optional(),
      password: z.string().min(8).max(100).optional(),
      status: z.coerce.number().int().min(0).max(1).optional(),
      rol: z.enum(ROLES_VALIDOS).optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');

    const a = await prisma.admins.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Administrador no encontrado');
    // Nadie se desactiva a sí mismo (evita quedarse sin acceso).
    if (parsed.data.status === 0 && id === req.adminId) {
      throw new BadRequestException('No puedes desactivar tu propia cuenta');
    }
    /**
     * Ni se cambia su propio rol. Es la misma salvaguarda que la de arriba: la
     * única pantalla que reparte permisos es ésta, y sólo Dirección la ve, así
     * que un director que se pone "Comercial" se deja fuera para siempre — y a
     * nadie le queda la pantalla para devolvérselo.
     */
    if (parsed.data.rol !== undefined && id === req.adminId) {
      throw new BadRequestException('No puedes cambiar tu propio rol: pídeselo a otra cuenta de Dirección');
    }

    // La contraseña vive en Supabase: reescribir solo el hash legacy no cambiaba nada.
    if (parsed.data.password) {
      if (!a.auth_id) throw new BadRequestException('Esta cuenta no tiene acceso configurado; no se le puede cambiar la contraseña.');
      await adminSetPassword(a.auth_id, parsed.data.password);
    }

    await prisma.admins.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        // Se mantiene el hash legacy en sincronía por si algo viejo aún lo lee.
        ...(parsed.data.password !== undefined ? { password: await bcrypt.hash(parsed.data.password, 10) } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.rol !== undefined ? { role: parsed.data.rol } : {}),
        updated_at: new Date(),
      },
    });
    // El guard cachea "sigue activa" unos segundos: sin esto, un admin recién
    // desactivado seguiría entrando hasta que la caché venciera sola. El rol
    // sale de esa MISMA caché, así que un cambio de permisos también la invalida.
    if (parsed.data.status !== undefined || parsed.data.rol !== undefined) forgetAdmin(id);

    if (parsed.data.rol !== undefined) {
      await registrarAccion(req, 'admins', 'cambio de rol', `${a.email} → ${ROLES_ADMIN[parsed.data.rol].nombre}`);
    }
    if (parsed.data.status !== undefined) {
      await registrarAccion(req, 'admins', parsed.data.status === 1 ? 'activar cuenta' : 'desactivar cuenta', a.email);
    }
    if (parsed.data.password !== undefined) {
      await registrarAccion(req, 'admins', 'cambio de contraseña', a.email);
    }
    return { ok: true };
  }
}
