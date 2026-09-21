'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShButton, ShInput, ShLabel } from '@maqserv/ui';
import { AccessShell, AccessError } from '@/components/AccessShell';

/**
 * "¿Olvidaste tu contraseña?" del panel, paso 1: pedir el enlace.
 *
 * La pantalla dice lo mismo exista o no el correo. La API responde `ok` en
 * ambos casos a propósito (anti-enumeración), y aquí no se inventa una
 * certeza que la API no da.
 */
export default function OlvidePage() {
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const email = String(new FormData(e.currentTarget).get('email') ?? '');
    const res = await fetch('/api/admin/auth/olvide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      setError(
        res.status === 429
          ? 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.'
          : typeof d?.message === 'string' ? d.message : 'No se pudo mandar el enlace.',
      );
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <AccessShell title="Revisa tu correo" subtitle="Si esa dirección tiene cuenta en el panel, ya va en camino un enlace para elegir una contraseña nueva.">
        <p className="mt-6 text-[13px] leading-relaxed text-[var(--ui-muted)]">
          El enlace sirve una sola vez y caduca en 60 minutos. Si no llega, mira en no deseados; y si
          tampoco está ahí, pide a Dirección que te la restablezca desde Administradores.
        </p>
        <Link href="/login" className="mt-6 inline-block text-[13.5px] font-semibold text-[var(--ui-accent)] no-underline hover:underline">
          ← Volver a entrar
        </Link>
      </AccessShell>
    );
  }

  return (
    <AccessShell title="¿Olvidaste tu contraseña?" subtitle="Escribe el correo de tu cuenta del panel y te mandamos un enlace para elegir una nueva.">
      <form onSubmit={onSubmit} className="mt-7 grid gap-4">
        <div className="grid gap-1.5">
          <ShLabel htmlFor="email">CORREO</ShLabel>
          <ShInput id="email" name="email" type="email" required autoFocus autoComplete="username" placeholder="tu@correo.com" />
        </div>
        {error ? <AccessError>{error}</AccessError> : null}
        <ShButton type="submit" disabled={loading} className="mt-1 w-full">
          {loading ? 'Mandando…' : 'Mandar enlace'}
        </ShButton>
      </form>
      <Link href="/login" className="mt-6 inline-block text-[13px] font-semibold text-[var(--ui-muted)] no-underline hover:text-[var(--ui-text)]">
        ← Volver a entrar
      </Link>
    </AccessShell>
  );
}
