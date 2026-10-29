import { redirect } from 'next/navigation';
import Link from 'next/link';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { Chip, Note, PageHeader, Panel, Segmented, Stat, Stats, StatusText, type Tone } from '@/components/ui';
import type { RolAdmin } from '@maqserv/config';
import { AdminCreate } from './AdminCreate';
import { AdminRowActions } from './AdminRowActions';
import { BITACORA_POR_PAGINA, Bitacora, type FilaBitacora } from './Bitacora';
import { PermisosMatrix, type ModuloFila, type RolFila } from './permisos/PermisosMatrix';

interface AdminRow {
  id: number;
  name: string;
  email: string;
  role: string;
  rol: RolAdmin;
  rolNombre: string;
  status: number;
  /** Sin contraseña guardada no puede entrar, por más "Activo" que se vea. */
  canLogin: boolean;
  /** Le llegó la invitación y todavía no crea su contraseña (2026-10-28). */
  invitado?: boolean;
  isMe: boolean;
  /** La cuenta del dueño: la única que da o quita Dirección General. */
  principal: boolean;
  createdAt: string | null;
}

const GRID = 'minmax(0,1.5fr) minmax(0,1.6fr) 150px minmax(0,1.6fr)';

const enlace: React.CSSProperties = { color: 'var(--adm-accent)', textDecoration: 'none' };

/**
 * EQUIPO DEL PANEL (2026-10-28, revisión con el dueño). Quién entra a este
 * panel y qué parte le toca; en una pestaña, los permisos de cada rol. Los
 * clientes y los aliados no se dan de alta aquí, y la pantalla lo dice: fue
 * la duda del dueño ("¿ahí se agregan todos los usuarios?").
 */
export default async function AdminAdmins({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'admins');
  const sp = await searchParams;
  const pestana: 'equipo' | 'permisos' = sp.p === 'permisos' ? 'permisos' : 'equipo';

  const [admins, bitacora, reparto] = await Promise.all([
    adminFetch<AdminRow[]>('/admin/admins').then((r) => r ?? []),
    // La API anterior devolvía la lista sola (sin `hayMas`): si el panel se
    // despliega antes que la API, se sigue viendo, solo que sin "Ver más".
    adminFetch<{ filas: FilaBitacora[]; hayMas: boolean } | FilaBitacora[]>(`/admin/admins/bitacora?limite=${BITACORA_POR_PAGINA}`).then(
      (r) => (Array.isArray(r) ? { filas: r, hayMas: false } : r ?? { filas: [], hayMas: false }),
    ),
    // Lo que cada rol ve hoy: la pestaña Permisos lo edita; la invitación lo enseña al elegir rol.
    adminFetch<{ modulos: ModuloFila[]; roles: RolFila[] }>('/admin/roles'),
  ]);
  const permisos = Object.fromEntries((reparto?.roles ?? []).map((r) => [r.clave, r.modulos]));

  const activos = admins.filter((a) => a.status === 1).length;
  const invitados = admins.filter((a) => a.invitado).length;
  const rotos = admins.filter((a) => !a.canLogin && !a.invitado);
  // Sin cuenta principal registrada (no existe el correo inicial), nadie queda restringido.
  const soyPrincipal = admins.some((a) => a.isMe && a.principal) || !admins.some((a) => a.principal);

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol} adminModulos={admin.modulos}>
      <div>
        <style>{`
          .am-row { display: grid; grid-template-columns: ${GRID}; gap: 16px; align-items: center; }
          /* En tablet/móvil: nombre y correo arriba, estado y acciones debajo. */
          @media (max-width: 900px) {
            .am-thead { display: none !important; }
            .am-row { grid-template-columns: minmax(0,1fr) minmax(0,1fr); row-gap: 10px; }
          }
          @media (max-width: 560px) {
            .am-row { grid-template-columns: minmax(0,1fr); }
          }
          .am-menu-item { display: flex; align-items: center; gap: 9px; width: 100%; padding: 8px 10px; border: 0; border-radius: 8px; background: transparent; color: var(--adm-text); font: inherit; font-size: 13.5px; text-align: left; cursor: pointer; white-space: nowrap; }
          .am-menu-item i { font-size: 16px; color: var(--adm-muted); }
          .am-menu-item:hover { background: var(--adm-hover, rgba(var(--adm-ink),0.05)); }
          .am-menu-item[data-peligro] { color: var(--adm-bad); }
          .am-menu-item[data-peligro] i { color: var(--adm-bad); }
          .am-menu-item:disabled { opacity: .5; cursor: default; }
          .am-log { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 14px; }
          .am-log-bar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px 16px; padding: 12px 20px; border-bottom: 1px solid var(--adm-border); }
          .am-log-hint { font-size: 12.5px; color: var(--adm-faint); }
          .am-log-detalle { font-size: 12.5px; color: var(--adm-muted); max-width: 46ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          @media (max-width: 760px) { .am-log-bar { padding: 12px 16px; } }
        `}</style>

        <PageHeader
          eyebrow={['Ajustes', 'Configuración']}
          title="Equipo del panel"
          count={pestana === 'equipo' ? admins.length : undefined}
          subtitle={
            <>
              Quién entra a este panel y qué parte le toca. Los clientes y los aliados no se dan de alta aquí: los clientes se registran solos en el sitio
              (<Link href="/usuarios" style={enlace}>Cuentas del sitio</Link>) y a los aliados se les manda su acceso desde su expediente en{' '}
              <Link href="/proveedores" style={enlace}>Proveedores</Link>.
            </>
          }
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Segmented<'equipo' | 'permisos'>
                ariaLabel="Qué ver"
                value={pestana}
                items={[
                  { key: 'equipo', label: 'Equipo', href: '/admins' },
                  { key: 'permisos', label: 'Permisos', href: '/admins?p=permisos' },
                ]}
              />
              {pestana === 'equipo' ? <AdminCreate soyPrincipal={soyPrincipal} permisos={permisos} /> : null}
            </div>
          }
        />

        {pestana === 'permisos' ? (
          <>
            <p className="adm-help" style={{ margin: '0 0 16px', maxWidth: '80ch' }}>
              Lo que un rol no puede hacer, no le aparece en el menú y la API tampoco se lo sirve. Los cambios aplican en la siguiente pantalla que abra cada persona, y quedan en la actividad de abajo de Equipo.
            </p>
            {reparto ? (
              <PermisosMatrix modulos={reparto.modulos} roles={reparto.roles} />
            ) : (
              <Note tone="bad">
                No se pudo leer el reparto de permisos. Si acaba de desplegarse, falta correr{' '}
                <code className="adm-mono" style={{ color: 'var(--adm-text)' }}>sql/admin_role_modules.sql</code> en esta base.
              </Note>
            )}
          </>
        ) : (
          <>
            <Stats>
              <Stat label="Con acceso" icon="ph-user-check" tone="ok" value={activos} hint={`de ${admins.length}`} />
              {invitados > 0 ? <Stat label="Invitados" icon="ph-paper-plane-tilt" tone="warn" value={invitados} hint="sin crear su contraseña" /> : null}
            </Stats>

            {/* Cuentas que se ven "Activo" pero no pueden entrar (creadas antes del arreglo). */}
            {rotos.length > 0 ? (
              <Note tone="bad" style={{ marginBottom: 20 }}>
                <strong style={{ color: 'var(--adm-text)', fontWeight: 600 }}>
                  {rotos.length} cuenta{rotos.length === 1 ? '' : 's'} sin acceso configurado.
                </strong>{' '}
                Existe{rotos.length === 1 ? '' : 'n'} en la lista pero no puede{rotos.length === 1 ? '' : 'n'} entrar: le{rotos.length === 1 ? '' : 's'} falta la cuenta
                de acceso. Bórrala{rotos.length === 1 ? '' : 's'} y vuelve a invitarla{rotos.length === 1 ? '' : 's'} desde aquí.
              </Note>
            ) : null}

            <Panel flush clip>
              <div className="adm-thead am-row am-thead">
                <div>Nombre</div>
                <div>Correo</div>
                <div>Estado</div>
                <div style={{ textAlign: 'right' }}>Rol y acciones</div>
              </div>

              {admins.map((a) => {
                const activo = a.status === 1;
                const invitado = Boolean(a.invitado);
                // "Activo" sin cuenta de acceso es mentira: se dice. Invitado: le falta crear su contraseña.
                const tone: Tone = invitado ? 'warn' : !a.canLogin ? 'bad' : activo ? 'ok' : 'muted';
                const label = invitado ? 'Invitado' : !a.canLogin ? 'Sin acceso' : activo ? 'Activo' : 'Inactivo';
                return (
                  <div key={a.id} className="adm-trow am-row" style={{ opacity: activo || invitado ? 1 : 0.6 }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="adm-cell-title adm-ellipsis">
                        {a.name}
                        {a.isMe ? <span style={{ color: 'var(--adm-accent)', fontWeight: 500, fontSize: 12.5 }}> · tú</span> : null}
                      </div>
                      <div className="adm-meta">
                        <span>{a.rolNombre}</span>
                        {a.principal ? (
                          <Chip tone="accent">
                            <i className="ph ph-crown-simple" aria-hidden />Principal
                          </Chip>
                        ) : null}
                      </div>
                    </div>

                    <div className="adm-ellipsis" style={{ fontSize: 13.5, color: 'var(--adm-text-2)' }}>{a.email}</div>

                    <div>
                      <StatusText tone={tone}>{label}</StatusText>
                      {invitado ? <div className="adm-meta" style={{ marginTop: 2 }}>Falta que cree su contraseña</div> : null}
                    </div>

                    <div className="am-c-actions">
                      <AdminRowActions adminId={a.id} name={a.name} status={a.status} isMe={a.isMe} canLogin={a.canLogin} invitado={invitado} rol={a.rol} principal={a.principal} soyPrincipal={soyPrincipal} />
                    </div>
                  </div>
                );
              })}
            </Panel>

            {/* Sección 30 · Riesgos y controles: quién hizo qué, con fecha. Con buscador y "Ver más". */}
            <Bitacora inicial={bitacora.filas} hayMasInicial={bitacora.hayMas} />

            <p style={{ margin: '16px 0 0', fontSize: 12.5, color: 'var(--adm-muted)', lineHeight: 1.6, maxWidth: '80ch' }}>
              Al invitar, la persona crea su propia contraseña desde el correo; nadie la escribe por ella. Desactivar corta el acceso de inmediato, incluso con la sesión abierta. No puedes desactivar tu propia cuenta ni cambiarte el rol. La cuenta principal es la del dueño: solo ella da o quita Dirección General y modifica a las otras cuentas de Dirección; se puede transferir.
            </p>
          </>
        )}
      </div>
    </AdminShell>
  );
}
