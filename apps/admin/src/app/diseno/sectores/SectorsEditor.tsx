'use client';

import { Modal } from '@/components/Modal';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { Sectors, ThemeTokens } from '@maqserv/config';
import { VistaPreviaSitio } from '@/components/VistaPreviaSitio';
import { D, cardStyle, inputStyle, h3Style, Field, Toggle, ColorField } from '@/components/editor-kit';
import { Btn, EmptyState, IconBtn, Note, PageHeader, Panel, Segmented, StatusText, Thumb, Toast } from '@/components/ui';

type Copys = Record<string, Record<string, string>>;
interface SectorRow { id: number; title: string; status: number; image: string | null }
interface SectorFull {
  id: number; title: string; description: string | null;
  trayectoria: string | null; esencia: string | null; servicios: string | null; excelencia: string | null; serviciosLista: string | null;
  status: number; image: string | null;
}

const SEC_DEFAULTS: Sectors = { show: true, limit: 4, cardHeight: 340, eyebrowColor: null, titleColor: null, ctaColor: null };
const cv = (es: Record<string, string>, k: string, def = '') => es[k] ?? def;

const textareaStyle: CSSProperties = { ...inputStyle, height: 'auto', minHeight: 72, padding: '10px 12px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' };
/** Un interruptor suelto va en texto plano con una línea fina debajo: una tarjeta para un solo switch sobraba. */
const showRow: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 0 16px', marginBottom: 16, borderBottom: '1px solid var(--adm-border)' };

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
  const modoTema = tokens.defaultMode === 'light' ? 'light' : 'dark';
  // Lo que la vista previa le manda al sitio: lo MISMO que se publicaría.
  const borrador = useMemo(() => ({ tokens: { sectors: config.sec }, copys: { 'home.sectors.eyebrow': config.eyebrow, 'home.sectors.title': config.title, 'home.sectors.cta': config.cta } }), [config]);


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


  return (
    <div>
      <PageHeader
        eyebrow={['Sitio web', 'Secciones del home']}
        title="Sección 5 · Sectores estratégicos"
        subtitle={<>La banda «Sectores estratégicos» del home: tarjetas overlay con imagen. Aquí defines los textos y el estilo (arriba), y gestionas los <b>sectores</b> (pestaña Sectores).</>}
        actions={
          <>
            <StatusText tone={dirty ? 'warn' : 'ok'}>{dirty ? 'Cambios sin publicar' : 'Todo publicado'}</StatusText>
            <Btn variant="ghost" onClick={discard} disabled={!dirty || busy}>Descartar</Btn>
            <Btn variant="primary" icon="ph-cloud-arrow-up" onClick={publish} disabled={busy}>{busy ? 'Publicando…' : 'Guardar y publicar'}</Btn>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 468px', gap: 26, alignItems: 'start' }} className="hero-ed-grid">
        <div style={{ minWidth: 0 }}>
          <div style={showRow}>
            <div style={{ minWidth: 0 }}>
              <div className="adm-cell-title">Mostrar la sección en el home</div>
              <div className="adm-cell-sub">Apágala para ocultarla temporalmente.</div>
            </div>
            <Toggle on={s.show} onClick={() => setS('show', !s.show)} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <Segmented<'contenido' | 'sectores'>
              ariaLabel="Qué editar"
              value={tab}
              onChange={setTab}
              items={[
                { key: 'contenido', label: 'Contenido y estilo' },
                { key: 'sectores', label: 'Sectores' },
              ]}
            />
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
                <Field label={`Tarjetas a mostrar: ${s.limit}`}><input type="range" min={2} max={8} value={s.limit} onChange={(e) => setS('limit', parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: 'var(--adm-accent)' }} /></Field>
                <Field label={`Alto de la tarjeta: ${s.cardHeight}px`}><input type="range" min={220} max={460} step={10} value={s.cardHeight} onChange={(e) => setS('cardHeight', parseInt(e.target.value, 10))} style={{ width: '100%', accentColor: 'var(--adm-accent)' }} /></Field>
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

        {/* VISTA PREVIA: el sitio real pinta la sección con los cambios sin publicar. */}
        <div style={{ position: 'sticky', top: 12 }} className="hero-ed-preview">
          <VistaPreviaSitio vista="home.strategic-sectors" etiqueta="home" borrador={borrador} modoInicial={modoTema} aviso={!s.show ? <><i className="ph ph-eye-slash" /> La sección está oculta en el home.</> : null} />
        </div>
      </div>

      {toast ? <Toast kind={toast.ok ? 'ok' : 'bad'}>{toast.text}</Toast> : null}
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
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    if (nTitle.trim().length < 2) return;
    setBusy('new'); setErr(null);
    try {
      const r = await fetch('/api/admin/cms/sectors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: nTitle }) });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.id) throw new Error('No se pudo crear el sector');
      setNTitle('');
      setNuevoAbierto(false);
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

  const listo = nTitle.trim().length >= 2;

  return (
    <>
      {/* Nuevo sector: en modal (2026-09-25). */}
      <Modal
        abierto={nuevoAbierto}
        titulo="Nuevo sector"
        subtitulo="Crea el sector y luego edita sus datos e imagen. Se aplica al instante."
        onCerrar={() => setNuevoAbierto(false)}
        ancho={560}
        pie={
          <>
            <Btn variant="ghost" onClick={() => setNuevoAbierto(false)} disabled={busy === 'new'}>Cancelar</Btn>
            <Btn variant="primary" icon="ph-plus" onClick={create} disabled={busy === 'new' || !listo}>{busy === 'new' ? 'Creando…' : 'Crear y editar'}</Btn>
          </>
        }
      >
        <input value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder="Nombre del sector (ej. Minería)" className="adm-input" />
      </Modal>

      {err ? <Note tone="bad" style={{ marginBottom: 12 }}>{err}</Note> : null}

      {/* Una lista de sectores: filas en un solo panel, no una tarjeta por sector. */}
      <Panel
        title="Sectores"
        desc="Se aplican al instante (no pasan por «Guardar y publicar»)."
        action={<Btn size="sm" icon="ph-plus" onClick={() => setNuevoAbierto(true)}>Nuevo sector</Btn>}
        flush
        clip
      >
        {sectors.length === 0 ? (
          <EmptyState icon="ph-buildings" title="Aún no hay sectores" sub="Crea el primero con «Nuevo sector»." />
        ) : sectors.map((sec) => (
          editing === sec.id ? (
            <SectorEditRow key={sec.id} id={sec.id} busy={busy === sec.id} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} />
          ) : (
            <div key={sec.id} className="adm-trow" style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: sec.status === 1 ? 1 : 0.6 }}>
              <Thumb src={sec.image} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="adm-cell-title adm-ellipsis">{sec.title}</div>
                <div style={{ marginTop: 2 }}><StatusText tone={sec.status === 1 ? 'ok' : 'muted'}>{sec.status === 1 ? 'Visible' : 'Oculto'}</StatusText></div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <IconBtn icon="ph-pencil-simple" label="Editar" onClick={() => setEditing(sec.id)} />
                <IconBtn icon={sec.status === 1 ? 'ph-eye-slash' : 'ph-eye'} label={sec.status === 1 ? 'Ocultar' : 'Mostrar'} onClick={() => toggle(sec)} disabled={busy === sec.id} />
                <IconBtn icon="ph-trash" label="Eliminar" danger onClick={() => remove(sec.id)} disabled={busy === sec.id} />
              </div>
            </div>
          )
        ))}
      </Panel>
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

  // El sector en edición se abre dentro de su fila, con un fondo apenas más claro.
  return (
    <div className="adm-trow" style={{ display: 'grid', gap: 14, padding: 20, background: 'rgba(255,255,255,0.02)' }}>
      {loadErr ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13, color: 'var(--adm-bad)' }}>No se pudo cargar el sector. <Btn size="sm" variant="ghost" onClick={onClose}>Cerrar</Btn></div>
      ) : !data ? (
        <div style={{ fontSize: 13, color: 'var(--adm-muted)', padding: '8px 2px' }}><i className="ph ph-circle-notch" /> Cargando…</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <h3 style={h3Style}>Editar sector</h3>
            <Btn size="sm" variant="ghost" onClick={onClose}>Cerrar</Btn>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) pick(f); }}
              style={{ position: 'relative', width: 150, height: 100, flexShrink: 0, border: '1.5px dashed var(--adm-border-strong)', borderRadius: 12, background: preview ? 'var(--adm-page)' : D.inputBg, cursor: 'pointer', overflow: 'hidden', display: 'grid', placeItems: 'center' }}
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : <span style={{ textAlign: 'center', color: 'var(--adm-muted)', fontSize: 12.5 }}><i className="ph ph-image" style={{ fontSize: 20, display: 'block', marginBottom: 4 }} />Imagen</span>}
              <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ''; }} style={{ display: 'none' }} />
            </label>
            <div style={{ flex: 1, minWidth: 220, display: 'grid', gap: 12 }}>
              <Field label="Título"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nombre del sector" style={inputStyle} /></Field>
              {areaField('Descripción (tarjeta del home y encabezado de la página)', description, setDescription, 3, 'Descripción breve…')}
            </div>
          </div>

          <details>
            <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--adm-text-2)', padding: '4px 0' }}>Bloques de la página del sector (opcional, se permite HTML)</summary>
            <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
              {areaField('Trayectoria', trayectoria, setTrayectoria)}
              {areaField('Esencia', esencia, setEsencia)}
              {areaField('Servicios (texto)', servicios, setServicios)}
              {areaField('Excelencia', excelencia, setExcelencia)}
              {areaField('Lista de servicios (uno por línea)', serviciosLista, setServiciosLista, 4)}
            </div>
          </details>

          {err ? <span style={{ fontSize: 12.5, color: 'var(--adm-bad)' }}>{err}</span> : null}
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn icon="ph-check" onClick={save} disabled={saving || busy}>{saving ? 'Guardando…' : 'Guardar sector'}</Btn>
            <Btn variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Btn>
          </div>
        </>
      )}
    </div>
  );
}
