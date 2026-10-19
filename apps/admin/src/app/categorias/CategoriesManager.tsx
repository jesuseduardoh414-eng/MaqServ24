'use client';

import { Modal } from '@/components/Modal';
import { useMemo, useRef, useState } from 'react';
import {
  Bar, Btn, EmptyState, FormField, IconBtn, PageHeader, Panel, SearchBox, Segmented, Stat, Stats, Switch, Thumb, Toast, Toolbar,
} from '@/components/ui';

export interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  status: number;
  image: string | null;
  /** Video en bucle de la tarjeta del sitio; si hay, va en lugar de la foto. */
  video: string | null;
  /** Una línea bajo el nombre en las tarjetas del sitio. */
  description: string | null;
  productCount: number;
}

/** Igual que VIDEO_MAX_MB en la API (admin-catalog.controller.ts). */
const VIDEO_MAX_MB = 30;

/**
 * Sube el video con XHR y no con fetch: fetch no informa el avance de la
 * subida, y 20 MB por el celular sin barra parecen colgados.
 */
function subirVideo(id: number, archivo: File, onAvance: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/admin/catalog/categories/${id}/video`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onAvance(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let d: { message?: string; video?: string } | null = null;
      try { d = JSON.parse(xhr.responseText); } catch { /* sin cuerpo */ }
      if (xhr.status >= 200 && xhr.status < 300 && d?.video) resolve(d.video);
      else if (xhr.status === 413) reject(new Error(`El video pesa más de ${VIDEO_MAX_MB} MB`));
      else reject(new Error(d?.message ?? 'No se pudo subir el video'));
    };
    xhr.onerror = () => reject(new Error('Se cortó la conexión al subir el video'));
    const fd = new FormData();
    fd.append('video', archivo);
    xhr.send(fd);
  });
}

const GRID = '40px minmax(0,1.6fr) minmax(0,1.1fr) 140px 130px 140px';

function slugify(s: string) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

type Filtro = 'todas' | 'activas' | 'inactivas';

export function CategoriesManager({ initial }: { initial: CategoryRow[] }) {
  const [cats, setCats] = useState<CategoryRow[]>(initial);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filtro>('todas');
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState(1);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const editFileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  /** Avance de la subida del video (0-100), o null si no se está subiendo. */
  const [subiendo, setSubiendo] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'warn' | 'trash' } | null>(null);

  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftPreview, setDraftPreview] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flash(text: string, kind: 'ok' | 'warn' | 'trash' = 'ok') {
    setToast({ text, kind });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  async function reload() {
    const r = await fetch('/api/admin/catalog/categories');
    if (r.ok) { const d = await r.json().catch(() => null); if (Array.isArray(d)) setCats(d); }
  }

  async function create() {
    const name = draftName.trim();
    if (name.length < 2) { flash('Escribe un nombre (mín. 2 letras)', 'warn'); nameRef.current?.focus(); return; }
    if (cats.some((c) => c.slug === slugify(name))) { flash('Esa categoría ya existe', 'warn'); return; }
    setCreating(true);
    try {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('description', draftDescription.trim());
      if (draftFile) fd.append('photo', draftFile);
      const r = await fetch('/api/admin/catalog/categories', { method: 'POST', body: fd });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.message ?? 'No se pudo crear');
      setDraftName(''); setDraftDescription(''); setDraftFile(null); setDraftPreview(null);
      if (fileRef.current) fileRef.current.value = '';
      await reload();
      setNuevaAbierta(false);
      flash(`Categoría «${name}» creada`);
    } catch (e) { flash((e as Error).message, 'warn'); } finally { setCreating(false); }
  }

  async function toggle(c: CategoryRow) {
    const next = c.status === 1 ? 0 : 1;
    setCats((cs) => cs.map((x) => (x.id === c.id ? { ...x, status: next } : x)));
    const r = await fetch(`/api/admin/catalog/categories/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) });
    if (!r.ok) { setCats((cs) => cs.map((x) => (x.id === c.id ? { ...x, status: c.status } : x))); flash('No se pudo cambiar el estado', 'warn'); return; }
    flash(next === 1 ? `«${c.name}» activada` : `«${c.name}» desactivada`);
  }

  function openEdit(c: CategoryRow) {
    setEditing(c); setEditName(c.name); setEditDescription(c.description ?? ''); setEditStatus(c.status);
    setEditFile(null); setEditPreview(null); setConfirmId(null);
  }
  async function saveEdit() {
    if (!editing) return;
    const v = editName.trim();
    if (v.length < 2) { flash('El nombre no puede quedar vacío', 'warn'); return; }
    setSavingEdit(true);
    try {
      const fd = new FormData();
      fd.append('name', v);
      fd.append('description', editDescription.trim());
      fd.append('status', String(editStatus));
      if (editFile) fd.append('photo', editFile);
      const r = await fetch(`/api/admin/catalog/categories/${editing.id}`, { method: 'PATCH', body: fd });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.message ?? 'No se pudo actualizar');
      await reload();
      setEditing(null);
      flash('Categoría actualizada');
    } catch (e) { flash((e as Error).message, 'warn'); } finally { setSavingEdit(false); }
  }

  /**
   * Sube o baja una categoría en el sitio (banda del inicio y /categorias).
   * La lista llega en el orden del sitio; se guarda la lista completa.
   */
  async function mover(c: CategoryRow, paso: -1 | 1) {
    const i = cats.findIndex((x) => x.id === c.id);
    const j = i + paso;
    if (i < 0 || j < 0 || j >= cats.length) return;
    const antes = cats;
    const next = [...cats];
    [next[i], next[j]] = [next[j], next[i]];
    setCats(next);
    const r = await fetch('/api/admin/catalog/categories/orden', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: next.map((x) => x.id) }),
    });
    if (!r.ok) { setCats(antes); flash('No se pudo cambiar el orden', 'warn'); }
  }

  /** El video se guarda al elegirlo (no espera a «Guardar»): es la parte lenta. */
  async function elegirVideo(archivo: File | null) {
    if (videoRef.current) videoRef.current.value = '';
    if (!editing || !archivo) return;
    if (archivo.size > VIDEO_MAX_MB * 1024 * 1024) { flash(`El video pesa más de ${VIDEO_MAX_MB} MB`, 'warn'); return; }
    setSubiendo(0);
    try {
      const url = await subirVideo(editing.id, archivo, setSubiendo);
      setEditing((e) => (e ? { ...e, video: url } : e));
      setCats((cs) => cs.map((x) => (x.id === editing.id ? { ...x, video: url } : x)));
      flash('Video guardado');
    } catch (e) { flash((e as Error).message, 'warn'); } finally { setSubiendo(null); }
  }

  async function quitarVideo() {
    if (!editing) return;
    const r = await fetch(`/api/admin/catalog/categories/${editing.id}/video`, { method: 'DELETE' });
    if (!r.ok) { flash('No se pudo quitar el video', 'warn'); return; }
    setEditing((e) => (e ? { ...e, video: null } : e));
    setCats((cs) => cs.map((x) => (x.id === editing.id ? { ...x, video: null } : x)));
    flash('Video quitado: se vuelve a ver la foto');
  }

  async function del(c: CategoryRow) {
    setConfirmId(null);
    const r = await fetch(`/api/admin/catalog/categories/${c.id}`, { method: 'DELETE' });
    const d = await r.json().catch(() => null);
    if (!r.ok) { flash(d?.message ?? 'No se pudo eliminar', 'warn'); return; }
    setCats((cs) => cs.filter((x) => x.id !== c.id));
    flash(`«${c.name}» eliminada`, 'trash');
  }

  // Alta en modal (2026-09-25): antes la tarjeta estaba fija encima de la lista.
  const [nuevaAbierta, setNuevaAbierta] = useState(false);
  function focusNew() {
    setNuevaAbierta(true);
    setTimeout(() => nameRef.current?.focus(), 120);
  }

  const stats = useMemo(() => ({
    total: cats.length,
    activas: cats.filter((c) => c.status === 1).length,
    productos: cats.reduce((a, c) => a + c.productCount, 0),
    vacias: cats.filter((c) => c.productCount === 0).length,
  }), [cats]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cats.filter((c) => {
      if (filter === 'activas' && c.status !== 1) return false;
      if (filter === 'inactivas' && c.status === 1) return false;
      if (q && !(c.name.toLowerCase().includes(q) || c.slug.includes(q))) return false;
      return true;
    });
  }, [cats, query, filter]);
  const maxProd = Math.max(1, ...cats.map((c) => c.productCount));

  return (
    <div>
      <style>{`
        .cat-row { display: grid; grid-template-columns: ${GRID}; gap: 16px; align-items: center; }
        /* En móvil cada fila pasa a bloque: imagen + nombre arriba, el resto debajo. */
        @media (max-width: 900px) {
          .cat-thead { display: none !important; }
          .cat-row { display: flex; flex-wrap: wrap; gap: 10px 14px; }
          .cat-row > .cat-c-name { flex: 1 1 calc(100% - 56px); }
          .cat-row > .cat-c-actions { margin-left: auto; }
        }
      `}</style>

      <PageHeader
        eyebrow={['Red y oferta', 'Catálogo']}
        title="Categorías"
        subtitle="Las líneas de servicio con las que se agrupa el inventario en el sitio y en las solicitudes. El orden de esta lista es el de las tarjetas del sitio: muévelo con las flechas."
        actions={<Btn variant="primary" icon="ph-plus" onClick={focusNew}>Nueva categoría</Btn>}
      />

      <Stats>
        <Stat label="Categorías" icon="ph-squares-four" tone="accent" value={stats.total} />
        <Stat label="Activas" icon="ph-check-circle" tone="ok" value={stats.activas} hint={`de ${stats.total}`} />
        <Stat label="Productos" icon="ph-package" tone="info" value={stats.productos} hint="en todas las categorías" />
        <Stat
          label="Sin productos"
          icon="ph-warning"
          tone={stats.vacias > 0 ? 'warn' : 'muted'}
          value={stats.vacias}
          hint={stats.vacias > 0 ? 'no se ven en el sitio' : 'todas tienen inventario'}
          hintTone={stats.vacias > 0 ? 'warn' : undefined}
        />
      </Stats>

      <Toolbar end={`${rows.length} de ${stats.total}`}>
        <SearchBox value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar categoría…" aria-label="Buscar categoría" />
        <Segmented<Filtro>
          ariaLabel="Filtrar por estado"
          value={filter}
          onChange={setFilter}
          items={[
            { key: 'todas', label: 'Todas', count: stats.total },
            { key: 'activas', label: 'Activas', count: stats.activas },
            { key: 'inactivas', label: 'Inactivas', count: stats.total - stats.activas },
          ]}
        />
      </Toolbar>

      <Panel flush clip>
        <div className="adm-thead cat-row cat-thead">
          <div /><div>Nombre</div><div>Slug</div><div>Productos</div><div>Estado</div><div style={{ textAlign: 'right' }}>Acciones</div>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon="ph-squares-four" title="No se encontraron categorías" sub="Ajusta la búsqueda o crea una nueva." />
        ) : rows.map((c) => {
          const pct = Math.max(4, Math.round((c.productCount / maxProd) * 100));
          const confirming = confirmId === c.id;
          const pos = cats.findIndex((x) => x.id === c.id);
          return (
            <div key={c.id} className="adm-trow cat-row">
              <div className="cat-c-img"><Thumb src={c.image} /></div>
              <div className="cat-c-name" style={{ minWidth: 0 }}>
                <div className="adm-cell-title adm-ellipsis">
                  {c.name}
                  {c.video ? <i className="ph ph-video-camera" title="Lleva video en el sitio" aria-label="Lleva video en el sitio" style={{ marginLeft: 6, color: 'var(--adm-muted)' }} /> : null}
                </div>
                {c.description ? <div className="adm-cell-sub adm-ellipsis">{c.description}</div> : null}
              </div>
              <div className="cat-c-slug adm-mono adm-ellipsis" style={{ fontSize: 12.5, color: 'var(--adm-muted)' }}>{c.slug}</div>
              <div className="cat-c-prod" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="adm-num" style={{ minWidth: 18, fontSize: 13.5, fontWeight: 600, color: c.productCount === 0 ? 'var(--adm-faint)' : 'var(--adm-text)' }}>{c.productCount}</span>
                <Bar pct={c.productCount === 0 ? 0 : pct} width={64} />
              </div>
              <div className="cat-c-state">
                <Switch on={c.status === 1} onClick={() => toggle(c)} label={c.status === 1 ? 'Activa' : 'Inactiva'} title="Activar / desactivar" />
              </div>
              <div className="cat-c-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                {confirming ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--adm-bad)', fontWeight: 500, whiteSpace: 'nowrap' }}>¿Eliminar?</span>
                    <Btn size="sm" variant="danger" onClick={() => del(c)}>Sí</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setConfirmId(null)}>No</Btn>
                  </span>
                ) : (
                  <>
                    <IconBtn icon="ph-arrow-up" label="Subir en el sitio" onClick={() => mover(c, -1)} disabled={pos <= 0} />
                    <IconBtn icon="ph-arrow-down" label="Bajar en el sitio" onClick={() => mover(c, 1)} disabled={pos >= cats.length - 1} />
                    <IconBtn icon="ph-pencil-simple" label="Editar" onClick={() => openEdit(c)} />
                    <IconBtn icon="ph-trash" label="Eliminar" danger onClick={() => { setConfirmId(c.id); setEditing(null); }} />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </Panel>

      {/* Nueva categoría */}
      <Modal
        abierto={nuevaAbierta}
        titulo="Nueva categoría"
        subtitulo="Nombre, imagen y la línea que sale bajo el nombre en el sitio."
        onCerrar={() => setNuevaAbierta(false)}
        ancho={620}
        pie={
          <>
            <Btn variant="ghost" onClick={() => setNuevaAbierta(false)} disabled={creating}>Cancelar</Btn>
            <Btn variant="primary" onClick={create} disabled={creating}>{creating ? 'Creando…' : 'Crear categoría'}</Btn>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="adm-form-grid">
            <FormField label="Nombre">
              <input ref={nameRef} className="adm-input" value={draftName} onChange={(e) => setDraftName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') create(); }} placeholder="Ej. Grúas industriales" />
            </FormField>
            <FormField label="Slug (automático)">
              <div className="adm-input adm-mono adm-ellipsis" style={{ display: 'flex', alignItems: 'center', color: 'var(--adm-muted)', borderStyle: 'dashed', fontSize: 13 }}>
                {draftName.trim() ? slugify(draftName) : 'se-generará-automáticamente'}
              </div>
            </FormField>
          </div>
          <FormField label="Descripción" help="Una línea bajo el nombre, en las tarjetas del sitio.">
            <input className="adm-input" value={draftDescription} onChange={(e) => setDraftDescription(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') create(); }} maxLength={300} placeholder="Ej. Arena, grava, base hidráulica y CNC" />
          </FormField>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Thumb src={draftPreview} size={52} />
            <div style={{ display: 'grid', gap: 4 }}>
              <Btn size="sm" icon="ph-upload-simple" onClick={() => fileRef.current?.click()}>{draftPreview ? 'Cambiar imagen' : 'Elegir imagen'}</Btn>
              <span className="adm-help">PNG, JPG o WebP · opcional</span>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0] ?? null; setDraftFile(f); setDraftPreview(f ? URL.createObjectURL(f) : null); }} style={{ display: 'none' }} />
          </div>
        </div>
      </Modal>

      {/* Editar categoría (nombre + imagen + estado) */}
      <Modal
        abierto={editing !== null}
        titulo="Editar categoría"
        onCerrar={() => { if (!savingEdit && subiendo === null) setEditing(null); }}
        ancho={480}
        pie={
          <>
            <Btn variant="ghost" onClick={() => setEditing(null)} disabled={savingEdit || subiendo !== null}>Cancelar</Btn>
            <Btn variant="primary" onClick={saveEdit} disabled={savingEdit || subiendo !== null}>{savingEdit ? 'Guardando…' : 'Guardar'}</Btn>
          </>
        }
      >
        {editing ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <Thumb src={editPreview ?? editing.image} size={60} />
              <div style={{ display: 'grid', gap: 4 }}>
                <Btn size="sm" icon="ph-upload-simple" onClick={() => editFileRef.current?.click()}>{editPreview ? 'Elegir otra' : 'Cambiar imagen'}</Btn>
                <span className="adm-help">PNG, JPG o WebP</span>
                <input ref={editFileRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0] ?? null; setEditFile(f); setEditPreview(f ? URL.createObjectURL(f) : null); }} style={{ display: 'none' }} />
              </div>
            </div>
            <FormField
              label="Video (opcional)"
              help={`Va en lugar de la foto, en bucle y sin sonido; la foto queda de portada mientras carga. Vertical, como se graba con el celular: con un video, las tarjetas del sitio pasan a verticales. MP4 o WebM, hasta ${VIDEO_MAX_MB} MB; mejor de 5 a 15 s y menos de 10 MB. Se guarda al elegirlo.`}
            >
              <div style={{ display: 'grid', gap: 10 }}>
                {editing.video ? (
                  // Vertical (9:16), como sale en la tarjeta del sitio.
                  <video src={editing.video} poster={editing.image ?? undefined} muted loop autoPlay playsInline controls={false} style={{ height: 240, aspectRatio: '9 / 16', maxWidth: '100%', borderRadius: 10, background: '#000', objectFit: 'cover' }} />
                ) : null}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Btn size="sm" icon="ph-video-camera" onClick={() => videoRef.current?.click()} disabled={subiendo !== null}>
                    {subiendo !== null ? `Subiendo… ${subiendo}%` : editing.video ? 'Cambiar video' : 'Subir video'}
                  </Btn>
                  {editing.video && subiendo === null ? (
                    <Btn size="sm" variant="ghost" icon="ph-trash" onClick={quitarVideo}>Quitar video</Btn>
                  ) : null}
                </div>
                {subiendo !== null ? <Bar pct={subiendo} width={240} /> : null}
                <input ref={videoRef} type="file" accept="video/mp4,video/webm" onChange={(e) => elegirVideo(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
              </div>
            </FormField>
            <FormField label="Nombre">
              <input className="adm-input" value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); }} />
            </FormField>
            <FormField label="Descripción" help="Una línea bajo el nombre en el sitio.">
              <textarea className="adm-textarea" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} maxLength={300} rows={2} placeholder="Ej. Arena, grava, base hidráulica y CNC" />
            </FormField>
            <FormField label="Slug" help="No cambia al renombrar.">
              <div className="adm-input adm-mono adm-ellipsis" style={{ display: 'flex', alignItems: 'center', color: 'var(--adm-faint)', borderStyle: 'dashed', fontSize: 13 }}>{editing.slug}</div>
            </FormField>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
              <span className="adm-label">Estado</span>
              <Switch on={editStatus === 1} onClick={() => setEditStatus((s) => (s === 1 ? 0 : 1))} label={editStatus === 1 ? 'Activa' : 'Inactiva'} />
            </div>
          </div>
        ) : null}
      </Modal>

      {toast ? <Toast kind={toast.kind === 'warn' ? 'bad' : 'ok'}>{toast.text}</Toast> : null}
    </div>
  );
}
