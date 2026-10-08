'use client';

import { useState } from 'react';
import { AdminSelect } from '@/components/AdminSelect';
import { useRouter } from 'next/navigation';
import { Btn, Panel } from '@/components/ui';

export function ThemeDuplicate({ themes }: { themes: Array<{ id: number; name: string }> }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    await fetch('/api/admin/themes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromId: Number(form.get('fromId')),
        name: String(form.get('name') ?? ''),
      }),
    });
    setLoading(false);
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <Panel title="Duplicar tema" icon="ph-copy" desc="Punto de partida para un sector nuevo.">
      <form onSubmit={onSubmit} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <AdminSelect
          name="fromId"
          required
          ariaLabel="Tema de origen"
          className="w-auto min-w-[220px]"
          defaultValue={themes[0] ? String(themes[0].id) : ''}
          options={themes.map((t) => ({ value: String(t.id), label: t.name }))}
        />
        <input
          name="name"
          className="adm-input"
          required
          minLength={2}
          placeholder="Nombre del tema nuevo"
          aria-label="Nombre del tema nuevo"
          style={{ flex: '1 1 200px', width: 'auto', minWidth: 0 }}
        />
        <Btn variant="primary" type="submit" icon="ph-copy" disabled={loading}>Duplicar</Btn>
      </form>
    </Panel>
  );
}
