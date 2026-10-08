'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LegalContent, ThemeTokens } from '@maqserv/config';
import { cardStyle, inputStyle, h3Style, Field } from '@/components/editor-kit';
import { Btn, IconBtn, PageHeader, Segmented, StatusText, Toast, btnClass } from '@/components/ui';

type Copys = Record<string, Record<string, string>>;
type DocKey = 'terms' | 'privacy';

const textarea = (rows: number): React.CSSProperties => ({ ...inputStyle, height: 'auto', padding: '10px 12px', lineHeight: 1.55, resize: 'vertical', fontFamily: 'inherit', minHeight: rows * 22 });

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

  return (
    <div>
      <PageHeader
        eyebrow={['Ajustes', 'Sitio web']}
        title="Términos y privacidad"
        actions={
          <>
            <a href={doc === 'terms' ? '/terminos' : '/privacidad'} target="_blank" rel="noopener noreferrer" className={btnClass('secondary')}><i className="ph ph-arrow-square-out" aria-hidden /> Ver</a>
            <StatusText tone={dirty ? 'warn' : 'ok'}>{dirty ? 'Cambios sin publicar' : 'Todo publicado'}</StatusText>
            <Btn variant="ghost" onClick={discard} disabled={!dirty || busy}>Descartar</Btn>
            <Btn variant="primary" icon="ph-cloud-arrow-up" onClick={publish} disabled={busy || !dirty}>{busy ? 'Publicando…' : 'Guardar y publicar'}</Btn>
          </>
        }
      />

      <div style={{ maxWidth: 900, display: 'grid', gap: 18 }}>
        {/* Selector de documento */}
        <div>
          <Segmented<DocKey>
            ariaLabel="Documento"
            value={doc}
            onChange={setDoc}
            items={[
              { key: 'terms', label: 'Términos y Condiciones' },
              { key: 'privacy', label: 'Aviso de Privacidad' },
            ]}
          />
        </div>

        <div style={{ ...cardStyle, display: 'grid', gap: 16, marginBottom: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 14 }}>
            <Field label="Introducción (texto bajo el título)"><textarea value={d.intro} onChange={(e) => patchDoc({ intro: e.target.value })} rows={3} style={textarea(3)} placeholder="Resumen breve del documento…" /></Field>
            <Field label="Última actualización"><input value={d.updated} onChange={(e) => patchDoc({ updated: e.target.value })} style={inputStyle} placeholder="Julio 2026" /></Field>
          </div>
        </div>

        <div style={{ ...cardStyle, display: 'grid', gap: 14, marginBottom: 0 }}>
          <div><h3 style={h3Style}>Secciones</h3><p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--adm-muted)' }}>Se numeran automáticamente. En el contenido, deja una línea en blanco para separar párrafos.</p></div>
          {/* Cada sección va separada por una línea fina, no en una caja dentro de la caja. */}
          {d.sections.map((s, i) => (
            <div key={i} style={{ display: 'grid', gap: 10, paddingTop: 14, borderTop: '1px solid var(--adm-border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto', gap: 8, alignItems: 'center' }}>
                <span className="adm-num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--adm-muted)', width: 26 }}>{String(i + 1).padStart(2, '0')}</span>
                <input value={s.h} onChange={(e) => updSection(i, { h: e.target.value })} style={{ ...inputStyle, fontWeight: 600 }} placeholder="Título de la sección" />
                <IconBtn icon="ph-arrow-up" label="Subir" onClick={() => moveSection(i, -1)} disabled={i === 0} />
                <IconBtn icon="ph-arrow-down" label="Bajar" onClick={() => moveSection(i, 1)} disabled={i === d.sections.length - 1} />
                <IconBtn icon="ph-trash" label="Quitar sección" danger onClick={() => delSection(i)} />
              </div>
              <textarea value={s.body} onChange={(e) => updSection(i, { body: e.target.value })} rows={4} style={textarea(4)} placeholder="Contenido de la sección…" />
            </div>
          ))}
          <div><Btn size="sm" icon="ph-plus" onClick={addSection}>Agregar sección</Btn></div>
        </div>
      </div>

      {toast ? <Toast kind={toast.ok ? 'ok' : 'bad'}>{toast.text}</Toast> : null}
    </div>
  );
}
