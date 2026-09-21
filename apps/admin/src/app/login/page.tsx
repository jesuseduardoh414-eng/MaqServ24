'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShButton, ShInput, ShLabel } from '@maqserv/ui';
import { AccessShell, AccessError, EyeButton } from '@/components/AccessShell';

/**
 * Entrada al panel.
 *
 * Es la única pantalla del admin que se ve SIN sesión, así que es la primera
 * impresión del panel. Usa las mismas piezas que el resto (`Sh*` sobre el
 * contrato `--ui-*`) y el marco compartido con "¿olvidaste?" y restablecer.
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verClave, setVerClave] = useState(false);

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
      setError(
        res.status === 429
          ? 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.'
          : typeof data?.message === 'string' ? data.message : 'Error al iniciar sesión',
      );
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <AccessShell title="Panel interno" subtitle="Entra con tu cuenta del equipo para administrar el sitio.">
      <form onSubmit={onSubmit} className="mt-7 grid gap-4">
        <div className="grid gap-1.5">
          <ShLabel htmlFor="email">CORREO</ShLabel>
          <ShInput
            id="email"
            name="email"
            type="email"
            required
            autoFocus
            autoComplete="username"
            placeholder="tu@correo.com"
            aria-invalid={error ? true : undefined}
          />
        </div>

        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <ShLabel htmlFor="password">CONTRASEÑA</ShLabel>
            <Link href="/olvide" className="text-[12px] font-semibold text-[var(--ui-accent)] no-underline hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <div className="relative">
            <ShInput
              id="password"
              name="password"
              type={verClave ? 'text' : 'password'}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="pr-11"
              aria-invalid={error ? true : undefined}
            />
            <EyeButton visible={verClave} onToggle={() => setVerClave((v) => !v)} />
          </div>
        </div>

        {error ? <AccessError>{error}</AccessError> : null}

        <ShButton type="submit" disabled={loading} className="mt-1 w-full">
          {loading ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="animate-spin">
                <path d="M12 3a9 9 0 1 0 9 9" />
              </svg>
              Entrando…
            </>
          ) : 'Entrar'}
        </ShButton>
      </form>

      <p className="mt-6 text-[12px] leading-relaxed text-[var(--ui-muted)]">
        Acceso restringido al equipo. Cada movimiento queda registrado en la bitácora del panel.
      </p>
    </AccessShell>
  );
}
