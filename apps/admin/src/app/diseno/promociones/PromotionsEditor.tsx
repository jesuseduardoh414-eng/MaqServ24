'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import type { PromoItem, Promotions, ThemeTokens } from '@maqserv/config';
import { VistaPreviaSitio } from '@/components/VistaPreviaSitio';
import { D, cardStyle, inputStyle, h3Style, Field, Toggle, ColorField } from '@/components/editor-kit';
import { Btn, IconBtn, PageHeader, StatusText, Toast } from '@/components/ui';

type Copys = Record<string, Record<string, string>>;
type Formato = Promotions['format'];

const DEFAULTS: Promotions = { show: true, format: 'vertical', items: [], eyebrowColor: null, titleColor: null, accentColor: null };
const cv = (es: Record<string, string>, k: string, def = '') => es[k] ?? def;
const nuevoId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const nuevaPromo = (): PromoItem => ({ id: nuevoId(), enabled: true, video: null, image: null, badge: '', title: '', text: '', cta: 'Cotizar', ctaLink: '/cotizar', until: null });
/** Hoy en Monterrey, igual que el sitio: así "vencida" significa lo mismo aquí y allá. */
const hoyEnMonterrey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey' }).format(new Date());

/** Igual que el tope de `POST admin/cms/video` en la API. */
const VIDEO_MAX_MB = 30;

/** Un interruptor suelto va en texto plano con una línea fina debajo: una tarjeta para un solo switch sobraba. */
const showRow: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 0 16px', marginBottom: 16, borderBottom: '1px solid var(--adm-border)' };
const textarea: CSSProperties = { ...inputStyle, height: 'auto', padding: '10px 12px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' };

/** XHR y no fetch: fetch no informa el avance de la subida. */
function subirVideo(archivo: File, onAvance: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/cms/video');
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

/** Lee del archivo si el video es vertical u horizontal, antes de subirlo. */
function formatoDe(archivo: File): Promise<Formato | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(archivo);
    const v = document.createElement('video');
    const listo = (f: Formato | null) => { URL.revokeObjectURL(url); resolve(f); };
    v.preload = 'metadata';
    v.onloadedmetadata = () => listo(v.videoWidth && v.videoHeight ? (v.videoHeight > v.videoWidth ? 'vertical' : 'horizontal') : null);
    v.onerror = () => listo(null);
    v.src = url;
  });
}

interface Config { eyebrow: string; title: string; promo: Promotions }

/**
 * Sección 3 · Promociones del mes (2026-10-19). Tarjetas con video en el home.
 *
 * El video se sube en cuanto se elige (es lo lento) pero la tarjeta se guarda
 * al publicar, junto con todo lo demás, como las imágenes del resto del panel.
 * La forma de las tarjetas (vertical u horizontal) se propone sola con el
 * primer video; si luego llega uno de otra forma, se avisa que se recortará.
 */
export function PromotionsEditor({ themeId, copys, tokens, promotions }: {
  themeId: number | null; copys: Copys; tokens: ThemeTokens; promotions: Promotions;
}) {
  const router = useRouter();
  const initial: Config = useMemo(() => {
    const es = copys['es'] ?? {};
    const promo = { ...DEFAULTS, ...(promotions ?? {}) };
    return {
      eyebrow: cv(es, 'home.promotions.eyebrow', 'Promociones'),
      title: cv(es, 'home.promotions.title', 'Promociones del mes'),
      // Las guardadas sin id (no debería haber) reciben uno: lo usan React y el reordenar.
      promo: { ...promo, items: promo.items.map((p) => (p.id ? p : { ...p, id: nuevoId() })) },
    };
  }, [copys, promotions]);

  const [config, setConfig] = useState<Config>(initial);
  const [saved, setSaved] = useState<Config>(initial);
  const [busy, setBusy] = useState(false);
  /** Avance de cada subida de video (id → 0-100). */
  const [subiendo, setSubiendo] = useState<Record<string, number>>({});
  const [subiendoFoto, setSubiendoFoto] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const p = config.promo;
  const hoy = hoyEnMonterrey();
  const set = <K extends keyof Config>(k: K, v: Config[K]) => setConfig((c) => ({ ...c, [k]: v }));
  const setP = <K extends keyof Promotions>(k: K, v: Promotions[K]) => setConfig((c) => ({ ...c, promo: { ...c.promo, [k]: v } }));
  const setItem = (id: string, cambio: Partial<PromoItem>) =>
    setConfig((c) => ({ ...c, promo: { ...c.promo, items: c.promo.items.map((it) => (it.id === id ? { ...it, ...cambio } : it)) } }));
  const mover = (id: string, dir: -1 | 1) =>
    setConfig((c) => {
      const items = [...c.promo.items];
      const i = items.findIndex((it) => it.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= items.length) return c;
      [items[i], items[j]] = [items[j]!, items[i]!];
      return { ...c, promo: { ...c.promo, items } };
    });
  const quitar = (id: string) => setConfig((c) => ({ ...c, promo: { ...c.promo, items: c.promo.items.filter((it) => it.id !== id) } }));
  const agregar = () => setConfig((c) => ({ ...c, promo: { ...c.promo, items: [...c.promo.items, nuevaPromo()] } }));

  const dirty = JSON.stringify(config) !== JSON.stringify(saved);
  const haySubidas = Object.keys(subiendo).length > 0 || subiendoFoto !== null;
  const visibles = p.items.filter((it) => it.enabled && (it.video || it.image || it.title.trim()) && !(it.until && it.until < hoy));
  const modoTema = tokens.defaultMode === 'light' ? 'light' : 'dark';
  // Lo que la vista previa le manda al sitio: lo MISMO que se publicaría.
  const borrador = useMemo(() => ({ tokens: { promotions: config.promo }, copys: { 'home.promotions.eyebrow': config.eyebrow, 'home.promotions.title': config.title } }), [config]);

  async function onVideo(id: string, f: File) {
    // El tipo lo revisa la API por los bytes (y explica qué hacer con un .mov de iPhone).
    if (f.size > VIDEO_MAX_MB * 1024 * 1024) { setToast({ ok: false, text: `El video pesa más de ${VIDEO_MAX_MB} MB` }); return; }
    setToast(null);
    // Se decide con lo que había al elegir el archivo, no con lo que haya al terminar de subir.
    const esElPrimero = !config.promo.items.some((it) => it.id !== id && it.video);
    const formaActual = config.promo.format;
    const forma = await formatoDe(f);
    setSubiendo((s) => ({ ...s, [id]: 0 }));
    try {
      const url = await subirVideo(f, (pct) => setSubiendo((s) => ({ ...s, [id]: pct })));
      setItem(id, { video: url });
      if (forma && esElPrimero) setP('format', forma);
      setToast(
        forma && !esElPrimero && forma !== formaActual
          ? { ok: false, text: `Video listo, pero es ${forma} y las tarjetas están en ${formaActual}: se verá recortado. Puedes cambiarlo en "Forma de las tarjetas".` }
          : { ok: true, text: 'Video listo. Publica para que se vea en el inicio.' },
      );
    } catch (e) {
      setToast({ ok: false, text: (e as Error).message });
    } finally {
      setSubiendo((s) => {
        const resto = { ...s };
        delete resto[id];
        return resto;
      });
    }
  }

  async function onFoto(id: string, f: File) {
    if (!f.type.startsWith('image/')) { setToast({ ok: false, text: 'Usa una imagen (PNG, JPG, WebP…)' }); return; }
    setSubiendoFoto(id);
    try {
      const fd = new FormData(); fd.append('file', f);
      const r = await fetch('/api/admin/cms/upload', { method: 'POST', body: fd });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.url) throw new Error(d?.message ?? 'No se pudo subir la imagen');
      setItem(id, { image: d.url as string });
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); } finally { setSubiendoFoto(null); }
  }

  function discard() { setConfig(saved); setToast(null); }
  async function publish() {
    if (busy || !themeId || haySubidas) return;
    setBusy(true); setToast(null);
    try {
      const es = { ...(copys['es'] ?? {}) };
      es['home.promotions.eyebrow'] = config.eyebrow;
      es['home.promotions.title'] = config.title;
      const body = { tokens: { ...tokens, promotions: config.promo }, copys: { ...copys, es } };
      const r2 = await fetch(`/api/admin/themes/${themeId}/draft`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r2.ok) throw new Error('No se pudieron guardar los ajustes');
      const r3 = await fetch(`/api/admin/themes/${themeId}/publish`, { method: 'POST' });
      if (!r3.ok) throw new Error('No se pudo publicar');
      setSaved(config);
      setToast({ ok: true, text: 'Publicado — el sitio se actualizará al refrescar.' });
      router.refresh();
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  const aviso = !p.show
    ? <><i className="ph ph-eye-slash" /> La sección está oculta en el home.</>
    : visibles.length === 0
      ? <><i className="ph ph-info" /> Sin promociones vigentes, la sección no aparece en el home.</>
      : null;

  return (
    <div>
      <PageHeader
        eyebrow={['Sitio web', 'Secciones del home']}
        title="Sección 3 · Promociones del mes"
        subtitle="Tarjetas con video de las promociones vigentes, debajo de Categorías. Sube el video, escribe el texto y, si quieres, la fecha en que termina: ese día se quita sola."
        actions={
          <>
            <StatusText tone={haySubidas ? 'info' : dirty ? 'warn' : 'ok'}>{haySubidas ? 'Subiendo video…' : dirty ? 'Cambios sin publicar' : 'Todo publicado'}</StatusText>
            <Btn variant="ghost" onClick={discard} disabled={!dirty || busy}>Descartar</Btn>
            <Btn variant="primary" icon="ph-cloud-arrow-up" onClick={publish} disabled={busy || haySubidas} title={haySubidas ? 'Espera a que termine de subir el video' : undefined}>{busy ? 'Publicando…' : 'Guardar y publicar'}</Btn>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 468px', gap: 26, alignItems: 'start' }} className="hero-ed-grid">
        <div style={{ minWidth: 0 }}>
          <div style={showRow}>
            <div style={{ minWidth: 0 }}>
              <div className="adm-cell-title">Mostrar las promociones en el home</div>
              <div className="adm-cell-sub">Apágala para ocultar la sección completa sin borrar las promociones.</div>
            </div>
            <Toggle on={p.show} onClick={() => setP('show', !p.show)} />
          </div>

          <div style={{ ...cardStyle, display: 'grid', gap: 16 }}>
            <h3 style={h3Style}>Encabezado</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Etiqueta pequeña"><input value={config.eyebrow} onChange={(e) => set('eyebrow', e.target.value)} placeholder="Promociones" style={inputStyle} /></Field>
              <Field label="Título"><input value={config.title} onChange={(e) => set('title', e.target.value)} placeholder="Promociones del mes" style={inputStyle} /></Field>
            </div>
          </div>

          <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
            <div>
              <h3 style={h3Style}>Forma de las tarjetas</h3>
              <p className="adm-panel-desc">Todas van iguales. Se elige sola con el primer video que subas; cámbiala si tus videos son de la otra forma.</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn variant={p.format === 'vertical' ? 'primary' : 'secondary'} icon="ph-device-mobile" onClick={() => setP('format', 'vertical')}>Vertical (celular)</Btn>
              <Btn variant={p.format === 'horizontal' ? 'primary' : 'secondary'} icon="ph-monitor" onClick={() => setP('format', 'horizontal')}>Horizontal</Btn>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '22px 0 12px' }}>
            <h3 style={h3Style}>Promociones ({p.items.length})</h3>
            <Btn size="sm" icon="ph-plus" onClick={agregar}>Agregar promoción</Btn>
          </div>

          {p.items.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--adm-muted)', fontSize: 13.5, padding: 28 }}>
              <i className="ph ph-video-camera" style={{ fontSize: 26, display: 'block', marginBottom: 8 }} />
              Todavía no hay promociones. Agrega la primera y súbele su video.
            </div>
          ) : null}

          {p.items.map((it, i) => {
            const vencida = !!it.until && it.until < hoy;
            const pct = subiendo[it.id];
            return (
              <div key={it.id} style={{ ...cardStyle, display: 'grid', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: 14.5, color: D.text, minWidth: 0, flex: '1 1 160px' }}>
                    {i + 1}. {it.title.trim() || 'Promoción sin título'}
                  </strong>
                  {vencida ? <StatusText tone="warn">Vencida: ya no se ve</StatusText> : !it.enabled ? <StatusText tone="muted">Oculta</StatusText> : <StatusText tone="ok">Visible</StatusText>}
                  <Toggle on={it.enabled} onClick={() => setItem(it.id, { enabled: !it.enabled })} title={it.enabled ? 'Ocultar esta promoción' : 'Mostrar esta promoción'} />
                  <IconBtn icon="ph-arrow-up" label="Subir" onClick={() => mover(it.id, -1)} disabled={i === 0} />
                  <IconBtn icon="ph-arrow-down" label="Bajar" onClick={() => mover(it.id, 1)} disabled={i === p.items.length - 1} />
                  <IconBtn icon="ph-trash" label="Quitar promoción" danger onClick={() => quitar(it.id)} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '170px minmax(0,1fr)', gap: 18, alignItems: 'start' }} className="promo-ed-row">
                  {/* Video o, si no hay, la portada */}
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ position: 'relative', aspectRatio: p.format === 'vertical' ? '9 / 16' : '16 / 9', borderRadius: 10, overflow: 'hidden', background: '#000', border: '1px solid var(--adm-border-strong)', display: 'grid', placeItems: 'center' }}>
                      {it.video ? (
                        <video src={it.video} poster={it.image ?? undefined} muted loop autoPlay playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : it.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.image} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,.6)', fontSize: 12, textAlign: 'center', padding: 10 }}>
                          <i className="ph ph-video-camera" style={{ fontSize: 22, display: 'block', marginBottom: 4 }} />Sin video
                        </span>
                      )}
                    </div>
                    <label className="adm-btn adm-btn-secondary adm-btn-sm" style={{ justifyContent: 'center', cursor: pct !== undefined ? 'default' : 'pointer' }}>
                      <i className="ph ph-video-camera" aria-hidden /> {pct !== undefined ? `Subiendo… ${pct}%` : it.video ? 'Cambiar video' : 'Subir video'}
                      <input type="file" accept="video/mp4,video/webm" disabled={pct !== undefined} onChange={(e) => { const f = e.target.files?.[0]; if (f) void onVideo(it.id, f); e.target.value = ''; }} style={{ display: 'none' }} />
                    </label>
                    {it.video && pct === undefined ? <Btn size="sm" variant="ghost" icon="ph-trash" onClick={() => setItem(it.id, { video: null })}>Quitar video</Btn> : null}
                    <label className="adm-btn adm-btn-ghost adm-btn-sm" style={{ justifyContent: 'center', cursor: 'pointer' }} title="Se ve mientras carga el video, o en lugar del video si no subes uno">
                      <i className="ph ph-image" aria-hidden /> {subiendoFoto === it.id ? 'Subiendo…' : it.image ? 'Cambiar portada' : 'Portada (opcional)'}
                      <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFoto(it.id, f); e.target.value = ''; }} style={{ display: 'none' }} />
                    </label>
                    {it.image ? <Btn size="sm" variant="ghost" icon="ph-x" onClick={() => setItem(it.id, { image: null })}>Quitar portada</Btn> : null}
                    <span style={{ fontSize: 11.5, color: 'var(--adm-muted)', lineHeight: 1.4 }}>MP4 o WebM, hasta {VIDEO_MAX_MB} MB. En el sitio arranca sin sonido; el visitante lo activa con un botón.</span>
                  </div>

                  <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>
                    <Field label="Título"><input value={it.title} onChange={(e) => setItem(it.id, { title: e.target.value })} placeholder="Retroexcavadora con 15 % de descuento" style={inputStyle} /></Field>
                    <Field label="Descripción"><textarea value={it.text} onChange={(e) => setItem(it.id, { text: e.target.value })} rows={3} placeholder="Renta semanal en Monterrey y zona metro. Incluye operador." style={textarea} /></Field>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <Field label="Etiqueta (opcional)"><input value={it.badge} onChange={(e) => setItem(it.id, { badge: e.target.value })} placeholder="-15 %" style={inputStyle} /></Field>
                      <Field label="Vigente hasta (opcional)">
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input type="date" value={it.until ?? ''} onChange={(e) => setItem(it.id, { until: e.target.value || null })} style={inputStyle} />
                          {it.until ? <IconBtn icon="ph-x" label="Sin fecha de fin" onClick={() => setItem(it.id, { until: null })} /> : null}
                        </div>
                      </Field>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <Field label="Texto del botón (vacío = sin botón)"><input value={it.cta} onChange={(e) => setItem(it.id, { cta: e.target.value })} placeholder="Cotizar" style={inputStyle} /></Field>
                      <Field label="Enlace del botón"><input value={it.ctaLink} onChange={(e) => setItem(it.id, { ctaLink: e.target.value })} placeholder="/cotizar" style={inputStyle} /></Field>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {p.items.length > 0 ? (
            <div style={{ marginBottom: 16 }}>
              <Btn icon="ph-plus" onClick={agregar}>Agregar otra promoción</Btn>
            </div>
          ) : null}

          <div style={{ ...cardStyle, display: 'grid', gap: 18 }}>
            <h3 style={h3Style}>Colores</h3>
            <ColorField label="Etiqueta pequeña del encabezado" value={p.eyebrowColor} onChange={(v) => setP('eyebrowColor', v)} />
            <ColorField label="Color del título" value={p.titleColor} onChange={(v) => setP('titleColor', v)} />
            <ColorField label="Acento (etiqueta y botón de cada tarjeta)" value={p.accentColor} onChange={(v) => setP('accentColor', v)} />
          </div>
        </div>

        {/* VISTA PREVIA: el sitio real pinta la sección con los cambios sin publicar. */}
        <div style={{ position: 'sticky', top: 12 }} className="hero-ed-preview">
          <VistaPreviaSitio vista="home.promotions" etiqueta="home" borrador={borrador} modoInicial={modoTema} aviso={aviso} />
        </div>
      </div>

      <style>{`@media (max-width: 640px){ .promo-ed-row{ grid-template-columns: 1fr !important; } .promo-ed-row > div:first-child{ max-width: 220px; } }`}</style>
      {toast ? <Toast kind={toast.ok ? 'ok' : 'bad'}>{toast.text}</Toast> : null}
    </div>
  );
}
