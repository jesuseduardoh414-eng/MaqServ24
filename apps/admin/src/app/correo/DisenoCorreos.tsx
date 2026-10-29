'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { mostrarResultado } from '@maqserv/ui';
import { Modal } from '@/components/Modal';
import { Btn, Chip, FormField, Note, Panel, Segmented, Switch } from '@/components/ui';
import { confirmar } from '@/components/Dialogos';

/**
 * CÓMO LLEGAN TUS CORREOS (2026-10-28, revisión de Correo).
 *
 * "Quiero editar todo, de todos los correos que se mandan." Dos cosas, en
 * dos pestañas: el DISEÑO común (logo, colores, pie, firma: en todos a la
 * vez) y los TEXTOS de cada correo, campo por campo, con etiquetas
 * `{nombre}`, `{folio}`… donde van los datos vivos. Al lado, la vista previa
 * armada por la misma plantilla que manda el sistema, con datos de ejemplo.
 *
 * Primera entrega: los 10 correos que más se leen. El remitente no se edita
 * aquí (decisión del dueño: "ya en un futuro").
 */

interface Hueco { clave: string; etiqueta: string; fabrica: string; texto: string; variables: Record<string, string>; obligatorias: string[]; largo: boolean }
interface CorreoEditable { kind: string; nombre: string; para: 'cliente' | 'aliado' | 'sitio' | 'interno'; cuando: string; huecos: Hueco[]; editado: boolean }
export interface Diseno { logo: string; nombre: string; color: string; colorTexto: string; cabecera: string; pie: string; firma: string }
interface Datos { correos: CorreoEditable[]; diseno: Diseno; fabrica: Diseno; logoUrl?: string | null }

const PARA: Record<CorreoEditable['para'], string> = { cliente: 'Al cliente', aliado: 'Al aliado', sitio: 'A quien se registra', interno: 'A MAQSER24' };

export function DisenoCorreos() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [pestana, setPestana] = useState<'textos' | 'diseno'>('textos');
  const [abierto, setAbierto] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch('/api/admin/mail/textos', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo) setDatos(d); })
      .catch(() => { if (vivo) setDatos(null); });
    return () => { vivo = false; };
  }, []);

  if (!datos) return <Panel title="Cómo llegan tus correos" icon="ph-envelope-simple"><p className="adm-help" style={{ margin: 0 }}>Cargando…</p></Panel>;

  const grupos = (['cliente', 'aliado', 'sitio', 'interno'] as const).map((p) => ({ para: p, lista: datos.correos.filter((c) => c.para === p) })).filter((g) => g.lista.length);
  const editando = datos.correos.find((c) => c.kind === abierto) ?? null;

  return (
    <Panel
      className="ce-panel"
      title="Cómo llegan tus correos"
      icon="ph-envelope-simple"
      desc="El diseño es el mismo para todos; el texto se cambia correo por correo. Lo que guardes aplica al siguiente que salga."
      action={<Segmented<'textos' | 'diseno'> ariaLabel="Qué editar" value={pestana} onChange={setPestana} items={[{ key: 'textos', label: 'Textos' }, { key: 'diseno', label: 'Diseño' }]} />}
    >
      <style>{`
        @media (max-width: 760px) { .ce-panel .adm-panel-head { flex-wrap: wrap; } .ce-panel .adm-seg { flex-wrap: nowrap; } }
      `}</style>
      {pestana === 'diseno' ? (
        <EditorDiseno diseno={datos.diseno} fabrica={datos.fabrica} logoInicial={datos.logoUrl ?? null} kindPrevia={datos.correos[0]?.kind ?? 'quote_answered'} onGuardado={(d) => setDatos({ ...datos, diseno: d })} />
      ) : (
        <>
          <style>{`
            .ce-grupo { margin-top: 14px; }
            .ce-grupo:first-child { margin-top: 0; }
            .ce-grupo-t { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--adm-faint); margin: 0 0 6px; }
            .ce-fila { display: grid; grid-template-columns: 250px minmax(0, 1fr) auto 14px; align-items: center; gap: 14px; width: 100%; padding: 9px 10px; border: 0; border-radius: 8px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
            .ce-fila:hover { background: var(--adm-raised); }
            .ce-fila .n { min-width: 0; font-size: 13.5px; font-weight: 500; color: var(--adm-text); }
            .ce-fila .c { font-size: 12.5px; color: var(--adm-muted); min-width: 0; }
            @media (max-width: 760px) { .ce-fila { grid-template-columns: minmax(0, 1fr) auto 14px; } .ce-fila .c { display: none; } }
          `}</style>
          <p className="adm-help" style={{ margin: '0 0 12px' }}>
            Primera entrega: los {datos.correos.length} correos que más se leen. Los demás siguen con su texto de fábrica por ahora.
          </p>
          {grupos.map((g) => (
            <div key={g.para} className="ce-grupo">
              <p className="ce-grupo-t">{PARA[g.para]}</p>
              {g.lista.map((c) => (
                <button key={c.kind} type="button" className="ce-fila" onClick={() => setAbierto(c.kind)}>
                  <span className="n">{c.nombre}</span>
                  <span className="c">{c.cuando}</span>
                  {c.editado ? <Chip tone="info">Editado</Chip> : <Chip tone="muted">De fábrica</Chip>}
                  <i className="ph ph-caret-right" aria-hidden style={{ color: 'var(--adm-faint)' }} />
                </button>
              ))}
            </div>
          ))}
        </>
      )}

      {editando ? (
        <EditorCorreo
          correo={editando}
          diseno={datos.diseno}
          onCerrar={() => setAbierto(null)}
          onGuardado={(huecos) => {
            setDatos({ ...datos, correos: datos.correos.map((c) => (c.kind === editando.kind ? { ...c, huecos, editado: huecos.some((h) => h.texto.trim()) } : c)) });
            setAbierto(null);
          }}
        />
      ) : null}
    </Panel>
  );
}

// ── Vista previa ──────────────────────────────────────────────────────────

/** El correo armado por el servidor, en un iframe aislado (es HTML de correo, con sus estilos en línea). */
const ANCHO_CORREO = 624; // 600 del correo + 12 de margen por lado
const ALTO_PREVIA = 560;

function Previa({ kind, textos, diseno }: { kind: string; textos: Record<string, string>; diseno?: Partial<Diseno> }) {
  const [html, setHtml] = useState<{ subject: string; html: string } | null>(null);
  const marco = useRef<HTMLDivElement | null>(null);
  const [escala, setEscala] = useState(1);
  useEffect(() => {
    const el = marco.current;
    if (!el) return;
    const medir = () => setEscala(Math.min(1, el.clientWidth / ANCHO_CORREO));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cuerpo = useMemo(() => JSON.stringify({ textos, diseno }), [textos, diseno]);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    // Mientras se escribe: espera 350 ms sin teclas antes de pedirla.
    timer.current = setTimeout(() => {
      fetch(`/api/admin/mail/previa/${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo })
        .then(async (r) => { const d = await r.json().catch(() => null); if (!r.ok) throw new Error(d?.message ?? 'No se pudo armar la vista previa.'); return d; })
        .then((d) => { setHtml(d); setError(null); })
        .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo armar la vista previa.'));
    }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [kind, cuerpo]);
  return (
    <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
      <div style={{ fontSize: 12.5, color: 'var(--adm-muted)' }}>
        <span style={{ fontWeight: 600, color: 'var(--adm-text-2)' }}>Asunto:</span> {html?.subject ?? '…'}
      </div>
      {error ? <Note tone="bad">{error}</Note> : null}
      <div ref={marco} style={{ height: ALTO_PREVIA, overflow: 'hidden', border: '1px solid var(--adm-border)', borderRadius: 10, background: '#F4F7FA' }}>
        <iframe
          title="Vista previa del correo"
          srcDoc={html?.html ?? '<p style="font-family:sans-serif;color:#888;padding:24px">Armando la vista previa…</p>'}
          sandbox=""
          style={{ width: ANCHO_CORREO, height: ALTO_PREVIA / escala, border: 0, display: 'block', transform: `scale(${escala})`, transformOrigin: 'top left', background: '#F4F7FA' }}
        />
      </div>
    </div>
  );
}

// ── Textos de un correo ───────────────────────────────────────────────────

function EditorCorreo({ correo, diseno, onCerrar, onGuardado }: {
  correo: CorreoEditable;
  diseno: Diseno;
  onCerrar: () => void;
  onGuardado: (huecos: Hueco[]) => void;
}) {
  const [textos, setTextos] = useState<Record<string, string>>(() => Object.fromEntries(correo.huecos.map((h) => [h.clave, h.texto])));
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prueba, setPrueba] = useState('');
  const cambios = correo.huecos.some((h) => (textos[h.clave] ?? '') !== h.texto);

  /** Lo que falta en un hueco, para avisar antes de guardar. */
  const problema = (h: Hueco): string | null => {
    const t = (textos[h.clave] ?? '').trim();
    if (!t) return null;
    for (const v of h.obligatorias) if (!t.includes(`{${v}}`)) return `Tiene que llevar {${v}}.`;
    const usadas = [...t.matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1]);
    const ajena = usadas.find((u) => !(u in h.variables));
    return ajena ? `{${ajena}} no existe aquí.` : null;
  };
  const conProblema = correo.huecos.some((h) => problema(h));

  async function guardar() {
    setOcupado(true); setError(null);
    const r = await fetch(`/api/admin/mail/textos/${correo.kind}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(textos) });
    const d = await r.json().catch(() => null);
    setOcupado(false);
    if (!r.ok) { setError(typeof d?.message === 'string' ? d.message : 'No se pudo guardar.'); return; }
    mostrarResultado(`«${correo.nombre}» guardado. El siguiente que salga ya lleva este texto.`, 'ok');
    onGuardado(correo.huecos.map((h) => ({ ...h, texto: (textos[h.clave] ?? '').trim() })));
  }
  async function volverAFabrica() {
    if (!(await confirmar({ titulo: `¿Volver al texto original de «${correo.nombre}»?`, mensaje: 'Se borran tus cambios en este correo. Los demás no se tocan.', confirmar: 'Volver al original' }))) return;
    setTextos(Object.fromEntries(correo.huecos.map((h) => [h.clave, ''])));
  }
  async function mandarPrueba() {
    if (!prueba.trim()) return;
    setOcupado(true);
    const r = await fetch(`/api/admin/mail/textos/${correo.kind}/prueba`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: prueba.trim() }) });
    const d = await r.json().catch(() => null);
    setOcupado(false);
    mostrarResultado(d?.mensaje ?? 'No se pudo mandar.', r.ok ? 'ok' : 'bad');
  }

  return (
    <Modal abierto titulo={correo.nombre} subtitulo={`${PARA[correo.para]} · ${correo.cuando}`} onCerrar={onCerrar} ancho={1180}
      pie={
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>
          <span style={{ marginRight: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="adm-input" style={{ width: 230, height: 34 }} type="email" value={prueba} onChange={(e) => setPrueba(e.target.value)} placeholder="tu@correo.com" aria-label="Mandar una prueba a" />
            <Btn size="sm" variant="ghost" icon="ph-paper-plane-tilt" onClick={() => void mandarPrueba()} disabled={ocupado || !prueba.trim()} title="Con lo guardado, no con lo que estás escribiendo">Mandarme una prueba</Btn>
          </span>
          <Btn variant="ghost" onClick={() => void volverAFabrica()} disabled={ocupado}>Volver al texto original</Btn>
          <Btn variant="ghost" onClick={onCerrar}>Cancelar</Btn>
          <Btn variant="primary" onClick={() => void guardar()} disabled={ocupado || !cambios || conProblema}>{ocupado ? 'Guardando…' : 'Guardar'}</Btn>
        </div>
      }
    >
      <style>{`
        .ce-dos { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 22px; align-items: start; }
        .ce-vars { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
        .ce-var { font-family: var(--font-mono, monospace); font-size: 11.5px; padding: 1px 7px; border-radius: 999px; background: var(--adm-raised); color: var(--adm-text-2); border: 1px solid var(--adm-border); cursor: pointer; }
        .ce-var[data-ob="true"] { border-color: var(--adm-warn); color: var(--adm-warn); }
        .ce-var:hover { border-color: var(--adm-text-2); color: var(--adm-text); }
        .ce-previa { position: sticky; top: 0; }
        @media (max-width: 980px) { .ce-dos { grid-template-columns: minmax(0, 1fr); } .ce-previa { position: static; } }
      `}</style>
      {error ? <div role="alert" style={{ marginBottom: 14 }}><Note tone="bad">{error}</Note></div> : null}
      <div className="ce-dos">
        <div style={{ display: 'grid', gap: 14 }}>
          <p className="adm-help" style={{ margin: 0 }}>
            Escribe lo que quieres que diga. Donde va un dato del sistema, pon su etiqueta entre llaves (toca una para insertarla). Vacío = el texto original.
          </p>
          {correo.huecos.map((h) => {
            const p = problema(h);
            const vars = Object.entries(h.variables);
            return (
              <FormField key={h.clave} label={h.etiqueta} help={p ? <span style={{ color: 'var(--adm-bad)' }}>{p}</span> : undefined}>
                {h.largo ? (
                  <textarea className="adm-textarea" rows={3} value={textos[h.clave] ?? ''} onChange={(e) => setTextos((t) => ({ ...t, [h.clave]: e.target.value }))} placeholder={h.fabrica} data-hueco={h.clave} />
                ) : (
                  <input className="adm-input" value={textos[h.clave] ?? ''} onChange={(e) => setTextos((t) => ({ ...t, [h.clave]: e.target.value }))} placeholder={h.fabrica} data-hueco={h.clave} />
                )}
                {vars.length ? (
                  <div className="ce-vars">
                    {vars.map(([k, que]) => (
                      <button
                        key={k}
                        type="button"
                        className="ce-var"
                        data-ob={h.obligatorias.includes(k)}
                        title={`${que}${h.obligatorias.includes(k) ? ' · obligatoria' : ''}`}
                        onClick={() => {
                          const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-hueco="${h.clave}"]`);
                          const actual = textos[h.clave] ?? '';
                          const pos = el?.selectionStart ?? actual.length;
                          const nuevo = `${actual.slice(0, pos)}{${k}}${actual.slice(pos)}`;
                          setTextos((t) => ({ ...t, [h.clave]: nuevo }));
                          el?.focus();
                        }}
                      >
                        {`{${k}}`}
                      </button>
                    ))}
                  </div>
                ) : null}
              </FormField>
            );
          })}
        </div>
        <div className="ce-previa">
          <Previa kind={correo.kind} textos={textos} diseno={diseno} />
        </div>
      </div>
    </Modal>
  );
}

// ── Diseño común ──────────────────────────────────────────────────────────

function EditorDiseno({ diseno: inicial, fabrica, logoInicial, kindPrevia, onGuardado }: { diseno: Diseno; fabrica: Diseno; logoInicial: string | null; kindPrevia: string; onGuardado: (d: Diseno) => void }) {
  const [d, setD] = useState<Diseno>(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(logoInicial);
  const cambios = JSON.stringify(d) !== JSON.stringify(inicial);
  const poner = (patch: Partial<Diseno>) => setD((x) => ({ ...x, ...patch }));

  async function subirLogo(archivo: File) {
    setOcupado(true); setError(null);
    const fd = new FormData();
    fd.append('logo', archivo);
    const r = await fetch('/api/admin/mail/diseno/logo', { method: 'POST', body: fd });
    const res = await r.json().catch(() => null);
    setOcupado(false);
    if (!r.ok) { setError(typeof res?.message === 'string' ? res.message : 'No se pudo subir el logo.'); return; }
    poner({ logo: res.ruta });
    setLogoUrl(res.url);
  }
  async function guardar() {
    setOcupado(true); setError(null);
    const r = await fetch('/api/admin/mail/diseno', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
    const res = await r.json().catch(() => null);
    setOcupado(false);
    if (!r.ok) { setError(typeof res?.message === 'string' ? res.message : 'No se pudo guardar.'); return; }
    mostrarResultado('Diseño guardado: aplica a todos los correos que salgan desde ahora.', 'ok');
    onGuardado(res.diseno);
  }

  return (
    <>
      <style>{`
        .cd-dos { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 22px; align-items: start; }
        .cd-color { display: flex; align-items: center; gap: 10px; }
        .cd-color input[type="color"] { width: 44px; height: 36px; padding: 2px; border: 1px solid var(--adm-border); border-radius: 8px; background: var(--adm-raised); cursor: pointer; }
        .cd-logo { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .cd-logo img { height: 36px; width: auto; max-width: 220px; padding: 6px 10px; border-radius: 6px; }
        @media (max-width: 980px) { .cd-dos { grid-template-columns: minmax(0, 1fr); } }
      `}</style>
      {error ? <div role="alert" style={{ marginBottom: 14 }}><Note tone="bad">{error}</Note></div> : null}
      <div className="cd-dos">
        <div style={{ display: 'grid', gap: 14 }}>
          <FormField label="Logo" help="De fábrica va el logo del sitio. PNG o JPG, hasta 2 MB; se ve a 40 px de alto. Sin logo, va el nombre en texto.">
            <div className="cd-logo">
              {d.logo ? <img src={logoUrl ?? (/^https?:\/\//i.test(d.logo) ? d.logo : `/media/${d.logo}`)} alt="" style={{ background: d.cabecera || '#fff' }} /> : <span className="adm-help">Sin logo</span>}
              <label className="adm-btn adm-btn-secondary adm-btn-sm" style={{ cursor: 'pointer' }}>
                <i className="ph ph-upload-simple" aria-hidden />{d.logo ? 'Cambiar' : 'Subir logo'}
                <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void subirLogo(f); e.target.value = ''; }} />
              </label>
              {d.logo ? <Btn size="sm" variant="ghost" onClick={() => { poner({ logo: '' }); setLogoUrl(null); }}>Quitar</Btn> : null}
            </div>
          </FormField>
          <FormField label="Nombre (si no hay logo)">
            <input className="adm-input" value={d.nombre} maxLength={60} onChange={(e) => poner({ nombre: e.target.value })} />
          </FormField>
          <FormField label="Fondo de la cabecera" help="Como el sitio: el logo sobre el negro tecnológico. Apagado, la cabecera es blanca con la franja de color arriba.">
            <div className="cd-color">
              <Switch on={Boolean(d.cabecera)} onClick={() => poner({ cabecera: d.cabecera ? '' : (fabrica.cabecera || '#07090C') })} ariaLabel="Cabecera con fondo" />
              {d.cabecera ? (
                <>
                  <input type="color" value={d.cabecera} onChange={(e) => poner({ cabecera: e.target.value })} aria-label="Color del fondo de la cabecera" />
                  <input className="adm-input adm-mono" value={d.cabecera} maxLength={7} onChange={(e) => poner({ cabecera: e.target.value })} />
                </>
              ) : <span className="adm-help">Cabecera blanca</span>}
            </div>
          </FormField>
          <div className="adm-form-grid">
            <FormField label="Color principal" help="La franja de arriba y los botones.">
              <div className="cd-color">
                <input type="color" value={d.color} onChange={(e) => poner({ color: e.target.value })} aria-label="Color principal" />
                <input className="adm-input adm-mono" value={d.color} maxLength={7} onChange={(e) => poner({ color: e.target.value })} />
              </div>
            </FormField>
            <FormField label="Color de los títulos">
              <div className="cd-color">
                <input type="color" value={d.colorTexto} onChange={(e) => poner({ colorTexto: e.target.value })} aria-label="Color de los títulos" />
                <input className="adm-input adm-mono" value={d.colorTexto} maxLength={7} onChange={(e) => poner({ colorTexto: e.target.value })} />
              </div>
            </FormField>
          </div>
          <FormField label="Pie de página" help="Abajo de todos los correos que no traen uno propio.">
            <textarea className="adm-textarea" rows={2} value={d.pie} maxLength={400} onChange={(e) => poner({ pie: e.target.value })} />
          </FormField>
          <FormField label="Firma" help="Al final del texto, en todos. Vacío = sin firma. Un renglón por línea.">
            <textarea className="adm-textarea" rows={3} value={d.firma} maxLength={600} onChange={(e) => poner({ firma: e.target.value })} placeholder={'Atentamente,\nEl equipo de MAQSER24 · 81 4021 3277'} />
          </FormField>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn variant="primary" onClick={() => void guardar()} disabled={ocupado || !cambios}>{ocupado ? 'Guardando…' : 'Guardar diseño'}</Btn>
            <Btn variant="ghost" onClick={() => { setD(fabrica); setLogoUrl(null); }} disabled={ocupado}>Volver al de fábrica</Btn>
          </div>
        </div>
        <Previa kind={kindPrevia} textos={{}} diseno={d} />
      </div>
    </>
  );
}
