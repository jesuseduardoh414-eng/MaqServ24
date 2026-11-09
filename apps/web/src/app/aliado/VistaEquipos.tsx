'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ajustarUnidades, textoUnidad, unidadVacia, type UnidadEquipo } from '@maqserv/config';
import { ShDatePicker } from '@maqserv/ui';
import { Icon } from '@/components/Icon';
import { pedirTexto } from '@/components/Dialogos';
import { OfrecerEquipo } from './OfrecerEquipo';
import { UnidadesEditor } from './UnidadesEditor';
import { API, Chip, ESTADO_EQUIPO, Encabezado, Insignia, Vacio, avisar, diaCorto, hace, hoyLocal, llamar } from './comun';
import type { Oferta } from './oferta';
import type { DatosPortal, Equipo } from './tipos';

/**
 * EQUIPOS (2026-10-27): los que tiene dados de alta, filtrados por cómo están.
 *
 * Libres / ocupados / en mantenimiento / nuevos (los revisa MAQSER24), con el conteo en la
 * pestaña. Aquí mismo dice dónde está cada uno y lo manda a mantenimiento:
 * mientras dure no se le ofrece (2026-10-26, ya no se confirma cada 14 días).
 *
 * Y en máquinas y vehículos, cada unidad con su número económico y sus placas
 * (2026-11-09): "Unidades" abre una fila por unidad; agregar o quitar una fila
 * es tener una más o una menos.
 */

/** Las filas para editar: las que ya tiene y, si faltan, vacías hasta completar sus unidades. */
const filasDe = (e: Equipo): UnidadEquipo[] => {
  const ident = e.identificacion ?? [];
  const n = Math.max(1, e.unidades ?? 1);
  return ident.length >= n ? ident : ajustarUnidades(ident, n);
};

type Filtro = 'todos' | 'libres' | 'ocupados' | 'mantenimiento' | 'revision';

const claseDe = (e: Equipo): Exclude<Filtro, 'todos' | 'revision'> =>
  e.mantenimiento || e.state === 'mantenimiento' ? 'mantenimiento' : e.state === 'disponible' || e.state === 'limitada' ? 'libres' : 'ocupados';

export function VistaEquipos({ datos, oferta }: { datos: DatosPortal; oferta: Oferta }) {
  const router = useRouter();
  const { equipos } = datos;
  const propuestas = datos.propuestas ?? [];
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [ofreciendo, setOfreciendo] = useState(false);
  const [ocupado, setOcupado] = useState<number | null>(null);
  /** Equipo con el formulario de mantenimiento abierto. */
  const [mantAbierto, setMantAbierto] = useState<number | null>(null);
  const [mantDesde, setMantDesde] = useState('');
  const [mantHasta, setMantHasta] = useState('');
  const [mantNota, setMantNota] = useState('');
  /** Equipo con sus unidades abiertas para editar (2026-11-09). */
  const [unAbierto, setUnAbierto] = useState<number | null>(null);
  const [filasUn, setFilasUn] = useState<UnidadEquipo[]>([]);

  function abrirUnidades(e: Equipo) {
    setMantAbierto(null);
    setFilasUn(filasDe(e));
    setUnAbierto(unAbierto === e.id ? null : e.id);
  }

  async function guardarUnidades(productId: number) {
    setOcupado(productId);
    const ok = await llamar(`${API}/aliado/equipos/${productId}/unidades`, { unidades: filasUn }, 'PUT');
    setOcupado(null);
    if (ok) {
      setUnAbierto(null);
      avisar(`Listo: ${filasUn.length} ${filasUn.length === 1 ? 'unidad' : 'unidades'} guardadas.`);
      router.refresh();
    }
  }

  const cuenta: Record<Filtro, number> = {
    todos: equipos.length,
    libres: equipos.filter((e) => claseDe(e) === 'libres').length,
    ocupados: equipos.filter((e) => claseDe(e) === 'ocupados').length,
    mantenimiento: equipos.filter((e) => claseDe(e) === 'mantenimiento').length,
    revision: propuestas.length,
  };
  const pestanas: Array<[Filtro, string]> = [
    ['todos', 'Todos'], ['libres', 'Libres'], ['ocupados', 'Ocupados'], ['mantenimiento', 'En mantenimiento'], ['revision', 'Nuevos'],
  ];
  const visibles = filtro === 'todos' ? equipos : filtro === 'revision' ? [] : equipos.filter((e) => claseDe(e) === filtro);
  const verPropuestas = (filtro === 'todos' || filtro === 'revision') && propuestas.length > 0;

  async function ponerMantenimiento(productId: number) {
    if (!mantDesde) { avisar('Elige desde cuándo.', false); return; }
    setOcupado(productId);
    const ok = await llamar(`${API}/aliado/equipos/${productId}/mantenimiento`, { desde: mantDesde, hasta: mantHasta || null, nota: mantNota.trim() || null }, 'POST');
    setOcupado(null);
    if (ok) {
      setMantAbierto(null); setMantHasta(''); setMantNota('');
      avisar('Listo: no te ofreceremos ese equipo en esas fechas.');
      router.refresh();
    }
  }

  async function quitarMantenimiento(productId: number, blockId: number) {
    setOcupado(productId);
    const ok = await llamar(`${API}/aliado/equipos/${productId}/mantenimiento/${blockId}`, undefined, 'DELETE');
    setOcupado(null);
    if (ok) { avisar('Listo: ya se le puede ofrecer.'); router.refresh(); }
  }

  async function moverEquipo(productId: number, actual: string | null) {
    const donde = await pedirTexto({
      titulo: '¿Dónde está ahora este equipo?',
      mensaje: 'Municipio, obra o patio. Así MAQSER24 sabe a qué obras le queda cerca.',
      valor: actual ?? '',
      placeholder: 'Ej. Patio en Apodaca',
      confirmar: 'Guardar ubicación',
    });
    if (donde === null) return;
    setOcupado(productId);
    const ok = await llamar(`${API}/aliado/equipos/${productId}/ubicacion`, { location: donde });
    setOcupado(null);
    if (ok) { avisar('Ubicación actualizada.'); router.refresh(); }
  }

  return (
    <>
      <Encabezado
        titulo={oferta.tituloEquipos}
        desc={equipos.length > 0 ? 'Solo te proponemos lo que sabemos que está libre: si una máquina sale de circulación, márcala en mantenimiento.' : 'Lo que agregues de la lista cuenta en ese momento: te empiezan a llegar sus solicitudes.'}
        accion={!ofreciendo && oferta.lineasOferta.length > 0 ? (
          <button type="button" className="ms-btn" onClick={() => setOfreciendo(true)}>
            <Icon name="box" size={16} />{oferta.botonOfrecer}
          </button>
        ) : null}
      />

      {ofreciendo ? (
        <OfrecerEquipo
          lineas={oferta.lineasOferta}
          tipos={datos.tipos ?? {}}
          onCerrar={() => setOfreciendo(false)}
          onEnviado={(nombre, nuevo) => {
            setOfreciendo(false);
            avisar(nuevo
              ? `Recibimos "${nombre}". Es nuevo: MAQSER24 lo revisa y te avisamos por correo.`
              : `Listo: agregaste "${nombre}". Ya te llegan las solicitudes de ese tipo.`);
            router.refresh();
          }}
        />
      ) : null}

      {equipos.length === 0 && propuestas.length === 0 ? (
        !ofreciendo ? (
          <Vacio
            icono="box"
            titulo={`Todavía no tienes ${oferta.queOfrece}`}
            texto={<>Toca <strong style={{ color: 'var(--color-text)' }}>&quot;{oferta.botonOfrecer}&quot;</strong> y elige qué tienes de la lista: en ese momento te empiezan a llegar sus solicitudes.</>}
            accion={oferta.lineasOferta.length > 0 ? { texto: oferta.botonOfrecer, icono: 'box', onClick: () => setOfreciendo(true) } : undefined}
          />
        ) : null
      ) : (
        <>
          <div className="al-sub" role="tablist" aria-label="Qué equipos ver">
            {pestanas.filter(([f]) => f === 'todos' || cuenta[f] > 0).map(([f, texto]) => (
              <button key={f} type="button" role="tab" className="ms-tab" aria-selected={filtro === f} onClick={() => setFiltro(f)}>
                {texto}<Insignia n={cuenta[f]} tono={f === 'revision' ? 'warn' : 'muted'} />
              </button>
            ))}
          </div>

          {verPropuestas ? (
            <div className="ms-panel al-lista al-revision">
              <div className="al-lista-h">
                <h2 className="ms-h3">Nuevos: los revisa MAQSER24</h2>
                <span className="ms-small ms-muted">No estaban en la lista; te avisamos por correo</span>
              </div>
              {propuestas.map((e) => (
                <div key={e.id} className="al-lista-i" style={{ flexWrap: 'nowrap' }}>
                  {e.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.image} alt="" />
                  ) : null}
                  <div style={{ flex: 1 }}>
                    <div className="al-lista-t">{e.name}</div>
                    <span className="al-lista-s">{e.brand ? `${e.brand} · ` : ''}enviado {hace(e.createdAt)}</span>
                  </div>
                  <Chip tono="warn">Por revisar</Chip>
                </div>
              ))}
            </div>
          ) : null}

          {visibles.length === 0 && filtro !== 'revision' ? (
            <p className="ms-muted" style={{ margin: 0, fontSize: 14 }}>No tienes {oferta.oferta} {filtro === 'libres' ? 'libres' : filtro === 'ocupados' ? 'ocupados' : 'en mantenimiento'} ahora mismo.</p>
          ) : null}

          {visibles.length > 0 ? (
            <div className="ms-rows">
              {visibles.map((e) => {
                const est = ESTADO_EQUIPO[e.state] ?? { label: e.state, color: 'var(--estado-inactivo)' };
                const m = e.mantenimiento ?? null;
                // Lo que dice la fila además del color: hasta cuándo, en palabras.
                const detalle = m
                  ? `Mantenimiento ${m.desde > hoyLocal() ? `desde el ${diaCorto(m.desde)} ` : ''}${m.hasta ? `hasta el ${diaCorto(m.hasta)}` : 'sin fecha de regreso'}`
                  : e.state === 'disponible' || e.state === 'limitada'
                    ? 'Libre: se te puede ofrecer'
                    : e.hasta ? `Ocupado hasta el ${diaCorto(e.hasta)}` : 'Ocupado';
                // Sus unidades: las identificadas con su económico y placas, y cuántas faltan.
                const n = Math.max(1, e.unidades ?? 1);
                const identificadas = (e.identificacion ?? []).filter((u) => !unidadVacia(u));
                const sinId = Math.max(0, n - identificadas.length);
                return (
                  <div key={e.id} className="ms-row al-equipo" style={{ flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="al-equipo-t">
                        <b>{e.name}</b>
                        <Chip tono={est.tono} color={est.color}>{est.label}</Chip>
                      </div>
                      <div className="al-equipo-m">
                        <span><Icon name={m ? 'warning' : 'clock'} size={13} />{detalle}</span>
                        <span><Icon name="mapPin" size={13} />{e.location || 'Sin ubicación'}</span>
                        {e.identificable || n > 1 ? <span><Icon name="truck" size={13} />{n} {n === 1 ? 'unidad' : 'unidades'}</span> : null}
                      </div>
                      {e.identificable ? (
                        <div className="al-equipo-u">
                          {identificadas.map((u, i) => (
                            <span key={i} className="al-unidad"><Icon name="truck" size={12} />{textoUnidad(u)}</span>
                          ))}
                          {sinId > 0 ? (
                            identificadas.length ? (
                              <span className="al-unidad-falta">+ {sinId} sin identificar</span>
                            ) : (
                              <button type="button" className="ms-link" style={{ fontSize: 13 }} onClick={() => abrirUnidades(e)}>
                                Agregar placas y número económico
                              </button>
                            )
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="al-equipo-acts">
                      <button type="button" className="ms-btn ms-btn-sec ms-btn-sm" onClick={() => void moverEquipo(e.id, e.location)} disabled={ocupado === e.id}>
                        <Icon name="mapPin" size={14} />Dónde está
                      </button>
                      {e.identificable ? (
                        <button type="button" className="ms-btn ms-btn-sec ms-btn-sm" aria-expanded={unAbierto === e.id} onClick={() => abrirUnidades(e)} disabled={ocupado === e.id}>
                          <Icon name="truck" size={14} />Unidades
                        </button>
                      ) : null}
                      {m ? (
                        <button type="button" className="ms-btn ms-btn-sm" onClick={() => void quitarMantenimiento(e.id, m.id)} disabled={ocupado === e.id}>
                          <Icon name="check" size={14} />Ya está lista
                        </button>
                      ) : (
                        <button type="button" className="ms-btn ms-btn-sec ms-btn-sm" aria-expanded={mantAbierto === e.id} onClick={() => { setUnAbierto(null); setMantAbierto(mantAbierto === e.id ? null : e.id); setMantDesde(hoyLocal()); }} disabled={ocupado === e.id}>
                          <Icon name="warning" size={14} />Mantenimiento
                        </button>
                      )}
                    </div>
                    {mantAbierto === e.id && !m ? (
                      <div className="al-mant">
                        <div className="ms-field">
                          <span className="ms-label">Desde</span>
                          <ShDatePicker value={mantDesde} onChange={setMantDesde} min={hoyLocal()} aria-label="Desde cuándo está en mantenimiento" />
                        </div>
                        <div className="ms-field">
                          <span className="ms-label">Hasta (opcional)</span>
                          <ShDatePicker value={mantHasta} onChange={setMantHasta} min={mantDesde || hoyLocal()} placeholder="Sin fecha de regreso" aria-label="Hasta cuándo" />
                        </div>
                        <div className="ms-field" style={{ flex: '2 1 220px' }}>
                          <span className="ms-label">Nota (opcional)</span>
                          <input className="ms-input" value={mantNota} onChange={(ev) => setMantNota(ev.target.value)} maxLength={300} placeholder="Servicio de 500 horas" />
                        </div>
                        <button type="button" className="ms-btn ms-btn-sm" onClick={() => void ponerMantenimiento(e.id)} disabled={ocupado === e.id}>
                          Guardar
                        </button>
                      </div>
                    ) : null}
                    {unAbierto === e.id ? (
                      <div className="al-un-edit">
                        <div>
                          <span className="ms-label">Cada unidad, con lo que tenga a la mano</span>
                          <span className="ms-hint" style={{ display: 'block' }}>
                            Un renglón por unidad: si vendiste una, quítala; si compraste otra igual, agrégala. Las obras suelen pedir las placas para dejar entrar.
                          </span>
                        </div>
                        <UnidadesEditor filas={filasUn} onChange={setFilasUn} idBase={`un-${e.id}`} />
                        <div className="al-un-acts">
                          <button type="button" className="ms-btn ms-btn-sec ms-btn-sm" onClick={() => setUnAbierto(null)}>Cancelar</button>
                          <button type="button" className="ms-btn ms-btn-sm" onClick={() => void guardarUnidades(e.id)} disabled={ocupado === e.id}>
                            {ocupado === e.id ? 'Guardando…' : 'Guardar'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
