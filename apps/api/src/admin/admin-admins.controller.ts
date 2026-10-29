import {
  BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param,
  ParseIntPipe, Patch, Post, Query, Req, ServiceUnavailableException, UseGuards,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma, type Prisma } from '@maqserv/db';
import { CUENTA_ACCESO_DIRECTO, problemaContrasena, rolDeAdmin, ROLES_ADMIN, ROL_POR_DEFECTO, type RolAdmin } from '@maqserv/config';
import { ADMIN_INVITADO, AdminGuard, forgetAdmin, type AdminRequest, Modulo } from './admin-auth';
import { firmarRestablecimientoAdmin, hashPassword } from '../common/app-auth';
import { registrarAccion } from './audit';
import { guardarAjuste, leerAjuste } from '../common/platform-settings';
import { MailerService } from '../notifications/mailer.service';
import { correoInvitacionPanel, correoRestablecerContrasena } from '../notifications/email-templates';

/**
 * ALTA POR INVITACIÓN (2026-10-28, decisión del dueño: "no veo por qué nosotros
 * agregamos su contraseña; mejor que mande un correo con la invitación y que
 * ahí genere su contraseña"). La cuenta nace con el rol y un hash al azar que
 * nadie conoce (así el enlace firmado tiene huella y el login no puede entrar
 * con nada), en estado INVITADO; el correo trae el enlace de "crear
 * contraseña", que vale una semana y una sola vez. Al crearla pasa a activa.
 */
const INVITACION_DIAS = 7;
const INVITACION_MINUTOS = INVITACION_DIAS * 24 * 60;
/** El enlace para cambiar contraseña que manda Dirección desde aquí: un día. */
const ENLACE_CONTRASENA_MINUTOS = 24 * 60;

/** Sin ADMIN_URL no hay a dónde apuntar el enlace del correo (ver admin-auth.ts, "olvidé"). */
function baseDelPanel(): string {
  const base = (process.env.ADMIN_URL ?? '').trim().replace(/\/$/, '');
  if (!base) throw new ServiceUnavailableException('Falta ADMIN_URL en las variables de la API: sin ella no se puede armar el enlace del correo.');
  return base;
}

/**
 * Quién puede entrar al panel.
 *
 * El login de admin valida `admins.password` con bcrypt (ver `admin-auth.ts` y
 * `common/app-auth.ts`): la fila en `admins` es la cuenta completa — id, nombre,
 * rol, `status` y el hash. Ya no hay un segundo registro en otro servicio.
 *
 * Historia, por si alguien ve `auth_id` y se pregunta: entre 2026-07 y 2026-09 el
 * acceso vivía en Supabase Auth y esta columna enlazaba con `auth.users`. Al volver
 * a MySQL se importaron esos hashes a `password` (migrate/43-importar-hashes.mjs) y
 * `auth_id` quedó solo como rastro.
 */
const ROLES_VALIDOS = Object.keys(ROLES_ADMIN) as [RolAdmin, ...RolAdmin[]];

/**
 * CUENTA PRINCIPAL (2026-10-08, pedido del dueño).
 *
 * Puede haber varias cuentas de Dirección, pero una es la del dueño. Esa es
 * la única que da o quita Dirección General y la única que toca a las otras
 * cuentas de Dirección; a ella nadie más la desactiva, le cambia el rol o la
 * contraseña. Sin esto, cualquier Dirección podía dejar fuera al dueño.
 *
 * Vive en `platform_settings` (id de la cuenta) y se puede transferir. Hasta
 * que alguien la transfiera, es la del correo de abajo: con el dominio nuevo
 * (oct-2026) o, si la cuenta aún no se cambia de correo, con el anterior.
 */
const AJUSTE_PRINCIPAL = 'admin_principal_id';
const PRINCIPAL_INICIAL = ['ventas@maqser24.com', 'ventas@maqserv24.com'];

async function principalId(): Promise<number | null> {
  const v = Number(await leerAjuste<unknown>(AJUSTE_PRINCIPAL, null));
  if (Number.isInteger(v) && v > 0 && (await prisma.admins.findUnique({ where: { id: v }, select: { id: true } }))) return v;
  /**
   * Sin principal guardada (auditoría 2026-10-28): antes, si no existía el
   * correo de arriba, `null` APAGABA todos los candados y cualquier Dirección
   * podía darse lo que quisiera. Ahora se elige y SE GUARDA: el correo del
   * dueño si existe; si no, la cuenta de Dirección activa más antigua.
   */
  const a =
    (await prisma.admins.findFirst({ where: { email: { in: PRINCIPAL_INICIAL } }, orderBy: { id: 'asc' }, select: { id: true } })) ??
    (await prisma.admins.findFirst({ where: { role: 'direccion', status: 1, password: { not: '' } }, orderBy: { id: 'asc' }, select: { id: true } }));
  if (!a) return null;
  await guardarAjuste(AJUSTE_PRINCIPAL, a.id, 'sistema').catch(() => undefined);
  return a.id;
}

const SOLO_PRINCIPAL = 'Solo la cuenta principal puede dar o quitar Dirección General y modificar otras cuentas de Dirección';

/**
 * Acciones que se anotaron con una clave de código ("tabulador.guardar"). En la
 * bitácora se leen así, y así se encuentran: buscar "tarifas" trae también las
 * filas guardadas como `tabulador.*`. Las que ya se anotan en palabras
 * ("cambio de rol") pasan tal cual.
 */
const ACCIONES: Record<string, string> = {
  'tabulador.guardar': 'guardar tarifas',
  'tabulador.restaurar': 'restaurar tarifas de fábrica',
  'permisos.cambiar': 'cambio de permisos',
  'permisos.restablecer': 'restablecer permisos',
  'crm.maquina.alta': 'alta de máquina (costos)',
  'crm.maquina.edicion': 'edición de máquina (costos)',
  'crm.maquina.baja': 'baja de máquina (costos)',
  'cotizacion.estado': 'cambio de estado de cotización',
  'cotizacion.enviar': 'envío de cotización',
  'cotizacion.eliminar': 'eliminar cotización',
  'contrasena.restablecer': 'restablecer contraseña (por correo)',
  'contrasena.crear': 'creó su contraseña (aceptó la invitación)',
  'tabulador.ficha': 'precio de una ficha en el cotizador',
  'margen.cambiar': 'cambio del margen sobre el costo del aliado',
  'aliado.acceso': 'enlace de acceso de un aliado',
  'aliado.revocar': 'revocar enlaces de un aliado',
  'reglas.dinero': 'reglas de cobro y pago',
};

const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

@Modulo('admins')
@Controller('admin/admins')
@UseGuards(AdminGuard)
export class AdminAdminsController {
  constructor(private readonly mailer: MailerService) {}

  /** El correo de invitación, con su enlace de crear contraseña. */
  private async mandarInvitacion(req: AdminRequest, a: { id: number; name: string; email: string; role: string; password: string }): Promise<void> {
    const base = baseDelPanel();
    const token = await firmarRestablecimientoAdmin(a.id, a.password, INVITACION_MINUTOS);
    const correo = correoInvitacionPanel({
      nombre: a.name,
      invitadoPor: req.adminNombre || req.adminEmail,
      rolNombre: ROLES_ADMIN[rolDeAdmin(a.role)].nombre,
      url: `${base}/restablecer?token=${token}&nuevo=1`,
      dias: INVITACION_DIAS,
    });
    await this.mailer.enviar({ kind: 'admin_invitacion', to: a.email, toName: a.name, ...correo });
  }

  @Get()
  async list(@Req() req: AdminRequest) {
    // Sin la cuenta interna del acceso directo a los cotizadores (2026-10-29): no es una persona del equipo.
    const [rows, pid] = await Promise.all([prisma.admins.findMany({ where: { email: { not: CUENTA_ACCESO_DIRECTO } }, orderBy: { id: 'asc' } }), principalId()]);
    return rows.map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      role: a.role,
      rol: rolDeAdmin(a.role),
      rolNombre: ROLES_ADMIN[rolDeAdmin(a.role)].nombre,
      status: a.status,
      /** Sin hash de contraseña no hay forma de entrar por más activo que se vea. */
      canLogin: !!a.password,
      /** Le llegó la invitación y todavía no crea su contraseña. */
      invitado: a.status === ADMIN_INVITADO,
      isMe: a.id === req.adminId,
      principal: a.id === pid,
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
  /*
   * Por páginas (2026-10-15): antes eran las últimas 60 filas y nada más; lo de
   * la semana pasada ya no se podía consultar. `antes` es el id de la última
   * fila que ya se ve ("Ver más" pide las anteriores) y `q` busca palabra por
   * palabra en quién, acción, objetivo, detalle, rol y módulo: "laura rol"
   * encuentra el cambio de rol de Laura aunque las dos palabras estén en
   * columnas distintas. La comparación la hace MySQL con su collation, que no
   * distingue mayúsculas ni acentos.
   */
  @Get('bitacora')
  async bitacora(@Query('q') q?: string, @Query('antes') antes?: string, @Query('limite') limite?: string) {
    const tope = Math.min(Math.max(Math.trunc(Number(limite)) || 25, 1), 100);
    const cursor = Math.trunc(Number(antes));
    const palabras = (q ?? '').trim().slice(0, 100).split(/\s+/).filter(Boolean).slice(0, 6);

    const and: Prisma.admin_auditWhereInput[] = palabras.map((p) => {
      const claves = Object.keys(ACCIONES).filter((k) => plano(ACCIONES[k]).includes(plano(p)));
      return {
        OR: [
          { accion: { contains: p } },
          { objetivo: { contains: p } },
          { detalle: { contains: p } },
          { admin_email: { contains: p } },
          { admin_rol: { contains: p } },
          { modulo: { contains: p } },
          ...(claves.length ? [{ accion: { in: claves } }] : []),
        ],
      };
    });
    if (cursor > 0) and.push({ id: { lt: cursor } });

    const filas = await prisma.admin_audit.findMany({
      where: and.length ? { AND: and } : undefined,
      orderBy: { id: 'desc' },
      // Una de más: si llega, hay otra página y se ofrece "Ver más".
      take: tope + 1,
    });
    return {
      filas: filas.slice(0, tope).map((f) => ({
        id: f.id,
        quien: f.admin_email,
        rol: f.admin_rol,
        modulo: f.modulo,
        accion: ACCIONES[f.accion] ?? f.accion,
        objetivo: f.objetivo,
        detalle: f.detalle,
        cuando: f.created_at.toISOString(),
      })),
      hayMas: filas.length > tope,
    };
  }

  /** Invitar a alguien al panel: nombre, correo y rol. La contraseña la crea la persona desde el correo. */
  @Post()
  async create(@Req() req: AdminRequest, @Body() body: unknown) {
    const schema = z.object({
      name: z.string().trim().min(2, 'Escribe su nombre.').max(100),
      email: z.string().trim().email('Escribe un correo válido.').max(190),
      // Sin rol explícito cae en el de MENOS alcance, no en el de más: una
      // cuenta con permisos de sobra no se nota hasta que alguien borra algo.
      rol: z.enum(ROLES_VALIDOS).default(ROL_POR_DEFECTO),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Datos inválidos');
    const email = parsed.data.email.toLowerCase();
    if (parsed.data.rol === 'direccion') {
      const pid = await principalId();
      if (pid !== null && req.adminId !== pid) throw new ForbiddenException(SOLO_PRINCIPAL);
    }
    // Antes de crear nada: sin ADMIN_URL no habría correo que mandar.
    baseDelPanel();

    if (await prisma.admins.findUnique({ where: { email } })) {
      throw new BadRequestException('Ya hay una cuenta del panel con ese correo.');
    }

    const a = await prisma.admins.create({
      data: {
        name: parsed.data.name,
        email,
        phone: '',
        // Un hash al azar que nadie conoce: no se puede entrar con él, pero le da huella al enlace.
        password: await hashPassword(randomBytes(24).toString('base64')),
        role: parsed.data.rol,
        status: ADMIN_INVITADO,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    await this.mandarInvitacion(req, a);

    await registrarAccion(req, 'admins', 'invitar al panel', email, ROLES_ADMIN[parsed.data.rol].nombre);
    return { id: a.id };
  }

  /** Volver a mandar la invitación (el enlace anterior sigue valiendo hasta que caduque o se use). */
  @Post(':id/invitacion')
  async reinvitar(@Req() req: AdminRequest, @Param('id', ParseIntPipe) id: number) {
    const a = await prisma.admins.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Cuenta no encontrada');
    if (a.status !== ADMIN_INVITADO) throw new BadRequestException('Esa cuenta ya creó su contraseña.');
    const pid = await principalId();
    if (pid !== null && req.adminId !== pid && rolDeAdmin(a.role) === 'direccion') throw new ForbiddenException(SOLO_PRINCIPAL);
    await this.mandarInvitacion(req, a);
    await registrarAccion(req, 'admins', 'volver a invitar', a.email);
    return { ok: true };
  }

  /**
   * Mandarle a alguien el enlace para cambiar su contraseña (2026-10-28).
   * Sustituye a escribirle la contraseña desde aquí: nadie más que la persona
   * la conoce. Vale un día y una sola vez.
   */
  @Post(':id/enlace-contrasena')
  async enlaceContrasena(@Req() req: AdminRequest, @Param('id', ParseIntPipe) id: number) {
    const a = await prisma.admins.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Cuenta no encontrada');
    if (a.status === ADMIN_INVITADO) throw new BadRequestException('Todavía no crea su contraseña: vuelve a mandarle la invitación.');
    if (a.status !== 1 || !a.password) throw new BadRequestException('Esa cuenta no está activa.');
    if (id === req.adminId) throw new BadRequestException('Tu contraseña la cambias tú desde tu cuenta.');
    const pid = await principalId();
    if (pid !== null && req.adminId !== pid && (id === pid || rolDeAdmin(a.role) === 'direccion')) throw new ForbiddenException(SOLO_PRINCIPAL);
    const base = baseDelPanel();
    const token = await firmarRestablecimientoAdmin(a.id, a.password, ENLACE_CONTRASENA_MINUTOS);
    const correo = correoRestablecerContrasena({
      nombre: a.name, url: `${base}/restablecer?token=${token}`, minutos: ENLACE_CONTRASENA_MINUTOS, desdeElPanel: req.adminNombre || req.adminEmail,
    });
    await this.mailer.enviar({ kind: 'admin_password_reset', to: a.email, toName: a.name, ...correo });
    await registrarAccion(req, 'admins', 'enlace de contraseña', a.email);
    return { ok: true };
  }

  /**
   * ELIMINAR una cuenta del panel (2026-09-23).
   *
   * Pedido del cliente: las cuentas del sistema viejo no solo se desactivan,
   * desaparecen de la lista. Dos candados, además del de "no a ti mismo":
   *
   *  1. Solo se elimina una cuenta DESACTIVADA. Borrar es un paso más allá de
   *     desactivar, y obligar a pasar por el primero evita que un clic quite
   *     el acceso a alguien que sí lo usaba: desactivada, se nota; borrada, ya
   *     no hay a quién reactivar.
   *  2. Queda en la bitácora quién borró qué. El registro de la cuenta se va;
   *     el rastro de la acción, no.
   */
  @Delete(':id')
  async remove(@Req() req: AdminRequest, @Param('id', ParseIntPipe) id: number) {
    if (id === req.adminId) throw new BadRequestException('No puedes eliminar tu propia cuenta');
    const a = await prisma.admins.findUnique({ where: { id }, select: { email: true, status: true, role: true } });
    if (!a) throw new NotFoundException('Administrador no encontrado');
    const pid = await principalId();
    if (id === pid) throw new ForbiddenException('La cuenta principal no se elimina. Transfiérela primero a otra cuenta de Dirección.');
    if (pid !== null && req.adminId !== pid && rolDeAdmin(a.role) === 'direccion') throw new ForbiddenException(SOLO_PRINCIPAL);
    if (a.status === 1) {
      throw new BadRequestException('Desactívala primero. Solo se eliminan cuentas desactivadas.');
    }
    await prisma.admins.delete({ where: { id } });
    forgetAdmin(id);
    await registrarAccion(req, 'admins', 'eliminar cuenta', a.email);
    return { ok: true };
  }

  @Patch(':id')
  async update(@Req() req: AdminRequest, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    // Sin `password` (auditoría 2026-10-28): nadie escribe la contraseña de otro.
    // A otra cuenta se le manda un enlace (enlace-contrasena); la propia, en Mi cuenta.
    const schema = z.object({
      name: z.string().min(2).max(100).optional(),
      status: z.coerce.number().int().min(0).max(1).optional(),
      rol: z.enum(ROLES_VALIDOS).optional(),
    }).strict();
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');

    const a = await prisma.admins.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Administrador no encontrado');
    const pid = await principalId();
    if (pid !== null && req.adminId !== pid) {
      if (id === pid) throw new ForbiddenException('La cuenta principal solo la modifica su titular');
      if (rolDeAdmin(a.role) === 'direccion' || parsed.data.rol === 'direccion') throw new ForbiddenException(SOLO_PRINCIPAL);
    }
    // Una invitada no se "activa" a mano: sin contraseña no podría entrar y se vería activa.
    if (parsed.data.status === 1 && a.status === ADMIN_INVITADO) {
      throw new BadRequestException('Todavía no crea su contraseña: vuelve a mandarle la invitación.');
    }
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

    await prisma.admins.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
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
    return { ok: true };
  }

  /**
   * Pasar la cuenta principal a otra cuenta de Dirección. Solo la hace la
   * principal actual, y la nueva tiene que poder entrar: si no, el panel se
   * quedaría con una principal que nadie puede usar.
   */
  @Post(':id/principal')
  async hacerPrincipal(@Req() req: AdminRequest, @Param('id', ParseIntPipe) id: number) {
    const pid = await principalId();
    if (pid !== null && req.adminId !== pid) throw new ForbiddenException('Solo la cuenta principal puede transferirla');
    const a = await prisma.admins.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Administrador no encontrado');
    if (rolDeAdmin(a.role) !== 'direccion') throw new BadRequestException('La cuenta principal tiene que ser de Dirección General');
    if (a.status !== 1 || !a.password) throw new BadRequestException('Esa cuenta no está activa o no puede entrar');
    await guardarAjuste(AJUSTE_PRINCIPAL, id, req.adminEmail);
    await registrarAccion(req, 'admins', 'transferir cuenta principal', a.email);
    return { ok: true };
  }
}
