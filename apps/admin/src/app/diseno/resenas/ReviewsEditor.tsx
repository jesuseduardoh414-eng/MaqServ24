'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Reviews, ThemeTokens } from '@maqserv/config';
import { VistaPreviaSitio } from '@/components/VistaPreviaSitio';
import { D, FONT, cardStyle, inputStyle, h3Style, Field, Toggle, ColorField } from '@/components/editor-kit';

type Copys = Record<string, Record<string, string>>;
interface Sample { id: number; author: string; rating: number; review: string }
const REV_DEFAULTS: Reviews = { show: true, limit: 8, eyebrowColor: null, titleColor: null, accentColor: null };
const cv = (es: Record<string, string>, k: string, def = '') => es[k] ?? def;

interface Config { eyebrow: string; title: string; role: string; rev: Reviews }

export function ReviewsEditor({ themeId, copys, tokens, reviewsCfg, approvedCount, totalCount }: {
  themeId: number | null; copys: Copys; tokens: ThemeTokens; reviewsCfg: Reviews; approvedCount: number; totalCount: number; sample: Sample[];
}) {
  const router = useRouter();
  const initial: Config = useMemo(() => {
    const es = copys['es'] ?? {};
    return {
      eyebrow: cv(es, 'home.reviews.eyebrow', 'Opiniones verificadas'),
      title: cv(es, 'home.reviews.title', 'Lo que dicen nuestros clientes'),
      role: cv(es, 'home.reviews.role', 'Cliente verificado'),
      rev: { ...REV_DEFAULTS, ...(reviewsCfg ?? {}) },
    };
  }, [copys, reviewsCfg]);

  const [config, setConfig] = useState<Config>(initial);
  const [saved, setSaved] = useState<Config>(initial);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setConfig((c) => ({ ...c, [k]: v }));
  const setR = <K extends keyof Reviews>(k: K, v: Reviews[K]) => setConfig((c) => ({ ...c, rev: { ...c.rev, [k]: v } }));
  const r = config.rev;
  const dirty = JSON.stringify(config) !== JSON.stringify(saved);
  const modoTema = tokens.defaultMode === 'light' ? 'light' : 'dark';
  // Lo que la vista previa le manda al sitio: lo MISMO que se publicaría.
  const borrador = useMemo(() => ({ tokens: { reviews: config.rev }, copys: { 'home.reviews.eyebrow': config.eyebrow, 'home.reviews.title': config.title, 'home.reviews.role': config.role } }), [config]);



  function discard() { setConfig(saved); setToast(null); }
  async function publish() {
    if (busy || !themeId) return;
    setBusy(true); setToast(null);
    try {
      const es = { ...(copys['es'] ?? {}) };
      es['home.reviews.eyebrow'] = config.eyebrow;
      es['home.reviews.title'] = config.title;
      es['home.reviews.role'] = config.role;
      const body = { tokens: { ...tokens, reviews: config.rev }, copys: { ...copys, es } };
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: D.muted2, fontSize: '12.5px', fontWeight: 600, marginBottom: 5 }}><i className="ph ph-paint-brush-broad" style={{ fontSize: 14 }} /> Diseño del sitio <span style={{ opacity: 0.5 }}>·</span> Reseñas</div>
          <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em' }}>Sección 7 · Reseñas</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, padding: '8px 13px', borderRadius: 999, border: `1px solid ${dirty ? 'color-mix(in srgb, var(--color-primary) 40%, transparent)' : 'rgba(255,255,255,0.08)'}`, background: dirty ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'rgba(255,255,255,0.03)', color: dirty ? D.amber : D.muted2 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: dirty ? D.amber : '#3fbf8f' }} />{dirty ? 'Cambios sin publicar' : 'Todo publicado'}</span>
          <button type="button" onClick={discard} disabled={!dirty || busy} style={{ border: `1px solid ${D.inputBorder}`, background: 'transparent', color: dirty ? D.text : D.muted2, borderRadius: 11, padding: '10px 16px', fontWeight: 600, fontSize: 14, cursor: dirty && !busy ? 'pointer' : 'default', opacity: dirty && !busy ? 1 : 0.5, fontFamily: 'inherit' }}>Descartar</button>
          <button type="button" onClick={publish} disabled={busy} style={{ border: 'none', background: D.amber, color: '#0a0a0b', borderRadius: 11, padding: '11px 18px', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}><i className="ph-bold ph-cloud-arrow-up" style={{ fontSize: 17 }} /> {busy ? 'Publicando…' : 'Guardar y publicar'}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 468px', gap: 26, alignItems: 'start' }} className="hero-ed-grid">
        <div style={{ minWidth: 0 }}>
          {/* Nota: el contenido son reseñas de clientes; se moderan aparte */}
          <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)', color: D.amber, display: 'grid', placeItems: 'center', flexShrink: 0 }}><i className="ph ph-star" style={{ fontSize: 20 }} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ fontSize: 14 }}>La banda «Lo que dicen nuestros clientes»</strong>
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: D.muted2 }}>Las <b>reseñas</b> las escriben los clientes; tú las <b>apruebas/ocultas</b> en Clientes → Reseñas. Aquí defines los textos y el estilo de la banda. <b>{approvedCount}</b> aprobadas de <b>{totalCount}</b>.</p>
            </div>
            <a href="/resenas" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 7, border: `1px solid ${D.inputBorder}`, background: 'rgba(255,255,255,0.03)', color: D.text, borderRadius: 11, padding: '9px 14px', fontWeight: 700, fontSize: 13, textDecoration: 'none', fontFamily: 'inherit', whiteSpace: 'nowrap' }}><i className="ph ph-list-checks" style={{ fontSize: 16, color: D.amber }} /> Moderar reseñas</a>
          </div>

          <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div><strong style={{ fontSize: 13.5 }}>Mostrar la sección en el home</strong><p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>Apágala para ocultarla temporalmente.</p></div>
            <Toggle on={r.show} onClick={() => setR('show', !r.show)} />
          </div>

          <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
            <h3 style={h3Style}>Textos</h3>
            <Field label="Eyebrow (línea pequeña arriba)"><input value={config.eyebrow} onChange={(e) => set('eyebrow', e.target.value)} placeholder="Opiniones verificadas" style={inputStyle} /></Field>
            <Field label="Título"><input value={config.title} onChange={(e) => set('title', e.target.value)} placeholder="Lo que dicen nuestros clientes" style={inputStyle} /></Field>
            <Field label="Etiqueta bajo cada nombre"><input value={config.role} onChange={(e) => set('role', e.target.value)} placeholder="Cliente verificado" style={inputStyle} /></Field>
          </div>

          <div style={{ ...cardStyle, display: 'grid', gap: 18 }}>
            <h3 style={h3Style}>Estilo</h3>
            <Field label={`Reseñas a mostrar: ${r.limit}`}><input type="range" min={3} max={20} value={r.limit} onChange={(e) => setR('limit', parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: D.amber }} /></Field>
            <ColorField label="Color del eyebrow" value={r.eyebrowColor} onChange={(v) => setR('eyebrowColor', v)} />
            <ColorField label="Color del título" value={r.titleColor} onChange={(v) => setR('titleColor', v)} />
            <ColorField label="Acento (estrellas y comillas)" value={r.accentColor} onChange={(v) => setR('accentColor', v)} />
          </div>
        </div>

        {/* VISTA PREVIA: el sitio real pinta la sección con los cambios sin publicar. */}
        <div style={{ position: 'sticky', top: 12 }} className="hero-ed-preview">
          <VistaPreviaSitio vista="home.reviews" etiqueta="home" borrador={borrador} modoInicial={modoTema} aviso={!r.show ? <><i className="ph ph-eye-slash" /> La sección está oculta en el home.</> : approvedCount === 0 ? <>No hay reseñas aprobadas aún: la sección no sale hasta que apruebes al menos una.</> : null} />
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
