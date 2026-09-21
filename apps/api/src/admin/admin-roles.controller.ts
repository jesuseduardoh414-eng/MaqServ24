import { BadRequestException, Body, Controller, Delete, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import {
  MODULOS_ADMIN, MODULOS_META, MODULOS_OBLIGATORIOS, ROLES_ADMIN,
  esRolFijo, modulosEfectivos, type RolAdmin,
} from '@maqserv/config';
import { AdminGuard, Modulo, type AdminRequest } from './admin-auth';
import { guardarPermisos, permisosVigentes, restablecerPermisos } from './permisos';
import { registrarAccion } from './audit';

/**
 * Quién ve qué (Administradores → Permisos).
 *
 * Va bajo el módulo `admins`, que sólo tiene Dirección: repartir permisos es la
 * llave del panel entero y no se delega. Cada cambio queda en la bitácora con
 * la lista anterior, porque "¿quién le quitó el acceso a Operaciones?" es una
 * pregunta que se hace tarde y con prisa.
 */
const cuerpo = z.object({ modulos: z.array(z.string()).max(MODULOS_ADMIN.length) });

function rolValido(rol: string): RolAdmin {
  if (!(rol in ROLES_ADMIN)) throw new BadRequestException('Rol desconocido');
  return rol as RolAdmin;
}

@Controller('admin/roles')
@Modulo('admins')
@UseGuards(AdminGuard)
export class AdminRolesController {
  /** La matriz completa, tal como se pinta: módulos, roles y qué tiene cada uno. */
  @Get()
  async listar() {
    const overrides = await permisosVigentes();
    return {
      modulos: MODULOS_ADMIN.map((clave) => ({
        clave,
        ...MODULOS_META[clave],
        obligatorio: MODULOS_OBLIGATORIOS.includes(clave),
      })),
      roles: Object.values(ROLES_ADMIN).map((def) => ({
        clave: def.clave,
        nombre: def.nombre,
        descripcion: def.descripcion,
        modulos: modulosEfectivos(def.clave, overrides),
        // `fijo` = Dirección: la pantalla lo muestra en gris y sin casillas.
        fijo: esRolFijo(def.clave),
        // Para poder ofrecer "volver a los de fábrica" sólo donde tiene sentido.
        personalizado: Boolean(overrides[def.clave]),
      })),
    };
  }

  @Put(':rol')
  async guardar(@Param('rol') rolParam: string, @Body() body: unknown, @Req() req: AdminRequest) {
    const rol = rolValido(rolParam);
    if (esRolFijo(rol)) {
      throw new BadRequestException('Dirección General ve todo el panel: ese rol no se restringe');
    }
    const parsed = cuerpo.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Datos inválidos');

    const antes = modulosEfectivos(rol, await permisosVigentes());
    const despues = await guardarPermisos(rol, parsed.data.modulos, req.adminId);
    await registrarAccion(
      req, 'admins', 'permisos.cambiar', ROLES_ADMIN[rol].nombre,
      `antes: ${antes.join(', ') || '—'} · ahora: ${despues.join(', ')}`,
    );
    return { rol, modulos: despues };
  }

  /** Vuelve el rol a la lista que trae el código. */
  @Delete(':rol')
  async restablecer(@Param('rol') rolParam: string, @Req() req: AdminRequest) {
    const rol = rolValido(rolParam);
    if (esRolFijo(rol)) throw new BadRequestException('Ese rol no tiene nada que restablecer');
    await restablecerPermisos(rol);
    const modulos = modulosEfectivos(rol, await permisosVigentes());
    await registrarAccion(req, 'admins', 'permisos.restablecer', ROLES_ADMIN[rol].nombre, modulos.join(', '));
    return { rol, modulos };
  }
}
