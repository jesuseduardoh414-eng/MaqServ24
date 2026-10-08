'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminSelect } from '@/components/AdminSelect';
import { useRouter } from 'next/navigation';
import { unidadesDe, atributosDe, tipoDeCatalogo, type TipoCatalogo } from '@maqserv/config';
import { Pagination } from '@/components/Pagination';
import { Modal } from '@/components/Modal';
import {
  Btn, Chip, EmptyState, FormField, IconBtn, Note, PageHeader, Panel, SearchBox, Segmented, Stat, Stats, StatusText, Switch, Thumb, Toast, Toolbar,
  type Tone,
} from '@/components/ui';

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

const GRID = '48px minmax(0,1.7fr) minmax(0,1.05fr) 0.9fr 0.95fr 0.9fr 1.35fr';
const fmt = (n: number | null) => '$' + Number(n ?? 0).toLocaleString('en-US');

type Filtro = 'todos' | 'activos' | 'destacados';

interface Form {
  name: string; brand: string; categoryId: number; price: string; oldPrice: string;
  stock: string; short: string; description: string; specs: Array<{ label: string; value: string }>;
  isRental: boolean; rentalFreight: string; featured: boolean; status: number;
  /** Unidad en la que esta el precio: mes, dia, viaje, tonelada. '' = por pieza. */
  priceUnit: string;
  /** Ficha tecnica estructurada, por clave de atributo. */
  attributes: Record<string, string>;
}

export function ProductsManager({ initial, categories, tipo }: { initial: ProductRow[]; categories: CatOption[]; tipo: TipoCatalogo }) {
  const emptyForm: Form = { name: '', brand: '', categoryId: categories[0]?.id ?? 0, price: '', oldPrice: '', stock: '', short: '', description: '', specs: [], isRental: false, rentalFreight: '', featured: false, status: 1, priceUnit: '', attributes: {} };

  /**
   * SERVICIOS O PRODUCTOS (2026-09-25). Esta pantalla gestiona uno de los dos
   * tipos; el tipo lo decide la categoría de cada ficha (`tipoDeCatalogo`).
   * Las fichas se crean y editan en la página de ficha completa, no en el
   * modal de abajo (que quedó sin uso: no tiene tarifas ni horario).
   */
  const router = useRouter();
  const nombre = tipo === 'servicio' ? 'Equipos' : 'Productos';
  const singular = tipo === 'servicio' ? 'equipo' : 'producto';
  const slugDeCat = useMemo(() => new Map(categories.map((c) => [c.name, c.slug])), [categories]);
  const categoriasTipo = useMemo(() => categories.filter((c) => tipoDeCatalogo(c.slug) === tipo), [categories, tipo]);

  const [todos, setItems] = useState<ProductRow[]>(initial);
  const items = useMemo(
    () => todos.filter((p) => tipoDeCatalogo(slugDeCat.get(p.categoryName ?? '') ?? null) === tipo),
    [todos, slugDeCat, tipo],
  );
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('todas');
  const [filter, setFilter] = useState<Filtro>('todos');
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
    if (!r.ok) { flash('No se pudo eliminar', 'warn'); return; }
    setItems((xs) => xs.filter((x) => x.id !== p.id));
    flash(`«${p.name}» eliminado`, 'trash');
  }

  function openNew() {
    router.push(`/productos/nuevo?tipo=${tipo}`);
  }
  async function openEdit(p: ProductRow) {
    router.push(`/productos/editar/${p.id}`);
    return;
    // Modal viejo, sin uso: se conserva hasta retirar el resto del código.
    // eslint-disable-next-line no-unreachable
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
    sinFoto: items.filter((p) => !p.image).length,
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

  const stockInfo = (stock: number | null): { tone?: Tone; label: string; val: number | string } => {
    if (stock == null) return { tone: 'muted', label: 'Sin dato', val: '—' };
    // En un servicio es cuántas unidades hay, no inventario que se agota.
    if (tipo === 'servicio') return { label: stock === 1 ? 'unidad' : 'unidades', val: stock };
    if (stock === 0) return { tone: 'bad', label: 'Agotado', val: stock };
    if (stock <= 3) return { tone: 'warn', label: 'Bajo stock', val: stock };
    return { tone: 'ok', label: 'Disponible', val: stock };
  };

  return (
    <div>
      <style>{`
        .pr-row { display: grid; grid-template-columns: ${GRID}; gap: 16px; align-items: center; }
        .pr-img { position: relative; width: 48px; height: 48px; }
        /* Marca de destacado sobre la miniatura: se ve sin leer la columna de acciones. */
        .pr-star {
          position: absolute; top: -5px; right: -5px; width: 18px; height: 18px; border-radius: 999px;
          display: grid; place-items: center; font-size: 10px;
          background: var(--adm-accent); color: var(--color-primary-fg, #fff); border: 2px solid var(--adm-card);
        }
        .adm-ibtn.pr-fav-on, .adm-ibtn.pr-fav-on:hover {
          color: var(--adm-accent);
          border-color: color-mix(in srgb, var(--adm-accent) 45%, transparent);
          background: color-mix(in srgb, var(--adm-accent) 12%, transparent);
        }
        /* Las 7 columnas de la tabla no caben en móvil: cada fila pasa a bloque
           (imagen + nombre arriba; categoría, precio, stock y estado envueltos
           debajo; acciones en su propio renglón). Se oculta la cabecera porque
           ya no encabeza nada. */
        @media (max-width: 900px) {
          .pr-head { display: none !important; }
          .pr-row { display: flex; flex-wrap: wrap; gap: 10px 12px; }
          .pr-row > .pr-img { flex: 0 0 auto; }
          /* base = ancho restante tras la imagen (48px + 12 de gap): así el
             nombre agota el primer renglón y las demás celdas bajan juntas,
             en vez de acomodarse distinto según lo largo que sea el nombre. */
          .pr-row > .pr-name { flex: 1 1 calc(100% - 60px); }
          .pr-row > .pr-price, .pr-row > .pr-stock, .pr-row > .pr-state { flex: 0 0 auto; }
          .pr-row > .pr-cat { flex: 0 1 auto; max-width: 100%; }
          .pr-row > .pr-actions { flex: 1 0 100%; }
        }
      `}</style>

      <PageHeader
        eyebrow={['Red y oferta', tipo === 'servicio' ? 'Inventario' : 'Catálogo']}
        title={nombre}
        count={stats.total}
        actions={<Btn variant="primary" icon="ph-plus" onClick={openNew}>Nuevo {singular}</Btn>}
      />

      <Stats>
        <Stat label={nombre} icon="ph-cube" tone="info" value={stats.total} />
        <Stat label="Activos" icon="ph-check-circle" tone="ok" value={stats.activos} hint={`de ${stats.total}`} />
        <Stat label="Destacados" icon="ph-star" tone="accent" value={stats.destacados} hint="en el inicio del sitio" />
        {/* Un servicio no tiene "existencias": su alarma útil es la ficha sin foto. */}
        {tipo === 'servicio' ? (
          <Stat label="Sin foto" icon="ph-image" tone={stats.sinFoto > 0 ? 'bad' : 'muted'} value={stats.sinFoto} />
        ) : (
          <Stat label="Bajo stock" icon="ph-warning" tone={stats.bajo > 0 ? 'bad' : 'muted'} value={stats.bajo} hint="3 o menos" />
        )}
      </Stats>

      <Toolbar
        end={
          <>
            <span className="adm-num">{rows.length} de {stats.total}</span>
            <AdminSelect
              size="sm"
              className="w-auto min-w-[180px]"
              ariaLabel="Ordenar"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'rel', label: 'Ordenar: Relevancia' },
                { value: 'asc', label: 'Precio: menor' },
                { value: 'desc', label: 'Precio: mayor' },
                { value: 'stock', label: 'Stock' },
                { value: 'name', label: 'Nombre A-Z' },
              ]}
            />
          </>
        }
      >
        <SearchBox value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto o marca…" aria-label="Buscar producto o marca" />
        <AdminSelect
          size="sm"
          className="w-auto min-w-[190px]"
          ariaLabel="Categoría"
          value={catFilter}
          onChange={setCatFilter}
          options={[{ value: 'todas', label: tipo === 'servicio' ? 'Todas las líneas' : 'Todas las categorías' }, ...categoriasTipo.map((c) => ({ value: c.name, label: c.name }))]}
        />
        <Segmented<Filtro>
          ariaLabel="Filtrar por estado"
          value={filter}
          onChange={setFilter}
          items={[
            { key: 'todos', label: 'Todos', count: stats.total },
            { key: 'activos', label: 'Activos', count: stats.activos },
            { key: 'destacados', label: 'Destacados', count: stats.destacados },
          ]}
        />
      </Toolbar>

      <Panel
        flush
        clip
        footer={
          // Pagination trae su propio margen superior (vive fuera de un panel en
          // otros módulos); aquí va en el pie, así que se compensa.
          <div style={{ flex: 1, minWidth: 0, marginTop: -16 }}>
            <Pagination
              page={current}
              pageCount={pageCount}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[12, 24, 48]}
              info={rangeInfo}
            />
          </div>
        }
      >
        <div className="adm-thead pr-row pr-head">
          <div /><div>Producto</div><div>Categoría</div><div>{tipo === 'servicio' ? 'Tarifa' : 'Precio'}</div><div>{tipo === 'servicio' ? 'Unidades' : 'Stock'}</div><div>Estado</div><div style={{ textAlign: 'right' }}>Acciones</div>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon="ph-cube" title="No se encontraron productos" sub="Ajusta los filtros o crea un nuevo producto." />
        ) : pageRows.map((p) => {
          const s = stockInfo(p.stock);
          const confirming = confirmId === p.id;
          return (
            <div key={p.id} className="adm-trow pr-row">
              {/* Imagen + estrella */}
              <div className="pr-img">
                <Thumb src={p.image} size={48} />
                {p.featured ? <span className="pr-star" title="Destacado"><i className="ph-bold ph-star" aria-hidden /></span> : null}
              </div>
              {/* Nombre + marca */}
              <div className="pr-name" style={{ minWidth: 0 }}>
                <div className="adm-cell-title adm-ellipsis">{p.name}</div>
                <div className="adm-cell-sub adm-ellipsis">{p.brand || '—'}</div>
              </div>
              {/* Categoría */}
              <div className="pr-cat" style={{ minWidth: 0 }}>
                {p.categoryName ? (
                  <Chip title={p.categoryName} style={{ maxWidth: '100%' }}><span className="adm-ellipsis">{p.categoryName}</span></Chip>
                ) : (
                  <span style={{ color: 'var(--adm-faint)', fontSize: 13 }}>—</span>
                )}
              </div>
              {/* Precio */}
              {/* PRECIO ÚNICO (2026-10-08): un servicio no lleva precio propio, lo da el
                  tabulador del cotizador. Enseñar aquí un número hacía creer que la
                  ficha tenía su propio precio. */}
              {tipo === 'servicio' ? (
                <a className="pr-price adm-link" href="/cotizador/tarifas" title="La tarifa de los servicios se edita en Ajustes › Tarifas y condiciones" style={{ fontSize: 13, color: 'var(--adm-muted)' }}>
                  En el cotizador <i className="ph ph-arrow-up-right" aria-hidden />
                </a>
              ) : (
                <div className="pr-price adm-num" style={{ fontWeight: 600, fontSize: 14 }}>{fmt(p.price)}</div>
              )}
              {/* Stock */}
              <div className="pr-stock">
                {s.tone ? (
                  <StatusText tone={s.tone}><span className="adm-num">{s.val}</span></StatusText>
                ) : (
                  <span className="adm-num" style={{ fontSize: 13.5, fontWeight: 600 }}>{s.val}</span>
                )}
                <div className="adm-cell-sub" style={{ marginTop: 1 }}>{s.label}</div>
              </div>
              {/* Estado */}
              <div className="pr-state">
                {/* status 2 = lo ofreció un aliado desde su portal: se publica
                    desde su expediente (le avisa), no con el interruptor. */}
                {p.status === 2 ? (
                  <a href="/proveedores" style={{ textDecoration: 'none' }}><StatusText tone="warn">Por revisar</StatusText></a>
                ) : (
                  <Switch on={p.status === 1} onClick={() => toggleStatus(p)} label={p.status === 1 ? 'Activo' : 'Inactivo'} title="Activar / desactivar" />
                )}
              </div>
              {/* Acciones */}
              <div className="pr-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                {confirming ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--adm-bad)', fontWeight: 500, whiteSpace: 'nowrap' }}>¿Eliminar?</span>
                    <Btn size="sm" variant="danger" onClick={() => del(p)}>Sí</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setConfirmId(null)}>No</Btn>
                  </span>
                ) : (
                  <>
                    <IconBtn
                      icon="ph-star"
                      label={p.featured ? 'Quitar destacado' : 'Destacar'}
                      aria-pressed={p.featured}
                      className={p.featured ? 'pr-fav-on' : undefined}
                      onClick={() => toggleFeature(p)}
                    />
                    <IconBtn icon="ph-pencil-simple" label="Editar" onClick={() => openEdit(p)} />
                    <IconBtn icon="ph-trash" label="Eliminar" danger onClick={() => { setConfirmId(p.id); }} />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </Panel>

      {/* Modal crear/editar (sin uso: ver openEdit) */}
      <Modal
        abierto={modalOpen}
        titulo={`${editingId ? 'Editar producto' : 'Nuevo producto'}${loadingDetail ? ' · cargando…' : ''}`}
        onCerrar={() => { if (!saving) setModalOpen(false); }}
        ancho={560}
        pie={
          <>
            <Btn variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Btn>
            <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear producto'}</Btn>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Imagen */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <Thumb src={preview ?? currentImage} size={72} />
            <div style={{ display: 'grid', gap: 4 }}>
              <Btn size="sm" icon="ph-upload-simple" onClick={() => fileRef.current?.click()}>{preview || currentImage ? 'Cambiar imagen' : 'Subir imagen'}</Btn>
              <span className="adm-help">PNG, JPG o WebP</span>
              <input ref={fileRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); setPreview(f ? URL.createObjectURL(f) : null); }} style={{ display: 'none' }} />
            </div>
          </div>
          {/* Galería (máx. 6) */}
          {editingId ? (
            <div className="adm-field">
              <span className="adm-label">Galería <span style={{ color: 'var(--adm-faint)', fontWeight: 400 }}>· máx. 6 imágenes ({gallery.length}/6)</span></span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 8 }}>
                {gallery.map((g) => (
                  <div key={g.id} style={{ position: 'relative', height: 72, borderRadius: 8, overflow: 'hidden', background: 'var(--adm-raised)', border: '1px solid var(--adm-border)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button type="button" onClick={() => delGallery(g.id)} title="Quitar" aria-label="Quitar" style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 6, border: 'none', background: 'rgba(0,0,0,.6)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 11 }}><i className="ph ph-x" aria-hidden /></button>
                  </div>
                ))}
                {gallery.length < 6 ? (
                  <button type="button" onClick={() => galRef.current?.click()} disabled={galBusy} aria-label="Agregar imágenes" style={{ height: 72, borderRadius: 8, border: '1px dashed var(--adm-border-strong)', background: 'transparent', color: 'var(--adm-muted)', cursor: galBusy ? 'default' : 'pointer', display: 'grid', placeItems: 'center', fontSize: 20 }}>{galBusy ? <span style={{ fontSize: 11 }}>…</span> : <i className="ph ph-plus" aria-hidden />}</button>
                ) : null}
              </div>
              <input ref={galRef} type="file" accept="image/*" multiple onChange={(e) => { uploadGallery(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />
            </div>
          ) : (
            <Note>Guarda el producto primero para agregar imágenes a la galería (máx. 6).</Note>
          )}
          {/* Nombre */}
          <FormField label="Nombre del producto">
            <input className="adm-input" value={form.name} onChange={(e) => setF('name', e.target.value)} placeholder="Ej. Excavadora CAT 320" />
          </FormField>
          {/* Marca + Categoría */}
          <div className="adm-form-grid">
            <FormField label="Marca">
              <input className="adm-input" value={form.brand} onChange={(e) => setF('brand', e.target.value)} placeholder="Ej. Caterpillar" />
            </FormField>
            <div className="adm-field">
              <span className="adm-label">Categoría</span>
              <AdminSelect ariaLabel="Categoría" value={String(form.categoryId)} onChange={(v) => setF('categoryId', Number(v))} options={categories.map((c) => ({ value: String(c.id), label: c.name }))} />
            </div>
          </div>
          {/* Precio + Precio anterior */}
          <div className="adm-form-grid">
            <div className="adm-field">
              <span className="adm-label">Precio (MXN)</span>
              <input className="adm-input" value={form.price} onChange={(e) => setF('price', e.target.value)} type="number" placeholder="0" aria-label="Precio (MXN)" />
              {/*
                En que unidad esta ese precio. Antes se asumia que toda renta
                era mensual y el sitio pintaba "/mes" para todo — falso para
                pipas (viaje), volteos (viaje) y triturados (tonelada).
                Las opciones salen de la categoria elegida.
              */}
              <AdminSelect
                ariaLabel="Unidad del precio"
                value={form.priceUnit}
                onChange={(v) => setF('priceUnit', v)}
                options={[
                  { value: '', label: 'Por pieza (venta)' },
                  ...unidadesDe(categories.find((c) => c.id === form.categoryId)?.slug).map((u) => ({ value: u.clave, label: `Por ${u.singular}` })),
                ]}
              />
            </div>
            <FormField label="Precio anterior (opcional)">
              <input className="adm-input" value={form.oldPrice} onChange={(e) => setF('oldPrice', e.target.value)} type="number" placeholder="Para mostrar descuento" />
            </FormField>
          </div>
          {/* Stock */}
          <div className="adm-form-grid">
            <FormField label="Stock">
              <input className="adm-input" value={form.stock} onChange={(e) => setF('stock', e.target.value)} type="number" placeholder="0" />
            </FormField>
            {form.isRental ? (
              <FormField label="Flete de renta (opcional)">
                <input className="adm-input" value={form.rentalFreight} onChange={(e) => setF('rentalFreight', e.target.value)} type="number" placeholder="0" />
              </FormField>
            ) : null}
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
              <div style={{ border: '1px solid var(--adm-border)', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--adm-text)', marginBottom: 4 }}>Ficha técnica</div>
                <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--adm-muted)', lineHeight: 1.55 }}>
                  Lo que se llene aquí se puede buscar y comparar. Lo que se deje vacío no descarta
                  el equipo: se trata como desconocido, no como incumplido.
                </p>
                <div className="adm-form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
                  {attrs.map((a) => (
                    <div key={a.clave} className="adm-field">
                      <span className="adm-label">
                        {a.label}{a.unidad ? ` (${a.unidad})` : ''}
                        {a.compara ? <span style={{ color: 'var(--adm-accent)' }} title="Se compara contra lo que pide la solicitud"> ·</span> : null}
                      </span>
                      {a.tipo === 'opcion' ? (
                        <AdminSelect
                          ariaLabel={a.label}
                          value={form.attributes[a.clave] ?? ''}
                          onChange={(v) => setF('attributes', { ...form.attributes, [a.clave]: v })}
                          options={[{ value: '', label: 'Sin especificar' }, ...(a.opciones ?? []).map((o) => ({ value: o, label: o }))]}
                        />
                      ) : (
                        <input
                          className="adm-input"
                          aria-label={a.label}
                          type={a.tipo === 'numero' ? 'number' : 'text'}
                          step="any"
                          value={form.attributes[a.clave] ?? ''}
                          onChange={(e) => setF('attributes', { ...form.attributes, [a.clave]: e.target.value })}
                          placeholder={a.hint ?? ''}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Descripción corta */}
          <FormField label="Descripción corta (resumen arriba de la ficha)">
            <input className="adm-input" value={form.short} onChange={(e) => setF('short', e.target.value)} placeholder="Miniexcavadora compacta para espacios reducidos…" />
          </FormField>
          {/* Descripción */}
          <FormField label="Descripción">
            <textarea className="adm-textarea" value={form.description} onChange={(e) => setF('description', e.target.value)} rows={3} placeholder="Especificaciones, capacidad, condiciones…" />
          </FormField>
          {/* Ficha técnica */}
          <div className="adm-field">
            <span className="adm-label">Ficha técnica <span style={{ color: 'var(--adm-faint)', fontWeight: 400 }}>· los primeros 3 salen como cuadros destacados</span></span>
            <div style={{ display: 'grid', gap: 8 }}>
              {form.specs.map((s, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) auto', gap: 8, alignItems: 'center' }}>
                  <input className="adm-input" value={s.label} onChange={(e) => setF('specs', form.specs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Peso operativo" />
                  <input className="adm-input" value={s.value} onChange={(e) => setF('specs', form.specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} placeholder="3,500 kg" />
                  <IconBtn icon="ph-x" label="Quitar" onClick={() => setF('specs', form.specs.filter((_, j) => j !== i))} />
                </div>
              ))}
              <Btn size="sm" variant="ghost" icon="ph-plus" style={{ justifySelf: 'start' }} onClick={() => setF('specs', [...form.specs, { label: '', value: '' }])}>Agregar especificación</Btn>
            </div>
          </div>
          {/* Toggles */}
          <div style={{ display: 'grid', gap: 12, border: '1px solid var(--adm-border)', borderRadius: 12, padding: '14px 16px' }}>
            {[
              { k: 'featured' as const, label: 'Destacado', help: 'Aparece en la sección de destacados del home.' },
              { k: 'isRental' as const, label: 'En renta', help: 'Flujo de cotización. La unidad del precio se elige arriba.' },
            ].map((t) => (
              <label key={t.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }}>
                <span><span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--adm-text)' }}>{t.label}</span><span className="adm-help" style={{ display: 'block' }}>{t.help}</span></span>
                <Switch on={form[t.k]} onClick={() => setF(t.k, !form[t.k])} title={t.label} />
              </label>
            ))}
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }}>
              <span><span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--adm-text)' }}>Activo</span><span className="adm-help" style={{ display: 'block' }}>Visible en el catálogo del sitio.</span></span>
              <Switch on={form.status === 1} onClick={() => setF('status', form.status === 1 ? 0 : 1)} title="Activo" />
            </label>
          </div>
        </div>
      </Modal>

      {toast ? <Toast kind={toast.kind === 'warn' ? 'bad' : 'ok'}>{toast.text}</Toast> : null}
    </div>
  );
}
