'use client';

import { useMemo, useRef, useState, type CSSProperties } from 'react';

export interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  status: number;
  image: string | null;
  productCount: number;
}

const C = {
  panel: '#141416', panel2: '#1b1e26', panel3: '#212530',
  line: 'rgba(255,255,255,0.07)', line2: 'rgba(255,255,255,0.12)',
  ink: '#f2f4f7', muted: '#9aa1ad', dim: '#6b7280',
  amber: 'var(--color-primary)', amber2: 'color-mix(in srgb, var(--color-primary) 72%, #fff)', amberInk: 'var(--color-primary-fg)', warn: 'var(--color-warning)', ok: 'var(--color-success)',
  blue: '#4f9cff', green: '#31c46b', red: '#ff5c5c',
};
const FONT = "'Manrope', system-ui, sans-serif";
const GRID = '70px minmax(0,1.5fr) minmax(0,1.2fr) minmax(0,1fr) 0.95fr 1.1fr';

function slugify(s: string) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const inputStyle: CSSProperties = { width: '100%', background: C.panel2, border: `1px solid ${C.line2}`, color: C.ink, borderRadius: 11, padding: '12px 14px', fontSize: 14, outline: 'none', fontFamily: 'inherit' };

export function CategoriesManager({ initial }: { initial: CategoryRow[] }) {
  const [cats, setCats] = useState<CategoryRow[]>(initial);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'todas' | 'activas' | 'inactivas'>('todas');
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState(1);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const editFileRef = useRef<HTMLInputElement>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'warn' | 'trash' } | null>(null);

  const [draftName, setDraftName] = useState('');
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftPreview, setDraftPreview] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const newCardRef = useRef<HTMLDivElement>(null);
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
      if (draftFile) fd.append('photo', draftFile);
      const r = await fetch('/api/admin/catalog/categories', { method: 'POST', body: fd });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.message ?? 'No se pudo crear');
      setDraftName(''); setDraftFile(null); setDraftPreview(null);
      if (fileRef.current) fileRef.current.value = '';
      await reload();
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
    setEditing(c); setEditName(c.name); setEditStatus(c.status);
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

  async function del(c: CategoryRow) {
    setConfirmId(null);
    const r = await fetch(`/api/admin/catalog/categories/${c.id}`, { method: 'DELETE' });
    const d = await r.json().catch(() => null);
    if (!r.ok) { flash(d?.message ?? 'No se pudo eliminar', 'warn'); return; }
    setCats((cs) => cs.filter((x) => x.id !== c.id));
    flash(`«${c.name}» eliminada`, 'trash');
  }

  function focusNew() {
    newCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => nameRef.current?.focus(), 200);
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

  const statCard = (label: string, value: number | string, icon: string, color: string, valColor?: string) => (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12.5, color: C.muted, fontWeight: 500 }}>{label}</div>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: `color-mix(in srgb, ${color} 14%, transparent)`, display: 'grid', placeItems: 'center', color }}><i className={`ph ${icon}`} style={{ fontSize: 16 }} /></div>
      </div>
      <div style={{ fontWeight: 800, fontSize: 30, marginTop: 8, color: valColor ?? C.ink }}>{value}</div>
    </div>
  );

  const filterBtn = (key: typeof filter, label: string) => {
    const on = filter === key;
    return <button type="button" onClick={() => setFilter(key)} style={{ background: on ? C.amber : C.panel, color: on ? C.amberInk : C.muted, border: `1px solid ${on ? C.amber : C.line}`, fontWeight: on ? 700 : 600, fontSize: 13, padding: '9px 16px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>;
  };

  return (
    <div style={{ fontFamily: FONT, color: C.ink }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" />
      <style>{`
        /* Estas clases ya existían en el marcado pero nunca tuvieron CSS: las
           6 columnas se encimaban en móvil. Cada fila pasa a tarjeta y el
           formulario de alta se apila. */
        @media (max-width: 900px) {
          .cat-stats { grid-template-columns: 1fr 1fr !important; }
          .cat-newgrid { grid-template-columns: 1fr !important; }
          .cat-thead { display: none !important; }
          .cat-row { display: flex !important; flex-wrap: wrap; align-items: center; gap: 10px 12px !important; padding: 16px !important; }
          .cat-row > .cat-c-img { flex: 0 0 auto; }
          /* base = resto del renglón tras la imagen (48px + 12 de gap) */
          .cat-row > .cat-c-name { flex: 1 1 calc(100% - 60px); }
          .cat-row > .cat-c-slug, .cat-row > .cat-c-prod, .cat-row > .cat-c-state { flex: 0 0 auto; }
          .cat-row > .cat-c-actions { flex: 1 0 100%; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, color: C.dim, fontWeight: 300, marginBottom: 6 }}>Catálogo <span style={{ margin: '0 6px' }}>/</span> <span style={{ color: C.muted }}>Categorías</span></div>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.01em', margin: 0 }}>Categorías</h1>
        </div>
        <button type="button" onClick={focusNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: C.amber, color: C.amberInk, border: 'none', fontWeight: 700, fontSize: 14, padding: '12px 20px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 12px 26px -14px color-mix(in srgb, var(--color-primary) 70%, transparent)' }}><i className="ph-bold ph-plus" style={{ fontSize: 15 }} /> Nueva categoría</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 22 }} className="cat-stats">
        {statCard('Categorías', stats.total, 'ph-squares-four', C.amber)}
        {statCard('Activas', stats.activas, 'ph-check-circle', C.green, C.green)}
        {statCard('Productos', stats.productos, 'ph-package', C.blue)}
        {statCard('Sin productos', stats.vacias, 'ph-warning', C.red)}
      </div>

      {/* Nueva categoría */}
      <div ref={newCardRef} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: '24px 26px', marginBottom: 22, transition: 'box-shadow .3s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: C.amber }} /><div style={{ fontWeight: 700, fontSize: 17 }}>Nueva categoría</div></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr) auto auto', gap: 14, alignItems: 'end' }} className="cat-newgrid">
          <label style={{ display: 'grid', gap: 7 }}>
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Nombre</span>
            <input ref={nameRef} value={draftName} onChange={(e) => setDraftName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') create(); }} placeholder="Ej. Grúas industriales" style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 7, minWidth: 0 }}>
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Slug (automático)</span>
            <div style={{ background: C.panel2, border: `1px dashed ${C.line2}`, color: C.muted, borderRadius: 11, padding: '12px 14px', fontSize: 13.5, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{draftName.trim() ? slugify(draftName) : 'se-generará-automáticamente'}</div>
          </label>
          <div style={{ display: 'grid', gap: 7 }}>
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Imagen</span>
            <button type="button" onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 9, background: C.panel2, border: `1px solid ${C.line2}`, color: C.ink, borderRadius: 11, padding: '10px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', height: 46 }}>
              <span style={{ width: 24, height: 24, borderRadius: 6, background: draftPreview ? `center/cover no-repeat url(${draftPreview})` : C.panel3, display: 'grid', placeItems: 'center', color: C.dim, fontSize: 12, flexShrink: 0 }}>{draftPreview ? '' : <i className="ph ph-image" />}</span>
              {draftPreview ? 'Cambiar' : 'Elegir'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0] ?? null; setDraftFile(f); setDraftPreview(f ? URL.createObjectURL(f) : null); }} style={{ display: 'none' }} />
          </div>
          <button type="button" onClick={create} disabled={creating} style={{ background: C.amber, color: C.amberInk, border: 'none', fontWeight: 700, fontSize: 14, padding: '0 26px', borderRadius: 11, cursor: creating ? 'default' : 'pointer', height: 46, opacity: creating ? 0.7 : 1, fontFamily: 'inherit' }}>{creating ? 'Creando…' : 'Crear'}</button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px', maxWidth: 360, display: 'flex', alignItems: 'center', gap: 10, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '10px 14px' }}>
          <i className="ph ph-magnifying-glass" style={{ color: C.dim, fontSize: 15 }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar categoría..." style={{ flex: 1, border: 'none', background: 'transparent', color: C.ink, fontSize: 13.5, outline: 'none', fontFamily: 'inherit' }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>{filterBtn('todas', 'Todas')}{filterBtn('activas', 'Activas')}{filterBtn('inactivas', 'Inactivas')}</div>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: C.muted, fontWeight: 300 }}>{rows.length} de {stats.total}</div>
      </div>

      {/* Tabla */}
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 16, padding: '15px 22px', borderBottom: `1px solid ${C.line}`, fontSize: 11.5, letterSpacing: '.06em', color: C.dim, fontWeight: 700, textTransform: 'uppercase', alignItems: 'center' }} className="cat-thead">
          <div /><div>Nombre</div><div>Slug</div><div>Productos</div><div>Estado</div><div style={{ textAlign: 'right' }}>Acciones</div>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: '56px 20px', textAlign: 'center', color: C.dim }}>
            <i className="ph ph-squares-four" style={{ fontSize: 34, opacity: 0.5, display: 'block', marginBottom: 10 }} />
            <div style={{ fontWeight: 600, fontSize: 15, color: C.muted }}>No se encontraron categorías</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Ajusta la búsqueda o crea una nueva.</div>
          </div>
        ) : rows.map((c) => {
          const pct = Math.max(6, Math.round((c.productCount / maxProd) * 100));
          const confirming = confirmId === c.id;
          return (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 16, padding: '14px 22px', borderBottom: `1px solid ${C.line}`, alignItems: 'center' }} className="cat-row">
              {/* Imagen */}
              <div className="cat-c-img" style={{ width: 48, height: 48, borderRadius: 11, overflow: 'hidden', background: C.panel3, display: 'grid', placeItems: 'center', color: C.dim }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.image ? <img src={c.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <i className="ph ph-image" style={{ fontSize: 17 }} />}
              </div>
              {/* Nombre */}
              <div className="cat-c-name" style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
              </div>
              {/* Slug */}
              <div className="cat-c-slug" style={{ fontSize: 13.5, color: C.muted, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.slug}</div>
              {/* Productos */}
              <div className="cat-c-prod" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 64, height: 6, borderRadius: 999, background: C.panel3, overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: c.productCount === 0 ? '#3a4150' : C.amber, borderRadius: 999 }} /></div>
                <span style={{ fontSize: 13, fontWeight: 700, color: c.productCount === 0 ? C.dim : C.ink }}>{c.productCount}</span>
              </div>
              {/* Estado */}
              <div className="cat-c-state">
                <button type="button" onClick={() => toggle(c)} title="Activar / Desactivar" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <span style={{ width: 40, height: 22, borderRadius: 999, background: c.status === 1 ? C.green : '#3a4150', position: 'relative', transition: 'background .25s', display: 'inline-block' }}><span style={{ position: 'absolute', top: 2, left: c.status === 1 ? 20 : 2, width: 18, height: 18, borderRadius: 999, background: '#fff', transition: 'left .25s', boxShadow: '0 2px 4px rgba(0,0,0,.4)' }} /></span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: c.status === 1 ? C.green : C.dim }}>{c.status === 1 ? 'Activa' : 'Inactiva'}</span>
                </button>
              </div>
              {/* Acciones */}
              <div className="cat-c-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                {confirming ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,92,92,.1)', border: '1px solid rgba(255,92,92,.3)', borderRadius: 10, padding: '6px 10px' }}>
                    <span style={{ fontSize: 12, color: C.red, fontWeight: 600 }}>¿Eliminar?</span>
                    <button type="button" onClick={() => del(c)} style={{ fontSize: 12, fontWeight: 800, color: C.red, cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' }}>Sí</button>
                    <button type="button" onClick={() => setConfirmId(null)} style={{ fontSize: 12, fontWeight: 700, color: C.muted, cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' }}>No</button>
                  </span>
                ) : (
                  <>
                    <button type="button" title="Editar" onClick={() => openEdit(c)} style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${C.line}`, background: C.panel2, color: C.muted, cursor: 'pointer', display: 'grid', placeItems: 'center' }}><i className="ph ph-pencil-simple" style={{ fontSize: 14 }} /></button>
                    <button type="button" title="Eliminar" onClick={() => { setConfirmId(c.id); setEditing(null); }} style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${C.line}`, background: C.panel2, color: C.muted, cursor: 'pointer', display: 'grid', placeItems: 'center' }}><i className="ph ph-trash" style={{ fontSize: 14 }} /></button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: editar categoría (nombre + imagen + estado) */}
      {editing ? (
        <div onClick={() => { if (!savingEdit) setEditing(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.62)', display: 'grid', placeItems: 'center', zIndex: 300, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(460px, 100%)', background: C.panel, border: `1px solid ${C.line2}`, borderRadius: 18, padding: 24, display: 'grid', gap: 18, boxShadow: '0 30px 70px -30px rgba(0,0,0,.85)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Editar categoría</h3>
              <button type="button" onClick={() => setEditing(null)} style={{ width: 32, height: 32, borderRadius: 9, border: `1px solid ${C.line}`, background: C.panel2, color: C.muted, cursor: 'pointer', display: 'grid', placeItems: 'center' }}><i className="ph ph-x" /></button>
            </div>
            {/* Imagen */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 66, height: 66, borderRadius: 12, overflow: 'hidden', background: C.panel3, display: 'grid', placeItems: 'center', color: C.dim, flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {editPreview ? <img src={editPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : editing.image ? <img src={editing.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <i className="ph ph-image" style={{ fontSize: 20 }} />}
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <button type="button" onClick={() => editFileRef.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: C.panel2, border: `1px solid ${C.line2}`, color: C.ink, borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><i className="ph ph-upload-simple" /> {editPreview ? 'Elegir otra' : 'Cambiar imagen'}</button>
                <span style={{ fontSize: 11.5, color: C.dim }}>PNG, JPG o WebP</span>
                <input ref={editFileRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0] ?? null; setEditFile(f); setEditPreview(f ? URL.createObjectURL(f) : null); }} style={{ display: 'none' }} />
              </div>
            </div>
            {/* Nombre */}
            <label style={{ display: 'grid', gap: 7 }}>
              <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Nombre</span>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); }} style={inputStyle} />
            </label>
            {/* Slug */}
            <label style={{ display: 'grid', gap: 7 }}>
              <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Slug (no cambia al renombrar)</span>
              <div style={{ background: C.panel2, border: `1px dashed ${C.line2}`, color: C.dim, borderRadius: 11, padding: '12px 14px', fontSize: 13.5, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{editing.slug}</div>
            </label>
            {/* Estado */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>Estado</span>
              <button type="button" onClick={() => setEditStatus((s) => (s === 1 ? 0 : 1))} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                <span style={{ width: 40, height: 22, borderRadius: 999, background: editStatus === 1 ? C.green : '#3a4150', position: 'relative', display: 'inline-block' }}><span style={{ position: 'absolute', top: 2, left: editStatus === 1 ? 20 : 2, width: 18, height: 18, borderRadius: 999, background: '#fff', transition: 'left .2s' }} /></span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: editStatus === 1 ? C.green : C.dim }}>{editStatus === 1 ? 'Activa' : 'Inactiva'}</span>
              </button>
            </div>
            {/* Acciones */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={() => setEditing(null)} disabled={savingEdit} style={{ border: `1px solid ${C.line2}`, background: 'transparent', color: C.ink, borderRadius: 11, padding: '10px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', opacity: savingEdit ? 0.6 : 1 }}>Cancelar</button>
              <button type="button" onClick={saveEdit} disabled={savingEdit} style={{ border: 'none', background: C.amber, color: C.amberInk, borderRadius: 11, padding: '10px 20px', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', opacity: savingEdit ? 0.7 : 1 }}>{savingEdit ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Toast */}
      {toast ? (
        <div style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 10, background: C.panel3, border: `1px solid ${C.line2}`, color: C.ink, padding: '13px 20px', borderRadius: 12, boxShadow: '0 24px 60px -30px rgba(0,0,0,.85)', fontSize: 14, fontWeight: 600, zIndex: 200 }}>
          <i className={`ph-bold ${toast.kind === 'warn' ? 'ph-warning-circle' : toast.kind === 'trash' ? 'ph-trash' : 'ph-check-circle'}`} style={{ fontSize: 18, color: toast.kind === 'warn' ? C.red : C.ok }} /> {toast.text}
        </div>
      ) : null}
    </div>
  );
}
