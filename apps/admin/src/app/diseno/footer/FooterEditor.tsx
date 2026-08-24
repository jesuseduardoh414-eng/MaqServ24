'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Footer, ThemeTokens } from '@maqserv/config';
import { D, FONT, cardStyle, inputStyle, h3Style, Field, Toggle } from '@/components/editor-kit';

type Copys = Record<string, Record<string, string>>;

const iconBtn: React.CSSProperties = { border: `1px solid ${D.inputBorder}`, background: 'rgba(255,255,255,0.03)', color: D.muted2, borderRadius: 9, width: 32, height: 32, cursor: 'pointer', display: 'inline-grid', placeItems: 'center', flexShrink: 0, fontFamily: 'inherit' };
const addBtn: React.CSSProperties = { border: `1px dashed ${D.inputBorder}`, background: 'transparent', color: D.amber, borderRadius: 10, padding: '9px 13px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 };

export function FooterEditor({ themeId, copys, tokens, footer, brand }: {
  themeId: number | null; copys: Copys; tokens: ThemeTokens; footer: Footer; brand: string;
}) {
  const router = useRouter();
  const [config, setConfig] = useState<Footer>(footer);
  const [saved, setSaved] = useState<Footer>(footer);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = JSON.stringify(config) !== JSON.stringify(saved);
  const setF = (patch: Partial<Footer>) => setConfig((c) => ({ ...c, ...patch }));

  // Helpers de columnas
  const updCol = (i: number, patch: Partial<Footer['columns'][number]>) => setF({ columns: config.columns.map((c, j) => j === i ? { ...c, ...patch } : c) });
  const updLink = (ci: number, li: number, patch: Partial<Footer['columns'][number]['links'][number]>) =>
    updCol(ci, { links: config.columns[ci].links.map((l, j) => j === li ? { ...l, ...patch } : l) });

  function discard() { setConfig(saved); setToast(null); }
  async function publish() {
    if (busy || !themeId) return;
    setBusy(true); setToast(null);
    try {
      const body = { tokens: { ...tokens, footer: config }, copys };
      const r2 = await fetch(`/api/admin/themes/${themeId}/draft`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r2.ok) throw new Error('No se pudieron guardar los cambios');
      const r3 = await fetch(`/api/admin/themes/${themeId}/publish`, { method: 'POST' });
      if (!r3.ok) throw new Error('No se pudo publicar');
      setSaved(config);
      setToast({ ok: true, text: 'Publicado — se verá al refrescar el sitio.' });
      router.refresh();
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  const year = new Date().getFullYear();
  const copyPreview = config.copyright.trim() || `© ${year} ${brand}. Todos los derechos reservados.`;

  return (
    <div style={{ fontFamily: FONT, color: D.text }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />

      <div style={{ background: '#0c0c0e', border: `1px solid ${D.cardBorder}`, borderRadius: 16, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: D.muted2, fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}><i className="ph ph-layout" style={{ fontSize: 14 }} /> Diseño del sitio <span style={{ opacity: 0.5 }}>·</span> Footer</div>
          <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em' }}>Pie de página</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, padding: '8px 13px', borderRadius: 999, border: `1px solid ${dirty ? 'color-mix(in srgb, var(--color-primary) 40%, transparent)' : 'rgba(255,255,255,0.08)'}`, background: dirty ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'rgba(255,255,255,0.03)', color: dirty ? D.amber : D.muted2 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: dirty ? D.amber : '#3fbf8f' }} />{dirty ? 'Cambios sin publicar' : 'Todo publicado'}</span>
          <button type="button" onClick={discard} disabled={!dirty || busy} style={{ border: `1px solid ${D.inputBorder}`, background: 'transparent', color: dirty ? D.text : D.muted2, borderRadius: 11, padding: '10px 16px', fontWeight: 600, fontSize: 14, cursor: dirty && !busy ? 'pointer' : 'default', opacity: dirty && !busy ? 1 : 0.5, fontFamily: 'inherit' }}>Descartar</button>
          <button type="button" onClick={publish} disabled={busy || !dirty} style={{ border: 'none', background: D.amber, color: '#0a0a0b', borderRadius: 11, padding: '11px 18px', fontWeight: 800, fontSize: 14, cursor: busy || !dirty ? 'default' : 'pointer', opacity: busy || !dirty ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}><i className="ph-bold ph-cloud-arrow-up" style={{ fontSize: 17 }} /> {busy ? 'Publicando…' : 'Guardar y publicar'}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 380px', gap: 24, alignItems: 'start' }} className="ftr-ed-grid">
        <div style={{ display: 'grid', gap: 18 }}>
          {/* Boletín */}
          <div style={{ ...cardStyle, display: 'grid', gap: 16, marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div><h3 style={h3Style}>Boletín (novedades)</h3><p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>La caja de suscripción arriba del pie.</p></div>
              <Toggle on={config.showNewsletter} onClick={() => setF({ showNewsletter: !config.showNewsletter })} />
            </div>
            {config.showNewsletter ? (
              <>
                <Field label="Título"><input value={config.newsletterTitle} onChange={(e) => setF({ newsletterTitle: e.target.value })} style={inputStyle} placeholder="Recibe nuestras novedades" /></Field>
                <Field label="Subtítulo"><textarea value={config.newsletterSubtitle} onChange={(e) => setF({ newsletterSubtitle: e.target.value })} rows={2} style={{ ...inputStyle, height: 'auto', padding: '12px 14px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
              </>
            ) : null}
          </div>

          {/* Descripción */}
          <div style={{ ...cardStyle, display: 'grid', gap: 12, marginBottom: 0 }}>
            <h3 style={h3Style}>Descripción de la marca</h3>
            <textarea value={config.tagline} onChange={(e) => setF({ tagline: e.target.value })} rows={3} style={{ ...inputStyle, height: 'auto', padding: '12px 14px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Renta de maquinaria pesada…" />
          </div>

          {/* Columnas */}
          <div style={{ ...cardStyle, display: 'grid', gap: 16, marginBottom: 0 }}>
            <div><h3 style={h3Style}>Columnas de enlaces</h3><p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>Cada columna tiene un título y una lista de enlaces (texto + destino).</p></div>
            {config.columns.map((col, ci) => (
              <div key={ci} style={{ border: `1px solid ${D.inputBorder}`, borderRadius: 12, padding: 14, display: 'grid', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
                  <input value={col.title} onChange={(e) => updCol(ci, { title: e.target.value })} style={{ ...inputStyle, height: 42, fontWeight: 700 }} placeholder="Título de la columna" />
                  <button type="button" onClick={() => setF({ columns: config.columns.filter((_, j) => j !== ci) })} style={iconBtn} title="Quitar columna"><i className="ph ph-trash" /></button>
                </div>
                {col.links.map((l, li) => (
                  <div key={li} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                    <input value={l.label} onChange={(e) => updLink(ci, li, { label: e.target.value })} style={{ ...inputStyle, height: 38 }} placeholder="Texto" />
                    <input value={l.href} onChange={(e) => updLink(ci, li, { href: e.target.value })} style={{ ...inputStyle, height: 38 }} placeholder="/destino" />
                    <button type="button" onClick={() => updCol(ci, { links: col.links.filter((_, j) => j !== li) })} style={iconBtn} title="Quitar enlace"><i className="ph ph-x" /></button>
                  </div>
                ))}
                <div><button type="button" onClick={() => updCol(ci, { links: [...col.links, { label: '', href: '/' }] })} style={addBtn}><i className="ph ph-plus" /> Enlace</button></div>
              </div>
            ))}
            <div><button type="button" onClick={() => setF({ columns: [...config.columns, { title: '', links: [] }] })} style={addBtn}><i className="ph ph-plus" /> Agregar columna</button></div>
          </div>

          {/* Redes */}
          <div style={{ ...cardStyle, display: 'grid', gap: 14, marginBottom: 0 }}>
            <div><h3 style={h3Style}>Redes sociales</h3><p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>Etiqueta corta (f, in, ig…) + enlace. Sin enlace se muestra desactivada.</p></div>
            {config.social.map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 10, alignItems: 'center' }}>
                <input value={s.label} onChange={(e) => setF({ social: config.social.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} style={{ ...inputStyle, height: 42, textAlign: 'center' }} placeholder="f" />
                <input value={s.href} onChange={(e) => setF({ social: config.social.map((x, j) => j === i ? { ...x, href: e.target.value } : x) })} style={{ ...inputStyle, height: 42 }} placeholder="https://…" />
                <button type="button" onClick={() => setF({ social: config.social.filter((_, j) => j !== i) })} style={iconBtn} title="Quitar"><i className="ph ph-trash" /></button>
              </div>
            ))}
            <div><button type="button" onClick={() => setF({ social: [...config.social, { label: '', href: '' }] })} style={addBtn}><i className="ph ph-plus" /> Agregar red</button></div>
          </div>

          {/* Copyright */}
          <div style={{ ...cardStyle, display: 'grid', gap: 12, marginBottom: 0 }}>
            <h3 style={h3Style}>Aviso de copyright</h3>
            <Field label="Texto (vacío ⇒ se genera automático con el año y la marca)"><input value={config.copyright} onChange={(e) => setF({ copyright: e.target.value })} style={inputStyle} placeholder={`© ${year} ${brand}. Todos los derechos reservados.`} /></Field>
          </div>
        </div>

        {/* PREVIEW */}
        <div style={{ position: 'sticky', top: 12 }} className="ftr-ed-preview">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: D.muted2, marginBottom: 14 }}><span style={{ width: 6, height: 6, borderRadius: 999, background: '#3fbf8f', boxShadow: '0 0 8px #3fbf8f' }} /> Vista previa</div>
          <div style={{ background: '#111', borderRadius: 14, padding: 20, border: `1px solid ${D.cardBorder}` }}>
            {config.showNewsletter ? (
              <div style={{ background: '#1c1c1c', borderRadius: 10, padding: 16, marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '.02em' }}>{config.newsletterTitle || 'Boletín'}</div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.5)', marginTop: 5, lineHeight: 1.4 }}>{config.newsletterSubtitle}</div>
              </div>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: `1.4fr repeat(${Math.min(config.columns.length, 3)}, 1fr)`, gap: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: 8 }}>{brand}</div>
                <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.5)', lineHeight: 1.5 }}>{config.tagline.slice(0, 90)}{config.tagline.length > 90 ? '…' : ''}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                  {config.social.map((s, i) => <span key={i} style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(255,255,255,.08)', display: 'grid', placeItems: 'center', fontSize: 10, color: '#fff' }}>{s.label}</span>)}
                </div>
              </div>
              {config.columns.slice(0, 3).map((col, i) => (
                <div key={i}>
                  <div style={{ fontSize: 9.5, color: '#fff', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>{col.title || '—'}</div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {col.links.slice(0, 5).map((l, j) => <div key={j} style={{ fontSize: 10, color: 'rgba(255,255,255,.55)' }}>{l.label || '—'}</div>)}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,.1)', marginTop: 16, paddingTop: 12, fontSize: 9.5, color: 'rgba(255,255,255,.4)' }}>{copyPreview}</div>
          </div>
        </div>
      </div>

      <style>{`@media (max-width: 900px){ .ftr-ed-grid{ grid-template-columns:1fr !important; } .ftr-ed-preview{ position:static !important; } }`}</style>

      {toast ? (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 10, background: toast.ok ? '#16281c' : '#2a1416', border: `1px solid ${toast.ok ? 'rgba(63,191,143,0.4)' : 'rgba(245,80,80,0.4)'}`, color: toast.ok ? '#dff5e8' : '#f8d7d7', padding: '13px 20px', borderRadius: 13, fontSize: 14, fontWeight: 600, boxShadow: '0 16px 40px -16px rgba(0,0,0,0.7)', zIndex: 100 }}>
          <i className={`ph-bold ${toast.ok ? 'ph-check-circle' : 'ph-warning-circle'}`} style={{ fontSize: 19, color: toast.ok ? '#3fbf8f' : '#f55' }} /> {toast.text}
        </div>
      ) : null}
    </div>
  );
}
