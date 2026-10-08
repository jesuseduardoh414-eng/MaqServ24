'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Btn, IconBtn, StatusText } from '@/components/ui';

/**
 * Sacar la lista y empujarla al CRM: sin esto, juntar correos que no se pueden usar
 * no sirve de nada.
 */
export function SubscriberTools({ perfexEnabled, total }: { perfexEnabled: boolean; total: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'csv' | 'sync' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  /** El CSV lo arma el navegador: el proxy del admin solo sabe reenviar JSON. */
  async function exportCsv() {
    setBusy('csv');
    setMsg(null);
    try {
      const res = await fetch('/api/admin/subscribers/export');
      if (!res.ok) throw new Error('No se pudo exportar');
      const rows = (await res.json()) as Array<{ email: string; createdAt: string | null }>;
      const csv = ['correo,alta', ...rows.map((r) => `${r.email},${r.createdAt ? r.createdAt.slice(0, 10) : ''}`)].join('\n');
      // BOM para que Excel en Windows respete los acentos.
      const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `suscriptores-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg({ ok: true, text: `${rows.length} correos exportados` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'No se pudo exportar' });
    } finally {
      setBusy(null);
    }
  }

  async function sync() {
    if (!window.confirm(`¿Enviar los ${total} suscriptores a Perfex como leads?`)) return;
    setBusy('sync');
    setMsg(null);
    try {
      const res = await fetch('/api/admin/subscribers/sync', { method: 'POST' });
      const data = await res.json();
      setMsg(data?.ok
        ? { ok: true, text: `${data.sent} de ${data.total} enviados a Perfex` }
        : { ok: false, text: data?.message ?? 'No se pudo sincronizar' });
    } catch {
      setMsg({ ok: false, text: 'No se pudo sincronizar' });
    } finally {
      setBusy(null);
      router.refresh();
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {msg ? (
        <span role="status">
          <StatusText tone={msg.ok ? 'ok' : 'bad'}>{msg.text}</StatusText>
        </span>
      ) : null}

      {/* Sin Perfex configurado el botón no puede hacer nada: se dice, no se esconde. */}
      {/* El <span> lleva el título: un botón deshabilitado no muestra el suyo al pasar el mouse. */}
      <span title={perfexEnabled ? 'Empuja todos los suscriptores a Perfex como leads' : 'Perfex no está configurado'} style={{ display: 'inline-flex' }}>
        <Btn icon="ph-arrow-square-out" onClick={sync} disabled={busy !== null || !perfexEnabled || total === 0}>
          {busy === 'sync' ? 'Enviando…' : 'Enviar a Perfex'}
        </Btn>
      </span>

      <Btn icon="ph-download-simple" onClick={exportCsv} disabled={busy !== null || total === 0}>
        {busy === 'csv' ? 'Exportando…' : 'Exportar CSV'}
      </Btn>
    </div>
  );
}

/** Baja de la lista. Es definitivo: el correo se borra. */
export function DeleteSubscriber({ id, email }: { id: number; email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm(`¿Dar de baja a ${email}? Se borra de la lista.`)) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/subscribers/${id}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return <IconBtn icon="ph-user-minus" label={`Dar de baja a ${email}`} danger onClick={remove} disabled={busy} />;
}
