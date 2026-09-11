import { Logger } from '@nestjs/common';
import { prisma } from '@maqserv/db';
import { ROLES_ADMIN, type ModuloAdmin } from '@maqserv/config';
import type { AdminRequest } from './admin-auth';

/**
 * BITÁCORA DE ACCIONES SENSIBLES (documento institucional, sección 30 ·
 * Riesgos y controles: "controles de acceso").
 *
 * El tercer criterio del requisito de permisos: "las acciones sensibles quedan
 * registradas con quién las hizo". Sin esto, repartir permisos sirve para
 * impedir, pero no para explicar: cuando aparece un precio cambiado o un retiro
 * pagado, nadie puede decir quién fue ni cuándo.
 *
 * TRES DECISIONES:
 *
 * 1. NUNCA tumba la operación. Si la bitácora falla, la acción ya ocurrió y
 *    detenerla ahí sería peor: se anota el fallo en el log del servidor y la
 *    respuesta sigue su camino. Mismo criterio que el registro de correo.
 *
 * 2. Se guarda el CORREO además del id. Un administrador puede borrarse o
 *    cambiar de nombre; la bitácora tiene que seguir diciendo quién fue dentro
 *    de un año, sin depender de una fila que quizá ya no exista.
 *
 * 3. Sólo lo sensible: permisos, dinero, publicación y borrados. Anotar cada
 *    lectura llenaría la tabla de ruido y escondería justo lo que importa.
 */
const log = new Logger('AdminAudit');

export async function registrarAccion(
  req: AdminRequest,
  modulo: ModuloAdmin,
  accion: string,
  objetivo?: string | null,
  detalle?: string | null,
): Promise<void> {
  try {
    await prisma.admin_audit.create({
      data: {
        admin_id: req.adminId,
        admin_email: (req.adminEmail ?? '').slice(0, 190),
        admin_rol: ROLES_ADMIN[req.adminRol]?.nombre?.slice(0, 40) ?? req.adminRol,
        modulo,
        accion: accion.slice(0, 60),
        objetivo: objetivo?.slice(0, 190) ?? null,
        detalle: detalle ?? null,
      },
    });
  } catch (e) {
    log.error(`No se pudo registrar "${accion}": ${e instanceof Error ? e.message : e}`);
  }
}
