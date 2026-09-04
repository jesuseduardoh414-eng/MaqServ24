import Link from 'next/link';
import { toneColors, type Tone } from '@/lib/order-status';
import { Icon } from '@/components/Icon';

/**
 * Piezas compartidas del panel de vendedor (`/vendedor` y sus 3 subpáginas).
 *
 * Módulo SIN 'use client' a propósito: todas las páginas que lo usan son de
 * servidor. Aquí no hay estado ni handlers, solo JSX y estilos.
 */
export const MONO = 'var(--font-sans)';
export const DISPLAY = 'var(--font-display)';

/**
 * Antes inyectaba el <link> de Inter por página; la tipografía ya llega del
 * TEMA vía el layout (var(--font-sans)), así que no carga nada. Se conserva
 * como no-op para no tocar a sus consumidores.
 */
export const MonoFont = () => null;

export const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  padding: '22px 24px',
};

export const eyebrowStyle: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: 11,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--color-text-muted)',
};

export function Badge({ text, tone }: { text: string; tone: Tone }) {
  const c = toneColors(tone);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: c.fg, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 'var(--radius-button)', padding: '5px 11px', whiteSpace: 'nowrap' }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: c.fg }} />
      {text}
    </span>
  );
}

/** Encabezado común: título display + regla, como el resto de las páginas de cuenta. */
export function VendorHeader({
  eyebrow,
  title,
  aside,
  back,
}: {
  eyebrow?: string;
  title: string;
  aside?: React.ReactNode;
  /** Enlace de regreso al panel; se omite en el panel mismo. */
  back?: { href: string; label: string };
}) {
  return (
    <div style={{ borderBottom: '2px solid var(--color-text)', paddingBottom: 20, marginBottom: 28 }}>
      {eyebrow ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <span style={{ width: 28, height: 4, background: 'var(--color-primary)', borderRadius: 2 }} />
          <span style={{ ...eyebrowStyle, letterSpacing: '0.24em' }}>{eyebrow}</span>
        </div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <h1 className="vn-title" style={{ fontFamily: DISPLAY, margin: 0, fontSize: 48, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--color-text)' }}>
          {title}
        </h1>
        {aside}
        {back ? (
          <Link href={back.href} style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 12, letterSpacing: '0.06em', color: 'var(--color-text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="arrowLeft" size={12} />
            {back.label.toUpperCase()}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** Dato etiquetado: etiqueta arriba, valor abajo. */
export function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div style={{ ...eyebrowStyle, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: value ? 'var(--color-text)' : 'var(--color-text-muted)', wordBreak: 'break-word' }}>
        {value || '—'}
      </div>
    </div>
  );
}

/** Envoltura común: fondo, fuente, responsive y el ancho de las páginas de cuenta. */
export function VendorMain({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <MonoFont />
      <style>{`
        @media (max-width: 760px){
          .vn-wrap{ padding-left:22px !important; padding-right:22px !important; }
          .vn-title{ font-size:34px !important; }
          .vn-nav{ grid-template-columns: 1fr !important; }
        }
        .vn-card{ transition: border-color .15s ease, background .15s ease; }
        .vn-card:hover{ border-color: var(--color-text) !important; background: color-mix(in srgb, var(--color-text) 3%, var(--color-surface)) !important; }
        .vn-card:hover .vn-cta{ color: var(--color-text) !important; }
      `}</style>
      <main className="vn-wrap" style={{ maxWidth: 1000, margin: '0 auto', padding: '44px 40px 60px' }}>
        {children}
      </main>
    </div>
  );
}
