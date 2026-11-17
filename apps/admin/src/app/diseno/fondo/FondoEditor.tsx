'use client';

import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { defaultTheme, type Fondo, type Musica, type ThemeTokens } from '@maqserv/config';
import { cardStyle, h3Style, Toggle } from '@/components/editor-kit';
import { Btn, PageHeader, StatusText, Toast } from '@/components/ui';
import { portadaDeVideo, subirPortada } from '@/lib/portada-video';

/** Igual que el tope de `POST admin/cms/video` en la API. */
const VIDEO_MAX_MB = 30;
/** El fondo de fábrica: la nebulosa azul que mandó el dueño (va en el sitio, /fondo/). */
const DE_FABRICA: Fondo = defaultTheme.tokens.fondo;
/** La música de fábrica: la pista original «tecnología» hecha para MAQSER24 (va en el sitio, /fondo/). */
const MUSICA_DE_FABRICA: Musica = defaultTheme.tokens.musica;
const AUDIO_MAX_MB = 20;

/** Sube la música (XHR por el avance). */
function subirAudio(archivo: File, onAvance: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/cms/audio');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onAvance(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let d: { message?: string; audio?: string } | null = null;
      try { d = JSON.parse(xhr.responseText); } catch { /* sin cuerpo */ }
      if (xhr.status >= 200 && xhr.status < 300 && d?.audio) resolve(d.audio);
      else if (xhr.status === 413) reject(new Error(`La música pesa más de ${AUDIO_MAX_MB} MB`));
      else reject(new Error(d?.message ?? 'No se pudo subir la música'));
    };
    xhr.onerror = () => reject(new Error('Se cortó la conexión al subir la música'));
    const fd = new FormData();
    fd.append('audio', archivo);
    xhr.send(fd);
  });
}

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

const fila: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 };
const desc: CSSProperties = { margin: '4px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--adm-muted)' };

/**
 * FONDO ANIMADO (2026-11-16, el dueño: «el fondo se va cambiar de nuevo… además
 * quieren movimiento: eso en todas las pantallas»). Un video en bucle detrás de
 * todas las páginas del sitio, con un velo oscuro encima. Se publica con
 * «Guardar y publicar», como las demás secciones.
 */
export function FondoEditor({ themeId, tokens, fondo, musica: musicaInicial, sitio }: { themeId: number | null; tokens: ThemeTokens; fondo: Fondo; musica: Musica; sitio: string }) {
  const router = useRouter();
  const [config, setConfig] = useState<Fondo>({ ...DE_FABRICA, ...(fondo ?? {}) });
  const [saved, setSaved] = useState<Fondo>(config);
  const [musica, setMusica] = useState<Musica>({ ...MUSICA_DE_FABRICA, ...(musicaInicial ?? {}) });
  const [musicaGuardada, setMusicaGuardada] = useState<Musica>(musica);
  const [subiendoAudio, setSubiendoAudio] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [subiendo, setSubiendo] = useState<number | null>(null);
  const [vertical, setVertical] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const set = <K extends keyof Fondo>(k: K, v: Fondo[K]) => setConfig((c) => ({ ...c, [k]: v }));
  const setM = <K extends keyof Musica>(k: K, v: Musica[K]) => setMusica((m) => ({ ...m, [k]: v }));
  const dirty = JSON.stringify(config) !== JSON.stringify(saved) || JSON.stringify(musica) !== JSON.stringify(musicaGuardada);
  const musicaDeFabrica = musica.archivo === MUSICA_DE_FABRICA.archivo;

  async function elegirAudio(f: File) {
    if (f.size > AUDIO_MAX_MB * 1024 * 1024) { setToast({ ok: false, text: `La música pesa más de ${AUDIO_MAX_MB} MB` }); return; }
    setToast(null);
    setSubiendoAudio(0);
    try {
      const url = await subirAudio(f, setSubiendoAudio);
      setM('archivo', url);
      setToast({ ok: true, text: 'Música lista. Da «Guardar y publicar» para que suene en el sitio.' });
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); } finally { setSubiendoAudio(null); }
  }
  /** Las rutas del sitio (/fondo/…) se ven desde el panel con la dirección del sitio delante. */
  const abs = (u: string | null) => (u && u.startsWith('/') ? `${sitio}${u}` : u);
  const esDeFabrica = config.video === DE_FABRICA.video && config.imagen === DE_FABRICA.imagen;

  async function elegirVideo(f: File) {
    if (f.size > VIDEO_MAX_MB * 1024 * 1024) { setToast({ ok: false, text: `El video pesa más de ${VIDEO_MAX_MB} MB` }); return; }
    setToast(null);
    setSubiendo(0);
    try {
      const url = await subirVideo(f, setSubiendo);
      // La portada es siempre del video nuevo (la anterior era de otro video).
      const portada = await portadaDeVideo(f);
      const img = portada ? await subirPortada(portada) : null;
      setConfig((c) => ({ ...c, video: url, imagen: img ?? null }));
      setToast({ ok: true, text: 'Video listo. Da «Guardar y publicar» para que se vea en el sitio.' });
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); } finally { setSubiendo(null); }
  }

  async function publicar() {
    if (busy || !themeId || subiendo !== null || subiendoAudio !== null) return;
    setBusy(true); setToast(null);
    try {
      const r2 = await fetch(`/api/admin/themes/${themeId}/draft`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tokens: { ...tokens, fondo: config, musica } }) });
      if (!r2.ok) throw new Error('No se pudieron guardar los ajustes');
      const r3 = await fetch(`/api/admin/themes/${themeId}/publish`, { method: 'POST' });
      if (!r3.ok) throw new Error('No se pudo publicar');
      setSaved(config);
      setMusicaGuardada(musica);
      setToast({ ok: true, text: 'Publicado — el sitio se actualizará al refrescar.' });
      router.refresh();
    } catch (e) { setToast({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  }

  // Girado: la caja del video, antes de girar, es la muestra (16:9) con ancho y
  // alto intercambiados (56.25 % de ancho, 177.78 % de alto); al girar la cubre.
  const girado = config.girar && vertical;
  const medioGirado: CSSProperties = girado
    ? { position: 'absolute', top: '50%', left: '50%', width: '56.25%', height: '177.78%', maxWidth: 'none', objectFit: 'cover', transform: 'translate(-50%, -50%) rotate(90deg)' }
    : { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' };

  return (
    <div>
      <PageHeader
        eyebrow={['Sitio web', 'Fondo y música']}
        title="Fondo y música"
        subtitle="El video en movimiento detrás de todas las páginas del sitio y la música de fondo. El velo oscuro deja leer el texto; la música arranca cuando la persona toca la página y siempre la puede pausar."
        actions={
          <>
            <StatusText tone={dirty ? 'warn' : 'ok'}>{dirty ? 'Cambios sin publicar' : 'Todo publicado'}</StatusText>
            <Btn variant="ghost" onClick={() => { setConfig(saved); setMusica(musicaGuardada); setToast(null); }} disabled={!dirty || busy}>Descartar</Btn>
            <Btn variant="primary" icon="ph-cloud-arrow-up" onClick={publicar} disabled={busy || subiendo !== null || subiendoAudio !== null || !themeId}>{busy ? 'Publicando…' : 'Guardar y publicar'}</Btn>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 22, alignItems: 'start' }} className="hero-ed-grid">
        <div style={{ minWidth: 0 }}>
          <div style={{ ...cardStyle }}>
            <div style={fila}>
              <div><h3 style={h3Style}>Mostrar el fondo animado</h3><p style={desc}>Apágalo y el sitio vuelve al fondo liso del tema.</p></div>
              <Toggle on={config.activo} onClick={() => set('activo', !config.activo)} />
            </div>
          </div>

          <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
            <div>
              <h3 style={h3Style}>Video</h3>
              <p style={desc}>MP4 o WebM, hasta {VIDEO_MAX_MB} MB; mejor de 5 a 20 s y menos de 5 MB (se descarga en cada visita nueva). Va sin sonido y en bucle. La portada se saca sola del video.</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <label className="adm-btn adm-btn-secondary adm-btn-sm" style={{ cursor: subiendo !== null ? 'default' : 'pointer' }}>
                <i className="ph ph-video-camera" aria-hidden /> {subiendo !== null ? `Subiendo… ${subiendo}%` : config.video ? 'Cambiar video' : 'Subir video'}
                <input type="file" accept="video/mp4,video/webm" disabled={subiendo !== null} onChange={(e) => { const f = e.target.files?.[0]; if (f) void elegirVideo(f); e.target.value = ''; }} style={{ display: 'none' }} />
              </label>
              {!esDeFabrica && subiendo === null ? (
                <Btn size="sm" variant="ghost" icon="ph-arrow-counter-clockwise" onClick={() => setConfig((c) => ({ ...c, video: DE_FABRICA.video, imagen: DE_FABRICA.imagen }))}>Volver a la nebulosa azul</Btn>
              ) : null}
            </div>
          </div>

          <div style={{ ...cardStyle, display: 'grid', gap: 10 }}>
            <div style={fila}>
              <h3 style={h3Style}>Qué tan oscuro</h3>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{config.oscuridad}%</span>
            </div>
            <input type="range" min={20} max={90} step={5} value={config.oscuridad} onChange={(e) => set('oscuridad', Number(e.target.value))} style={{ width: '100%' }} aria-label="Qué tan oscuro" />
            <p style={{ ...desc, margin: 0 }}>Más alto = el video se ve más tenue y el texto se lee mejor. Recomendado: 50 a 65 %.</p>
          </div>

          {/* MÚSICA DE FONDO (2026-11-17) */}
          <div style={{ ...cardStyle, display: 'grid', gap: 12 }}>
            <div style={fila}>
              <div><h3 style={h3Style}>Música de fondo</h3><p style={desc}>Suena en todas las páginas. Los navegadores no dejan sonar nada hasta que la persona toca la página: arranca con su primer clic y siempre hay un botón abajo a la derecha para pausarla.</p></div>
              <Toggle on={musica.activo} onClick={() => setM('activo', !musica.activo)} />
            </div>
            {musica.archivo ? (
              <audio key={musica.archivo} src={abs(musica.archivo) ?? undefined} controls preload="none" style={{ width: '100%' }} />
            ) : null}
            <p style={{ ...desc, margin: 0 }}>{musicaDeFabrica ? 'Ahora: la pista de tecnología hecha para MAQSER24.' : 'Ahora: la música que subiste.'} MP3, M4A u OGG, hasta {AUDIO_MAX_MB} MB; mejor de 1 a 3 minutos y que repita sin corte.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <label className="adm-btn adm-btn-secondary adm-btn-sm" style={{ cursor: subiendoAudio !== null ? 'default' : 'pointer' }}>
                <i className="ph ph-music-notes" aria-hidden /> {subiendoAudio !== null ? `Subiendo… ${subiendoAudio}%` : 'Cambiar música'}
                <input type="file" accept="audio/mpeg,audio/mp4,audio/ogg,.mp3,.m4a,.ogg" disabled={subiendoAudio !== null} onChange={(e) => { const f = e.target.files?.[0]; if (f) void elegirAudio(f); e.target.value = ''; }} style={{ display: 'none' }} />
              </label>
              {!musicaDeFabrica && subiendoAudio === null ? (
                <Btn size="sm" variant="ghost" icon="ph-arrow-counter-clockwise" onClick={() => setM('archivo', MUSICA_DE_FABRICA.archivo)}>Volver a la música de MAQSER24</Btn>
              ) : null}
            </div>
            <div style={{ ...fila, marginTop: 4 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>Volumen</span>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{musica.volumen}%</span>
            </div>
            <input type="range" min={5} max={100} step={1} value={musica.volumen} onChange={(e) => setM('volumen', Number(e.target.value))} style={{ width: '100%' }} aria-label="Volumen de la música" />
            <p style={{ ...desc, margin: 0 }}>De fondo conviene bajito: 20 a 30 %. (En iPhone manda el volumen del teléfono.)</p>
          </div>

          <div style={{ ...cardStyle }}>
            <div style={fila}>
              <div><h3 style={h3Style}>Girar videos verticales en pantallas anchas</h3><p style={desc}>Un video de celular (vertical) se gira en la compu para cubrir toda la pantalla y verse más nítido. Apágalo si el video tiene texto o personas.</p></div>
              <Toggle on={config.girar} onClick={() => set('girar', !config.girar)} />
            </div>
          </div>
        </div>

        {/* Muestra: el video con el velo encima, como queda detrás del texto en una pantalla ancha. */}
        <div style={{ position: 'sticky', top: 12 }}>
          <div style={{ position: 'relative', aspectRatio: '16 / 9', borderRadius: 12, overflow: 'hidden', background: '#05070a', border: '1px solid var(--adm-border-strong)' }}>
            {config.activo && config.video ? (
              <video key={config.video} src={abs(config.video) ?? undefined} poster={abs(config.imagen) ?? undefined} muted loop autoPlay playsInline style={medioGirado} onLoadedMetadata={(e) => setVertical(e.currentTarget.videoHeight > e.currentTarget.videoWidth)} />
            ) : config.activo && config.imagen ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={abs(config.imagen) ?? undefined} alt="" style={medioGirado} onLoad={(e) => setVertical(e.currentTarget.naturalHeight > e.currentTarget.naturalWidth)} />
            ) : null}
            <div style={{ position: 'absolute', inset: 0, background: `rgba(5,7,10,${config.oscuridad / 100})` }} />
            <div style={{ position: 'absolute', left: 22, bottom: 20, right: 22, color: '#fff' }}>
              <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: '-.01em' }}>Encuentra lo que tu obra necesita.</div>
              <div style={{ opacity: 0.78, fontSize: 13.5, marginTop: 4 }}>Así se lee el texto encima del fondo.</div>
            </div>
          </div>
          <p style={{ ...desc, marginTop: 10 }}>{config.activo ? 'Muestra en pantalla ancha. En el celular el video va de pie.' : 'El fondo animado está apagado.'}</p>
        </div>
      </div>

      {toast ? <Toast kind={toast.ok ? 'ok' : 'bad'}>{toast.text}</Toast> : null}
    </div>
  );
}
