'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ThemeTokens } from '@maqserv/config';
import { D, FONT, cardStyle, inputStyle, h3Style, smallLabel, Field } from '@/components/editor-kit';

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
    if (!confirm(`¿Eliminar la entrada "${b.title}"? Esta acción no se puede deshacer.`)) return;
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

  const eye = 'var(--color-primary)';
  const th: React.CSSProperties = { textAlign: 'left', padding: '0 14px 12px', fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: D.muted2, borderBottom: `1px solid ${D.cardBorder}` };
  const td: React.CSSProperties = { padding: '14px', borderBottom: `1px solid ${D.cardBorder}`, fontSize: 14, color: D.text, verticalAlign: 'middle' };
  const actLink: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, padding: 0, color: D.amber };

  return (
    <div style={{ fontFamily: FONT, color: D.text }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />

      {/* Cabecera del módulo */}
      <div style={{ background: '#0c0c0e', border: `1px solid ${D.cardBorder}`, borderRadius: 16, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: D.muted2, fontSize: 12.5, fontWeight: 600, marginBottom: 5 }}><i className="ph ph-article" style={{ fontSize: 14 }} /> Diseño del sitio <span style={{ opacity: 0.5 }}>·</span> Blog</div>
          <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em' }}>Bitácora / Blog</h1>
        </div>
        <Link href="/blog/nuevo" style={{ border: 'none', background: D.amber, color: '#0a0a0b', borderRadius: 11, padding: '11px 18px', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'inherit', textDecoration: 'none' }}>
          <i className="ph-bold ph-plus-circle" style={{ fontSize: 17 }} /> Nueva entrada
        </Link>
      </div>

      {/* Encabezado editable de la Bitácora */}
      <div style={{ ...cardStyle, display: 'grid', gap: 0, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 0 }} className="blog-head-grid">
          <div style={{ padding: 24, display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)', color: D.amber, display: 'grid', placeItems: 'center', flexShrink: 0 }}><i className="ph ph-text-aa" style={{ fontSize: 19 }} /></div>
                <div><h3 style={h3Style}>Encabezado de la Bitácora</h3><p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>Los textos grandes del hero de la página pública de blog.</p></div>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, padding: '7px 12px', borderRadius: 999, border: `1px solid ${dirty ? 'color-mix(in srgb, var(--color-primary) 40%, transparent)' : 'rgba(255,255,255,0.08)'}`, background: dirty ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'rgba(255,255,255,0.03)', color: dirty ? D.amber : D.muted2 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: dirty ? D.amber : '#3fbf8f' }} />{dirty ? 'Sin publicar' : 'Publicado'}</span>
            </div>
            <Field label="Eyebrow (línea pequeña arriba)"><input value={head.eyebrow} onChange={(e) => setH('eyebrow', e.target.value)} placeholder="Diario de obra · Nº 24" style={inputStyle} /></Field>
            <Field label="Título"><input value={head.title} onChange={(e) => setH('title', e.target.value)} placeholder="Bitácora" style={inputStyle} /></Field>
            <Field label="Descripción"><textarea value={head.subtitle} onChange={(e) => setH('subtitle', e.target.value)} rows={2} placeholder="Noticias, guías y buenas prácticas…" style={{ ...inputStyle, height: 'auto', padding: '12px 14px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" onClick={discard} disabled={!dirty || busy} style={{ border: `1px solid ${D.inputBorder}`, background: 'transparent', color: dirty ? D.text : D.muted2, borderRadius: 11, padding: '10px 16px', fontWeight: 600, fontSize: 14, cursor: dirty && !busy ? 'pointer' : 'default', opacity: dirty && !busy ? 1 : 0.5, fontFamily: 'inherit' }}>Descartar</button>
              <button type="button" onClick={publishHead} disabled={busy || !dirty} style={{ border: 'none', background: D.amber, color: '#0a0a0b', borderRadius: 11, padding: '11px 18px', fontWeight: 800, fontSize: 14, cursor: busy || !dirty ? 'default' : 'pointer', opacity: busy || !dirty ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}><i className="ph-bold ph-cloud-arrow-up" style={{ fontSize: 17 }} /> {busy ? 'Publicando…' : 'Guardar y publicar'}</button>
            </div>
          </div>
          {/* Mini preview del hero */}
          <div style={{ background: '#0e0e12', borderLeft: `1px solid ${D.cardBorder}`, padding: '22px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            <div aria-hidden style={{ position: 'absolute', top: -20, right: -6, fontSize: 130, fontWeight: 800, color: 'rgba(255,255,255,0.03)', lineHeight: 1 }}>24</div>
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 8.5, letterSpacing: '.22em', color: eye, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>{head.eyebrow || 'Eyebrow'}</div>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 0.9, color: '#fff' }}>{head.title || 'Bitácora'}</div>
              {head.subtitle ? <div style={{ fontSize: 10.5, lineHeight: 1.5, color: 'rgba(255,255,255,.5)', marginTop: 12 }}>{head.subtitle.slice(0, 90)}{head.subtitle.length > 90 ? '…' : ''}</div> : null}
            </div>
          </div>
        </div>
      </div>

      {/* Sección del home: es OTRO sitio distinto del hero de /blog, y sus textos
          solo se podían tocar desde la tabla cruda de copys en Temas. */}
      <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)', color: D.amber, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <i className="ph ph-house" style={{ fontSize: 19 }} />
            </div>
            <div>
              <h3 style={h3Style}>Adelanto en el inicio</h3>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>La banda de últimas entradas que sale en la página principal.</p>
            </div>
          </div>
          {/* La visibilidad se gestiona en Temas; aquí solo se avisa. */}
          {!sectionEnabled ? (
            <Link href="/temas" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, padding: '7px 12px', borderRadius: 999, border: '1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)', background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', color: D.amber, textDecoration: 'none' }}>
              <i className="ph ph-eye-slash" style={{ fontSize: 14 }} /> Oculta en el inicio · activar
            </Link>
          ) : null}
        </div>

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
        <p style={{ margin: 0, fontSize: 12, color: D.muted }}>
          Se guarda con el botón “Guardar y publicar” de arriba, junto con el encabezado.
        </p>
      </div>

      {/* Entradas */}
      <div style={{ ...cardStyle }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)', color: D.amber, display: 'grid', placeItems: 'center' }}><i className="ph ph-newspaper-clipping" style={{ fontSize: 19 }} /></div>
            <div><h3 style={h3Style}>Entradas</h3><p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>{rows.length} entrada(s) · publica, oculta o edita cada una.</p></div>
          </div>
          <div style={{ position: 'relative' }}>
            <i className="ph ph-magnifying-glass" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: D.muted2, fontSize: 15 }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" style={{ ...inputStyle, height: 40, width: 220, paddingLeft: 34 }} />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr>
                <th style={th}>Título</th>
                <th style={th}>Categoría</th>
                <th style={th}>Fecha</th>
                <th style={{ ...th, textAlign: 'right' }}>Vistas</th>
                <th style={th}>Estado</th>
                <th style={{ ...th, textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} style={{ opacity: b.status === 1 ? 1 : 0.55, transition: 'opacity .15s' }}>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 46, height: 34, borderRadius: 7, flexShrink: 0, background: '#0e0e12', border: `1px solid ${D.cardBorder}`, overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
                        {b.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : <i className="ph ph-image" style={{ color: D.muted, fontSize: 15 }} />}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 340 }}>{b.title}</div>
                        {b.author ? <div style={{ fontSize: 12, color: D.muted2 }}>{b.author}</div> : null}
                      </div>
                    </div>
                  </td>
                  <td style={td}>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.05)', border: `1px solid ${D.cardBorder}`, color: D.text, whiteSpace: 'nowrap' }}>{b.category}</span>
                  </td>
                  <td style={{ ...td, color: D.muted2, fontSize: 13, whiteSpace: 'nowrap' }}>{b.createdAt ? new Date(b.createdAt).toLocaleDateString('es-MX') : '—'}</td>
                  <td style={{ ...td, textAlign: 'right', color: D.muted2, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{b.views.toLocaleString('es-MX')}</td>
                  <td style={td}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: b.status === 1 ? '#3fbf8f' : D.muted2 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 999, background: b.status === 1 ? '#3fbf8f' : D.muted }} />{b.status === 1 ? 'Publicado' : 'Oculto'}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 16, justifyContent: 'flex-end' }}>
                      <Link href={`/blog/editar/${b.id}`} style={{ ...actLink, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}><i className="ph ph-pencil-simple" /> Editar</Link>
                      <button type="button" onClick={() => toggleStatus(b)} disabled={pending === b.id} style={{ ...actLink, color: D.muted2, display: 'inline-flex', alignItems: 'center', gap: 5 }}><i className={`ph ${b.status === 1 ? 'ph-eye-slash' : 'ph-eye'}`} /> {b.status === 1 ? 'Ocultar' : 'Mostrar'}</button>
                      <button type="button" onClick={() => remove(b)} disabled={pending === b.id} style={{ ...actLink, color: '#f87171', display: 'inline-flex', alignItems: 'center', gap: 5 }}><i className="ph ph-trash" /> Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: D.muted2, padding: '34px 14px' }}>{q ? 'Sin resultados para tu búsqueda.' : 'Aún no hay entradas. Crea la primera con “Nueva entrada”.'}</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`@media (max-width: 780px){ .blog-head-grid{ grid-template-columns:1fr !important; } }`}</style>

      {toast ? (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 10, background: toast.ok ? '#16281c' : '#2a1416', border: `1px solid ${toast.ok ? 'rgba(63,191,143,0.4)' : 'rgba(245,80,80,0.4)'}`, color: toast.ok ? '#dff5e8' : '#f8d7d7', padding: '13px 20px', borderRadius: 13, fontSize: 14, fontWeight: 600, boxShadow: '0 16px 40px -16px rgba(0,0,0,0.7)', zIndex: 100 }}>
          <i className={`ph-bold ${toast.ok ? 'ph-check-circle' : 'ph-warning-circle'}`} style={{ fontSize: 19, color: toast.ok ? '#3fbf8f' : '#f55' }} /> {toast.text}
        </div>
      ) : null}
    </div>
  );
}
