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

/**
 * Estandarización (2026-09-30): campos, botones y pasos usan las piezas
 * `ms-*` del sistema de diseño. Aquí solo lo propio del asistente (`of-`).
 * En teléfono los campos van a 16 px para que iOS no haga zoom al enfocar.
 */
const CSS = `
.of-box{ border-color:color-mix(in srgb, var(--color-primary) 55%, var(--color-border)); }
.of-top{ display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:16px; }
.of-cerrar{ background:none; border:1px solid transparent; border-radius:8px; color:var(--color-text-muted); cursor:pointer; display:grid; place-items:center; width:36px; height:36px; }
.of-cerrar:hover{ color:var(--color-text); border-color:var(--color-border); }
.of-cerrar:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; }
.of-steps{ margin-bottom:22px; row-gap:10px; }
.of-cuerpo{ display:grid; gap:16px; }
.of-opciones{ display:grid; gap:8px; }
.of-opcion{ display:flex; gap:12px; align-items:flex-start; width:100%; text-align:left; padding:13px 14px; border-radius:8px; border:1px solid var(--color-border); background:transparent; color:var(--color-text); font:inherit; font-size:14.5px; font-weight:600; cursor:pointer; transition:border-color .18s ease, background .18s ease; }
.of-opcion:hover{ border-color:color-mix(in srgb, var(--color-text) 28%, var(--color-border)); }
.of-opcion[aria-pressed="true"]{ border-color:color-mix(in srgb, var(--color-primary) 60%, var(--color-border)); background:color-mix(in srgb, var(--color-primary) 10%, transparent); }
.of-opcion:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; }
.of-opcion .ms-check{ margin-top:1px; pointer-events:none; }
.of-opcion small{ display:block; margin-top:2px; font-size:13px; font-weight:400; color:var(--color-text-muted); line-height:1.45; }
.of-dos{ display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:12px; }
.of-corto{ max-width:260px; }
.of-precio{ display:grid; grid-template-columns:minmax(0,1fr) 170px; gap:10px; align-items:center; }
.of-pesos{ position:relative; }
.of-pesos span{ position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--color-text-muted); }
.of-pesos .ms-input{ padding-left:26px; }
.of-fotos{ display:grid; grid-template-columns:repeat(auto-fill, minmax(86px, 1fr)); gap:8px; }
.of-fotos img{ width:100%; aspect-ratio:1; object-fit:cover; border-radius:8px; border:1px solid var(--color-border); }
.of-fotos img:first-child{ border:2px solid var(--color-primary); }
.of-resumen{ border-top:1px solid var(--color-border); }
.of-resumen .ms-kv{ border-bottom:1px solid var(--color-border); padding:9px 0; }
.of-resumen .ms-kv b{ text-align:right; overflow-wrap:anywhere; min-width:0; }
.of-botones{ display:flex; gap:10px; flex-wrap:wrap; margin-top:4px; }
.of-botones .of-sigue{ flex:1 1 180px; }
@media (max-width: 640px){
  .of-box .ms-input, .of-box .ms-textarea{ font-size:16px; }
  .of-steps li:not([data-on="true"]) .of-step-t{ display:none; }
  .of-steps{ gap:5px; }
  .of-steps li + li::before{ width:8px; }
  .of-precio{ grid-template-columns:minmax(0,1fr) 140px; }
}
`;

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
    xs.push('donde');
    if (esProducto) xs.push('precios'); // el servicio no lleva precio propio (precio único)
    xs.push('fotos', 'enviar');
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
    fd.set('minimo', '0'); // el mínimo vive en el tabulador (precio único)
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
    <div className="ms-panel of-box">
      <style>{CSS}</style>
      <div className="of-top">
        <h3 className="ms-h3" style={{ fontSize: 17 }}>{ambos ? 'Ofrecer' : esProducto ? 'Ofrecer un producto' : 'Ofrecer un servicio'}</h3>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="of-cerrar">
          <Icon name="x" size={18} />
        </button>
      </div>

      {/* Pasos: se ve dónde va y lo que falta. En teléfono solo se nombra el actual. */}
      <ol className="ms-steps of-steps" aria-label="Pasos">
        {pasos.map((k, n) => (
          <li key={k} data-on={n === i} data-done={n < i} aria-current={n === i ? 'step' : undefined}>
            <span>{n < i ? <Icon name="check" size={12} /> : n + 1}</span>
            <em className="of-step-t" style={{ fontStyle: 'normal' }}>{TITULO[tipo][k]}</em>
          </li>
        ))}
      </ol>

      <div className="of-cuerpo">
        {paso === 'tipo' ? (
          <div className="ms-field">
            <span className="ms-label">¿Qué vas a ofrecer?</span>
            <div className="of-opciones">
              {([
                ['servicio', 'Un servicio', 'Renta de maquinaria, fletes, surtido de material… se cotiza por obra.'],
                ['producto', 'Un producto', 'Algo que vendes a precio fijo y se envía o se recoge.'],
              ] as const).map(([v, t, a]) => (
                <button key={v} type="button" onClick={() => elegirTipo(v)} className="of-opcion" aria-pressed={tipo === v}>
                  <span className="ms-check" data-on={tipo === v} aria-hidden>{tipo === v ? <Icon name="check" size={13} /> : null}</span>
                  <span>{t}<small>{a}</small></span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {paso === 'linea' ? (
          <div className="ms-field">
            <span className="ms-label">{esProducto ? '¿En qué categoría va?' : '¿En qué línea de servicio va?'}</span>
            <div className="of-opciones">
              {opciones.map((l) => (
                <button key={l.slug} type="button" onClick={() => elegirLinea(l.slug)} className="of-opcion" aria-pressed={linea === l.slug}>
                  <span className="ms-check" data-on={linea === l.slug} aria-hidden>{linea === l.slug ? <Icon name="check" size={13} /> : null}</span>
                  <span>{l.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {paso === 'queEs' ? (
          <>
            <label className="ms-field">
              <span className="ms-label">¿Qué es?</span>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={EJEMPLO[linea]?.nombre ?? (esProducto ? 'Nombre del producto' : 'Nombre del equipo o servicio')} className="ms-input" />
              <span className="ms-hint">{esProducto ? 'Como lo buscaría un cliente: qué es y su medida o presentación.' : 'Como lo buscaría un cliente: tipo y tamaño. Ej. "Excavadora 20 t".'}</span>
            </label>
            <label className="ms-field">
              <span className="ms-label">Marca y modelo <span className="ms-muted" style={{ fontWeight: 400 }}>(opcional)</span></span>
              <input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="CAT 320, John Deere 310L…" className="ms-input" />
            </label>
          </>
        ) : null}

        {paso === 'ficha' ? (
          preguntas.length === 0 ? (
            <p className="ms-hint" style={{ fontSize: 14 }}>Esta línea no tiene ficha técnica. Sigue al siguiente paso.</p>
          ) : (
            <>
              <p className="ms-hint" style={{ fontSize: 13.5 }}>
                Con estos datos te proponemos solo en las obras donde tu equipo sirve. Llena lo que sepas: {llenos} de {preguntas.length}.
              </p>
              {preguntas.map((q) => (
                <label key={q.clave} className="ms-field">
                  <span className="ms-label">{q.label}{q.unidad ? ` (${q.unidad})` : ''}</span>
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
                      className="ms-input"
                    />
                  )}
                  {q.hint ? <span className="ms-hint">{q.hint}</span> : null}
                </label>
              ))}
            </>
          )
        ) : null}

        {paso === 'donde' ? (
          <>
            <label className="ms-field">
              <span className="ms-label">{esProducto ? '¿Desde dónde se envía o se recoge?' : '¿Dónde está?'}</span>
              <input value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder={esProducto ? 'Bodega en Apodaca…' : 'Patio en García, banco en Escobedo…'} className="ms-input" />
            </label>
            <label className="ms-field">
              <span className="ms-label">Algo más que el cliente deba saber <span className="ms-muted" style={{ fontWeight: 400 }}>(opcional)</span></span>
              <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} placeholder={esProducto ? 'Presentación, garantía, condiciones…' : 'Incluye operador y diésel, condiciones…'} className="ms-textarea" style={{ minHeight: 96 }} />
            </label>
            {esProducto ? null : <div className="ms-field">
              <span className="ms-label">¿Qué días atiendes?</span>
              <div className="ms-tabs">
                {DIAS_SEMANA.map((d, i) => {
                  const on = horario.dias.includes(i);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      data-on={on}
                      className="ms-tab"
                      onClick={() => setHorario((h) => ({ ...h, dias: on ? h.dias.filter((x) => x !== i) : [...h.dias, i].sort() }))}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              <div className="of-dos" style={{ marginTop: 6 }}>
                <label className="ms-field">
                  <span className="ms-label">Desde</span>
                  <input type="time" value={horario.desde} onChange={(e) => setHorario((h) => ({ ...h, desde: e.target.value }))} className="ms-input" />
                </label>
                <label className="ms-field">
                  <span className="ms-label">Hasta</span>
                  <input type="time" value={horario.hasta} onChange={(e) => setHorario((h) => ({ ...h, hasta: e.target.value }))} className="ms-input" />
                </label>
              </div>
              <span className="ms-hint">Solo te proponemos trabajos que caigan en este horario.</span>
            </div>}
            {/* PRECIO ÚNICO (2026-09-28): el servicio se cobra con el tabulador
                de MAQSER24, así que al aliado ya no se le pregunta cuánto
                cobra; solo cuántas unidades iguales tiene. */}
            {esProducto ? null : (
              <label className="ms-field of-corto">
                <span className="ms-label">¿Cuántas iguales tienes?</span>
                <input type="number" min={1} step="1" value={unidades} onChange={(e) => setUnidades(e.target.value)} className="ms-input" />
                <span className="ms-hint">Para saber cuántas se pueden apartar a la vez.</span>
              </label>
            )}
          </>
        ) : null}

        {paso === 'precios' ? (
          <>
            <p className="ms-hint" style={{ fontSize: 13.5 }}>
              {esProducto
                ? 'El precio al que lo vendes. Con eso MAQSER24 arma el precio al cliente.'
                : 'Lo que cobras. Con eso MAQSER24 arma el precio al cliente. Llena las unidades que manejes.'}
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              {unidadesPrecio.map((u) => (
                <label key={u.clave} className="of-precio">
                  <span className="ms-label">Por {u.singular}</span>
                  <div className="of-pesos">
                    <span aria-hidden>$</span>
                    <input
                      type="number" min={0} step="1" inputMode="decimal"
                      value={costos[u.clave] ?? ''}
                      onChange={(e) => setCostos((c) => ({ ...c, [u.clave]: e.target.value }))}
                      placeholder="0"
                      className="ms-input"
                    />
                  </div>
                </label>
              ))}
            </div>
            {Object.keys(costosNumericos).length > 1 ? (
              <label className="ms-field">
                <span className="ms-label">¿Cuál es la unidad principal?</span>
                <ShSelect value={unidadElegida} onValueChange={setUnidadPrincipal}>
                  <ShSelectTrigger aria-label="Unidad principal"><ShSelectValue /></ShSelectTrigger>
                  <ShSelectContent>
                    {unidadesPrecio.filter((u) => costosNumericos[u.clave]).map((u) => <ShSelectItem key={u.clave} value={u.clave}>Por {u.singular}</ShSelectItem>)}
                  </ShSelectContent>
                </ShSelect>
                <span className="ms-hint">Es la que se enseña en el catálogo.</span>
              </label>
            ) : null}
            {esProducto ? (
              <label className="ms-field of-corto">
                <span className="ms-label">¿Cuántas tienes en existencia?</span>
                <input type="number" min={1} step="1" value={unidades} onChange={(e) => setUnidades(e.target.value)} className="ms-input" />
                <span className="ms-hint">Se descuentan al venderse.</span>
              </label>
            ) : <div className="of-dos">
              <label className="ms-field">
                <span className="ms-label">Mínimo</span>
                <input type="number" min={0} step="1" value={minimo} onChange={(e) => setMinimo(e.target.value)} className="ms-input" />
                <span className="ms-hint">{unidadElegida ? `En ${unidadesPrecio.find((u) => u.clave === unidadElegida)?.plural ?? 'unidades'}. 0 = sin mínimo.` : '0 = sin mínimo.'}</span>
              </label>
              <label className="ms-field">
                <span className="ms-label">¿Cuántas iguales tienes?</span>
                <input type="number" min={1} step="1" value={unidades} onChange={(e) => setUnidades(e.target.value)} className="ms-input" />
                <span className="ms-hint">Para saber cuántas se pueden apartar a la vez.</span>
              </label>
            </div>}
          </>
        ) : null}

        {paso === 'fotos' ? (
          <label className="ms-field">
            <span className="ms-label">Fotos <span className="ms-muted" style={{ fontWeight: 400 }}>(hasta 6; la primera es la principal)</span></span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFotos(Array.from(e.target.files ?? []).slice(0, 6))}
              className="ms-input"
              style={{ padding: '10px 13px' }}
            />
            {previews.length ? (
              <div className="of-fotos" style={{ marginTop: 6 }}>
                {previews.map((u, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={u} src={u} alt={`Foto ${i + 1}`} />
                ))}
              </div>
            ) : null}
          </label>
        ) : null}

        {paso === 'enviar' ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <p className="ms-hint" style={{ fontSize: 13.5 }}>Revisa y envía. MAQSER24 lo revisa y, al publicarlo, te avisamos por correo.</p>
            <div className="of-resumen">
              {([
                ['Tipo', esProducto ? 'Producto' : 'Servicio'],
                [esProducto ? 'Categoría' : 'Línea', lineaLabel],
                ['Qué es', nombre],
                ['Marca', marca || '—'],
                ...preguntas.filter((q) => (atributos[q.clave] ?? '').trim()).map((q) => [q.label, `${atributos[q.clave]}${q.unidad ? ` ${q.unidad}` : ''}`]),
                [esProducto ? 'Se envía desde' : 'Dónde está', ubicacion || '—'],
                ...(esProducto ? [] : [['Horario', textoHorario(horario)]]),
                ...unidadesPrecio.filter((u) => costosNumericos[u.clave]).map((u) => [`${esProducto ? 'Precio' : 'Cobras'} por ${u.singular}`, `$${costosNumericos[u.clave].toLocaleString('es-MX')}`]),
                [esProducto ? 'En existencia' : 'Unidades iguales', unidades],
                ['Fotos', String(fotos.length)],
              ] as Array<[string, string]>).map(([k, v]) => (
                <div key={k} className="ms-kv">
                  <span>{k}</span>
                  <b>{v}</b>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {error ? (
          <div role="alert" className="ms-alert ms-alert-bad" style={{ fontSize: 13.5 }}>
            <span style={{ color: 'var(--color-error)', display: 'flex', marginTop: 2 }}><Icon name="warning" size={15} /></span>
            <span>{error}</span>
          </div>
        ) : null}

        <div className="of-botones">
          {i > 0 ? (
            <button type="button" className="ms-btn ms-btn-sec" onClick={() => { setError(null); setI((p) => p - 1); }}>
              <Icon name="arrowLeft" size={15} />Atrás
            </button>
          ) : null}
          {i < pasos.length - 1 ? (
            <button type="button" className="ms-btn of-sigue" onClick={avanzar}>
              Continuar<Icon name="arrowRight" size={15} />
            </button>
          ) : (
            <button type="button" className="ms-btn of-sigue" disabled={enviando} onClick={() => void enviar()}>
              {enviando ? 'Enviando…' : 'Enviar a revisión'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
