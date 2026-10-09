'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AdminSelect } from '@/components/AdminSelect';
import { useRouter } from 'next/navigation';
import { Btn, btnClass, Chip, EmptyState, FormField, IconBtn, Panel, type Tone } from '@/components/ui';
import { avisar, pedirTexto } from '@/components/Dialogos';

/**
 * INCIDENCIAS DE CAMPO (documento institucional, sección 30).
 *
 * "Registro, evidencias, responsables, escalamiento y cierre."
 *
 * La pantalla está hecha para que registrar sea barato: tres clics y una
 * frase. Si levantar una incidencia cuesta trabajo, no se levanta — y entonces
 * el registro dice que todo va bien porque nadie tuvo tiempo de decir lo
 * contrario.
 */

interface Incidencia {
  id: number;
  quoteId: number;
  quoteNumber: string;
  cliente: string;
  categoria: string | null;
  provider: { id: number; name: string } | null;
  kind: string;
  kindLabel: string;
  severity: string;
  responsible: string;
  description: string;
  /** Fotos ya resueltas a URL por la API. */
  evidence: string[];
  state: string;
  resolution: string | null;
  openedAt: string;
  closedAt: string | null;
}

interface Tipo { clave: string; label: string; ejemplo: string }

const TONO_SEV: Record<string, Tone> = { alta: 'bad', media: 'warn', baja: 'muted' };
const RESPONSABLE: Record<string, string> = {
  cliente: 'Del cliente', aliado: 'Del aliado', plataforma: 'Nuestra', nadie: 'De nadie',
};

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

const MAX_FOTOS = 6;

const miniatura = { width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--adm-border-strong)', display: 'block' } as const;

/**
 * Ventana con el mismo aspecto que `Modal`, pero SIN cerrar con Esc. Las
 * ventanas de este módulo son formularios con desplegables (AdminSelect): Esc
 * cierra primero el desplegable abierto y `Modal` lo tomaba también como
 * "cerrar la ventana", con lo que se perdía lo ya escrito. Aquí solo cierran
 * la X, el botón del pie o el clic fuera, como antes del rediseño.
 */
export function VentanaFormulario({
  titulo, subtitulo, ancho = 600, onCerrar, pie, children,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  ancho?: number;
  onCerrar: () => void;
  pie?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onClick={onCerrar}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', padding: 20, zIndex: 200 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--adm-card)', border: '1px solid var(--adm-border-strong)', borderRadius: 14,
          width: `min(${ancho}px, 100%)`, maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column',
          boxShadow: '0 40px 90px -30px rgba(0,0,0,.9)', color: 'var(--adm-text)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '18px 22px 14px', borderBottom: '1px solid var(--adm-border)' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', fontFamily: 'inherit', color: 'var(--adm-text)' }}>{titulo}</h2>
            {subtitulo ? <div style={{ marginTop: 4, fontSize: 13, color: 'var(--adm-muted)', lineHeight: 1.5 }}>{subtitulo}</div> : null}
          </div>
          <IconBtn icon="ph-x" label="Cerrar" plain onClick={onCerrar} style={{ marginTop: -4, marginRight: -6 }} />
        </div>
        <div style={{ padding: 22, overflowY: 'auto' }}>{children}</div>
        {pie ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 22px', borderTop: '1px solid var(--adm-border)' }}>{pie}</div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Sube fotos y devuelve sus rutas. El navegador arma el FormData y NO fija el
 * Content-Type: si se pone a mano, se pierde el boundary y el servidor no puede
 * separar los archivos.
 */
async function subirFotos(files: File[], incidenciaId?: number): Promise<string[]> {
  const fd = new FormData();
  for (const f of files.slice(0, MAX_FOTOS)) fd.append('files', f);
  const url = incidenciaId ? `/api/admin/incidencias/${incidenciaId}/evidencias` : '/api/admin/incidencias/evidencias';
  const r = await fetch(url, { method: 'POST', body: fd });
  if (!r.ok) {
    const e = await r.json().catch(() => null);
    throw new Error(e?.message ?? 'No se pudieron subir las fotos');
  }
  const d = await r.json();
  return incidenciaId ? (d.evidence ?? []) : (d.archivos ?? []).map((a: { path: string }) => a.path);
}

export function Incidencias({
  quoteId, quoteNumber, onCerrar,
}: {
  quoteId: number;
  quoteNumber: string;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [lista, setLista] = useState<Incidencia[]>([]);
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abriendo, setAbriendo] = useState(false);
  const [f, setF] = useState({ kind: 'retraso', severity: 'media', responsible: 'nadie', description: '' });
  const [ocupado, setOcupado] = useState(false);
  /** Fotos elegidas para la incidencia que se está levantando (aún sin subir). */
  const [fotos, setFotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function recargar() {
    const [r1, r2] = await Promise.all([
      fetch(`/api/admin/incidencias?quoteId=${quoteId}&estado=todas`),
      fetch('/api/admin/incidencias/catalogo'),
    ]);
    if (r1.ok) setLista(await r1.json());
    if (r2.ok) setTipos((await r2.json()).tipos);
    setCargando(false);
  }

  useEffect(() => { recargar(); }, [quoteId]);

  async function abrir() {
    if (f.description.trim().length < 4) return;
    setOcupado(true);
    setError(null);
    try {
      // Las fotos van primero: si fallan, la incidencia no se crea a medias y
      // quien la está levantando puede reintentar sin volver a escribirlo todo.
      const evidence = fotos.length ? await subirFotos(fotos) : [];
      const r = await fetch('/api/admin/incidencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId, ...f, description: f.description.trim(), evidence }),
      });
      if (!r.ok) throw new Error('No se pudo registrar la incidencia');
      setF({ kind: 'retraso', severity: 'media', responsible: 'nadie', description: '' });
      setFotos([]);
      setAbriendo(false);
      recargar();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar');
    } finally {
      setOcupado(false);
    }
  }

  /** Foto que llega DESPUÉS, sobre una incidencia ya levantada. */
  async function agregarFoto(id: number, files: FileList | null) {
    if (!files?.length) return;
    setOcupado(true);
    setError(null);
    try {
      await subirFotos(Array.from(files), id);
      recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir la foto');
    } finally {
      setOcupado(false);
    }
  }

  async function cerrar(id: number) {
    const resolution = await pedirTexto({
      titulo: '¿Cómo se resolvió?',
      mensaje: 'Queda en el historial del servicio.',
      multilinea: true,
      requerido: true,
      confirmar: 'Siguiente',
    });
    if (resolution === null) return;
    if (resolution.trim().length < 4) {
      await avisar({ titulo: 'Falta cómo se resolvió', mensaje: 'Escribe al menos unas palabras para poder cerrarla.' });
      return;
    }
    // Al cerrar se puede corregir de quién fue: al abrir no siempre se sabe, y
    // obligar a decidirlo en caliente produce culpables inventados.
    const quien = await pedirTexto({
      titulo: '¿De quién fue?',
      valor: 'nadie',
      opciones: [
        { valor: 'cliente', texto: 'Del cliente' },
        { valor: 'aliado', texto: 'Del aliado' },
        { valor: 'plataforma', texto: 'Nuestra (MAQSER24)' },
        { valor: 'nadie', texto: 'De nadie' },
      ],
      confirmar: 'Cerrar incidencia',
    });
    if (quien === null) return;
    setOcupado(true);
    await fetch(`/api/admin/incidencias/${id}/cerrar`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resolution: resolution.trim(),
        ...(quien && ['cliente', 'aliado', 'plataforma', 'nadie'].includes(quien) ? { responsible: quien } : {}),
      }),
    });
    setOcupado(false);
    recargar();
    router.refresh();
  }

  const abiertas = lista.filter((i) => i.state === 'abierta');
  const elegido = tipos.find((t) => t.clave === f.kind);

  return (
    <VentanaFormulario
      titulo="Incidencias"
      ancho={600}
      onCerrar={onCerrar}
      subtitulo={
        <>
          <span className="adm-mono">{quoteNumber}</span> · {abiertas.length > 0 ? `${abiertas.length} sin resolver` : 'nada sin resolver'}.
          Lo que no se registra no se puede corregir.
        </>
      }
      pie={<Btn onClick={onCerrar}>Cerrar</Btn>}
    >
      {!abriendo ? (
        <Btn variant="primary" icon="ph-plus" onClick={() => setAbriendo(true)} style={{ marginBottom: 18 }}>
          Levantar incidencia
        </Btn>
      ) : (
        <div style={{ background: 'var(--adm-raised)', border: '1px solid var(--adm-border)', borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>
            <FormField label="Qué pasó">
              <AdminSelect ariaLabel="Qué pasó" value={f.kind} onChange={(v) => setF({ ...f, kind: v })} options={tipos.map((t) => ({ value: t.clave, label: t.label }))} />
            </FormField>
            <FormField label="Qué tan grave">
              <AdminSelect
                ariaLabel="Qué tan grave"
                value={f.severity}
                onChange={(v) => setF({ ...f, severity: v })}
                options={[{ value: 'baja', label: 'Baja' }, { value: 'media', label: 'Media' }, { value: 'alta', label: 'Alta' }]}
              />
            </FormField>
            <FormField label="De quién fue">
              {/* "De nadie" primero y por defecto: muchas incidencias no son
                  culpa de alguien, y obligar a señalar culpable haría que
                  nadie quisiera levantarlas. */}
              <AdminSelect
                ariaLabel="De quién fue"
                value={f.responsible}
                onChange={(v) => setF({ ...f, responsible: v })}
                options={[
                  { value: 'nadie', label: 'De nadie / aún no se sabe' },
                  { value: 'aliado', label: 'Del aliado' },
                  { value: 'cliente', label: 'Del cliente' },
                  { value: 'plataforma', label: 'Nuestra' },
                ]}
              />
            </FormField>
          </div>

          {elegido ? <div className="adm-help" style={{ marginTop: 8 }}>{elegido.ejemplo}</div> : null}

          <FormField label="Qué pasó, con detalle" style={{ marginTop: 14 }}>
            <textarea
              className="adm-textarea"
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
              rows={3}
              placeholder="La unidad llegó a las 10:40, comprometida para las 8:00. El residente ya había movido la cuadrilla."
              autoFocus
            />
          </FormField>

          {/* Fotos. `capture` no se fuerza: en el celular abre la cámara y en
              la computadora el explorador, y a veces la foto ya la mandaron
              por WhatsApp y solo hay que adjuntarla. */}
          <FormField label={`Fotos (opcional, hasta ${MAX_FOTOS})`} style={{ marginTop: 14 }}>
            <input
              type="file"
              accept="image/*"
              multiple
              className="adm-input"
              onChange={(e) => setFotos(Array.from(e.target.files ?? []).slice(0, MAX_FOTOS))}
              style={{ height: 'auto', padding: '7px 10px', fontSize: 12.5, cursor: 'pointer' }}
            />
          </FormField>

          {fotos.length > 0 ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {fotos.map((file, i) => (
                <span key={i} style={{ position: 'relative', display: 'inline-block' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(file)} alt={file.name} style={miniatura} />
                  <button
                    type="button"
                    onClick={() => setFotos(fotos.filter((_, j) => j !== i))}
                    aria-label={`Quitar ${file.name}`}
                    title="Quitar"
                    style={{
                      position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', padding: 0,
                      display: 'grid', placeItems: 'center', cursor: 'pointer',
                      background: 'var(--adm-card)', color: 'var(--adm-text)', border: '1px solid var(--adm-border-strong)',
                    }}
                  >
                    <i className="ph ph-x" aria-hidden style={{ fontSize: 11 }} />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <Btn variant="primary" onClick={abrir} disabled={ocupado}>
              {ocupado ? 'Guardando…' : 'Registrar'}
            </Btn>
            <Btn variant="ghost" onClick={() => { setAbriendo(false); setFotos([]); }}>Cancelar</Btn>
            {error ? <span role="alert" style={{ fontSize: 12.5, color: 'var(--adm-bad)', fontWeight: 600 }}>{error}</span> : null}
          </div>
        </div>
      )}

      {cargando ? <div style={{ fontSize: 13, color: 'var(--adm-muted)' }}>Cargando…</div> : null}

      {!cargando && lista.length === 0 ? (
        <EmptyState icon="ph-check-circle" title="Este servicio no ha tenido incidencias." />
      ) : null}

      {lista.length > 0 ? (
        <Panel flush clip>
          {lista.map((i) => (
            <div key={i.id} className="adm-trow" style={{ opacity: i.state === 'cerrada' ? 0.62 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px 12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px 9px', flexWrap: 'wrap', minWidth: 0 }}>
                  <span className="adm-cell-title">{i.kindLabel}</span>
                  <Chip tone={TONO_SEV[i.severity] ?? 'muted'}>{i.severity.charAt(0).toUpperCase() + i.severity.slice(1)}</Chip>
                  <span style={{ fontSize: 12.5, color: 'var(--adm-muted)' }}>{RESPONSABLE[i.responsible] ?? i.responsible}</span>
                </div>
                <span className="adm-num" style={{ fontSize: 12, color: 'var(--adm-faint)' }}>
                  {i.state === 'cerrada' ? `cerrada ${fecha(i.closedAt)}` : fecha(i.openedAt)}
                </span>
              </div>

              <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--adm-text-2)', lineHeight: 1.55 }}>{i.description}</p>

              {/* La evidencia es la mitad del registro: una incidencia sin foto
                  es la palabra de alguien contra la de otro. */}
              {i.evidence.length > 0 ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {i.evidence.map((src, n) => (
                    <a key={src} href={src} target="_blank" rel="noopener noreferrer" title="Abrir la foto">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`Evidencia ${n + 1} de ${i.kindLabel}`} loading="lazy" style={miniatura} />
                    </a>
                  ))}
                </div>
              ) : null}

              {i.resolution ? (
                <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--adm-ok)', lineHeight: 1.55 }}>
                  Se resolvió: {i.resolution}
                </p>
              ) : null}

              {i.state === 'abierta' ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Btn size="sm" icon="ph-check" onClick={() => cerrar(i.id)} disabled={ocupado}>
                    Marcar resuelta
                  </Btn>
                  {/* La foto casi nunca llega con el aviso: llega después. */}
                  {i.evidence.length < 12 ? (
                    <label className={btnClass('secondary', 'sm')} style={{ cursor: ocupado ? 'wait' : 'pointer' }}>
                      <i className="ph ph-camera" aria-hidden />
                      Agregar foto
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={ocupado}
                        onChange={(e) => { agregarFoto(i.id, e.target.files); e.target.value = ''; }}
                        style={{ display: 'none' }}
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </Panel>
      ) : null}
    </VentanaFormulario>
  );
}
