import Link from 'next/link';
import Image from 'next/image';
import type { CtaBlock } from '@maqserv/config';

/**
 * Banda tipo anuncio/hero configurable: la imagen va de FONDO a sangre
 * (cubre toda la banda) con un velo oscuro para legibilidad, y el texto + botón
 * encima, a la izquierda. Sin imagen, es una banda de color con el texto.
 * Todo por tokens del tema.
 */
export function Band({ block, kind, maxWidth = 1240 }: { block: CtaBlock; kind: 'hero' | 'promo'; maxWidth?: number }) {
  const big = kind === 'hero';
  const bg = block.bg ?? 'linear-gradient(135deg, var(--color-secondary) 0%, var(--color-bg) 100%)';
  // La banda siempre lleva fondo oscuro, así que el texto va en blanco técnico
  // literal y no en var(--color-text): en modo claro ese token es casi negro y
  // el texto desaparecería sobre el degradado.
  const textColor = block.textColor ?? '#F5F7FA';
  const accent = block.accentColor ?? 'var(--color-primary)';
  const hasImg = !!block.image;
  const minH = big ? 460 : 380;

  return (
    <section style={{ position: 'relative', background: bg, overflow: 'hidden', minHeight: hasImg ? minH : undefined }}>
      {/* Imagen de fondo a sangre + velo oscuro (más oscuro a la izquierda) */}
      {hasImg ? (
        <>
          <Image src={block.image as string} alt="" fill priority={big} sizes="100vw" style={{ objectFit: 'cover', objectPosition: 'right center' }} />
          <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(6,6,8,.92) 0%, rgba(6,6,8,.66) 40%, rgba(6,6,8,.28) 72%, rgba(6,6,8,.12) 100%)' }} />
          <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(6,6,8,.55) 0%, transparent 42%)' }} />
        </>
      ) : null}

      {/* Contenido encima */}
      <div style={{ position: 'relative', maxWidth, marginLeft: 'auto', marginRight: 'auto', paddingLeft: 26, paddingRight: 26, paddingTop: big ? 60 : 48, paddingBottom: big ? 60 : 48, minHeight: hasImg ? minH : undefined, display: 'grid', alignContent: 'center' }}>
        <div style={{ display: 'grid', gap: '1.15rem', maxWidth: 620, justifyItems: 'start' }}>
          {block.eyebrow ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: accent, fontWeight: 700, fontSize: '12.5px', letterSpacing: '.16em', textTransform: 'uppercase' }}>
              <span style={{ width: 22, height: 3, background: accent }} />{block.eyebrow}
            </span>
          ) : null}
          <h2 style={{ margin: 0, fontSize: big ? 'clamp(2.2rem, 5vw, 3.8rem)' : 'clamp(1.7rem, 3.6vw, 2.6rem)', textTransform: 'uppercase', color: textColor, lineHeight: 1.01, letterSpacing: '-.01em', textShadow: hasImg ? '0 2px 24px rgba(0,0,0,.45)' : undefined }}>{block.title}</h2>
          {block.subtitle ? (
            <p style={{ margin: 0, color: `color-mix(in srgb, ${textColor} 78%, transparent)`, fontSize: big ? 17.5 : 16, lineHeight: 1.6, fontWeight: 300, maxWidth: 480 }}>{block.subtitle}</p>
          ) : null}
          {block.cta ? (
            <Link href={block.ctaLink || '/productos'} style={{ marginTop: '.55rem', display: 'inline-flex', alignItems: 'center', gap: 9, background: accent, color: 'var(--color-primary-fg)', fontWeight: 800, paddingTop: 15, paddingBottom: 15, paddingLeft: 30, paddingRight: 30, borderRadius: 'var(--radius-md)', textDecoration: 'none', fontSize: 15, boxShadow: `0 16px 34px -16px color-mix(in srgb, ${accent} 80%, transparent)` }}>{block.cta} <span style={{ fontSize: 17 }}>→</span></Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
