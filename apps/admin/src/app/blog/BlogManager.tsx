'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ThemeTokens } from '@maqserv/config';
import { inputStyle, Field } from '@/components/editor-kit';
import { Btn, Chip, EmptyState, IconBtn, PageHeader, Panel, SearchBox, StatusText, Thumb, Toast } from '@/components/ui';
import { confirmar } from '@/components/Dialogos';

type Copys = Record<string, Record<string, string>>;

export interface BlogRow {
  id: number;
  title: string;
  status: number;
  category: string;
  author: string | null;
  image: string | null;
  views: number;
  createdAt: string | null;
}

const cv = (es: Record<string, string>, k: string, def = '') => es[k] ?? def;

/** Textos del hero de /blog + los de la sección del home (dos sitios distintos). */
interface Head {
  eyebrow: string; title: string; subtitle: string;
  homeEyebrow: string; homeTitle: string; homeReadMore: string; homeLimit: number;
}

export function BlogManager({ blogs, themeId, copys, tokens, sectionEnabled }: {
  blogs: BlogRow[]; themeId: number | null; copys: Copys; tokens: ThemeTokens;
  /** Si la sección `home.blog` está encendida; la visibilidad se maneja en Temas. */
  sectionEnabled: boolean;
}) {
  const router = useRouter();

  const initial: Head = useMemo(() => {
    const es = copys['es'] ?? {};
    return {
      eyebrow: cv(es, 'blog.hero.eyebrow', 'Diario de obra · Nº 24'),
      title: cv(es, 'blog.hero.title', 'Bitácora'),
      subtitle: cv(es, 'blog.hero.subtitle', 'Noticias, guías y buenas prácticas sobre maquinaria pesada — directo desde el terreno.'),
      homeEyebrow: cv(es, 'home.blog.eyebrow', 'Bitácora'),
      homeTitle: cv(es, 'home.blog.title', 'Últimas noticias'),
      homeReadMore: cv(es, 'home.blog.readMore', 'Leer más'),
      homeLimit: tokens.blog?.limit ?? 3,
    };
  }, [copys, tokens]);

  const [head, setHead] = useState<Head>(initial);
  const [savedHead, setSavedHead] = useState<Head>(initial);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [rows, setRows] = useState<BlogRow[]>(blogs);
  const [q, setQ] = useState('');
  const [pending, setPending] = useState<number | null>(null);

  const setH = <K extends keyof Head>(k: K, v: Head[K]) => setHead((h) => ({ ...h, [k]: v }));
  const dirty = JSON.stringify(head) !== JSON.stringify(savedHead);

  const filtered = rows.filter((b) =>
    !q.trim() || b.title.toLowerCase().includes(q.toLowerCase()) || b.category.toLowerCase().includes(q.toLowerCase()));

  function discard() { setHead(savedHead); setToast(null); }

  async function publishHead() {
    if (busy || !themeId) return;
    setBusy(true); setToast(null);
    try {
      const es = { ...(copys['es'] ?? {}) };
      es['blog.hero.eyebrow'] = head.eyebrow;
      es['blog.hero.title'] = head.title;
      es['blog.hero.subtitle'] = head.subtitle;
      es['home.blog.eyebrow'] = head.homeEyebrow;
      es['home.blog.title'] = head.homeTitle;
      es['home.blog.readMore'] = head.homeReadMore;
      const body = { tokens: { ...tokens, blog: { limit: head.homeLimit } }, copys: { ...copys, es } };
      const r2 = await fetch(`/api/admin/themes/${themeId}/draft`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r2.ok) throw new Error('No se pudieron guardar los textos');
      const r3 = await fetch(`/api/admin/themes/${themeId}/publish`, { method: 'POST' });
      if (!r3.ok) throw new Error('No se pudo publicar');
      setSavedHead(head);
      setToast({ ok: true, text: 'Encabezado publicado — se verá al refrescar el sitio.' });
      router.refresh();
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  async function toggleStatus(b: BlogRow) {
    if (pending) return;
    setPending(b.id);
    const next = b.status === 1 ? 0 : 1;
    setRows((rs) => rs.map((r) => (r.id === b.id ? { ...r, status: next } : r)));
    try {
      const r = await fetch(`/api/admin/cms/blogs/${b.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) });
      if (!r.ok) throw new Error();
    } catch {
      setRows((rs) => rs.map((r) => (r.id === b.id ? { ...r, status: b.status } : r)));
      setToast({ ok: false, text: 'No se pudo cambiar el estado' });
    } finally { setPending(null); }
  }

  async function remove(b: BlogRow) {
    if (pending) return;
    if (!(await confirmar({ titulo: '¿Eliminar esta entrada?', mensaje: `«${b.title}» se borra del blog y no se puede deshacer.`, confirmar: 'Eliminar', peligro: true }))) return;
    setPending(b.id);
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.id !== b.id));
    try {
      const r = await fetch(`/api/admin/cms/blogs/${b.id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error();
      setToast({ ok: true, text: 'Entrada eliminada' });
    } catch {
      setRows(prev);
      setToast({ ok: false, text: 'No se pudo eliminar' });
    } finally { setPending(null); }
  }

  /* El mini preview de la derecha imita el hero del SITIO público: sus estilos
     (pesos, tamaños, el "24" de fondo) son del sitio y se quedan como están. */
  const eye = 'var(--color-primary)';

  return (
    <div>
      <PageHeader
        eyebrow={['Ajustes', 'Sitio web']}
        title="Bitácora / Blog"
        actions={<Btn variant="primary" icon="ph-plus" href="/blog/nuevo">Nueva entrada</Btn>}
      />

      {/* Encabezado editable de la Bitácora */}
      <Panel
        title="Encabezado de la Bitácora"
        icon="ph-text-aa"
        desc="Los textos grandes del hero de la página pública de blog."
        action={<StatusText tone={dirty ? 'warn' : 'ok'}>{dirty ? 'Sin publicar' : 'Publicado'}</StatusText>}
        flush
        clip
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 0 }} className="blog-head-grid">
          <div style={{ padding: 20, display: 'grid', gap: 16 }}>
            <Field label="Eyebrow (línea pequeña arriba)"><input value={head.eyebrow} onChange={(e) => setH('eyebrow', e.target.value)} placeholder="Diario de obra · Nº 24" style={inputStyle} /></Field>
            <Field label="Título"><input value={head.title} onChange={(e) => setH('title', e.target.value)} placeholder="Bitácora" style={inputStyle} /></Field>
            <Field label="Descripción"><textarea value={head.subtitle} onChange={(e) => setH('subtitle', e.target.value)} rows={2} placeholder="Noticias, guías y buenas prácticas…" style={{ ...inputStyle, height: 'auto', padding: '10px 12px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" onClick={discard} disabled={!dirty || busy}>Descartar</Btn>
              {/* Secundario a propósito: la acción principal de la página es «Nueva entrada». */}
              <Btn icon="ph-cloud-arrow-up" onClick={publishHead} disabled={busy || !dirty}>{busy ? 'Publicando…' : 'Guardar y publicar'}</Btn>
            </div>
          </div>
          {/* Mini preview del hero */}
          <div style={{ background: '#0e0e12', borderLeft: '1px solid var(--adm-border)', padding: '22px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            <div aria-hidden style={{ position: 'absolute', top: -20, right: -6, fontSize: 130, fontWeight: 800, color: 'rgba(255,255,255,0.03)', lineHeight: 1 }}>24</div>
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 8.5, letterSpacing: '.22em', color: eye, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>{head.eyebrow || 'Eyebrow'}</div>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 0.9, color: '#fff' }}>{head.title || 'Bitácora'}</div>
              {head.subtitle ? <div style={{ fontSize: 10.5, lineHeight: 1.5, color: 'rgba(255,255,255,.5)', marginTop: 12 }}>{head.subtitle.slice(0, 90)}{head.subtitle.length > 90 ? '…' : ''}</div> : null}
            </div>
          </div>
        </div>
      </Panel>

      {/* Sección del home: es OTRO sitio distinto del hero de /blog, y sus textos
          solo se podían tocar desde la tabla cruda de copys en Temas. */}
      <Panel
        title="Adelanto en el inicio"
        icon="ph-house"
        desc="La banda de últimas entradas que sale en la página principal."
        action={
          // La visibilidad se gestiona en Temas; aquí solo se avisa.
          !sectionEnabled ? (
            <Link href="/temas" className="adm-panel-link" style={{ color: 'var(--adm-warn)' }}>
              <i className="ph ph-eye-slash" aria-hidden /> Oculta en el inicio · activar
            </Link>
          ) : null
        }
      >
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
            <Field label="Línea pequeña (eyebrow)">
              <input value={head.homeEyebrow} onChange={(e) => setH('homeEyebrow', e.target.value)} placeholder="Bitácora" style={inputStyle} />
            </Field>
            <Field label="Título de la sección">
              <input value={head.homeTitle} onChange={(e) => setH('homeTitle', e.target.value)} placeholder="Últimas noticias" style={inputStyle} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
            <Field label="Texto del enlace de cada tarjeta">
              <input value={head.homeReadMore} onChange={(e) => setH('homeReadMore', e.target.value)} placeholder="Leer más" style={inputStyle} />
            </Field>
            <Field label="Cuántas entradas adelantar">
              <input
                type="number" min={1} max={12}
                value={head.homeLimit}
                onChange={(e) => setH('homeLimit', Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                style={inputStyle}
              />
            </Field>
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--adm-muted)' }}>
            Se guarda con el botón “Guardar y publicar” de arriba, junto con el encabezado.
          </p>
        </div>
      </Panel>

      {/* Entradas */}
      <Panel
        title="Entradas"
        icon="ph-newspaper-clipping"
        desc={<><span className="adm-num">{rows.length}</span> entrada(s) · publica, oculta o edita cada una.</>}
        className="blog-entries"
        action={<SearchBox value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" aria-label="Buscar entrada" style={{ flex: '0 1 220px' }} />}
        flush
        clip
      >
        {filtered.length === 0 ? (
          <EmptyState icon="ph-newspaper-clipping" title={q ? 'Sin resultados para tu búsqueda.' : 'Aún no hay entradas. Crea la primera con “Nueva entrada”.'} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="adm-tbl" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Categoría</th>
                  <th>Fecha</th>
                  <th style={{ textAlign: 'right' }}>Vistas</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} style={{ opacity: b.status === 1 ? 1 : 0.55, transition: 'opacity .15s' }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Thumb src={b.image} />
                        <div style={{ minWidth: 0 }}>
                          <div className="adm-cell-title adm-ellipsis" style={{ maxWidth: 340 }}>{b.title}</div>
                          {b.author ? <div className="adm-cell-sub">{b.author}</div> : null}
                        </div>
                      </div>
                    </td>
                    <td><Chip>{b.category}</Chip></td>
                    <td className="adm-num" style={{ color: 'var(--adm-muted)', fontSize: 13, whiteSpace: 'nowrap' }}>{b.createdAt ? new Date(b.createdAt).toLocaleDateString('es-MX') : '—'}</td>
                    <td className="adm-num" style={{ textAlign: 'right', color: 'var(--adm-muted)', fontSize: 13 }}>{b.views.toLocaleString('es-MX')}</td>
                    <td><StatusText tone={b.status === 1 ? 'ok' : 'muted'}>{b.status === 1 ? 'Publicado' : 'Oculto'}</StatusText></td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                        <IconBtn icon="ph-pencil-simple" label="Editar" href={`/blog/editar/${b.id}`} />
                        <IconBtn icon={b.status === 1 ? 'ph-eye-slash' : 'ph-eye'} label={b.status === 1 ? 'Ocultar' : 'Mostrar'} onClick={() => toggleStatus(b)} disabled={pending === b.id} />
                        <IconBtn icon="ph-trash" label="Eliminar" danger onClick={() => remove(b)} disabled={pending === b.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <style>{`@media (max-width: 780px){ .blog-head-grid{ grid-template-columns:1fr !important; } .blog-head-grid > div + div { border-left: 0 !important; border-top: 1px solid var(--adm-border); } .blog-entries .adm-panel-head { flex-wrap: wrap; } }`}</style>

      {toast ? <Toast kind={toast.ok ? 'ok' : 'bad'}>{toast.text}</Toast> : null}
    </div>
  );
}
