'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminSelect } from '@/components/AdminSelect';
import { ROLES_ADMIN, type RolAdmin } from '@maqserv/config';
import { ShPopover, ShPopoverContent, ShPopoverTrigger, mostrarResultado } from '@maqserv/ui';
import { confirmar } from '@/components/Dialogos';

const ROLES = Object.values(ROLES_ADMIN);

const nota: React.CSSProperties = { fontSize: 12.5, color: 'var(--adm-muted)' };

/**
 * Acciones sobre una cuenta del panel (2026-10-28, "botones más limpios"): el
 * rol se cambia ahí mismo y todo lo demás vive en un menú «⋯». Nadie escribe
 * la contraseña de otro: se le manda un enlace por correo y la elige la
 * persona. La propia se cambia desde el avatar de arriba (Mi cuenta), no aquí.
 */
export function AdminRowActions({
  adminId,
  name,
  status,
  isMe,
  canLogin,
  invitado,
  rol,
  principal,
  soyPrincipal,
}: {
  adminId: number;
  name: string;
  status: number;
  isMe: boolean;
  canLogin: boolean;
  /** Le llegó la invitación y todavía no crea su contraseña. */
  invitado: boolean;
  rol: RolAdmin;
  /** Esta fila es la cuenta principal. */
  principal: boolean;
  /** Quien mira es la cuenta principal. */
  soyPrincipal: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);

  async function llamar(ruta: string, init: RequestInit, exito: string, fallo: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(ruta, init);
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? fallo);
      mostrarResultado(exito);
      setAbierto(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : fallo);
    } finally {
      setBusy(false);
    }
  }
  const patch = (body: Record<string, unknown>, exito: string) =>
    llamar(`/api/admin/admins/${adminId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, exito, 'No se pudo actualizar');
  const post = (ruta: string, exito: string, fallo: string) => llamar(`/api/admin/admins/${adminId}/${ruta}`, { method: 'POST' }, exito, fallo);

  async function desactivar() {
    if (!(await confirmar({
      titulo: `¿Desactivar a ${name}?`,
      mensaje: 'Pierde el acceso al panel de inmediato, aunque tenga la sesión abierta.',
      confirmar: 'Desactivar',
      peligro: true,
    }))) return;
    void patch({ status: 0 }, `${name} ya no puede entrar al panel`);
  }
  async function eliminar() {
    if (!(await confirmar({
      titulo: `¿Eliminar la cuenta de ${name}?`,
      mensaje: 'Desaparece de esta lista y no se puede deshacer. Queda anotado en la bitácora.',
      confirmar: 'Eliminar cuenta',
      peligro: true,
    }))) return;
    void llamar(`/api/admin/admins/${adminId}`, { method: 'DELETE' }, `Cuenta de ${name} eliminada`, 'No se pudo eliminar');
  }
  async function hacerPrincipal() {
    if (!(await confirmar({
      titulo: `¿Hacer a ${name} la cuenta principal?`,
      mensaje: 'Dejarás de serlo tú: ya no podrás dar o quitar Dirección General ni modificar sus cuentas.',
      confirmar: 'Hacerla principal',
    }))) return;
    void post('principal', `${name} es ahora la cuenta principal`, 'No se pudo transferir');
  }

  /*
   * La cuenta principal y las de Dirección solo las toca la principal (la API
   * también lo exige). A quien no lo es, ni se le ofrecen los botones.
   */
  if (!isMe && !soyPrincipal && (principal || rol === 'direccion')) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <span style={nota}>{principal ? 'Cuenta principal' : 'Solo la cuenta principal la modifica'}</span>
      </div>
    );
  }
  // La propia cuenta no se toca desde aquí: ni rol, ni estado, ni contraseña (eso va en Mi cuenta).
  if (isMe) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <span style={nota}>Tu cuenta</span>
      </div>
    );
  }
  const roles = soyPrincipal ? ROLES : ROLES.filter((r) => r.clave !== 'direccion');

  /** Lo que ofrece el menú para esta cuenta, en orden. */
  const opciones: { texto: string; icono: string; peligro?: boolean; hacer: () => void }[] = [];
  if (invitado) opciones.push({ texto: 'Volver a mandar la invitación', icono: 'ph-paper-plane-tilt', hacer: () => void post('invitacion', `Invitación mandada otra vez a ${name}`, 'No se pudo mandar') });
  if (!invitado && canLogin && status === 1) opciones.push({ texto: 'Mandarle enlace para cambiar contraseña', icono: 'ph-key', hacer: () => void post('enlace-contrasena', `Le mandamos a ${name} el enlace para cambiar su contraseña`, 'No se pudo mandar') });
  if (soyPrincipal && !principal && rol === 'direccion' && status === 1 && canLogin && !invitado) opciones.push({ texto: 'Hacer principal', icono: 'ph-crown-simple', hacer: () => void hacerPrincipal() });
  if (status === 0) opciones.push({ texto: 'Activar', icono: 'ph-check-circle', hacer: () => void patch({ status: 1 }, `${name} puede volver a entrar al panel`) });
  if (status !== 0) opciones.push({ texto: 'Desactivar', icono: 'ph-prohibit', peligro: true, hacer: () => void desactivar() });
  if (status === 0) opciones.push({ texto: 'Eliminar', icono: 'ph-trash', peligro: true, hacer: () => void eliminar() });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
      {/* El rol se cambia aquí mismo: es el dato que más se corrige. */}
      {status !== 0 ? (
        <AdminSelect
          size="sm"
          className="w-auto min-w-[150px] max-w-[190px] h-[30px] text-[12.5px]"
          ariaLabel={`Rol de ${name}`}
          value={rol}
          disabled={busy}
          onChange={(v) => void patch({ rol: v }, `${name} ahora tiene el rol ${ROLES_ADMIN[v as RolAdmin]?.nombre ?? v}`)}
          options={roles.map((r) => ({ value: r.clave, label: r.nombre }))}
        />
      ) : null}

      {opciones.length ? (
        <ShPopover open={abierto} onOpenChange={setAbierto}>
          <ShPopoverTrigger asChild>
            <button type="button" className="adm-ibtn" disabled={busy} aria-label={`Más acciones para ${name}`} title="Más acciones">
              <i className="ph ph-dots-three-outline" aria-hidden />
            </button>
          </ShPopoverTrigger>
          <ShPopoverContent
            align="end"
            sideOffset={6}
            collisionPadding={16}
            style={{ minWidth: 220, background: 'var(--adm-raised)', border: '1px solid var(--adm-border-strong)', borderRadius: 12, padding: 6, boxShadow: '0 20px 50px -20px var(--adm-sombra)', textAlign: 'left' }}
          >
            <div style={{ display: 'grid', gap: 2 }}>
              {opciones.map((o) => (
                <button key={o.texto} type="button" className="am-menu-item" data-peligro={o.peligro || undefined} disabled={busy} onClick={o.hacer}>
                  <i className={`ph ${o.icono}`} aria-hidden />{o.texto}
                </button>
              ))}
            </div>
          </ShPopoverContent>
        </ShPopover>
      ) : null}

      {error ? <span role="alert" style={{ fontSize: 12.5, color: 'var(--adm-bad)', fontWeight: 500, width: '100%', textAlign: 'right' }}>{error}</span> : null}
    </div>
  );
}
