'use client';

import { Modal } from '@/components/Modal';
import { useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { ThemeTokens, WhyChooseUs, QuienesSomos, QsStat, QsValue, QsMilestone } from '@maqserv/config';
import { VistaPreviaSitio } from '@/components/VistaPreviaSitio';
import { D, FONT, cardStyle, inputStyle, h3Style, smallLabel, Field, Toggle, ColorField } from '@/components/editor-kit';

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

const cv = (es: Record<string, string>, k: string, def = '') => es[k] ?? def;

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
  const [tab, setTab] = useState<'contenido' | 'razones' | 'pagina' | 'estilo'>('contenido');
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
    <div style={{ fontFamily: FONT, color: D.text }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />

      {/* Barra de acciones */}
      <div style={{ background: '#0c0c0e', border: `1px solid ${D.cardBorder}`, borderRadius: 16, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: D.muted2, fontSize: '12.5px', fontWeight: 600, marginBottom: 5 }}><i className="ph ph-paint-brush-broad" style={{ fontSize: 14 }} /> Diseño del sitio <span style={{ opacity: 0.5 }}>·</span> Quiénes somos</div>
          <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em' }}>Sección 4 · Quiénes somos</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, padding: '8px 13px', borderRadius: 999, border: `1px solid ${dirty ? 'color-mix(in srgb, var(--color-primary) 40%, transparent)' : 'rgba(255,255,255,0.08)'}`, background: dirty ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'rgba(255,255,255,0.03)', color: dirty ? D.amber : D.muted2 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: dirty ? D.amber : '#3fbf8f' }} />{dirty ? 'Cambios sin publicar' : 'Todo publicado'}</span>
          <button type="button" onClick={discard} disabled={!dirty || busy} style={{ border: `1px solid ${D.inputBorder}`, background: 'transparent', color: dirty ? D.text : D.muted2, borderRadius: 11, padding: '10px 16px', fontWeight: 600, fontSize: 14, cursor: dirty && !busy ? 'pointer' : 'default', opacity: dirty && !busy ? 1 : 0.5, fontFamily: 'inherit' }}>Descartar</button>
          <button type="button" onClick={publish} disabled={busy} style={{ border: 'none', background: D.amber, color: '#0a0a0b', borderRadius: 11, padding: '11px 18px', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}><i className="ph-bold ph-cloud-arrow-up" style={{ fontSize: 17 }} /> {busy ? 'Publicando…' : 'Guardar y publicar'}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 468px', gap: 26, alignItems: 'start' }} className="hero-ed-grid">
        <div style={{ minWidth: 0 }}>
          {/* Nota: todo lo de esta sección se edita aquí */}
          <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)', color: D.amber, display: 'grid', placeItems: 'center', flexShrink: 0 }}><i className="ph ph-shield-check" style={{ fontSize: 20 }} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ fontSize: 14 }}>La banda «¿Por qué elegirnos?» del home</strong>
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: D.muted2 }}>Todo en un solo lugar: las <b>razones</b> (◆ cada punto), los <b>textos</b>, las <b>estadísticas</b>, la <b>imagen</b> y el <b>estilo</b>.</p>
            </div>
          </div>

          {/* Toggle mostrar sección */}
          <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div><strong style={{ fontSize: 13.5 }}>Mostrar la sección en el home</strong><p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>Apágala para ocultarla temporalmente.</p></div>
            <Toggle on={w.show} onClick={() => setW('show', !w.show)} />
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, padding: 5, background: D.tabsBg, border: `1px solid ${D.cardBorder}`, borderRadius: 14, marginBottom: 22, flexWrap: 'wrap' }}>
            {([['contenido', 'Contenido', 'ph-text-aa'], ['razones', 'Razones', 'ph-list-checks'], ['pagina', 'Página completa', 'ph-identification-card'], ['estilo', 'Imagen y estilo', 'ph-paint-brush']] as const).map(([id, label, icon]) => (
              <button key={id} type="button" onClick={() => setTab(id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', cursor: 'pointer', borderRadius: 10, padding: '9px 15px', fontWeight: 700, fontSize: '13.5px', fontFamily: 'inherit', background: tab === id ? D.amber : 'transparent', color: tab === id ? '#0a0a0b' : D.muted2 }}><i className={`ph ${icon}`} style={{ fontSize: 16 }} /> {label}</button>
            ))}
          </div>

          {/* CONTENIDO */}
          {tab === 'contenido' ? (
            <div style={{ animation: 'fadeIn .25s ease' }}>
              <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
                <h3 style={h3Style}>Textos</h3>
                <Field label="Eyebrow (línea pequeña arriba)"><input value={config.eyebrow} onChange={(e) => set('eyebrow', e.target.value)} placeholder="Nuestro compromiso" style={inputStyle} /></Field>
                <Field label="Título"><input value={config.title} onChange={(e) => set('title', e.target.value)} placeholder="¿Por qué elegirnos?" style={inputStyle} /></Field>
                <Field label="Subtítulo"><textarea value={config.subtitle} onChange={(e) => set('subtitle', e.target.value)} rows={2} placeholder="Más que un proveedor de maquinaria…" style={{ ...inputStyle, height: 'auto', padding: '12px 14px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
              </div>

              <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div><h3 style={h3Style}>Tarjeta de años</h3><p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>La tarjeta flotante sobre la imagen.</p></div>
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
                  <div><h3 style={h3Style}>Barra de estadísticas</h3><p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>Los 3 números animados al pie.</p></div>
                  <Toggle on={w.showStats} onClick={() => setW('showStats', !w.showStats)} />
                </div>
                {w.showStats ? config.stats.map((s, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 14, paddingTop: i > 0 ? 12 : 0, borderTop: i > 0 ? `1px solid ${D.cardBorder}` : 'none' }}>
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
                <div><h3 style={h3Style}>Imagen principal</h3><p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>La foto grande de la izquierda de la sección. Vacío ⇒ se muestra un marcador.</p></div>
                <label
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
                  style={{ position: 'relative', display: 'grid', placeItems: 'center', minHeight: w.image ? 170 : 120, border: `1.5px dashed ${D.inputBorder}`, borderRadius: 12, background: w.image ? '#0d0d10' : D.inputBg, cursor: 'pointer', overflow: 'hidden', padding: 12 }}
                >
                  {w.image ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={w.image} alt="" style={{ maxHeight: 148, maxWidth: '100%', objectFit: 'contain', borderRadius: 8 }} />
                      <button type="button" onClick={(e) => { e.preventDefault(); setW('image', null); }} style={{ position: 'absolute', top: 8, right: 8, display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><i className="ph ph-trash" /> Quitar</button>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', color: D.muted2, fontSize: 13 }}>
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

      {toast ? (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 10, background: toast.ok ? '#16281c' : '#2a1416', border: `1px solid ${toast.ok ? 'rgba(63,191,143,0.4)' : 'rgba(245,80,80,0.4)'}`, color: toast.ok ? '#dff5e8' : '#f8d7d7', padding: '13px 20px', borderRadius: 13, fontSize: 14, fontWeight: 600, boxShadow: '0 16px 40px -16px rgba(0,0,0,0.7)', zIndex: 100 }}>
          <i className={`ph-bold ${toast.ok ? 'ph-check-circle' : 'ph-warning-circle'}`} style={{ fontSize: 19, color: toast.ok ? '#3fbf8f' : '#f55' }} /> {toast.text}
        </div>
      ) : null}
    </div>
  );
}

/* ===================== CRUD de razones (◆) ===================== */
/* Reusa /admin/cms/why-choose-us (POST/PATCH multipart, DELETE). Cada razón se
 * guarda por sí sola y se aplica al instante (no pasa por borrador/publicar). */

const textareaStyle: CSSProperties = { ...inputStyle, height: 'auto', minHeight: 66, padding: '11px 14px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' };
const btnGhost: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${D.inputBorder}`, background: 'transparent', color: D.text, borderRadius: 10, padding: '8px 13px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' };
const btnDanger: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(245,80,80,0.3)', background: 'rgba(245,80,80,0.08)', color: '#f87171', borderRadius: 10, padding: '8px 11px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' };
const btnPrimary = (on: boolean): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', background: D.amber, color: '#0a0a0b', borderRadius: 11, padding: '10px 16px', fontWeight: 800, fontSize: 13.5, cursor: on ? 'pointer' : 'default', opacity: on ? 1 : 0.5, fontFamily: 'inherit' });

const PLACEMENTS: { id: Placement; label: string; icon: string }[] = [
  { id: 'both', label: 'Ambas', icon: 'ph-squares-four' },
  { id: 'home', label: 'Solo home', icon: 'ph-house' },
  { id: 'about', label: 'Solo Quiénes somos', icon: 'ph-identification-card' },
];

function PlacementSeg({ value, onChange }: { value: Placement; onChange: (v: Placement) => void }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <span style={smallLabel}>Dónde se muestra</span>
      <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: D.tabsBg, border: `1px solid ${D.cardBorder}`, borderRadius: 11, width: 'fit-content', flexWrap: 'wrap' }}>
        {PLACEMENTS.map((p) => {
          const on = value === p.id;
          return <button key={p.id} type="button" onClick={() => onChange(p.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', borderRadius: 8, padding: '7px 12px', fontWeight: 700, fontSize: 12.5, fontFamily: 'inherit', background: on ? D.amber : 'transparent', color: on ? '#0a0a0b' : D.muted2 }}><i className={`ph ${p.icon}`} style={{ fontSize: 14 }} /> {p.label}</button>;
        })}
      </div>
    </div>
  );
}

function PlaceBadge({ value }: { value: Placement }) {
  const def = PLACEMENTS.find((x) => x.id === value) ?? PLACEMENTS[0];
  const solo = value !== 'both';
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: solo ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)' : 'rgba(255,255,255,0.06)', color: solo ? D.amber : D.muted2, whiteSpace: 'nowrap' }}><i className={`ph ${def.icon}`} style={{ fontSize: 12 }} /> {def.label}</span>;
}

function ReasonEditRow({ reason, busy, onSave, onCancel }: {
  reason: Reason; busy: boolean; onSave: (title: string, text: string, placement: Placement) => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState(reason.title);
  const [text, setText] = useState(reason.text);
  const [placement, setPlacement] = useState<Placement>(reason.placement);
  const ready = !!title.trim() && !!text.trim();
  return (
    <div style={{ ...cardStyle, marginBottom: 12, display: 'grid', gap: 12, border: `1px solid ${D.amber}44` }}>
      <div style={{ display: 'grid', gap: 10 }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" style={inputStyle} />
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Descripción" style={textareaStyle} />
      </div>
      <PlacementSeg value={placement} onChange={setPlacement} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => onSave(title, text, placement)} disabled={busy || !ready} style={btnPrimary(!busy && ready)}><i className="ph-bold ph-check" /> {busy ? 'Guardando…' : 'Guardar'}</button>
        <button type="button" onClick={onCancel} disabled={busy} style={btnGhost}>Cancelar</button>
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
      <div style={{ marginBottom: 14 }}>
        <button type="button" onClick={() => setNuevaAbierta(true)} style={btnPrimary(true)}><i className="ph-bold ph-plus" /> Nueva razón</button>
      </div>
      <Modal abierto={nuevaAbierta} titulo="Nueva razón" subtitulo="Se aplica al instante (no pasa por «Guardar y publicar»)." onCerrar={() => setNuevaAbierta(false)} ancho={620}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <input value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder="Título (ej. Transparencia total)" style={inputStyle} />
          <textarea value={nText} onChange={(e) => setNText(e.target.value)} rows={2} placeholder="Descripción breve…" style={textareaStyle} />
        </div>
        <PlacementSeg value={nPlacement} onChange={setNPlacement} />
        <div><button type="button" onClick={create} disabled={busy === 'new' || !newReady} style={btnPrimary(busy !== 'new' && newReady)}><i className="ph-bold ph-plus" /> {busy === 'new' ? 'Agregando…' : 'Agregar razón'}</button></div>
      </div>
      </Modal>

      {err ? <div style={{ marginBottom: 12, fontSize: 12.5, color: '#f87171', display: 'flex', alignItems: 'center', gap: 7 }}><i className="ph ph-warning-circle" /> {err}</div> : null}

      {/* Lista */}
      {reasons.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', color: D.muted2, fontSize: 13 }}>Aún no hay razones. Agrega la primera con «Nueva razón».</div>
      ) : reasons.map((r) => (
        editing === r.id ? (
          <ReasonEditRow key={r.id} reason={r} busy={busy === r.id} onCancel={() => setEditing(null)} onSave={(t, x, p) => update(r.id, t, x, p)} />
        ) : (
          <div key={r.id} style={{ ...cardStyle, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)', color: D.amber, display: 'grid', placeItems: 'center', fontSize: 15 }}>◆</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                <strong style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{r.title}</strong>
                <PlaceBadge value={r.placement} />
              </div>
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: D.muted2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{r.text}</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button type="button" onClick={() => setEditing(r.id)} style={btnGhost}><i className="ph ph-pencil-simple" /> Editar</button>
              <button type="button" onClick={() => remove(r.id)} disabled={busy === r.id} title="Eliminar" style={btnDanger}><i className="ph ph-trash" /></button>
            </div>
          </div>
        )
      ))}
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
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(91,157,255,0.14)', color: '#5b9dff', display: 'grid', placeItems: 'center', flexShrink: 0 }}><i className="ph ph-identification-card" style={{ fontSize: 20 }} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ fontSize: 14 }}>Página pública /quienes-somos</strong>
          <p style={{ margin: '3px 0 0', fontSize: 12.5, color: D.muted2 }}>El texto de la página completa Quiénes somos. Se guarda con su propio botón y se aplica al instante (no pasa por «Guardar y publicar»).</p>
        </div>
      </div>

      <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
        <h3 style={h3Style}>Encabezado</h3>
        <Field label="Frase (eslogan corto)"><input value={f.frase} onChange={(e) => set('frase', e.target.value)} placeholder="Aliados de tu obra" style={inputStyle} /></Field>
        <Field label="Título"><input value={f.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Quiénes somos" style={inputStyle} /></Field>
        {area('descripcion', 'Descripción (se permite HTML)', 'Texto introductorio de la empresa…', 5)}
      </div>

      <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
        <div><h3 style={h3Style}>Imágenes del hero</h3><p style={{ margin: '3px 0 0', fontSize: 12, color: D.muted }}>El mosaico junto al título (se recomiendan 2: obra + flota). Se aplican al instante.</p></div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {imgs.map((src, i) => (
            <div key={i} style={{ position: 'relative', width: 104, height: 78, borderRadius: 10, overflow: 'hidden', border: `1px solid ${D.inputBorder}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button type="button" onClick={() => removeImg(i)} disabled={imgBusy} title="Quitar" style={{ position: 'absolute', top: 5, right: 5, border: 'none', background: 'rgba(0,0,0,0.62)', color: '#fff', borderRadius: 7, width: 22, height: 22, cursor: 'pointer', fontSize: 12, lineHeight: 1, display: 'grid', placeItems: 'center', fontFamily: 'inherit' }}>✕</button>
            </div>
          ))}
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const fl = e.dataTransfer.files?.[0]; if (fl) uploadImg(fl); }}
            style={{ width: 104, height: 78, borderRadius: 10, border: `1.5px dashed ${D.inputBorder}`, background: D.inputBg, display: 'grid', placeItems: 'center', cursor: 'pointer', color: D.muted2, fontSize: 12, textAlign: 'center' }}
          >
            <span><i className="ph ph-plus" style={{ fontSize: 17, display: 'block', marginBottom: 2 }} />{imgBusy ? 'Subiendo…' : 'Agregar'}</span>
            <input type="file" accept="image/*" onChange={(e) => { const fl = e.target.files?.[0]; if (fl) uploadImg(fl); e.target.value = ''; }} style={{ display: 'none' }} />
          </label>
        </div>
        {imgErr ? <span style={{ fontSize: 12, color: '#f87171' }}>{imgErr}</span> : null}
      </div>

      <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
        <h3 style={h3Style}>Misión · Visión · Objetivos</h3>
        {area('mision', 'Misión', 'Nuestra misión es…')}
        {area('vision', 'Visión', 'Nuestra visión es…')}
        {area('objetivos', 'Objetivos', 'Nuestros objetivos…')}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button type="button" onClick={save} disabled={busy || !dirty} style={btnPrimary(!busy && dirty)}><i className="ph-bold ph-floppy-disk" /> {busy ? 'Guardando…' : 'Guardar textos'}</button>
        {msg ? <span style={{ fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 7, color: msg.ok ? '#3fbf8f' : '#f87171' }}><i className={`ph-bold ${msg.ok ? 'ph-check-circle' : 'ph-warning-circle'}`} /> {msg.text}</span> : (dirty ? <span style={{ fontSize: 12.5, color: D.muted2 }}>Cambios sin guardar</span> : null)}
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
    <button type="button" onClick={onClick} title="Quitar" style={{ ...btnDanger, padding: '10px 11px', alignSelf: 'end' }}><i className="ph ph-x" /></button>
  );
  const add = (label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} style={{ ...btnGhost, width: 'fit-content' }}><i className="ph ph-plus" /> {label}</button>
  );

  return (
    <>
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 14, border: `1px solid ${D.amber}33` }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)', color: D.amber, display: 'grid', placeItems: 'center', flexShrink: 0 }}><i className="ph ph-layout" style={{ fontSize: 20 }} /></div>
        <div style={{ minWidth: 0 }}>
          <strong style={{ fontSize: 14 }}>Secciones de la página</strong>
          <p style={{ margin: '3px 0 0', fontSize: 12.5, color: D.muted2 }}>Franja de stats, valores, trayectoria, marcas y CTA. Se guardan con <b>«Guardar y publicar»</b> (arriba). El bloque «Por qué elegirnos» de la página usa las <b>Razones</b>.</p>
        </div>
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
        <p style={{ margin: 0, fontSize: 12, color: D.muted }}>Los textos de misión/visión/objetivos se editan arriba (Textos).</p>
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
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 1fr auto', gap: 10, alignItems: 'start', paddingTop: 12, borderTop: `1px solid ${D.cardBorder}` }}>
            <Field label="Año"><input value={m.year} onChange={(e) => setTimeline(qs.timeline.map((x, j) => (j === i ? { ...x, year: e.target.value } : x)))} placeholder="2020" style={inputStyle} /></Field>
            <div style={{ display: 'grid', gap: 8 }}>
              <input value={m.title} onChange={(e) => setTimeline(qs.timeline.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="Título del hito" style={inputStyle} />
              <textarea value={m.desc} onChange={(e) => setTimeline(qs.timeline.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)))} rows={2} placeholder="Descripción" style={textareaStyle} />
            </div>
            <button type="button" onClick={() => setTimeline(qs.timeline.filter((_, j) => j !== i))} title="Quitar" style={{ ...btnDanger, padding: '10px 11px', alignSelf: 'start' }}><i className="ph ph-x" /></button>
          </div>
        ))}
        {add('Agregar hito', () => setTimeline([...qs.timeline, { year: '', title: '', desc: '' }]))}
      </div>

      <div style={{ ...cardStyle, display: 'grid', gap: 14 }}>
        <h3 style={h3Style}>Por qué elegirnos · encabezado</h3>
        <p style={{ margin: 0, fontSize: 12, color: D.muted }}>Las tarjetas usan las <b>Razones</b> (pestaña Razones). Aquí solo el encabezado.</p>
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
