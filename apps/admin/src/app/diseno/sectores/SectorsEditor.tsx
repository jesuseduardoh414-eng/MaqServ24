'use client';

import { Modal } from '@/components/Modal';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import {
  BLOQUES_SECTOR,
  CLAVES_BLOQUE_SECTOR,
  htmlATexto,
  productSlug,
  separarTextoSector,
  type ClaveBloqueSector,
  type SectorVistaPrevia,
  type Sectors,
  type TextosSector,
  type ThemeTokens,
} from '@maqserv/config';
import { urlDelSitio, VistaPreviaSitio } from '@/components/VistaPreviaSitio';
import { D, cardStyle, inputStyle, h3Style, Field, Toggle, ColorField } from '@/components/editor-kit';
import { Bar, Btn, EmptyState, IconBtn, Note, PageHeader, Panel, Segmented, StatusText, Thumb, Toast } from '@/components/ui';
import { confirmar } from '@/components/Dialogos';

type Copys = Record<string, Record<string, string>>;
interface SectorRow { id: number; title: string; status: number; image: string | null; video?: string | null }
interface SectorFull {
  id: number; title: string; description: string | null;
  trayectoria: string | null; esencia: string | null; servicios: string | null; excelencia: string | null; serviciosLista: string | null;
  status: number; image: string | null;
  /** Video en bucle de la tarjeta; si hay, va en lugar de la imagen. */
  video: string | null;
  /** Frase corta, títulos y frases destacadas (guardados fuera de la tabla). */
  textos?: TextosSector;
}

/** Igual que el tope de `POST admin/cms/sectors/:id/video` en la API. */
const VIDEO_MAX_MB = 30;

/**
 * Sube el video con XHR y no con fetch: fetch no informa el avance de la
 * subida, y 20 MB por el celular sin barra parecen colgados.
 */
function subirVideo(id: number, archivo: File, onAvance: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/admin/cms/sectors/${id}/video`);
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
  /** El sector abierto, tal como está escrito (sin guardar): lo pinta la vista previa. */
  const [borradorSector, setBorradorSector] = useState<SectorVistaPrevia | null>(null);
  const [vistaSector, setVistaSector] = useState<'pagina' | 'inicio'>('pagina');
  /** Sube al guardar un sector: la vista previa vuelve a leer lo guardado. */
  const [version, setVersion] = useState(0);

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setConfig((c) => ({ ...c, [k]: v }));
  const setS = <K extends keyof Sectors>(k: K, v: Sectors[K]) => setConfig((c) => ({ ...c, sec: { ...c.sec, [k]: v } }));
  const s = config.sec;
  const dirty = JSON.stringify(config) !== JSON.stringify(saved);
  const modoTema = tokens.defaultMode === 'light' ? 'light' : 'dark';
  // Lo que la vista previa le manda al sitio: lo MISMO que se publicaría.
  const borrador = useMemo(() => ({
    tokens: { sectors: config.sec },
    copys: { 'home.sectors.eyebrow': config.eyebrow, 'home.sectors.title': config.title, 'home.sectors.cta': config.cta },
    datos: { sector: borradorSector, version },
  }), [config, borradorSector, version]);
  // Con un sector abierto se ve su página (donde va casi todo su texto); si no, las tarjetas del home.
  const verPagina = borradorSector !== null && vistaSector === 'pagina';


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
        title="Sección 6 · Sectores estratégicos"
        subtitle={<>La banda «Sectores estratégicos» del home: tarjetas overlay con imagen o video. Aquí defines los textos y el estilo (arriba), y gestionas los <b>sectores</b> (pestaña Sectores).</>}
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
              <SectorsManager sectors={sectors} onBorrador={setBorradorSector} onGuardado={() => setVersion((v) => v + 1)} />
            </div>
          ) : null}
        </div>

        {/* VISTA PREVIA: el sitio real pinta la sección con los cambios sin publicar. */}
        <div style={{ position: 'sticky', top: 12 }} className="hero-ed-preview">
          {borradorSector ? (
            <div style={{ marginBottom: 12 }}>
              <Segmented<'pagina' | 'inicio'>
                ariaLabel="Qué ver en la vista previa"
                value={vistaSector}
                onChange={setVistaSector}
                items={[
                  { key: 'pagina', label: 'Página del sector' },
                  { key: 'inicio', label: 'Tarjeta en el inicio' },
                ]}
              />
            </div>
          ) : null}
          <VistaPreviaSitio
            vista={verPagina ? 'pagina.sector' : 'home.strategic-sectors'}
            etiqueta={verPagina ? 'página del sector' : 'home'}
            borrador={borrador}
            modoInicial={modoTema}
            aviso={verPagina ? <>Se ve lo escrito aunque no esté guardado. La imagen nueva sale al guardar.</> : !s.show ? <><i className="ph ph-eye-slash" /> La sección está oculta en el home.</> : null}
          />
        </div>
      </div>

      {toast ? <Toast kind={toast.ok ? 'ok' : 'bad'}>{toast.text}</Toast> : null}
    </div>
  );
}

/* ===================== Gestión de sectores ===================== */
/* Reusa /admin/cms/sectors (POST crear, GET :id detalle, PATCH multipart, DELETE).
 * Se aplica al instante (no pasa por «Guardar y publicar»). */

function SectorsManager({ sectors, onBorrador, onGuardado }: {
  sectors: SectorRow[];
  onBorrador: (b: SectorVistaPrevia | null) => void;
  onGuardado: () => void;
}) {
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
    if (!(await confirmar({ titulo: '¿Eliminar este sector?', mensaje: 'No se puede deshacer.', confirmar: 'Eliminar', peligro: true }))) return;
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
        subtitulo="Crea el sector y luego edita sus datos, imagen o video. Se aplica al instante."
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
            <SectorEditRow key={sec.id} id={sec.id} busy={busy === sec.id} onClose={() => setEditing(null)} onSaved={() => { onGuardado(); router.refresh(); }} onBorrador={onBorrador} />
          ) : (
            <div key={sec.id} className="adm-trow" style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: sec.status === 1 ? 1 : 0.6 }}>
              <Thumb src={sec.image} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="adm-cell-title adm-ellipsis">{sec.title}</div>
                <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <StatusText tone={sec.status === 1 ? 'ok' : 'muted'}>{sec.status === 1 ? 'Visible' : 'Oculto'}</StatusText>
                  {sec.video ? <span className="adm-cell-sub" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><i className="ph ph-video-camera" /> Con video</span> : null}
                </div>
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


/* ===================== Editar un sector ===================== */
/* 2026-11-16: el dueño escribe cada sector como un documento (título, frase
 * corta y seis apartados con su frase destacada). El formulario sigue esa
 * misma forma, en texto normal (sin HTML), y «Pegar el texto completo» reparte
 * un documento pegado en sus campos (separarTextoSector, @maqserv/config). */

type Textos = Record<ClaveBloqueSector, string>;
type Mapa = Partial<Record<ClaveBloqueSector, string>>;
const TEXTOS_VACIOS = Object.fromEntries(CLAVES_BLOQUE_SECTOR.map((c) => [c, ''])) as Textos;

/** Lo guardado antes era HTML o una lista en JSON: aquí se edita como texto. */
function listaATexto(v: string | null): string {
  if (!v) return '';
  try {
    const j = JSON.parse(v);
    if (Array.isArray(j)) return j.map(String).join('\n');
  } catch { /* texto normal */ }
  return htmlATexto(v);
}

/** Crece con lo escrito (Chrome/Edge); en los demás se estira a mano. */
const areaStyle = { ...textareaStyle, minHeight: 96, maxHeight: 560, overflowY: 'auto', fieldSizing: 'content' } as CSSProperties;
const ayuda: CSSProperties = { fontSize: 12, lineHeight: 1.5, color: 'var(--adm-faint)' };

function Apartado({ n, clave, titulo, destacado, texto, onTitulo, onDestacado, onTexto }: {
  n: number; clave: ClaveBloqueSector; titulo: string; destacado: string; texto: string;
  onTitulo: (v: string) => void; onDestacado: (v: string) => void; onTexto: (v: string) => void;
}) {
  const def = BLOQUES_SECTOR.find((b) => b.clave === clave)!.titulo;
  const esLista = clave === 'lista';
  return (
    <div style={{ border: '1px solid var(--adm-border)', borderRadius: 12, padding: 14, display: 'grid', gap: 10, background: 'var(--adm-card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span aria-hidden style={{ width: 24, height: 24, borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, background: 'rgba(var(--adm-ink),0.06)', color: 'var(--adm-text-2)', flexShrink: 0 }}>{n}</span>
        <input
          value={titulo}
          onChange={(e) => onTitulo(e.target.value)}
          placeholder={def}
          maxLength={80}
          aria-label={`Título del apartado ${n} (si lo dejas vacío: «${def}»)`}
          style={{ ...inputStyle, fontWeight: 600 }}
        />
      </div>
      <input value={destacado} onChange={(e) => onDestacado(e.target.value)} placeholder="Frase destacada (opcional)" maxLength={300} aria-label={`Frase destacada del apartado ${n}`} style={inputStyle} />
      <textarea
        value={texto}
        onChange={(e) => onTexto(e.target.value)}
        placeholder={esLista ? '* Excavadoras hidráulicas\n* Retroexcavadoras\n* Camiones de volteo' : 'Escribe el texto. Cada renglón es un párrafo.'}
        aria-label={esLista ? `Servicios del apartado ${n}` : `Texto del apartado ${n}`}
        style={{ ...areaStyle, minHeight: esLista ? 140 : 96 }}
      />
      {esLista ? (
        <span style={ayuda}>
          Un servicio por renglón, con <b>*</b> al inicio. Si escribes «Nombre: detalle», el nombre sale en negritas. Para agrupar, pon el nombre del grupo en su propio renglón (sin *) arriba de sus servicios. Un renglón sin * en otro lugar sale como nota.
        </span>
      ) : null}
    </div>
  );
}

function SectorEditRow({ id, busy, onClose, onSaved, onBorrador }: {
  id: number; busy: boolean; onClose: () => void; onSaved: () => void;
  onBorrador: (b: SectorVistaPrevia | null) => void;
}) {
  const router = useRouter();
  const [data, setData] = useState<SectorFull | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [title, setTitle] = useState('');
  const [frase, setFrase] = useState('');
  const [textos, setTextos] = useState<Textos>(TEXTOS_VACIOS);
  const [titulos, setTitulos] = useState<Mapa>({});
  const [destacados, setDestacados] = useState<Mapa>({});
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  /** Avance de la subida del video (0–100), o null si no se está subiendo. */
  const [subiendo, setSubiendo] = useState<number | null>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [pegarAbierto, setPegarAbierto] = useState(false);
  const [pegado, setPegado] = useState('');
  const [avisoPegar, setAvisoPegar] = useState<string | null>(null);
  /** Lo último guardado, para saber si hay cambios sin guardar. */
  const [guardado, setGuardado] = useState('');

  function cargar(d: SectorFull) {
    setData(d);
    setTitle(d.title ?? '');
    setFrase(d.textos?.frase ?? '');
    const t: Textos = {
      sobre: htmlATexto(d.description), trayectoria: htmlATexto(d.trayectoria), esencia: htmlATexto(d.esencia),
      servicios: htmlATexto(d.servicios), excelencia: htmlATexto(d.excelencia), lista: listaATexto(d.serviciosLista),
    };
    setTextos(t);
    setTitulos(d.textos?.titulos ?? {});
    setDestacados(d.textos?.destacados ?? {});
    setPreview(d.image);
    setVideo(d.video ?? null);
    setFile(null);
    setGuardado(JSON.stringify([d.title ?? '', d.textos?.frase ?? '', t, d.textos?.titulos ?? {}, d.textos?.destacados ?? {}]));
  }

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/cms/sectors/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SectorFull | null) => {
        if (!alive) return;
        if (!d) { setLoadErr(true); return; }
        cargar(d);
      })
      .catch(() => alive && setLoadErr(true));
    return () => { alive = false; };
  }, [id]);

  // Lo escrito va a la vista previa al momento (sin guardar).
  useEffect(() => {
    if (!data) return;
    onBorrador({ id, title, image: data.image, video, frase: frase || null, textos, titulos, destacados });
  }, [data, id, title, video, frase, textos, titulos, destacados, onBorrador]);
  useEffect(() => () => onBorrador(null), [onBorrador]);

  const foto = JSON.stringify([title, frase, textos, titulos, destacados]);
  const cambios = !!data && (foto !== guardado || file !== null);

  async function cerrar() {
    if (cambios && !(await confirmar({ titulo: '¿Cerrar sin guardar?', mensaje: 'Lo que cambiaste en este sector se pierde.', confirmar: 'Cerrar sin guardar', peligro: true }))) return;
    onClose();
  }

  function pick(f: File) { if (f.type.startsWith('image/')) { setFile(f); setPreview(URL.createObjectURL(f)); } }

  /** El video se guarda al elegirlo (no espera a «Guardar sector»): es la parte lenta. */
  async function elegirVideo(archivo: File | null) {
    if (videoRef.current) videoRef.current.value = '';
    if (!archivo) return;
    setErr(null); setAviso(null);
    if (archivo.size > VIDEO_MAX_MB * 1024 * 1024) { setErr(`El video pesa más de ${VIDEO_MAX_MB} MB`); return; }
    setSubiendo(0);
    try {
      const url = await subirVideo(id, archivo, setSubiendo);
      setVideo(url);
      setAviso('Video guardado: ya se ve en el sitio.');
      router.refresh();
    } catch (e) { setErr((e as Error).message); } finally { setSubiendo(null); }
  }

  async function quitarVideo() {
    setErr(null); setAviso(null);
    const r = await fetch(`/api/admin/cms/sectors/${id}/video`, { method: 'DELETE' });
    if (!r.ok) { setErr('No se pudo quitar el video'); return; }
    setVideo(null);
    setAviso('Video quitado: se vuelve a ver la imagen.');
    router.refresh();
  }

  function acomodar() {
    const r = separarTextoSector(pegado, title);
    if (r.reconocidos === 0) {
      setAvisoPegar('No encontré los títulos de los apartados. Cada uno debe ir en su propio renglón: «Sobre este sector», «Trayectoria», «Esencia», «Servicios», «Excelencia» y «Servicios incluidos» (con o sin número).');
      return;
    }
    if (r.titulo) setTitle(r.titulo);
    setFrase(r.frase ?? '');
    setTextos(r.textos);
    setTitulos(r.titulos);
    setDestacados(r.destacados);
    setPegarAbierto(false);
    setPegado('');
    setAvisoPegar(null);
    setErr(null);
    setAviso(`Listo: se acomodaron ${r.reconocidos} de 6 apartados${r.titulo ? ` y el título quedó «${r.titulo}»` : ''}. Revisa en la vista previa y da «Guardar sector».`);
  }

  async function save() {
    if (title.trim().length < 2) { setErr('El título es obligatorio'); return; }
    setSaving(true); setErr(null); setAviso(null);
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('description', textos.sobre); fd.append('trayectoria', textos.trayectoria); fd.append('esencia', textos.esencia);
      fd.append('servicios', textos.servicios); fd.append('excelencia', textos.excelencia); fd.append('serviciosLista', textos.lista);
      fd.append('textos', JSON.stringify({ frase, titulos, destacados }));
      if (file) fd.append('image', file);
      const r = await fetch(`/api/admin/cms/sectors/${id}`, { method: 'PATCH', body: fd });
      if (!r.ok) {
        const d = (await r.json().catch(() => null)) as { message?: string } | null;
        throw new Error(d?.message ?? 'No se pudo guardar el sector');
      }
      const fresco = (await fetch(`/api/admin/cms/sectors/${id}`).then((x) => (x.ok ? x.json() : null)).catch(() => null)) as SectorFull | null;
      if (fresco) cargar(fresco);
      else { setGuardado(foto); setFile(null); }
      setAviso('Guardado: ya está en el sitio.');
      onSaved();
    } catch (e) { setErr((e as Error).message); } finally { setSaving(false); }
  }

  const enSitio = data ? `${urlDelSitio()}/sectores/${productSlug(data.title || 'sector', id)}` : null;
  const ponerTitulo = (k: ClaveBloqueSector) => (v: string) => setTitulos((m) => ({ ...m, [k]: v }));
  const ponerDestacado = (k: ClaveBloqueSector) => (v: string) => setDestacados((m) => ({ ...m, [k]: v }));
  const ponerTexto = (k: ClaveBloqueSector) => (v: string) => setTextos((m) => ({ ...m, [k]: v }));

  // El sector en edición se abre dentro de su fila, con un fondo apenas más claro.
  return (
    <div className="adm-trow" style={{ display: 'grid', gap: 16, padding: 20, background: 'rgba(var(--adm-ink),0.02)' }}>
      {loadErr ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13, color: 'var(--adm-bad)' }}>No se pudo cargar el sector. <Btn size="sm" variant="ghost" onClick={onClose}>Cerrar</Btn></div>
      ) : !data ? (
        <div style={{ fontSize: 13, color: 'var(--adm-muted)', padding: '8px 2px' }}><i className="ph ph-circle-notch" /> Cargando…</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <h3 style={h3Style}>Editar sector</h3>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {enSitio ? <a href={enSitio} target="_blank" rel="noreferrer" className="adm-link" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}>Ver en el sitio <i className="ph ph-arrow-square-out" /></a> : null}
              <Btn size="sm" variant="ghost" onClick={cerrar} disabled={subiendo !== null || saving}>Cerrar</Btn>
            </div>
          </div>

          {/* ===== Tarjeta: imagen o video, título y frase corta ===== */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: 10, alignContent: 'start', flexShrink: 0 }}>
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
              {/* Video (opcional): va en lugar de la imagen solo en la tarjeta del inicio; la página del sector usa la imagen. */}
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (subiendo === null) void elegirVideo(e.dataTransfer.files?.[0] ?? null); }}
                style={{ position: 'relative', width: 150, height: 100, flexShrink: 0, border: '1.5px dashed var(--adm-border-strong)', borderRadius: 12, background: video ? '#000' : D.inputBg, cursor: subiendo === null ? 'pointer' : 'progress', overflow: 'hidden', display: 'grid', placeItems: 'center' }}
              >
                {video ? (
                  <video src={video} poster={preview ?? undefined} muted loop autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : subiendo === null ? (
                  <span style={{ textAlign: 'center', color: 'var(--adm-muted)', fontSize: 12.5 }}><i className="ph ph-video-camera" style={{ fontSize: 20, display: 'block', marginBottom: 4 }} />Video (opcional)</span>
                ) : null}
                {subiendo !== null ? (
                  <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 8, background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 12.5 }}>
                    Subiendo… {subiendo}%
                    <Bar pct={subiendo} width={110} />
                  </span>
                ) : null}
                <input ref={videoRef} type="file" accept="video/mp4,video/webm" disabled={subiendo !== null} onChange={(e) => void elegirVideo(e.target.files?.[0] ?? null)} style={{ display: 'none' }} />
              </label>
              {video && subiendo === null ? (
                <Btn size="sm" variant="ghost" icon="ph-trash" onClick={quitarVideo}>Quitar video</Btn>
              ) : null}
            </div>
            <div style={{ flex: 1, minWidth: 220, display: 'grid', gap: 12, alignContent: 'start' }}>
              <Field label="Título"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nombre del sector" maxLength={190} style={inputStyle} /></Field>
              <Field label="Frase corta (tarjeta del inicio y encabezado de su página)">
                <textarea value={frase} onChange={(e) => setFrase(e.target.value)} rows={2} maxLength={300} placeholder="Ej. Conectamos maquinaria, equipos y servicios especializados con los proyectos que construyen el futuro." style={{ ...areaStyle, minHeight: 60 }} />
              </Field>
              <span style={ayuda}>
                Sin frase, la tarjeta toma el principio de «Sobre este sector». Si subes video, se ve en la tarjeta del inicio en lugar de la imagen, en bucle y sin sonido (la página del sector sigue con la imagen); MP4 o WebM, hasta {VIDEO_MAX_MB} MB (mejor de 5 a 15 s y menos de 10 MB). El video se guarda al elegirlo.
              </span>
            </div>
          </div>

          {/* ===== Página del sector: seis apartados ===== */}
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', borderTop: '1px solid var(--adm-border)', paddingTop: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div className="adm-cell-title">Página del sector</div>
                <div className="adm-cell-sub">Texto normal: cada renglón es un párrafo. El título vacío usa el de siempre; un apartado sin texto no sale.</div>
              </div>
              <Btn size="sm" icon="ph-clipboard-text" onClick={() => { setAvisoPegar(null); setPegarAbierto(true); }}>Pegar el texto completo</Btn>
            </div>
            {BLOQUES_SECTOR.map((b, i) => (
              <Apartado
                key={b.clave}
                n={i + 1}
                clave={b.clave}
                titulo={titulos[b.clave] ?? ''}
                destacado={destacados[b.clave] ?? ''}
                texto={textos[b.clave]}
                onTitulo={ponerTitulo(b.clave)}
                onDestacado={ponerDestacado(b.clave)}
                onTexto={ponerTexto(b.clave)}
              />
            ))}
          </div>

          {err ? <Note tone="bad">{err}</Note> : null}
          {aviso ? <Note tone="ok">{aviso}</Note> : null}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', position: 'sticky', bottom: 0, padding: '10px 0 2px', background: 'var(--adm-page)', zIndex: 2 }}>
            <Btn variant="primary" icon="ph-check" onClick={save} disabled={saving || busy || subiendo !== null}>{saving ? 'Guardando…' : 'Guardar sector'}</Btn>
            <Btn variant="ghost" onClick={cerrar} disabled={saving || subiendo !== null}>Cerrar</Btn>
            {cambios ? <StatusText tone="warn">Cambios sin guardar</StatusText> : null}
          </div>

          <Modal
            abierto={pegarAbierto}
            titulo="Pegar el texto completo"
            subtitulo={<>Pega el documento del sector tal como lo escribiste. Se reparte solo en el título, la frase corta y los seis apartados; luego lo revisas y das «Guardar sector».</>}
            onCerrar={() => setPegarAbierto(false)}
            ancho={720}
            pie={
              <>
                <Btn variant="ghost" onClick={() => setPegarAbierto(false)}>Cancelar</Btn>
                <Btn variant="primary" icon="ph-magic-wand" onClick={acomodar} disabled={!pegado.trim()}>Acomodar en los campos</Btn>
              </>
            }
          >
            <div style={{ display: 'grid', gap: 10 }}>
              <textarea
                value={pegado}
                onChange={(e) => setPegado(e.target.value)}
                rows={16}
                autoFocus
                placeholder={'CONSTRUCCIÓN INDUSTRIAL\nSoluciones para el desarrollo de naves y parques industriales\n\n1. SOBRE ESTE SECTOR\n…\n2. TRAYECTORIA\n…\n6. SERVICIOS INCLUIDOS\n* …'}
                className="adm-textarea"
                style={{ fontSize: 13.5, lineHeight: 1.5 }}
              />
              <span style={ayuda}>Reemplaza lo que hay ahora en los campos de la página. Reconoce los títulos con o sin número, y también «Nuestra esencia», «Nuestro diferencial» o «Soluciones para…».</span>
              {avisoPegar ? <Note tone="warn">{avisoPegar}</Note> : null}
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}
