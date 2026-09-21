import { redirect } from 'next/navigation';
import Link from 'next/link';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { D, FONT } from '@/components/design-tokens';
import { PermisosMatrix, type ModuloFila, type RolFila } from './PermisosMatrix';

export const dynamic = 'force-dynamic';

/**
 * Quién ve qué parte del panel.
 *
 * Vive bajo Administradores porque es la misma llave: repartir permisos y crear
 * cuentas son la misma decisión tomada dos veces. El módulo `admins` lo tiene
 * sólo Dirección.
 */
export default async function PermisosPage() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'admins');

  const data = await adminFetch<{ modulos: ModuloFila[]; roles: RolFila[] }>('/admin/roles');

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <div style={{ fontFamily: FONT, color: D.text }}>
        <header style={{ marginBottom: 18 }}>
          <h1 className="adm-page-title">Permisos</h1>
          <p className="adm-page-sub">
            Lo que un rol no puede hacer, no le aparece en el menú — y la API tampoco se lo sirve.
            Los cambios se aplican en la siguiente pantalla que abra cada persona.
          </p>
        </header>

        {data ? (
          <PermisosMatrix modulos={data.modulos} roles={data.roles} />
        ) : (
          <p style={{ color: '#8A8A8F', fontSize: 14 }}>
            No se pudo leer el reparto de permisos. Si acaba de desplegarse, falta correr{' '}
            <code style={{ color: D.text }}>sql/admin_role_modules.sql</code> en esta base.
          </p>
        )}

        <p style={{ marginTop: 18, fontSize: 12.5, color: '#7A7A7F', lineHeight: 1.6 }}>
          Cada cambio queda en la bitácora con quién lo hizo y cómo estaba antes; se ve en{' '}
          <Link href="/admins" style={{ color: D.accent }}>Administradores</Link>.
        </p>
      </div>
    </AdminShell>
  );
}
