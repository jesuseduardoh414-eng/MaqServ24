/**
 * ¿A QUÉ BASE ESTOY APUNTANDO Y QUÉ CUENTAS DE PANEL HAY? (solo lectura)
 *
 * Se escribió como paso previo a `crear-admin.ts`: la misma orden sirve para la
 * base de tu máquina y para la de producción, y crear cuentas con permisos en
 * la equivocada no tiene deshacer cómodo. Imprime el servidor y el nombre de la
 * base —nunca usuario ni contraseña— y las cuentas que ya existen.
 *
 * Uso:
 *   pnpm --filter @maqserv/db build
 *   node packages/db/dist/admins-listar.js
 */
import { ROLES_ADMIN, rolDeAdmin } from '@maqserv/config';
import { prisma } from './index';

async function main() {
  const [info] = await prisma.$queryRawUnsafe<Array<{ base: string; servidor: string }>>(
    'SELECT DATABASE() AS base, @@hostname AS servidor',
  );
  console.log(`Base de datos: ${info?.base ?? '?'} · servidor: ${info?.servidor ?? '?'}`);

  const admins = await prisma.admins.findMany({
    select: { id: true, name: true, email: true, role: true, status: true },
    orderBy: { id: 'asc' },
  });
  console.log(`Cuentas de panel: ${admins.length}`);
  for (const a of admins) {
    const rol = rolDeAdmin(a.role);
    console.log(
      `  #${a.id} ${a.email} · ${ROLES_ADMIN[rol].nombre} (columna: "${a.role}") · ${a.status === 1 ? 'activa' : 'DESACTIVADA'}`,
    );
  }
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
