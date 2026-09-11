import { redirect } from 'next/navigation';
import { adminFetch, getAdmin, exigirModulo } from '@/lib/admin';
import { AdminShell } from '@/components/AdminShell';
import { D, FONT } from '@/components/design-tokens';
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
  /** Sin cuenta en Supabase no puede entrar, por más "Activo" que se vea. */
  canLogin: boolean;
  isMe: boolean;
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

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const GREEN = '#3fbf8f';
const RED = '#f55';
const GRID = '1.5fr 1.8fr 1fr 1.6fr';
const th: React.CSSProperties = { fontSize: 10.5, letterSpacing: '1px', fontWeight: 700, color: '#7A7A7F' };
const statCard: React.CSSProperties = { minWidth: 150, background: D.card, border: `1px solid ${D.inputBorder}`, borderRadius: 14, padding: '14px 18px' };

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

  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} adminRol={admin.rol}>
      <div style={{ fontFamily: FONT, color: D.text }}>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" />
        <style>{`
          .am-row:hover{ background: rgba(255,255,255,0.022); }
          @media (max-width: 900px){ .am-grid{ grid-template-columns: 1fr 1fr !important; row-gap: 10px !important; } .am-head{ display:none !important; } }
        `}</style>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#8A8A8F', fontWeight: 500 }}>
              <span>Configuración</span><span style={{ color: '#4C4C51' }}>/</span><span style={{ color: '#B4B4B9' }}>Administradores</span>
            </div>
            <h1 style={{ margin: '8px 0 0', fontSize: 30, fontWeight: 800, letterSpacing: '-0.8px', color: '#FBFBFA' }}>Administradores</h1>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#8A8A8F', maxWidth: '70ch' }}>
              Quién puede entrar a este panel y qué parte le toca. El rol decide qué secciones ve: lo que no le toca, ni le aparece en el menú ni lo puede pedir por su cuenta.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={statCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN, boxShadow: `0 0 10px ${GREEN}99` }} />
                <span style={{ fontSize: 12, color: '#8A8A8F', fontWeight: 600 }}>Con acceso</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6, color: GREEN, fontFamily: MONO }}>{activos}</div>
            </div>
          </div>
        </div>

        {/* Cuentas que se ven "Activo" pero no pueden entrar (creadas antes del arreglo). */}
        {rotos.length > 0 ? (
          <div style={{ marginTop: 20, display: 'flex', alignItems: 'flex-start', gap: 11, background: 'rgba(255,85,85,0.06)', border: '1px solid rgba(255,85,85,0.3)', borderRadius: 12, padding: '13px 17px' }}>
            <i className="ph ph-warning" style={{ color: RED, fontSize: 16, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: '#D4D4D8', lineHeight: 1.55 }}>
              <strong style={{ color: '#FBFBFA' }}>
                {rotos.length} cuenta{rotos.length === 1 ? '' : 's'} sin acceso configurado.
              </strong>{' '}
              Existe{rotos.length === 1 ? '' : 'n'} en la lista pero no puede{rotos.length === 1 ? '' : 'n'} entrar: le{rotos.length === 1 ? '' : 's'} falta la cuenta
              de acceso. Bórrala{rotos.length === 1 ? '' : 's'} y vuelve a crearla{rotos.length === 1 ? '' : 's'} desde aquí.
            </div>
          </div>
        ) : null}

        <div style={{ marginTop: 20 }}>
          <AdminCreate />
        </div>

        <div style={{ marginTop: 18, background: '#0F0F11', border: `1px solid ${D.inputBorder}`, borderRadius: 16, overflow: 'hidden' }}>
          <div className="am-head" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 16, padding: '15px 24px', borderBottom: `1px solid ${D.cardBorder}`, background: '#131315' }}>
            <div style={th}>NOMBRE</div>
            <div style={th}>CORREO</div>
            <div style={th}>ESTADO</div>
            <div style={{ ...th, textAlign: 'right' }}>ACCIONES</div>
          </div>

          {admins.map((a) => {
            const activo = a.status === 1;
            // "Activo" sin cuenta de acceso es mentira: se dice.
            const color = !a.canLogin ? RED : activo ? GREEN : '#6B6B71';
            const label = !a.canLogin ? 'Sin acceso' : activo ? 'Activo' : 'Inactivo';
            return (
              <div key={a.id} className="am-row am-grid" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 16, padding: '15px 24px', borderBottom: '1px solid rgba(255,255,255,0.045)', alignItems: 'center', opacity: activo ? 1 : 0.6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <span style={{ width: 3, alignSelf: 'stretch', minHeight: 24, borderRadius: 3, background: color, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#EDEDEC' }}>
                      {a.name}
                      {a.isMe ? <span style={{ color: D.amber, fontWeight: 600, fontSize: 11.5 }}> · tú</span> : null}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#5C5C61', marginTop: 3 }}>{a.rolNombre}</div>
                  </div>
                </div>

                <div style={{ fontSize: 12.5, color: '#B4B4B9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.email}</div>

                <div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color, whiteSpace: 'nowrap', background: `color-mix(in srgb, ${color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 26%, transparent)`, borderRadius: 20, padding: '5px 11px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    {label}
                  </span>
                </div>

                <AdminRowActions adminId={a.id} name={a.name} status={a.status} isMe={a.isMe} canLogin={a.canLogin} rol={a.rol} />
              </div>
            );
          })}
        </div>

        {/* Sección 30 · Riesgos y controles: quién hizo qué, con fecha. */}
        <div style={{ marginTop: 28 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#FBFBFA' }}>Actividad reciente</h2>
          <p style={{ margin: '0 0 14px', fontSize: 12.5, color: '#7A7A7F', maxWidth: '70ch' }}>
            Las acciones que cambian permisos, dinero o lo que ve el público. No se puede borrar desde el panel.
          </p>
          {bitacora.length === 0 ? (
            <div style={{ background: '#0F0F11', border: `1px solid ${D.inputBorder}`, borderRadius: 14, padding: '20px 24px', fontSize: 13, color: '#7A7A7F' }}>
              Todavía no hay nada anotado. Aquí irán apareciendo las altas y bajas de cuentas, los cambios de rol,
              los métodos de pago, los retiros pagados y las publicaciones de diseño.
            </div>
          ) : (
            <div style={{ background: '#0F0F11', border: `1px solid ${D.inputBorder}`, borderRadius: 14, overflow: 'hidden' }}>
              {bitacora.map((b) => (
                <div key={b.id} style={{ display: 'flex', gap: 14, alignItems: 'baseline', flexWrap: 'wrap', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.045)' }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: '#5C5C61', whiteSpace: 'nowrap' }}>
                    {new Date(b.cuando).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#EDEDEC' }}>{b.accion}</span>
                  {b.objetivo ? <span style={{ fontSize: 12.5, color: '#B4B4B9' }}>{b.objetivo}</span> : null}
                  <span style={{ fontSize: 11.5, color: '#7A7A7F', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                    {b.quien} · {b.rol}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p style={{ margin: '16px 0 0', fontSize: 11.5, color: '#5C5C61', lineHeight: 1.55, maxWidth: '80ch' }}>
          Desactivar corta el acceso de inmediato, incluso si la persona tiene la sesión abierta. No puedes desactivar tu propia cuenta ni cambiarte el rol a ti mismo: esta pantalla solo la ve Dirección, y quien se la quita no tiene cómo devolvérsela.
        </p>
      </div>
    </AdminShell>
  );
}
