'use client';

import type { ReactNode } from 'react';
import { useBranding } from '@/components/branding';

/** Respaldo local del logo: los del tema apuntan a un bucket externo. */
const LOGO_LOCAL = '/brand/maqser24-logo.png';

/**
 * Marco de las pantallas SIN sesión del panel: entrar, "¿olvidaste?" y
 * restablecer. Las tres se ven igual —formulario a la izquierda, panel de
 * marca a la derecha— y antes ese marco vivía dentro de la página de login,
 * así que las otras dos habrían tenido que copiarlo o verse distintas.
 *
 * El panel de marca es decorativo (`aria-hidden`) y desaparece por debajo de
 * 1024px para no empujar el formulario en un portátil pequeño.
 */
export function AccessShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const branding = useBranding();
  const logo = branding.logoDark || branding.logoLight || LOGO_LOCAL;

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,46%)]">
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
            {title}
          </h1>
          <p className="mt-2 text-[13.5px] text-[var(--ui-muted)]">{subtitle}</p>
          {children}
        </div>
      </div>

      <aside
        aria-hidden
        className="relative hidden overflow-hidden border-l border-[var(--ui-border)] bg-[var(--ui-surface)] lg:block"
      >
        <span
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.045) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
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

/** Aviso de error con caja e icono: una línea roja suelta se confunde con la ayuda del campo. */
export function AccessError({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-[var(--ui-radius)] border border-[color-mix(in_srgb,var(--ui-danger)_45%,transparent)] bg-[color-mix(in_srgb,var(--ui-danger)_12%,transparent)] px-3 py-2.5 text-[13px] text-[var(--ui-danger)]"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="mt-px shrink-0">
        <circle cx="12" cy="12" r="9" /><path d="M12 7.5V13M12 16.4h.01" />
      </svg>
      {children}
    </p>
  );
}

/** Botón de mostrar/ocultar contraseña, DENTRO del campo (fuera desalineaba la columna). */
export function EyeButton({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      aria-pressed={visible}
      className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-[var(--ui-radius)] text-[var(--ui-muted)] transition-colors hover:text-[var(--ui-text)]"
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
        <circle cx="12" cy="12" r="3.2" />
        {visible ? <path d="m4 20 16-16" /> : null}
      </svg>
    </button>
  );
}
