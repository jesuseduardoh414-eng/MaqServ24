'use client';

import { useMemo, useState, type ReactNode, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CategoriesSettings, CategoriesView, CtaBlock, ThemeTokens } from '@maqserv/config';

type Copys = Record<string, Record<string, string>>;
interface Cat { id: number; name: string; slug: string; image: string | null; productCount: number }

interface Config extends CategoriesSettings {
  eyebrow: string; title: string; unit: string; subtitle: string; viewAll: string;
  view: CategoriesView;
  pageEyebrow: string; pageTitle: string; pageSubtitle: string;
}

const D = {
  card: '#141416', cardBorder: 'rgba(255,255,255,0.06)',
  inputBg: 'rgba(255,255,255,0.03)', inputBorder: 'rgba(255,255,255,0.08)',
  amber: 'var(--color-primary)', text: '#f5f5f4', muted: '#6b6b72', muted2: '#71717a', previewBg: '#0e0e12', tabsBg: '#101012',
};
const FONT = "'Inter', system-ui, sans-serif";
const PANEL = 'linear-gradient(160deg,#f6f7f9,#e7e9ee)';
const PRESETS = ['var(--color-primary)', '#5b9dff', '#3fbf8f', '#ff7a59', '#b98cff', '#ffffff', '#c2c6cf'];

// Defaults defensivos: si el @maqserv/config del admin quedó viejo, `view`/`settings`
// pueden llegar undefined (zod los descarta). Así el editor nunca crashea.
const BLOCK_DEFAULTS: CtaBlock = { enabled: false, eyebrow: '', title: '', subtitle: '', cta: '', ctaLink: '/productos', image: null, bg: null, textColor: null, accentColor: null };
const VIEW_DEFAULTS: CategoriesView = { columns: 3, cardRadius: '8px', imageHeight: 300, eyebrowColor: null, titleColor: null, cardAccentColor: null, featuredSlug: null, hero: { ...BLOCK_DEFAULTS }, promo: { ...BLOCK_DEFAULTS } };
const SETTINGS_DEFAULTS: CategoriesSettings = { show: true, perView: 4, cardRadius: '8px', imageHeight: 260, eyebrowColor: null, titleColor: null, cardAccentColor: null };

const cardStyle: CSSProperties = { background: D.card, border: `1px solid ${D.cardBorder}`, borderRadius: 18, padding: 24, marginBottom: 18 };
const inputStyle: CSSProperties = { width: '100%', height: 46, padding: '0 14px', borderRadius: 11, border: `1px solid ${D.inputBorder}`, background: D.inputBg, color: D.text, fontFamily: 'inherit', fontSize: '14.5px', outline: 'none' };
const h3Style: CSSProperties = { margin: 0, fontSize: '15.5px', fontWeight: 700, color: D.text };
const smallLabel: CSSProperties = { fontSize: 12, fontWeight: 600, color: D.muted2 };

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label style={{ display: 'grid', gap: 7 }}><span style={smallLabel}>{label}</span>{children}</label>;
}
function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} style={{ position: 'relative', width: 44, height: 25, borderRadius: 999, border: 'none', cursor: 'pointer', background: on ? D.amber : 'rgba(255,255,255,0.12)', transition: 'background .15s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 22 : 3, width: 19, height: 19, borderRadius: 999, background: '#fff', transition: 'left .15s' }} />
    </button>
  );
}
function ColorField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  const isTheme = value === null;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <span style={smallLabel}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => onChange(null)} title="Heredar del tema" style={{ height: 32, padding: '0 12px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', background: isTheme ? 'color-mix(in srgb, var(--color-primary) 16%, transparent)' : 'transparent', color: isTheme ? D.amber : D.muted2, border: `2px solid ${isTheme ? D.amber : 'rgba(255,255,255,0.12)'}` }}>Tema</button>
        {PRESETS.map((col) => {
          const sel = !isTheme && col.toLowerCase() === (value ?? '').toLowerCase();
          return <button key={col} type="button" onClick={() => onChange(col)} title={col} style={{ width: 32, height: 32, borderRadius: 9, background: col, cursor: 'pointer', padding: 0, border: sel ? '2px solid #fff' : '2px solid rgba(255,255,255,0.12)', boxShadow: sel ? '0 0 0 3px color-mix(in srgb, var(--color-primary) 50%, transparent)' : 'none' }} />;
        })}
        <label style={{ position: 'relative', width: 32, height: 32, borderRadius: 9, border: '2px dashed rgba(255,255,255,0.2)', display: 'grid', placeItems: 'center', cursor: 'pointer', overflow: 'hidden' }} title="Personalizado">
          <i className="ph ph-eyedropper" style={{ fontSize: 13, color: D.muted2 }} />
          <input type="color" value={value ?? 'var(--color-primary)'} onChange={(e) => onChange(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
        </label>
        <code style={{ fontSize: 12, color: D.text }}>{isTheme ? 'del tema' : value}</code>
      </div>
    </div>
  );
}

const TABS = [
  { id: 'contenido', label: 'Home · Textos', icon: 'ph-text-aa' },
  { id: 'estilos', label: 'Home · Estilos', icon: 'ph-paint-brush' },
  { id: 'vista', label: 'Vista de categorías', icon: 'ph-squares-four' },
] as const;

export function CategoriesEditor({
  themeId, copys, tokens, settings, view, categories,
}: { themeId: number | null; copys: Copys; tokens: ThemeTokens; settings: CategoriesSettings; view: CategoriesView; categories: Cat[] }) {
  const router = useRouter();
  const initial: Config = useMemo(() => {
    const es = copys['es'] ?? {};
    return {
      ...SETTINGS_DEFAULTS, ...(settings ?? {}),
      eyebrow: es['home.categories.eyebrow'] ?? '', title: es['home.categories.title'] ?? '', unit: es['home.categories.unit'] ?? '',
      subtitle: es['home.categories.subtitle'] ?? '', viewAll: es['home.categories.viewAll'] ?? '',
      view: { ...VIEW_DEFAULTS, ...(view ?? {}), hero: { ...BLOCK_DEFAULTS, ...((view ?? {}).hero ?? {}) }, promo: { ...BLOCK_DEFAULTS, ...((view ?? {}).promo ?? {}) } },
      pageEyebrow: es['home.categoriesPage.eyebrow'] ?? '', pageTitle: es['home.categoriesPage.title'] ?? '', pageSubtitle: es['home.categoriesPage.subtitle'] ?? '',
    };
  }, [copys, settings, view]);

  const [config, setConfig] = useState<Config>(initial);
  const [saved, setSaved] = useState<Config>(initial);
  const [tab, setTab] = useState<string>('contenido');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof Config>(k: K, v: Config[K]) => setConfig((c) => ({ ...c, [k]: v }));
  const setV = <K extends keyof CategoriesView>(k: K, v: CategoriesView[K]) => setConfig((c) => ({ ...c, view: { ...VIEW_DEFAULTS, ...(c.view ?? {}), [k]: v } }));
  const setBlock = <K extends keyof CtaBlock>(which: 'hero' | 'promo', k: K, v: CtaBlock[K]) =>
    setConfig((c) => ({ ...c, view: { ...VIEW_DEFAULTS, ...(c.view ?? {}), [which]: { ...BLOCK_DEFAULTS, ...((c.view ?? {})[which] ?? {}), [k]: v } } }));
  const cv: CategoriesView = config.view ?? VIEW_DEFAULTS;
  const [uploading, setUploading] = useState<'hero' | 'promo' | null>(null);
  async function uploadImage(which: 'hero' | 'promo', file: File) {
    if (!file.type.startsWith('image/')) { setToast({ ok: false, text: 'Usa una imagen (PNG, JPG, WebP…)' }); return; }
    setUploading(which); setToast(null);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch('/api/admin/cms/upload', { method: 'POST', body: fd });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.url) throw new Error(d?.message ?? 'No se pudo subir la imagen');
      setBlock(which, 'image', d.url as string);
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); } finally { setUploading(null); }
  }
  const dirty = JSON.stringify(config) !== JSON.stringify(saved);
  const step = categories.length % config.perView === 0 ? config.perView : 1;

  function discard() { setConfig(saved); setToast(null); }
  async function publish() {
    if (busy || !themeId) return;
    setBusy(true); setToast(null);
    try {
      const es = { ...(copys['es'] ?? {}) };
      es['home.categories.eyebrow'] = config.eyebrow; es['home.categories.title'] = config.title; es['home.categories.unit'] = config.unit;
      es['home.categories.subtitle'] = config.subtitle; es['home.categories.viewAll'] = config.viewAll;
      es['home.categoriesPage.eyebrow'] = config.pageEyebrow; es['home.categoriesPage.title'] = config.pageTitle; es['home.categoriesPage.subtitle'] = config.pageSubtitle;
      const nextCat: CategoriesSettings = { show: config.show, perView: config.perView, cardRadius: config.cardRadius, imageHeight: config.imageHeight, eyebrowColor: config.eyebrowColor, titleColor: config.titleColor, cardAccentColor: config.cardAccentColor };
      const r2 = await fetch(`/api/admin/themes/${themeId}/draft`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tokens: { ...tokens, categories: nextCat, categoriesView: cv }, copys: { ...copys, es } }) });
      if (!r2.ok) throw new Error('No se pudieron guardar los ajustes');
      const r3 = await fetch(`/api/admin/themes/${themeId}/publish`, { method: 'POST' });
      if (!r3.ok) throw new Error('No se pudo publicar');
      setSaved(config);
      setToast({ ok: true, text: 'Publicado — el sitio se actualizará al refrescar.' });
      router.refresh();
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  // Colores efectivos para el preview
  const hAccent = config.cardAccentColor ?? D.amber, hEye = config.eyebrowColor ?? '#5b9dff', hTitle = config.titleColor ?? '#f5f5f4';
  const vAccent = cv.cardAccentColor ?? D.amber, vEye = cv.eyebrowColor ?? '#5b9dff', vTitle = cv.titleColor ?? '#f5f5f4';
  const splitTitle = (tt: string) => { const p = (tt || 'Título').trim().split(' '); const l = p.length > 1 ? p.pop() : null; return { head: l ? p.join(' ') : (tt || 'Título'), last: l }; };
  const homeT = splitTitle(config.title), pageT = splitTitle(config.pageTitle);
  const isVista = tab === 'vista';
  const featured = cv.featuredSlug ? categories.find((c) => c.slug === cv.featuredSlug) : null;
  const heroB: CtaBlock = { ...BLOCK_DEFAULTS, ...(cv.hero ?? {}) };
  const promoB: CtaBlock = { ...BLOCK_DEFAULTS, ...(cv.promo ?? {}) };

  const renderBlock = (which: 'hero' | 'promo', label: string, help: string, icon: string) => {
    const b: CtaBlock = which === 'hero' ? heroB : promoB;
    return (
      <div style={{ ...cardStyle, display: 'grid', gap: 15 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)', color: D.amber, display: 'grid', placeItems: 'center', flexShrink: 0 }}><i className={`ph ${icon}`} style={{ fontSize: 19 }} /></div>
            <div style={{ minWidth: 0 }}><h3 style={h3Style}>{label}</h3><p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>{help}</p></div>
          </div>
          <Toggle on={b.enabled} onClick={() => setBlock(which, 'enabled', !b.enabled)} />
        </div>
        {b.enabled ? (
          <div style={{ display: 'grid', gap: 15, animation: 'fadeIn .2s ease' }}>
            <Field label="Eyebrow (línea pequeña arriba)"><input value={b.eyebrow} onChange={(e) => setBlock(which, 'eyebrow', e.target.value)} placeholder="Catálogo de equipos" style={inputStyle} /></Field>
            <Field label="Título"><input value={b.title} onChange={(e) => setBlock(which, 'title', e.target.value)} placeholder="Renta de maquinaria pesada" style={inputStyle} /></Field>
            <Field label="Subtítulo"><textarea value={b.subtitle} onChange={(e) => setBlock(which, 'subtitle', e.target.value)} rows={2} placeholder="Descripción breve…" style={{ ...inputStyle, height: 'auto', padding: '12px 14px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Texto del botón (vacío = sin botón)"><input value={b.cta} onChange={(e) => setBlock(which, 'cta', e.target.value)} placeholder="Ver catálogo" style={inputStyle} /></Field>
              <Field label="Enlace del botón"><input value={b.ctaLink} onChange={(e) => setBlock(which, 'ctaLink', e.target.value)} placeholder="/productos" style={inputStyle} /></Field>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={smallLabel}>Imagen (opcional, se muestra a la derecha)</span>
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) uploadImage(which, f); }}
                style={{ position: 'relative', display: 'grid', placeItems: 'center', minHeight: b.image ? 150 : 108, border: `1.5px dashed ${D.inputBorder}`, borderRadius: 12, background: b.image ? '#0d0d10' : D.inputBg, cursor: 'pointer', overflow: 'hidden', padding: 12 }}
              >
                {b.image ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.image} alt="" style={{ maxHeight: 128, maxWidth: '100%', objectFit: 'contain' }} />
                    <button type="button" onClick={(e) => { e.preventDefault(); setBlock(which, 'image', null); }} style={{ position: 'absolute', top: 8, right: 8, display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><i className="ph ph-trash" /> Quitar</button>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', color: D.muted2, fontSize: 13 }}>
                    <i className="ph ph-image" style={{ fontSize: 22, display: 'block', marginBottom: 6 }} />
                    {uploading === which ? 'Subiendo…' : 'Arrastra una imagen o haz clic'}
                  </div>
                )}
                <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(which, f); e.target.value = ''; }} style={{ display: 'none' }} />
              </label>
            </div>
            <div style={{ display: 'grid', gap: 16 }}>
              <ColorField label="Fondo de la banda" value={b.bg} onChange={(v) => setBlock(which, 'bg', v)} />
              <ColorField label="Color del texto" value={b.textColor} onChange={(v) => setBlock(which, 'textColor', v)} />
              <ColorField label="Acento (botón/detalles)" value={b.accentColor} onChange={(v) => setBlock(which, 'accentColor', v)} />
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const miniBand = (b: CtaBlock) => b.enabled ? (
    <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 14, background: b.bg ?? 'linear-gradient(135deg,#1b1b22,#0c0c0f)', padding: 14, display: 'grid', gridTemplateColumns: b.image ? '1fr auto' : '1fr', gap: 12, alignItems: 'center' }}>
      <div style={{ display: 'grid', gap: 5, justifyItems: 'start' }}>
        {b.eyebrow ? <span style={{ color: b.accentColor ?? vAccent, fontSize: 8, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase' }}>{b.eyebrow}</span> : null}
        <div style={{ color: b.textColor ?? '#fff', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1.06 }}>{b.title || 'Título'}</div>
        {b.subtitle ? <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, lineHeight: 1.4 }}>{b.subtitle}</div> : null}
        {b.cta ? <span style={{ background: b.accentColor ?? vAccent, color: '#1A1A1B', fontSize: 9, fontWeight: 800, padding: '4px 9px', borderRadius: 6 }}>{b.cta} →</span> : null}
      </div>
      {b.image ? <div style={{ width: 72, height: 56, background: `url(${b.image}) center/contain no-repeat` }} /> : null}
    </div>
  ) : null;

  return (
    <div style={{ fontFamily: FONT, color: D.text }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />

      {/* Barra de acciones */}
      <div style={{ background: '#0c0c0e', border: `1px solid ${D.cardBorder}`, borderRadius: 16, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: D.muted2, fontSize: '12.5px', fontWeight: 600, marginBottom: 5 }}><i className="ph ph-paint-brush-broad" style={{ fontSize: 14 }} /> Diseño del sitio <span style={{ opacity: 0.5 }}>·</span> Home + Vista</div>
          <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em' }}>Sección 2 · Categorías</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, padding: '8px 13px', borderRadius: 999, border: `1px solid ${dirty ? 'color-mix(in srgb, var(--color-primary) 40%, transparent)' : 'rgba(255,255,255,0.08)'}`, background: dirty ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'rgba(255,255,255,0.03)', color: dirty ? D.amber : D.muted2 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: dirty ? D.amber : '#3fbf8f' }} />{dirty ? 'Cambios sin publicar' : 'Todo publicado'}</span>
          <button type="button" onClick={discard} disabled={!dirty || busy} style={{ border: `1px solid ${D.inputBorder}`, background: 'transparent', color: dirty ? D.text : D.muted2, borderRadius: 11, padding: '10px 16px', fontWeight: 600, fontSize: 14, cursor: dirty && !busy ? 'pointer' : 'default', opacity: dirty && !busy ? 1 : 0.5, fontFamily: 'inherit' }}>Descartar</button>
          <button type="button" onClick={publish} disabled={busy} style={{ border: 'none', background: D.amber, color: '#0a0a0b', borderRadius: 11, padding: '11px 18px', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}><i className="ph-bold ph-cloud-arrow-up" style={{ fontSize: 17 }} /> {busy ? 'Publicando…' : 'Guardar y publicar'}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 468px', gap: 26, alignItems: 'start' }} className="hero-ed-grid">
        <div style={{ minWidth: 0 }}>
          {/* Nota de contenido */}
          <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(91,157,255,0.14)', color: '#5b9dff', display: 'grid', placeItems: 'center', flexShrink: 0 }}><i className="ph ph-squares-four" style={{ fontSize: 20 }} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ fontSize: 14 }}>El contenido son las categorías de productos</strong>
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: D.muted2 }}>{categories.length} categorías. Nombres e imágenes se administran en el catálogo. Aquí defines los estilos del <b>home</b> y de la <b>vista completa</b>.</p>
            </div>
            <Link href="/categorias" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${D.inputBorder}`, color: D.text, borderRadius: 10, padding: '9px 13px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Administrar <i className="ph ph-arrow-up-right" /></Link>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, padding: 5, background: D.tabsBg, border: `1px solid ${D.cardBorder}`, borderRadius: 14, marginBottom: 22, flexWrap: 'wrap' }}>
            {TABS.map((tt) => (
              <button key={tt.id} type="button" onClick={() => setTab(tt.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', cursor: 'pointer', borderRadius: 10, padding: '9px 15px', fontWeight: 700, fontSize: '13.5px', fontFamily: 'inherit', background: tab === tt.id ? D.amber : 'transparent', color: tab === tt.id ? '#0a0a0b' : D.muted2 }}><i className={`ph ${tt.icon}`} style={{ fontSize: 16 }} /> {tt.label}</button>
            ))}
          </div>

          {/* HOME · TEXTOS */}
          {tab === 'contenido' ? (
            <div style={{ ...cardStyle, display: 'grid', gap: 16, animation: 'fadeIn .25s ease' }}>
              <h3 style={h3Style}>Textos del adelanto en el home</h3>
              <Field label="Eyebrow"><input value={config.eyebrow} onChange={(e) => set('eyebrow', e.target.value)} placeholder="Explora el catálogo" style={inputStyle} /></Field>
              <Field label="Título (última palabra en color de acento)"><input value={config.title} onChange={(e) => set('title', e.target.value)} placeholder="Categorías de equipos" style={inputStyle} /></Field>
              <Field label="Subtítulo"><textarea value={config.subtitle} onChange={(e) => set('subtitle', e.target.value)} rows={2} placeholder="Maquinaria pesada lista para tu obra…" style={{ ...inputStyle, height: 'auto', padding: '12px 14px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Enlace «Ver todas» (vacío = ocultar)"><input value={config.viewAll} onChange={(e) => set('viewAll', e.target.value)} placeholder="Ver todas las categorías" style={inputStyle} /></Field>
                <Field label="Palabra del conteo"><input value={config.unit} onChange={(e) => set('unit', e.target.value)} placeholder="equipos" style={inputStyle} /></Field>
              </div>
            </div>
          ) : null}

          {/* HOME · ESTILOS */}
          {tab === 'estilos' ? (
            <div style={{ animation: 'fadeIn .25s ease' }}>
              <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div><h3 style={h3Style}>Mostrar el adelanto en el home</h3><p style={{ margin: '4px 0 0', fontSize: 12, color: D.muted }}>Ocúltalo si este giro no usa categorías en el home.</p></div>
                <Toggle on={config.show} onClick={() => set('show', !config.show)} />
              </div>
              <div style={{ ...cardStyle, display: 'grid', gap: 18 }}>
                <h3 style={h3Style}>Colores (solo el home)</h3>
                <ColorField label="Color del eyebrow" value={config.eyebrowColor} onChange={(v) => set('eyebrowColor', v)} />
                <ColorField label="Color del título" value={config.titleColor} onChange={(v) => set('titleColor', v)} />
                <ColorField label="Acento (flecha/etiqueta)" value={config.cardAccentColor} onChange={(v) => set('cardAccentColor', v)} />
              </div>
              <div style={{ ...cardStyle, display: 'grid', gap: 18 }}>
                <h3 style={h3Style}>Estilo de tarjeta (home)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field label={`Tarjetas por vista: ${config.perView}`}><input type="range" min={2} max={6} value={config.perView} onChange={(e) => set('perView', parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: D.amber }} /></Field>
                  <Field label={`Alto de imagen: ${config.imageHeight}px`}><input type="range" min={140} max={320} step={10} value={config.imageHeight} onChange={(e) => set('imageHeight', parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: D.amber }} /></Field>
                </div>
                <Field label="Radio de esquinas"><input value={config.cardRadius} onChange={(e) => set('cardRadius', e.target.value)} placeholder="18px" style={{ ...inputStyle, maxWidth: 160 }} /></Field>
                <p style={{ margin: 0, fontSize: 12, color: D.muted }}>Avance del carrusel: {step === config.perView ? `de ${config.perView} en ${config.perView}` : 'de 1 en 1'} (según si el total ({categories.length}) es múltiplo de {config.perView}).</p>
              </div>
            </div>
          ) : null}

          {/* VISTA DE CATEGORÍAS */}
          {tab === 'vista' ? (
            <div style={{ animation: 'fadeIn .25s ease' }}>
              {renderBlock('hero', 'Hero superior', 'Banda grande al inicio de la página (título, botón e imagen).', 'ph-flag-banner')}

              <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
                <h3 style={h3Style}>Textos de la página /categorias</h3>
                <Field label="Eyebrow"><input value={config.pageEyebrow} onChange={(e) => set('pageEyebrow', e.target.value)} placeholder="Catálogo" style={inputStyle} /></Field>
                <Field label="Título (última palabra en acento)"><input value={config.pageTitle} onChange={(e) => set('pageTitle', e.target.value)} placeholder="Todas las categorías" style={inputStyle} /></Field>
                <Field label="Subtítulo"><textarea value={config.pageSubtitle} onChange={(e) => set('pageSubtitle', e.target.value)} rows={2} placeholder="Explora nuestra maquinaria por categoría…" style={{ ...inputStyle, height: 'auto', padding: '12px 14px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
              </div>
              <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
                <h3 style={h3Style}>Categoría destacada</h3>
                <p style={{ margin: 0, fontSize: 12, color: D.muted }}>Se muestra grande arriba de la página. Deja «Ninguna» para solo el grid.</p>
                <select value={cv.featuredSlug ?? ''} onChange={(e) => setV('featuredSlug', e.target.value || null)} style={{ ...inputStyle, maxWidth: 320, appearance: 'auto' as CSSProperties['appearance'], colorScheme: 'dark' }}>
                  <option value="" style={{ background: '#1b1b1e', color: '#f5f5f4' }}>Ninguna</option>
                  {categories.map((c) => <option key={c.id} value={c.slug} style={{ background: '#1b1b1e', color: '#f5f5f4' }}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ ...cardStyle, display: 'grid', gap: 18 }}>
                <h3 style={h3Style}>Colores de la página</h3>
                <ColorField label="Color del eyebrow" value={cv.eyebrowColor} onChange={(v) => setV('eyebrowColor', v)} />
                <ColorField label="Color del título" value={cv.titleColor} onChange={(v) => setV('titleColor', v)} />
                <ColorField label="Acento (etiqueta/destacada)" value={cv.cardAccentColor} onChange={(v) => setV('cardAccentColor', v)} />
              </div>
              <div style={{ ...cardStyle, display: 'grid', gap: 18 }}>
                <h3 style={h3Style}>Estilo del grid</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field label={`Columnas: ${cv.columns}`}><input type="range" min={2} max={5} value={cv.columns} onChange={(e) => setV('columns', parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: D.amber }} /></Field>
                  <Field label={`Alto de imagen: ${cv.imageHeight}px`}><input type="range" min={140} max={360} step={10} value={cv.imageHeight} onChange={(e) => setV('imageHeight', parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: D.amber }} /></Field>
                </div>
                <Field label="Radio de esquinas"><input value={cv.cardRadius} onChange={(e) => setV('cardRadius', e.target.value)} placeholder="18px" style={{ ...inputStyle, maxWidth: 160 }} /></Field>
              </div>

              {renderBlock('promo', 'Anuncio / Promo (abajo)', 'Banda al final de la página, ideal para una llamada a cotizar o destacar algo.', 'ph-megaphone-simple')}
            </div>
          ) : null}
        </div>

        {/* PREVIEW */}
        <div style={{ position: 'sticky', top: 12 }} className="hero-ed-preview">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: D.muted2, marginBottom: 14 }}><span style={{ width: 6, height: 6, borderRadius: 999, background: '#3fbf8f', boxShadow: '0 0 8px #3fbf8f' }} /> Vista previa · {isVista ? 'página /categorias' : 'home'}</div>
          <div style={{ border: `1px solid ${D.inputBorder}`, borderRadius: 18, background: D.previewBg, padding: 18 }}>
            {isVista ? (
              <>
                {miniBand(heroB)}
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: vEye, fontWeight: 700, fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 6 }}><span style={{ width: 18, height: 3, background: vAccent }} />{config.pageEyebrow || 'Catálogo'}</div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, textTransform: 'uppercase', color: vTitle }}>{pageT.last ? pageT.head : (config.pageTitle || 'Todas las categorías')}{pageT.last ? <> <span style={{ color: vAccent }}>{pageT.last}</span></> : null}</h3>
                </div>
                {featured ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1.05fr .95fr', borderRadius: cv.cardRadius, overflow: 'hidden', border: `1px solid ${D.cardBorder}`, marginBottom: 14, background: D.card }}>
                    <div style={{ minHeight: 110, background: featured.image ? `url(${featured.image}) center/contain no-repeat, ${PANEL}` : PANEL }} />
                    <div style={{ padding: 14, display: 'grid', alignContent: 'center', gap: 6 }}>
                      <span style={{ justifySelf: 'start', fontSize: 8.5, fontWeight: 800, color: '#1A1A1B', background: vAccent, padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '.06em' }}>★ Destacada</span>
                      <div style={{ fontSize: 15, fontWeight: 800, color: vTitle, textTransform: 'uppercase', lineHeight: 1.05 }}>{featured.name}</div>
                      <span style={{ justifySelf: 'start', marginTop: 2, fontSize: 9.5, fontWeight: 800, color: '#1A1A1B', background: vAccent, padding: '4px 10px', borderRadius: 7 }}>Ver equipos →</span>
                    </div>
                  </div>
                ) : null}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(cv.columns, 3)}, 1fr)`, gap: 10 }}>
                  {(categories.length ? categories.filter((c) => c.slug !== cv.featuredSlug) : [{ id: 0, name: 'Categoría', slug: '', image: null, productCount: 0 }]).slice(0, Math.min(cv.columns, 3)).map((c) => (
                    <div key={c.id} style={{ borderRadius: cv.cardRadius, overflow: 'hidden', border: `1px solid ${D.cardBorder}`, background: D.card }}>
                      <div style={{ height: Math.max(Math.min(cv.imageHeight, 96), 70), background: c.image ? `url(${c.image}) center/contain no-repeat, ${PANEL}` : PANEL }} />
                      <div style={{ padding: '8px 9px 9px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 10.5, fontWeight: 800, color: vTitle, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                          <div style={{ fontSize: 8.5, color: D.muted2, marginTop: 1 }}>{c.productCount} {config.unit || 'equipos'}</div>
                        </div>
                        <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 999, background: vAccent, color: '#1A1A1B', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 900 }}>↗</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14 }}>{miniBand(promoB)}</div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: hEye, fontWeight: 700, fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 7 }}><span style={{ width: 18, height: 3, background: hAccent }} />{config.eyebrow || 'Eyebrow'}</div>
                    <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, textTransform: 'uppercase', color: hTitle, lineHeight: 1.05 }}>{homeT.last ? homeT.head : (config.title || 'Título')}{homeT.last ? <> <span style={{ color: hAccent }}>{homeT.last}</span></> : null}</h3>
                    {config.subtitle ? <p style={{ margin: '9px 0 0', fontSize: 11.5, color: D.muted2, lineHeight: 1.45 }}>{config.subtitle}</p> : null}
                  </div>
                  {config.viewAll ? <span style={{ flexShrink: 0, color: hTitle, fontWeight: 700, fontSize: 11 }}>{config.viewAll} <span style={{ color: hAccent }}>↗</span></span> : null}
                </div>
                <div style={{ display: 'flex', gap: 14, overflow: 'hidden' }}>
                  {(categories.length ? categories : [{ id: 0, name: 'Categoría', slug: '', image: null, productCount: 0 }]).slice(0, Math.min(config.perView, 4)).map((c) => (
                    <div key={c.id} style={{ position: 'relative', flex: '1 1 0', minWidth: 0, height: Math.min(config.imageHeight, 150), borderRadius: config.cardRadius, overflow: 'hidden', border: `1px solid ${D.cardBorder}`, background: c.image ? `center/cover no-repeat url(${c.image})` : 'repeating-linear-gradient(135deg,#1e1e22 0 12px,#161619 12px 24px)' }}>
                      <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(6,6,8,.9) 2%, rgba(6,6,8,.32) 44%, rgba(6,6,8,0) 72%)' }} />
                      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '9px 9px 8px', display: 'grid', gap: 3 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.1 }}>{c.name}</span>
                        <span style={{ fontSize: 8.5, fontWeight: 700, color: hAccent }}>{c.productCount} {config.unit || 'equipos'}</span>
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
