'use client';

import { useState } from 'react';
import { AdminSelect } from '@/components/AdminSelect';
import { useRouter } from 'next/navigation';
import { Button, Card, Input } from '@maqserv/ui';

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
    <Card style={{ display: 'grid', gap: '.6rem' }}>
      <strong>Duplicar tema (punto de partida para un sector nuevo)</strong>
      <form onSubmit={onSubmit} style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <AdminSelect
          name="fromId"
          required
          ariaLabel="Tema de origen"
          className="w-auto min-w-[220px]"
          defaultValue={themes[0] ? String(themes[0].id) : ''}
          options={themes.map((t) => ({ value: String(t.id), label: t.name }))}
        />
        <Input name="name" required minLength={2} placeholder="Nombre del tema nuevo" aria-label="Nombre del tema nuevo" style={{ flex: '1 1 200px' }} />
        <Button type="submit" disabled={loading}>Duplicar</Button>
      </form>
    </Card>
  );
}
