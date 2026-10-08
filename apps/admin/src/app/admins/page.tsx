import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { Chip, EmptyState, Note, PageHeader, Panel, Stat, Stats, StatusText, type Tone } from '@/components/ui';
import type { RolAdmin } from '@maqserv/config';
import { AdminCreate } from './AdminCreate';
import { AdminRowActions } from './AdminRowActions';

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
  isMe: boolean;
  /** La cuenta del dueño: la única que da o quita Dirección General. */
  principal: boolean;
  createdAt: string | null;
}

interface Bitacora {
  id: number;
  quien: string;
  rol: string;
  modulo: string;
  accion: string;
  objetivo: string | null;
  detalle: string | null;
  cuando: string;
}

const GRID = 'minmax(0,1.5fr) minmax(0,1.6fr) 130px minmax(0,2fr)';

/** Quién puede entrar al panel y hasta dónde llega cada quien. */
export default async function AdminAdmins() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  exigirModulo(admin, 'admins');
  const [admins, bitacora] = await Promise.all([
    adminFetch<AdminRow[]>('/admin/admins').then((r) => r ?? []),
    adminFetch<Bitacora[]>('/admin/admins/bitacora').then((r) => r ?? []),
  ]);

  const activos = admins.filter((a) => a.status === 1).length;
  const rotos = admins.filter((a) => !a.canLogin);
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
            .am-row > .am-c-actions { grid-column: 1 / -1; }
          }
          @media (max-width: 560px) {
            .am-row { grid-template-columns: minmax(0,1fr); }
          }
          .am-log { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 14px; }
        `}</style>

        <PageHeader
          eyebrow={['Ajustes', 'Configuración']}
          title="Administradores"
          count={admins.length}
          subtitle="Quién puede entrar a este panel y qué parte le toca. El rol decide qué secciones ve: lo que no le toca, ni le aparece en el menú ni lo puede pedir por su cuenta."
          actions={<AdminCreate soyPrincipal={soyPrincipal} />}
        />

        <Stats>
          <Stat label="Con acceso" icon="ph-user-check" tone="ok" value={activos} hint={`de ${admins.length}`} />
        </Stats>

        {/* Cuentas que se ven "Activo" pero no pueden entrar (creadas antes del arreglo). */}
        {rotos.length > 0 ? (
          <Note tone="bad" style={{ marginBottom: 20 }}>
            <strong style={{ color: 'var(--adm-text)', fontWeight: 600 }}>
              {rotos.length} cuenta{rotos.length === 1 ? '' : 's'} sin acceso configurado.
            </strong>{' '}
            Existe{rotos.length === 1 ? '' : 'n'} en la lista pero no puede{rotos.length === 1 ? '' : 'n'} entrar: le{rotos.length === 1 ? '' : 's'} falta la cuenta
            de acceso. Bórrala{rotos.length === 1 ? '' : 's'} y vuelve a crearla{rotos.length === 1 ? '' : 's'} desde aquí.
          </Note>
        ) : null}

        <Panel flush clip>
          <div className="adm-thead am-row am-thead">
            <div>Nombre</div>
            <div>Correo</div>
            <div>Estado</div>
            <div style={{ textAlign: 'right' }}>Acciones</div>
          </div>

          {admins.map((a) => {
            const activo = a.status === 1;
            // "Activo" sin cuenta de acceso es mentira: se dice.
            const tone: Tone = !a.canLogin ? 'bad' : activo ? 'ok' : 'muted';
            const label = !a.canLogin ? 'Sin acceso' : activo ? 'Activo' : 'Inactivo';
            return (
              <div key={a.id} className="adm-trow am-row" style={{ opacity: activo ? 1 : 0.6 }}>
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
                </div>

                <div className="am-c-actions">
                  <AdminRowActions adminId={a.id} name={a.name} status={a.status} isMe={a.isMe} canLogin={a.canLogin} rol={a.rol} principal={a.principal} soyPrincipal={soyPrincipal} />
                </div>
              </div>
            );
          })}
        </Panel>

        {/* Sección 30 · Riesgos y controles: quién hizo qué, con fecha. */}
        <Panel
          flush
          clip
          title="Actividad reciente"
          icon="ph-clock-counter-clockwise"
          desc="Las acciones que cambian permisos, dinero o lo que ve el público. No se puede borrar desde el panel."
          style={{ marginTop: 28 }}
        >
          {bitacora.length === 0 ? (
            <EmptyState
              icon="ph-notebook"
              title="Todavía no hay nada anotado"
              sub="Aquí irán apareciendo las altas y bajas de cuentas, los cambios de rol, los métodos de pago, los retiros pagados y las publicaciones de diseño."
            />
          ) : (
            bitacora.map((b) => (
              <div key={b.id} className="adm-trow am-log">
                <span className="adm-mono adm-num" style={{ fontSize: 12, color: 'var(--adm-faint)', whiteSpace: 'nowrap' }}>
                  {new Date(b.cuando).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--adm-text)' }}>{b.accion}</span>
                {b.objetivo ? <span style={{ fontSize: 13.5, color: 'var(--adm-text-2)' }}>{b.objetivo}</span> : null}
                <span style={{ fontSize: 12.5, color: 'var(--adm-muted)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                  {b.quien} · {b.rol}
                </span>
              </div>
            ))
          )}
        </Panel>

        <p style={{ margin: '16px 0 0', fontSize: 12.5, color: 'var(--adm-muted)', lineHeight: 1.6, maxWidth: '80ch' }}>
          Desactivar corta el acceso de inmediato, incluso si la persona tiene la sesión abierta. No puedes desactivar tu propia cuenta ni cambiarte el rol a ti mismo: esta pantalla solo la ve Dirección, y quien se la quita no tiene cómo devolvérsela. La cuenta principal es la del dueño: solo ella da o quita Dirección General y modifica a las otras cuentas de Dirección, y nadie más puede tocarla. Se puede transferir a otra cuenta de Dirección.
        </p>
      </div>
    </AdminShell>
  );
}
