'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Offer, ThemeTokens } from '@maqserv/config';
import { VistaPreviaSitio } from '@/components/VistaPreviaSitio';
import { D, FONT, cardStyle, inputStyle, h3Style, Field, Toggle, ColorField } from '@/components/editor-kit';

type Copys = Record<string, Record<string, string>>;
const OFFER_DEFAULTS: Offer = { show: true, image: null, ctaLink: '/productos', bg: null, accentColor: null, titleColor: null };
const cv = (es: Record<string, string>, k: string, def = '') => es[k] ?? def;

interface Config { badge: string; title: string; subtitle: string; cta: string; off: Offer }

export function OfferEditor({ themeId, copys, tokens, offer }: {
  themeId: number | null; copys: Copys; tokens: ThemeTokens; offer: Offer;
}) {
  const router = useRouter();
  const initial: Config = useMemo(() => {
    const es = copys['es'] ?? {};
    return {
      badge: cv(es, 'home.offer.badge', 'Oferta de temporada'),
      title: cv(es, 'home.offer.title', 'Renta 3 meses y el 4.º con 50% de descuento'),
      subtitle: cv(es, 'home.offer.subtitle', ''),
      cta: cv(es, 'home.offer.cta', 'Ver la oferta'),
      off: { ...OFFER_DEFAULTS, ...(offer ?? {}) },
    };
  }, [copys, offer]);

  const [config, setConfig] = useState<Config>(initial);
  const [saved, setSaved] = useState<Config>(initial);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setConfig((c) => ({ ...c, [k]: v }));
  const setO = <K extends keyof Offer>(k: K, v: Offer[K]) => setConfig((c) => ({ ...c, off: { ...c.off, [k]: v } }));
  const o = config.off;
  const dirty = JSON.stringify(config) !== JSON.stringify(saved);
  const modoTema = tokens.defaultMode === 'light' ? 'light' : 'dark';
  // Lo que la vista previa le manda al sitio: lo MISMO que se publicaría.
  const borrador = useMemo(() => ({ tokens: { offer: config.off }, copys: { 'home.offer.badge': config.badge, 'home.offer.title': config.title, 'home.offer.subtitle': config.subtitle, 'home.offer.cta': config.cta } }), [config]);


  async function upload(file: File) {
    if (!file.type.startsWith('image/')) { setToast({ ok: false, text: 'Usa una imagen (PNG, JPG, WebP…)' }); return; }
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch('/api/admin/cms/upload', { method: 'POST', body: fd });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.url) throw new Error(d?.message ?? 'No se pudo subir la imagen');
      setO('image', d.url as string);
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); } finally { setUploading(false); }
  }

  function discard() { setConfig(saved); setToast(null); }
  async function publish() {
    if (busy || !themeId) return;
    setBusy(true); setToast(null);
    try {
      const es = { ...(copys['es'] ?? {}) };
      es['home.offer.badge'] = config.badge;
      es['home.offer.title'] = config.title;
      es['home.offer.subtitle'] = config.subtitle;
      es['home.offer.cta'] = config.cta;
      const body = { tokens: { ...tokens, offer: config.off }, copys: { ...copys, es } };
      const r2 = await fetch(`/api/admin/themes/${themeId}/draft`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r2.ok) throw new Error('No se pudieron guardar los ajustes');
      const r3 = await fetch(`/api/admin/themes/${themeId}/publish`, { method: 'POST' });
      if (!r3.ok) throw new Error('No se pudo publicar');
      setSaved(config);
      setToast({ ok: true, text: 'Publicado — el sitio se actualizará al refrescar.' });
      router.refresh();
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  return (
    <div style={{ fontFamily: FONT, color: D.text }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />

      <div style={{ background: '#0c0c0e', border: `1px solid ${D.cardBorder}`, borderRadius: 16, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: D.muted2, fontSize: '12.5px', fontWeight: 600, marginBottom: 5 }}><i className="ph ph-paint-brush-broad" style={{ fontSize: 14 }} /> Diseño del sitio <span style={{ opacity: 0.5 }}>·</span> Oferta</div>
          <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em' }}>Sección 6 · Oferta / Promoción</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, padding: '8px 13px', borderRadius: 999, border: `1px solid ${dirty ? 'color-mix(in srgb, var(--color-primary) 40%, transparent)' : 'rgba(255,255,255,0.08)'}`, background: dirty ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'rgba(255,255,255,0.03)', color: dirty ? D.amber : D.muted2 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: dirty ? D.amber : '#3fbf8f' }} />{dirty ? 'Cambios sin publicar' : 'Todo publicado'}</span>
          <button type="button" onClick={discard} disabled={!dirty || busy} style={{ border: `1px solid ${D.inputBorder}`, background: 'transparent', color: dirty ? D.text : D.muted2, borderRadius: 11, padding: '10px 16px', fontWeight: 600, fontSize: 14, cursor: dirty && !busy ? 'pointer' : 'default', opacity: dirty && !busy ? 1 : 0.5, fontFamily: 'inherit' }}>Descartar</button>
          <button type="button" onClick={publish} disabled={busy} style={{ border: 'none', background: D.amber, color: '#0a0a0b', borderRadius: 11, padding: '11px 18px', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}><i className="ph-bold ph-cloud-arrow-up" style={{ fontSize: 17 }} /> {busy ? 'Publicando…' : 'Guardar y publicar'}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 468px', gap: 26, alignItems: 'start' }} className="hero-ed-grid">
        <div style={{ minWidth: 0 }}>
          <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)', color: D.amber, display: 'grid', placeItems: 'center', flexShrink: 0 }}><i className="ph ph-tag" style={{ fontSize: 20 }} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ fontSize: 14 }}>La banda de oferta del home</strong>
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: D.muted2 }}>Banda destacada para promociones o anuncios. Aquí defines los textos, la imagen, el enlace y los colores.</p>
            </div>
          </div>

          <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div><strong style={{ fontSize: 13.5 }}>Mostrar la oferta en el home</strong><p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>Apágala para ocultarla temporalmente.</p></div>
            <Toggle on={o.show} onClick={() => setO('show', !o.show)} />
          </div>

          <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
            <h3 style={h3Style}>Textos</h3>
            <Field label="Badge (etiqueta pequeña)"><input value={config.badge} onChange={(e) => set('badge', e.target.value)} placeholder="Oferta de temporada" style={inputStyle} /></Field>
            <Field label="Título"><input value={config.title} onChange={(e) => set('title', e.target.value)} placeholder="Renta 3 meses y el 4.º con 50%…" style={inputStyle} /></Field>
            <Field label="Subtítulo"><textarea value={config.subtitle} onChange={(e) => set('subtitle', e.target.value)} rows={2} placeholder="Aplica en equipo seleccionado…" style={{ ...inputStyle, height: 'auto', padding: '12px 14px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Texto del botón"><input value={config.cta} onChange={(e) => set('cta', e.target.value)} placeholder="Ver la oferta" style={inputStyle} /></Field>
              <Field label="Enlace del botón"><input value={o.ctaLink} onChange={(e) => setO('ctaLink', e.target.value)} placeholder="/productos" style={inputStyle} /></Field>
            </div>
          </div>

          <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
            <div><h3 style={h3Style}>Imagen</h3><p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>El visual del lado derecho. Vacío ⇒ se muestra un patrón decorativo.</p></div>
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
              style={{ position: 'relative', display: 'grid', placeItems: 'center', minHeight: o.image ? 170 : 120, border: `1.5px dashed ${D.inputBorder}`, borderRadius: 12, background: o.image ? '#0d0d10' : D.inputBg, cursor: 'pointer', overflow: 'hidden', padding: 12 }}
            >
              {o.image ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={o.image} alt="" style={{ maxHeight: 148, maxWidth: '100%', objectFit: 'contain', borderRadius: 8 }} />
                  <button type="button" onClick={(e) => { e.preventDefault(); setO('image', null); }} style={{ position: 'absolute', top: 8, right: 8, display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><i className="ph ph-trash" /> Quitar</button>
                </>
              ) : (
                <div style={{ textAlign: 'center', color: D.muted2, fontSize: 13 }}>
                  <i className="ph ph-image" style={{ fontSize: 22, display: 'block', marginBottom: 6 }} />
                  {uploading ? 'Subiendo…' : 'Arrastra una imagen o haz clic'}
                </div>
              )}
              <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} style={{ display: 'none' }} />
            </label>
          </div>

          <div style={{ ...cardStyle, display: 'grid', gap: 18 }}>
            <h3 style={h3Style}>Colores</h3>
            <ColorField label="Fondo de la banda" value={o.bg} onChange={(v) => setO('bg', v)} />
            <ColorField label="Acento (badge y botón)" value={o.accentColor} onChange={(v) => setO('accentColor', v)} />
            <ColorField label="Color del título" value={o.titleColor} onChange={(v) => setO('titleColor', v)} />
          </div>
        </div>

        {/* VISTA PREVIA: el sitio real pinta la sección con los cambios sin publicar. */}
        <div style={{ position: 'sticky', top: 12 }} className="hero-ed-preview">
          <VistaPreviaSitio vista="home.offer" etiqueta="home" borrador={borrador} modoInicial={modoTema} aviso={!o.show ? <><i className="ph ph-eye-slash" /> La oferta está oculta en el home.</> : null} />
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
