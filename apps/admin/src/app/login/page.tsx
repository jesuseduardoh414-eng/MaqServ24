'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShButton, ShInput, ShLabel } from '@maqserv/ui';
import { useBranding } from '@/components/branding';

/** Respaldo local del logo: los del tema apuntan a un bucket externo. */
const LOGO_LOCAL = '/brand/maqser24-logo.png';

/**
 * Entrada al panel.
 *
 * Es la única pantalla del admin que se ve SIN sesión, así que es la primera
 * impresión del panel: antes era una caja con dos campos sueltos y el texto de
 * error en rojo pelado. Ahora usa las mismas piezas que el resto (`Sh*` sobre
 * el contrato `--ui-*`), con la marca a la vista y el estado de error tratado
 * como aviso, no como una línea suelta.
 *
 * Dos columnas en escritorio: formulario a la izquierda y panel de marca a la
 * derecha (decorativo, `aria-hidden`; se esconde por debajo de 1024px para no
 * empujar el formulario en un portátil pequeño).
 */
export default function AdminLoginPage() {
  const router = useRouter();
  const branding = useBranding();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verClave, setVerClave] = useState(false);

  const logo = branding.logoDark || branding.logoLight || LOGO_LOCAL;

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
    <main className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,46%)]">
      {/* ---- Columna del formulario ---- */}
      <div className="flex items-center justify-center bg-[var(--ui-surface-2)] px-5 py-12">
        <div className="w-full max-w-[380px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo}
            alt="MAQSER24"
            className="h-9 w-auto object-contain"
            onError={(e) => { e.currentTarget.src = LOGO_LOCAL; }}
          />

          <h1 className="mt-7 font-head text-[26px] leading-tight font-semibold tracking-[-0.02em] text-[var(--ui-text)]">
            Panel interno
          </h1>
          <p className="mt-2 text-[13.5px] text-[var(--ui-muted)]">
            Entra con tu cuenta del equipo para administrar el sitio.
          </p>

          <form onSubmit={onSubmit} className="mt-7 grid gap-4" noValidate={false}>
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
              <ShLabel htmlFor="password">CONTRASEÑA</ShLabel>
              {/* El ojo va DENTRO del campo: un botón al lado desalineaba la
                  columna y comía ancho en móvil. */}
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
                <button
                  type="button"
                  onClick={() => setVerClave((v) => !v)}
                  aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={verClave}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-[var(--ui-radius)] text-[var(--ui-muted)] transition-colors hover:text-[var(--ui-text)]"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {verClave ? (
                      <>
                        <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
                        <circle cx="12" cy="12" r="3.2" />
                        <path d="m4 20 16-16" />
                      </>
                    ) : (
                      <>
                        <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
                        <circle cx="12" cy="12" r="3.2" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {/* El error como aviso con su icono y su caja: una línea roja suelta
                se confunde con la ayuda del campo. */}
            {error ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-[var(--ui-radius)] border border-[color-mix(in_srgb,var(--ui-danger)_45%,transparent)] bg-[color-mix(in_srgb,var(--ui-danger)_12%,transparent)] px-3 py-2.5 text-[13px] text-[var(--ui-danger)]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="mt-px shrink-0">
                  <circle cx="12" cy="12" r="9" /><path d="M12 7.5V13M12 16.4h.01" />
                </svg>
                {error}
              </p>
            ) : null}

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
        </div>
      </div>

      {/* ---- Columna de marca (decorativa) ---- */}
      <aside
        aria-hidden
        className="relative hidden overflow-hidden border-l border-[var(--ui-border)] bg-[var(--ui-surface)] lg:block"
      >
        {/* Retícula técnica: la identidad pide "ingeniería, no decoración". */}
        <span
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.045) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* Resplandor del acento: sigue al tema, no es un azul escrito a mano. */}
        <span
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(70% 55% at 72% 18%, color-mix(in srgb, var(--color-primary) 26%, transparent) 0%, transparent 70%)',
          }}
        />
        <span
          className="absolute inset-x-0 bottom-0 h-1/2"
          style={{ background: 'linear-gradient(to top, var(--ui-surface-2), transparent)' }}
        />

        <div className="relative flex h-full flex-col justify-end gap-5 p-14">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo}
            alt=""
            className="h-11 w-auto self-start object-contain opacity-95"
            onError={(e) => { e.currentTarget.src = LOGO_LOCAL; }}
          />
          <p className="max-w-[26ch] font-head text-[34px] leading-[1.15] font-semibold tracking-[-0.02em] text-[var(--ui-text)]">
            Catálogo, cotizaciones y pedidos en un solo lugar.
          </p>
          <span className="h-px w-16 bg-[var(--color-primary)]" />
          <p className="max-w-[38ch] text-[13.5px] text-[var(--ui-muted)]">
            Lo que cambies aquí se ve en el sitio público: productos, disponibilidad, precios y diseño.
          </p>
        </div>
      </aside>
    </main>
  );
}
