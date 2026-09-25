'use client';

import { useMemo, useState } from 'react';
import { DIAS_SEMANA, HORARIO_DEFAULT, atributosDe, esLineaServicio, textoHorario, unidadesDeTarifa, type Horario } from '@maqserv/config';
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

/**
 * Siete pasos (2026-09-25): se agregan "cuánto cobras" y el horario. Son los
 * datos que el cotizador usa para recomendar la máquina: sin precio no se
 * puede cotizar, y sin horario no se sabe si atiende el viernes a las 12.
 */
type Paso = 'tipo' | 'linea' | 'queEs' | 'ficha' | 'donde' | 'precios' | 'fotos' | 'enviar';

/**
 * SERVICIO O PRODUCTO (2026-09-25). "¿Qué pasa si en lugar de servicios
 * ofrece productos, o ambos?" Lo que puede ofrecer lo marcó MAQSER24 al darlo
 * de alta (`providers.categories`): las líneas son servicios y cualquier otra
 * categoría es de productos. Si tiene de los dos, lo primero es preguntarle
 * cuál; el producto se vende a precio fijo, sin horario ni cobro por tiempo.
 */
const TITULO: Record<'servicio' | 'producto', Record<Paso, string>> = {
  servicio: { tipo: 'Qué ofreces', linea: 'Línea', queEs: 'Qué es', ficha: 'Ficha técnica', donde: 'Dónde y cuándo', precios: 'Cuánto cobras', fotos: 'Fotos', enviar: 'Enviar' },
  producto: { tipo: 'Qué ofreces', linea: 'Categoría', queEs: 'Qué es', ficha: 'Ficha técnica', donde: 'Dónde está', precios: 'Precio y existencias', fotos: 'Fotos', enviar: 'Enviar' },
};

export function OfrecerEquipo({
  lineas,
  onCerrar,
  onEnviado,
}: {
  lineas: Array<{ slug: string; label: string }>;
  onCerrar: () => void;
  onEnviado: (nombre: string) => void;
}) {
  const servicios = lineas.filter((l) => esLineaServicio(l.slug));
  const productos = lineas.filter((l) => !esLineaServicio(l.slug));
  const ambos = servicios.length > 0 && productos.length > 0;
  const [tipo, setTipo] = useState<'servicio' | 'producto'>(servicios.length > 0 ? 'servicio' : 'producto');
  const esProducto = tipo === 'producto';
  const opciones = esProducto ? productos : servicios;
  const [linea, setLinea] = useState(!ambos && lineas.length === 1 ? lineas[0].slug : '');
  const [nombre, setNombre] = useState('');
  const [marca, setMarca] = useState('');
  const [modalidad, setModalidad] = useState<'renta' | 'venta'>(EJEMPLO[lineas[0]?.slug ?? '']?.modalidad ?? 'renta');
  const [atributos, setAtributos] = useState<Record<string, string>>({});
  const [ubicacion, setUbicacion] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fotos, setFotos] = useState<File[]>([]);
  // Cuánto cobra por unidad (texto mientras escribe), unidad principal, mínimo y cuántas iguales.
  const [costos, setCostos] = useState<Record<string, string>>({});
  const [unidadPrincipal, setUnidadPrincipal] = useState('');
  const [minimo, setMinimo] = useState('1');
  const [unidades, setUnidades] = useState('1');
  const [horario, setHorario] = useState<Horario>(HORARIO_DEFAULT);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preguntas = useMemo(() => atributosDe(linea), [linea]);
  // Los pasos dependen de qué ofrece: sin "qué ofreces" si solo tiene un tipo,
  // sin "línea" si solo tiene una, y el producto sin ficha si su categoría no tiene.
  const pasos = useMemo<Paso[]>(() => {
    const xs: Paso[] = [];
    if (ambos) xs.push('tipo');
    if (ambos || opciones.length !== 1) xs.push('linea');
    xs.push('queEs');
    if (!esProducto || preguntas.length > 0) xs.push('ficha');
    xs.push('donde', 'precios', 'fotos', 'enviar');
    return xs;
  }, [ambos, opciones.length, esProducto, preguntas.length]);
  const [i, setI] = useState(0);
  const paso = pasos[Math.min(i, pasos.length - 1)];
  const unidadesPrecio = useMemo(() => unidadesDeTarifa(linea, esProducto ? 'venta' : modalidad), [linea, modalidad, esProducto]);
  const costosNumericos = useMemo(
    () => Object.fromEntries(Object.entries(costos).map(([k, v]) => [k, Number(v)]).filter(([, n]) => Number.isFinite(n) && (n as number) > 0)) as Record<string, number>,
    [costos],
  );
  const unidadElegida = unidadPrincipal && costosNumericos[unidadPrincipal] ? unidadPrincipal : Object.keys(costosNumericos)[0] ?? '';
  const lineaLabel = lineas.find((l) => l.slug === linea)?.label ?? '';
  const previews = useMemo(() => fotos.map((f) => URL.createObjectURL(f)), [fotos]);

  function elegirTipo(t: 'servicio' | 'producto') {
    setTipo(t);
    setAtributos({}); setCostos({}); setUnidadPrincipal('');
    const suyas = t === 'servicio' ? servicios : productos;
    setLinea(suyas.length === 1 ? suyas[0].slug : '');
    setModalidad(t === 'producto' ? 'venta' : EJEMPLO[suyas[0]?.slug ?? '']?.modalidad ?? 'renta');
  }

  function elegirLinea(slug: string) {
    setLinea(slug);
    setAtributos({}); setCostos({}); setUnidadPrincipal('');
    setModalidad(esProducto ? 'venta' : EJEMPLO[slug]?.modalidad ?? 'renta');
  }

  /** Qué falta para pasar de este paso. Null = puede seguir. */
  function falta(): string | null {
    if (paso === 'linea' && !linea) return esProducto ? 'Elige la categoría del producto.' : 'Elige la línea de servicio.';
    if (paso === 'queEs' && nombre.trim().length < 3) return esProducto ? 'Escribe qué producto es.' : 'Escribe qué equipo o servicio es.';
    if (paso === 'donde' && !esProducto && horario.dias.length === 0) return 'Marca al menos un día en que atiendes.';
    if (paso === 'donde' && !esProducto && horario.desde >= horario.hasta) return 'La hora de cierre debe ser después de la de apertura.';
    if (paso === 'precios' && Object.keys(costosNumericos).length === 0) return esProducto ? 'Escribe el precio al que lo vendes.' : 'Escribe al menos un precio: sin él no se puede cotizar tu equipo.';
    if (paso === 'fotos' && fotos.length === 0) return 'Sube al menos una foto: es lo primero que revisa el cliente.';
    return null;
  }

  function avanzar() {
    const f = falta();
    if (f) { setError(f); return; }
    setError(null);
    setI((p) => Math.min(pasos.length - 1, p + 1));
  }

  async function enviar() {
    setEnviando(true); setError(null);
    const fd = new FormData();
    fd.set('categoria', linea);
    fd.set('nombre', nombre.trim());
    if (marca.trim()) fd.set('marca', marca.trim());
    fd.set('modalidad', esProducto ? 'venta' : modalidad);
    if (ubicacion.trim()) fd.set('ubicacion', ubicacion.trim());
    if (descripcion.trim()) fd.set('descripcion', descripcion.trim());
    fd.set('atributos', JSON.stringify(atributos));
    fd.set('costos', JSON.stringify(costosNumericos));
    fd.set('unidad', unidadElegida);
    fd.set('minimo', esProducto ? '0' : String(Math.max(0, Number(minimo) || 0)));
    fd.set('unidades', String(Math.max(1, Number(unidades) || 1)));
    if (!esProducto) fd.set('horario', JSON.stringify(horario));
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
        <strong style={{ fontSize: 17 }}>{ambos ? 'Ofrecer' : esProducto ? 'Ofrecer un producto' : 'Ofrecer un servicio'}</strong>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex' }}>
          <Icon name="x" size={18} />
        </button>
      </div>

      {/* Pasos: se ve dónde va y lo que falta. */}
      <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 18px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {pasos.map((k, n) => (
          <li
            key={k}
            style={{
              fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
              color: n === i ? 'var(--color-primary-fg)' : n < i ? 'var(--color-success)' : 'var(--color-text-muted)',
              background: n === i ? 'var(--color-primary)' : 'transparent',
              border: `1px solid ${n === i ? 'var(--color-primary)' : 'var(--color-border)'}`,
            }}
          >
            {n < i ? '✓ ' : `${n + 1}. `}{TITULO[tipo][k]}
          </li>
        ))}
      </ol>

      <div style={{ display: 'grid', gap: 14 }}>
        {paso === 'tipo' ? (
          <>
            <span style={etiqueta}>¿Qué vas a ofrecer?</span>
            <div style={{ display: 'grid', gap: 8 }}>
              {([
                ['servicio', 'Un servicio', 'Renta de maquinaria, fletes, surtido de material… se cotiza por obra.'],
                ['producto', 'Un producto', 'Algo que vendes a precio fijo y se envía o se recoge.'],
              ] as const).map(([v, t, a]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => elegirTipo(v)}
                  style={{ ...btnSec, display: 'grid', justifyItems: 'start', justifyContent: 'stretch', textAlign: 'left', gap: 2, borderColor: tipo === v ? 'var(--color-primary)' : 'var(--color-border)', background: tipo === v ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'transparent' }}
                >
                  <span>{tipo === v ? '✓ ' : ''}{t}</span>
                  <span style={{ ...ayuda, fontWeight: 500 }}>{a}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {paso === 'linea' ? (
          <>
            <span style={etiqueta}>{esProducto ? '¿En qué categoría va?' : '¿En qué línea de servicio va?'}</span>
            <div style={{ display: 'grid', gap: 8 }}>
              {opciones.map((l) => (
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

        {paso === 'queEs' ? (
          <>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={etiqueta}>¿Qué es?</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={EJEMPLO[linea]?.nombre ?? (esProducto ? 'Nombre del producto' : 'Nombre del equipo o servicio')} style={campo} />
              <span style={ayuda}>{esProducto ? 'Como lo buscaría un cliente: qué es y su medida o presentación.' : 'Como lo buscaría un cliente: tipo y tamaño. Ej. "Excavadora 20 t".'}</span>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={etiqueta}>Marca y modelo <span style={ayuda}>(opcional)</span></span>
              <input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="CAT 320, John Deere 310L…" style={campo} />
            </label>
            {esProducto ? null : (
              <div style={{ display: 'grid', gap: 6 }}>
                <span style={etiqueta}>¿Cómo lo cobras?</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['renta', 'venta'] as const).map((m) => (
                    <button key={m} type="button" onClick={() => { setModalidad(m); setCostos({}); setUnidadPrincipal(''); }} style={{ ...btnSec, flex: 1, borderColor: modalidad === m ? 'var(--color-primary)' : 'var(--color-border)', background: modalidad === m ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'transparent' }}>
                      {m === 'renta' ? 'Por tiempo (día, semana, mes)' : 'Por cantidad (viaje, tonelada, m³)'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}

        {paso === 'ficha' ? (
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

        {paso === 'donde' ? (
          <>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={etiqueta}>{esProducto ? '¿Desde dónde se envía o se recoge?' : '¿Dónde está?'}</span>
              <input value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder={esProducto ? 'Bodega en Apodaca…' : 'Patio en García, banco en Escobedo…'} style={campo} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={etiqueta}>Algo más que el cliente deba saber <span style={ayuda}>(opcional)</span></span>
              <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} placeholder={esProducto ? 'Presentación, garantía, condiciones…' : 'Incluye operador y diésel, condiciones…'} style={{ ...campo, resize: 'vertical' }} />
            </label>
            {esProducto ? null : <div style={{ display: 'grid', gap: 8 }}>
              <span style={etiqueta}>¿Qué días atiendes?</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {DIAS_SEMANA.map((d, i) => {
                  const on = horario.dias.includes(i);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setHorario((h) => ({ ...h, dias: on ? h.dias.filter((x) => x !== i) : [...h.dias, i].sort() }))}
                      style={{ ...btnSec, padding: '9px 12px', fontSize: 13.5, borderColor: on ? 'var(--color-primary)' : 'var(--color-border)', background: on ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'transparent' }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={etiqueta}>Desde</span>
                  <input type="time" value={horario.desde} onChange={(e) => setHorario((h) => ({ ...h, desde: e.target.value }))} style={campo} />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={etiqueta}>Hasta</span>
                  <input type="time" value={horario.hasta} onChange={(e) => setHorario((h) => ({ ...h, hasta: e.target.value }))} style={campo} />
                </label>
              </div>
              <span style={ayuda}>Solo te proponemos trabajos que caigan en este horario.</span>
            </div>}
          </>
        ) : null}

        {paso === 'precios' ? (
          <>
            <p style={{ margin: 0, ...ayuda, fontSize: 13.5 }}>
              {esProducto
                ? 'El precio al que lo vendes. Con eso MAQSER24 arma el precio al cliente.'
                : 'Lo que cobras. Con eso MAQSER24 arma el precio al cliente. Llena las unidades que manejes.'}
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              {unidadesPrecio.map((u) => (
                <label key={u.clave} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
                  <span style={etiqueta}>Por {u.singular}</span>
                  <div style={{ position: 'relative', width: 170 }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>$</span>
                    <input
                      type="number" min={0} step="1" inputMode="decimal"
                      value={costos[u.clave] ?? ''}
                      onChange={(e) => setCostos((c) => ({ ...c, [u.clave]: e.target.value }))}
                      placeholder="0"
                      style={{ ...campo, paddingLeft: 26 }}
                    />
                  </div>
                </label>
              ))}
            </div>
            {Object.keys(costosNumericos).length > 1 ? (
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={etiqueta}>¿Cuál es la unidad principal?</span>
                <ShSelect value={unidadElegida} onValueChange={setUnidadPrincipal}>
                  <ShSelectTrigger aria-label="Unidad principal"><ShSelectValue /></ShSelectTrigger>
                  <ShSelectContent>
                    {unidadesPrecio.filter((u) => costosNumericos[u.clave]).map((u) => <ShSelectItem key={u.clave} value={u.clave}>Por {u.singular}</ShSelectItem>)}
                  </ShSelectContent>
                </ShSelect>
                <span style={ayuda}>Es la que se enseña en el catálogo.</span>
              </label>
            ) : null}
            {esProducto ? (
              <label style={{ display: 'grid', gap: 6, maxWidth: 260 }}>
                <span style={etiqueta}>¿Cuántas tienes en existencia?</span>
                <input type="number" min={1} step="1" value={unidades} onChange={(e) => setUnidades(e.target.value)} style={campo} />
                <span style={ayuda}>Se descuentan al venderse.</span>
              </label>
            ) : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={etiqueta}>Mínimo</span>
                <input type="number" min={0} step="1" value={minimo} onChange={(e) => setMinimo(e.target.value)} style={campo} />
                <span style={ayuda}>{unidadElegida ? `En ${unidadesPrecio.find((u) => u.clave === unidadElegida)?.plural ?? 'unidades'}. 0 = sin mínimo.` : '0 = sin mínimo.'}</span>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={etiqueta}>¿Cuántas iguales tienes?</span>
                <input type="number" min={1} step="1" value={unidades} onChange={(e) => setUnidades(e.target.value)} style={campo} />
                <span style={ayuda}>Para saber cuántas se pueden apartar a la vez.</span>
              </label>
            </div>}
          </>
        ) : null}

        {paso === 'fotos' ? (
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

        {paso === 'enviar' ? (
          <div style={{ display: 'grid', gap: 10, fontSize: 14 }}>
            <p style={{ margin: 0, ...ayuda, fontSize: 13.5 }}>Revisa y envía. MAQSER24 lo revisa y, al publicarlo, te avisamos por correo.</p>
            {([
              ['Tipo', esProducto ? 'Producto' : 'Servicio'],
              [esProducto ? 'Categoría' : 'Línea', lineaLabel],
              ['Qué es', nombre],
              ['Marca', marca || '—'],
              ...(esProducto ? [] : [['Cobro', modalidad === 'renta' ? 'Por tiempo' : 'Por cantidad']]),
              ...preguntas.filter((q) => (atributos[q.clave] ?? '').trim()).map((q) => [q.label, `${atributos[q.clave]}${q.unidad ? ` ${q.unidad}` : ''}`]),
              [esProducto ? 'Se envía desde' : 'Dónde está', ubicacion || '—'],
              ...(esProducto ? [] : [['Horario', textoHorario(horario)]]),
              ...unidadesPrecio.filter((u) => costosNumericos[u.clave]).map((u) => [`${esProducto ? 'Precio' : 'Cobras'} por ${u.singular}`, `$${costosNumericos[u.clave].toLocaleString('es-MX')}`]),
              ...(esProducto ? [] : [['Mínimo', Number(minimo) > 0 ? `${minimo} ${unidadesPrecio.find((u) => u.clave === unidadElegida)?.plural ?? ''}` : 'Sin mínimo']]),
              [esProducto ? 'En existencia' : 'Unidades iguales', unidades],
              ['Fotos', String(fotos.length)],
            ] as Array<[string, string]>).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{k}</span>
                <strong style={{ textAlign: 'right' }}>{v}</strong>
              </div>
            ))}
          </div>
        ) : null}

        {error ? <div role="alert" style={{ fontSize: 13.5, color: 'var(--color-error)' }}>{error}</div> : null}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
          {i > 0 ? (
            <button type="button" style={btnSec} onClick={() => { setError(null); setI((p) => p - 1); }}>Atrás</button>
          ) : null}
          {i < pasos.length - 1 ? (
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
