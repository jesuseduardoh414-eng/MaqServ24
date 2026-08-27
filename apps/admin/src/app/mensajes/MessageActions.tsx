'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { D } from '@/components/design-tokens';

const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700,
  fontFamily: 'inherit', borderRadius: 9, padding: '7px 13px', cursor: 'pointer',
  background: 'transparent', color: '#B4B4B9', border: `1px solid ${D.inputBorder}`,
};

/**
 * Mover un mensaje entre nuevo / atendido / archivado.
 *
 * "Atendido" no es decoración: es lo que evita que dos personas contesten el
 * mismo mensaje, por eso la API sella quién y cuándo.
 */
export function MessageState({ id, state, name }: { id: number; state: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function mover(next: 'nuevo' | 'atendido' | 'archivado') {
    setBusy(true);
    try {
      await fetch(`/api/admin/contact-messages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: next }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function borrar() {
    if (!window.confirm(`¿Borrar el mensaje de ${name}? No se puede deshacer.`)) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/contact-messages/${id}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <style>{`.msg-btn:hover:not(:disabled){ background: rgba(255,255,255,0.06); color:#f5f5f4; }`}</style>

      {state === 'nuevo' ? (
        <button type="button" className="msg-btn" onClick={() => mover('atendido')} disabled={busy} style={{ ...btn, color: '#3fbf8f', borderColor: 'rgba(63,191,143,0.3)', opacity: busy ? 0.5 : 1 }}>
          <i className="ph ph-check" style={{ fontSize: 14 }} /> Marcar atendido
        </button>
      ) : (
        <button type="button" className="msg-btn" onClick={() => mover('nuevo')} disabled={busy} style={{ ...btn, opacity: busy ? 0.5 : 1 }}>
          <i className="ph ph-arrow-counter-clockwise" style={{ fontSize: 14 }} /> Reabrir
        </button>
      )}

      {state !== 'archivado' ? (
        <button type="button" className="msg-btn" onClick={() => mover('archivado')} disabled={busy} style={{ ...btn, opacity: busy ? 0.5 : 1 }}>
          <i className="ph ph-archive" style={{ fontSize: 14 }} /> Archivar
        </button>
      ) : null}

      <button
        type="button"
        onClick={borrar}
        disabled={busy}
        aria-label={`Borrar el mensaje de ${name}`}
        style={{ ...btn, color: '#8A8A8F' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#f55'; e.currentTarget.style.borderColor = 'rgba(255,85,85,0.3)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#8A8A8F'; e.currentTarget.style.borderColor = D.inputBorder; }}
      >
        Borrar
      </button>
    </div>
  );
}

/**
 * Empuja al CRM lo que quedó sin subir. Existe porque los mensajes que llegaron
 * antes que las credenciales de Perfex no tienen por qué quedarse fuera.
 */
export function ContactTools({ perfexEnabled, pendientes }: { perfexEnabled: boolean; pendientes: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function sync() {
    if (!window.confirm(`¿Enviar ${pendientes} mensaje(s) a Perfex como leads?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/contact-messages/sync', { method: 'POST' });
      const data = await res.json();
      setMsg(data?.ok
        ? { ok: true, text: `${data.sent} de ${data.total} enviados a Perfex` }
        : { ok: false, text: data?.message ?? 'No se pudo sincronizar' });
    } catch {
      setMsg({ ok: false, text: 'No se pudo sincronizar' });
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  if (pendientes === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <style>{`.msg-btn:hover:not(:disabled){ background: rgba(255,255,255,0.06); color:#f5f5f4; }`}</style>
      <button
        type="button"
        className="msg-btn"
        onClick={sync}
        disabled={busy || !perfexEnabled}
        title={perfexEnabled ? 'Sube al CRM los mensajes que quedaron pendientes' : 'Perfex no está configurado'}
        style={{ ...btn, padding: '9px 16px', fontSize: 13, opacity: busy || !perfexEnabled ? 0.4 : 1, cursor: perfexEnabled ? 'pointer' : 'not-allowed' }}
      >
        <i className="ph ph-arrow-square-out" style={{ fontSize: 15 }} />
        {busy ? 'Enviando…' : `Enviar ${pendientes} al CRM`}
      </button>
      {msg ? <span role="status" style={{ fontSize: 12.5, fontWeight: 600, color: msg.ok ? '#3fbf8f' : '#f55' }}>{msg.text}</span> : null}
    </div>
  );
}
