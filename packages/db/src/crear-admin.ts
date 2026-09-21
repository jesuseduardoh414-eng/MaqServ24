/**
 * ALTA O REINICIO DE CONTRASEÑA DE UN ADMINISTRADOR (línea de comandos).
 *
 * Existe por el huevo y la gallina: las cuentas del panel se administran DESDE
 * el panel (Administradores), y para entrar al panel hace falta una cuenta. Y
 * las contraseñas se guardan con bcrypt, así que una contraseña perdida NO se
 * recupera — se pone otra.
 *
 * Uso:
 *   pnpm --filter @maqserv/db build
 *   node packages/db/dist/crear-admin.js <correo> <contraseña> [nombre] [rol]
 *
 * Roles (packages/config/src/admin-roles.ts):
 *   direccion | operaciones | red | comercial | marca
 * Por defecto `direccion`, que es el único que administra cuentas y permisos:
 * desde ahí ya se crean los demás con el módulo Administradores.
 *
 * Si el correo ya existe, NO duplica: le cambia la contraseña y lo reactiva.
 *
 * OJO: escribe en la base a la que apunte DATABASE_URL. Comprueba a cuál antes
 * de correrlo — la misma orden sirve para la de tu máquina y para producción.
 */
import bcrypt from 'bcryptjs';
import { ROLES_ADMIN, type RolAdmin } from '@maqserv/config';
import { prisma } from './index';

/** Mismo coste que `hashPassword` en la API (apps/api/src/common/app-auth.ts). */
const COSTE = 10;
const MINIMO = 8;

async function main() {
  const [correo, clave, nombre = 'Administrador', rol = 'direccion'] = process.argv.slice(2);

  if (!correo || !clave) {
    console.error('Uso: node packages/db/dist/crear-admin.js <correo> <contraseña> [nombre] [rol]');
    console.error(`Roles: ${Object.keys(ROLES_ADMIN).join(' | ')}`);
    process.exit(1);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
    console.error(`"${correo}" no parece un correo.`);
    process.exit(1);
  }
  if (clave.length < MINIMO) {
    console.error(`La contraseña necesita al menos ${MINIMO} caracteres.`);
    process.exit(1);
  }
  if (!(rol in ROLES_ADMIN)) {
    console.error(`Rol desconocido "${rol}". Usa uno de: ${Object.keys(ROLES_ADMIN).join(' | ')}`);
    process.exit(1);
  }

  const password = await bcrypt.hash(clave, COSTE);
  const existente = await prisma.admins.findUnique({ where: { email: correo } });

  if (existente) {
    await prisma.admins.update({
      where: { email: correo },
      data: { password, status: 1, updated_at: new Date() },
    });
    console.log(`Contraseña cambiada y cuenta activa: ${correo} (rol en BD: ${existente.role}).`);
    console.log('Las sesiones abiertas de esa cuenta dejan de servir: el refresh lleva una huella del hash.');
  } else {
    const creado = await prisma.admins.create({
      data: {
        name: nombre,
        email: correo,
        phone: '',
        role: rol as RolAdmin,
        password,
        status: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    console.log(`Administrador creado: ${creado.email} · ${ROLES_ADMIN[rol as RolAdmin].nombre} (id ${creado.id}).`);
  }
  console.log('Entra en /login del panel con ese correo y la contraseña que acabas de pasar.');
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
