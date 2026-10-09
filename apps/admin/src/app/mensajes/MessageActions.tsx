'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Btn, IconBtn } from '@/components/ui';
import { confirmar } from '@/components/Dialogos';

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
    if (!(await confirmar({ titulo: `¿Borrar el mensaje de ${name}?`, mensaje: 'No se puede deshacer.', confirmar: 'Borrar', peligro: true }))) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/contact-messages/${id}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {state === 'nuevo' ? (
        <Btn size="sm" icon="ph-check" onClick={() => mover('atendido')} disabled={busy}>
          Marcar atendido
        </Btn>
      ) : (
        <Btn size="sm" icon="ph-arrow-counter-clockwise" onClick={() => mover('nuevo')} disabled={busy}>
          Reabrir
        </Btn>
      )}

      {state !== 'archivado' ? (
        <Btn size="sm" variant="ghost" icon="ph-archive" onClick={() => mover('archivado')} disabled={busy}>
          Archivar
        </Btn>
      ) : null}

      <IconBtn icon="ph-trash" label={`Borrar el mensaje de ${name}`} danger onClick={borrar} disabled={busy} />
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
    if (!(await confirmar({ titulo: `¿Enviar ${pendientes} ${pendientes === 1 ? 'mensaje' : 'mensajes'} a Perfex?`, mensaje: 'Entran al CRM como leads.', confirmar: 'Enviar a Perfex' }))) return;
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
      {msg ? (
        <span role="status" className={`adm-tone ${msg.ok ? 't-ok' : 't-bad'}`} style={{ fontSize: 12.5, fontWeight: 500 }}>{msg.text}</span>
      ) : null}
      {/* El título va en la envoltura: un botón deshabilitado no recibe el
          puntero y el motivo ("Perfex no está configurado") no se vería. */}
      <span title={perfexEnabled ? 'Sube al CRM los mensajes que quedaron pendientes' : 'Perfex no está configurado'} style={{ cursor: perfexEnabled ? undefined : 'not-allowed' }}>
        <Btn icon="ph-arrow-square-out" onClick={sync} disabled={busy || !perfexEnabled}>
          {busy ? 'Enviando…' : `Enviar ${pendientes} al CRM`}
        </Btn>
      </span>
    </div>
  );
}
