'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShButton, ShInput, ShLabel } from '@maqserv/ui';
import { AccessShell, AccessError, EyeButton } from '@/components/AccessShell';

/**
 * Paso 2 de "¿Olvidaste tu contraseña?": elegir la nueva. El token viene en la
 * URL del correo y se manda junto con la contraseña; la API decide si sigue
 * valiendo (60 minutos y un solo uso).
 */
export function RestablecerForm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [ver, setVer] = useState(false);
  const [tocado, setTocado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const corta = tocado && password.length < 8;
  const distinta = tocado && confirm !== password;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTocado(true);
    if (password.length < 8 || confirm !== password) return;
    setLoading(true);
    setError(null);
    const res = await fetch('/api/admin/auth/restablecer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      setError(typeof d?.message === 'string' ? d.message : 'No se pudo cambiar la contraseña.');
      return;
    }
    setListo(true);
  }

  if (!token) {
    return (
      <AccessShell title="Falta el enlace" subtitle="Esta página se abre desde el enlace que llega por correo.">
        <Link href="/olvide" className="mt-6 inline-block text-[13.5px] font-semibold text-[var(--ui-accent)] no-underline hover:underline">
          Pedir un enlace nuevo →
        </Link>
      </AccessShell>
    );
  }

  if (listo) {
    return (
      <AccessShell title="Contraseña cambiada" subtitle="Ya puedes entrar con la nueva. Las sesiones que hubiera abiertas con la anterior quedaron cerradas.">
        <ShButton asChild className="mt-7 w-full"><Link href="/login">Entrar al panel</Link></ShButton>
      </AccessShell>
    );
  }

  return (
    <AccessShell title="Elige una contraseña nueva" subtitle="Mínimo 8 caracteres. Este enlace sirve una sola vez.">
      <form onSubmit={onSubmit} className="mt-7 grid gap-4" noValidate>
        <div className="grid gap-1.5">
          <ShLabel htmlFor="password">CONTRASEÑA NUEVA</ShLabel>
          <div className="relative">
            <ShInput
              id="password"
              type={ver ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              autoFocus
              className="pr-11"
              aria-invalid={corta || undefined}
            />
            <EyeButton visible={ver} onToggle={() => setVer((v) => !v)} />
          </div>
          {corta ? <span className="text-[12px] text-[var(--ui-danger)]">Necesita al menos 8 caracteres.</span> : null}
        </div>
        <div className="grid gap-1.5">
          <ShLabel htmlFor="confirm">REPÍTELA</ShLabel>
          <ShInput
            id="confirm"
            type={ver ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            aria-invalid={distinta || undefined}
          />
          {distinta ? <span className="text-[12px] text-[var(--ui-danger)]">No coinciden.</span> : null}
        </div>
        {error ? <AccessError>{error}</AccessError> : null}
        <ShButton type="submit" disabled={loading} className="mt-1 w-full">
          {loading ? 'Guardando…' : 'Guardar contraseña'}
        </ShButton>
      </form>
    </AccessShell>
  );
}
