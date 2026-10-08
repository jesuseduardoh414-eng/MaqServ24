'use client';

import { useEffect, useRef, useState } from 'react';
import { AdminSelect } from '@/components/AdminSelect';
import { useRouter } from 'next/navigation';
import { ROLES_ADMIN, contrasenaSegura, type RolAdmin } from '@maqserv/config';
import { Btn, StatusText } from '@/components/ui';
import { ReglasContrasena } from '@/components/ReglasContrasena';

const ROLES = Object.values(ROLES_ADMIN);

const nota: React.CSSProperties = { fontSize: 12.5, color: 'var(--adm-muted)' };

/**
 * Acciones sobre un administrador. La contraseña se cambia en `admins.password` (bcrypt), que
 * es donde vive de verdad: reescribir el hash de `admins.password` no cambiaba nada.
 */
export function AdminRowActions({
  adminId,
  name,
  status,
  isMe,
  canLogin,
  rol,
  principal,
  soyPrincipal,
}: {
  adminId: number;
  name: string;
  status: number;
  isMe: boolean;
  canLogin: boolean;
  rol: RolAdmin;
  /** Esta fila es la cuenta principal. */
  principal: boolean;
  /** Quien mira es la cuenta principal. */
  soyPrincipal: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [pass, setPass] = useState('');
  const [done, setDone] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!asking) return;
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setAsking(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAsking(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [asking]);

  async function send(body: Record<string, unknown>, after?: () => void) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/admins/${adminId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json())?.message ?? 'No se pudo actualizar');
      after?.();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar');
    } finally {
      setBusy(false);
    }
  }

  function toggle() {
    const off = status === 1;
    if (off && !window.confirm(`¿Desactivar a ${name}? Pierde el acceso al panel de inmediato, aunque tenga la sesión abierta.`)) return;
    void send({ status: off ? 0 : 1 });
  }

  /**
   * Eliminar de verdad. Solo se ofrece en cuentas ya desactivadas (la API lo
   * exige igual): borrar es un paso más allá de desactivar, y pasar por el
   * primero evita quitarle la cuenta a alguien que sí la usaba.
   */
  async function remove() {
    if (!window.confirm(`¿Eliminar la cuenta de ${name}? Desaparece de esta lista y no se puede deshacer. Queda anotado en la bitácora.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/admins/${adminId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json())?.message ?? 'No se pudo eliminar');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar');
    } finally {
      setBusy(false);
    }
  }

  async function hacerPrincipal() {
    if (!window.confirm(`¿Hacer a ${name} la cuenta principal? Dejarás de serlo tú: ya no podrás dar o quitar Dirección General ni modificar sus cuentas.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/admins/${adminId}/principal`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json())?.message ?? 'No se pudo transferir');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo transferir');
    } finally {
      setBusy(false);
    }
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
  const roles = soyPrincipal ? ROLES : ROLES.filter((r) => r.clave !== 'direccion');
  const segura = contrasenaSegura(pass, { nombre: name });

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
      {/*
        El rol se cambia aquí mismo, sin abrir nada: es el dato que más se
        corrige (alguien entra a un equipo, alguien cambia de área) y esconderlo
        tras un botón hacía que nadie lo ajustara.
        En la propia cuenta no se ofrece — la API también lo rechaza.
      */}
      {!isMe ? (
        <AdminSelect
          size="sm"
          // 30px, como los botones `sm` de la fila (el `sm` del desplegable mide 36).
          className="w-auto min-w-[150px] max-w-[190px] h-[30px] text-[12.5px]"
          ariaLabel={`Rol de ${name}`}
          value={rol}
          disabled={busy}
          onChange={(v) => void send({ rol: v })}
          options={roles.map((r) => ({ value: r.clave, label: r.nombre }))}
        />
      ) : null}

      {/* Transferir la cuenta principal: solo a otra Dirección activa que pueda entrar. */}
      {soyPrincipal && !isMe && !principal && rol === 'direccion' && status === 1 && canLogin ? (
        <Btn size="sm" disabled={busy} onClick={() => void hacerPrincipal()}>
          Hacer principal
        </Btn>
      ) : null}

      {/* Sin cuenta de acceso no hay contraseña que cambiar. */}
      {canLogin ? (
        <Btn size="sm" disabled={busy} onClick={() => { setAsking((v) => !v); setDone(false); }} aria-expanded={asking}>
          Contraseña
        </Btn>
      ) : null}

      {/* Nadie se desactiva a sí mismo: la API también lo rechaza. */}
      {!isMe ? (
        <Btn size="sm" disabled={busy} onClick={toggle}>
          {status === 1 ? 'Desactivar' : 'Activar'}
        </Btn>
      ) : (
        <span style={nota}>Tu cuenta</span>
      )}

      {/* Eliminar: solo cuentas desactivadas y nunca la propia. */}
      {!isMe && status === 0 ? (
        <Btn size="sm" variant="danger" disabled={busy} onClick={() => void remove()}>
          Eliminar
        </Btn>
      ) : null}

      {asking ? (
        <div
          ref={box}
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 50, width: 'min(300px, calc(100vw - 40px))',
            background: 'var(--adm-raised)', border: '1px solid var(--adm-border-strong)', borderRadius: 12, padding: 16,
            boxShadow: '0 20px 50px -20px rgba(0,0,0,0.85)', textAlign: 'left',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--adm-text)', marginBottom: 4 }}>Nueva contraseña</div>
          <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--adm-muted)', lineHeight: 1.5 }}>
            Para <strong style={{ color: 'var(--adm-text-2)', fontWeight: 600 }}>{name}</strong>. Dísela por un canal seguro.
          </p>
          <input
            type="password"
            className="adm-input"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="new-password"
            placeholder="Mínimo 10 caracteres"
            aria-label={`Nueva contraseña para ${name}`}
          />
          <ReglasContrasena password={pass} nombre={name} />
          <Btn
            variant="primary"
            size="sm"
            disabled={busy || !segura}
            onClick={() => void send({ password: pass }, () => { setPass(''); setAsking(false); setDone(true); })}
            style={{ width: '100%', marginTop: 12 }}
          >
            Cambiar contraseña
          </Btn>
        </div>
      ) : null}

      {done ? (
        <span role="status">
          <StatusText tone="ok">Cambiada</StatusText>
        </span>
      ) : null}
      {error ? <span role="alert" style={{ fontSize: 12.5, color: 'var(--adm-bad)', fontWeight: 500, width: '100%', textAlign: 'right' }}>{error}</span> : null}
    </div>
  );
}
