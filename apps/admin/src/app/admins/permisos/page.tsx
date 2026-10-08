import { redirect } from 'next/navigation';
import Link from 'next/link';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { Note, PageHeader } from '@/components/ui';
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
      <div>
        <PageHeader
          eyebrow={['Ajustes', ['Administradores', '/admins']]}
          title="Permisos"
          subtitle="Lo que un rol no puede hacer, no le aparece en el menú — y la API tampoco se lo sirve. Los cambios se aplican en la siguiente pantalla que abra cada persona."
        />

        {data ? (
          <PermisosMatrix modulos={data.modulos} roles={data.roles} />
        ) : (
          <Note tone="bad">
            No se pudo leer el reparto de permisos. Si acaba de desplegarse, falta correr{' '}
            <code className="adm-mono" style={{ color: 'var(--adm-text)' }}>sql/admin_role_modules.sql</code> en esta base.
          </Note>
        )}

        <p style={{ marginTop: 18, fontSize: 12.5, color: 'var(--adm-muted)', lineHeight: 1.6 }}>
          Cada cambio queda en la bitácora con quién lo hizo y cómo estaba antes; se ve en{' '}
          <Link href="/admins" style={{ color: 'var(--adm-accent)', textDecoration: 'none' }}>Administradores</Link>.
        </p>
      </div>
    </AdminShell>
  );
}
