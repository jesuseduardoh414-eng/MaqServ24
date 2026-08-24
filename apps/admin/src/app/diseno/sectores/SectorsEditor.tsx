'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { Sectors, ThemeTokens } from '@maqserv/config';
import { D, FONT, cardStyle, inputStyle, h3Style, smallLabel, Field, Toggle, ColorField } from '@/components/editor-kit';

type Copys = Record<string, Record<string, string>>;
interface SectorRow { id: number; title: string; status: number; image: string | null }
interface SectorFull {
  id: number; title: string; description: string | null;
  trayectoria: string | null; esencia: string | null; servicios: string | null; excelencia: string | null; serviciosLista: string | null;
  status: number; image: string | null;
}

const SEC_DEFAULTS: Sectors = { show: true, limit: 4, cardHeight: 340, eyebrowColor: null, titleColor: null, ctaColor: null };
const cv = (es: Record<string, string>, k: string, def = '') => es[k] ?? def;

const textareaStyle: CSSProperties = { ...inputStyle, height: 'auto', minHeight: 72, padding: '11px 14px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' };
const btnGhost: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${D.inputBorder}`, background: 'transparent', color: D.text, borderRadius: 10, padding: '8px 13px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' };
const btnDanger: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(245,80,80,0.3)', background: 'rgba(245,80,80,0.08)', color: '#f87171', borderRadius: 10, padding: '8px 11px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' };
const btnPrimary = (on: boolean): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', background: D.amber, color: '#0a0a0b', borderRadius: 11, padding: '10px 16px', fontWeight: 800, fontSize: 13.5, cursor: on ? 'pointer' : 'default', opacity: on ? 1 : 0.5, fontFamily: 'inherit' });

interface Config { eyebrow: string; title: string; cta: string; sec: Sectors }

export function SectorsEditor({ themeId, copys, tokens, sectorsCfg, sectors }: {
  themeId: number | null; copys: Copys; tokens: ThemeTokens; sectorsCfg: Sectors; sectors: SectorRow[];
}) {
  const router = useRouter();
  const initial: Config = useMemo(() => {
    const es = copys['es'] ?? {};
    return {
      eyebrow: cv(es, 'home.sectors.eyebrow', 'Industrias que servimos'),
      title: cv(es, 'home.sectors.title', 'Sectores estratégicos'),
      cta: cv(es, 'home.sectors.cta', 'Explorar equipos'),
      sec: { ...SEC_DEFAULTS, ...(sectorsCfg ?? {}) },
    };
  }, [copys, sectorsCfg]);

  const [config, setConfig] = useState<Config>(initial);
  const [saved, setSaved] = useState<Config>(initial);
  const [tab, setTab] = useState<'contenido' | 'sectores'>('contenido');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setConfig((c) => ({ ...c, [k]: v }));
  const setS = <K extends keyof Sectors>(k: K, v: Sectors[K]) => setConfig((c) => ({ ...c, sec: { ...c.sec, [k]: v } }));
  const s = config.sec;
  const dirty = JSON.stringify(config) !== JSON.stringify(saved);

  const eye = s.eyebrowColor ?? '#004A99';
  const ttl = s.titleColor ?? '#1A1A1B';
  const cta = s.ctaColor ?? '#FFC107';

  function discard() { setConfig(saved); setToast(null); }
  async function publish() {
    if (busy || !themeId) return;
    setBusy(true); setToast(null);
    try {
      const es = { ...(copys['es'] ?? {}) };
      es['home.sectors.eyebrow'] = config.eyebrow;
      es['home.sectors.title'] = config.title;
      es['home.sectors.cta'] = config.cta;
      const body = { tokens: { ...tokens, sectors: config.sec }, copys: { ...copys, es } };
      const r2 = await fetch(`/api/admin/themes/${themeId}/draft`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r2.ok) throw new Error('No se pudieron guardar los ajustes');
      const r3 = await fetch(`/api/admin/themes/${themeId}/publish`, { method: 'POST' });
      if (!r3.ok) throw new Error('No se pudo publicar');
      setSaved(config);
      setToast({ ok: true, text: 'Publicado — el sitio se actualizará al refrescar.' });
      router.refresh();
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  const shown = sectors.slice(0, s.limit);

  return (
    <div style={{ fontFamily: FONT, color: D.text }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />

      {/* Barra de acciones */}
      <div style={{ background: '#0c0c0e', border: `1px solid ${D.cardBorder}`, borderRadius: 16, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: D.muted2, fontSize: '12.5px', fontWeight: 600, marginBottom: 5 }}><i className="ph ph-paint-brush-broad" style={{ fontSize: 14 }} /> Diseño del sitio <span style={{ opacity: 0.5 }}>·</span> Sectores</div>
          <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em' }}>Sección 5 · Sectores estratégicos</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, padding: '8px 13px', borderRadius: 999, border: `1px solid ${dirty ? 'color-mix(in srgb, var(--color-primary) 40%, transparent)' : 'rgba(255,255,255,0.08)'}`, background: dirty ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'rgba(255,255,255,0.03)', color: dirty ? D.amber : D.muted2 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: dirty ? D.amber : '#3fbf8f' }} />{dirty ? 'Cambios sin publicar' : 'Todo publicado'}</span>
          <button type="button" onClick={discard} disabled={!dirty || busy} style={{ border: `1px solid ${D.inputBorder}`, background: 'transparent', color: dirty ? D.text : D.muted2, borderRadius: 11, padding: '10px 16px', fontWeight: 600, fontSize: 14, cursor: dirty && !busy ? 'pointer' : 'default', opacity: dirty && !busy ? 1 : 0.5, fontFamily: 'inherit' }}>Descartar</button>
          <button type="button" onClick={publish} disabled={busy} style={{ border: 'none', background: D.amber, color: '#0a0a0b', borderRadius: 11, padding: '11px 18px', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}><i className="ph-bold ph-cloud-arrow-up" style={{ fontSize: 17 }} /> {busy ? 'Publicando…' : 'Guardar y publicar'}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 468px', gap: 26, alignItems: 'start' }} className="hero-ed-grid">
        <div style={{ minWidth: 0 }}>
          <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)', color: D.amber, display: 'grid', placeItems: 'center', flexShrink: 0 }}><i className="ph ph-buildings" style={{ fontSize: 20 }} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ fontSize: 14 }}>La banda «Sectores estratégicos» del home</strong>
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: D.muted2 }}>Tarjetas overlay con imagen. Aquí defines los textos y el estilo (arriba), y gestionas los <b>sectores</b> (pestaña Sectores).</p>
            </div>
          </div>

          <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div><strong style={{ fontSize: 13.5 }}>Mostrar la sección en el home</strong><p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>Apágala para ocultarla temporalmente.</p></div>
            <Toggle on={s.show} onClick={() => setS('show', !s.show)} />
          </div>

          <div style={{ display: 'flex', gap: 4, padding: 5, background: D.tabsBg, border: `1px solid ${D.cardBorder}`, borderRadius: 14, marginBottom: 22, flexWrap: 'wrap' }}>
            {([['contenido', 'Contenido y estilo', 'ph-text-aa'], ['sectores', 'Sectores', 'ph-buildings']] as const).map(([id, label, icon]) => (
              <button key={id} type="button" onClick={() => setTab(id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', cursor: 'pointer', borderRadius: 10, padding: '9px 15px', fontWeight: 700, fontSize: '13.5px', fontFamily: 'inherit', background: tab === id ? D.amber : 'transparent', color: tab === id ? '#0a0a0b' : D.muted2 }}><i className={`ph ${icon}`} style={{ fontSize: 16 }} /> {label}</button>
            ))}
          </div>

          {tab === 'contenido' ? (
            <div style={{ animation: 'fadeIn .25s ease' }}>
              <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
                <h3 style={h3Style}>Textos del encabezado</h3>
                <Field label="Eyebrow (línea pequeña arriba)"><input value={config.eyebrow} onChange={(e) => set('eyebrow', e.target.value)} placeholder="Industrias que servimos" style={inputStyle} /></Field>
                <Field label="Título"><input value={config.title} onChange={(e) => set('title', e.target.value)} placeholder="Sectores estratégicos" style={inputStyle} /></Field>
                <Field label="Texto del enlace de cada tarjeta"><input value={config.cta} onChange={(e) => set('cta', e.target.value)} placeholder="Explorar equipos" style={inputStyle} /></Field>
              </div>
              <div style={{ ...cardStyle, display: 'grid', gap: 18 }}>
                <h3 style={h3Style}>Estilo</h3>
                <Field label={`Tarjetas a mostrar: ${s.limit}`}><input type="range" min={2} max={8} value={s.limit} onChange={(e) => setS('limit', parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: D.amber }} /></Field>
                <Field label={`Alto de la tarjeta: ${s.cardHeight}px`}><input type="range" min={220} max={460} step={10} value={s.cardHeight} onChange={(e) => setS('cardHeight', parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: D.amber }} /></Field>
                <ColorField label="Color del eyebrow" value={s.eyebrowColor} onChange={(v) => setS('eyebrowColor', v)} />
                <ColorField label="Color del título" value={s.titleColor} onChange={(v) => setS('titleColor', v)} />
                <ColorField label="Color del enlace de la tarjeta" value={s.ctaColor} onChange={(v) => setS('ctaColor', v)} />
              </div>
            </div>
          ) : null}

          {tab === 'sectores' ? (
            <div style={{ animation: 'fadeIn .25s ease' }}>
              <SectorsManager sectors={sectors} />
            </div>
          ) : null}
        </div>

        {/* PREVIEW */}
        <div style={{ position: 'sticky', top: 12 }} className="hero-ed-preview">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: D.muted2, marginBottom: 14 }}><span style={{ width: 6, height: 6, borderRadius: 999, background: '#3fbf8f', boxShadow: '0 0 8px #3fbf8f' }} /> Vista previa · home</div>
          <div style={{ border: `1px solid ${D.inputBorder}`, borderRadius: 18, background: '#f8f9fa', padding: 18 }}>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: eye, fontWeight: 700, fontSize: 8.5, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 5 }}><span style={{ width: 14, height: 2.5, background: eye }} />{config.eyebrow || 'Eyebrow'}</div>
              <div style={{ fontSize: 17, fontWeight: 800, textTransform: 'uppercase', color: ttl, lineHeight: 1.05 }}>{config.title || 'Sectores estratégicos'}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(s.limit, 2)}, 1fr)`, gap: 8 }}>
              {(shown.length ? shown : [{ id: 0, title: 'Sector', status: 1, image: null }]).map((sec, i) => (
                <div key={sec.id ?? i} style={{ position: 'relative', height: Math.round(s.cardHeight * 0.42), borderRadius: 10, overflow: 'hidden', background: sec.image ? `#e7e9ee url(${sec.image}) center/cover no-repeat` : 'repeating-linear-gradient(135deg,#e7e9ee 0 10px,#eef0f3 10px 20px)' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(26,26,27,.92) 10%, rgba(26,26,27,.15) 60%, transparent)' }} />
                  <div style={{ position: 'absolute', left: 10, right: 10, bottom: 9, color: '#fff' }}>
                    <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1.1, marginBottom: 4 }}>{sec.title}</div>
                    <div style={{ fontSize: 7.5, fontWeight: 700, color: cta }}>{config.cta || 'Explorar'} →</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {!s.show ? <p style={{ margin: '12px 2px 0', fontSize: 12, color: D.muted2 }}><i className="ph ph-eye-slash" /> La sección está oculta en el home.</p> : null}
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

/* ===================== Gestión de sectores ===================== */
/* Reusa /admin/cms/sectors (POST crear, GET :id detalle, PATCH multipart, DELETE).
 * Se aplica al instante (no pasa por «Guardar y publicar»). */

function SectorsManager({ sectors }: { sectors: SectorRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | 'new' | null>(null);
  const [nTitle, setNTitle] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    if (nTitle.trim().length < 2) return;
    setBusy('new'); setErr(null);
    try {
      const r = await fetch('/api/admin/cms/sectors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: nTitle }) });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.id) throw new Error('No se pudo crear el sector');
      setNTitle('');
      setEditing(Number(d.id));
      router.refresh();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }
  async function toggle(sec: SectorRow) {
    setBusy(sec.id); setErr(null);
    try {
      const fd = new FormData(); fd.append('status', sec.status === 1 ? '0' : '1');
      const r = await fetch(`/api/admin/cms/sectors/${sec.id}`, { method: 'PATCH', body: fd });
      if (!r.ok) throw new Error('No se pudo cambiar la visibilidad');
      router.refresh();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }
  async function remove(id: number) {
    if (!window.confirm('¿Eliminar este sector? No se puede deshacer.')) return;
    setBusy(id); setErr(null);
    try {
      const r = await fetch(`/api/admin/cms/sectors/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('No se pudo eliminar');
      setEditing((e) => (e === id ? null : e));
      router.refresh();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }

  return (
    <>
      <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)', color: D.amber, display: 'grid', placeItems: 'center', flexShrink: 0 }}><i className="ph ph-plus" style={{ fontSize: 17 }} /></div>
          <div><h3 style={h3Style}>Nuevo sector</h3><p style={{ margin: '2px 0 0', fontSize: 12, color: D.muted }}>Crea el sector y luego edita sus datos e imagen. Se aplica al instante.</p></div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder="Nombre del sector (ej. Minería)" style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
          <button type="button" onClick={create} disabled={busy === 'new' || nTitle.trim().length < 2} style={btnPrimary(busy !== 'new' && nTitle.trim().length >= 2)}><i className="ph-bold ph-plus" /> {busy === 'new' ? 'Creando…' : 'Crear y editar'}</button>
        </div>
      </div>

      {err ? <div style={{ marginBottom: 12, fontSize: 12.5, color: '#f87171', display: 'flex', alignItems: 'center', gap: 7 }}><i className="ph ph-warning-circle" /> {err}</div> : null}

      {sectors.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', color: D.muted2, fontSize: 13 }}>Aún no hay sectores. Crea el primero arriba.</div>
      ) : sectors.map((sec) => (
        editing === sec.id ? (
          <SectorEditRow key={sec.id} id={sec.id} busy={busy === sec.id} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} />
        ) : (
          <div key={sec.id} style={{ ...cardStyle, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14, opacity: sec.status === 1 ? 1 : 0.6 }}>
            <div style={{ width: 60, height: 44, borderRadius: 9, flexShrink: 0, overflow: 'hidden', background: D.inputBg, display: 'grid', placeItems: 'center' }}>
              {sec.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sec.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : <i className="ph ph-image" style={{ color: D.muted2, fontSize: 18 }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ fontSize: 14, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sec.title}</strong>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: sec.status === 1 ? '#3fbf8f' : D.muted2 }}>{sec.status === 1 ? 'Visible' : 'Oculto'}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button type="button" onClick={() => setEditing(sec.id)} style={btnGhost}><i className="ph ph-pencil-simple" /> Editar</button>
              <button type="button" onClick={() => toggle(sec)} disabled={busy === sec.id} style={btnGhost} title={sec.status === 1 ? 'Ocultar' : 'Mostrar'}><i className={`ph ${sec.status === 1 ? 'ph-eye-slash' : 'ph-eye'}`} /></button>
              <button type="button" onClick={() => remove(sec.id)} disabled={busy === sec.id} title="Eliminar" style={btnDanger}><i className="ph ph-trash" /></button>
            </div>
          </div>
        )
      ))}
    </>
  );
}

function SectorEditRow({ id, busy, onClose, onSaved }: { id: number; busy: boolean; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState<SectorFull | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [trayectoria, setTrayectoria] = useState('');
  const [esencia, setEsencia] = useState('');
  const [servicios, setServicios] = useState('');
  const [excelencia, setExcelencia] = useState('');
  const [serviciosLista, setServiciosLista] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/cms/sectors/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SectorFull | null) => {
        if (!alive) return;
        if (!d) { setLoadErr(true); return; }
        setData(d);
        setTitle(d.title ?? ''); setDescription(d.description ?? '');
        setTrayectoria(d.trayectoria ?? ''); setEsencia(d.esencia ?? ''); setServicios(d.servicios ?? '');
        setExcelencia(d.excelencia ?? ''); setServiciosLista(d.serviciosLista ?? ''); setPreview(d.image);
      })
      .catch(() => alive && setLoadErr(true));
    return () => { alive = false; };
  }, [id]);

  function pick(f: File) { if (f.type.startsWith('image/')) { setFile(f); setPreview(URL.createObjectURL(f)); } }
  async function save() {
    if (title.trim().length < 2) { setErr('El título es obligatorio'); return; }
    setSaving(true); setErr(null);
    try {
      const fd = new FormData();
      fd.append('title', title); fd.append('description', description);
      fd.append('trayectoria', trayectoria); fd.append('esencia', esencia); fd.append('servicios', servicios);
      fd.append('excelencia', excelencia); fd.append('serviciosLista', serviciosLista);
      if (file) fd.append('image', file);
      const r = await fetch(`/api/admin/cms/sectors/${id}`, { method: 'PATCH', body: fd });
      if (!r.ok) throw new Error('No se pudo guardar el sector');
      onSaved();
    } catch (e) { setErr((e as Error).message); } finally { setSaving(false); }
  }

  const areaField = (label: string, value: string, on: (v: string) => void, rows = 2, ph = '') => (
    <Field label={label}><textarea value={value} onChange={(e) => on(e.target.value)} rows={rows} placeholder={ph} style={textareaStyle} /></Field>
  );

  return (
    <div style={{ ...cardStyle, marginBottom: 12, display: 'grid', gap: 14, border: `1px solid ${D.amber}44` }}>
      {loadErr ? (
        <div style={{ fontSize: 13, color: '#f87171' }}>No se pudo cargar el sector. <button type="button" onClick={onClose} style={btnGhost}>Cerrar</button></div>
      ) : !data ? (
        <div style={{ fontSize: 13, color: D.muted2, padding: '8px 2px' }}><i className="ph ph-circle-notch" /> Cargando…</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <h3 style={h3Style}>Editar sector</h3>
            <button type="button" onClick={onClose} style={btnGhost}>Cerrar</button>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) pick(f); }}
              style={{ position: 'relative', width: 150, height: 100, flexShrink: 0, border: `1.5px dashed ${D.inputBorder}`, borderRadius: 12, background: preview ? '#0d0d10' : D.inputBg, cursor: 'pointer', overflow: 'hidden', display: 'grid', placeItems: 'center' }}
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : <span style={{ textAlign: 'center', color: D.muted2, fontSize: 12 }}><i className="ph ph-image" style={{ fontSize: 20, display: 'block', marginBottom: 4 }} />Imagen</span>}
              <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ''; }} style={{ display: 'none' }} />
            </label>
            <div style={{ flex: 1, minWidth: 220, display: 'grid', gap: 12 }}>
              <Field label="Título"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nombre del sector" style={inputStyle} /></Field>
              {areaField('Descripción (tarjeta del home y encabezado de la página)', description, setDescription, 3, 'Descripción breve…')}
            </div>
          </div>

          <details>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: D.muted2, padding: '4px 0' }}>Bloques de la página del sector (opcional, se permite HTML)</summary>
            <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
              {areaField('Trayectoria', trayectoria, setTrayectoria)}
              {areaField('Esencia', esencia, setEsencia)}
              {areaField('Servicios (texto)', servicios, setServicios)}
              {areaField('Excelencia', excelencia, setExcelencia)}
              {areaField('Lista de servicios (uno por línea)', serviciosLista, setServiciosLista, 4)}
            </div>
          </details>

          {err ? <span style={{ fontSize: 12, color: '#f87171' }}>{err}</span> : null}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={save} disabled={saving || busy} style={btnPrimary(!saving && !busy)}><i className="ph-bold ph-check" /> {saving ? 'Guardando…' : 'Guardar sector'}</button>
            <button type="button" onClick={onClose} disabled={saving} style={btnGhost}>Cancelar</button>
          </div>
        </>
      )}
    </div>
  );
}
