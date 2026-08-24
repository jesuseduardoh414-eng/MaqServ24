'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LegalContent, ThemeTokens } from '@maqserv/config';
import { D, FONT, cardStyle, inputStyle, h3Style, smallLabel, Field } from '@/components/editor-kit';

type Copys = Record<string, Record<string, string>>;
type DocKey = 'terms' | 'privacy';

const textarea = (rows: number): React.CSSProperties => ({ ...inputStyle, height: 'auto', padding: '12px 14px', lineHeight: 1.55, resize: 'vertical', fontFamily: 'inherit', minHeight: rows * 22 });

export function LegalEditor({ themeId, copys, tokens, legal }: {
  themeId: number | null; copys: Copys; tokens: ThemeTokens; legal: LegalContent;
}) {
  const router = useRouter();
  const [config, setConfig] = useState<LegalContent>(legal);
  const [saved, setSaved] = useState<LegalContent>(legal);
  const [doc, setDoc] = useState<DocKey>('terms');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = JSON.stringify(config) !== JSON.stringify(saved);
  const d = config[doc];

  const patchDoc = (patch: Partial<LegalContent['terms']>) => setConfig((c) => ({ ...c, [doc]: { ...c[doc], ...patch } }));
  const updSection = (i: number, patch: Partial<{ h: string; body: string }>) => patchDoc({ sections: d.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const addSection = () => patchDoc({ sections: [...d.sections, { h: '', body: '' }] });
  const delSection = (i: number) => patchDoc({ sections: d.sections.filter((_, j) => j !== i) });
  const moveSection = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= d.sections.length) return;
    const arr = [...d.sections];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    patchDoc({ sections: arr });
  };

  function discard() { setConfig(saved); setToast(null); }
  async function publish() {
    if (busy || !themeId) return;
    setBusy(true); setToast(null);
    try {
      const body = { tokens: { ...tokens, legal: config }, copys };
      const r2 = await fetch(`/api/admin/themes/${themeId}/draft`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r2.ok) throw new Error('No se pudieron guardar los cambios');
      const r3 = await fetch(`/api/admin/themes/${themeId}/publish`, { method: 'POST' });
      if (!r3.ok) throw new Error('No se pudo publicar');
      setSaved(config);
      setToast({ ok: true, text: 'Publicado — se verá al refrescar el sitio.' });
      router.refresh();
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  const iconBtn: React.CSSProperties = { border: `1px solid ${D.inputBorder}`, background: 'rgba(255,255,255,0.03)', color: D.muted2, borderRadius: 9, width: 32, height: 32, cursor: 'pointer', display: 'inline-grid', placeItems: 'center', flexShrink: 0, fontFamily: 'inherit' };
  const tab = (key: DocKey, label: string) => (
    <button type="button" onClick={() => setDoc(key)} style={{ flex: 1, cursor: 'pointer', fontWeight: 700, fontSize: 14, padding: '10px', borderRadius: 10, border: 'none', background: doc === key ? D.amber : 'transparent', color: doc === key ? '#0a0a0b' : D.muted2, fontFamily: 'inherit' }}>{label}</button>
  );

  return (
    <div style={{ fontFamily: FONT, color: D.text }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />

      <div style={{ background: '#0c0c0e', border: `1px solid ${D.cardBorder}`, borderRadius: 16, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: D.muted2, fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}><i className="ph ph-scroll" style={{ fontSize: 14 }} /> Diseño del sitio <span style={{ opacity: 0.5 }}>·</span> Legal</div>
          <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em' }}>Términos y privacidad</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <a href={doc === 'terms' ? '/terminos' : '/privacidad'} target="_blank" rel="noopener noreferrer" style={{ border: `1px solid ${D.inputBorder}`, background: 'rgba(255,255,255,0.03)', color: D.text, borderRadius: 11, padding: '9px 14px', fontWeight: 700, fontSize: 13, textDecoration: 'none', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7 }}><i className="ph ph-arrow-square-out" style={{ fontSize: 15 }} /> Ver</a>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, padding: '8px 13px', borderRadius: 999, border: `1px solid ${dirty ? 'color-mix(in srgb, var(--color-primary) 40%, transparent)' : 'rgba(255,255,255,0.08)'}`, background: dirty ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'rgba(255,255,255,0.03)', color: dirty ? D.amber : D.muted2 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: dirty ? D.amber : '#3fbf8f' }} />{dirty ? 'Cambios sin publicar' : 'Todo publicado'}</span>
          <button type="button" onClick={discard} disabled={!dirty || busy} style={{ border: `1px solid ${D.inputBorder}`, background: 'transparent', color: dirty ? D.text : D.muted2, borderRadius: 11, padding: '10px 16px', fontWeight: 600, fontSize: 14, cursor: dirty && !busy ? 'pointer' : 'default', opacity: dirty && !busy ? 1 : 0.5, fontFamily: 'inherit' }}>Descartar</button>
          <button type="button" onClick={publish} disabled={busy || !dirty} style={{ border: 'none', background: D.amber, color: '#0a0a0b', borderRadius: 11, padding: '11px 18px', fontWeight: 800, fontSize: 14, cursor: busy || !dirty ? 'default' : 'pointer', opacity: busy || !dirty ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}><i className="ph-bold ph-cloud-arrow-up" style={{ fontSize: 17 }} /> {busy ? 'Publicando…' : 'Guardar y publicar'}</button>
        </div>
      </div>

      <div style={{ maxWidth: 900, display: 'grid', gap: 18 }}>
        {/* Selector de documento */}
        <div style={{ display: 'flex', gap: 4, background: '#0c0c0e', border: `1px solid ${D.cardBorder}`, borderRadius: 12, padding: 4 }}>
          {tab('terms', 'Términos y Condiciones')}
          {tab('privacy', 'Aviso de Privacidad')}
        </div>

        <div style={{ ...cardStyle, display: 'grid', gap: 16, marginBottom: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 14 }}>
            <Field label="Introducción (texto bajo el título)"><textarea value={d.intro} onChange={(e) => patchDoc({ intro: e.target.value })} rows={3} style={textarea(3)} placeholder="Resumen breve del documento…" /></Field>
            <Field label="Última actualización"><input value={d.updated} onChange={(e) => patchDoc({ updated: e.target.value })} style={inputStyle} placeholder="Julio 2026" /></Field>
          </div>
        </div>

        <div style={{ ...cardStyle, display: 'grid', gap: 14, marginBottom: 0 }}>
          <div><h3 style={h3Style}>Secciones</h3><p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>Se numeran automáticamente. En el contenido, deja una línea en blanco para separar párrafos.</p></div>
          {d.sections.map((s, i) => (
            <div key={i} style={{ border: `1px solid ${D.inputBorder}`, borderRadius: 12, padding: 14, display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto', gap: 8, alignItems: 'center' }}>
                <span style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 800, color: D.amber, width: 26 }}>{String(i + 1).padStart(2, '0')}</span>
                <input value={s.h} onChange={(e) => updSection(i, { h: e.target.value })} style={{ ...inputStyle, height: 42, fontWeight: 700 }} placeholder="Título de la sección" />
                <button type="button" onClick={() => moveSection(i, -1)} disabled={i === 0} style={{ ...iconBtn, opacity: i === 0 ? 0.4 : 1 }} title="Subir"><i className="ph ph-arrow-up" /></button>
                <button type="button" onClick={() => moveSection(i, 1)} disabled={i === d.sections.length - 1} style={{ ...iconBtn, opacity: i === d.sections.length - 1 ? 0.4 : 1 }} title="Bajar"><i className="ph ph-arrow-down" /></button>
                <button type="button" onClick={() => delSection(i)} style={iconBtn} title="Quitar sección"><i className="ph ph-trash" /></button>
              </div>
              <textarea value={s.body} onChange={(e) => updSection(i, { body: e.target.value })} rows={4} style={textarea(4)} placeholder="Contenido de la sección…" />
            </div>
          ))}
          <div><button type="button" onClick={addSection} style={{ border: `1px dashed ${D.inputBorder}`, background: 'transparent', color: D.amber, borderRadius: 10, padding: '10px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7 }}><i className="ph ph-plus" /> Agregar sección</button></div>
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
