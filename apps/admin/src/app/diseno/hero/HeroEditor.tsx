'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { HeroSettings, ThemeTokens } from '@maqserv/config';
import { VistaPreviaSitio } from '@/components/VistaPreviaSitio';
import { imagenParaVistaPrevia } from '@/lib/imagen-previa';
import { D, cardStyle, inputStyle, h3Style, smallLabel, Field, Toggle } from '@/components/editor-kit';
import { Btn, PageHeader, Segmented, StatusText, Toast } from '@/components/ui';

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

/* Cromo con el kit del panel (editor-kit): antes este editor traía su propia
   copia de tarjetas, campos e interruptores, con otras medidas y tipografía. */

const TABS = [
  { id: 'contenido', label: 'Contenido' },
  { id: 'botones', label: 'Botones' },
  { id: 'estilos', label: 'Estilos' },
  { id: 'distintivos', label: 'Distintivos' },
  { id: 'stats', label: 'Estadísticas' },
] as const;

/* Colores sugeridos para el SITIO (no son del panel): se quedan tal cual. */
const PRESETS = {
  accentColor: ['var(--color-primary)', '#5b9dff', '#3fbf8f', '#ff7a59', '#b98cff'],
  titleColor: ['#ffffff', '#f5f5f4', 'var(--color-primary)', '#e5e7eb'],
  subtitleColor: ['#c2c6cf', '#9a9aa3', '#e5e7eb', '#ffffff'],
  primaryBg: ['var(--color-primary)', '#5b9dff', '#3fbf8f', '#ff7a59', '#ffffff'],
  primaryText: ['#1a1400', '#ffffff', '#0a0a0b'],
  secondaryBorder: ['#4a4a52', 'var(--color-primary)', '#5b9dff', '#ffffff'],
};
const TRUST_ICONS = ['ph-seal-check', 'ph-shield-check', 'ph-truck', 'ph-headset'];

const hint: CSSProperties = { margin: '8px 0 0', fontSize: 12.5, color: 'var(--adm-muted)' };

function ColorField({ label, hint: h, value, presets, onChange }: { label: string; hint?: string; value: string; presets: string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <span style={smallLabel}>{label}</span>
      {h ? <span style={{ fontSize: 12, color: 'var(--adm-faint)', marginTop: -4 }}>{h}</span> : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {presets.map((col) => {
          const sel = col.toLowerCase() === value.toLowerCase();
          return <button key={col} type="button" onClick={() => onChange(col)} title={col}
            style={{ width: 32, height: 32, borderRadius: 8, background: col, cursor: 'pointer', padding: 0, border: sel ? '2px solid #fff' : '2px solid rgba(255,255,255,0.12)', boxShadow: sel ? '0 0 0 3px color-mix(in srgb, var(--color-primary) 50%, transparent)' : 'none' }} />;
        })}
        <label style={{ position: 'relative', width: 32, height: 32, borderRadius: 8, border: '2px dashed rgba(255,255,255,0.2)', display: 'grid', placeItems: 'center', cursor: 'pointer', overflow: 'hidden' }} title="Personalizado">
          <i className="ph ph-eyedropper" style={{ fontSize: 13, color: 'var(--adm-muted)' }} />
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
        </label>
        <code className="adm-mono" style={{ fontSize: 12, color: 'var(--adm-text-2)', textTransform: 'uppercase' }}>{value}</code>
      </div>
    </div>
  );
}

/** Ajustes del hero en el tema. Los usan «Guardar y publicar» y la vista previa. */
function ajustesHero(c: Config): HeroSettings {
  return {
    showBadge: c.showBadge, showTrust: c.showTrust, showStats: c.showStats, overlay: c.overlay,
    primaryLink: c.primaryLink, secondaryLink: c.secondaryLink,
    accentColor: c.accentColor, titleColor: c.titleColor, subtitleColor: c.subtitleColor,
    primaryBg: c.primaryBg, primaryText: c.primaryText, secondaryBorder: c.secondaryBorder,
  };
}

/** Copys del hero (acento, botones, distintivos y cifras). */
function copysHero(c: Config): Record<string, string> {
  const es: Record<string, string> = {
    'home.hero.titleAccent': c.accent,
    'home.hero.ctaPrimary': c.primaryLabel,
    'home.hero.ctaSecondary': c.secondaryLabel,
  };
  c.badges.forEach((b, i) => { es[`home.hero.trust${i + 1}.title`] = b.t; es[`home.hero.trust${i + 1}.text`] = b.d; });
  c.stats.forEach((s, i) => { es[`home.hero.stat${i + 1}.num`] = s.n; es[`home.hero.stat${i + 1}.label`] = s.l; });
  return es;
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

  // La imagen nueva (aún sin subir) viaja a la vista previa como data URL.
  const [imagenPrevia, setImagenPrevia] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    setImagenPrevia(null);
    if (file) imagenParaVistaPrevia(file).then((u) => { if (vivo) setImagenPrevia(u); });
    return () => { vivo = false; };
  }, [file]);
  const modoTema = tokens.defaultMode === 'light' ? 'light' : 'dark';
  const borrador = useMemo(() => {
    const imagen = file ? imagenPrevia : config.image;
    return {
      tokens: { hero: ajustesHero(config) },
      copys: copysHero(config),
      datos: { hero: { badge: config.badge, title: config.title, subtitle: config.subtitle, image: imagen } },
    };
  }, [config, file, imagenPrevia]);
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
        const es = { ...(copys['es'] ?? {}), ...copysHero(config) };
        const nextHero = ajustesHero(config);
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
    <div>
      <PageHeader
        eyebrow={['Sitio web', 'Secciones del home']}
        title="Sección 1 · Hero / Portada"
        actions={
          <>
            <StatusText tone={dirty ? 'warn' : 'ok'}>{dirty ? 'Cambios sin publicar' : 'Todo publicado'}</StatusText>
            <Btn variant="ghost" onClick={discard} disabled={!dirty || busy}>Descartar</Btn>
            <Btn variant="primary" icon="ph-cloud-arrow-up" onClick={publish} disabled={busy}>{busy ? 'Publicando…' : 'Guardar y publicar'}</Btn>
          </>
        }
      />

      {/* Editor + preview */}
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 468px', gap: 26, alignItems: 'start' }} className="hero-ed-grid">
          {/* LEFT */}
          <div style={{ minWidth: 0 }}>
            {/* Tabs */}
            <div style={{ marginBottom: 18 }}>
              <Segmented
                ariaLabel="Qué editar"
                value={tab}
                onChange={setTab}
                items={TABS.map((tt) => ({ key: tt.id, label: tt.label }))}
              />
            </div>

            {/* CONTENIDO */}
            {tab === 'contenido' ? (
              <div style={{ animation: 'fadeIn .25s ease' }}>
                <div style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={h3Style}>Distintivo / badge</h3>
                    <Toggle title="Mostrar u ocultar" on={config.showBadge} onClick={() => set('showBadge', !config.showBadge)} />
                  </div>
                  <input value={config.badge} onChange={(e) => set('badge', e.target.value)} placeholder="Ej. Monterrey y zona metropolitana" style={inputStyle} />
                  <p style={hint}>Pequeña etiqueta sobre el título. Desactívala para ocultarla.</p>
                </div>
                <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
                  <h3 style={h3Style}>Título y subtítulo</h3>
                  <Field label="Título principal"><input value={config.title} onChange={(e) => set('title', e.target.value)} placeholder="Renta de maquinaria" style={inputStyle} /></Field>
                  <Field label="Línea de acento — se muestra en color de acento"><input value={config.accent} onChange={(e) => set('accent', e.target.value)} placeholder="industrial pesada" style={inputStyle} /></Field>
                  <Field label="Subtítulo"><textarea value={config.subtitle} onChange={(e) => set('subtitle', e.target.value)} rows={3} style={{ ...inputStyle, height: 'auto', padding: '10px 12px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
                </div>
                <div style={cardStyle}>
                  <h3 style={h3Style}>Imagen de portada</h3>
                  <p style={{ ...hint, margin: '3px 0 14px' }}>Imagen del producto que va sobre el círculo · PNG transparente recomendado</p>
                  {showImage ? (
                    <div style={{ position: 'relative' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={config.image as string} alt="" onError={() => setImgError(true)} style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 12, border: '1px solid var(--adm-border-strong)', background: 'var(--adm-page)', display: 'block' }} />
                      <button type="button" onClick={removeImage} style={{ position: 'absolute', top: 12, right: 12, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,.6)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><i className="ph ph-trash" /> Quitar</button>
                    </div>
                  ) : (
                    <label
                      onDrop={onDrop}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      style={{ display: 'grid', placeItems: 'center', gap: 8, minHeight: 170, borderRadius: 12, border: `1.5px dashed ${dragOver ? 'var(--adm-accent)' : 'var(--adm-border-strong)'}`, cursor: 'pointer', color: 'var(--adm-muted)', background: dragOver ? 'color-mix(in srgb, var(--adm-accent) 6%, transparent)' : D.inputBg, transition: 'border-color .15s, background .15s', textAlign: 'center', padding: 20 }}
                    >
                      <i className="ph ph-image" style={{ fontSize: 24, color: 'var(--adm-faint)' }} />
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--adm-text)' }}>
                        Arrastra una imagen o <span style={{ color: 'var(--adm-accent)' }}>explora tus archivos</span>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--adm-faint)' }}>PNG · JPG · WebP</span>
                      {imgError && config.image ? <span style={{ fontSize: 12, color: 'var(--adm-bad)' }}>La imagen actual no se pudo cargar — sube una nueva.</span> : null}
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
                  {/* El punto relleno / con borde distingue el botón principal del secundario, como en el sitio. */}
                  <h3 style={{ ...h3Style, display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ width: 9, height: 9, borderRadius: 999, background: 'var(--adm-accent)' }} /> Botón principal</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <Field label="Texto"><input value={config.primaryLabel} onChange={(e) => set('primaryLabel', e.target.value)} style={inputStyle} /></Field>
                    <Field label="Enlace"><input value={config.primaryLink} onChange={(e) => set('primaryLink', e.target.value)} placeholder="/productos" style={inputStyle} /></Field>
                  </div>
                  <ColorField label="Color de fondo" value={config.primaryBg} presets={PRESETS.primaryBg} onChange={(v) => set('primaryBg', v)} />
                  <ColorField label="Color del texto" value={config.primaryText} presets={PRESETS.primaryText} onChange={(v) => set('primaryText', v)} />
                </div>
                <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
                  <h3 style={{ ...h3Style, display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ width: 9, height: 9, borderRadius: 999, border: '1px solid var(--adm-muted)' }} /> Botón secundario</h3>
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
                    <p style={{ ...hint, margin: '3px 0 0' }}>El fondo general del sitio es global y se ajusta en <a href="/temas" className="adm-link" style={{ textDecoration: 'underline' }}>Temas y colores</a>.</p>
                  </div>
                  <ColorField label="Color de acento" hint="Línea de acento del título, cifras y detalles" value={config.accentColor} presets={PRESETS.accentColor} onChange={(v) => set('accentColor', v)} />
                  <ColorField label="Color del título" hint="Texto principal del encabezado" value={config.titleColor} presets={PRESETS.titleColor} onChange={(v) => set('titleColor', v)} />
                  <ColorField label="Color del subtítulo" hint="Texto descriptivo bajo el título" value={config.subtitleColor} presets={PRESETS.subtitleColor} onChange={(v) => set('subtitleColor', v)} />
                </div>
                <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <h3 style={h3Style}>Opacidad del círculo de fondo</h3>
                    <span className="adm-num" style={{ color: 'var(--adm-text)', fontWeight: 600 }}>{config.overlay}%</span>
                  </div>
                  <p style={{ ...hint, margin: 0 }}>El círculo es un fondo decorativo detrás de la imagen del producto.</p>
                  <input type="range" min={0} max={100} value={config.overlay} onChange={(e) => set('overlay', parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: 'var(--adm-accent)' }} />
                </div>
              </div>
            ) : null}

            {/* DISTINTIVOS */}
            {tab === 'distintivos' ? (
              <div style={{ ...cardStyle, animation: 'fadeIn .25s ease' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div><h3 style={h3Style}>Distintivos de confianza</h3><p style={{ ...hint, margin: '3px 0 0' }}>Cuatro insignias que refuerzan la confianza bajo el Hero.</p></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 12.5, color: 'var(--adm-text-2)' }}>Mostrar</span><Toggle title="Mostrar u ocultar" on={config.showTrust} onClick={() => set('showTrust', !config.showTrust)} /></div>
                </div>
                {/* Cuatro grupos de dos campos en rejilla: el borde fino es lo que dice qué título va con qué texto. */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, marginTop: 18 }}>
                  {config.badges.map((b, i) => (
                    <div key={i} style={{ display: 'grid', gap: 10, border: '1px solid var(--adm-border)', borderRadius: 12, padding: 14 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--adm-faint)' }}><i className={`ph ${TRUST_ICONS[i]}`} style={{ fontSize: 15, color: 'var(--adm-muted)' }} /> Distintivo {i + 1}</span>
                      <input value={b.t} onChange={(e) => setBadgeF(i, 't', e.target.value)} placeholder="Título" style={inputStyle} />
                      <input value={b.d} onChange={(e) => setBadgeF(i, 'd', e.target.value)} placeholder="Texto" style={{ ...inputStyle, color: 'var(--adm-text-2)' }} />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* STATS */}
            {tab === 'stats' ? (
              <div style={{ ...cardStyle, animation: 'fadeIn .25s ease' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div><h3 style={h3Style}>Tarjetas de estadística</h3><p style={{ ...hint, margin: '3px 0 0' }}>Cifras destacadas que flotan sobre el Hero.</p></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 12.5, color: 'var(--adm-text-2)' }}>Mostrar</span><Toggle title="Mostrar u ocultar" on={config.showStats} onClick={() => set('showStats', !config.showStats)} /></div>
                </div>
                <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
                  {config.stats.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className="adm-num" style={{ width: 24, color: 'var(--adm-faint)', fontWeight: 600, textAlign: 'center' }}>{i + 1}</span>
                      <input value={s.n} onChange={(e) => setStatF(i, 'n', e.target.value)} placeholder="Número" className="adm-num" style={{ ...inputStyle, width: 130, fontWeight: 600 }} />
                      <input value={s.l} onChange={(e) => setStatF(i, 'l', e.target.value)} placeholder="Etiqueta" style={{ ...inputStyle, flex: 1, width: 'auto' }} />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* RIGHT: el sitio real pinta el hero con los cambios sin publicar */}
          <div style={{ position: 'sticky', top: 12 }} className="hero-ed-preview">
            <VistaPreviaSitio vista="home.hero" etiqueta="home" borrador={borrador} modoInicial={modoTema} />
          </div>
        </div>
      </div>

      {toast ? <Toast kind={toast.ok ? 'ok' : 'bad'}>{toast.text}</Toast> : null}
    </div>
  );
}
