'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminSelect } from '@/components/AdminSelect';
import { Modal } from '@/components/Modal';
import {
  Bar, Btn, Chip, EmptyState, FormField, Note, PageHeader, Panel, SearchBox, Segmented, Stat, Stats, StatusText, Toolbar, type Tone,
} from '@/components/ui';
import { Incidencias, VentanaFormulario } from './Incidencias';
import { useRouter } from 'next/navigation';
import { MapaCobertura, type PuntoMapa } from '@/app/proveedores/MapaCobertura';

/**
 * TABLERO DE OPERACIONES.
 *
 * Está armado alrededor de una sola pregunta: ¿qué hay que empujar hoy? Por eso
 * los cerrados y cancelados NO salen por defecto —el archivo es otra cosa— y
 * cada servicio muestra su siguiente paso como botón, no como un selector que
 * obligue a saberse los estados de memoria.
 */

export interface ServicioRow {
  id: number;
  quoteNumber: string;
  client: string;
  phone: string | null;
  category: string | null;
  address: string | null;
  state: string;
  stateLabel: string;
  stateHint: string;
  progress: number;
  next: Array<{ state: string; label: string }>;
  units: Array<{ clave: string; label: string }>;
  defaultUnit: string;
  closed: string | null;
  total: number;
  acceptedAt: string | null;
  /** Aliados que tienen publicado el equipo pedido (sugerencia para asignar). */
  suggested?: string | null;
  startedAt: string | null;
  closedAt: string | null;
  assignments: Array<{
    id: number;
    providerId: number;
    provider: string;
    phone: string | null;
    state: string;
    scope: string | null;
    reason: string | null;
    offeredAt: string | null;
    respondedAt: string | null;
  }>;
}

const TONO_ESTADO: Record<string, Tone> = {
  por_asignar: 'warn',
  asignado: 'accent',
  en_traslado: 'accent',
  en_sitio: 'accent',
  en_curso: 'accent',
  terminado: 'ok',
  cerrado: 'muted',
  cancelado: 'bad',
};

const ESTADO_ASIGNACION: Record<string, { texto: string; tono: Tone }> = {
  propuesto: { texto: 'Esperando respuesta', tono: 'warn' },
  aceptado: { texto: 'Aceptó', tono: 'ok' },
  rechazado: { texto: 'Rechazó', tono: 'bad' },
  retirado: { texto: 'Se retiró', tono: 'muted' },
};

/** Estados en los que ya hay aliado trabajando (o a punto de salir). */
const EN_OPERACION = ['asignado', 'en_traslado', 'en_sitio', 'en_curso'];

const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fecha(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ServicesBoard({ initial, historial = false }: { initial: ServicioRow[]; historial?: boolean }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState('');
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Servicio cuyo cierre se está capturando. */
  const [cerrando, setCerrando] = useState<ServicioRow | null>(null);
  /** Servicio al que se le está buscando aliado. */
  const [asignando, setAsignando] = useState<ServicioRow | null>(null);
  /** Servicio cuyas incidencias se están viendo. */
  const [incidencias, setIncidencias] = useState<ServicioRow | null>(null);
  /**
   * Que hacer con cada servicio, segun el alterno. Se pide UNA vez para todo
   * el tablero al montar: uno por tarjeta serian tantas peticiones como
   * servicios cada vez que alguien abre la pantalla.
   */
  const [acciones, setAcciones] = useState<Record<number, { accion: string | null; alternativas: number }>>({});

  useEffect(() => {
    let vivo = true;
    // Solo los que aun no tienen a nadie trabajando: un servicio en curso no
    // necesita alterno, y preguntarlo seria gastar viajes para nada.
    const pendientes = initial.filter((s) => !s.assignments.some((a) => a.state === 'aceptado'));
    Promise.all(
      pendientes.map((s) =>
        fetch(`/api/admin/quotes/${s.id}/alterno`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => [s.id, d] as const)
          .catch(() => [s.id, null] as const),
      ),
    ).then((pares) => {
      if (!vivo) return;
      const mapa: Record<number, { accion: string | null; alternativas: number }> = {};
      for (const [id, d] of pares) {
        if (d) mapa[id] = { accion: d.accion, alternativas: d.alternativas?.length ?? 0 };
      }
      setAcciones(mapa);
    });
    return () => { vivo = false; };
  }, [initial]);

  const filtrados = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return initial;
    return initial.filter((s) =>
      [s.quoteNumber, s.client, s.category, s.address, s.stateLabel]
        .some((v) => v?.toLowerCase().includes(q)),
    );
  }, [initial, filtro]);

  // Conteos de lo que ya está en pantalla: responden "¿qué hay que empujar?"
  // antes de bajar por las tarjetas.
  const cuenta = useMemo(() => ({
    total: initial.length,
    porAsignar: initial.filter((s) => s.state === 'por_asignar').length,
    esperando: initial.filter((s) => s.assignments.some((a) => a.state === 'propuesto')).length,
    enOperacion: initial.filter((s) => EN_OPERACION.includes(s.state)).length,
    porCerrar: initial.filter((s) => s.state === 'terminado').length,
  }), [initial]);

  async function mover(s: ServicioRow, state: string, extra?: { quantity?: number; unit?: string; note?: string }) {
    setOcupado(s.id);
    setError(null);
    try {
      const r = await fetch(`/api/admin/services/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, ...extra }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        // El mensaje viene de la API porque ahí vive la regla: repetirla aquí
        // sería tener dos versiones de la verdad que se desincronizan.
        throw new Error(j?.message ?? 'No se pudo mover el servicio.');
      }
      setCerrando(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo mover el servicio.');
    } finally {
      setOcupado(null);
    }
  }

  async function responderAliado(asignacionId: number, state: string, reason?: string) {
    setError(null);
    const r = await fetch(`/api/admin/services/asignaciones/${asignacionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, reason }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      setError(j?.message ?? 'No se pudo registrar la respuesta.');
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <style>{`
        .srv-card { padding: 16px 18px; }
        .srv-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px 16px; flex-wrap: wrap; }
        .srv-asig { display: flex; justify-content: space-between; align-items: center; gap: 8px 12px; flex-wrap: wrap; padding: 8px 0; border-bottom: 1px solid var(--adm-border); }
        .srv-asig:last-child { border-bottom: 0; padding-bottom: 0; }
        .srv-acciones { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--adm-border); }
        @media (max-width: 560px) {
          .srv-card { padding: 14px; }
          .srv-precio { align-items: flex-start !important; }
        }
      `}</style>

      <PageHeader
        eyebrow={['3 · Ejecutar', 'Operaciones']}
        title="Servicios"
        subtitle={
          <>
            Lo que pasa después de que el cliente acepta: a quién se le asignó, en qué va y con qué se cerró.
            {historial ? ' Estás viendo también los cerrados y cancelados.' : ' Los cerrados y cancelados se consultan en el historial.'}
          </>
        }
      />

      <Stats>
        <Stat label="Servicios" icon="ph-truck" tone="accent" value={cuenta.total} hint={historial ? 'con cerrados y cancelados' : 'en curso'} />
        <Stat
          label="Por asignar"
          icon="ph-user-plus"
          tone={cuenta.porAsignar > 0 ? 'warn' : 'muted'}
          value={cuenta.porAsignar}
          hint="sin aliado confirmado"
        />
        <Stat label="Esperando respuesta" icon="ph-hourglass-medium" tone={cuenta.esperando > 0 ? 'info' : 'muted'} value={cuenta.esperando} hint="de un aliado" />
        <Stat label="En operación" icon="ph-steering-wheel" tone="accent" value={cuenta.enOperacion} hint="asignados o en marcha" />
        <Stat
          label="Por cerrar"
          icon="ph-flag-checkered"
          tone={cuenta.porCerrar > 0 ? 'ok' : 'muted'}
          value={cuenta.porCerrar}
          hint="terminados, falta el cierre"
        />
      </Stats>

      <Toolbar end={`${filtrados.length} de ${initial.length}`}>
        <SearchBox
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar por folio, cliente, servicio o zona…"
          aria-label="Buscar servicio"
          style={{ maxWidth: 420 }}
        />
        {/* Historial (2026-10-05): antes un servicio cerrado desaparecía y no había forma de verlo. */}
        <Segmented
          ariaLabel="Qué servicios ver"
          value={historial ? 'todos' : 'curso'}
          items={[
            { key: 'curso', label: 'En curso', href: '/servicios' },
            { key: 'todos', label: 'Todos, con cerrados y cancelados', href: '/servicios?historial=1' },
          ]}
        />
      </Toolbar>

      {error ? <Note tone="bad" style={{ marginBottom: 14 }}>{error}</Note> : null}

      {filtrados.length === 0 ? (
        <Panel flush>
          <EmptyState
            icon="ph-truck"
            title={initial.length === 0 ? 'No hay servicios activos' : 'Sin resultados'}
            sub={initial.length === 0 ? 'Un servicio entra aquí cuando el cliente acepta su cotización.' : 'Prueba con otro término.'}
          />
        </Panel>
      ) : null}

      {/* Cada servicio sigue siendo una tarjeta: lleva aliados con su propia
          respuesta, avisos y los botones de su siguiente paso. Una fila de
          tabla no aguanta todo eso sin esconder lo que hay que hacer. */}
      <div style={{ display: 'grid', gap: 12 }}>
        {filtrados.map((s) => {
          const tono = TONO_ESTADO[s.state] ?? 'accent';
          const aceptado = s.assignments.filter((a) => a.state === 'aceptado');
          const esperando = s.assignments.filter((a) => a.state === 'propuesto');
          const alterno = acciones[s.id];

          return (
            <article key={s.id} className="adm-card srv-card">
              <div className="srv-top">
                <div style={{ minWidth: 0, flex: '1 1 300px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px 10px', flexWrap: 'wrap' }}>
                    <span className="adm-cell-title" style={{ fontSize: 15 }}>{s.client}</span>
                    <span className="adm-mono" style={{ fontSize: 12, color: 'var(--adm-faint)' }}>{s.quoteNumber}</span>
                  </div>
                  <div className="adm-cell-sub" style={{ marginTop: 3 }}>
                    {s.category ?? 'Sin línea de servicio'}
                    {s.address ? ` · ${s.address}` : ''}
                    {s.phone ? <> · <span className="adm-mono">{s.phone}</span></> : null}
                  </div>
                </div>

                <div className="srv-precio" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                  <StatusText tone={tono}>{s.stateLabel}</StatusText>
                  <span className="adm-num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--adm-text)' }}>{money(s.total)}</span>
                </div>
              </div>

              {/* Barra de avance: dice de un vistazo qué tan lejos va sin
                  obligar a leer el nombre del estado. */}
              <div style={{ margin: '12px 0 6px' }}>
                <Bar pct={Math.round(s.progress * 100)} tone={tono} label={`Avance: ${s.stateLabel}`} />
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--adm-muted)', lineHeight: 1.55 }}>{s.stateHint}</div>

              {/* Aliados */}
              {s.assignments.length > 0 ? (
                <div style={{ marginTop: 12, paddingTop: 4, borderTop: '1px solid var(--adm-border)' }}>
                  {s.assignments.map((a) => {
                    const e = ESTADO_ASIGNACION[a.state] ?? { texto: a.state, tono: 'muted' as Tone };
                    return (
                      <div key={a.id} className="srv-asig">
                        <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '2px 10px', flexWrap: 'wrap', fontSize: 13.5 }}>
                          <span style={{ fontWeight: 600, color: 'var(--adm-text)' }}>{a.provider}</span>
                          <StatusText tone={e.tono}>{e.texto}</StatusText>
                          {a.reason ? <span style={{ color: 'var(--adm-muted)', fontSize: 12.5 }}>· {a.reason}</span> : null}
                          {a.phone ? (
                            <a href={`tel:${a.phone}`} className="adm-link adm-mono" style={{ fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <i className="ph ph-phone" aria-hidden style={{ color: 'var(--adm-muted)' }} />
                              {a.phone}
                            </a>
                          ) : null}
                        </div>
                        {a.state === 'propuesto' ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <Btn size="sm" icon="ph-check" onClick={() => responderAliado(a.id, 'aceptado')}>Aceptó</Btn>
                            <Btn
                              size="sm"
                              variant="danger"
                              icon="ph-x"
                              onClick={() => {
                                // Por qué rechazó es el dato que dice si la red
                                // alcanza para esa zona; sin él solo queda un "no".
                                const r = window.prompt('¿Por qué no puede? (para saber qué le falta a la red)');
                                if (r !== null) responderAliado(a.id, 'rechazado', r || undefined);
                              }}
                            >
                              No puede
                            </Btn>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {/* Sugeridos (2026-10-05): quién tiene publicado el equipo pedido.
                  Se anotaba en el historial pero aquí, donde se asigna, no se veía. */}
              {s.suggested && s.assignments.length === 0 ? (
                <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--adm-muted)' }}>
                  Sugeridos (tienen el equipo publicado): <span style={{ color: 'var(--adm-text)', fontWeight: 600 }}>{s.suggested}</span>
                </div>
              ) : null}

              {s.closed ? (
                <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--adm-muted)' }}>
                  Cierre: <span style={{ color: 'var(--adm-text)', fontWeight: 600 }}>{s.closed}</span> · {fecha(s.closedAt)}
                </div>
              ) : null}

              {/*
                PROVEEDOR ALTERNO. Antes, una propuesta sin respuesta se quedaba
                parada hasta que alguien se acordaba de ella. El silencio se
                mide contra lo que ESE aliado suele tardar, no contra un plazo
                fijo: cuatro horas dicen algo de quien contesta en once minutos
                y no dicen nada de quien siempre tarda dos horas y media.
              */}
              {alterno?.accion ? (
                <Note tone="warn" style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', gap: '8px 12px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--adm-text)' }}>{alterno.accion}</span>
                    {alterno.alternativas > 0 ? (
                      <Btn size="sm" onClick={() => setAsignando(s)}>Ver {alterno.alternativas} alterno(s)</Btn>
                    ) : null}
                  </div>
                </Note>
              ) : null}

              {/* Acciones */}
              <div className="srv-acciones">
                {(s.state === 'por_asignar' || esperando.length === 0) && aceptado.length === 0 ? (
                  <Btn size="sm" icon="ph-magnifying-glass" onClick={() => setAsignando(s)}>Buscar aliado</Btn>
                ) : (
                  <Btn size="sm" icon="ph-user-plus" onClick={() => setAsignando(s)}>Sumar otro aliado</Btn>
                )}

                {/*
                  Levantar una incidencia tiene que costar tres clics: si cuesta
                  trabajo no se levanta, y entonces el registro dice que todo va
                  bien porque nadie tuvo tiempo de decir lo contrario.
                */}
                <Btn size="sm" icon="ph-warning-diamond" onClick={() => setIncidencias(s)}>
                  Incidencias
                </Btn>

                {s.next.map((n) =>
                  n.state === 'cerrado' ? (
                    <Btn key={n.state} size="sm" icon="ph-flag-checkered" onClick={() => setCerrando(s)} disabled={ocupado === s.id}>
                      Cerrar…
                    </Btn>
                  ) : n.state === 'cancelado' ? null : (
                    <Btn key={n.state} size="sm" onClick={() => mover(s, n.state)} disabled={ocupado === s.id}>
                      {n.label}
                    </Btn>
                  ),
                )}

                {s.next.some((n) => n.state === 'cancelado') ? (
                  <Btn
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const nota = window.prompt('¿Por qué se cancela?');
                      if (nota !== null) mover(s, 'cancelado', { note: nota || undefined });
                    }}
                    disabled={ocupado === s.id}
                    style={{ marginLeft: 'auto', color: 'var(--adm-muted)' }}
                  >
                    Cancelar
                  </Btn>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {cerrando ? <ModalCierre servicio={cerrando} onCerrar={() => setCerrando(null)} onGuardar={mover} ocupado={ocupado === cerrando.id} /> : null}
      {asignando ? <ModalAsignar servicio={asignando} onCerrar={() => setAsignando(null)} onListo={() => { setAsignando(null); router.refresh(); }} /> : null}
      {incidencias ? <Incidencias quoteId={incidencias.id} quoteNumber={incidencias.quoteNumber} onCerrar={() => setIncidencias(null)} /> : null}
    </div>
  );
}

/**
 * CIERRE. El documento pide documentar "horas, viajes, cantidades" al
 * finalizar; sin eso no hay con qué facturar ni con qué medir después. Por eso
 * la cantidad es obligatoria y la unidad viene de la línea de servicio: para
 * una pipa se propone "viajes", para un triturado "toneladas".
 */
function ModalCierre({
  servicio, onCerrar, onGuardar, ocupado,
}: {
  servicio: ServicioRow;
  onCerrar: () => void;
  onGuardar: (s: ServicioRow, state: string, extra: { quantity: number; unit: string; note?: string }) => void;
  ocupado: boolean;
}) {
  const [cantidad, setCantidad] = useState('');
  const [unidad, setUnidad] = useState(servicio.defaultUnit);
  const [nota, setNota] = useState('');
  const n = Number(cantidad);
  const valido = Number.isFinite(n) && n > 0;

  // Ventana sin Esc (ver VentanaFormulario): lleva un desplegable y una nota
  // escrita que no deben perderse al cerrar el desplegable.
  return (
    <VentanaFormulario
      titulo="Cerrar servicio"
      ancho={460}
      onCerrar={onCerrar}
      subtitulo={
        <>
          {servicio.client} · <span className="adm-mono">{servicio.quoteNumber}</span>. Registra cuánto se usó: es de lo que dependen la factura y el historial.
        </>
      }
      pie={
        <>
          <Btn variant="ghost" onClick={onCerrar}>Cancelar</Btn>
          <Btn
            variant="primary"
            disabled={!valido || ocupado}
            onClick={() => onGuardar(servicio, 'cerrado', { quantity: n, unit: unidad, note: nota.trim() || undefined })}
          >
            {ocupado ? 'Cerrando…' : 'Cerrar servicio'}
          </Btn>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 12 }}>
        <FormField label="Cantidad">
          <input
            type="number"
            min={0}
            step="0.01"
            className="adm-input adm-num"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            autoFocus
          />
        </FormField>
        <FormField label="Unidad">
          <AdminSelect ariaLabel="Unidad" value={unidad} onChange={setUnidad} options={servicio.units.map((u) => ({ value: u.clave, label: u.label }))} />
        </FormField>
      </div>

      <FormField label="Observaciones del cierre (opcional)" style={{ marginTop: 14 }}>
        <textarea
          className="adm-textarea"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={3}
          placeholder="Ajustes, incidencias, tiempos de espera…"
        />
      </FormField>
    </VentanaFormulario>
  );
}

/**
 * BUSCAR ALIADO. Reusa el emparejamiento: los mismos candidatos con las mismas
 * razones que se ven al cotizar. Ofrecer NO asigna — queda esperando respuesta
 * hasta que el aliado contesta, porque un tablero que dé por resuelto algo que
 * nadie aceptó es peor que no tener tablero.
 */
function ModalAsignar({
  servicio, onCerrar, onListo,
}: {
  servicio: ServicioRow;
  onCerrar: () => void;
  onListo: () => void;
}) {
  const [datos, setDatos] = useState<{
    motivo: string | null;
    obra?: { lat: number; lng: number; label: string } | null;
    matches: Array<{ providerId: number; name: string; verified: boolean; level: string; score: number; reasons: string[]; warnings: string[]; siteRequirements?: Array<{ texto: string; estado: string; nota: string }>; lat?: number | null; lng?: number | null; coverageRadiusKm?: number | null; distanceKm?: number | null }>;
  } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    // `r.ok` explícito: un 500 NO hace que fetch lance, así que sin esto el
    // `.catch` no corre y lo que entra a setDatos es el cuerpo del error
    // (`{message, statusCode}`). Renderizar eso revienta al hacer `.map` sobre
    // `matches`, que no existe.
    fetch(`/api/admin/quotes/${servicio.id}/matches`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`La API respondió ${r.status}.`))))
      .then((d) => {
        if (!vivo) return;
        setDatos(Array.isArray(d?.matches) ? d : { motivo: 'La API respondió algo inesperado.', matches: [] });
      })
      .catch(() => { if (vivo) setDatos({ motivo: 'No se pudo consultar la red.', matches: [] }); })
      .finally(() => { if (vivo) setCargando(false); });
    // `vivo` evita escribir en un componente ya cerrado: el modal se puede
    // cerrar antes de que conteste la API.
    return () => { vivo = false; };
  }, [servicio.id]);

  /** La obra y los candidatos ubicados. Mismo mapa que en cotizaciones. */
  const puntos = useMemo<PuntoMapa[]>(() => {
    if (!datos?.obra) return [];
    return [
      { id: -1, nombre: 'La obra', lat: datos.obra.lat, lng: datos.obra.lng, tipo: 'obra', detalle: datos.obra.label },
      ...datos.matches
        .filter((m) => m.lat != null && m.lng != null)
        .map((m) => ({
          id: m.providerId,
          nombre: m.name,
          lat: m.lat as number,
          lng: m.lng as number,
          radioKm: m.coverageRadiusKm ?? null,
          tipo: 'aliado' as const,
          detalle: m.distanceKm != null ? `A ${m.distanceKm} km de la obra` : null,
        })),
    ];
  }, [datos]);

  async function ofrecer(providerId: number) {
    setEnviando(providerId);
    await fetch(`/api/admin/services/${servicio.id}/ofrecer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId }),
    });
    setEnviando(null);
    onListo();
  }

  const matches = datos?.matches ?? [];

  return (
    <Modal
      abierto
      titulo="Buscar aliado"
      subtitulo={`${servicio.category ?? 'Sin línea'} · ${servicio.address ?? 'Sin zona'}. Ofrecerlo no lo asigna: queda esperando su respuesta.`}
      onCerrar={onCerrar}
      ancho={600}
      pie={<Btn onClick={onCerrar}>Cerrar</Btn>}
    >
      {cargando ? <div style={{ fontSize: 13, color: 'var(--adm-muted)', padding: '6px 0 14px' }}>Consultando la red…</div> : null}

      {/* El mapa antes de la lista: al asignar, la primera pregunta es quién
          está cerca, y "a 12 km" no dice hacia qué lado. */}
      {puntos.length > 1 ? (
        <div style={{ marginBottom: 16 }}>
          <MapaCobertura puntos={puntos} alto={230} />
          {/* Los colores de la leyenda son los de los marcadores de MapaCobertura. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 8, fontSize: 12, color: 'var(--adm-muted)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#E0A32E' }} /> La obra
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#008CFF' }} /> Aliado y hasta dónde llega
            </span>
          </div>
        </div>
      ) : null}

      {datos && matches.length === 0 && !cargando && datos.motivo ? <Note>{datos.motivo}</Note> : null}

      {matches.length > 0 ? (
        <Panel flush clip>
          {matches.map((m) => {
            // Quien ya paso por aqui no es una alternativa: al que espera
            // respuesta se le estaria duplicando, y al que ya dijo que no,
            // insistir es solo ruido. Sin esto el mejor puntuado se propondria
            // en bucle despues de haber rechazado.
            const previa = servicio.assignments.find((a) => a.providerId === m.providerId);
            const yaTiene = previa !== undefined && previa.state !== 'retirado';
            const etiqueta =
              previa?.state === 'rechazado' ? 'Ya dijo que no'
                : previa?.state === 'aceptado' ? 'Ya aceptó'
                  : previa ? 'Ya se le ofreció'
                    : null;
            return (
              <div key={m.providerId} className="adm-trow">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                    <span className="adm-cell-title">{m.name}</span>
                    {m.verified ? <Chip tone="ok"><i className="ph ph-seal-check" aria-hidden />Verificado</Chip> : null}
                  </div>
                  <Btn
                    size="sm"
                    variant={yaTiene ? 'ghost' : 'secondary'}
                    icon={yaTiene ? undefined : 'ph-paper-plane-tilt'}
                    disabled={yaTiene || enviando !== null}
                    onClick={() => ofrecer(m.providerId)}
                  >
                    {etiqueta ?? (enviando === m.providerId ? 'Enviando…' : 'Ofrecerle')}
                  </Btn>
                </div>
                {previa?.reason ? (
                  <div className="adm-cell-sub" style={{ marginTop: 5 }}>Dijo: “{previa.reason}”</div>
                ) : null}
                {m.reasons.length + m.warnings.length > 0 ? (
                  <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 3 }}>
                    {m.reasons.map((r) => (
                      <li key={r} style={{ display: 'flex', gap: 7, fontSize: 12.5, color: 'var(--adm-text-2)', lineHeight: 1.5 }}>
                        <i className="ph ph-plus" aria-hidden style={{ color: 'var(--adm-accent)', marginTop: 3, fontSize: 11 }} />{r}
                      </li>
                    ))}
                    {m.warnings.map((w) => (
                      <li key={w} style={{ display: 'flex', gap: 7, fontSize: 12.5, color: 'var(--adm-muted)', lineHeight: 1.5 }}>
                        <i className="ph ph-warning" aria-hidden style={{ color: 'var(--adm-warn)', marginTop: 3, fontSize: 11 }} />{w}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </Panel>
      ) : null}
    </Modal>
  );
}
