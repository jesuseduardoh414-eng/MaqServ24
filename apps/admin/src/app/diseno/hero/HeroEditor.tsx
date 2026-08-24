'use client';

import { useMemo, useState, type ReactNode, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { HeroSettings, ThemeTokens } from '@maqserv/config';

type Copys = Record<string, Record<string, string>>;
interface HeroDto { id?: number; badge: string | null; title: string | null; subtitle: string | null; image: string | null }

interface Config {
  showBadge: boolean; badge: string; title: string; accent: string; subtitle: string; image: string | null;
  primaryLabel: string; primaryLink: string; secondaryLabel: string; secondaryLink: string;
  accentColor: string; titleColor: string; subtitleColor: string;
  primaryBg: string; primaryText: string; secondaryBorder: string;
  overlay: number; showTrust: boolean; showStats: boolean;
  badges: Array<{ t: string; d: string }>; stats: Array<{ n: string; l: string }>;
}

/* ---- Paleta y tipografías EXACTAS del diseño (Editor Hero.dc.html) ---- */
const D = {
  card: '#141416', cardBorder: 'rgba(255,255,255,0.06)',
  inputBg: 'rgba(255,255,255,0.03)', inputBorder: 'rgba(255,255,255,0.08)',
  amber: 'var(--color-primary)', text: '#f5f5f4', muted: '#6b6b72', muted2: '#71717a', muted3: '#8a8a93',
  tabsBg: '#101012', previewBg: '#0e0e12', heroBg: '#0a0a0c',
};
const FONT = "'Inter', system-ui, sans-serif";
const MONO = "'Inter Tight', monospace";

const TABS = [
  { id: 'contenido', label: 'Contenido', icon: 'ph-text-aa' },
  { id: 'botones', label: 'Botones', icon: 'ph-cursor-click' },
  { id: 'estilos', label: 'Estilos', icon: 'ph-paint-brush' },
  { id: 'distintivos', label: 'Distintivos', icon: 'ph-seal-check' },
  { id: 'stats', label: 'Estadísticas', icon: 'ph-chart-bar' },
] as const;

const PRESETS = {
  accentColor: ['var(--color-primary)', '#5b9dff', '#3fbf8f', '#ff7a59', '#b98cff'],
  titleColor: ['#ffffff', '#f5f5f4', 'var(--color-primary)', '#e5e7eb'],
  subtitleColor: ['#c2c6cf', '#9a9aa3', '#e5e7eb', '#ffffff'],
  primaryBg: ['var(--color-primary)', '#5b9dff', '#3fbf8f', '#ff7a59', '#ffffff'],
  primaryText: ['#1a1400', '#ffffff', '#0a0a0b'],
  secondaryBorder: ['#4a4a52', 'var(--color-primary)', '#5b9dff', '#ffffff'],
};
const TRUST_ICONS = ['ph-seal-check', 'ph-shield-check', 'ph-truck', 'ph-headset'];

const cardStyle: CSSProperties = { background: D.card, border: `1px solid ${D.cardBorder}`, borderRadius: 18, padding: 24, marginBottom: 18 };
const inputStyle: CSSProperties = { width: '100%', height: 46, padding: '0 14px', borderRadius: 11, border: `1px solid ${D.inputBorder}`, background: D.inputBg, color: D.text, fontFamily: 'inherit', fontSize: '14.5px', outline: 'none' };
const h3Style: CSSProperties = { margin: 0, fontSize: '15.5px', fontWeight: 700, color: D.text };
const smallLabel: CSSProperties = { fontSize: 12, fontWeight: 600, color: D.muted2 };
const hint: CSSProperties = { margin: '9px 2px 0', fontSize: 12, color: D.muted };

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label style={{ display: 'grid', gap: 7 }}><span style={smallLabel}>{label}</span>{children}</label>;
}
function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} title="Mostrar u ocultar"
      style={{ position: 'relative', width: 44, height: 25, borderRadius: 999, border: 'none', cursor: 'pointer', background: on ? D.amber : 'rgba(255,255,255,0.12)', transition: 'background .15s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 22 : 3, width: 19, height: 19, borderRadius: 999, background: '#fff', transition: 'left .15s' }} />
    </button>
  );
}
function ColorField({ label, hint: h, value, presets, onChange }: { label: string; hint?: string; value: string; presets: string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <span style={smallLabel}>{label}</span>
      {h ? <span style={{ fontSize: 11, color: D.muted, marginTop: -4 }}>{h}</span> : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {presets.map((col) => {
          const sel = col.toLowerCase() === value.toLowerCase();
          return <button key={col} type="button" onClick={() => onChange(col)} title={col}
            style={{ width: 32, height: 32, borderRadius: 9, background: col, cursor: 'pointer', padding: 0, border: sel ? '2px solid #fff' : '2px solid rgba(255,255,255,0.12)', boxShadow: sel ? '0 0 0 3px color-mix(in srgb, var(--color-primary) 50%, transparent)' : 'none' }} />;
        })}
        <label style={{ position: 'relative', width: 32, height: 32, borderRadius: 9, border: '2px dashed rgba(255,255,255,0.2)', display: 'grid', placeItems: 'center', cursor: 'pointer', overflow: 'hidden' }} title="Personalizado">
          <i className="ph ph-eyedropper" style={{ fontSize: 13, color: D.muted2 }} />
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
        </label>
        <code style={{ fontSize: 12, color: D.text, textTransform: 'uppercase', fontFamily: MONO }}>{value}</code>
      </div>
    </div>
  );
}

export function HeroEditor({
  hero, themeId, copys, tokens, heroSettings,
}: { hero: HeroDto | null; themeId: number | null; copys: Copys; tokens: ThemeTokens; heroSettings: HeroSettings }) {
  const router = useRouter();
  const initial: Config = useMemo(() => {
    const es = copys['es'] ?? {};
    return {
      showBadge: heroSettings.showBadge, badge: hero?.badge ?? '', title: hero?.title ?? '',
      accent: es['home.hero.titleAccent'] ?? '', subtitle: hero?.subtitle ?? '', image: hero?.image ?? null,
      primaryLabel: es['home.hero.ctaPrimary'] ?? '', primaryLink: heroSettings.primaryLink,
      secondaryLabel: es['home.hero.ctaSecondary'] ?? '', secondaryLink: heroSettings.secondaryLink,
      accentColor: heroSettings.accentColor, titleColor: heroSettings.titleColor, subtitleColor: heroSettings.subtitleColor,
      primaryBg: heroSettings.primaryBg, primaryText: heroSettings.primaryText, secondaryBorder: heroSettings.secondaryBorder,
      overlay: heroSettings.overlay, showTrust: heroSettings.showTrust, showStats: heroSettings.showStats,
      badges: [1, 2, 3, 4].map((n) => ({ t: es[`home.hero.trust${n}.title`] ?? '', d: es[`home.hero.trust${n}.text`] ?? '' })),
      stats: [1, 2, 3].map((n) => ({ n: es[`home.hero.stat${n}.num`] ?? '', l: es[`home.hero.stat${n}.label`] ?? '' })),
    };
  }, [hero, copys, heroSettings]);

  const [config, setConfig] = useState<Config>(initial);
  const [saved, setSaved] = useState<Config>(initial);
  const [tab, setTab] = useState('contenido');
  const [view, setView] = useState<'full' | 'text' | 'image'>('full');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [imgError, setImgError] = useState(false);

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setConfig((c) => ({ ...c, [k]: v }));
  const setBadgeF = (i: number, f: 't' | 'd', v: string) => setConfig((c) => ({ ...c, badges: c.badges.map((b, j) => (j === i ? { ...b, [f]: v } : b)) }));
  const setStatF = (i: number, f: 'n' | 'l', v: string) => setConfig((c) => ({ ...c, stats: c.stats.map((s, j) => (j === i ? { ...s, [f]: v } : s)) }));
  const dirty = JSON.stringify(config) !== JSON.stringify(saved) || file !== null;

  function takeFile(f: File | null | undefined) {
    if (!f || !f.type.startsWith('image/')) return;
    setFile(f);
    setImgError(false);
    set('image', URL.createObjectURL(f));
  }
  function onImage(e: React.ChangeEvent<HTMLInputElement>) { takeFile(e.target.files?.[0]); e.target.value = ''; }
  function onDrop(e: React.DragEvent) { e.preventDefault(); setDragOver(false); takeFile(e.dataTransfer.files?.[0]); }
  function removeImage() { setFile(null); setImgError(false); set('image', null); }
  const showImage = Boolean(config.image) && !imgError;
  function discard() { setConfig(saved); setFile(null); setToast(null); }

  async function publish() {
    if (busy) return;
    setBusy(true); setToast(null);
    try {
      const fd = new FormData();
      fd.set('badge', config.badge); fd.set('title', config.title); fd.set('subtitle', config.subtitle);
      if (file) fd.set('image', file);
      if (!config.image && !file) fd.set('clearImage', 'true');
      const r1 = await fetch('/api/admin/cms/hero', { method: 'PATCH', body: fd });
      if (!r1.ok) throw new Error('No se pudo guardar el contenido');
      if (themeId) {
        const es = { ...(copys['es'] ?? {}) };
        es['home.hero.titleAccent'] = config.accent;
        es['home.hero.ctaPrimary'] = config.primaryLabel;
        es['home.hero.ctaSecondary'] = config.secondaryLabel;
        config.badges.forEach((b, i) => { es[`home.hero.trust${i + 1}.title`] = b.t; es[`home.hero.trust${i + 1}.text`] = b.d; });
        config.stats.forEach((s, i) => { es[`home.hero.stat${i + 1}.num`] = s.n; es[`home.hero.stat${i + 1}.label`] = s.l; });
        const nextHero: HeroSettings = {
          showBadge: config.showBadge, showTrust: config.showTrust, showStats: config.showStats, overlay: config.overlay,
          primaryLink: config.primaryLink, secondaryLink: config.secondaryLink,
          accentColor: config.accentColor, titleColor: config.titleColor, subtitleColor: config.subtitleColor,
          primaryBg: config.primaryBg, primaryText: config.primaryText, secondaryBorder: config.secondaryBorder,
        };
        const r2 = await fetch(`/api/admin/themes/${themeId}/draft`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tokens: { ...tokens, hero: nextHero }, copys: { ...copys, es } }) });
        if (!r2.ok) throw new Error('No se pudieron guardar los ajustes');
        const r3 = await fetch(`/api/admin/themes/${themeId}/publish`, { method: 'POST' });
        if (!r3.ok) throw new Error('No se pudo publicar');
      }
      setSaved(config); setFile(null);
      setToast({ ok: true, text: 'Hero publicado — el sitio se actualizará al refrescar.' });
      router.refresh();
    } catch (e) {
      setToast({ ok: false, text: (e as Error).message });
    } finally { setBusy(false); }
  }

  return (
    <div style={{ fontFamily: FONT, color: D.text }}>
      {/* Fuentes del diseño (Phosphor ya está cargado en el admin) */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Inter+Tight:wght@500;600;700&display=swap" />

      {/* Barra de acciones */}
      <div style={{ background: '#0c0c0e', border: `1px solid ${D.cardBorder}`, borderRadius: 16, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: D.muted2, fontSize: '12.5px', fontWeight: 600, marginBottom: 5 }}>
            <i className="ph ph-paint-brush-broad" style={{ fontSize: 14 }} /> Diseño del sitio <span style={{ opacity: 0.5 }}>·</span> Home
          </div>
          <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em' }}>Sección 1 · Hero / Portada</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, padding: '8px 13px', borderRadius: 999, border: `1px solid ${dirty ? 'color-mix(in srgb, var(--color-primary) 40%, transparent)' : 'rgba(255,255,255,0.08)'}`, background: dirty ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'rgba(255,255,255,0.03)', color: dirty ? D.amber : D.muted2 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: dirty ? D.amber : '#3fbf8f' }} />{dirty ? 'Cambios sin publicar' : 'Todo publicado'}
          </span>
          <button type="button" onClick={discard} disabled={!dirty || busy} style={{ border: `1px solid ${D.inputBorder}`, background: 'transparent', color: dirty ? D.text : D.muted2, borderRadius: 11, padding: '10px 16px', fontWeight: 600, fontSize: 14, cursor: dirty && !busy ? 'pointer' : 'default', opacity: dirty && !busy ? 1 : 0.5, fontFamily: 'inherit' }}>Descartar</button>
          <button type="button" onClick={publish} disabled={busy} style={{ border: 'none', background: D.amber, color: '#0a0a0b', borderRadius: 11, padding: '11px 18px', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}>
            <i className="ph-bold ph-cloud-arrow-up" style={{ fontSize: 17 }} /> {busy ? 'Publicando…' : 'Guardar y publicar'}
          </button>
        </div>
      </div>

      {/* Editor + preview */}
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 468px', gap: 26, alignItems: 'start' }} className="hero-ed-grid">
          {/* LEFT */}
          <div style={{ minWidth: 0 }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, padding: 5, background: D.tabsBg, border: `1px solid ${D.cardBorder}`, borderRadius: 14, marginBottom: 22, flexWrap: 'wrap' }}>
              {TABS.map((tt) => {
                const active = tab === tt.id;
                return <button key={tt.id} type="button" onClick={() => setTab(tt.id)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', cursor: 'pointer', borderRadius: 10, padding: '9px 15px', fontWeight: 700, fontSize: '13.5px', fontFamily: 'inherit', background: active ? D.amber : 'transparent', color: active ? '#0a0a0b' : D.muted2 }}>
                  <i className={`ph ${tt.icon}`} style={{ fontSize: 16 }} /> {tt.label}
                </button>;
              })}
            </div>

            {/* CONTENIDO */}
            {tab === 'contenido' ? (
              <div style={{ animation: 'fadeIn .25s ease' }}>
                <div style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h3 style={h3Style}>Distintivo / badge</h3>
                    <Toggle on={config.showBadge} onClick={() => set('showBadge', !config.showBadge)} />
                  </div>
                  <input value={config.badge} onChange={(e) => set('badge', e.target.value)} placeholder="Ej. Monterrey y zona metropolitana" style={inputStyle} />
                  <p style={hint}>Pequeña etiqueta sobre el título. Desactívala para ocultarla.</p>
                </div>
                <div style={{ ...cardStyle, display: 'grid', gap: 18 }}>
                  <h3 style={h3Style}>Título y subtítulo</h3>
                  <Field label="Título principal"><input value={config.title} onChange={(e) => set('title', e.target.value)} placeholder="Renta de maquinaria" style={inputStyle} /></Field>
                  <Field label="Línea de acento — se muestra en color de acento"><input value={config.accent} onChange={(e) => set('accent', e.target.value)} placeholder="industrial pesada" style={inputStyle} /></Field>
                  <Field label="Subtítulo"><textarea value={config.subtitle} onChange={(e) => set('subtitle', e.target.value)} rows={3} style={{ ...inputStyle, height: 'auto', padding: '12px 14px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
                </div>
                <div style={cardStyle}>
                  <h3 style={{ ...h3Style, marginBottom: 6 }}>Imagen de portada</h3>
                  <p style={{ ...hint, margin: '0 0 14px' }}>Imagen del producto que va sobre el círculo · PNG transparente recomendado</p>
                  {showImage ? (
                    <div style={{ position: 'relative' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={config.image as string} alt="" onError={() => setImgError(true)} style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 12, border: `1px solid ${D.inputBorder}`, background: '#0a0a0c', display: 'block' }} />
                      <button type="button" onClick={removeImage} style={{ position: 'absolute', top: 12, right: 12, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,.6)', color: '#fff', border: 'none', borderRadius: 9, padding: '7px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><i className="ph ph-trash" /> Quitar</button>
                    </div>
                  ) : (
                    <label
                      onDrop={onDrop}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      style={{ display: 'grid', placeItems: 'center', gap: 9, minHeight: 170, borderRadius: 14, border: `1.5px dashed ${dragOver ? D.amber : D.inputBorder}`, cursor: 'pointer', color: D.muted2, background: dragOver ? 'color-mix(in srgb, var(--color-primary) 6%, transparent)' : D.inputBg, transition: 'border-color .15s, background .15s', textAlign: 'center', padding: 20 }}
                    >
                      <div style={{ width: 52, height: 52, borderRadius: 14, background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', display: 'grid', placeItems: 'center', color: D.amber }}>
                        <i className="ph ph-image" style={{ fontSize: 24 }} />
                      </div>
                      <div style={{ fontSize: 14.5, fontWeight: 600, color: D.text }}>
                        Arrastra una imagen o <span style={{ color: D.amber }}>explora tus archivos</span>
                      </div>
                      <span style={{ fontSize: 11.5, color: D.muted }}>PNG · JPG · WebP</span>
                      {imgError && config.image ? <span style={{ fontSize: 11, color: '#f59e9e' }}>La imagen actual no se pudo cargar — sube una nueva.</span> : null}
                      <input type="file" accept="image/*" onChange={onImage} style={{ display: 'none' }} />
                    </label>
                  )}
                </div>
              </div>
            ) : null}

            {/* BOTONES */}
            {tab === 'botones' ? (
              <div style={{ animation: 'fadeIn .25s ease' }}>
                <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
                  <h3 style={{ ...h3Style, display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ width: 9, height: 9, borderRadius: 999, background: D.amber }} /> Botón principal</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <Field label="Texto"><input value={config.primaryLabel} onChange={(e) => set('primaryLabel', e.target.value)} style={inputStyle} /></Field>
                    <Field label="Enlace"><input value={config.primaryLink} onChange={(e) => set('primaryLink', e.target.value)} placeholder="/productos" style={inputStyle} /></Field>
                  </div>
                  <ColorField label="Color de fondo" value={config.primaryBg} presets={PRESETS.primaryBg} onChange={(v) => set('primaryBg', v)} />
                  <ColorField label="Color del texto" value={config.primaryText} presets={PRESETS.primaryText} onChange={(v) => set('primaryText', v)} />
                </div>
                <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
                  <h3 style={{ ...h3Style, display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ width: 9, height: 9, borderRadius: 999, border: `1px solid ${D.muted2}` }} /> Botón secundario</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <Field label="Texto"><input value={config.secondaryLabel} onChange={(e) => set('secondaryLabel', e.target.value)} style={inputStyle} /></Field>
                    <Field label="Enlace"><input value={config.secondaryLink} onChange={(e) => set('secondaryLink', e.target.value)} placeholder="/cotizar" style={inputStyle} /></Field>
                  </div>
                  <ColorField label="Color del borde" value={config.secondaryBorder} presets={PRESETS.secondaryBorder} onChange={(v) => set('secondaryBorder', v)} />
                </div>
              </div>
            ) : null}

            {/* ESTILOS */}
            {tab === 'estilos' ? (
              <div style={{ animation: 'fadeIn .25s ease' }}>
                <div style={{ ...cardStyle, display: 'grid', gap: 20 }}>
                  <div>
                    <h3 style={h3Style}>Colores del contenido</h3>
                    <p style={{ ...hint, margin: '6px 0 0' }}>El fondo general del sitio es global y se ajusta en <a href="/temas" style={{ color: D.amber }}>Temas y colores</a>.</p>
                  </div>
                  <ColorField label="Color de acento" hint="Línea de acento del título, cifras y detalles" value={config.accentColor} presets={PRESETS.accentColor} onChange={(v) => set('accentColor', v)} />
                  <ColorField label="Color del título" hint="Texto principal del encabezado" value={config.titleColor} presets={PRESETS.titleColor} onChange={(v) => set('titleColor', v)} />
                  <ColorField label="Color del subtítulo" hint="Texto descriptivo bajo el título" value={config.subtitleColor} presets={PRESETS.subtitleColor} onChange={(v) => set('subtitleColor', v)} />
                </div>
                <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <h3 style={h3Style}>Opacidad del círculo de fondo</h3>
                    <span style={{ color: D.amber, fontWeight: 800, fontFamily: MONO }}>{config.overlay}%</span>
                  </div>
                  <p style={{ ...hint, margin: 0 }}>El círculo es un fondo decorativo detrás de la imagen del producto.</p>
                  <input type="range" min={0} max={100} value={config.overlay} onChange={(e) => set('overlay', parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: D.amber }} />
                </div>
              </div>
            ) : null}

            {/* DISTINTIVOS */}
            {tab === 'distintivos' ? (
              <div style={{ ...cardStyle, animation: 'fadeIn .25s ease' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div><h3 style={h3Style}>Distintivos de confianza</h3><p style={{ ...hint, margin: '6px 0 0' }}>Cuatro insignias que refuerzan la confianza bajo el Hero.</p></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 12.5, color: D.muted2 }}>Mostrar</span><Toggle on={config.showTrust} onClick={() => set('showTrust', !config.showTrust)} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, marginTop: 18 }}>
                  {config.badges.map((b, i) => (
                    <div key={i} style={{ display: 'grid', gap: 10, border: `1px solid ${D.cardBorder}`, borderRadius: 14, padding: 14, background: D.inputBg }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: D.muted2 }}><i className={`ph ${TRUST_ICONS[i]}`} style={{ color: D.amber, fontSize: 16 }} /> Distintivo {i + 1}</span>
                      <input value={b.t} onChange={(e) => setBadgeF(i, 't', e.target.value)} placeholder="Título" style={{ ...inputStyle, height: 42 }} />
                      <input value={b.d} onChange={(e) => setBadgeF(i, 'd', e.target.value)} placeholder="Texto" style={{ ...inputStyle, height: 42, color: D.muted3 }} />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* STATS */}
            {tab === 'stats' ? (
              <div style={{ ...cardStyle, animation: 'fadeIn .25s ease' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div><h3 style={h3Style}>Tarjetas de estadística</h3><p style={{ ...hint, margin: '6px 0 0' }}>Cifras destacadas que flotan sobre el Hero.</p></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 12.5, color: D.muted2 }}>Mostrar</span><Toggle on={config.showStats} onClick={() => set('showStats', !config.showStats)} /></div>
                </div>
                <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
                  {config.stats.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ width: 24, color: D.muted2, fontWeight: 700, textAlign: 'center', fontFamily: MONO }}>{i + 1}</span>
                      <input value={s.n} onChange={(e) => setStatF(i, 'n', e.target.value)} placeholder="Número" style={{ width: 130, height: 42, padding: '0 12px', borderRadius: 10, border: `1px solid ${D.inputBorder}`, background: D.inputBg, color: D.amber, fontFamily: MONO, fontSize: 15, fontWeight: 600, outline: 'none' }} />
                      <input value={s.l} onChange={(e) => setStatF(i, 'l', e.target.value)} placeholder="Etiqueta" style={{ ...inputStyle, height: 42, flex: 1, width: 'auto' }} />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* RIGHT: preview */}
          <div style={{ position: 'sticky', top: 12 }} className="hero-ed-preview">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: D.muted2 }}><span style={{ width: 6, height: 6, borderRadius: 999, background: '#3fbf8f', boxShadow: '0 0 8px #3fbf8f' }} /> Vista previa en vivo</div>
              <div style={{ display: 'flex', gap: 3, padding: 3, background: D.tabsBg, border: `1px solid ${D.cardBorder}`, borderRadius: 10 }}>
                {([['full', 'Completo', 'ph-columns'], ['text', 'Texto', 'ph-text-align-left'], ['image', 'Imagen', 'ph-image']] as const).map(([v, lbl, ic]) => (
                  <button key={v} type="button" onClick={() => setView(v)} title={lbl}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', cursor: 'pointer', borderRadius: 8, padding: '6px 10px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', background: view === v ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'transparent', color: view === v ? D.amber : D.muted2 }}>
                    <i className={`ph ${ic}`} style={{ fontSize: 15 }} />{lbl}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ border: `1px solid ${D.inputBorder}`, borderRadius: 18, background: D.previewBg, padding: 14 }}>
              <HeroPreview config={config} view={view} />
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast ? (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 10, background: toast.ok ? '#16281c' : '#2a1416', border: `1px solid ${toast.ok ? 'rgba(63,191,143,0.4)' : 'rgba(245,80,80,0.4)'}`, color: toast.ok ? '#dff5e8' : '#f8d7d7', padding: '13px 20px', borderRadius: 13, fontSize: 14, fontWeight: 600, boxShadow: '0 16px 40px -16px rgba(0,0,0,0.7)', zIndex: 100 }}>
          <i className={`ph-bold ${toast.ok ? 'ph-check-circle' : 'ph-warning-circle'}`} style={{ fontSize: 19, color: toast.ok ? '#3fbf8f' : '#f55' }} /> {toast.text}
        </div>
      ) : null}
    </div>
  );
}

/** Réplica fiel del Hero real (dos columnas, círculo con glow, stats flotantes). */
function HeroPreview({ config: c, view }: { config: Config; view: 'full' | 'text' | 'image' }) {
  const showLeft = view !== 'image';
  const showRight = view !== 'text';
  return (
    <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: D.heroBg, padding: '28px 24px' }}>
      {/* glow */}
      <div aria-hidden style={{ position: 'absolute', right: '-8%', top: '50%', transform: 'translateY(-50%)', width: 260, height: 260, borderRadius: '50%', background: `radial-gradient(circle, ${c.accentColor}, transparent 62%)`, opacity: 0.28 * (c.overlay / 100), filter: 'blur(6px)' }} />
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: view === 'full' ? '1.05fr .95fr' : '1fr', gap: 22, alignItems: 'center' }}>
        {showLeft ? (
          <div style={{ position: 'relative', minWidth: 0 }}>
            {c.showBadge && c.badge ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `color-mix(in srgb, ${c.accentColor} 13%, transparent)`, color: c.accentColor, border: `1px solid color-mix(in srgb, ${c.accentColor} 38%, transparent)`, borderRadius: 999, padding: '5px 11px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.09em', marginBottom: 12 }}>{c.badge}</span>
            ) : null}
            <h2 style={{ margin: 0, fontFamily: FONT, fontWeight: 800, textTransform: 'uppercase', fontSize: view === 'text' ? '2.1rem' : '1.55rem', lineHeight: 1.02, letterSpacing: '-0.01em', color: c.titleColor }}>
              {c.title || 'Título principal'}{c.accent ? <> <span style={{ color: c.accentColor }}>{c.accent}</span></> : null}
            </h2>
            <p style={{ margin: '12px 0 0', fontSize: '.82rem', lineHeight: 1.55, color: c.subtitleColor, maxWidth: 340 }}>{c.subtitle || 'Subtítulo del hero…'}</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
              <span style={{ background: c.primaryBg, color: c.primaryText, borderRadius: 10, padding: '.6em 1.05em', fontSize: '.78rem', fontWeight: 800, display: 'inline-flex', gap: 6, alignItems: 'center' }}>{c.primaryLabel || 'Botón principal'} <i className="ph-bold ph-arrow-right" style={{ fontSize: 13 }} /></span>
              <span style={{ border: `1px solid ${c.secondaryBorder}`, color: '#fff', borderRadius: 10, padding: '.6em 1.05em', fontSize: '.78rem', fontWeight: 700 }}>{c.secondaryLabel || 'Botón secundario'}</span>
            </div>
            {c.showTrust ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 20px', marginTop: 24 }}>
                {c.badges.map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 118 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: `color-mix(in srgb, ${c.accentColor} 12%, transparent)`, color: c.accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><i className={`ph ${TRUST_ICONS[i]}`} style={{ fontSize: 16 }} /></div>
                    <div style={{ minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>{b.t || `Distintivo ${i + 1}`}</div><div style={{ fontSize: 10.5, color: D.muted3, lineHeight: 1.25 }}>{b.d}</div></div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {showRight ? (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 220 }}>
            <div style={{ position: 'relative', width: 220, height: 210, display: 'grid', placeItems: 'center' }}>
              <div aria-hidden style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', background: c.accentColor, opacity: c.overlay / 100, boxShadow: `0 20px 60px -20px ${c.accentColor}` }} />
              {c.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={c.image} src={c.image} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ position: 'relative', zIndex: 1, width: '128%', maxHeight: 210, objectFit: 'contain' }} />
              ) : null}
            </div>
            {c.showStats && c.stats[0]?.n ? (
              <div style={{ position: 'absolute', left: 0, top: 24, background: '#161619', border: `1px solid ${D.cardBorder}`, borderRadius: 12, padding: '11px 14px', boxShadow: '0 12px 30px -14px rgba(0,0,0,.7)' }}>
                <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{c.stats[0].n}</div>
                <div style={{ fontSize: 10.5, color: '#b8bcc4', marginTop: 3 }}>{c.stats[0].l}</div>
              </div>
            ) : null}
            {c.showStats && c.stats[1]?.n ? (
              <div style={{ position: 'absolute', right: 0, bottom: 20, background: '#161619', border: `1px solid ${D.cardBorder}`, borderRadius: 12, padding: '11px 14px', boxShadow: '0 12px 30px -14px rgba(0,0,0,.7)' }}>
                <div style={{ marginBottom: 5, color: c.accentColor, fontSize: 10, letterSpacing: 1 }}>★★★★★</div>
                <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: c.accentColor, lineHeight: 1 }}>{c.stats[1].n}</div>
                <div style={{ fontSize: 10.5, color: '#b8bcc4', marginTop: 2 }}>{c.stats[1].l}</div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
