import Link from 'next/link';
import type { getTheme } from '@/lib/theme';

/**
 * Encabezado del portal: solo el logo (2026-09-24). Sin el menú del sitio a
 * propósito: quien llega aquí viene a contestar una solicitud, no a navegar
 * el catálogo. Usa los mismos logos del tema que el header del sitio, con el
 * mismo intercambio claro/oscuro por CSS (`brand-swap`).
 */
export function EncabezadoPortal({ theme }: { theme: Awaited<ReturnType<typeof getTheme>> }) {
  const b = theme.tokens.branding ?? {};
  const claro = b.logoLight ?? null;
  const oscuro = b.logoDark ?? null;
  const alt = 'MAQSER24';
  const img: React.CSSProperties = { objectFit: 'contain', width: 'auto' };
  return (
    <header
      style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'color-mix(in srgb, var(--color-bg) 94%, transparent)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '12px clamp(14px, 2.5vw, 24px)', display: 'flex', alignItems: 'center' }}>
        <Link href="/" aria-label="Ir al sitio de MAQSER24" style={{ display: 'inline-flex', alignItems: 'center' }}>
          {claro && oscuro ? (
            <span className="brand-swap" style={{ display: 'inline-flex', alignItems: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="brand-logo-light hdr-logo-img" src={claro} alt={alt} style={img} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="brand-logo-dark hdr-logo-img" src={oscuro} alt={alt} style={img} />
            </span>
          ) : claro || oscuro ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="hdr-logo-img" src={(claro ?? oscuro) as string} alt={alt} style={img} />
          ) : (
            <strong style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: '-0.01em' }}>{alt}</strong>
          )}
        </Link>
      </div>
    </header>
  );
}
