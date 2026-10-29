'use client';

import { useState } from 'react';
import { esLineaServicio } from '@maqserv/config';
import { ShSelectCampo } from '@maqserv/ui';
import { Icon } from '@/components/Icon';

/**
 * AGREGAR UN EQUIPO, EN UNA SOLA PANTALLA (2026-10-28).
 *
 * Antes eran siete pasos (ficha técnica, horario, cuánto cobra, fotos
 * obligatorias…) para "publicar" una máquina que el cliente ya no ve: el sitio
 * enseña solo los servicios de MAQSER24. Ahora pide lo mismo que el registro
 * del sitio: el tipo de la lista (o uno nuevo), cuántas unidades, marca,
 * modelo y dónde está.
 *
 * Si elige un tipo de la lista, cuenta en ese momento: le llegan las
 * solicitudes de ese tipo. Si es nuevo, MAQSER24 decide si es igual a uno que
 * ya tiene o si lo agrega como servicio, y le avisa por correo.
 *
 * Si ni la categoría está (2026-10-28), "Otra: no está en la lista" la propone
 * con su nombre; MAQSER24 la decide en Categorías.
 */

const CSS = `
.of-box{ border-color:color-mix(in srgb, var(--color-primary) 55%, var(--color-border)); }
.of-top{ display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:16px; }
.of-cerrar{ background:none; border:1px solid transparent; border-radius:8px; color:var(--color-text-muted); cursor:pointer; display:grid; place-items:center; width:36px; height:36px; }
.of-cerrar:hover{ color:var(--color-text); border-color:var(--color-border); }
.of-cerrar:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; }
.of-cuerpo{ display:grid; gap:16px; }
.of-lineas{ display:flex; flex-wrap:wrap; gap:8px; }
.of-tres{ display:grid; grid-template-columns:90px minmax(0,1fr) minmax(0,1fr); gap:12px; }
.of-botones{ display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; margin-top:4px; }
@media (max-width: 640px){
  .of-box .ms-input{ font-size:16px; }
  .of-tres{ grid-template-columns:1fr 1fr; }
  .of-tres > :first-child{ grid-column:1 / -1; max-width:140px; }
}
`;

/** El ejemplo de "qué es" según la línea: tiene que sonarle a su negocio. */
const EJEMPLO: Record<string, string> = {
  'maquinaria-pesada': 'Grúa hidráulica 30 t',
  'transporte-y-servicios-de-obra': 'Volteo 20 t',
  triturados: 'Grava 1 1/2"',
  'materiales-para-construccion': 'Block 15×20×40',
  'soluciones-asfalticas': 'Emulsión asfáltica',
};

/** "No está en la lista": se escribe y queda como nuevo. */
const OTRO = 'otro';
/** La categoría "Otra: no está en la lista" (la API la espera con este nombre). */
const OTRA = '__nueva__';

export function OfrecerEquipo({
  lineas,
  tipos = {},
  onCerrar,
  onEnviado,
}: {
  lineas: Array<{ slug: string; label: string }>;
  /** Los tipos de cada línea: los servicios de MAQSER24. Elegir uno es lo que le trae sus solicitudes. */
  tipos?: Record<string, Array<{ id: number; nombre: string }>>;
  onCerrar: () => void;
  /** `nuevo`: no estaba en la lista y lo revisa MAQSER24. */
  onEnviado: (nombre: string, nuevo: boolean) => void;
}) {
  const [linea, setLinea] = useState(lineas.length === 1 ? lineas[0].slug : '');
  const [categoriaNombre, setCategoriaNombre] = useState('');
  const tiposLinea = linea !== OTRA && esLineaServicio(linea) ? tipos[linea] ?? [] : [];
  const [tipoId, setTipoId] = useState('');
  const [nombre, setNombre] = useState('');
  const [unidades, setUnidades] = useState('1');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sin tipos en la línea (o "Otro"), se escribe qué es.
  const esNuevo = tiposLinea.length === 0 || tipoId === OTRO;
  const tipoNombre = tiposLinea.find((t) => String(t.id) === tipoId)?.nombre ?? null;

  function elegirLinea(slug: string) {
    setLinea(slug);
    setTipoId('');
    setError(null);
  }

  function falta(): string | null {
    if (!linea) return 'Elige qué das: la línea de servicio.';
    if (linea === OTRA && categoriaNombre.trim().length < 3) return 'Escribe qué categoría es.';
    if (tiposLinea.length > 0 && !tipoId) return 'Elige el tipo de la lista, u «Otro» si no está.';
    if (esNuevo && nombre.trim().length < 3) return 'Escribe qué es.';
    return null;
  }

  async function enviar() {
    const f = falta();
    if (f) { setError(f); return; }
    setEnviando(true); setError(null);
    const r = await fetch('/api/proxy/aliado/equipos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoria: linea,
        categoriaNueva: linea === OTRA ? categoriaNombre.trim() : undefined,
        tipoId: esNuevo ? undefined : Number(tipoId),
        nombre: esNuevo ? nombre.trim() : undefined,
        unidades: Math.max(1, Number(unidades) || 1),
        marca: marca.trim() || undefined,
        modelo: modelo.trim() || undefined,
        ubicacion: ubicacion.trim() || undefined,
      }),
    });
    const d = await r.json().catch(() => null);
    setEnviando(false);
    if (!r.ok) { setError(typeof d?.message === 'string' ? d.message : 'No se pudo agregar. Intenta otra vez.'); return; }
    onEnviado(esNuevo ? nombre.trim() : tipoNombre ?? '', Boolean(d?.nuevo));
  }

  return (
    <div className="ms-panel of-box">
      <style>{CSS}</style>
      <div className="of-top">
        <h3 className="ms-h3" style={{ fontSize: 17 }}>Agregar equipo</h3>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="of-cerrar">
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="of-cuerpo">
        {/* Siempre a la vista: aunque tenga una sola línea, puede proponer otra. */}
        <div className="ms-field">
          <span className="ms-label">¿De qué es?</span>
          <div className="of-lineas" role="radiogroup" aria-label="Línea">
            {[...lineas, { slug: OTRA, label: '+ Otra: no está en la lista' }].map((l) => (
              <button key={l.slug} type="button" role="radio" aria-checked={linea === l.slug} className="ms-tab" aria-selected={linea === l.slug} onClick={() => elegirLinea(l.slug)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {linea === OTRA ? (
          <div className="ms-field">
            <label htmlFor="of-categoria" className="ms-label">¿Qué categoría es?</label>
            <input id="of-categoria" className="ms-input" value={categoriaNombre} maxLength={100} onChange={(e) => setCategoriaNombre(e.target.value)} placeholder="Grúas" />
            <span className="ms-hint">Es una categoría nueva: MAQSER24 la revisa y te avisa por correo.</span>
          </div>
        ) : null}

        {linea && tiposLinea.length > 0 ? (
          <div className="ms-field">
            <label htmlFor="of-tipo" className="ms-label">¿Qué es?</label>
            <ShSelectCampo
              id="of-tipo"
              value={tipoId}
              onChange={(v) => { setTipoId(v); setError(null); }}
              placeholder="Elige de la lista"
              options={[
                ...tiposLinea.map((t) => ({ value: String(t.id), label: t.nombre })),
                { value: OTRO, label: 'Otro: no está en la lista' },
              ]}
            />
            {tipoNombre ? <span className="ms-hint">Te llegan las solicitudes de {tipoNombre} en cuanto lo agregues.</span> : null}
          </div>
        ) : null}

        {linea && esNuevo ? (
          <div className="ms-field">
            <label htmlFor="of-nombre" className="ms-label">{tiposLinea.length ? 'Escribe qué es' : '¿Qué es?'}</label>
            <input id="of-nombre" className="ms-input" value={nombre} maxLength={160} onChange={(e) => setNombre(e.target.value)} placeholder={EJEMPLO[linea] ?? 'Qué es y de qué tamaño'} />
            <span className="ms-hint">Es nuevo: MAQSER24 lo revisa y te avisa por correo. Mientras, no te llegan solicitudes de eso.</span>
          </div>
        ) : null}

        {linea ? (
          <>
            <div className="of-tres">
              <div className="ms-field">
                <label htmlFor="of-unidades" className="ms-label">Unidades</label>
                <input id="of-unidades" className="ms-input" inputMode="numeric" value={unidades} onChange={(e) => setUnidades(e.target.value.replace(/\D/g, '').slice(0, 3))} />
              </div>
              <div className="ms-field">
                <label htmlFor="of-marca" className="ms-label">Marca <span className="ms-muted">(opcional)</span></label>
                <input id="of-marca" className="ms-input" value={marca} maxLength={120} onChange={(e) => setMarca(e.target.value)} placeholder="Kenworth" />
              </div>
              <div className="ms-field">
                <label htmlFor="of-modelo" className="ms-label">Modelo <span className="ms-muted">(opcional)</span></label>
                <input id="of-modelo" className="ms-input" value={modelo} maxLength={120} onChange={(e) => setModelo(e.target.value)} placeholder="T800" />
              </div>
            </div>
            <div className="ms-field">
              <label htmlFor="of-donde" className="ms-label">¿Dónde está? <span className="ms-muted">(opcional)</span></label>
              <input id="of-donde" className="ms-input" value={ubicacion} maxLength={160} onChange={(e) => setUbicacion(e.target.value)} placeholder="Patio en García" />
            </div>
          </>
        ) : null}

        {error ? <p role="alert" className="ms-small" style={{ color: 'var(--color-error)', margin: 0 }}>{error}</p> : null}

        <div className="of-botones">
          <button type="button" className="ms-btn ms-btn-sec" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="ms-btn" onClick={() => void enviar()} disabled={enviando}>
            {enviando ? 'Agregando…' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  );
}
