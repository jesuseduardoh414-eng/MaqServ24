'use client';

import { useMemo, useState } from 'react';
import { atributosDe } from '@maqserv/config';
import { ShSelect, ShSelectContent, ShSelectItem, ShSelectTrigger, ShSelectValue } from '@maqserv/ui';
import { Icon } from '@/components/Icon';

/**
 * OFRECER UN EQUIPO, PASO A PASO (2026-09-24).
 *
 * El aliado dice qué tiene y las preguntas cambian según su línea de
 * servicio: a una excavadora se le pregunta capacidad, modelo e implementos;
 * a una pipa, capacidad y si el agua es potable. Son las MISMAS preguntas de
 * la ficha técnica del catálogo (`atributosDe` en @maqserv/config), así que
 * lo que llena aquí es lo que después compara el emparejamiento.
 *
 * Lo que envía llega al expediente del aliado como "por revisar": MAQSER24
 * lo corrige si hace falta y lo publica. No pide precio a propósito: el
 * precio que ve el cliente lo pone MAQSER24.
 */

const card: React.CSSProperties = {
  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg, 14px)',
  background: 'var(--color-surface)', padding: '20px 20px',
};
const campo: React.CSSProperties = {
  border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)',
  borderRadius: 'var(--radius-md, 10px)', padding: '11px 13px', fontSize: 16, fontFamily: 'inherit',
  width: '100%', boxSizing: 'border-box',
};
const btn: React.CSSProperties = {
  border: 'none', background: 'var(--color-primary)', color: 'var(--color-primary-fg)',
  borderRadius: 'var(--radius-button, 10px)', padding: '12px 20px', fontWeight: 700, fontSize: 15,
  cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
};
const btnSec: React.CSSProperties = { ...btn, background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)', fontWeight: 600 };
const etiqueta: React.CSSProperties = { fontSize: 13.5, fontWeight: 600 };
const ayuda: React.CSSProperties = { fontSize: 12.5, color: 'var(--color-text-muted)' };

/** Qué pedir en "qué es" según la línea: el ejemplo tiene que sonarle a su negocio. */
const EJEMPLO: Record<string, { nombre: string; modalidad: 'renta' | 'venta' }> = {
  'maquinaria-pesada': { nombre: 'Excavadora 20 t, retroexcavadora, vibrocompactador…', modalidad: 'renta' },
  'transporte-y-servicios-de-obra': { nombre: 'Pipa de agua 10 m³, volteo 14 m³…', modalidad: 'renta' },
  triturados: { nombre: 'Grava 3/4", arena #4, base hidráulica…', modalidad: 'venta' },
  'materiales-para-construccion': { nombre: 'Block 15×20×40, concreto f’c 250…', modalidad: 'venta' },
  'soluciones-asfalticas': { nombre: 'Carpeta asfáltica en caliente, bacheo…', modalidad: 'venta' },
};

const PASOS = ['Línea', 'Qué es', 'Ficha técnica', 'Dónde está', 'Fotos', 'Enviar'] as const;

export function OfrecerEquipo({
  lineas,
  onCerrar,
  onEnviado,
}: {
  lineas: Array<{ slug: string; label: string }>;
  onCerrar: () => void;
  onEnviado: (nombre: string) => void;
}) {
  const [paso, setPaso] = useState(lineas.length === 1 ? 1 : 0);
  const [linea, setLinea] = useState(lineas.length === 1 ? lineas[0].slug : '');
  const [nombre, setNombre] = useState('');
  const [marca, setMarca] = useState('');
  const [modalidad, setModalidad] = useState<'renta' | 'venta'>(EJEMPLO[lineas[0]?.slug ?? '']?.modalidad ?? 'renta');
  const [atributos, setAtributos] = useState<Record<string, string>>({});
  const [ubicacion, setUbicacion] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fotos, setFotos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preguntas = useMemo(() => atributosDe(linea), [linea]);
  const lineaLabel = lineas.find((l) => l.slug === linea)?.label ?? '';
  const previews = useMemo(() => fotos.map((f) => URL.createObjectURL(f)), [fotos]);

  function elegirLinea(slug: string) {
    setLinea(slug);
    setAtributos({});
    setModalidad(EJEMPLO[slug]?.modalidad ?? 'renta');
  }

  /** Qué falta para pasar de este paso. Null = puede seguir. */
  function falta(): string | null {
    if (paso === 0 && !linea) return 'Elige la línea de servicio.';
    if (paso === 1 && nombre.trim().length < 3) return 'Escribe qué equipo o producto es.';
    if (paso === 4 && fotos.length === 0) return 'Sube al menos una foto: es lo primero que revisa el cliente.';
    return null;
  }

  function avanzar() {
    const f = falta();
    if (f) { setError(f); return; }
    setError(null);
    setPaso((p) => Math.min(PASOS.length - 1, p + 1));
  }

  async function enviar() {
    setEnviando(true); setError(null);
    const fd = new FormData();
    fd.set('categoria', linea);
    fd.set('nombre', nombre.trim());
    if (marca.trim()) fd.set('marca', marca.trim());
    fd.set('modalidad', modalidad);
    if (ubicacion.trim()) fd.set('ubicacion', ubicacion.trim());
    if (descripcion.trim()) fd.set('descripcion', descripcion.trim());
    fd.set('atributos', JSON.stringify(atributos));
    fotos.forEach((f) => fd.append('fotos', f));
    const r = await fetch('/api/proxy/aliado/equipos', { method: 'POST', body: fd });
    setEnviando(false);
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      setError(j?.message ?? 'No se pudo enviar. Intenta otra vez.');
      return;
    }
    onEnviado(nombre.trim());
  }

  const llenos = preguntas.filter((q) => (atributos[q.clave] ?? '').trim()).length;

  return (
    <div style={{ ...card, borderColor: 'var(--color-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <strong style={{ fontSize: 17 }}>Ofrecer un equipo</strong>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex' }}>
          <Icon name="x" size={18} />
        </button>
      </div>

      {/* Pasos: se ve dónde va y lo que falta. */}
      <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 18px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {PASOS.map((t, i) => (
          <li
            key={t}
            style={{
              fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
              color: i === paso ? 'var(--color-primary-fg)' : i < paso ? 'var(--color-success)' : 'var(--color-text-muted)',
              background: i === paso ? 'var(--color-primary)' : 'transparent',
              border: `1px solid ${i === paso ? 'var(--color-primary)' : 'var(--color-border)'}`,
            }}
          >
            {i < paso ? '✓ ' : `${i + 1}. `}{t}
          </li>
        ))}
      </ol>

      <div style={{ display: 'grid', gap: 14 }}>
        {paso === 0 ? (
          <>
            <span style={etiqueta}>¿En qué línea de servicio va?</span>
            <div style={{ display: 'grid', gap: 8 }}>
              {lineas.map((l) => (
                <button
                  key={l.slug}
                  type="button"
                  onClick={() => elegirLinea(l.slug)}
                  style={{ ...btnSec, justifyContent: 'flex-start', borderColor: linea === l.slug ? 'var(--color-primary)' : 'var(--color-border)', background: linea === l.slug ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'transparent' }}
                >
                  {linea === l.slug ? <Icon name="check" size={15} /> : null}{l.label}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {paso === 1 ? (
          <>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={etiqueta}>¿Qué es?</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={EJEMPLO[linea]?.nombre ?? 'Nombre del equipo o producto'} style={campo} />
              <span style={ayuda}>Como lo buscaría un cliente: tipo y tamaño. Ej. "Excavadora 20 t".</span>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={etiqueta}>Marca y modelo <span style={ayuda}>(opcional)</span></span>
              <input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="CAT 320, John Deere 310L…" style={campo} />
            </label>
            <div style={{ display: 'grid', gap: 6 }}>
              <span style={etiqueta}>¿Lo rentas o lo vendes?</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['renta', 'venta'] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setModalidad(m)} style={{ ...btnSec, flex: 1, borderColor: modalidad === m ? 'var(--color-primary)' : 'var(--color-border)', background: modalidad === m ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'transparent' }}>
                    {m === 'renta' ? 'Lo rento' : 'Lo vendo'}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : null}

        {paso === 2 ? (
          preguntas.length === 0 ? (
            <p style={{ margin: 0, ...ayuda, fontSize: 14 }}>Esta línea no tiene ficha técnica. Sigue al siguiente paso.</p>
          ) : (
            <>
              <p style={{ margin: 0, ...ayuda, fontSize: 13.5 }}>
                Con estos datos te proponemos solo en las obras donde tu equipo sirve. Llena lo que sepas: {llenos} de {preguntas.length}.
              </p>
              {preguntas.map((q) => (
                <label key={q.clave} style={{ display: 'grid', gap: 6 }}>
                  <span style={etiqueta}>{q.label}{q.unidad ? ` (${q.unidad})` : ''}</span>
                  {q.tipo === 'opcion' && q.opciones ? (
                    <ShSelect value={atributos[q.clave] ?? ''} onValueChange={(v) => setAtributos((a) => ({ ...a, [q.clave]: v }))}>
                      <ShSelectTrigger aria-label={q.label}><ShSelectValue placeholder="Elige una opción" /></ShSelectTrigger>
                      <ShSelectContent>
                        {q.opciones.map((o) => <ShSelectItem key={o} value={o}>{o}</ShSelectItem>)}
                      </ShSelectContent>
                    </ShSelect>
                  ) : (
                    <input
                      type={q.tipo === 'numero' ? 'number' : 'text'}
                      inputMode={q.tipo === 'numero' ? 'decimal' : undefined}
                      value={atributos[q.clave] ?? ''}
                      onChange={(e) => setAtributos((a) => ({ ...a, [q.clave]: e.target.value }))}
                      style={campo}
                    />
                  )}
                  {q.hint ? <span style={ayuda}>{q.hint}</span> : null}
                </label>
              ))}
            </>
          )
        ) : null}

        {paso === 3 ? (
          <>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={etiqueta}>¿Dónde está?</span>
              <input value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder="Patio en García, banco en Escobedo…" style={campo} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={etiqueta}>Algo más que el cliente deba saber <span style={ayuda}>(opcional)</span></span>
              <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={4} placeholder="Incluye operador y diésel, horario, condiciones…" style={{ ...campo, resize: 'vertical' }} />
            </label>
          </>
        ) : null}

        {paso === 4 ? (
          <>
            <span style={etiqueta}>Fotos <span style={ayuda}>(hasta 6; la primera es la principal)</span></span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFotos(Array.from(e.target.files ?? []).slice(0, 6))}
              style={campo}
            />
            {previews.length ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(86px,1fr))', gap: 8 }}>
                {previews.map((u, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={u} src={u} alt={`Foto ${i + 1}`} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, border: i === 0 ? '2px solid var(--color-primary)' : '1px solid var(--color-border)' }} />
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {paso === 5 ? (
          <div style={{ display: 'grid', gap: 10, fontSize: 14 }}>
            <p style={{ margin: 0, ...ayuda, fontSize: 13.5 }}>Revisa y envía. MAQSER24 lo revisa y, al publicarlo, te avisamos por correo.</p>
            {[
              ['Línea', lineaLabel],
              ['Qué es', nombre],
              ['Marca', marca || '—'],
              ['Modalidad', modalidad === 'renta' ? 'Renta' : 'Venta'],
              ...preguntas.filter((q) => (atributos[q.clave] ?? '').trim()).map((q) => [q.label, `${atributos[q.clave]}${q.unidad ? ` ${q.unidad}` : ''}`]),
              ['Dónde está', ubicacion || '—'],
              ['Fotos', String(fotos.length)],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{k}</span>
                <strong style={{ textAlign: 'right' }}>{v}</strong>
              </div>
            ))}
          </div>
        ) : null}

        {error ? <div role="alert" style={{ fontSize: 13.5, color: 'var(--color-error)' }}>{error}</div> : null}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
          {paso > (lineas.length === 1 ? 1 : 0) ? (
            <button type="button" style={btnSec} onClick={() => { setError(null); setPaso((p) => p - 1); }}>Atrás</button>
          ) : null}
          {paso < PASOS.length - 1 ? (
            <button type="button" style={{ ...btn, flex: 1 }} onClick={avanzar}>Continuar</button>
          ) : (
            <button type="button" style={{ ...btn, flex: 1, opacity: enviando ? 0.6 : 1 }} disabled={enviando} onClick={() => void enviar()}>
              {enviando ? 'Enviando…' : 'Enviar a revisión'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
