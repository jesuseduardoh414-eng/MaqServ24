'use client';

import { useEffect, useMemo, useState } from 'react';
import { presentacionEstado, resumenDetalle } from '@maqserv/config';
import { Modal } from '@/components/Modal';
import { Btn, Chip, Note, StatusText, btnClass } from '@/components/ui';
import { colorVivo } from '@/components/modo';
import type { EquipoRow, ProviderRow } from '../proveedores/ProvidersManager';
import { buscarProveedores } from '../proveedores/BuscadorProveedores';
import { textoPrecio } from '../proveedores/EquipoDelAliado';
import type { ServicioRow } from './ServicesBoard';

/**
 * ASIGNAR UN SERVICIO (2026-11-12, el dueño: "MAQSER24 opera solo; si no
 * maneja un servicio, el administrador busca un proveedor").
 *
 * Ya no se le ofrece a nadie para que acepte: aquí se decide quién lo hace y
 * queda asignado en el acto.
 *  - «Lo hace MAQSER24»: sin elegir máquina («Mi flota» se quitó el mismo día:
 *    el administrador sabe lo que es suyo). Solo su operador, si ya se sabe; los
 *    que se escriben se recuerdan para la próxima.
 *  - «Con un proveedor»: la misma búsqueda de la libreta (servicio y municipio
 *    ya escritos), su equipo, lo acordado sin IVA (es lo que se le paga al
 *    cerrar) y, si se sabe, su operador. Al asignar sale el WhatsApp para
 *    avisarle, ya escrito, con el enlace del operador.
 */

/** Los operadores de MAQSER24 que ya se escribieron antes (se recuerdan solos). */
interface Flota {
  operadores: Array<{ nombre: string; telefono: string }>;
}

interface Resultado {
  proveedor: string;
  equipo: string | null;
  costo: number | null;
  operador: { url: string; whatsapp: string | null; operador: { nombre: string; telefono: string | null } } | null;
  whatsappProveedor: string | null;
}

/** El municipio de la obra: «Torre Valle · Monterrey» → «Monterrey». */
const municipioDe = (s: Pick<ServicioRow, 'obra' | 'address'>) => {
  const partes = (s.obra ?? '').split(' · ');
  return partes.length > 1 ? partes[partes.length - 1].trim() : '';
};

export function AsignarServicio({ servicio, onCerrar, onCambio }: { servicio: ServicioRow; onCerrar: () => void; onCambio: () => void }) {
  const [modo, setModo] = useState<'propio' | 'proveedor'>('propio');
  const [flota, setFlota] = useState<Flota | null>(null);
  const [provs, setProvs] = useState<ProviderRow[] | null>(null);
  const [cargaError, setCargaError] = useState<string | null>(null);

  const que = servicio.equipo ?? servicio.categoryName ?? '';
  const [buscar, setBuscar] = useState(que);
  const [donde, setDonde] = useState(municipioDe(servicio));

  const [productId, setProductId] = useState<number | null>(null);
  const [proveedorId, setProveedorId] = useState<number | null>(null);
  const [costo, setCosto] = useState('');
  const [opNombre, setOpNombre] = useState('');
  const [opTel, setOpTel] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<Resultado | null>(null);

  useEffect(() => {
    void (async () => {
      const [f, p] = await Promise.all([
        fetch('/api/admin/services/flota').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/admin/providers').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (!p) setCargaError('No se pudieron cargar los proveedores. Cierra y vuelve a intentar.');
      setFlota(f);
      setProvs(p);
    })();
  }, []);

  const resultados = useMemo(() => (provs ? buscarProveedores(provs, buscar, donde) : []), [provs, buscar, donde]);
  const elegido = resultados.find((r) => r.p.id === proveedorId) ?? null;

  function cambiarModo(m: 'propio' | 'proveedor') {
    setModo(m);
    setProductId(null);
    setProveedorId(null);
    setError(null);
  }

  async function asignar() {
    setError(null);
    if (modo === 'proveedor' && !proveedorId) { setError('Elige el proveedor.'); return; }
    const n = Number(costo.replace(/[^\d.]/g, ''));
    if (modo === 'proveedor' && !(n > 0)) { setError('Escribe lo acordado con el proveedor, sin IVA: es lo que se le paga al cerrar.'); return; }
    setGuardando(true);
    const r = await fetch(`/api/admin/services/${servicio.id}/asignar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        con: modo,
        proveedorId: modo === 'proveedor' ? proveedorId : null,
        productId,
        costo: modo === 'proveedor' ? n : null,
        operador: opNombre.trim() ? { nombre: opNombre.trim(), telefono: opTel.trim() || null } : null,
      }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setGuardando(false);
    if (!r?.ok) { setError(d?.message ?? 'No se pudo asignar. Intenta otra vez.'); return; }
    setHecho(d as Resultado);
    onCambio();
  }

  const operadorCampos = (
    <div className="as-op">
      <label className="as-campo">
        <span>Operador (si ya lo sabes)</span>
        <input
          className="adm-input"
          list={modo === 'propio' ? 'as-operadores' : undefined}
          value={opNombre}
          maxLength={120}
          placeholder="Nombre"
          onChange={(e) => {
            setOpNombre(e.target.value);
            const o = flota?.operadores.find((x) => x.nombre === e.target.value);
            if (o && modo === 'propio') setOpTel(o.telefono);
          }}
        />
      </label>
      <label className="as-campo">
        <span>Su teléfono</span>
        <input className="adm-input adm-num" inputMode="tel" value={opTel} maxLength={20} placeholder="10 dígitos" onChange={(e) => setOpTel(e.target.value)} />
      </label>
      <datalist id="as-operadores">{(flota?.operadores ?? []).map((o) => <option key={o.nombre} value={o.nombre}>{o.telefono}</option>)}</datalist>
    </div>
  );

  return (
    <Modal
      abierto
      titulo={hecho ? 'Listo, quedó asignado' : `Asignar ${servicio.quoteNumber}`}
      subtitulo={hecho ? undefined : <>{que || 'Servicio'}{servicio.obra ? ` · ${servicio.obra}` : ''}</>}
      onCerrar={onCerrar}
      ancho={860}
      pie={hecho ? (
        <Btn variant="primary" onClick={onCerrar}>Cerrar</Btn>
      ) : (
        <>
          <Btn variant="ghost" onClick={onCerrar}>Cancelar</Btn>
          <Btn variant="primary" onClick={() => void asignar()} disabled={guardando || !provs}>
            {guardando ? 'Asignando…' : modo === 'propio' ? 'Asignar a MAQSER24' : elegido ? `Asignar a ${elegido.p.name}` : 'Asignar'}
          </Btn>
        </>
      )}
    >
      <style>{CSS}</style>
      {hecho ? (
        <div className="as-hecho">
          <p>
            Lo hace <b>{hecho.proveedor}</b>{hecho.equipo ? <> con <b>{hecho.equipo}</b></> : null}
            {hecho.costo ? <> · acordado <b>${hecho.costo.toLocaleString('es-MX')}</b> más IVA</> : null}. Al cliente ya le llegó que su servicio quedó asignado.
          </p>
          <div className="as-acc">
            {hecho.whatsappProveedor ? (
              <a className={btnClass('primary', 'md')} href={hecho.whatsappProveedor} target="_blank" rel="noopener noreferrer">
                <i className="ph-bold ph-whatsapp-logo" aria-hidden />Avisarle al proveedor por WhatsApp
              </a>
            ) : null}
            {hecho.operador?.whatsapp ? (
              <a className={btnClass(hecho.whatsappProveedor ? 'secondary' : 'primary', 'md')} href={hecho.operador.whatsapp} target="_blank" rel="noopener noreferrer">
                <i className="ph ph-whatsapp-logo" aria-hidden />Mandarle su enlace a {hecho.operador.operador.nombre}
              </a>
            ) : null}
            {hecho.operador ? (
              <Btn onClick={() => void navigator.clipboard?.writeText(hecho.operador!.url)} icon="ph-copy">Copiar enlace del operador</Btn>
            ) : null}
          </div>
          {!hecho.operador ? <p className="as-nota">Cuando sepas quién maneja, ponlo con «Ponerle operador» en la tarjeta del servicio: así le llega su enlace para avisar cuando sale y llega.</p> : null}
        </div>
      ) : (
        <>
          {cargaError ? <Note tone="bad">{cargaError}</Note> : null}
          <div className="as-modos" role="radiogroup" aria-label="¿Quién lo hace?">
            <button type="button" role="radio" aria-checked={modo === 'propio'} className="as-modo" data-on={modo === 'propio' || undefined} onClick={() => cambiarModo('propio')}>
              <i className="ph ph-truck" aria-hidden />
              <span><b>Lo hace MAQSER24</b><small>Con su gente y sus máquinas</small></span>
            </button>
            <button type="button" role="radio" aria-checked={modo === 'proveedor'} className="as-modo" data-on={modo === 'proveedor' || undefined} onClick={() => cambiarModo('proveedor')}>
              <i className="ph ph-address-book" aria-hidden />
              <span><b>Con un proveedor</b><small>Para lo que MAQSER24 no maneja</small></span>
            </button>
          </div>

          {modo === 'propio' ? (
            <section className="as-sec">
              <h3 className="as-h">¿Quién maneja?</h3>
              {operadorCampos}
              <p className="as-nota">Si ya sabes quién va, ponlo: le llega su enlace para avisar cuando sale y cuando llega. Si no, se lo pones después con «Ponerle operador» en la tarjeta del servicio.</p>
            </section>
          ) : (
            <section className="as-sec">
              <div className="as-buscar">
                <label className="as-campo"><span>Servicio</span><input className="adm-input" value={buscar} maxLength={80} onChange={(e) => setBuscar(e.target.value)} /></label>
                <label className="as-campo"><span>Municipio de la obra</span><input className="adm-input" value={donde} maxLength={80} onChange={(e) => setDonde(e.target.value)} /></label>
              </div>
              {!provs ? <p className="as-nota">Cargando proveedores…</p> : resultados.length === 0 ? (
                <p className="as-nota">Nadie en tu libreta da «{buscar.trim()}». Prueba con otra palabra o búscalo en <a className="adm-link" href={`/servicios-proveedores?buscar=${encodeURIComponent(buscar)}`}>Servicios de proveedores</a>.</p>
              ) : (
                <div className="as-lista">
                  {resultados.map((r) => (
                    <div key={r.p.id} className="as-prov" data-on={proveedorId === r.p.id || undefined}>
                      <button type="button" className="as-prov-cab" onClick={() => { setProveedorId(r.p.id); setProductId(r.equipos.length === 1 ? r.equipos[0].id : null); }}>
                        <i className={proveedorId === r.p.id ? 'ph-fill ph-radio-button' : 'ph ph-circle'} aria-hidden />
                        <b>{r.p.name}</b>
                        {r.p.level === 'preferente' ? <Chip tone="accent">Preferente</Chip> : null}
                        {r.llegada ? <span className={r.llegada.cubre ? 'as-si' : 'as-no'}>{r.llegada.cubre ? 'Llega' : 'No llega'}{r.llegada.km != null ? ` · ~${Math.round(r.llegada.km)} km` : ''}</span> : null}
                        <span className="as-tel">{[r.p.contactName, r.p.phone].filter(Boolean).join(' · ')}</span>
                      </button>
                      {proveedorId === r.p.id && r.equipos.length ? (
                        <div className="as-lista as-sub">
                          {r.equipos.map((e) => <OpcionEquipo key={e.id} e={e} sirve elegido={productId === e.id} onElegir={() => setProductId(productId === e.id ? null : e.id)} />)}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
              {elegido ? (
                <div className="as-costo">
                  <label className="as-campo">
                    <span>Lo acordado con {elegido.p.name} (sin IVA) *</span>
                    <span className="as-pesos"><span aria-hidden>$</span><input className="adm-input adm-num" inputMode="decimal" value={costo} placeholder="Ej. 26000" onChange={(e) => setCosto(e.target.value.replace(/[^\d.]/g, ''))} /></span>
                  </label>
                  <p className="as-nota">
                    Es lo que se le paga al cerrar (ya no una comisión).
                    {(() => {
                      const e = elegido.equipos.find((x) => x.id === productId) ?? elegido.equipos[0];
                      const t = e ? textoPrecio(e.precio) : null;
                      return t ? <> Su precio: <b>{t}</b>{e?.precioNota ? ` · ${e.precioNota}` : ''}{servicio.quotedDays ? ` · se cotizaron ${servicio.quotedDays} día(s)` : ''}.</> : null;
                    })()}
                  </p>
                </div>
              ) : null}
              {elegido ? operadorCampos : null}
            </section>
          )}
          {error ? <div role="alert" style={{ marginTop: 12 }}><Note tone="bad">{error}</Note></div> : null}
        </>
      )}
    </Modal>
  );
}

function OpcionEquipo({ e, sirve, elegido, onElegir }: { e: EquipoRow; sirve: boolean; elegido: boolean; onElegir: () => void }) {
  const disp = presentacionEstado(e.availability);
  const n = Math.max(1, e.units ?? 1);
  return (
    <button type="button" className="as-eq" data-on={elegido || undefined} onClick={onElegir} aria-pressed={elegido}>
      <i className={elegido ? 'ph-fill ph-check-circle' : 'ph ph-circle'} aria-hidden />
      <span className="as-eq-txt">
        <b>{e.name}</b>
        <small>{[e.tipo, e.brand, `${n} ${n === 1 ? 'unidad' : 'unidades'}`, e.location].filter(Boolean).join(' · ')}</small>
        {textoPrecio(e.precio) ? <small className="as-eq-precio">Cobra {textoPrecio(e.precio)}{e.precioNota ? ` · ${e.precioNota}` : ''}</small> : null}
        {resumenDetalle(e.detalle, new Date().toISOString().slice(0, 10)).length ? <small>{resumenDetalle(e.detalle, new Date().toISOString().slice(0, 10)).join(' · ')}</small> : null}
      </span>
      {sirve ? null : <Chip tone="muted">Otro tipo</Chip>}
      <StatusText color={colorVivo(disp)} title={disp.nota}>{disp.nombre}</StatusText>
    </button>
  );
}

const CSS = `
.as-modos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
.as-modo { display: flex; gap: 12px; align-items: center; text-align: left; padding: 12px 14px; border-radius: 10px; border: 1px solid var(--adm-border); background: transparent; color: var(--adm-text); cursor: pointer; font: inherit; }
.as-modo > i { font-size: 22px; color: var(--adm-muted); }
.as-modo span { display: grid; gap: 2px; }
.as-modo small { color: var(--adm-muted); font-size: 12.5px; }
.as-modo[data-on] { border-color: var(--adm-accent); background: color-mix(in srgb, var(--adm-accent) 10%, transparent); }
.as-modo[data-on] > i { color: var(--adm-accent); }
.as-sec { display: grid; gap: 12px; }
.as-h { margin: 0; font-size: 14px; font-weight: 600; }
.as-lista { display: grid; gap: 6px; }
.as-sub { margin: 6px 0 2px 26px; }
.as-eq { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 9px; border: 1px solid var(--adm-border); background: transparent; color: var(--adm-text); cursor: pointer; font: inherit; text-align: left; width: 100%; }
.as-eq > i { font-size: 18px; color: var(--adm-muted); }
.as-eq[data-on] { border-color: var(--adm-accent); }
.as-eq[data-on] > i { color: var(--adm-accent); }
.as-eq-txt { display: grid; gap: 2px; flex: 1; min-width: 0; }
.as-eq-txt small { color: var(--adm-muted); font-size: 12.5px; }
.as-eq-precio { color: var(--adm-text-2) !important; }
.as-prov { border: 1px solid var(--adm-border); border-radius: 10px; padding: 8px 10px; }
.as-prov[data-on] { border-color: var(--adm-accent); }
.as-prov-cab { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; width: 100%; background: none; border: 0; padding: 2px; color: var(--adm-text); cursor: pointer; font: inherit; text-align: left; }
.as-prov-cab > i { font-size: 18px; color: var(--adm-accent); }
.as-si { color: var(--adm-ok); font-size: 12.5px; font-weight: 500; }
.as-no { color: var(--adm-warn); font-size: 12.5px; font-weight: 500; }
.as-tel { color: var(--adm-muted); font-size: 12.5px; margin-left: auto; }
.as-buscar, .as-op { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 10px; }
.as-campo { display: grid; gap: 5px; min-width: 0; }
.as-campo > span { font-size: 12.5px; color: var(--adm-muted); font-weight: 500; }
.as-costo { display: grid; gap: 6px; max-width: 420px; }
.as-pesos { position: relative; display: block; }
.as-pesos > span { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--adm-muted); pointer-events: none; }
.as-pesos > input { padding-left: 24px; width: 100%; }
.as-nota { margin: 0; font-size: 12.5px; color: var(--adm-muted); }
.as-hecho { display: grid; gap: 14px; }
.as-hecho p { margin: 0; font-size: 14px; line-height: 1.55; }
.as-acc { display: flex; flex-wrap: wrap; gap: 10px; }
@media (max-width: 640px) {
  .as-modos, .as-buscar, .as-op { grid-template-columns: 1fr; }
  .as-tel { margin-left: 0; width: 100%; }
}
`;
