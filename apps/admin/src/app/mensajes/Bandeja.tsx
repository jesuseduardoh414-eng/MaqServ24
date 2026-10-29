'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminSelect } from '@/components/AdminSelect';
import { Btn, Chip, EmptyState, IconBtn, PageHeader, Panel, SearchBox, Segmented, Stat, Stats, StatusText, Toast, Toolbar } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { confirmar } from '@/components/Dialogos';

/** Un renglón de la bandeja: un mensaje de Contacto o una pregunta. Ver admin-bandeja.controller.ts. */
export interface ItemBandeja {
  key: string;
  tipo: 'contacto' | 'pregunta';
  id: number;
  /** contacto · sitio · producto · correo · whatsapp · telefono · otro */
  origen: string;
  nombre: string | null;
  correo: string | null;
  telefono: string | null;
  empresa: string | null;
  motivo: string | null;
  producto: string | null;
  texto: string;
  respuesta: string | null;
  estado: 'pendiente' | 'atendido' | 'archivado';
  atendidoPor: string | null;
  atendidoEl: string | null;
  publicada: boolean;
  /** Solo en mensajes de Contacto ya publicados: cómo se ve en el sitio. */
  faq: { id: number; pregunta: string; respuesta: string } | null;
  fecha: string;
}

const CAPTURADA = ['correo', 'whatsapp', 'telefono', 'otro'];
const ORIGEN: Record<string, string> = {
  contacto: 'Contacto',
  sitio: 'Preguntas frecuentes',
  producto: 'Producto',
  correo: 'Capturada · correo',
  whatsapp: 'Capturada · WhatsApp',
  telefono: 'Capturada · teléfono',
  otro: 'Capturada en el panel',
};
const origenDe = (i: ItemBandeja) =>
  i.origen === 'contacto' ? `Contacto${i.motivo ? ` · ${i.motivo}` : ''}`
    : i.origen === 'producto' ? `Producto · ${i.producto ?? ''}`
      : ORIGEN[i.origen] ?? 'Pregunta';
const filtroOrigen = (i: ItemBandeja, o: string) =>
  !o || (o === 'capturada' ? CAPTURADA.includes(i.origen) : i.origen === o);

const fecha = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '';
const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const POR_PAGINA = 30;

const json = async (r: Response) => {
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.message ?? 'No se pudo guardar.');
  return d;
};

/**
 * MENSAJES — una sola bandeja para las dudas de los clientes (2026-10-14).
 *
 * Llega todo aquí: Contacto, "Hacer una pregunta" de Preguntas frecuentes, las
 * preguntas de un producto y lo que se captura a mano cuando llega por correo
 * o WhatsApp. Se contesta en el mismo renglón (al cliente le llega por correo)
 * y, si le sirve a todos, se publica en Preguntas frecuentes.
 */
export function Bandeja({ inicial, extra }: { inicial: ItemBandeja[]; /** Herramientas extra del encabezado (subir al CRM, si está activo). */ extra?: React.ReactNode }) {
  const [items, setItems] = useState(inicial);
  // En vivo (2026-10-26): al llegar un aviso la campana pide la página otra vez;
  // la lista toma lo nuevo del servidor (lo que se escribe vive aparte y no se pierde).
  useEffect(() => { setItems(inicial); }, [inicial]);
  const [estado, setEstado] = useState<'pendiente' | 'atendido' | 'archivado' | 'todos'>('pendiente');
  const [origen, setOrigen] = useState('');
  const [q, setQ] = useState('');
  const [visibles, setVisibles] = useState(POR_PAGINA);
  const [borrador, setBorrador] = useState<Record<string, string>>({});
  const [editando, setEditando] = useState<Record<string, boolean>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [nueva, setNueva] = useState(false);
  const [publicando, setPublicando] = useState<ItemBandeja | null>(null);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  const cuenta = useMemo(() => ({
    pendiente: items.filter((i) => i.estado === 'pendiente').length,
    atendido: items.filter((i) => i.estado === 'atendido').length,
    archivado: items.filter((i) => i.estado === 'archivado').length,
    publicadas: items.filter((i) => i.publicada).length,
  }), [items]);

  const filtrados = useMemo(() => {
    const palabras = normal(q.trim()).split(/\s+/).filter(Boolean);
    return items.filter((i) => (estado === 'todos' || i.estado === estado) && filtroOrigen(i, origen)
      && (!palabras.length || palabras.every((p) => normal(`${i.nombre ?? ''} ${i.correo ?? ''} ${i.empresa ?? ''} ${i.texto} ${i.respuesta ?? ''}`).includes(p))));
  }, [items, estado, origen, q]);
  const mostrados = filtrados.slice(0, visibles);

  const cambiar = (key: string, cambio: Partial<ItemBandeja>) => setItems((l) => l.map((i) => (i.key === key ? { ...i, ...cambio } : i)));

  async function hacer(i: ItemBandeja, accion: () => Promise<void>, ok?: string) {
    setOcupado(i.key);
    try { await accion(); if (ok) setToast({ ok: true, text: ok }); }
    catch (e) { setToast({ ok: false, text: (e as Error).message }); }
    finally { setOcupado(null); }
  }

  const responder = (i: ItemBandeja) => {
    const texto = (borrador[i.key] ?? '').trim();
    if (texto.length < 2) { setToast({ ok: false, text: 'Escribe la respuesta.' }); return; }
    const primera = !i.respuesta;
    void hacer(i, async () => {
      if (i.tipo === 'contacto') {
        await json(await fetch(`/api/admin/bandeja/contacto/${i.id}/responder`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ respuesta: texto }) }));
      } else {
        await json(await fetch(`/api/admin/questions/${i.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: texto }) }));
      }
      cambiar(i.key, { respuesta: texto, estado: 'atendido' });
      setBorrador((b) => { const n = { ...b }; delete n[i.key]; return n; });
      setEditando((e) => ({ ...e, [i.key]: false }));
    }, primera && i.correo ? `Respondido. Le llegó por correo a ${i.correo}.` : 'Respuesta guardada.');
  };

  const marcarAtendido = (i: ItemBandeja) => void hacer(i, async () => {
    await json(await fetch(`/api/admin/contact-messages/${i.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: 'atendido' }) }));
    cambiar(i.key, { estado: 'atendido' });
  }, 'Marcado como atendido.');

  const archivar = (i: ItemBandeja, si: boolean) => void hacer(i, async () => {
    if (i.tipo === 'contacto') {
      await json(await fetch(`/api/admin/contact-messages/${i.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: si ? 'archivado' : 'nuevo' }) }));
    } else {
      await json(await fetch(`/api/admin/questions/${i.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: si ? 0 : 1 }) }));
    }
    cambiar(i.key, { estado: si ? 'archivado' : i.respuesta ? 'atendido' : 'pendiente', ...(si && i.tipo === 'pregunta' ? { publicada: false } : {}) });
  }, si ? 'Archivado.' : 'Restaurado.');

  const publicarPregunta = (i: ItemBandeja, si: boolean) => void hacer(i, async () => {
    await json(await fetch(`/api/admin/questions/${i.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ featured: si ? 1 : 0 }) }));
    cambiar(i.key, { publicada: si });
  }, si ? 'Publicada en Preguntas frecuentes.' : 'Quitada de Preguntas frecuentes.');

  const despublicarContacto = (i: ItemBandeja) => void hacer(i, async () => {
    await json(await fetch(`/api/admin/bandeja/contacto/${i.id}/publicar`, { method: 'DELETE' }));
    cambiar(i.key, { publicada: false });
  }, 'Quitada de Preguntas frecuentes.');

  async function eliminar(i: ItemBandeja) {
    if (!(await confirmar({ titulo: '¿Eliminar este mensaje?', mensaje: 'Se borra con su respuesta y no se puede deshacer.', confirmar: 'Eliminar', peligro: true }))) return;
    void hacer(i, async () => {
      const url = i.tipo === 'contacto' ? `/api/admin/contact-messages/${i.id}` : `/api/admin/questions/${i.id}`;
      await json(await fetch(url, { method: 'DELETE' }));
      setItems((l) => l.filter((x) => x.key !== i.key));
    }, 'Eliminado.');
  }

  return (
    <div>
      <PageHeader
        eyebrow={['1 · Recibir', 'Comunicaciones']}
        title="Mensajes"
        subtitle="Las dudas de los clientes: lo que escriben por Contacto, lo que preguntan en Preguntas frecuentes o en un producto, y lo que capturas tú cuando llega por correo o WhatsApp. Contesta aquí (le llega por correo) y publica en Preguntas frecuentes lo que le sirva a todos."
        actions={<>{extra}<Btn variant="primary" icon="ph-plus" onClick={() => setNueva(true)}>Agregar pregunta</Btn></>}
      />

      <Stats>
        <Stat label="Por responder" icon="ph-envelope-simple" tone={cuenta.pendiente > 0 ? 'warn' : 'muted'} value={cuenta.pendiente} valueTone={cuenta.pendiente > 0 ? 'warn' : undefined} />
        <Stat label="Respondidos" icon="ph-check-circle" tone="ok" value={cuenta.atendido} />
        <Stat label="En Preguntas frecuentes" icon="ph-star" tone="accent" value={cuenta.publicadas} />
      </Stats>

      <Toolbar end={`${filtrados.length} de ${items.length}`}>
        <SearchBox value={q} onChange={(e) => { setQ(e.target.value); setVisibles(POR_PAGINA); }} placeholder="Buscar por nombre, correo o texto…" aria-label="Buscar mensaje" />
        <Segmented<typeof estado>
          ariaLabel="Filtrar por estado"
          value={estado}
          onChange={(v) => { setEstado(v); setVisibles(POR_PAGINA); }}
          items={[
            { key: 'pendiente', label: 'Por responder', count: cuenta.pendiente },
            { key: 'atendido', label: 'Respondidos', count: cuenta.atendido },
            { key: 'archivado', label: 'Archivados', count: cuenta.archivado },
            { key: 'todos', label: 'Todos', count: items.length },
          ]}
        />
        <AdminSelect
          size="sm"
          className="w-auto min-w-[190px]"
          ariaLabel="Filtrar por origen"
          value={origen || 'todos'}
          onChange={(v) => { setOrigen(v === 'todos' ? '' : v); setVisibles(POR_PAGINA); }}
          options={[
            { value: 'todos', label: 'Todos los orígenes' },
            { value: 'contacto', label: 'Contacto' },
            { value: 'sitio', label: 'Preguntas frecuentes' },
            { value: 'producto', label: 'Productos' },
            { value: 'capturada', label: 'Capturadas en el panel' },
          ]}
        />
      </Toolbar>

      <Panel flush clip>
        {mostrados.length === 0 ? (
          <EmptyState
            icon="ph-chat-centered-text"
            title={estado === 'pendiente' && !q && !origen ? 'No hay mensajes por responder. Todo al día.' : 'No hay mensajes en esta vista.'}
          />
        ) : mostrados.map((i) => {
          const busy = ocupado === i.key;
          const editar = editando[i.key] || !i.respuesta;
          return (
            <article key={i.key} className="adm-trow" style={{ display: 'grid', gap: 12, paddingTop: 16, paddingBottom: 16, opacity: i.estado === 'archivado' ? 0.65 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: '1 1 380px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <Chip>{origenDe(i)}</Chip>
                    {i.estado === 'pendiente' ? <StatusText tone="warn">Por responder</StatusText> : null}
                    {i.estado === 'atendido' && !i.respuesta ? <StatusText tone="ok">Atendido{i.atendidoPor ? ` por ${i.atendidoPor}` : ''}</StatusText> : null}
                    {i.publicada ? <Chip tone="accent"><i className="ph-bold ph-star" aria-hidden />En Preguntas frecuentes</Chip> : null}
                    {i.estado === 'archivado' ? <Chip tone="muted">Archivado</Chip> : null}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--adm-muted)', overflowWrap: 'anywhere' }}>
                    <strong style={{ color: 'var(--adm-text-2)', fontWeight: 600 }}>{i.nombre ?? 'Sin nombre'}</strong>
                    {i.empresa ? ` · ${i.empresa}` : ''}{i.correo ? ` · ${i.correo}` : ''}{i.telefono ? ` · ${i.telefono}` : ''} · {fecha(i.fecha)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <IconBtn icon={i.estado === 'archivado' ? 'ph-arrow-counter-clockwise' : 'ph-archive'} label={i.estado === 'archivado' ? 'Restaurar' : 'Archivar'} onClick={() => archivar(i, i.estado !== 'archivado')} disabled={busy} />
                  <IconBtn icon="ph-trash" label="Eliminar" danger onClick={() => void eliminar(i)} disabled={busy} />
                </div>
              </div>

              <p style={{ margin: 0, fontSize: 14.5, color: 'var(--adm-text)', lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontWeight: i.tipo === 'pregunta' ? 600 : 400 }}>{i.texto}</p>

              {i.respuesta && !editar ? (
                <div style={{ display: 'flex', gap: 10, borderTop: '1px solid var(--adm-border)', paddingTop: 12 }}>
                  <span style={{ color: 'var(--adm-ok)', fontWeight: 600, flexShrink: 0 }}>R:</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--adm-text-2)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{i.respuesta}</p>
                    {i.faq && i.publicada ? (
                      <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--adm-muted)' }}>En el sitio se ve como: <em>“{i.faq.pregunta}”</em></p>
                    ) : null}
                    <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                      {/* La de Contacto ya se mandó por correo: editarla aquí no la reenvía. */}
                      {i.tipo === 'pregunta' ? (
                        <Btn size="sm" variant="ghost" icon="ph-pencil-simple" onClick={() => { setBorrador((b) => ({ ...b, [i.key]: i.respuesta ?? '' })); setEditando((e) => ({ ...e, [i.key]: true })); }} disabled={busy}>
                          Editar respuesta
                        </Btn>
                      ) : null}
                      {i.tipo === 'pregunta' ? (
                        <Btn size="sm" icon="ph-star" onClick={() => publicarPregunta(i, !i.publicada)} disabled={busy || i.estado === 'archivado'}>
                          {i.publicada ? 'Quitar de Preguntas frecuentes' : 'Publicar en Preguntas frecuentes'}
                        </Btn>
                      ) : i.publicada ? (
                        <>
                          <Btn size="sm" icon="ph-pencil-simple" onClick={() => setPublicando(i)} disabled={busy}>Editar cómo se publica</Btn>
                          <Btn size="sm" variant="ghost" icon="ph-star" onClick={() => despublicarContacto(i)} disabled={busy}>Quitar de Preguntas frecuentes</Btn>
                        </>
                      ) : (
                        <Btn size="sm" icon="ph-star" onClick={() => setPublicando(i)} disabled={busy || i.estado === 'archivado'}>Publicar en Preguntas frecuentes</Btn>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {editar && i.estado !== 'archivado' ? (
                <div style={{ display: 'grid', gap: 8, borderTop: '1px solid var(--adm-border)', paddingTop: 12 }}>
                  <textarea
                    className="adm-textarea"
                    rows={3}
                    value={borrador[i.key] ?? ''}
                    onChange={(e) => setBorrador((b) => ({ ...b, [i.key]: e.target.value }))}
                    placeholder="Escribe tu respuesta…"
                    aria-label={`Respuesta a ${i.nombre ?? 'este mensaje'}`}
                  />
                  {i.correo && !i.respuesta ? <span style={{ fontSize: 12.5, color: 'var(--adm-muted)' }}>Al responder le llega por correo a {i.correo}.</span> : null}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Btn size="sm" variant="primary" icon="ph-paper-plane-tilt" onClick={() => responder(i)} disabled={busy}>
                      {busy ? 'Guardando…' : i.respuesta ? 'Guardar respuesta' : 'Responder'}
                    </Btn>
                    {i.respuesta ? (
                      <Btn size="sm" variant="ghost" onClick={() => setEditando((e) => ({ ...e, [i.key]: false }))} disabled={busy}>Cancelar</Btn>
                    ) : null}
                    {/* Si ya se resolvió por teléfono o WhatsApp, no hace falta escribir nada. */}
                    {i.tipo === 'contacto' && i.estado === 'pendiente' ? (
                      <Btn size="sm" variant="ghost" icon="ph-check" onClick={() => marcarAtendido(i)} disabled={busy}>Ya lo atendí por otro medio</Btn>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </Panel>

      {filtrados.length > visibles ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
          <Btn onClick={() => setVisibles((v) => v + POR_PAGINA)}>Ver {Math.min(POR_PAGINA, filtrados.length - visibles)} más</Btn>
        </div>
      ) : null}

      <NuevaPregunta
        abierto={nueva}
        onCerrar={() => setNueva(false)}
        onCreada={(item) => { setItems((l) => [item, ...l]); setEstado(item.estado === 'pendiente' ? 'pendiente' : 'atendido'); setToast({ ok: true, text: item.publicada ? 'Pregunta agregada y publicada.' : 'Pregunta agregada.' }); }}
      />
      {publicando ? (
        <PublicarContacto
          item={publicando}
          onCerrar={() => setPublicando(null)}
          onListo={(faq) => { cambiar(publicando.key, { publicada: true, faq }); setPublicando(null); setToast({ ok: true, text: 'Publicada en Preguntas frecuentes.' }); }}
        />
      ) : null}

      {toast ? <Toast kind={toast.ok ? 'ok' : 'bad'}>{toast.text}</Toast> : null}
    </div>
  );
}

const etiqueta: React.CSSProperties = { display: 'grid', gap: 6, fontSize: 13, color: 'var(--adm-text-2)', fontWeight: 500 };
const opcional = <span style={{ fontWeight: 400, color: 'var(--adm-muted)' }}>(opcional)</span>;

/**
 * Publicar un mensaje de Contacto en Preguntas frecuentes. Se escribe de nuevo
 * como pregunta general: el mensaje original suele traer el nombre de la
 * persona, su obra o su teléfono, y eso no va en el sitio.
 */
function PublicarContacto({ item, onCerrar, onListo }: { item: ItemBandeja; onCerrar: () => void; onListo: (faq: { id: number; pregunta: string; respuesta: string }) => void }) {
  const [pregunta, setPregunta] = useState(item.faq?.pregunta ?? item.texto.slice(0, 500));
  const [respuesta, setRespuesta] = useState(item.faq?.respuesta ?? item.respuesta ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function guardar() {
    setGuardando(true); setError(null);
    try {
      await json(await fetch(`/api/admin/bandeja/contacto/${item.id}/publicar`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pregunta, respuesta }) }));
      onListo({ id: item.faq?.id ?? 0, pregunta: pregunta.trim(), respuesta: respuesta.trim() });
    } catch (e) { setError((e as Error).message); } finally { setGuardando(false); }
  }
  return (
    <Modal
      abierto
      titulo="Publicar en Preguntas frecuentes"
      subtitulo="Escríbela como pregunta general: sin el nombre, la obra ni los datos de quien la mandó."
      onCerrar={onCerrar}
      ancho={620}
      pie={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
          <Btn variant="ghost" onClick={onCerrar}>Cancelar</Btn>
          <Btn variant="primary" icon="ph-star" onClick={() => void guardar()} disabled={guardando || pregunta.trim().length < 5 || respuesta.trim().length < 2}>
            {guardando ? 'Publicando…' : 'Publicar'}
          </Btn>
        </div>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <label style={etiqueta}>Pregunta, como se verá en el sitio
          <textarea id="pc-pregunta" className="adm-textarea" rows={2} value={pregunta} onChange={(e) => setPregunta(e.target.value)} />
        </label>
        <label style={etiqueta}>Respuesta
          <textarea id="pc-respuesta" className="adm-textarea" rows={4} value={respuesta} onChange={(e) => setRespuesta(e.target.value)} />
        </label>
        {error ? <p role="alert" style={{ margin: 0, color: 'var(--adm-bad)', fontSize: 13 }}>{error}</p> : null}
      </div>
    </Modal>
  );
}

/**
 * Capturar una pregunta que llegó por fuera del sitio (correo, WhatsApp,
 * teléfono). El sistema manda correo pero no lo lee: lo que llega por ahí se
 * pasa aquí para responderlo y, si vale para todos, publicarlo.
 */
function NuevaPregunta({ abierto, onCerrar, onCreada }: { abierto: boolean; onCerrar: () => void; onCreada: (i: ItemBandeja) => void }) {
  const [pregunta, setPregunta] = useState('');
  const [origen, setOrigen] = useState('correo');
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [respuesta, setRespuesta] = useState('');
  const [publicar, setPublicar] = useState(false);
  const [avisar, setAvisar] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conRespuesta = respuesta.trim().length > 0;

  function limpiar() { setPregunta(''); setOrigen('correo'); setNombre(''); setCorreo(''); setRespuesta(''); setPublicar(false); setAvisar(true); setError(null); }

  async function guardar() {
    setGuardando(true); setError(null);
    try {
      const d = await json(await fetch('/api/admin/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: pregunta, source: origen, askerName: nombre, askerEmail: correo, answer: respuesta,
          featured: conRespuesta && publicar ? 1 : 0, notify: conRespuesta && !!correo.trim() && avisar,
        }),
      }));
      onCreada({
        key: `p-${d.id}`, tipo: 'pregunta', id: d.id, origen, nombre: nombre.trim() || null, correo: correo.trim().toLowerCase() || null,
        telefono: null, empresa: null, motivo: null, producto: null, texto: pregunta.trim(), respuesta: conRespuesta ? respuesta.trim() : null,
        estado: conRespuesta ? 'atendido' : 'pendiente', atendidoPor: null, atendidoEl: null, publicada: conRespuesta && publicar, faq: null,
        fecha: new Date().toISOString(),
      });
      limpiar(); onCerrar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  const casilla: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5, color: 'var(--adm-text-2)' };
  return (
    <Modal
      abierto={abierto}
      titulo="Agregar pregunta"
      subtitulo="La que llegó por correo, WhatsApp o teléfono."
      onCerrar={onCerrar}
      ancho={620}
      pie={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
          <Btn variant="ghost" onClick={onCerrar}>Cancelar</Btn>
          <Btn variant="primary" icon="ph-check" onClick={() => void guardar()} disabled={guardando || pregunta.trim().length < 5}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Btn>
        </div>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <label style={etiqueta}>Pregunta
          <textarea id="np-pregunta" className="adm-textarea" rows={3} value={pregunta} onChange={(e) => setPregunta(e.target.value)} placeholder="¿Llegan con la excavadora a Santiago?" />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          {/* div y no label: el desplegable de Radix es un botón y la etiqueta lo abriría dos veces (ver AdminSelect). */}
          <div style={etiqueta}>
            <span id="np-origen-l">¿Por dónde llegó?</span>
            <AdminSelect
              id="np-origen"
              ariaLabel="¿Por dónde llegó?"
              value={origen}
              onChange={setOrigen}
              options={[
                { value: 'correo', label: 'Correo' },
                { value: 'whatsapp', label: 'WhatsApp' },
                { value: 'telefono', label: 'Teléfono' },
                { value: 'otro', label: 'Otro' },
              ]}
            />
          </div>
          <label style={etiqueta}>Nombre {opcional}
            <input id="np-nombre" className="adm-input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </label>
          <label style={etiqueta}>Correo {opcional}
            <input id="np-correo" className="adm-input" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
          </label>
        </div>
        <label style={etiqueta}>Respuesta <span style={{ fontWeight: 400, color: 'var(--adm-muted)' }}>(si ya la tienes)</span>
          <textarea id="np-respuesta" className="adm-textarea" rows={3} value={respuesta} onChange={(e) => setRespuesta(e.target.value)} />
        </label>
        <label style={{ ...casilla, opacity: conRespuesta ? 1 : 0.5 }}>
          <input id="np-publicar" type="checkbox" checked={conRespuesta && publicar} disabled={!conRespuesta} onChange={(e) => setPublicar(e.target.checked)} />
          Publicar en Preguntas frecuentes
        </label>
        <label style={{ ...casilla, opacity: conRespuesta && correo.trim() ? 1 : 0.5 }}>
          <input id="np-avisar" type="checkbox" checked={conRespuesta && !!correo.trim() && avisar} disabled={!conRespuesta || !correo.trim()} onChange={(e) => setAvisar(e.target.checked)} />
          Mandarle la respuesta por correo
        </label>
        {error ? <p role="alert" style={{ margin: 0, color: 'var(--adm-bad)', fontSize: 13 }}>{error}</p> : null}
      </div>
    </Modal>
  );
}
