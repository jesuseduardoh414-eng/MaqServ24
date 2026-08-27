'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { unidadesDe, atributosDe } from '@maqserv/config';
import { Pagination } from '@/components/Pagination';

export interface ProductRow {
  id: number;
  slug: string;
  name: string;
  brand: string | null;
  price: number | null;
  stock: number | null;
  status: number;
  featured: boolean;
  isRental: boolean;
  image: string | null;
  categoryName: string | null;
}
export interface CatOption { id: number; name: string; slug: string }

const C = {
  panel: '#141416', panel2: '#1b1e26', panel3: '#212530',
  line: 'rgba(255,255,255,0.07)', line2: 'rgba(255,255,255,0.12)',
  ink: '#f2f4f7', muted: '#9aa1ad', dim: '#6b7280',
  amber: 'var(--color-primary)', amberInk: 'var(--color-primary-fg)', warn: 'var(--color-warning)', ok: 'var(--color-success)', blue: '#4f9cff', green: '#31c46b', red: '#ff5c5c',
};
const FONT = "'Inter', system-ui, sans-serif";
const GRID = '64px minmax(0,1.7fr) minmax(0,1.05fr) 0.9fr 0.95fr 0.9fr 1.35fr';
const inputStyle: CSSProperties = { width: '100%', background: C.panel2, border: `1px solid ${C.line2}`, color: C.ink, borderRadius: 11, padding: '12px 14px', fontSize: 14, outline: 'none', fontFamily: 'inherit' };
const labelStyle: CSSProperties = { display: 'block', fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 7 };
const fmt = (n: number | null) => '$' + Number(n ?? 0).toLocaleString('en-US');

interface Form {
  name: string; brand: string; categoryId: number; price: string; oldPrice: string;
  stock: string; short: string; description: string; specs: Array<{ label: string; value: string }>;
  isRental: boolean; rentalFreight: string; featured: boolean; status: number;
  /** Unidad en la que esta el precio: mes, dia, viaje, tonelada. '' = por pieza. */
  priceUnit: string;
  /** Ficha tecnica estructurada, por clave de atributo. */
  attributes: Record<string, string>;
}

export function ProductsManager({ initial, categories }: { initial: ProductRow[]; categories: CatOption[] }) {
  const emptyForm: Form = { name: '', brand: '', categoryId: categories[0]?.id ?? 0, price: '', oldPrice: '', stock: '', short: '', description: '', specs: [], isRental: false, rentalFreight: '', featured: false, status: 1, priceUnit: '', attributes: {} };

  const [items, setItems] = useState<ProductRow[]>(initial);
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('todas');
  const [filter, setFilter] = useState<'todos' | 'activos' | 'destacados'>('todos');
  const [sort, setSort] = useState('rel');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'warn' | 'trash' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [gallery, setGallery] = useState<Array<{ id: number; url: string }>>([]);
  const [galBusy, setGalBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const setF = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function uploadGallery(files: FileList | null) {
    if (!files || !editingId) return;
    const slots = 6 - gallery.length;
    if (slots <= 0) { flash('Máximo 6 imágenes por producto', 'warn'); return; }
    const toUpload = Array.from(files).slice(0, slots);
    setGalBusy(true);
    const added: Array<{ id: number; url: string }> = [];
    for (const f of toUpload) {
      const fd = new FormData();
      fd.append('photo', f);
      const r = await fetch(`/api/admin/catalog/products/${editingId}/gallery`, { method: 'POST', body: fd });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.id) added.push(d); else flash(d?.message ?? 'No se pudo subir una imagen', 'warn');
    }
    if (added.length) setGallery((g) => [...g, ...added]);
    if (files.length > slots) flash('Solo caben 6 imágenes; se subieron las primeras.', 'warn');
    setGalBusy(false);
  }
  async function delGallery(gid: number) {
    const r = await fetch(`/api/admin/catalog/products/${editingId}/gallery/${gid}`, { method: 'DELETE' });
    if (r.ok) setGallery((g) => g.filter((x) => x.id !== gid)); else flash('No se pudo eliminar la imagen', 'warn');
  }

  function flash(text: string, kind: 'ok' | 'warn' | 'trash' = 'ok') {
    setToast({ text, kind });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  async function reload() {
    // Una sola consulta (pageSize alto). Fallback en bucle si la API aún pagina 20/pág.
    let all: ProductRow[] = [];
    let pages = 1;
    for (let p = 1; p <= pages && p <= 25; p++) {
      const r = await fetch(`/api/admin/catalog/products?page=${p}&pageSize=500`);
      if (!r.ok) break;
      const d = await r.json().catch(() => null);
      if (!d) break;
      all = all.concat(d.items ?? []);
      pages = d.pages ?? 1;
    }
    const seen = new Set<number>();
    setItems(all.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true))));
  }

  async function toggleStatus(p: ProductRow) {
    const next = p.status === 1 ? 0 : 1;
    setItems((xs) => xs.map((x) => (x.id === p.id ? { ...x, status: next } : x)));
    const r = await fetch(`/api/admin/catalog/products/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) });
    if (!r.ok) { setItems((xs) => xs.map((x) => (x.id === p.id ? { ...x, status: p.status } : x))); flash('No se pudo cambiar el estado', 'warn'); return; }
    flash(next === 1 ? `«${p.name}» activado` : `«${p.name}» desactivado`);
  }
  async function toggleFeature(p: ProductRow) {
    const next = !p.featured;
    setItems((xs) => xs.map((x) => (x.id === p.id ? { ...x, featured: next } : x)));
    const r = await fetch(`/api/admin/catalog/products/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ featured: next }) });
    if (!r.ok) { setItems((xs) => xs.map((x) => (x.id === p.id ? { ...x, featured: p.featured } : x))); flash('No se pudo cambiar', 'warn'); return; }
    flash(next ? 'Marcado como destacado ★' : 'Quitado de destacados');
  }
  async function del(p: ProductRow) {
    setConfirmId(null);
    const r = await fetch(`/api/admin/catalog/products/${p.id}`, { method: 'DELETE' });
    if (!r.ok) { flash('No se pudo dar de baja', 'warn'); return; }
    setItems((xs) => xs.map((x) => (x.id === p.id ? { ...x, status: 0 } : x)));
    flash(`«${p.name}» dado de baja`, 'trash');
  }

  function openNew() {
    setEditingId(null); setForm(emptyForm); setFile(null); setPreview(null); setCurrentImage(null); setConfirmId(null); setGallery([]); setModalOpen(true);
  }
  async function openEdit(p: ProductRow) {
    setEditingId(p.id); setConfirmId(null); setFile(null); setPreview(null); setCurrentImage(p.image); setGallery([]); setModalOpen(true);
    fetch(`/api/admin/catalog/products/${p.id}/gallery`).then((r) => (r.ok ? r.json() : [])).then((g) => setGallery(Array.isArray(g) ? g : [])).catch(() => setGallery([]));
    setForm({ ...emptyForm, name: p.name, brand: p.brand ?? '', price: p.price != null ? String(p.price) : '', stock: p.stock != null ? String(p.stock) : '', featured: p.featured, status: p.status, isRental: p.isRental });
    setLoadingDetail(true);
    try {
      const r = await fetch(`/api/admin/catalog/products/${p.id}`);
      if (r.ok) {
        const d = await r.json();
        setForm({
          name: d.name ?? '', brand: d.brand ?? '', categoryId: d.categoryId ?? (categories[0]?.id ?? 0),
          price: d.price != null ? String(d.price) : '', oldPrice: d.oldPrice != null ? String(d.oldPrice) : '',
          stock: d.stock != null ? String(d.stock) : '', short: d.short ?? '', description: d.description ?? '',
          specs: Array.isArray(d.specs) ? d.specs.map((s: { label?: string; value?: string }) => ({ label: String(s.label ?? ''), value: String(s.value ?? '') })) : [],
          isRental: !!d.isRental, rentalFreight: d.rentalFreight != null ? String(d.rentalFreight) : '',
          priceUnit: d.priceUnit ?? '',
          attributes: (d.attributes as Record<string, string> | null) ?? {},
          featured: !!d.featured, status: d.status ?? 1,
        });
        setCurrentImage(d.image ?? null);
      }
    } finally { setLoadingDetail(false); }
  }

  async function save() {
    if (form.name.trim().length < 2) { flash('Escribe el nombre del producto', 'warn'); return; }
    if (!form.categoryId) { flash('Elige una categoría', 'warn'); return; }
    if (form.description.trim().length < 1) { flash('Escribe una descripción', 'warn'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('categoryId', String(form.categoryId));
      fd.append('price', String(parseFloat(form.price) || 0));
      if (form.oldPrice !== '') fd.append('oldPrice', String(parseFloat(form.oldPrice) || 0));
      fd.append('description', form.description.trim());
      fd.append('short', form.short.trim());
      fd.append('specs', JSON.stringify(form.specs.map((s) => ({ label: s.label.trim(), value: s.value.trim() })).filter((s) => s.label)));
      if (form.stock !== '') fd.append('stock', String(parseInt(form.stock, 10) || 0));
      if (form.brand.trim()) fd.append('brand', form.brand.trim());
      fd.append('isRental', form.isRental ? '1' : ''); // '' → z.coerce.boolean false
      // Vacio = por pieza. Se manda siempre para poder BORRAR la unidad de un
      // producto que dejo de ser renta; omitirlo dejaria la anterior pegada.
      fd.append('priceUnit', form.priceUnit);
      // Va como JSON porque el alta usa multipart (sube la foto) y ahi todo es texto.
      fd.append('attributes', JSON.stringify(form.attributes));
      if (form.isRental && form.rentalFreight !== '') fd.append('rentalFreight', String(parseFloat(form.rentalFreight) || 0));
      fd.append('featured', form.featured ? '1' : '');
      fd.append('status', String(form.status));
      if (file) fd.append('photo', file);
      const url = editingId ? `/api/admin/catalog/products/${editingId}` : '/api/admin/catalog/products';
      const r = await fetch(url, { method: editingId ? 'PATCH' : 'POST', body: fd });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.message ?? 'No se pudo guardar');
      await reload();
      setModalOpen(false);
      flash(editingId ? 'Producto actualizado' : `Producto «${form.name.trim()}» creado`);
    } catch (e) { flash((e as Error).message, 'warn'); } finally { setSaving(false); }
  }

  const stats = useMemo(() => ({
    total: items.length,
    activos: items.filter((p) => p.status === 1).length,
    destacados: items.filter((p) => p.featured).length,
    bajo: items.filter((p) => p.stock != null && p.stock <= 3).length,
  }), [items]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items.filter((p) => {
      if (catFilter !== 'todas' && p.categoryName !== catFilter) return false;
      if (filter === 'activos' && p.status !== 1) return false;
      if (filter === 'destacados' && !p.featured) return false;
      if (q && !(p.name.toLowerCase().includes(q) || (p.brand ?? '').toLowerCase().includes(q))) return false;
      return true;
    });
    if (sort === 'asc') list = [...list].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    else if (sort === 'desc') list = [...list].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    else if (sort === 'stock') list = [...list].sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0));
    else if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [items, query, catFilter, filter, sort]);

  // Al cambiar filtros/búsqueda/orden/tamaño volvemos a la primera página.
  useEffect(() => { setPage(1); }, [query, catFilter, filter, sort, pageSize]);

  // Paginación en cliente: solo pintamos la página actual (no todas las filas).
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  const rangeInfo = rows.length === 0
    ? 'Sin resultados'
    : `Mostrando ${start + 1}–${start + pageRows.length} de ${rows.length}${rows.length !== stats.total ? ` (de ${stats.total})` : ''}`;

  const stockInfo = (stock: number | null) => {
    if (stock == null) return { color: C.dim, label: 'Sin dato', val: '—' as number | string };
    if (stock === 0) return { color: C.red, label: 'Agotado', val: stock };
    if (stock <= 3) return { color: C.warn, label: 'Bajo stock', val: stock };
    return { color: C.green, label: 'Disponible', val: stock };
  };

  const statCard = (label: string, value: number, icon: string, color: string, valColor?: string) => (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12.5, color: C.muted, fontWeight: 500 }}>{label}</div>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: `color-mix(in srgb, ${color} 14%, transparent)`, display: 'grid', placeItems: 'center', color }}><i className={`ph ${icon}`} style={{ fontSize: 16 }} /></div>
      </div>
      <div style={{ fontWeight: 800, fontSize: 30, marginTop: 8, color: valColor ?? C.ink }}>{value}</div>
    </div>
  );
  const chip = (on: boolean): CSSProperties => ({ background: on ? C.amber : C.panel, color: on ? C.amberInk : C.muted, border: `1px solid ${on ? C.amber : C.line}`, fontWeight: 600, fontSize: 13, padding: '9px 15px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit' });
  const selStyle: CSSProperties = { background: C.panel, border: `1px solid ${C.line}`, color: C.ink, borderRadius: 11, padding: '11px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none', fontFamily: 'inherit', colorScheme: 'dark' };
  const Switch = ({ on }: { on: boolean }) => (
    <span style={{ width: 40, height: 22, borderRadius: 999, background: on ? C.green : '#3a4150', position: 'relative', display: 'inline-block', flexShrink: 0 }}><span style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: 999, background: '#fff', transition: 'left .2s' }} /></span>
  );

  return (
    <div style={{ fontFamily: FONT, color: C.ink }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />
      <style>{`
        /* Las 7 columnas de la tabla no caben en móvil: cada fila pasa a ser
           una tarjeta (imagen + nombre arriba; categoría, precio, stock y
           estado envueltos debajo; acciones en su propio renglón).
           Se oculta la cabecera porque ya no encabeza nada. */
        @media (max-width: 900px) {
          .pr-stats { grid-template-columns: 1fr 1fr !important; }
          .pr-head { display: none !important; }
          .pr-row { display: flex !important; flex-wrap: wrap; align-items: center; gap: 10px 12px !important; padding: 16px !important; }
          .pr-row > .pr-img { flex: 0 0 auto; }
          /* base = ancho restante tras la imagen (48px + 12 de gap): así el
             nombre agota el primer renglón y las demás celdas bajan juntas,
             en vez de acomodarse distinto según lo largo que sea el nombre. */
          .pr-row > .pr-name { flex: 1 1 calc(100% - 60px); }
          .pr-row > .pr-cat, .pr-row > .pr-price, .pr-row > .pr-stock, .pr-row > .pr-state { flex: 0 0 auto; }
          .pr-row > .pr-actions { flex: 1 0 100%; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, color: C.dim, fontWeight: 300, marginBottom: 6 }}>Catálogo <span style={{ margin: '0 6px' }}>/</span> <span style={{ color: C.muted }}>Productos</span></div>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.01em', margin: 0 }}>Productos <span style={{ color: C.dim, fontWeight: 600, fontSize: 22 }}>({stats.total})</span></h1>
        </div>
        <button type="button" onClick={openNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: C.amber, color: C.amberInk, border: 'none', fontWeight: 700, fontSize: 14, padding: '12px 20px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 12px 26px -14px color-mix(in srgb, var(--color-primary) 70%, transparent)' }}><i className="ph-bold ph-plus" style={{ fontSize: 15 }} /> Nuevo producto</button>
      </div>

      {/* Stats */}
      <div className="pr-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 22 }}>
        {statCard('Productos', stats.total, 'ph-cube', C.blue)}
        {statCard('Activos', stats.activos, 'ph-check-circle', C.green, C.green)}
        {statCard('Destacados', stats.destacados, 'ph-star', C.amber, C.amber)}
        {statCard('Bajo stock', stats.bajo, 'ph-warning', C.red)}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px', maxWidth: 320, display: 'flex', alignItems: 'center', gap: 10, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '10px 14px' }}>
          <i className="ph ph-magnifying-glass" style={{ color: C.dim, fontSize: 15 }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto o marca..." style={{ flex: 1, border: 'none', background: 'transparent', color: C.ink, fontSize: 13.5, outline: 'none', fontFamily: 'inherit' }} />
        </div>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} style={selStyle}>
          <option value="todas">Todas las categorías</option>
          {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => setFilter('todos')} style={chip(filter === 'todos')}>Todos</button>
          <button type="button" onClick={() => setFilter('activos')} style={chip(filter === 'activos')}>Activos</button>
          <button type="button" onClick={() => setFilter('destacados')} style={chip(filter === 'destacados')}>★ Destacados</button>
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ ...selStyle, marginLeft: 'auto' }}>
          <option value="rel">Ordenar: Relevancia</option>
          <option value="asc">Precio: menor</option>
          <option value="desc">Precio: mayor</option>
          <option value="stock">Stock</option>
          <option value="name">Nombre A-Z</option>
        </select>
      </div>

      {/* Tabla */}
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, overflow: 'hidden' }}>
        <div className="pr-head" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 14, padding: '15px 22px', borderBottom: `1px solid ${C.line}`, fontSize: 11.5, letterSpacing: '.06em', color: C.dim, fontWeight: 700, textTransform: 'uppercase', alignItems: 'center' }}>
          <div /><div>Producto</div><div>Categoría</div><div>Precio</div><div>Stock</div><div>Estado</div><div style={{ textAlign: 'right' }}>Acciones</div>
        </div>
        {rows.length === 0 ? (
          <div style={{ padding: '56px 20px', textAlign: 'center', color: C.dim }}>
            <i className="ph ph-cube" style={{ fontSize: 34, opacity: 0.5, display: 'block', marginBottom: 10 }} />
            <div style={{ fontWeight: 600, fontSize: 15, color: C.muted }}>No se encontraron productos</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Ajusta los filtros o crea un nuevo producto.</div>
          </div>
        ) : pageRows.map((p) => {
          const s = stockInfo(p.stock);
          const confirming = confirmId === p.id;
          return (
            <div key={p.id} className="pr-row" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 14, padding: '13px 22px', borderBottom: `1px solid ${C.line}`, alignItems: 'center' }}>
              {/* Imagen + estrella */}
              <div className="pr-img" style={{ position: 'relative', width: 48, height: 48, borderRadius: 11, overflow: 'hidden', background: C.panel3, display: 'grid', placeItems: 'center', color: C.dim }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.image ? <img src={p.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <i className="ph ph-image" style={{ fontSize: 17 }} />}
                {p.featured ? <span style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 999, background: C.amber, color: C.amberInk, fontSize: 11, display: 'grid', placeItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,.5)' }}><i className="ph ph-star" style={{ fontSize: 10 }} /></span> : null}
              </div>
              {/* Nombre + marca */}
              <div className="pr-name" style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontSize: 12, color: C.dim, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.brand || '—'}</div>
              </div>
              {/* Categoría */}
              <div className="pr-cat" style={{ minWidth: 0 }}>{p.categoryName ? <span style={{ display: 'inline-block', fontSize: 12, color: C.blue, fontWeight: 600, background: 'rgba(79,156,255,.1)', padding: '4px 10px', borderRadius: 999, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.categoryName}</span> : <span style={{ color: C.dim, fontSize: 12 }}>—</span>}</div>
              {/* Precio */}
              <div className="pr-price" style={{ fontWeight: 800, fontSize: 14.5 }}>{fmt(p.price)}</div>
              {/* Stock */}
              <div className="pr-stock">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: s.color }}><span style={{ width: 7, height: 7, borderRadius: 999, background: s.color }} />{s.val}</span>
                <div style={{ fontSize: 10.5, color: C.dim, fontWeight: 500, marginTop: 1 }}>{s.label}</div>
              </div>
              {/* Estado */}
              <div className="pr-state">
                <button type="button" onClick={() => toggleStatus(p)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <Switch on={p.status === 1} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: p.status === 1 ? C.green : C.dim }}>{p.status === 1 ? 'Activo' : 'Inactivo'}</span>
                </button>
              </div>
              {/* Acciones */}
              <div className="pr-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                {confirming ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,92,92,.1)', border: '1px solid rgba(255,92,92,.3)', borderRadius: 10, padding: '6px 10px' }}>
                    <span style={{ fontSize: 12, color: C.red, fontWeight: 600 }}>¿Dar de baja?</span>
                    <button type="button" onClick={() => del(p)} style={{ fontSize: 12, fontWeight: 800, color: C.red, cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' }}>Sí</button>
                    <button type="button" onClick={() => setConfirmId(null)} style={{ fontSize: 12, fontWeight: 700, color: C.muted, cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' }}>No</button>
                  </span>
                ) : (
                  <>
                    <button type="button" title={p.featured ? 'Quitar destacado' : 'Destacar'} onClick={() => toggleFeature(p)} style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${p.featured ? C.amber : C.line}`, background: p.featured ? 'color-mix(in srgb, var(--color-primary) 16%, transparent)' : C.panel2, color: p.featured ? C.amber : C.muted, cursor: 'pointer', display: 'grid', placeItems: 'center' }}><i className={p.featured ? 'ph ph-star' : 'ph ph-star'} style={{ fontSize: 14 }} /></button>
                    <button type="button" title="Editar" onClick={() => openEdit(p)} style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${C.line}`, background: C.panel2, color: C.muted, cursor: 'pointer', display: 'grid', placeItems: 'center' }}><i className="ph ph-pencil-simple" style={{ fontSize: 14 }} /></button>
                    <button type="button" title="Dar de baja" onClick={() => { setConfirmId(p.id); }} style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${C.line}`, background: C.panel2, color: C.muted, cursor: 'pointer', display: 'grid', placeItems: 'center' }}><i className="ph ph-trash" style={{ fontSize: 14 }} /></button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <Pagination
        page={current}
        pageCount={pageCount}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[12, 24, 48]}
        info={rangeInfo}
      />


      {/* Modal crear/editar */}
      {modalOpen ? (
        <div onClick={() => { if (!saving) setModalOpen(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(3,4,7,.7)', display: 'grid', placeItems: 'center', zIndex: 300, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: C.panel, border: `1px solid ${C.line2}`, borderRadius: 20, boxShadow: '0 30px 70px -30px rgba(0,0,0,.85)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 26px', borderBottom: `1px solid ${C.line}`, position: 'sticky', top: 0, background: C.panel, zIndex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{editingId ? 'Editar producto' : 'Nuevo producto'}{loadingDetail ? ' · cargando…' : ''}</div>
              <button type="button" onClick={() => setModalOpen(false)} style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${C.line}`, background: C.panel2, color: C.muted, cursor: 'pointer', display: 'grid', placeItems: 'center' }}><i className="ph ph-x" /></button>
            </div>
            <div style={{ padding: '22px 26px', display: 'grid', gap: 15 }}>
              {/* Imagen */}
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: 12, overflow: 'hidden', background: C.panel3, display: 'grid', placeItems: 'center', color: C.dim, flexShrink: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {preview ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : currentImage ? <img src={currentImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <i className="ph ph-image" style={{ fontSize: 22 }} />}
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  <button type="button" onClick={() => fileRef.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: C.panel2, border: `1px solid ${C.line2}`, color: C.ink, borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><i className="ph ph-upload-simple" /> {preview || currentImage ? 'Cambiar imagen' : 'Subir imagen'}</button>
                  <span style={{ fontSize: 11.5, color: C.dim }}>PNG, JPG o WebP</span>
                  <input ref={fileRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); setPreview(f ? URL.createObjectURL(f) : null); }} style={{ display: 'none' }} />
                </div>
              </div>
              {/* Galería (máx. 6) */}
              {editingId ? (
                <div>
                  <label style={labelStyle}>Galería <span style={{ color: C.dim, fontWeight: 400 }}>· máx. 6 imágenes ({gallery.length}/6)</span></label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 8 }}>
                    {gallery.map((g) => (
                      <div key={g.id} style={{ position: 'relative', height: 72, borderRadius: 10, overflow: 'hidden', background: C.panel3, border: `1px solid ${C.line}` }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={g.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button type="button" onClick={() => delGallery(g.id)} title="Quitar" style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 6, border: 'none', background: 'rgba(0,0,0,.6)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 11 }}><i className="ph ph-x" /></button>
                      </div>
                    ))}
                    {gallery.length < 6 ? (
                      <button type="button" onClick={() => galRef.current?.click()} disabled={galBusy} style={{ height: 72, borderRadius: 10, border: `1px dashed ${C.line2}`, background: C.panel2, color: C.muted, cursor: galBusy ? 'default' : 'pointer', display: 'grid', placeItems: 'center', fontSize: 20 }}>{galBusy ? <span style={{ fontSize: 11 }}>…</span> : <i className="ph ph-plus" />}</button>
                    ) : null}
                  </div>
                  <input ref={galRef} type="file" accept="image/*" multiple onChange={(e) => { uploadGallery(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />
                </div>
              ) : (
                <div style={{ fontSize: 12, color: C.dim, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 14px' }}>💡 Guarda el producto primero para agregar imágenes a la galería (máx. 6).</div>
              )}
              {/* Nombre */}
              <div><label style={labelStyle}>Nombre del producto</label><input value={form.name} onChange={(e) => setF('name', e.target.value)} placeholder="Ej. Excavadora CAT 320" style={inputStyle} /></div>
              {/* Marca + Categoría */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div><label style={labelStyle}>Marca</label><input value={form.brand} onChange={(e) => setF('brand', e.target.value)} placeholder="Ej. Caterpillar" style={inputStyle} /></div>
                <div><label style={labelStyle}>Categoría</label><select value={form.categoryId} onChange={(e) => setF('categoryId', Number(e.target.value))} style={{ ...inputStyle, cursor: 'pointer', colorScheme: 'dark' }}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              </div>
              {/* Precio + Precio anterior */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Precio (MXN)</label>
                  <input value={form.price} onChange={(e) => setF('price', e.target.value)} type="number" placeholder="0" style={inputStyle} />
                  {/*
                    En que unidad esta ese precio. Antes se asumia que toda renta
                    era mensual y el sitio pintaba "/mes" para todo — falso para
                    pipas (viaje), volteos (viaje) y triturados (tonelada).
                    Las opciones salen de la categoria elegida.
                  */}
                  <select
                    value={form.priceUnit}
                    onChange={(e) => setF('priceUnit', e.target.value)}
                    style={{ ...inputStyle, marginTop: 8 }}
                  >
                    <option value="">Por pieza (venta)</option>
                    {unidadesDe(categories.find((c) => c.id === form.categoryId)?.slug).map((u) => (
                      <option key={u.clave} value={u.clave}>Por {u.singular}</option>
                    ))}
                  </select>
                </div>
                <div><label style={labelStyle}>Precio anterior (opcional)</label><input value={form.oldPrice} onChange={(e) => setF('oldPrice', e.target.value)} type="number" placeholder="Para mostrar descuento" style={inputStyle} /></div>
              </div>
              {/* Stock */}
              <div style={{ display: 'grid', gridTemplateColumns: form.isRental ? '1fr 1fr' : '1fr', gap: 14 }}>
                <div><label style={labelStyle}>Stock</label><input value={form.stock} onChange={(e) => setF('stock', e.target.value)} type="number" placeholder="0" style={inputStyle} /></div>
                {form.isRental ? <div><label style={labelStyle}>Flete de renta (opcional)</label><input value={form.rentalFreight} onChange={(e) => setF('rentalFreight', e.target.value)} type="number" placeholder="0" style={inputStyle} /></div> : null}
              </div>
              {/*
                FICHA TECNICA ESTRUCTURADA (documento institucional, 17).
                Los campos salen de la CATEGORIA elegida, y sus llaves coinciden
                con las del formulario de solicitud: ese es el puente que
                permite descartar una plataforma que no alcanza la altura pedida.
              */}
              {(() => {
                const attrs = atributosDe(categories.find((c) => c.id === form.categoryId)?.slug);
                if (attrs.length === 0) return null;
                return (
                  <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Ficha técnica</div>
                    <p style={{ margin: '0 0 12px', fontSize: 12.5, color: C.muted, lineHeight: 1.55 }}>
                      Lo que se llene aquí se puede buscar y comparar. Lo que se deje vacío no descarta
                      el equipo: se trata como desconocido, no como incumplido.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
                      {attrs.map((a) => (
                        <div key={a.clave}>
                          <label style={labelStyle}>
                            {a.label}{a.unidad ? ` (${a.unidad})` : ''}
                            {a.compara ? <span style={{ color: C.amber }} title="Se compara contra lo que pide la solicitud"> ·</span> : null}
                          </label>
                          {a.tipo === 'opcion' ? (
                            <select
                              value={form.attributes[a.clave] ?? ''}
                              onChange={(e) => setF('attributes', { ...form.attributes, [a.clave]: e.target.value })}
                              style={inputStyle}
                            >
                              <option value="">Sin especificar</option>
                              {(a.opciones ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : (
                            <input
                              type={a.tipo === 'numero' ? 'number' : 'text'}
                              step="any"
                              value={form.attributes[a.clave] ?? ''}
                              onChange={(e) => setF('attributes', { ...form.attributes, [a.clave]: e.target.value })}
                              placeholder={a.hint ?? ''}
                              style={inputStyle}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Descripción corta */}
              <div><label style={labelStyle}>Descripción corta (resumen arriba de la ficha)</label><input value={form.short} onChange={(e) => setF('short', e.target.value)} placeholder="Miniexcavadora compacta para espacios reducidos…" style={inputStyle} /></div>
              {/* Descripción */}
              <div><label style={labelStyle}>Descripción</label><textarea value={form.description} onChange={(e) => setF('description', e.target.value)} rows={3} placeholder="Especificaciones, capacidad, condiciones…" style={{ ...inputStyle, height: 'auto', lineHeight: 1.5, resize: 'vertical' }} /></div>
              {/* Ficha técnica */}
              <div>
                <label style={labelStyle}>Ficha técnica <span style={{ color: C.dim, fontWeight: 400 }}>· los primeros 3 salen como cuadros destacados</span></label>
                <div style={{ display: 'grid', gap: 8 }}>
                  {form.specs.map((s, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                      <input value={s.label} onChange={(e) => setF('specs', form.specs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Peso operativo" style={{ ...inputStyle, padding: '10px 12px' }} />
                      <input value={s.value} onChange={(e) => setF('specs', form.specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} placeholder="3,500 kg" style={{ ...inputStyle, padding: '10px 12px' }} />
                      <button type="button" onClick={() => setF('specs', form.specs.filter((_, j) => j !== i))} title="Quitar" style={{ width: 38, height: 38, borderRadius: 9, border: `1px solid ${C.line2}`, background: C.panel2, color: C.muted, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}><i className="ph ph-x" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setF('specs', [...form.specs, { label: '', value: '' }])} style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px dashed ${C.line2}`, background: 'transparent', color: C.amber, borderRadius: 10, padding: '9px 13px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}><i className="ph ph-plus" /> Agregar especificación</button>
                </div>
              </div>
              {/* Toggles */}
              <div style={{ display: 'grid', gap: 12, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: '14px 16px' }}>
                {[
                  { k: 'featured' as const, label: 'Destacado', help: 'Aparece en la sección de destacados del home.' },
                  { k: 'isRental' as const, label: 'En renta', help: 'Flujo de cotización. La unidad del precio se elige arriba.' },
                ].map((t) => (
                  <label key={t.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }}>
                    <span><span style={{ fontSize: 13.5, fontWeight: 600 }}>{t.label}</span><span style={{ display: 'block', fontSize: 11.5, color: C.dim }}>{t.help}</span></span>
                    <button type="button" onClick={() => setF(t.k, !form[t.k])} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><Switch on={form[t.k]} /></button>
                  </label>
                ))}
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }}>
                  <span><span style={{ fontSize: 13.5, fontWeight: 600 }}>Activo</span><span style={{ display: 'block', fontSize: 11.5, color: C.dim }}>Visible en el catálogo del sitio.</span></span>
                  <button type="button" onClick={() => setF('status', form.status === 1 ? 0 : 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}><Switch on={form.status === 1} /></button>
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 26px', borderTop: `1px solid ${C.line}`, background: C.panel2, position: 'sticky', bottom: 0 }}>
              <button type="button" onClick={() => setModalOpen(false)} disabled={saving} style={{ background: 'transparent', border: `1px solid ${C.line2}`, color: C.ink, fontWeight: 600, fontSize: 14, padding: '11px 20px', borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>Cancelar</button>
              <button type="button" onClick={save} disabled={saving} style={{ background: C.amber, color: C.amberInk, border: 'none', fontWeight: 800, fontSize: 14, padding: '11px 24px', borderRadius: 11, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>{saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear producto'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Toast */}
      {toast ? (
        <div style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 10, background: C.panel3, border: `1px solid ${C.line2}`, color: C.ink, padding: '13px 20px', borderRadius: 12, boxShadow: '0 24px 60px -30px rgba(0,0,0,.85)', fontSize: 14, fontWeight: 600, zIndex: 400 }}>
          <i className={`ph-bold ${toast.kind === 'warn' ? 'ph-warning-circle' : toast.kind === 'trash' ? 'ph-trash' : 'ph-check-circle'}`} style={{ fontSize: 18, color: toast.kind === 'warn' ? C.red : C.ok }} /> {toast.text}
        </div>
      ) : null}
    </div>
  );
}
