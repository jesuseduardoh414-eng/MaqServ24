'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { D } from '@/components/design-tokens';

const ghost: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, fontFamily: 'inherit', background: 'transparent',
  color: '#8A8A8F', border: `1px solid ${D.inputBorder}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
};

/**
 * Acciones sobre un administrador. La contraseña se cambia contra **Supabase**, que
 * es donde vive de verdad: reescribir el hash de `admins.password` no cambiaba nada.
 */
export function AdminRowActions({
  adminId,
  name,
  status,
  isMe,
  canLogin,
}: {
  adminId: number;
  name: string;
  status: number;
  isMe: boolean;
  canLogin: boolean;
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

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
      <style>{`.ar-ghost:hover:not(:disabled){ background: rgba(255,255,255,0.06); color:#f5f5f4; }`}</style>

      {/* Sin cuenta de acceso no hay contraseña que cambiar. */}
      {canLogin ? (
        <button type="button" className="ar-ghost" disabled={busy} onClick={() => { setAsking((v) => !v); setDone(false); }} style={{ ...ghost, opacity: busy ? 0.5 : 1 }}>
          Contraseña
        </button>
      ) : null}

      {/* Nadie se desactiva a sí mismo: la API también lo rechaza. */}
      {!isMe ? (
        <button
          type="button"
          className="ar-ghost"
          disabled={busy}
          onClick={toggle}
          style={{ ...ghost, color: status === 1 ? '#8A8A8F' : '#3fbf8f', opacity: busy ? 0.5 : 1 }}
        >
          {status === 1 ? 'Desactivar' : 'Activar'}
        </button>
      ) : (
        <span style={{ fontSize: 11.5, color: '#5C5C61' }}>Tu cuenta</span>
      )}

      {asking ? (
        <div ref={box} style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 50, width: 300, background: D.card, border: `1px solid ${D.inputBorder}`, borderRadius: 12, padding: 16, boxShadow: '0 18px 44px -14px rgba(0,0,0,0.75)', textAlign: 'left' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#FBFBFA', marginBottom: 6 }}>Nueva contraseña</div>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#8A8A8F', lineHeight: 1.5 }}>
            Para <strong style={{ color: '#B4B4B9' }}>{name}</strong>. Dísela por un canal seguro.
          </p>
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            style={{ width: '100%', background: D.inputBg, border: `1px solid ${D.inputBorder}`, borderRadius: 8, padding: '9px 11px', color: D.text, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
          />
          <button
            type="button"
            disabled={busy || pass.length < 8}
            onClick={() => void send({ password: pass }, () => { setPass(''); setAsking(false); setDone(true); })}
            style={{ width: '100%', marginTop: 12, fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', background: D.amber, color: 'var(--color-primary-fg)', border: 'none', borderRadius: 8, padding: '9px 12px', cursor: busy ? 'wait' : pass.length < 8 ? 'not-allowed' : 'pointer', opacity: busy || pass.length < 8 ? 0.45 : 1 }}
          >
            Cambiar contraseña
          </button>
        </div>
      ) : null}

      {done ? <span role="status" style={{ fontSize: 11.5, color: '#3fbf8f', fontWeight: 600 }}>✓ Cambiada</span> : null}
      {error ? <span role="alert" style={{ fontSize: 11.5, color: '#f55', fontWeight: 600, width: '100%', textAlign: 'right' }}>{error}</span> : null}
    </div>
  );
}
