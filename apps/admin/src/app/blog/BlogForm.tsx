'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { D, FONT, cardStyle, inputStyle, h3Style, smallLabel, Field, Toggle } from '@/components/editor-kit';

export interface BlogFormData {
  id?: number;
  title?: string;
  details?: string;
  source?: string | null;
  category?: string | null;
  metaTag?: string | null;
  metaDescription?: string | null;
  image?: string | null;
  status?: number;
}

/** Categorías de la Bitácora (deben coincidir con los chips del blog público). */
const BLOG_CATEGORIES = ['General', 'Guías', 'Mantenimiento', 'Seguridad', 'Finanzas', 'Noticias', 'Industria'] as const;

export function BlogForm({ initial }: { initial: BlogFormData }) {
  const router = useRouter();
  const isEdit = Boolean(initial.id);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<number>(initial.status ?? 1);
  const [preview, setPreview] = useState<string | null>(initial.image ?? null);
  const [fileName, setFileName] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) { setPreview(URL.createObjectURL(f)); setFileName(f.name); }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    fd.set('status', String(status));
    const res = await fetch(
      isEdit ? `/api/admin/cms/blogs/${initial.id}` : '/api/admin/cms/blogs',
      { method: isEdit ? 'PATCH' : 'POST', body: fd },
    );
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(typeof data?.message === 'string' ? data.message : 'No se pudo guardar');
      return;
    }
    router.push('/blog');
    router.refresh();
  }

  const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'none', cursor: 'pointer' };

  return (
    <form onSubmit={onSubmit} encType="multipart/form-data" style={{ fontFamily: FONT, color: D.text }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />

      {/* Cabecera */}
      <div style={{ background: '#0c0c0e', border: `1px solid ${D.cardBorder}`, borderRadius: 16, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: D.muted2, fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}>
            <i className="ph ph-article" style={{ fontSize: 14 }} /> Diseño del sitio <span style={{ opacity: 0.5 }}>·</span> Blog
          </div>
          <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em' }}>{isEdit ? 'Editar entrada' : 'Nueva entrada'}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/blog" style={{ border: `1px solid ${D.inputBorder}`, background: 'transparent', color: D.text, borderRadius: 11, padding: '10px 16px', fontWeight: 600, fontSize: 14, textDecoration: 'none', fontFamily: 'inherit' }}>Cancelar</Link>
          <button type="submit" disabled={busy} style={{ border: 'none', background: D.amber, color: '#0a0a0b', borderRadius: 11, padding: '11px 18px', fontWeight: 800, fontSize: 14, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}>
            <i className="ph-bold ph-check" style={{ fontSize: 17 }} /> {busy ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Publicar entrada'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 22, alignItems: 'start' }} className="blog-form-grid">
        {/* Columna principal */}
        <div style={{ minWidth: 0 }}>
          <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
            <h3 style={h3Style}>Contenido</h3>
            <Field label="Título"><input name="title" required minLength={2} defaultValue={initial.title ?? ''} placeholder="Título de la entrada" style={inputStyle} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="blog-form-row">
              <Field label="Categoría">
                <select name="category" defaultValue={initial.category ?? 'General'} style={selectStyle}>
                  {BLOG_CATEGORIES.map((c) => <option key={c} value={c} style={{ background: D.card }}>{c}</option>)}
                </select>
              </Field>
              <Field label="Autor (opcional)"><input name="source" defaultValue={initial.source ?? ''} placeholder="Ej. Ing. Ramón Salas" style={inputStyle} /></Field>
            </div>
            <Field label="Cuerpo del artículo (HTML permitido)">
              <textarea name="details" required minLength={4} rows={16} defaultValue={initial.details ?? ''} placeholder="<p>Escribe el contenido…</p>" style={{ ...inputStyle, height: 'auto', padding: '12px 14px', lineHeight: 1.6, resize: 'vertical', fontFamily: 'ui-monospace, monospace', fontSize: 13.5 }} />
            </Field>
          </div>

          <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
            <div>
              <h3 style={h3Style}>SEO (opcional)</h3>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>Cómo aparece en Google y al compartir. Si lo dejas vacío se usa el título y un extracto.</p>
            </div>
            <Field label="Meta título"><input name="metaTag" defaultValue={initial.metaTag ?? ''} placeholder="Título para buscadores" style={inputStyle} /></Field>
            <Field label="Meta descripción"><textarea name="metaDescription" defaultValue={initial.metaDescription ?? ''} rows={2} placeholder="Resumen breve (≤160 caracteres)" style={{ ...inputStyle, height: 'auto', padding: '12px 14px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'grid', gap: 18, position: 'sticky', top: 12 }} className="blog-form-side">
          <div style={{ ...cardStyle, display: 'grid', gap: 12, marginBottom: 0 }}>
            <h3 style={h3Style}>Imagen destacada</h3>
            <label
              style={{ position: 'relative', display: 'grid', placeItems: 'center', minHeight: preview ? 150 : 118, border: `1.5px dashed ${D.inputBorder}`, borderRadius: 12, background: preview ? '#0d0d10' : D.inputBg, cursor: 'pointer', overflow: 'hidden', padding: 12 }}
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" style={{ maxHeight: 150, maxWidth: '100%', objectFit: 'contain', borderRadius: 6 }} />
              ) : (
                <div style={{ textAlign: 'center', color: D.muted2, fontSize: 13 }}>
                  <i className="ph ph-image" style={{ fontSize: 24, display: 'block', marginBottom: 6 }} />
                  Haz clic para subir una imagen
                </div>
              )}
              <input type="file" name="photo" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
            </label>
            {fileName ? <span style={{ fontSize: 12, color: D.muted2 }}><i className="ph ph-paperclip" /> {fileName}</span> : preview ? <span style={{ fontSize: 12, color: D.muted2 }}>Imagen actual — sube una nueva para reemplazarla.</span> : null}
          </div>

          <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 0 }}>
            <div>
              <strong style={{ fontSize: 13.5 }}>{status === 1 ? 'Publicada' : 'Oculta'}</strong>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>{status === 1 ? 'Visible en el sitio.' : 'No se muestra al público.'}</p>
            </div>
            <Toggle on={status === 1} onClick={() => setStatus((s) => (s === 1 ? 0 : 1))} />
          </div>
        </div>
      </div>

      {error ? (
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 10, background: '#2a1416', border: '1px solid rgba(245,80,80,0.4)', color: '#f8d7d7', padding: '12px 16px', borderRadius: 12, fontSize: 14, fontWeight: 600 }}>
          <i className="ph-bold ph-warning-circle" style={{ fontSize: 18, color: '#f55' }} /> {error}
        </div>
      ) : null}

      <style>{`@media (max-width: 860px){ .blog-form-grid{ grid-template-columns:1fr !important; } .blog-form-side{ position:static !important; } }`}</style>
    </form>
  );
}
