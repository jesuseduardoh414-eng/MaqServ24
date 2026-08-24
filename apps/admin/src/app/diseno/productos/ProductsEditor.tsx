'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { Catalog, CtaBlock, Featured, ThemeTokens } from '@maqserv/config';
import { D, FONT, cardStyle, inputStyle, h3Style, smallLabel, Field, Toggle, ColorField, BlockEditor } from '@/components/editor-kit';

type Copys = Record<string, Record<string, string>>;

const FEATURED_DEFAULTS: Featured = { limit: 8, showTabs: true, align: 'left', eyebrowColor: null, titleColor: null };
const BLOCK_DEFAULTS: CtaBlock = { enabled: false, eyebrow: '', title: '', subtitle: '', cta: '', ctaLink: '/productos', image: null, bg: null, textColor: null, accentColor: null };
const mergeBlock = (b?: Partial<CtaBlock>): CtaBlock => ({ ...BLOCK_DEFAULTS, ...(b ?? {}) });

interface Config {
  eyebrow: string; title: string; subtitle: string; allLabel: string; viewAll: string;
  featured: Featured;
  catalog: { banner: CtaBlock; mid: CtaBlock; promo: CtaBlock };
}

const TABS = [
  { id: 'destacados', label: 'Destacados (home)', icon: 'ph-star' },
  { id: 'catalogo', label: 'Catálogo (vista)', icon: 'ph-squares-four' },
] as const;

export function ProductsEditor({ themeId, copys, tokens, featured, catalog }: {
  themeId: number | null; copys: Copys; tokens: ThemeTokens; featured: Featured; catalog: Catalog;
}) {
  const router = useRouter();
  const initial: Config = useMemo(() => {
    const es = copys['es'] ?? {};
    return {
      eyebrow: es['home.featured.eyebrow'] ?? '', title: es['home.featured.title'] ?? '',
      subtitle: es['home.featured.subtitle'] ?? '', allLabel: es['home.featured.filterAll'] ?? '',
      viewAll: es['home.featured.viewAll'] ?? '',
      featured: { ...FEATURED_DEFAULTS, ...(featured ?? {}) },
      catalog: { banner: mergeBlock(catalog?.banner), mid: mergeBlock(catalog?.mid), promo: mergeBlock(catalog?.promo) },
    };
  }, [copys, featured, catalog]);

  const [config, setConfig] = useState<Config>(initial);
  const [saved, setSaved] = useState<Config>(initial);
  const [tab, setTab] = useState<string>('destacados');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setConfig((c) => ({ ...c, [k]: v }));
  const setF = <K extends keyof Featured>(k: K, v: Featured[K]) => setConfig((c) => ({ ...c, featured: { ...c.featured, [k]: v } }));
  const setBlock = (which: 'banner' | 'mid' | 'promo', patch: Partial<CtaBlock>) =>
    setConfig((c) => ({ ...c, catalog: { ...c.catalog, [which]: { ...c.catalog[which], ...patch } } }));

  const f = config.featured;
  const dirty = JSON.stringify(config) !== JSON.stringify(saved);

  function discard() { setConfig(saved); setToast(null); }
  async function publish() {
    if (busy || !themeId) return;
    setBusy(true); setToast(null);
    try {
      const es = { ...(copys['es'] ?? {}) };
      es['home.featured.eyebrow'] = config.eyebrow; es['home.featured.title'] = config.title;
      es['home.featured.subtitle'] = config.subtitle; es['home.featured.filterAll'] = config.allLabel;
      es['home.featured.viewAll'] = config.viewAll;
      const body = { tokens: { ...tokens, featured: config.featured, catalog: config.catalog }, copys: { ...copys, es } };
      const r2 = await fetch(`/api/admin/themes/${themeId}/draft`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r2.ok) throw new Error('No se pudieron guardar los ajustes');
      const r3 = await fetch(`/api/admin/themes/${themeId}/publish`, { method: 'POST' });
      if (!r3.ok) throw new Error('No se pudo publicar');
      setSaved(config);
      setToast({ ok: true, text: 'Publicado — el sitio se actualizará al refrescar.' });
      router.refresh();
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  // Colores efectivos del preview de destacados
  const eye = f.eyebrowColor ?? '#5b9dff', ttl = f.titleColor ?? '#f5f5f4';
  const splitTitle = (tt: string) => { const p = (tt || 'Productos destacados').trim().split(' '); const l = p.length > 1 ? p.pop() : null; return { head: l ? p.join(' ') : (tt || 'Productos destacados'), last: l }; };
  const T = splitTitle(config.title);

  const miniBand = (b: CtaBlock) => b.enabled ? (
    <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 12, background: b.bg ?? 'linear-gradient(135deg,#1b1b22,#0c0c0f)', padding: 14, display: 'grid', gridTemplateColumns: b.image ? '1fr auto' : '1fr', gap: 12, alignItems: 'center' }}>
      <div style={{ display: 'grid', gap: 5, justifyItems: 'start' }}>
        {b.eyebrow ? <span style={{ color: b.accentColor ?? D.amber, fontSize: 8, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase' }}>{b.eyebrow}</span> : null}
        <div style={{ color: b.textColor ?? '#fff', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1.06 }}>{b.title || 'Título'}</div>
        {b.subtitle ? <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, lineHeight: 1.4 }}>{b.subtitle}</div> : null}
        {b.cta ? <span style={{ background: b.accentColor ?? D.amber, color: '#1A1A1B', fontSize: 9, fontWeight: 800, padding: '4px 9px', borderRadius: 6 }}>{b.cta} →</span> : null}
      </div>
      {b.image ? <div style={{ width: 74, height: 54, background: `url(${b.image}) center/cover no-repeat`, borderRadius: 6 }} /> : null}
    </div>
  ) : null;

  const seg = (active: boolean): CSSProperties => ({ border: 'none', cursor: 'pointer', borderRadius: 9, padding: '9px 15px', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', background: active ? D.amber : 'transparent', color: active ? '#0a0a0b' : D.muted2 });

  return (
    <div style={{ fontFamily: FONT, color: D.text }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />

      {/* Barra de acciones */}
      <div style={{ background: '#0c0c0e', border: `1px solid ${D.cardBorder}`, borderRadius: 16, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: D.muted2, fontSize: '12.5px', fontWeight: 600, marginBottom: 5 }}><i className="ph ph-paint-brush-broad" style={{ fontSize: 14 }} /> Diseño del sitio <span style={{ opacity: 0.5 }}>·</span> Productos</div>
          <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em' }}>Sección 3 · Productos</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, padding: '8px 13px', borderRadius: 999, border: `1px solid ${dirty ? 'color-mix(in srgb, var(--color-primary) 40%, transparent)' : 'rgba(255,255,255,0.08)'}`, background: dirty ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'rgba(255,255,255,0.03)', color: dirty ? D.amber : D.muted2 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: dirty ? D.amber : '#3fbf8f' }} />{dirty ? 'Cambios sin publicar' : 'Todo publicado'}</span>
          <button type="button" onClick={discard} disabled={!dirty || busy} style={{ border: `1px solid ${D.inputBorder}`, background: 'transparent', color: dirty ? D.text : D.muted2, borderRadius: 11, padding: '10px 16px', fontWeight: 600, fontSize: 14, cursor: dirty && !busy ? 'pointer' : 'default', opacity: dirty && !busy ? 1 : 0.5, fontFamily: 'inherit' }}>Descartar</button>
          <button type="button" onClick={publish} disabled={busy} style={{ border: 'none', background: D.amber, color: '#0a0a0b', borderRadius: 11, padding: '11px 18px', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}><i className="ph-bold ph-cloud-arrow-up" style={{ fontSize: 17 }} /> {busy ? 'Publicando…' : 'Guardar y publicar'}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 468px', gap: 26, alignItems: 'start' }} className="hero-ed-grid">
        <div style={{ minWidth: 0 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, padding: 5, background: D.tabsBg, border: `1px solid ${D.cardBorder}`, borderRadius: 14, marginBottom: 22, flexWrap: 'wrap' }}>
            {TABS.map((tt) => (
              <button key={tt.id} type="button" onClick={() => setTab(tt.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', cursor: 'pointer', borderRadius: 10, padding: '9px 15px', fontWeight: 700, fontSize: '13.5px', fontFamily: 'inherit', background: tab === tt.id ? D.amber : 'transparent', color: tab === tt.id ? '#0a0a0b' : D.muted2 }}><i className={`ph ${tt.icon}`} style={{ fontSize: 16 }} /> {tt.label}</button>
            ))}
          </div>

          {/* DESTACADOS */}
          {tab === 'destacados' ? (
            <div style={{ animation: 'fadeIn .25s ease' }}>
              <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)', color: D.amber, display: 'grid', placeItems: 'center', flexShrink: 0 }}><i className="ph ph-package" style={{ fontSize: 20 }} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: 14 }}>Los productos salen del catálogo</strong>
                  <p style={{ margin: '3px 0 0', fontSize: 12.5, color: D.muted2 }}>Se muestran los destacados (o los más recientes). Aquí defines textos y estilo de la sección del home.</p>
                </div>
              </div>

              <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
                <h3 style={h3Style}>Textos</h3>
                <Field label="Eyebrow"><input value={config.eyebrow} onChange={(e) => set('eyebrow', e.target.value)} placeholder="Nuestra maquinaria" style={inputStyle} /></Field>
                <Field label="Título (última palabra en acento)"><input value={config.title} onChange={(e) => set('title', e.target.value)} placeholder="Equipo destacado y disponible" style={inputStyle} /></Field>
                <Field label="Subtítulo"><textarea value={config.subtitle} onChange={(e) => set('subtitle', e.target.value)} rows={2} placeholder="Maquinaria certificada…" style={{ ...inputStyle, height: 'auto', padding: '12px 14px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field label="Texto de «Todos»"><input value={config.allLabel} onChange={(e) => set('allLabel', e.target.value)} placeholder="Todos" style={inputStyle} /></Field>
                  <Field label="Enlace «Ver todo»"><input value={config.viewAll} onChange={(e) => set('viewAll', e.target.value)} placeholder="Ver todo el catálogo" style={inputStyle} /></Field>
                </div>
              </div>

              <div style={{ ...cardStyle, display: 'grid', gap: 18 }}>
                <h3 style={h3Style}>Estilo</h3>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div><strong style={{ fontSize: 13.5 }}>Pestañas por categoría</strong><p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>Filtra los productos por giro.</p></div>
                  <Toggle on={f.showTabs} onClick={() => setF('showTabs', !f.showTabs)} />
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <span style={smallLabel}>Alineación del encabezado</span>
                  <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: D.tabsBg, border: `1px solid ${D.cardBorder}`, borderRadius: 11, width: 'fit-content' }}>
                    <button type="button" onClick={() => setF('align', 'left')} style={seg(f.align === 'left')}>Izquierda</button>
                    <button type="button" onClick={() => setF('align', 'center')} style={seg(f.align === 'center')}>Centrado</button>
                  </div>
                </div>
                <Field label={`Productos a mostrar: ${f.limit}`}><input type="range" min={4} max={16} value={f.limit} onChange={(e) => setF('limit', parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: D.amber }} /></Field>
                <ColorField label="Color del eyebrow" value={f.eyebrowColor} onChange={(v) => setF('eyebrowColor', v)} />
                <ColorField label="Color del título" value={f.titleColor} onChange={(v) => setF('titleColor', v)} />
              </div>
            </div>
          ) : null}

          {/* CATÁLOGO */}
          {tab === 'catalogo' ? (
            <div style={{ animation: 'fadeIn .25s ease' }}>
              <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(91,157,255,0.14)', color: '#5b9dff', display: 'grid', placeItems: 'center', flexShrink: 0 }}><i className="ph ph-layout" style={{ fontSize: 20 }} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: 14 }}>Página /productos</strong>
                  <p style={{ margin: '3px 0 0', fontSize: 12.5, color: D.muted2 }}>Tres bandas: un <b>banner</b> arriba, un <b>anuncio</b> en medio y una <b>promo</b> al final. Cada una se prende/apaga.</p>
                </div>
              </div>
              <BlockEditor label="Banner (arriba)" help="Banda grande al inicio del catálogo." icon="ph-flag-banner" block={config.catalog.banner} onChange={(p) => setBlock('banner', p)} />
              <BlockEditor label="Anuncio intermedio" help="Se muestra entre dos grupos de productos." icon="ph-megaphone-simple" block={config.catalog.mid} onChange={(p) => setBlock('mid', p)} />
              <BlockEditor label="Promo (abajo)" help="Banda al final de la página." icon="ph-tag" block={config.catalog.promo} onChange={(p) => setBlock('promo', p)} />
            </div>
          ) : null}
        </div>

        {/* PREVIEW */}
        <div style={{ position: 'sticky', top: 12 }} className="hero-ed-preview">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: D.muted2, marginBottom: 14 }}><span style={{ width: 6, height: 6, borderRadius: 999, background: '#3fbf8f', boxShadow: '0 0 8px #3fbf8f' }} /> Vista previa · {tab === 'catalogo' ? 'catálogo' : 'home'}</div>
          <div style={{ border: `1px solid ${D.inputBorder}`, borderRadius: 18, background: D.previewBg, padding: 18 }}>
            {tab === 'catalogo' ? (
              <>
                {miniBand(config.catalog.banner)}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                  {[0, 1, 2].map((i) => <div key={i} style={{ height: 74, borderRadius: 8, background: 'linear-gradient(160deg,#f6f7f9,#e7e9ee)' }} />)}
                </div>
                {miniBand(config.catalog.mid)}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                  {[0, 1, 2].map((i) => <div key={i} style={{ height: 74, borderRadius: 8, background: 'linear-gradient(160deg,#f6f7f9,#e7e9ee)' }} />)}
                </div>
                {miniBand(config.catalog.promo)}
              </>
            ) : (
              <>
                <div style={{ textAlign: f.align === 'center' ? 'center' : 'left', display: 'grid', justifyItems: f.align === 'center' ? 'center' : 'start', marginBottom: 16 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: eye, fontWeight: 700, fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 6 }}><span style={{ width: 18, height: 3, background: eye }} />{config.eyebrow || 'Eyebrow'}</div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, textTransform: 'uppercase', color: ttl }}>{T.last ? T.head : (config.title || 'Productos destacados')}{T.last ? <> <span style={{ color: D.amber }}>{T.last}</span></> : null}</h3>
                </div>
                {f.showTabs ? (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 14, justifyContent: f.align === 'center' ? 'center' : 'flex-start', flexWrap: 'wrap' }}>
                    {[config.allLabel || 'Todos', 'Excavadora', 'Volteo'].map((tName, i) => (
                      <span key={tName} style={{ fontSize: 9.5, fontWeight: 700, padding: '6px 11px', borderRadius: 8, background: i === 0 ? D.amber : 'transparent', color: i === 0 ? '#0a0a0b' : D.muted2, border: i === 0 ? 'none' : `1px solid ${D.cardBorder}` }}>{tName}</span>
                    ))}
                  </div>
                ) : null}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(f.limit, 4)}, 1fr)`, gap: 8 }}>
                  {Array.from({ length: Math.min(f.limit, 4) }).map((_, i) => (
                    <div key={i} style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${D.cardBorder}` }}>
                      <div style={{ height: 56, background: 'linear-gradient(160deg,#f6f7f9,#e7e9ee)' }} />
                      <div style={{ padding: '7px 8px', display: 'grid', gap: 3 }}>
                        <span style={{ fontSize: 9, color: '#5b9dff', fontWeight: 700 }}>MARCA</span>
                        <span style={{ fontSize: 10, fontWeight: 700 }}>Producto</span>
                        <span style={{ fontSize: 10, fontWeight: 800 }}>$0,000</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {toast ? (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 10, background: toast.ok ? '#16281c' : '#2a1416', border: `1px solid ${toast.ok ? 'rgba(63,191,143,0.4)' : 'rgba(245,80,80,0.4)'}`, color: toast.ok ? '#dff5e8' : '#f8d7d7', padding: '13px 20px', borderRadius: 13, fontSize: 14, fontWeight: 600, boxShadow: '0 16px 40px -16px rgba(0,0,0,0.7)', zIndex: 100 }}>
          <i className={`ph-bold ${toast.ok ? 'ph-check-circle' : 'ph-warning-circle'}`} style={{ fontSize: 19, color: toast.ok ? '#3fbf8f' : '#f55' }} /> {toast.text}
        </div>
      ) : null}
    </div>
  );
}
