'use client';

import { Modal } from '@/components/Modal';
import { useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { ThemeTokens, WhyChooseUs, QuienesSomos, QsStat, QsValue, QsMilestone } from '@maqserv/config';
import { VistaPreviaSitio } from '@/components/VistaPreviaSitio';
import { D, cardStyle, inputStyle, h3Style, smallLabel, Field, Toggle, ColorField } from '@/components/editor-kit';
import { Btn, Chip, EmptyState, IconBtn, Note, PageHeader, Panel, SectionHead, Segmented, StatusText, Toast } from '@/components/ui';

type Copys = Record<string, Record<string, string>>;
type Placement = 'both' | 'home' | 'about';
interface Reason { id: number; title: string; text: string; image: string | null; placement: Placement }
interface InfSitio { frase: string | null; titulo: string | null; descripcion: string | null; mision: string | null; vision: string | null; objetivos: string | null; imagenes: string[] }
/** Espejo en vivo del contenido de la página para el preview. */
type PageLive = { frase: string; titulo: string; descripcion: string; mision: string; vision: string; objetivos: string; imagenes: string[] };

const WCU_DEFAULTS: WhyChooseUs = {
  show: true, image: null, showYearsBadge: true, showStats: true,
  eyebrowColor: null, titleColor: null, accentColor: null, statsBg: null, statsFg: null,
};

interface Stat { num: string; label: string }
interface Config {
  eyebrow: string; title: string; subtitle: string;
  yearsNum: string; yearsLabel: string;
  stats: [Stat, Stat, Stat];
  wcu: WhyChooseUs;
  qs: QuienesSomos;
}

type Tab = 'contenido' | 'razones' | 'pagina' | 'estilo';

const cv = (es: Record<string, string>, k: string, def = '') => es[k] ?? def;

/** Descripción bajo el título de cada bloque. */
const desc: CSSProperties = { margin: '3px 0 0', fontSize: 12.5, color: 'var(--adm-muted)' };
/** Un interruptor suelto va en texto plano con una línea fina debajo: una tarjeta para un solo switch sobraba. */
const showRow: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 0 16px', marginBottom: 16, borderBottom: '1px solid var(--adm-border)' };
/** Texto que explica un bloque de la pestaña: plano, sin tarjeta con icono. */
const intro: CSSProperties = { margin: '0 0 16px', fontSize: 13, lineHeight: 1.55, color: 'var(--adm-muted)' };

/** Copys de la banda del home. Los usan «Guardar y publicar» y la vista previa. */
function copysDeBanda(c: Config): Record<string, string> {
  const es: Record<string, string> = {
    'home.whyChooseUs.eyebrow': c.eyebrow,
    'home.whyChooseUs.title': c.title,
    'home.whyChooseUs.subtitle': c.subtitle,
    'home.whyChooseUs.years.num': c.yearsNum,
    'home.whyChooseUs.years.label': c.yearsLabel,
  };
  c.stats.forEach((s, i) => {
    es[`home.whyChooseUs.stat${i + 1}.num`] = s.num;
    es[`home.whyChooseUs.stat${i + 1}.label`] = s.label;
  });
  return es;
}

export function QuienesEditor({ themeId, copys, tokens, whyChooseUs, reasons, infSitio }: {
  themeId: number | null; copys: Copys; tokens: ThemeTokens; whyChooseUs: WhyChooseUs; reasons: Reason[]; infSitio: InfSitio | null;
}) {
  const router = useRouter();
  const initial: Config = useMemo(() => {
    const es = copys['es'] ?? {};
    return {
      eyebrow: cv(es, 'home.whyChooseUs.eyebrow', 'Nuestro compromiso'),
      title: cv(es, 'home.whyChooseUs.title', '¿Por qué elegirnos?'),
      subtitle: cv(es, 'home.whyChooseUs.subtitle', ''),
      yearsNum: cv(es, 'home.whyChooseUs.years.num', '12+'),
      yearsLabel: cv(es, 'home.whyChooseUs.years.label', 'Años de experiencia'),
      stats: [
        { num: cv(es, 'home.whyChooseUs.stat1.num', '500+'), label: cv(es, 'home.whyChooseUs.stat1.label', 'Equipos disponibles') },
        { num: cv(es, 'home.whyChooseUs.stat2.num', '5,000+'), label: cv(es, 'home.whyChooseUs.stat2.label', 'Proyectos completados') },
        { num: cv(es, 'home.whyChooseUs.stat3.num', '98%'), label: cv(es, 'home.whyChooseUs.stat3.label', 'Clientes satisfechos') },
      ],
      wcu: { ...WCU_DEFAULTS, ...(whyChooseUs ?? {}) },
      qs: tokens.quienesSomos,
    };
  }, [copys, whyChooseUs, tokens]);

  const [config, setConfig] = useState<Config>(initial);
  const [saved, setSaved] = useState<Config>(initial);
  const [tab, setTab] = useState<Tab>('contenido');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  // Espejo en vivo de TODO el contenido de inf_sitio (textos + imágenes) para que
  // el preview de la página sea fiel al público y actualice mientras se escribe.
  const [pageLive, setPageLive] = useState({
    frase: infSitio?.frase ?? '', titulo: infSitio?.titulo ?? '', descripcion: infSitio?.descripcion ?? '',
    mision: infSitio?.mision ?? '', vision: infSitio?.vision ?? '', objetivos: infSitio?.objetivos ?? '',
    imagenes: infSitio?.imagenes ?? [] as string[],
  });
  const applyLive = (patch: Partial<typeof pageLive>) => setPageLive((p) => ({ ...p, ...patch }));

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setConfig((c) => ({ ...c, [k]: v }));
  const setW = <K extends keyof WhyChooseUs>(k: K, v: WhyChooseUs[K]) => setConfig((c) => ({ ...c, wcu: { ...c.wcu, [k]: v } }));
  const setStat = (i: number, patch: Partial<Stat>) =>
    setConfig((c) => ({ ...c, stats: c.stats.map((s, j) => (j === i ? { ...s, ...patch } : s)) as [Stat, Stat, Stat] }));
  const setQs = (patch: Partial<QuienesSomos>) => setConfig((c) => ({ ...c, qs: { ...c.qs, ...patch } }));

  const w = config.wcu;
  const modoTema = tokens.defaultMode === 'light' ? 'light' : 'dark';
  const dirty = JSON.stringify(config) !== JSON.stringify(saved);

  // Lo que la vista previa le manda al sitio: lo MISMO que se publicaría.
  const razonesSitio = useMemo(
    () => reasons.map((r) => ({ id: r.id, title: r.title, description: r.text, icon: null, photo: r.image, placement: r.placement })),
    [reasons],
  );
  const borradorBanda = useMemo(
    () => ({ tokens: { whyChooseUs: config.wcu }, copys: copysDeBanda(config), datos: { razones: razonesSitio } }),
    [config, razonesSitio],
  );
  const borradorPagina = useMemo(
    () => ({ tokens: { quienesSomos: config.qs }, datos: { infSitio: pageLive, razones: razonesSitio } }),
    [config.qs, pageLive, razonesSitio],
  );

  async function upload(file: File) {
    if (!file.type.startsWith('image/')) { setToast({ ok: false, text: 'Usa una imagen (PNG, JPG, WebP…)' }); return; }
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch('/api/admin/cms/upload', { method: 'POST', body: fd });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.url) throw new Error(d?.message ?? 'No se pudo subir la imagen');
      setW('image', d.url as string);
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); } finally { setUploading(false); }
  }

  function discard() { setConfig(saved); setToast(null); }
  async function publish() {
    if (busy || !themeId) return;
    setBusy(true); setToast(null);
    try {
      const es = { ...(copys['es'] ?? {}), ...copysDeBanda(config) };
      const body = { tokens: { ...tokens, whyChooseUs: config.wcu, quienesSomos: config.qs }, copys: { ...copys, es } };
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
      {/* Nota: todo lo de esta sección se edita aquí */}
      <PageHeader
        eyebrow={['Sitio web', 'Secciones del home']}
        title="Sección 4 · Quiénes somos"
        subtitle={<>La banda «¿Por qué elegirnos?» del home. Todo en un solo lugar: las <b>razones</b> (◆ cada punto), los <b>textos</b>, las <b>estadísticas</b>, la <b>imagen</b> y el <b>estilo</b>.</>}
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
          {/* Toggle mostrar sección */}
          <div style={showRow}>
            <div style={{ minWidth: 0 }}>
              <div className="adm-cell-title">Mostrar la sección en el home</div>
              <div className="adm-cell-sub">Apágala para ocultarla temporalmente.</div>
            </div>
            <Toggle on={w.show} onClick={() => setW('show', !w.show)} />
          </div>

          {/* Tabs */}
          <div style={{ marginBottom: 18 }}>
            <Segmented<Tab>
              ariaLabel="Qué editar"
              value={tab}
              onChange={setTab}
              items={[
                { key: 'contenido', label: 'Contenido' },
                { key: 'razones', label: 'Razones' },
                { key: 'pagina', label: 'Página completa' },
                { key: 'estilo', label: 'Imagen y estilo' },
              ]}
            />
          </div>

          {/* CONTENIDO */}
          {tab === 'contenido' ? (
            <div style={{ animation: 'fadeIn .25s ease' }}>
              <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
                <h3 style={h3Style}>Textos</h3>
                <Field label="Eyebrow (línea pequeña arriba)"><input value={config.eyebrow} onChange={(e) => set('eyebrow', e.target.value)} placeholder="Nuestro compromiso" style={inputStyle} /></Field>
                <Field label="Título"><input value={config.title} onChange={(e) => set('title', e.target.value)} placeholder="¿Por qué elegirnos?" style={inputStyle} /></Field>
                <Field label="Subtítulo"><textarea value={config.subtitle} onChange={(e) => set('subtitle', e.target.value)} rows={2} placeholder="Más que un proveedor de maquinaria…" style={{ ...inputStyle, height: 'auto', padding: '10px 12px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
              </div>

              <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div><h3 style={h3Style}>Tarjeta de años</h3><p style={desc}>La tarjeta flotante sobre la imagen.</p></div>
                  <Toggle on={w.showYearsBadge} onClick={() => setW('showYearsBadge', !w.showYearsBadge)} />
                </div>
                {w.showYearsBadge ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 14 }}>
                    <Field label="Número"><input value={config.yearsNum} onChange={(e) => set('yearsNum', e.target.value)} placeholder="12+" style={inputStyle} /></Field>
                    <Field label="Etiqueta"><input value={config.yearsLabel} onChange={(e) => set('yearsLabel', e.target.value)} placeholder="Años de experiencia" style={inputStyle} /></Field>
                  </div>
                ) : null}
              </div>

              <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div><h3 style={h3Style}>Barra de estadísticas</h3><p style={desc}>Los 3 números animados al pie.</p></div>
                  <Toggle on={w.showStats} onClick={() => setW('showStats', !w.showStats)} />
                </div>
                {w.showStats ? config.stats.map((s, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 14, paddingTop: i > 0 ? 12 : 0, borderTop: i > 0 ? '1px solid var(--adm-border)' : 'none' }}>
                    <Field label={`Número ${i + 1}`}><input value={s.num} onChange={(e) => setStat(i, { num: e.target.value })} placeholder="500+" style={inputStyle} /></Field>
                    <Field label={`Etiqueta ${i + 1}`}><input value={s.label} onChange={(e) => setStat(i, { label: e.target.value })} placeholder="Equipos disponibles" style={inputStyle} /></Field>
                  </div>
                )) : null}
              </div>
            </div>
          ) : null}

          {/* RAZONES */}
          {tab === 'razones' ? (
            <div style={{ animation: 'fadeIn .25s ease' }}>
              <ReasonsManager reasons={reasons} />
            </div>
          ) : null}

          {/* PÁGINA COMPLETA (/quienes-somos) */}
          {tab === 'pagina' ? (
            <div style={{ animation: 'fadeIn .25s ease' }}>
              <PageForm data={infSitio} onLive={applyLive} />
              <QsSections qs={config.qs} setQs={setQs} />
            </div>
          ) : null}

          {/* IMAGEN Y ESTILO */}
          {tab === 'estilo' ? (
            <div style={{ animation: 'fadeIn .25s ease' }}>
              <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
                <div><h3 style={h3Style}>Imagen principal</h3><p style={desc}>La foto grande de la izquierda de la sección. Vacío ⇒ se muestra un marcador.</p></div>
                <label
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
                  style={{ position: 'relative', display: 'grid', placeItems: 'center', minHeight: w.image ? 170 : 120, border: '1.5px dashed var(--adm-border-strong)', borderRadius: 12, background: w.image ? 'var(--adm-page)' : D.inputBg, cursor: 'pointer', overflow: 'hidden', padding: 12 }}
                >
                  {w.image ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={w.image} alt="" style={{ maxHeight: 148, maxWidth: '100%', objectFit: 'contain', borderRadius: 8 }} />
                      <button type="button" onClick={(e) => { e.preventDefault(); setW('image', null); }} style={{ position: 'absolute', top: 8, right: 8, display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><i className="ph ph-trash" /> Quitar</button>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--adm-muted)', fontSize: 13 }}>
                      <i className="ph ph-image" style={{ fontSize: 22, display: 'block', marginBottom: 6 }} />
                      {uploading ? 'Subiendo…' : 'Arrastra una imagen o haz clic'}
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} style={{ display: 'none' }} />
                </label>
              </div>

              <div style={{ ...cardStyle, display: 'grid', gap: 18 }}>
                <h3 style={h3Style}>Colores</h3>
                <ColorField label="Color del eyebrow" value={w.eyebrowColor} onChange={(v) => setW('eyebrowColor', v)} />
                <ColorField label="Color del título" value={w.titleColor} onChange={(v) => setW('titleColor', v)} />
                <ColorField label="Acento (viñeta ◆ de cada razón)" value={w.accentColor} onChange={(v) => setW('accentColor', v)} />
                <ColorField label="Fondo de la barra de stats" value={w.statsBg} onChange={(v) => setW('statsBg', v)} />
                <ColorField label="Texto de la barra de stats" value={w.statsFg} onChange={(v) => setW('statsFg', v)} />
              </div>
            </div>
          ) : null}
        </div>

        {/* VISTA PREVIA: el sitio real pinta la sección con los cambios sin publicar. */}
        <div style={{ position: 'sticky', top: 12 }} className="hero-ed-preview">
          {tab === 'pagina' ? (
            <VistaPreviaSitio key="pagina" vista="pagina.quienes-somos" etiqueta="página /quienes-somos" borrador={borradorPagina} modoInicial={modoTema} />
          ) : (
            <VistaPreviaSitio
              key="banda"
              vista="home.why-choose-us"
              etiqueta="home"
              borrador={borradorBanda}
              modoInicial={modoTema}
              aviso={!w.show ? <><i className="ph ph-eye-slash" /> La sección está oculta en el home.</> : null}
            />
          )}
        </div>
      </div>

      {toast ? <Toast kind={toast.ok ? 'ok' : 'bad'}>{toast.text}</Toast> : null}
    </div>
  );
}

/* ===================== CRUD de razones (◆) ===================== */
/* Reusa /admin/cms/why-choose-us (POST/PATCH multipart, DELETE). Cada razón se
 * guarda por sí sola y se aplica al instante (no pasa por borrador/publicar). */

const textareaStyle: CSSProperties = { ...inputStyle, height: 'auto', minHeight: 66, padding: '10px 12px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' };

const PLACEMENTS: { id: Placement; label: string; icon: string }[] = [
  { id: 'both', label: 'Ambas', icon: 'ph-squares-four' },
  { id: 'home', label: 'Solo home', icon: 'ph-house' },
  { id: 'about', label: 'Solo Quiénes somos', icon: 'ph-identification-card' },
];

function PlacementSeg({ value, onChange }: { value: Placement; onChange: (v: Placement) => void }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <span style={smallLabel}>Dónde se muestra</span>
      <div>
        <Segmented<Placement>
          ariaLabel="Dónde se muestra"
          value={value}
          onChange={onChange}
          items={PLACEMENTS.map((p) => ({ key: p.id, label: p.label }))}
        />
      </div>
    </div>
  );
}

function PlaceBadge({ value }: { value: Placement }) {
  const def = PLACEMENTS.find((x) => x.id === value) ?? PLACEMENTS[0];
  const solo = value !== 'both';
  return <Chip tone={solo ? 'accent' : undefined}><i className={`ph ${def.icon}`} style={{ fontSize: 12 }} aria-hidden /> {def.label}</Chip>;
}

function ReasonEditRow({ reason, busy, onSave, onCancel }: {
  reason: Reason; busy: boolean; onSave: (title: string, text: string, placement: Placement) => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState(reason.title);
  const [text, setText] = useState(reason.text);
  const [placement, setPlacement] = useState<Placement>(reason.placement);
  const ready = !!title.trim() && !!text.trim();
  // La razón en edición se abre dentro de su fila, con un fondo apenas más claro.
  return (
    <div className="adm-trow" style={{ display: 'grid', gap: 12, padding: 20, background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ display: 'grid', gap: 10 }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" style={inputStyle} />
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Descripción" style={textareaStyle} />
      </div>
      <PlacementSeg value={placement} onChange={setPlacement} />
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn icon="ph-check" onClick={() => onSave(title, text, placement)} disabled={busy || !ready}>{busy ? 'Guardando…' : 'Guardar'}</Btn>
        <Btn variant="ghost" onClick={onCancel} disabled={busy}>Cancelar</Btn>
      </div>
    </div>
  );
}

function ReasonsManager({ reasons }: { reasons: Reason[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | 'new' | null>(null);
  const [nTitle, setNTitle] = useState('');
  const [nuevaAbierta, setNuevaAbierta] = useState(false);
  const [nText, setNText] = useState('');
  const [nPlacement, setNPlacement] = useState<Placement>('both');
  const [err, setErr] = useState<string | null>(null);
  const newReady = !!nTitle.trim() && !!nText.trim();

  async function create() {
    if (!newReady) return;
    setBusy('new'); setErr(null);
    try {
      const fd = new FormData(); fd.append('title', nTitle); fd.append('text', nText); fd.append('placement', nPlacement);
      const r = await fetch('/api/admin/cms/why-choose-us', { method: 'POST', body: fd });
      if (!r.ok) throw new Error('No se pudo agregar la razón');
      setNTitle(''); setNText(''); setNPlacement('both');
      setNuevaAbierta(false);
      router.refresh();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }
  async function update(id: number, title: string, text: string, placement: Placement) {
    setBusy(id); setErr(null);
    try {
      const fd = new FormData(); fd.append('title', title); fd.append('text', text); fd.append('placement', placement);
      const r = await fetch(`/api/admin/cms/why-choose-us/${id}`, { method: 'PATCH', body: fd });
      if (!r.ok) throw new Error('No se pudo guardar la razón');
      setEditing(null); router.refresh();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }
  async function remove(id: number) {
    if (!window.confirm('¿Eliminar esta razón? No se puede deshacer.')) return;
    setBusy(id); setErr(null);
    try {
      const r = await fetch(`/api/admin/cms/why-choose-us/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('No se pudo eliminar la razón');
      router.refresh();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }

  return (
    <>
      {/* Nueva razón: en modal (2026-09-25). */}
      <Modal
        abierto={nuevaAbierta}
        titulo="Nueva razón"
        subtitulo="Se aplica al instante (no pasa por «Guardar y publicar»)."
        onCerrar={() => setNuevaAbierta(false)}
        ancho={620}
        pie={
          <>
            <Btn variant="ghost" onClick={() => setNuevaAbierta(false)} disabled={busy === 'new'}>Cancelar</Btn>
            <Btn variant="primary" icon="ph-plus" onClick={create} disabled={busy === 'new' || !newReady}>{busy === 'new' ? 'Agregando…' : 'Agregar razón'}</Btn>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <input value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder="Título (ej. Transparencia total)" style={inputStyle} />
            <textarea value={nText} onChange={(e) => setNText(e.target.value)} rows={2} placeholder="Descripción breve…" style={textareaStyle} />
          </div>
          <PlacementSeg value={nPlacement} onChange={setNPlacement} />
        </div>
      </Modal>

      {err ? <Note tone="bad" style={{ marginBottom: 12 }}>{err}</Note> : null}

      {/* Lista: filas en un solo panel, no una tarjeta por razón. */}
      <Panel
        title="Razones"
        desc="Cada razón se guarda por sí sola y se aplica al instante."
        action={<Btn size="sm" icon="ph-plus" onClick={() => setNuevaAbierta(true)}>Nueva razón</Btn>}
        flush
        clip
      >
        {reasons.length === 0 ? (
          <EmptyState icon="ph-list-checks" title="Aún no hay razones" sub="Agrega la primera con «Nueva razón»." />
        ) : reasons.map((r) => (
          editing === r.id ? (
            <ReasonEditRow key={r.id} reason={r} busy={busy === r.id} onCancel={() => setEditing(null)} onSave={(t, x, p) => update(r.id, t, x, p)} />
          ) : (
            <div key={r.id} className="adm-trow" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span aria-hidden style={{ width: 16, flexShrink: 0, textAlign: 'center', fontSize: 12, color: 'var(--adm-faint)' }}>◆</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                  <span className="adm-cell-title adm-ellipsis" style={{ minWidth: 0 }}>{r.title}</span>
                  <PlaceBadge value={r.placement} />
                </div>
                <p className="adm-cell-sub" style={{ margin: '3px 0 0', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{r.text}</p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <IconBtn icon="ph-pencil-simple" label="Editar" onClick={() => setEditing(r.id)} />
                <IconBtn icon="ph-trash" label="Eliminar" danger onClick={() => remove(r.id)} disabled={busy === r.id} />
              </div>
            </div>
          )
        ))}
      </Panel>
    </>
  );
}

/* ============= Página /quienes-somos (tabla inf_sitio) ============= */
/* Contenido de la página pública Quiénes somos. Se guarda por su cuenta
 * (PATCH /admin/cms/inf-sitio) y se aplica al instante; no pasa por el tema. */

function PageForm({ data, onLive }: { data: InfSitio | null; onLive: (patch: Partial<PageLive>) => void }) {
  const router = useRouter();
  const initial = {
    frase: data?.frase ?? '', titulo: data?.titulo ?? '', descripcion: data?.descripcion ?? '',
    mision: data?.mision ?? '', vision: data?.vision ?? '', objetivos: data?.objetivos ?? '',
  };
  const [f, setF] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof f, v: string) => {
    setF((s) => ({ ...s, [k]: v }));
    // Espejo en vivo (fuera del updater para no actualizar el padre durante el render).
    // Todos los campos de texto alimentan el preview de la página.
    onLive({ [k]: v } as Partial<PageLive>);
    setMsg(null);
  };
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);

  // Imágenes del hero (inf_sitio.imagenes) — suben/borran al instante vía API.
  const [imgs, setImgs] = useState<string[]>(data?.imagenes ?? []);
  const [imgBusy, setImgBusy] = useState(false);
  const [imgErr, setImgErr] = useState<string | null>(null);
  async function uploadImg(file: File) {
    if (!file.type.startsWith('image/')) { setImgErr('Usa una imagen (PNG, JPG, WebP…)'); return; }
    setImgBusy(true); setImgErr(null);
    try {
      const fd = new FormData(); fd.append('photo', file);
      const r = await fetch('/api/admin/cms/inf-sitio/image', { method: 'POST', body: fd });
      const d = await r.json().catch(() => null);
      if (!r.ok || !Array.isArray(d?.imagenes)) throw new Error(d?.message ?? 'No se pudo subir la imagen');
      setImgs(d.imagenes); onLive({ imagenes: d.imagenes }); router.refresh();
    } catch (e) { setImgErr((e as Error).message); } finally { setImgBusy(false); }
  }
  async function removeImg(index: number) {
    setImgBusy(true); setImgErr(null);
    try {
      const r = await fetch(`/api/admin/cms/inf-sitio/image/${index}`, { method: 'DELETE' });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error('No se pudo quitar la imagen');
      const next = Array.isArray(d?.imagenes) ? d.imagenes : imgs.filter((_, i) => i !== index);
      setImgs(next); onLive({ imagenes: next }); router.refresh();
    } catch (e) { setImgErr((e as Error).message); } finally { setImgBusy(false); }
  }

  async function save() {
    if (busy || !dirty) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/admin/cms/inf-sitio', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      if (!r.ok) throw new Error('No se pudo guardar la página');
      setSaved(f);
      setMsg({ ok: true, text: 'Página guardada — se aplica al instante.' });
      router.refresh();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  const area = (k: keyof typeof f, label: string, ph: string, rows = 3) => (
    <Field label={label}><textarea value={f[k]} onChange={(e) => set(k, e.target.value)} rows={rows} placeholder={ph} style={textareaStyle} /></Field>
  );

  return (
    <>
      <SectionHead title="Página pública /quienes-somos" />
      <p style={intro}>El texto de la página completa Quiénes somos. Se guarda con su propio botón y se aplica al instante (no pasa por «Guardar y publicar»).</p>

      <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
        <h3 style={h3Style}>Encabezado</h3>
        <Field label="Frase (eslogan corto)"><input value={f.frase} onChange={(e) => set('frase', e.target.value)} placeholder="Aliados de tu obra" style={inputStyle} /></Field>
        <Field label="Título"><input value={f.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Quiénes somos" style={inputStyle} /></Field>
        {area('descripcion', 'Descripción (se permite HTML)', 'Texto introductorio de la empresa…', 5)}
      </div>

      <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
        <div><h3 style={h3Style}>Imágenes del hero</h3><p style={desc}>El mosaico junto al título (se recomiendan 2: obra + flota). Se aplican al instante.</p></div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {imgs.map((src, i) => (
            <div key={i} style={{ position: 'relative', width: 104, height: 78, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--adm-border-strong)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button type="button" onClick={() => removeImg(i)} disabled={imgBusy} title="Quitar" aria-label="Quitar" style={{ position: 'absolute', top: 5, right: 5, border: 'none', background: 'rgba(0,0,0,0.62)', color: '#fff', borderRadius: 6, width: 22, height: 22, cursor: 'pointer', fontSize: 12, lineHeight: 1, display: 'grid', placeItems: 'center', fontFamily: 'inherit' }}><i className="ph ph-x" aria-hidden /></button>
            </div>
          ))}
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const fl = e.dataTransfer.files?.[0]; if (fl) uploadImg(fl); }}
            style={{ width: 104, height: 78, borderRadius: 8, border: '1.5px dashed var(--adm-border-strong)', background: D.inputBg, display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--adm-muted)', fontSize: 12.5, textAlign: 'center' }}
          >
            <span><i className="ph ph-plus" style={{ fontSize: 17, display: 'block', marginBottom: 2 }} />{imgBusy ? 'Subiendo…' : 'Agregar'}</span>
            <input type="file" accept="image/*" onChange={(e) => { const fl = e.target.files?.[0]; if (fl) uploadImg(fl); e.target.value = ''; }} style={{ display: 'none' }} />
          </label>
        </div>
        {imgErr ? <span style={{ fontSize: 12.5, color: 'var(--adm-bad)' }}>{imgErr}</span> : null}
      </div>

      <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
        <h3 style={h3Style}>Misión · Visión · Objetivos</h3>
        {area('mision', 'Misión', 'Nuestra misión es…')}
        {area('vision', 'Visión', 'Nuestra visión es…')}
        {area('objetivos', 'Objetivos', 'Nuestros objetivos…')}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <Btn icon="ph-floppy-disk" onClick={save} disabled={busy || !dirty}>{busy ? 'Guardando…' : 'Guardar textos'}</Btn>
        {msg ? <span style={{ fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 7, color: msg.ok ? 'var(--adm-ok)' : 'var(--adm-bad)' }}><i className={`ph ${msg.ok ? 'ph-check-circle' : 'ph-warning-circle'}`} aria-hidden /> {msg.text}</span> : (dirty ? <StatusText tone="warn">Cambios sin guardar</StatusText> : null)}
      </div>
    </>
  );
}

/* ===== Secciones estructuradas de /quienes-somos (token quienesSomos) ===== */
/* Se guardan con «Guardar y publicar» (arriba), como el resto del tema. */

function QsSections({ qs, setQs }: { qs: QuienesSomos; setQs: (patch: Partial<QuienesSomos>) => void }) {
  const setStats = (v: QsStat[]) => setQs({ stats: v });
  const setValues = (v: QsValue[]) => setQs({ values: v });
  const setTimeline = (v: QsMilestone[]) => setQs({ timeline: v });
  const del = (onClick: () => void) => (
    <IconBtn icon="ph-x" label="Quitar" danger onClick={onClick} style={{ alignSelf: 'end', marginBottom: 3 }} />
  );
  const add = (label: string, onClick: () => void) => (
    <div><Btn size="sm" icon="ph-plus" onClick={onClick}>{label}</Btn></div>
  );

  return (
    <>
      {/* Otro bloque de la pestaña, con otro botón de guardado: un título de sección lo separa del de arriba. */}
      <div className="adm-section">
        <SectionHead title="Secciones de la página" />
        <p style={intro}>Franja de stats, valores, trayectoria, marcas y CTA. Se guardan con <b>«Guardar y publicar»</b> (arriba). El bloque «Por qué elegirnos» de la página usa las <b>Razones</b>.</p>
      </div>

      <div style={{ ...cardStyle, display: 'grid', gap: 14 }}>
        <h3 style={h3Style}>Botones del hero</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Botón principal"><input value={qs.heroCta} onChange={(e) => setQs({ heroCta: e.target.value })} style={inputStyle} /></Field>
          <Field label="Enlace"><input value={qs.heroCtaLink} onChange={(e) => setQs({ heroCtaLink: e.target.value })} placeholder="/productos" style={inputStyle} /></Field>
          <Field label="Botón secundario"><input value={qs.heroCta2} onChange={(e) => setQs({ heroCta2: e.target.value })} style={inputStyle} /></Field>
          <Field label="Enlace"><input value={qs.heroCta2Link} onChange={(e) => setQs({ heroCta2Link: e.target.value })} placeholder="/contacto" style={inputStyle} /></Field>
        </div>
      </div>

      <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
        <h3 style={h3Style}>Franja de estadísticas</h3>
        {qs.stats.map((s, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 1fr auto', gap: 10, alignItems: 'end' }}>
            <Field label={`Número ${i + 1}`}><input value={s.num} onChange={(e) => setStats(qs.stats.map((x, j) => (j === i ? { ...x, num: e.target.value } : x)))} placeholder="500+" style={inputStyle} /></Field>
            <Field label="Etiqueta"><input value={s.label} onChange={(e) => setStats(qs.stats.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Equipos en catálogo" style={inputStyle} /></Field>
            {del(() => setStats(qs.stats.filter((_, j) => j !== i)))}
          </div>
        ))}
        {add('Agregar estadística', () => setStats([...qs.stats, { num: '', label: '' }]))}
      </div>

      <div style={{ ...cardStyle, display: 'grid', gap: 14 }}>
        <h3 style={h3Style}>Propósito · encabezado</h3>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--adm-muted)' }}>Los textos de misión/visión/objetivos se editan arriba (Textos).</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Eyebrow"><input value={qs.propositoEyebrow} onChange={(e) => setQs({ propositoEyebrow: e.target.value })} style={inputStyle} /></Field>
          <Field label="Título"><input value={qs.propositoTitle} onChange={(e) => setQs({ propositoTitle: e.target.value })} style={inputStyle} /></Field>
        </div>
      </div>

      <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
        <h3 style={h3Style}>Valores</h3>
        {qs.values.map((v, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr auto', gap: 10, alignItems: 'end' }}>
            <Field label={`Valor ${String(i + 1).padStart(2, '0')}`}><input value={v.title} onChange={(e) => setValues(qs.values.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="Seguridad" style={inputStyle} /></Field>
            <Field label="Descripción"><input value={v.desc} onChange={(e) => setValues(qs.values.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)))} placeholder="En cada equipo y operación" style={inputStyle} /></Field>
            {del(() => setValues(qs.values.filter((_, j) => j !== i)))}
          </div>
        ))}
        {add('Agregar valor', () => setValues([...qs.values, { title: '', desc: '' }]))}
      </div>

      <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
        <h3 style={h3Style}>Trayectoria · línea de tiempo</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Eyebrow"><input value={qs.timelineEyebrow} onChange={(e) => setQs({ timelineEyebrow: e.target.value })} style={inputStyle} /></Field>
          <Field label="Título"><input value={qs.timelineTitle} onChange={(e) => setQs({ timelineTitle: e.target.value })} style={inputStyle} /></Field>
        </div>
        {qs.timeline.map((m, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 1fr auto', gap: 10, alignItems: 'start', paddingTop: 12, borderTop: '1px solid var(--adm-border)' }}>
            <Field label="Año"><input value={m.year} onChange={(e) => setTimeline(qs.timeline.map((x, j) => (j === i ? { ...x, year: e.target.value } : x)))} placeholder="2020" style={inputStyle} /></Field>
            <div style={{ display: 'grid', gap: 8 }}>
              <input value={m.title} onChange={(e) => setTimeline(qs.timeline.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="Título del hito" style={inputStyle} />
              <textarea value={m.desc} onChange={(e) => setTimeline(qs.timeline.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)))} rows={2} placeholder="Descripción" style={textareaStyle} />
            </div>
            <IconBtn icon="ph-x" label="Quitar" danger onClick={() => setTimeline(qs.timeline.filter((_, j) => j !== i))} />
          </div>
        ))}
        {add('Agregar hito', () => setTimeline([...qs.timeline, { year: '', title: '', desc: '' }]))}
      </div>

      <div style={{ ...cardStyle, display: 'grid', gap: 14 }}>
        <h3 style={h3Style}>Por qué elegirnos · encabezado</h3>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--adm-muted)' }}>Las tarjetas usan las <b>Razones</b> (pestaña Razones). Aquí solo el encabezado.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Eyebrow"><input value={qs.ventajasEyebrow} onChange={(e) => setQs({ ventajasEyebrow: e.target.value })} style={inputStyle} /></Field>
          <Field label="Título"><input value={qs.ventajasTitle} onChange={(e) => setQs({ ventajasTitle: e.target.value })} style={inputStyle} /></Field>
        </div>
      </div>

      {/* Las marcas se editan en Diseño → Marcas: son la MISMA lista que la banda
          del home y tenerlas aquí aparte hizo que las dos versiones divergieran. */}

      <div style={{ ...cardStyle, display: 'grid', gap: 14 }}>
        <h3 style={h3Style}>Banda CTA (final)</h3>
        <Field label="Título"><input value={qs.ctaTitle} onChange={(e) => setQs({ ctaTitle: e.target.value })} style={inputStyle} /></Field>
        <Field label="Subtítulo"><textarea value={qs.ctaSubtitle} onChange={(e) => setQs({ ctaSubtitle: e.target.value })} rows={2} style={textareaStyle} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Botón principal"><input value={qs.ctaPrimary} onChange={(e) => setQs({ ctaPrimary: e.target.value })} style={inputStyle} /></Field>
          <Field label="Enlace"><input value={qs.ctaPrimaryLink} onChange={(e) => setQs({ ctaPrimaryLink: e.target.value })} placeholder="/contacto" style={inputStyle} /></Field>
          <Field label="Botón secundario"><input value={qs.ctaSecondary} onChange={(e) => setQs({ ctaSecondary: e.target.value })} style={inputStyle} /></Field>
          <Field label="Enlace"><input value={qs.ctaSecondaryLink} onChange={(e) => setQs({ ctaSecondaryLink: e.target.value })} placeholder="/contacto" style={inputStyle} /></Field>
        </div>
      </div>
    </>
  );
}
