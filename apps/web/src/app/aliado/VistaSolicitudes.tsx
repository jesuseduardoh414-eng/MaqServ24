'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShDateTimePicker } from '@maqserv/ui';
import { Icon } from '@/components/Icon';
import { confirmar as confirmarDialogo } from '@/components/Dialogos';
import { CompartirUbicacion } from './CompartirUbicacion';
import { OperadorServicio } from './OperadorServicio';
import {
  AMBAR, API, Barra, Chip, Dato, Encabezado, ICONO_AVANCE, Insignia, LoQuePide, SIGUIENTE, Vacio, VerDocumento,
  avisar, fechaHora, hace, llamar, mananaOcho, minutosDesde, pagoTexto, type Tono,
} from './comun';
import type { Ir } from './PortalAliado';
import type { Oferta } from './oferta';
import type { DatosPortal, FiltroSolicitudes, Reciente, Ruta, Servicio, Solicitud } from './tipos';

/**
 * SOLICITUDES (2026-10-27): una bandeja, no una columna de tarjetas.
 *
 * Tres listas con pestañas —por contestar, en curso, historial— y cada una
 * ORDENADA con una regla dicha en pantalla:
 *   · Por contestar: la más antigua arriba. Es la que más urge, porque la
 *     oferta sale a varios aliados a la vez y quien contesta primero se la
 *     queda.
 *   · En curso: por la llegada que se comprometió, la más próxima arriba.
 *   · Historial: lo más reciente arriba.
 *
 * En escritorio la lista va a la izquierda y la solicitud elegida a la
 * derecha, como un correo. En teléfono se ve la lista y, al tocar una, su
 * detalle con "volver". La elegida va en la URL (`s=`): "atrás" regresa a la
 * lista y el aviso de Inicio puede abrir una en concreto.
 */

type Item = {
  clave: string;
  chip: { texto: string; tono: Tono };
  cuando: string;
  titulo: string;
  sub: string;
  monto: string | null;
  nota?: { texto: string; tono: 'warn' | 'muted' };
};

const MUY_LEJOS = 8.64e15;
const esMovil = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 840px)').matches;

/** Cómo quedó un trabajo ya contestado, en palabras del aliado. */
function resultadoDe(r: Reciente): { texto: string; tono: Tono } {
  if (r.answer === 'aceptado') return { texto: r.stateLabel, tono: r.stateLabel === 'Cerrado' ? 'ok' : 'info' };
  if (r.answer === 'retirado') return { texto: 'Te retiraste', tono: '' };
  if (r.answer === 'tomado') return { texto: r.reason === 'Se canceló el servicio' ? 'Se canceló' : 'Lo tomó otro aliado', tono: '' };
  return { texto: 'No lo tomaste', tono: '' };
}

export function VistaSolicitudes({ datos, ruta, ir, oferta }: { datos: DatosPortal; ruta: Ruta; ir: Ir; oferta: Oferta }) {
  const pendientes = [...datos.porContestar].sort((a, b) => Date.parse(a.offeredAt) - Date.parse(b.offeredAt));
  const curso = [...datos.enCurso].sort(
    (a, b) => (a.committedAt ? Date.parse(a.committedAt) : MUY_LEJOS) - (b.committedAt ? Date.parse(b.committedAt) : MUY_LEJOS),
  );
  const historial = [...(datos.recientes ?? [])].sort(
    (a, b) => (b.respondedAt ? Date.parse(b.respondedAt) : 0) - (a.respondedAt ? Date.parse(a.respondedAt) : 0),
  );

  // Sin filtro en la URL: la primera lista que tenga algo.
  const filtro: FiltroSolicitudes = ruta.filtro ?? (pendientes.length ? 'pendientes' : curso.length ? 'curso' : 'historial');

  // El mismo folio puede repetirse en el historial (se le ofreció dos veces):
  // la clave lleva un sufijo para que la selección no se confunda.
  const claves = new Map<string, number>();
  const claveDe = (folio: string) => {
    const n = (claves.get(folio) ?? 0) + 1;
    claves.set(folio, n);
    return n === 1 ? folio : `${folio}-${n}`;
  };

  const items: Item[] =
    filtro === 'pendientes'
      ? pendientes.map((s) => {
          const min = minutosDesde(s.offeredAt);
          return {
            clave: claveDe(s.quoteNumber),
            chip: { texto: 'Nueva', tono: 'info' },
            cuando: hace(s.offeredAt),
            titulo: s.category ?? 'Servicio',
            sub: `${s.address ?? 'Zona por confirmar'} · Folio ${s.quoteNumber}`,
            monto: pagoTexto(s.pago),
            nota: min >= 1440 ? { texto: `Lleva ${Math.round(min / 1440)} ${Math.round(min / 1440) === 1 ? 'día' : 'días'} esperando`, tono: 'warn' } : undefined,
          };
        })
      : filtro === 'curso'
        ? curso.map((s) => {
            const sig = SIGUIENTE[s.state ?? 'asignado'];
            return {
              clave: claveDe(s.quoteNumber),
              chip: { texto: s.stateLabel ?? 'Asignado', tono: 'info' },
              cuando: s.committedAt ? `Llegas ${fechaHora(s.committedAt)}` : '',
              titulo: s.site ?? s.category ?? 'Servicio',
              sub: `${s.category ? `${s.category} · ` : ''}Folio ${s.quoteNumber}`,
              monto: pagoTexto(s.pago),
              nota: sig ? { texto: `Siguiente paso: ${sig.texto.toLowerCase()}`, tono: 'muted' } : undefined,
            };
          })
        : historial.map((r) => {
            const res = resultadoDe(r);
            return {
              clave: claveDe(r.quoteNumber),
              chip: { texto: res.texto, tono: res.tono },
              cuando: r.respondedAt ? hace(r.respondedAt) : '',
              titulo: r.site ?? r.category ?? 'Servicio',
              sub: `${r.site && r.category ? `${r.category} · ` : ''}Folio ${r.quoteNumber}`,
              monto: r.answer === 'aceptado' ? pagoTexto(r.pago) : null,
            };
          });

  // La elegida: la de la URL si sigue en la lista; si no, en escritorio la
  // primera (el CSS esconde el detalle en teléfono mientras no se toque una).
  const explicita = ruta.seleccion && items.some((i) => i.clave === ruta.seleccion) ? ruta.seleccion : null;
  const abierta = explicita ?? items[0]?.clave ?? null;
  const indice = items.findIndex((i) => i.clave === abierta);

  useEffect(() => {
    if (!explicita) return;
    if (esMovil()) window.scrollTo({ top: 0 });
    else document.getElementById('so-detalle')?.scrollIntoView({ block: 'start' });
  }, [explicita]);

  const elegir = (clave: string) => ir({ vista: 'solicitudes', filtro, seleccion: clave }, esMovil() ? 'push' : 'replace');
  const volver = () => ir({ vista: 'solicitudes', filtro });
  const cambiarFiltro = (f: FiltroSolicitudes) => ir({ vista: 'solicitudes', filtro: f }, 'replace');

  const pestanas: Array<{ f: FiltroSolicitudes; texto: string; n: number; tono: 'info' | 'muted' }> = [
    { f: 'pendientes', texto: 'Por contestar', n: pendientes.length, tono: 'info' },
    { f: 'curso', texto: 'En curso', n: curso.length, tono: 'muted' },
    { f: 'historial', texto: 'Historial', n: historial.length, tono: 'muted' },
  ];

  const orden: Record<FiltroSolicitudes, string> = {
    pendientes: 'La más antigua arriba: es la que más urge. La oferta sale a varios aliados a la vez y quien contesta primero se la queda.',
    curso: 'Por la llegada que te comprometiste: lo más próximo arriba.',
    historial: 'Tus últimos trabajos contestados, el más reciente arriba.',
  };

  return (
    <>
      <Encabezado titulo="Solicitudes" desc="Lo que te ofrecemos, lo que traes y lo que ya pasó. Cada lista tiene su orden." />

      <div className="al-barra-sup">
        <div className="al-sub" role="tablist" aria-label="Qué solicitudes ver">
          {pestanas.map((p) => (
            <button key={p.f} type="button" role="tab" className="ms-tab" aria-selected={filtro === p.f} onClick={() => cambiarFiltro(p.f)}>
              {p.texto}<Insignia n={p.n} tono={p.tono} />
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        filtro === 'pendientes' ? (
          <Vacio icono="bell" titulo="Nada pendiente por ahora" texto={<>Cuando un cliente pida algo de tus {oferta.oferta}, aparece aquí y te avisamos por correo al instante.</>} />
        ) : filtro === 'curso' ? (
          <Vacio icono="truck" titulo="No traes trabajos en curso" texto="Lo que aceptes aparece aquí con la obra, el contacto y los botones para reportar cada avance." tono="muted" />
        ) : (
          <Vacio icono="clock" titulo="Todavía no has contestado solicitudes" texto="Aquí queda en qué terminó cada trabajo que te ofrecimos: lo que tomaste, lo que no y por qué." tono="muted" />
        )
      ) : (
        <>
          <p className="al-orden"><Icon name="chevronDown" size={14} />{orden[filtro]}</p>
          <div className="so-grid" data-abierto={Boolean(explicita)}>
            <div className="so-lista" role="list" aria-label="Solicitudes">
              {items.map((i, n) => (
                <button key={i.clave} type="button" role="listitem" className="so-fila" aria-current={abierta === i.clave ? 'true' : undefined} onClick={() => elegir(i.clave)}>
                  <span className="so-fila-top">
                    <Chip tono={i.chip.tono}>{filtro === 'pendientes' ? `${n + 1}. ${i.chip.texto}` : i.chip.texto}</Chip>
                    <span className="ms-num">{i.cuando}</span>
                  </span>
                  <span className="so-fila-t">{i.titulo}</span>
                  {i.monto ? <span className="so-fila-m">{i.monto}</span> : null}
                  <span className="so-fila-s">{i.sub}</span>
                  {i.nota ? <span className="so-fila-n" data-tono={i.nota.tono}><Icon name={i.nota.tono === 'warn' ? 'warning' : 'arrowRight'} size={13} />{i.nota.texto}</span> : null}
                  {/* Solo en teléfono: ahí la fila abre otra pantalla y conviene decirlo. */}
                  <span className="so-fila-ir" aria-hidden>Ver detalle<Icon name="chevronRight" size={13} /></span>
                </button>
              ))}
            </div>

            <div className="so-detalle" id="so-detalle">
              <button type="button" className="ms-link ms-link-muted so-volver" onClick={volver}>
                <Icon name="arrowLeft" size={14} />Todas las solicitudes
              </button>
              {indice < 0 ? (
                <div className="so-sugerencia">Elige una de la lista para ver el detalle.</div>
              ) : filtro === 'pendientes' ? (
                <TarjetaSolicitud key={abierta} s={pendientes[indice]!} numero={indice + 1} ir={ir} />
              ) : filtro === 'curso' ? (
                <TarjetaServicio key={abierta} s={curso[indice]!} />
              ) : (
                <TarjetaReciente key={abierta} r={historial[indice]!} />
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ───────────────────────── por contestar ─────────────────────────

/**
 * Una oferta de trabajo. Aceptar pide CUÁNDO LLEGA; rechazar pide MOTIVO.
 * Por contestar solo va la zona: la obra, la calle y el contacto se ven al
 * aceptar (la oferta sale a varios aliados a la vez, 2026-10-23).
 */
function TarjetaSolicitud({ s, numero, ir }: { s: Solicitud; numero: number; ir: Ir }) {
  const router = useRouter();
  const [modo, setModo] = useState<'aceptar' | 'rechazar' | null>(null);
  const [llegada, setLlegada] = useState(mananaOcho());
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function contestar(estado: 'aceptado' | 'rechazado') {
    if (estado === 'rechazado' && !motivo.trim()) {
      avisar('Cuéntanos por qué no puedes: nos sirve para no volver a ofrecerte lo mismo.', false);
      return;
    }
    setOcupado(true);
    const ok = await llamar(`${API}/aliado/solicitudes/${s.assignmentId}`, {
      estado,
      ...(estado === 'rechazado' ? { motivo: motivo.trim() } : {}),
      ...(estado === 'aceptado' && llegada ? { llegada: new Date(llegada).toISOString() } : {}),
    });
    setOcupado(false);
    if (!ok) return;
    setModo(null);
    if (estado === 'aceptado') {
      avisar('Listo, quedó tuyo. Te mandamos los datos de la obra por correo.');
      // Ya es suyo: pasa a "En curso", donde están la obra, el contacto y el avance.
      ir({ vista: 'solicitudes', filtro: 'curso', seleccion: s.quoteNumber }, 'replace');
    } else {
      avisar('Gracias por avisarnos.');
    }
    router.refresh();
  }

  return (
    <article className="ms-panel al-nueva">
      <div className="al-card-top">
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip tono="info">{numero}. Nueva</Chip>
            <span className="al-folio">{hace(s.offeredAt)} · Folio {s.quoteNumber}</span>
          </div>
          <h2 className="al-card-t">{s.category ?? 'Servicio'}</h2>
        </div>
        {pagoTexto(s.pago) ? (
          <div className="al-importe" title="Lo que te pagamos por este servicio">
            <span className="al-dato-l">Te pagamos</span>
            <b>{pagoTexto(s.pago)}</b>
          </div>
        ) : null}
      </div>

      <div className="al-dos" style={{ marginTop: 16 }}>
        <Dato label="Zona" valor={s.address ?? 'Por confirmar'} />
        <Dato label="Obra y contacto" valor="Los ves al aceptar" />
      </div>

      <LoQuePide pedido={s.pedido} />

      {/* La cotización que el cliente aceptó, partida por partida (2026-10-15),
          y el documento completo para verlo o imprimirlo (2026-10-19). */}
      {s.partidas?.length || s.documento ? (
        <div className="al-pide">
          <span className="al-dato-l">Cotización{s.documento ? ` ${s.documento}` : ''}</span>
          {s.partidas?.length ? (
            <dl>
              {s.partidas.map((p, i) => (
                <div key={i}>
                  <dt>{p.concepto}</dt>
                  <dd style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>{p.cantidad}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {s.documento ? <div><VerDocumento assignmentId={s.assignmentId} /></div> : null}
        </div>
      ) : null}

      {s.detail ? <div className="al-detalle">{s.detail}</div> : null}

      {s.requirements.length > 0 ? (
        <div className="ms-alert ms-alert-warn" style={{ marginTop: 12, fontSize: 13.5 }}>
          <span style={{ color: AMBAR, display: 'flex', marginTop: 2 }}><Icon name="warning" size={15} /></span>
          <span><strong>Esta obra exige:</strong> {s.requirements.join(' · ')}</span>
        </div>
      ) : null}

      {modo === 'aceptar' ? (
        <div className="al-form">
          <div className="ms-field">
            <span className="ms-label">¿Cuándo llegas a la obra?</span>
            <ShDateTimePicker value={llegada} onChange={setLlegada} min={new Date().toISOString().slice(0, 10)} aria-label="¿Cuándo llegas a la obra?" />
            <span className="ms-hint">Es tu compromiso con el cliente y contra él medimos tu puntualidad.</span>
          </div>
          <div className="al-acciones" style={{ marginTop: 0 }}>
            <button type="button" className="ms-btn" disabled={ocupado} onClick={() => void contestar('aceptado')}>
              <Icon name="check" size={16} />Confirmar que lo tomo
            </button>
            <button type="button" className="ms-btn ms-btn-sec al-cancelar" onClick={() => setModo(null)}>Cancelar</button>
          </div>
        </div>
      ) : modo === 'rechazar' ? (
        <div className="al-form">
          <label className="ms-field">
            <span className="ms-label">¿Por qué no puedes tomarlo?</span>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="La máquina está en otra obra, no llego a esa zona…" className="ms-textarea" style={{ minHeight: 80 }} />
          </label>
          <div className="al-acciones" style={{ marginTop: 0 }}>
            <button type="button" className="ms-btn" disabled={ocupado} onClick={() => void contestar('rechazado')}>Enviar respuesta</button>
            <button type="button" className="ms-btn ms-btn-sec al-cancelar" onClick={() => setModo(null)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="al-acciones">
          <button type="button" className="ms-btn" onClick={() => setModo('aceptar')}>
            <Icon name="check" size={16} />Sí puedo
          </button>
          <button type="button" className="ms-btn ms-btn-sec" onClick={() => { setModo('rechazar'); setMotivo(''); }}>
            <Icon name="x" size={16} />No puedo
          </button>
        </div>
      )}
    </article>
  );
}

// ───────────────────────── en curso ─────────────────────────

/** Un trabajo suyo: la obra, el contacto, el operador y el siguiente paso. */
function TarjetaServicio({ s }: { s: Servicio }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const sig = SIGUIENTE[s.state ?? 'asignado'];

  /** "Ya salió", "Llegué"…: le avisa al cliente (campana y correo) y al panel. */
  async function reportarAvance(estado: string) {
    const paso = Object.values(SIGUIENTE).find((x) => x?.estado === estado);
    if (paso && !(await confirmarDialogo({ titulo: `¿${paso.texto}?`, mensaje: paso.ayuda, confirmar: `Sí, ${paso.texto.charAt(0).toLowerCase()}${paso.texto.slice(1)}` }))) return;
    setOcupado(true);
    const ok = await llamar(`${API}/aliado/servicios/${encodeURIComponent(s.quoteNumber)}/avance`, { estado });
    setOcupado(false);
    if (ok) { avisar('Listo: el cliente y MAQSER24 ya lo saben.'); router.refresh(); }
  }

  return (
    <article className="ms-panel">
      <div className="al-card-top" style={{ alignItems: 'center' }}>
        <div>
          <h2 className="al-card-t" style={{ margin: 0, fontSize: 17 }}>{s.site ?? s.category ?? 'Servicio'}</h2>
          <div className="al-folio" style={{ marginTop: 2 }}>
            {s.category ?? ''}{s.category ? ' · ' : ''}Folio {s.quoteNumber}{pagoTexto(s.pago) ? ` · te pagamos ${pagoTexto(s.pago)}` : ''}
          </div>
        </div>
        <Chip tono="info">{s.stateLabel ?? 'Asignado'}</Chip>
      </div>
      <div style={{ marginTop: 14 }}><Barra valor={s.progress ?? 0} /></div>
      <div className="al-dos" style={{ marginTop: 16 }}>
        <Dato label="Llegada comprometida" valor={fechaHora(s.committedAt)} />
        <Dato label="Dirección" valor={s.address} />
        <Dato label="Quién te recibe" valor={s.contactName} />
        <Dato label="Teléfono en obra" valor={s.contactPhone ? <a href={`tel:${s.contactPhone}`}>{s.contactPhone}</a> : null} />
      </div>
      <LoQuePide pedido={s.pedido} />
      {s.documento && s.assignmentId ? <VerDocumento assignmentId={s.assignmentId} folio={s.documento} /> : null}
      {s.requirements.length > 0 ? (
        <div className="al-exige">
          <Icon name="warning" size={14} /><span>Exige: {s.requirements.join(' · ')}</span>
        </div>
      ) : null}
      {/* Quién maneja la unidad: su enlace comparte la ubicación (2026-10-15). */}
      {s.state !== 'terminado' ? <OperadorServicio quoteNumber={s.quoteNumber} inicial={s.operador ?? null} /> : null}
      {/* En camino: el teléfono comparte dónde va (2026-10-14). */}
      {s.state === 'en_traslado' ? <CompartirUbicacion quoteNumber={s.quoteNumber} /> : null}
      {/* Reporta el avance: el cliente y MAQSER24 se enteran al instante. Un botón a la vez. */}
      {sig ? (
        <div className="al-avance">
          <button type="button" className="ms-btn ms-btn-block" disabled={ocupado} onClick={() => void reportarAvance(sig.estado)}>
            <Icon name={ICONO_AVANCE[sig.estado] ?? 'arrowRight'} size={16} />{sig.texto}
          </button>
          <span className="ms-hint">{sig.ayuda}</span>
        </div>
      ) : s.state === 'terminado' ? (
        <p className="ms-hint" style={{ marginTop: 14, fontSize: 13 }}>Reportaste que terminaste. MAQSER24 registra horas o viajes y cierra el servicio.</p>
      ) : null}
    </article>
  );
}

// ───────────────────────── historial ─────────────────────────

/** En qué quedó un trabajo ya contestado. Solo consulta. */
function TarjetaReciente({ r }: { r: Reciente }) {
  const res = resultadoDe(r);
  const acepto = r.answer === 'aceptado';
  return (
    <article className="ms-panel">
      <div className="al-card-top" style={{ alignItems: 'center' }}>
        <div>
          <h2 className="al-card-t" style={{ margin: 0, fontSize: 17 }}>{r.site ?? r.category ?? 'Servicio'}</h2>
          <div className="al-folio" style={{ marginTop: 2 }}>{r.category && r.site ? `${r.category} · ` : ''}Folio {r.quoteNumber}</div>
        </div>
        <Chip tono={res.tono}>{res.texto}</Chip>
      </div>
      <div className="al-dos" style={{ marginTop: 16 }}>
        <Dato label="Contestaste" valor={r.respondedAt ? `${fechaHora(r.respondedAt)} (${hace(r.respondedAt)})` : null} />
        <Dato label={acepto ? 'Te pagamos' : 'Resultado'} valor={acepto ? pagoTexto(r.pago) : res.texto} />
        {acepto ? <Dato label="El servicio" valor={r.stateLabel} /> : null}
        {!acepto && r.reason && r.answer !== 'tomado' ? <Dato label="Tu motivo" valor={`“${r.reason}”`} /> : null}
      </div>
      {acepto ? <div style={{ marginTop: 14 }}><Barra valor={r.progress ?? 0} /></div> : null}
    </article>
  );
}
