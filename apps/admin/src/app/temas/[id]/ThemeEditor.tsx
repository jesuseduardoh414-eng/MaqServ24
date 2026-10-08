'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Copys, Palette, ThemeTokens } from '@maqserv/config';
import { Btn, Chip, FormField, GroupLabel, IconBtn, Note, PageHeader, Panel, StatusText, Switch } from '@/components/ui';

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
  'home.banners': { name: 'Banners', recommendation: 'Imágenes promocionales enlazables. Para campañas visuales.' },
  'home.blog': { name: 'Blog / Noticias', recommendation: 'Artículos recientes. Si generas contenido o buscas SEO.' },
  'home.success-cases': { name: 'Casos de éxito', recommendation: 'Proyectos o trabajos realizados. Ideal como portafolio.' },
};

/** Secciones con página de edición dedicada (se irán sumando: 2, 3, …). */
const SECTION_EDITOR_HREF: Record<string, string> = { 'home.hero': '/diseno/hero', 'home.categories': '/diseno/categorias' };

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
    <Panel
      title={title}
      action={warnings.length > 0
        ? <StatusText tone="bad">Contraste insuficiente</StatusText>
        : <StatusText tone="ok">Contraste WCAG AA correcto</StatusText>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(170px, 100%), 1fr))', gap: '14px 16px' }}>
        {(Object.keys(PALETTE_LABELS) as Array<keyof Palette>).map((key) => (
          <label key={key} className="adm-field">
            <span className="adm-label">{PALETTE_LABELS[key]}</span>
            <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="color"
                value={palette[key]}
                onChange={(e) => onChange({ ...palette, [key]: e.target.value.toUpperCase() })}
                style={{ width: 36, height: 32, flexShrink: 0, border: '1px solid var(--adm-border-strong)', borderRadius: 8, background: 'none', padding: 2, cursor: 'pointer' }}
              />
              <code className="adm-mono" style={{ fontSize: 13, color: 'var(--adm-text)' }}>{palette[key]}</code>
            </span>
          </label>
        ))}
      </div>
      {warnings.length > 0 ? (
        <div role="alert" style={{ marginTop: 16 }}>
          <Note tone="bad">
            {warnings.map((w) => <div key={w}>Contraste insuficiente — {w}</div>)}
          </Note>
        </div>
      ) : null}
    </Panel>
  );
}

/**
 * Preview con los tokens del borrador aplicados como variables locales.
 * Aquí NO va el kit del panel a propósito: es una muestra del SITIO, con sus
 * colores, su fuente y sus radios.
 */
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
    <div className="te-preview" style={{ ...vars, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1.4rem', display: 'grid', gap: '.9rem' }}>
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
  themeName,
  active,
  initialTokens,
  initialCopys,
  hasDraft,
}: {
  themeId: number;
  themeName: string;
  active: boolean;
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

  return (
    <div>
      <style>{`
        .te-grid { display: grid; grid-template-columns: minmax(0,1fr) 340px; gap: 20px; align-items: start; }
        .te-main { display: grid; gap: 20px; min-width: 0; }
        .te-main .adm-panel + .adm-panel { margin-top: 0; }
        .te-preview { position: sticky; top: 16px; }
        .te-sec { display: grid; grid-template-columns: 28px minmax(0,1fr) auto auto; gap: 14px; align-items: center; }
        .te-copy { display: grid; grid-template-columns: 240px minmax(0,1fr); gap: 12px; align-items: center; padding-top: 8px; padding-bottom: 8px; }
        /* Editor y vista previa se apilan antes de que la columna fija apriete el formulario. */
        @media (max-width: 1080px) {
          .te-grid { grid-template-columns: minmax(0,1fr); }
          .te-preview { position: static; }
        }
        @media (max-width: 700px) {
          .te-sec { grid-template-columns: 28px minmax(0,1fr); row-gap: 10px; }
          .te-sec > .te-sec-cfg, .te-sec > .te-sec-ctl { grid-column: 2; }
          .te-copy { grid-template-columns: minmax(0,1fr); gap: 6px; }
        }
      `}</style>

      <PageHeader
        eyebrow={['Sitio web', ['Temas', '/temas'], themeName]}
        title={
          <>
            Tema: {themeName}
            {active ? <Chip tone="ok" style={{ marginLeft: 12, verticalAlign: 'middle' }}>Activo</Chip> : null}
          </>
        }
        subtitle="Los cambios se guardan como borrador; el sitio no cambia hasta Publicar."
        actions={
          <>
            {hasDraft ? <Btn variant="ghost" onClick={discard} disabled={busy}>Descartar borrador</Btn> : null}
            <Btn onClick={saveDraft} disabled={busy}>Guardar borrador</Btn>
            <Btn variant="primary" icon="ph-upload-simple" onClick={publish} disabled={busy}>Publicar</Btn>
          </>
        }
      />

      {msg ? (
        <div role={msg.ok ? 'status' : 'alert'} style={{ marginBottom: 20 }}>
          <Note tone={msg.ok ? 'ok' : 'bad'}>{msg.text}</Note>
        </div>
      ) : null}

      <div className="te-grid">
        <div className="te-main">
          <PaletteEditor title="Colores — modo claro" palette={tokens.colors.light} onChange={(p) => setTokens({ ...tokens, colors: { ...tokens.colors, light: p } })} />
          <PaletteEditor title="Colores — modo oscuro" palette={tokens.colors.dark} onChange={(p) => setTokens({ ...tokens, colors: { ...tokens.colors, dark: p } })} />

          <Panel title="Tipografía y forma">
            <div className="adm-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(180px, 100%), 1fr))' }}>
              <FormField label="Fuente (Google Fonts)">
                <input className="adm-input" value={tokens.typography.fontSans} onChange={(e) => setTokens({ ...tokens, typography: { ...tokens.typography, fontSans: e.target.value, fontHeading: e.target.value } })} />
              </FormField>
              <FormField label="Tamaño base (px)">
                <input className="adm-input" type="number" min={12} max={22} value={tokens.typography.baseSizePx} onChange={(e) => setTokens({ ...tokens, typography: { ...tokens.typography, baseSizePx: Number(e.target.value) || 16 } })} />
              </FormField>
              <FormField label="Radio de botones">
                <input className="adm-input" value={tokens.shape.buttonRadius} onChange={(e) => setTokens({ ...tokens, shape: { ...tokens.shape, buttonRadius: e.target.value } })} />
              </FormField>
              <FormField label="Radio de tarjetas">
                <input className="adm-input" value={tokens.shape.radiusLg} onChange={(e) => setTokens({ ...tokens, shape: { ...tokens.shape, radiusLg: e.target.value } })} />
              </FormField>
            </div>
            <div style={{ marginTop: 18 }}>
              <Switch
                on={tokens.quoteMode}
                onClick={() => setTokens({ ...tokens, quoteMode: !tokens.quoteMode })}
                label="Modo Cotización (oculta precios y carrito; muestra CTA de cotización)"
              />
            </div>
          </Panel>

          <Panel
            flush
            clip
            title="Constructor del Home"
            desc={<>Cada bloque de la página de inicio, en orden. Actívalo, muévelo y —según la sección— configúralo aquí mismo. Como cada giro es distinto, la <em>recomendación</em> te dice qué conviene poner en cada sección.</>}
          >
            {/* Página: Home (sus secciones van debajo, en el orden en que salen en el sitio) */}
            <GroupLabel>Página: Home</GroupLabel>
            {[...tokens.sections].sort((a, b) => a.order - b.order).map((s, i, arr) => {
              const meta = SECTION_META[s.key] ?? { name: s.key, recommendation: '' };
              const editorHref = SECTION_EDITOR_HREF[s.key];
              return (
                <div key={s.key} className="adm-trow te-sec" style={{ opacity: s.enabled ? 1 : 0.75 }}>
                  <span
                    aria-hidden
                    className="adm-num"
                    style={{
                      width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center',
                      border: '1px solid var(--adm-border-strong)', fontSize: 13, fontWeight: 600,
                      color: s.enabled ? 'var(--adm-accent)' : 'var(--adm-faint)',
                    }}
                  >
                    {i + 1}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="adm-cell-title">Sección {i + 1} · {meta.name}</span>
                      {!s.enabled ? <Chip tone="muted">Oculta</Chip> : null}
                    </div>
                    {meta.recommendation ? (
                      <div className="adm-cell-sub" style={{ lineHeight: 1.5 }}>
                        <i className="ph ph-lightbulb" aria-hidden style={{ marginRight: 5, color: 'var(--adm-faint)' }} />
                        {meta.recommendation}
                      </div>
                    ) : null}
                  </div>
                  <div className="te-sec-cfg">
                    {editorHref ? (
                      <Btn size="sm" icon="ph-gear-six" href={editorHref}>Configurar contenido</Btn>
                    ) : (
                      <span style={{ fontSize: 12.5, color: 'var(--adm-faint)' }}>Configuración detallada próximamente</span>
                    )}
                  </div>
                  <div className="te-sec-ctl" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Switch on={s.enabled} onClick={() => setSection(s.key, { enabled: !s.enabled })} title={`Mostrar ${meta.name}`} />
                    <IconBtn icon="ph-arrow-up" label="Subir" onClick={() => moveSection(s.key, -1)} disabled={i === 0} />
                    <IconBtn icon="ph-arrow-down" label="Bajar" onClick={() => moveSection(s.key, 1)} disabled={i === arr.length - 1} />
                  </div>
                </div>
              );
            })}
          </Panel>

          <Panel
            flush
            clip
            title="Todos los textos del sitio (avanzado)"
            desc={<>Lista completa por clave. Para el Home usa mejor el <em>Constructor</em> de arriba; esto es el respaldo para textos que aún no tienen editor por sección.</>}
          >
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {copyKeys.map((key) => (
                <label key={key} className="adm-trow te-copy">
                  <code className="adm-mono adm-ellipsis" style={{ fontSize: 12.5, color: 'var(--adm-muted)' }} title={key}>{key}</code>
                  <input
                    className="adm-input"
                    value={copys['es']?.[key] ?? ''}
                    onChange={(e) => setCopys({ ...copys, es: { ...copys['es'], [key]: e.target.value } })}
                    aria-label={key}
                    style={{ height: 34, fontSize: 13.5 }}
                  />
                </label>
              ))}
            </div>
          </Panel>
        </div>

        <Preview tokens={tokens} copys={copys} />
      </div>
    </div>
  );
}
