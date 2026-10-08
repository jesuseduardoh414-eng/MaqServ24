'use client';

import { useState } from 'react';
import { AdminSelect } from '@/components/AdminSelect';
import { useRouter } from 'next/navigation';
import { D, cardStyle, inputStyle, h3Style, Field, Toggle } from '@/components/editor-kit';
import { Btn, Note, PageHeader } from '@/components/ui';

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

  return (
    <form onSubmit={onSubmit} encType="multipart/form-data">
      <PageHeader
        eyebrow={['Sitio web', ['Blog', '/blog']]}
        title={isEdit ? 'Editar entrada' : 'Nueva entrada'}
        actions={
          <>
            <Btn variant="ghost" href="/blog">Cancelar</Btn>
            <Btn variant="primary" type="submit" icon="ph-check" disabled={busy}>{busy ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Publicar entrada'}</Btn>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 22, alignItems: 'start' }} className="blog-form-grid">
        {/* Columna principal */}
        <div style={{ minWidth: 0 }}>
          <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
            <h3 style={h3Style}>Contenido</h3>
            <Field label="Título"><input name="title" required minLength={2} defaultValue={initial.title ?? ''} placeholder="Título de la entrada" style={inputStyle} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="blog-form-row">
              <Field label="Categoría">
                <AdminSelect name="category" ariaLabel="Categoría" defaultValue={initial.category ?? 'General'} options={BLOG_CATEGORIES.map((c) => ({ value: c, label: c }))} />
              </Field>
              <Field label="Autor (opcional)"><input name="source" defaultValue={initial.source ?? ''} placeholder="Ej. Ing. Ramón Salas" style={inputStyle} /></Field>
            </div>
            <Field label="Cuerpo del artículo (HTML permitido)">
              {/* Es código HTML: va en la monoespaciada del panel. */}
              <textarea name="details" required minLength={4} rows={16} defaultValue={initial.details ?? ''} placeholder="<p>Escribe el contenido…</p>" style={{ ...inputStyle, height: 'auto', padding: '10px 12px', lineHeight: 1.6, resize: 'vertical', fontFamily: 'var(--adm-mono)', fontSize: 13 }} />
            </Field>
          </div>

          <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
            <div>
              <h3 style={h3Style}>SEO (opcional)</h3>
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--adm-muted)' }}>Cómo aparece en Google y al compartir. Si lo dejas vacío se usa el título y un extracto.</p>
            </div>
            <Field label="Meta título"><input name="metaTag" defaultValue={initial.metaTag ?? ''} placeholder="Título para buscadores" style={inputStyle} /></Field>
            <Field label="Meta descripción"><textarea name="metaDescription" defaultValue={initial.metaDescription ?? ''} rows={2} placeholder="Resumen breve (≤160 caracteres)" style={{ ...inputStyle, height: 'auto', padding: '10px 12px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'grid', gap: 18, position: 'sticky', top: 12 }} className="blog-form-side">
          <div style={{ ...cardStyle, display: 'grid', gap: 12, marginBottom: 0 }}>
            <h3 style={h3Style}>Imagen destacada</h3>
            <label
              style={{ position: 'relative', display: 'grid', placeItems: 'center', minHeight: preview ? 150 : 118, border: '1.5px dashed var(--adm-border-strong)', borderRadius: 12, background: preview ? 'var(--adm-page)' : D.inputBg, cursor: 'pointer', overflow: 'hidden', padding: 12 }}
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" style={{ maxHeight: 150, maxWidth: '100%', objectFit: 'contain', borderRadius: 6 }} />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--adm-muted)', fontSize: 13 }}>
                  <i className="ph ph-image" style={{ fontSize: 24, display: 'block', marginBottom: 6 }} />
                  Haz clic para subir una imagen
                </div>
              )}
              <input type="file" name="photo" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
            </label>
            {fileName ? <span style={{ fontSize: 12.5, color: 'var(--adm-muted)' }}><i className="ph ph-paperclip" /> {fileName}</span> : preview ? <span style={{ fontSize: 12.5, color: 'var(--adm-muted)' }}>Imagen actual — sube una nueva para reemplazarla.</span> : null}
          </div>

          {/* Un solo interruptor: texto plano, sin tarjeta. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '4px 2px' }}>
            <div>
              <div className="adm-cell-title" style={{ fontSize: 13.5 }}>{status === 1 ? 'Publicada' : 'Oculta'}</div>
              <div className="adm-cell-sub">{status === 1 ? 'Visible en el sitio.' : 'No se muestra al público.'}</div>
            </div>
            <Toggle on={status === 1} onClick={() => setStatus((s) => (s === 1 ? 0 : 1))} />
          </div>
        </div>
      </div>

      {error ? <Note tone="bad" style={{ marginTop: 18 }}>{error}</Note> : null}

      <style>{`@media (max-width: 860px){ .blog-form-grid{ grid-template-columns:1fr !important; } .blog-form-side{ position:static !important; } }`}</style>
    </form>
  );
}
