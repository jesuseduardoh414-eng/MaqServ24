'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Input } from '@maqserv/ui';

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(typeof data?.message === 'string' ? data.message : 'Error al iniciar sesión');
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1.5rem' }}>
      <Card style={{ width: '100%', maxWidth: 380, display: 'grid', gap: '1rem' }}>
        <h1 style={{ fontSize: 'var(--text-xl)' }}>
          MAQSER24 <span style={{ color: 'var(--color-accent)' }}>admin</span>
        </h1>
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: '.8rem' }}>
          <Input name="email" type="email" required placeholder="Correo" aria-label="Correo" autoComplete="username" />
          <Input name="password" type="password" required placeholder="Contraseña" aria-label="Contraseña" autoComplete="current-password" />
          {error ? <p role="alert" style={{ color: 'var(--color-error)', margin: 0, fontSize: 'var(--text-sm)' }}>{error}</p> : null}
          <Button type="submit" disabled={loading}>Entrar</Button>
        </form>
      </Card>
    </main>
  );
}
