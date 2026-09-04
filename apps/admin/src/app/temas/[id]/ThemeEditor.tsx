'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Card, Input } from '@maqserv/ui';
import type { Copys, Palette, ThemeTokens } from '@maqserv/config';

/** Contraste WCAG (luminancia relativa). AA texto normal: ≥ 4.5. */
function contrast(hex1: string, hex2: string): number {
  const lum = (hex: string) => {
    const m = hex.replace('#', '');
    const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
    const [r, g, b] = [0, 2, 4].map((i) => {
      const v = parseInt(full.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  try {
    const [a, b] = [lum(hex1), lum(hex2)];
    return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
  } catch {
    return 21;
  }
}

const PALETTE_LABELS: Record<keyof Palette, string> = {
  primary: 'Primario',
  primaryFg: 'Texto sobre primario',
  secondary: 'Secundario',
  accent: 'Acento',
  background: 'Fondo',
  surface: 'Superficie',
  text: 'Texto',
  textMuted: 'Texto tenue',
  border: 'Borde',
  success: 'Éxito',
  warning: 'Advertencia',
  error: 'Error',
};

/**
 * Metadatos de cada sección del Home para el "Constructor": nombre amigable
 * y recomendación de qué conviene poner (cada giro llena secciones distinto).
 * Las claves coinciden con theme.tokens.sections[].key.
 */
type SectionMeta = { name: string; recommendation: string };
const SECTION_META: Record<string, SectionMeta> = {
  'home.hero': { name: 'Hero / Portada', recommendation: 'La primera impresión: título grande, subtítulo, botones y distintivos de confianza. Recomendada para todos los giros.' },
  'home.categories': { name: 'Categorías', recommendation: 'Carrusel de categorías o departamentos. Recomendada si manejas un catálogo variado.' },
  'home.featured-products': { name: 'Productos destacados', recommendation: 'Rejilla de productos con filtros por categoría. Ideal para tiendas o renta con catálogo.' },
  'home.why-choose-us': { name: 'Por qué elegirnos', recommendation: 'Tus ventajas y valores. Genera confianza en cualquier giro.' },
  'home.strategic-sectors': { name: 'Sectores / Industrias', recommendation: 'Industrias o casos de uso que atiendes. Útil para negocios B2B o de servicios.' },
  'home.offer': { name: 'Oferta / Promoción', recommendation: 'Banner de promoción con botón. Para campañas, descuentos o lanzamientos.' },
  'home.reviews': { name: 'Reseñas / Testimonios', recommendation: 'Opiniones de clientes reales. Recomendada como prueba social.' },
  'home.brands': { name: 'Marcas', recommendation: 'Logos de marcas con las que trabajas. Para distribuidores o aliados.' },
  'home.faq': { name: 'Preguntas frecuentes', recommendation: 'Resuelve dudas comunes. Reduce fricción en cualquier giro.' },
  'home.services': { name: 'Servicios', recommendation: 'Los servicios que ofreces. Para negocios de servicios más que de producto.' },
  'home.banners': { name: 'Banners', recommendation: 'Imágenes promocionales enlazables. Para campañas visuales.' },
  'home.blog': { name: 'Blog / Noticias', recommendation: 'Artículos recientes. Si generas contenido o buscas SEO.' },
  'home.success-cases': { name: 'Casos de éxito', recommendation: 'Proyectos o trabajos realizados. Ideal como portafolio.' },
};

/** Secciones con página de edición dedicada (se irán sumando: 2, 3, …). */
const SECTION_EDITOR_HREF: Record<string, string> = { 'home.hero': '/diseno/hero', 'home.categories': '/diseno/categorias' };

const UPPER_LABEL: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)',
};

function PaletteEditor({
  title,
  palette,
  onChange,
}: {
  title: string;
  palette: Palette;
  onChange: (p: Palette) => void;
}) {
  const warnings: string[] = [];
  const cText = contrast(palette.text, palette.background);
  const cPrimary = contrast(palette.primaryFg, palette.primary);
  if (cText < 4.5) warnings.push(`Texto/Fondo: ${cText}:1 (mínimo 4.5:1)`);
  if (cPrimary < 4.5) warnings.push(`Texto sobre primario: ${cPrimary}:1 (mínimo 4.5:1)`);

  return (
    <Card style={{ display: 'grid', gap: '.7rem' }}>
      <strong>{title}</strong>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '.6rem' }}>
        {(Object.keys(PALETTE_LABELS) as Array<keyof Palette>).map((key) => (
          <label key={key} style={{ display: 'grid', gap: '.2rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            {PALETTE_LABELS[key]}
            <span style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
              <input
                type="color"
                value={palette[key]}
                onChange={(e) => onChange({ ...palette, [key]: e.target.value.toUpperCase() })}
                style={{ width: 34, height: 30, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', background: 'none', padding: 0, cursor: 'pointer' }}
              />
              <code style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>{palette[key]}</code>
            </span>
          </label>
        ))}
      </div>
      {warnings.length > 0 ? (
        <div role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)', display: 'grid', gap: '.2rem' }}>
          {warnings.map((w) => <span key={w}>⚠ Contraste insuficiente — {w}</span>)}
        </div>
      ) : (
        <span style={{ color: 'var(--color-success)', fontSize: 'var(--text-sm)' }}>✓ Contraste WCAG AA correcto</span>
      )}
    </Card>
  );
}

/** Preview con los tokens del borrador aplicados como variables locales. */
function Preview({ tokens, copys }: { tokens: ThemeTokens; copys: Copys }) {
  const p = tokens.colors.light;
  const vars = {
    '--color-primary': p.primary,
    '--color-primary-fg': p.primaryFg,
    '--color-accent': p.accent,
    '--color-bg': p.background,
    '--color-surface': p.surface,
    '--color-text': p.text,
    '--color-text-muted': p.textMuted,
    '--color-border': p.border,
    '--radius-md': tokens.shape.radiusMd,
    '--radius-lg': tokens.shape.radiusLg,
    '--radius-button': tokens.shape.buttonRadius,
    '--text-base': `${tokens.typography.baseSizePx}px`,
    '--text-lg': `${Math.round(tokens.typography.baseSizePx * tokens.typography.scaleRatio)}px`,
    '--text-2xl': `${Math.round(tokens.typography.baseSizePx * Math.pow(tokens.typography.scaleRatio, 3))}px`,
    '--font-sans': `'${tokens.typography.fontSans}', system-ui, sans-serif`,
    '--font-heading': `'${tokens.typography.fontHeading}', system-ui, sans-serif`,
  } as React.CSSProperties;

  const t = (k: string) => copys['es']?.[k] ?? k;

  return (
    <div style={{ ...vars, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1.4rem', display: 'grid', gap: '.9rem', position: 'sticky', top: 16 }}>
      <span style={{ color: 'var(--color-accent)', fontWeight: 700, fontSize: '.8em', letterSpacing: '.06em' }}>VISTA PREVIA</span>
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-2xl)', color: 'var(--color-text)', margin: 0, lineHeight: 1.15 }}>
        {t('home.hero.title')}
      </h3>
      <p style={{ color: 'var(--color-text-muted)', margin: 0, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)' }}>
        {t('home.hero.subtitle')}
      </p>
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
        <button style={{ fontFamily: 'var(--font-sans)', background: 'var(--color-primary)', color: 'var(--color-primary-fg)', border: 'none', borderRadius: 'var(--radius-button)', padding: '.55em 1.2em', fontWeight: 600, fontSize: 'var(--text-base)' }}>
          {t('home.hero.cta')}
        </button>
        <button style={{ fontFamily: 'var(--font-sans)', background: 'transparent', color: 'var(--color-primary)', border: '1px solid var(--color-primary)', borderRadius: 'var(--radius-button)', padding: '.55em 1.2em', fontWeight: 600, fontSize: 'var(--text-base)' }}>
          {t('product.cta.quote')}
        </button>
      </div>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '.9rem 1.1rem', fontFamily: 'var(--font-sans)' }}>
        <strong style={{ color: 'var(--color-text)', fontSize: 'var(--text-base)' }}>{t('site.name')}</strong>
        <p style={{ color: 'var(--color-text-muted)', margin: '.3rem 0 0', fontSize: 'var(--text-base)' }}>
          {t('product.price.onQuote')}
        </p>
      </div>
    </div>
  );
}

export function ThemeEditor({
  themeId,
  initialTokens,
  initialCopys,
  hasDraft,
}: {
  themeId: number;
  initialTokens: ThemeTokens;
  initialCopys: Copys;
  hasDraft: boolean;
}) {
  const router = useRouter();
  const [tokens, setTokens] = useState<ThemeTokens>(initialTokens);
  const [copys, setCopys] = useState<Copys>(initialCopys);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const copyKeys = useMemo(() => Object.keys(copys['es'] ?? {}).sort(), [copys]);

  async function call(path: string, body?: unknown): Promise<Record<string, unknown> | null> {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/themes/${themeId}/${path}`, {
      method: path === 'draft' ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    setBusy(false);
    if (!res.ok) {
      setMsg({ ok: false, text: typeof data?.message === 'string' ? data.message : 'Error' });
      return null;
    }
    return data ?? {};
  }

  const saveDraft = async () => {
    if (await call('draft', { tokens, copys })) setMsg({ ok: true, text: 'Borrador guardado' });
    router.refresh();
  };
  const publish = async () => {
    if (!(await call('draft', { tokens, copys }))) return;
    const r = await call('publish');
    if (r) {
      // La API reporta si la revalidación instantánea del sitio funcionó; si
      // no, se dice AQUÍ — antes el panel presumía "publicado" con el sitio
      // viejo y nadie se enteraba (incidente REVALIDATE_SECRET).
      if (r.revalidated) setMsg({ ok: true, text: 'Publicado — el sitio ya sirve este tema' });
      else setMsg({ ok: true, text: `Publicado, pero sin refresco instantáneo: ${typeof r.revalidateError === 'string' ? r.revalidateError : 'el sitio se actualizará en ~1 min.'}` });
    }
    router.refresh();
  };
  const discard = async () => {
    if (await call('discard')) setMsg({ ok: true, text: 'Borrador descartado' });
    router.refresh();
  };

  const setSection = (key: string, patch: Partial<{ enabled: boolean; order: number }>) => {
    setTokens((t) => ({
      ...t,
      sections: t.sections.map((s) => (s.key === key ? { ...s, ...patch } : s)),
    }));
  };
  const moveSection = (key: string, dir: -1 | 1) => {
    setTokens((t) => {
      const sorted = [...t.sections].sort((a, b) => a.order - b.order);
      const i = sorted.findIndex((s) => s.key === key);
      const j = i + dir;
      if (j < 0 || j >= sorted.length) return t;
      [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
      return { ...t, sections: sorted.map((s, idx) => ({ ...s, order: idx })) };
    });
  };

  const inputStyle = { width: '100%' } as const;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '1.2rem', alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {/* Barra de acciones */}
        <Card style={{ display: 'flex', gap: '.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button onClick={publish} disabled={busy}>Publicar</Button>
          <Button variant="outline" onClick={saveDraft} disabled={busy}>Guardar borrador</Button>
          {hasDraft ? <Button variant="ghost" onClick={discard} disabled={busy}>Descartar borrador</Button> : null}
          {msg ? (
            <span role={msg.ok ? 'status' : 'alert'} style={{ color: msg.ok ? 'var(--color-success)' : 'var(--color-error)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              {msg.text}
            </span>
          ) : null}
        </Card>

        <PaletteEditor title="Colores — modo claro" palette={tokens.colors.light} onChange={(p) => setTokens({ ...tokens, colors: { ...tokens.colors, light: p } })} />
        <PaletteEditor title="Colores — modo oscuro" palette={tokens.colors.dark} onChange={(p) => setTokens({ ...tokens, colors: { ...tokens.colors, dark: p } })} />

        <Card style={{ display: 'grid', gap: '.7rem' }}>
          <strong>Tipografía y forma</strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '.7rem' }}>
            <label style={{ display: 'grid', gap: '.2rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              Fuente (Google Fonts)
              <Input value={tokens.typography.fontSans} onChange={(e) => setTokens({ ...tokens, typography: { ...tokens.typography, fontSans: e.target.value, fontHeading: e.target.value } })} style={inputStyle} />
            </label>
            <label style={{ display: 'grid', gap: '.2rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              Tamaño base (px)
              <Input type="number" min={12} max={22} value={tokens.typography.baseSizePx} onChange={(e) => setTokens({ ...tokens, typography: { ...tokens.typography, baseSizePx: Number(e.target.value) || 16 } })} style={inputStyle} />
            </label>
            <label style={{ display: 'grid', gap: '.2rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              Radio de botones
              <Input value={tokens.shape.buttonRadius} onChange={(e) => setTokens({ ...tokens, shape: { ...tokens.shape, buttonRadius: e.target.value } })} style={inputStyle} />
            </label>
            <label style={{ display: 'grid', gap: '.2rem', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              Radio de tarjetas
              <Input value={tokens.shape.radiusLg} onChange={(e) => setTokens({ ...tokens, shape: { ...tokens.shape, radiusLg: e.target.value } })} style={inputStyle} />
            </label>
          </div>
          <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
            <input type="checkbox" checked={tokens.quoteMode} onChange={(e) => setTokens({ ...tokens, quoteMode: e.target.checked })} />
            Modo Cotización (oculta precios y carrito; muestra CTA de cotización)
          </label>
        </Card>

        <Card style={{ display: 'grid', gap: '.8rem' }}>
          <div>
            <strong>Constructor del Home</strong>
            <p style={{ margin: '.25rem 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', lineHeight: 1.45 }}>
              Cada bloque de la página de inicio, en orden. Actívalo, muévelo y —según la sección— configúralo aquí mismo.
              Como cada giro es distinto, la <em>recomendación</em> te dice qué conviene poner en cada sección.
            </p>
          </div>

          {/* Página: Home (las secciones van indentadas debajo) */}
          <div style={{ display: 'grid', gap: '.5rem' }}>
            <span style={{ ...UPPER_LABEL, color: 'var(--color-text)' }}>▾ Página: Home</span>
            <div style={{ display: 'grid', gap: '.6rem', paddingLeft: '.9rem', borderLeft: '2px solid var(--color-border)' }}>
              {[...tokens.sections].sort((a, b) => a.order - b.order).map((s, i, arr) => {
                const meta = SECTION_META[s.key] ?? { name: s.key, recommendation: '' };
                const editorHref = SECTION_EDITOR_HREF[s.key];
                return (
                  <div
                    key={s.key}
                    style={{
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      background: s.enabled ? 'var(--color-surface)' : 'color-mix(in srgb, var(--color-text) 4%, transparent)',
                      opacity: s.enabled ? 1 : 0.75,
                      padding: '.7rem .8rem',
                      display: 'grid',
                      gap: '.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '.7rem', alignItems: 'flex-start' }}>
                      <span
                        aria-hidden
                        style={{
                          flexShrink: 0, width: 26, height: 26, borderRadius: '50%',
                          background: s.enabled ? 'var(--color-primary)' : 'var(--color-border)',
                          color: s.enabled ? 'var(--color-primary-fg)' : 'var(--color-text-muted)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 'var(--text-sm)',
                        }}
                      >
                        {i + 1}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: 'var(--text-base)' }}>Sección {i + 1} · {meta.name}</strong>
                          {!s.enabled ? (
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', borderRadius: '999px', padding: '1px 8px' }}>Oculta</span>
                          ) : null}
                        </div>
                        {meta.recommendation ? (
                          <p style={{ margin: '.3rem 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', lineHeight: 1.4 }}>💡 {meta.recommendation}</p>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', gap: '.2rem', alignItems: 'center', flexShrink: 0 }}>
                        <label title={s.enabled ? 'Ocultar sección' : 'Mostrar sección'} style={{ display: 'inline-flex', alignItems: 'center' }}>
                          <input type="checkbox" checked={s.enabled} onChange={(e) => setSection(s.key, { enabled: e.target.checked })} aria-label={`Mostrar ${meta.name}`} />
                        </label>
                        <Button size="sm" variant="ghost" onClick={() => moveSection(s.key, -1)} disabled={i === 0} aria-label="Subir">↑</Button>
                        <Button size="sm" variant="ghost" onClick={() => moveSection(s.key, 1)} disabled={i === arr.length - 1} aria-label="Bajar">↓</Button>
                      </div>
                    </div>

                    <div>
                      {editorHref ? (
                        <Link
                          href={editorHref}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '.4rem', textDecoration: 'none',
                            color: 'var(--color-primary-fg)', background: 'var(--color-primary)', fontWeight: 700,
                            fontSize: 'var(--text-sm)', padding: '.4em .9em', borderRadius: 'var(--radius-button)',
                          }}
                        >
                          ⚙ Configurar contenido →
                        </Link>
                      ) : (
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Configuración detallada próximamente</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <Card style={{ display: 'grid', gap: '.5rem' }}>
          <div>
            <strong>Todos los textos del sitio (avanzado)</strong>
            <p style={{ margin: '.25rem 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              Lista completa por clave. Para el Home usa mejor el <em>Constructor</em> de arriba; esto es el respaldo para textos que aún no tienen editor por sección.
            </p>
          </div>
          <div style={{ display: 'grid', gap: '.4rem', maxHeight: 420, overflowY: 'auto', paddingRight: '.4rem' }}>
            {copyKeys.map((key) => (
              <label key={key} style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '.6rem', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
                <code style={{ color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{key}</code>
                <Input
                  value={copys['es']?.[key] ?? ''}
                  onChange={(e) => setCopys({ ...copys, es: { ...copys['es'], [key]: e.target.value } })}
                  aria-label={key}
                  style={inputStyle}
                />
              </label>
            ))}
          </div>
        </Card>
      </div>

      <Preview tokens={tokens} copys={copys} />
    </div>
  );
}
