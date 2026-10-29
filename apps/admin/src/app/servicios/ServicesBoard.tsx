'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { AdminSelect } from '@/components/AdminSelect';
import { Modal } from '@/components/Modal';
import {
  Bar, Btn, Chip, EmptyState, FormField, Note, PageHeader, Panel, SearchBox, Segmented, Stat, Stats, StatusText, Toolbar, type Tone,
} from '@/components/ui';
import { Incidencias, VentanaFormulario } from './Incidencias';
import { OperadorServicio } from './OperadorServicio';
import { COLOR_ETAPA, MapaServicios, enCaminoDe, useRastreo, type Rastreo } from './UnidadesEnCamino';
import { useRouter } from 'next/navigation';
import { MapaCobertura, type PuntoMapa } from '@/app/proveedores/MapaCobertura';
import { confirmar, pedirTexto } from '@/components/Dialogos';

/**
 * TABLERO DE OPERACIONES.
 *
 * Está armado alrededor de una sola pregunta: ¿qué hay que empujar hoy? Por eso
 * los cerrados y cancelados NO salen por defecto —el archivo es otra cosa— y
 * cada servicio muestra como botón solo lo que le toca a MAQSER24: buscarle
 * aliado y cerrarlo. El avance del día lo reportan el aliado y su operador
 * (2026-10-23); aquí solo se corrige, si hace falta.
 */

export interface ServicioRow {
  id: number;
  quoteNumber: string;
  client: string;
  phone: string | null;
  category: string | null;
  /** Nombre legible de la línea ("Materiales para construcción"). */
  categoryName?: string | null;
  /**
   * Folio del documento del que salió (MQ-/TR-). Una cotización con varias
   * líneas abre un servicio por línea; el tablero los junta por aquí.
   */
  folio?: string | null;
  address: string | null;
  /** La obra ("Torre Valle · Monterrey") y la máquina, para la tarjeta corta (2026-10-26). */
  obra?: string | null;
  equipo?: string | null;
  state: string;
  stateLabel: string;
  stateHint: string;
  progress: number;
  next: Array<{ state: string; label: string }>;
  units: Array<{ clave: string; label: string }>;
  defaultUnit: string;
  /** Días cotizados, para prellenar el cierre. */
  quotedDays?: number | null;
  closed: string | null;
  total: number;
  acceptedAt: string | null;
  /** Aliados que tienen publicado el equipo pedido (sugerencia para asignar). */
  suggested?: string | null;
  startedAt: string | null;
  closedAt: string | null;
  /** Quién maneja la unidad (2026-10-15): su enlace comparte la ubicación. */
  operator?: { name: string; phone: string | null } | null;
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
  // Se le ofreció a varios (2026-10-15): otro aliado aceptó primero.
  tomado: { texto: 'Lo tomó otro', tono: 'muted' },
};

/** Estados en los que ya hay aliado trabajando (o a punto de salir). */
const EN_OPERACION = ['asignado', 'en_traslado', 'en_sitio', 'en_curso'];

/** El motivo con el que la API marca al aliado que se bajó a medio servicio (catalog/provider-history.ts). */
const MOTIVO_SE_BAJO = 'Se bajó del servicio';

const aliados = (n: number) => `${n} ${n === 1 ? 'aliado' : 'aliados'}`;
const nombres = (l: ServicioRow['assignments']) => l.map((a) => a.provider).join(', ');

/**
 * A CUÁNTOS SE LE MANDÓ Y EN QUÉ VA (2026-10-19). Con "Mandar a todos"
 * (2026-10-23; antes la oferta automática) un servicio sale a varios aliados a
 * la vez; sin este resumen había que contar renglones para saber si alguien ya
 * la tomó.
 *
 * `estado` es lo que va con color; `detalle` lo que sigue, que puede llevar
 * nombres y tiene que poder partirse en el teléfono. `corto` es para el
 * encabezado de la cotización, donde va un renglón por servicio.
 */
function resumenOferta(s: ServicioRow): { mandada: string; estado: string; detalle: string; corto: string; tono: Tone } {
  const n = s.assignments.length;
  const tomaron = s.assignments.filter((a) => a.state === 'aceptado');
  const esperando = s.assignments.filter((a) => a.state === 'propuesto');
  const noPueden = s.assignments.filter((a) => a.state === 'rechazado' || a.state === 'retirado');
  const retirados = s.assignments.filter((a) => a.state === 'tomado');
  const mandada = `Se mandó a ${aliados(n)}`;

  if (n === 0) return { mandada: '', estado: 'Sin mandar', detalle: '', corto: 'sin mandar: búscale aliado', tono: 'warn' };
  if (tomaron.length) {
    const quien = `${tomaron.length === 1 ? 'la tomó' : 'la tomaron'} ${nombres(tomaron)}`;
    const otros = retirados.length === 0
      ? ''
      : retirados.length === 1
        ? `al otro se le retiró (${nombres(retirados)})`
        : `a los otros ${retirados.length} se les retiró (${nombres(retirados)})`;
    return { mandada, estado: tomaron.length === 1 ? 'La tomó' : 'La tomaron', detalle: [nombres(tomaron), otros].filter(Boolean).join(' · '), corto: quien, tono: 'ok' };
  }
  if (esperando.length) {
    const no = noPueden.length ? `· ${noPueden.length} no ${noPueden.length === 1 ? 'puede' : 'pueden'} (${nombres(noPueden)})` : '';
    return {
      mandada,
      estado: esperando.length === n ? 'Esperando respuesta' : `Esperando respuesta de ${esperando.length}`,
      detalle: no,
      corto: `mandada a ${aliados(n)}, esperando respuesta`,
      tono: 'warn',
    };
  }
  return {
    mandada,
    estado: n === 1 ? 'No puede' : 'Ninguno puede',
    detalle: '· búscale otro',
    corto: n === 1 ? 'el aliado no puede: búscale otro' : `ninguno de los ${n} aliados puede: búscale otro`,
    tono: 'bad',
  };
}

/**
 * Encabezado de los servicios que salieron de la misma cotización: un renglón
 * por servicio con su línea y en qué va la oferta, para ver el pedido entero
 * del cliente sin abrir cada tarjeta.
 */
function EncabezadoCotizacion({ folio, servicios }: { folio: string; servicios: ServicioRow[] }) {
  return (
    <div className="srv-doc">
      <div className="srv-doc-t">
        <i className="ph ph-files" aria-hidden />
        <span>Cotización <span className="adm-mono" style={{ color: 'var(--adm-text)' }}>{folio}</span></span>
        <span>· {servicios[0].client}</span>
        <span>· {servicios.length} servicios, cada uno con sus aliados</span>
      </div>
      <ul>
        {servicios.map((s) => {
          const r = resumenOferta(s);
          return (
            <li key={s.id}>
              <span style={{ fontWeight: 600, color: 'var(--adm-text)' }}>{s.categoryName ?? s.category ?? 'Sin línea'}</span>
              <span style={{ color: r.tono === 'ok' ? 'var(--adm-text)' : 'var(--adm-muted)' }}>{r.corto.charAt(0).toUpperCase() + r.corto.slice(1)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fecha(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ServicesBoard({ initial, historial = false, rastreo = null }: {
  initial: ServicioRow[];
  historial?: boolean;
  /** El Mapa de servicios (2026-10-26): va entre los números y las tarjetas; null en el historial. */
  rastreo?: Rastreo | null;
}) {
  const router = useRouter();
  // El mapa y la línea "faltan N km" de cada tarjeta se actualizan solos.
  const { datos: enVivo, ahora } = useRastreo(rastreo);
  const unidadDe = useMemo(() => new Map((enVivo?.unidades ?? []).map((u) => [u.quoteId, u])), [enVivo]);
  /** Tarjetas con el detalle abierto (dirección, teléfono del cliente, importe, a quién se ofreció). */
  const [detalle, setDetalle] = useState<Set<number>>(new Set());
  const verDetalle = (id: number) => setDetalle((d) => { const n = new Set(d); if (n.has(id)) n.delete(id); else n.add(id); return n; });
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
      [s.quoteNumber, s.folio, s.client, s.category, s.categoryName, s.address, s.stateLabel]
        .some((v) => v?.toLowerCase().includes(q)),
    );
  }, [initial, filtro]);

  /**
   * Los servicios de UNA cotización, juntos (2026-10-19). Si el cliente pidió
   * excavadora y pipa en el mismo documento, son dos servicios con aliados
   * distintos; van uno tras otro, bajo un encabezado que dice en qué va cada
   * uno, en el lugar del más reciente.
   */
  const { ordenados, grupos } = useMemo(() => {
    const porFolio = new Map<string, ServicioRow[]>();
    for (const s of filtrados) if (s.folio) porFolio.set(s.folio, [...(porFolio.get(s.folio) ?? []), s]);
    const grupos = new Map([...porFolio].filter(([, l]) => l.length > 1));
    const vistos = new Set<string>();
    const ordenados: ServicioRow[] = [];
    for (const s of filtrados) {
      const hermanos = s.folio ? grupos.get(s.folio) : undefined;
      if (!hermanos) ordenados.push(s);
      else if (!vistos.has(s.folio!)) {
        vistos.add(s.folio!);
        ordenados.push(...hermanos);
      }
    }
    return { ordenados, grupos };
  }, [filtrados]);

  // Conteos de lo que ya está en pantalla: responden "¿qué hay que empujar?"
  // antes de bajar por las tarjetas.
  const cuenta = useMemo(() => ({
    total: initial.length,
    porAsignar: initial.filter((s) => s.state === 'por_asignar').length,
    esperando: initial.filter((s) => s.assignments.some((a) => a.state === 'propuesto')).length,
    enOperacion: initial.filter((s) => EN_OPERACION.includes(s.state)).length,
    porCerrar: initial.filter((s) => s.state === 'terminado').length,
  }), [initial]);

  async function mover(s: ServicioRow, state: string, extra?: { quantity?: number; unit?: string; note?: string; causa?: string }) {
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

  /**
   * A quién se le mandó y en qué va; luego cada aliado. A los que se les
   * retiró porque otro la tomó ya van en el resumen, con nombre.
   */
  function aliadosDe(s: ServicioRow, oferta: ReturnType<typeof resumenOferta>) {
    return (
      <div style={{ marginTop: 12, paddingTop: 2, borderTop: '1px solid var(--adm-border)' }}>
        <div className="srv-oferta">
          <i className="ph ph-paper-plane-tilt" aria-hidden />
          <span>
            <span style={{ color: 'var(--adm-text)', fontWeight: 600 }}>{oferta.mandada}</span>
            {' · '}
            <StatusText tone={oferta.tono}>{oferta.estado}</StatusText>
            {oferta.detalle ? <> {oferta.detalle}</> : null}
          </span>
        </div>
        {s.assignments.filter((a) => a.state !== 'tomado').map((a) => {
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
                    onClick={async () => {
                      // Por qué rechazó es el dato que dice si la red
                      // alcanza para esa zona; sin él solo queda un "no".
                      const r = await pedirTexto({
                        titulo: '¿Por qué no puede?',
                        mensaje: 'Sirve para saber qué le falta a la red en esa zona. Puedes dejarlo en blanco.',
                        multilinea: true,
                        confirmar: 'Marcar que no puede',
                      });
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
    );
  }

  /** El aliado se bajó a medio servicio: vuelve a Por asignar y se abre "Buscar otro aliado" (2026-10-26). */
  async function seBajo(s: ServicioRow, nota: string | null) {
    setOcupado(s.id);
    setError(null);
    const r = await fetch(`/api/admin/services/${s.id}/se-bajo`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nota }),
    }).catch(() => null);
    setOcupado(null);
    if (!r?.ok) {
      setError(((await r?.json().catch(() => null)) as { message?: string } | null)?.message ?? 'No se pudo registrar. Intenta otra vez.');
      return;
    }
    router.refresh();
    setAsignando({
      ...s,
      state: 'por_asignar',
      assignments: s.assignments.map((a) => (a.state === 'aceptado' ? { ...a, state: 'retirado', reason: MOTIVO_SE_BAJO } : a)),
    });
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
        .srv-quien { display: flex; align-items: center; gap: 6px 14px; flex-wrap: wrap; margin-top: 10px; }
        /* Color de la etapa (2026-10-26): el mismo del mapa, en el borde y en la etiqueta. */
        .srv-card { border-left: 3px solid var(--c) !important; }
        .srv-etapa { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border-radius: 999px; font-size: 12.5px; font-weight: 600; white-space: nowrap; color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); border: 1px solid color-mix(in srgb, var(--c) 40%, transparent); }
        .srv-etapa::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--c); }
        .srv-camino { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--adm-text); font-variant-numeric: tabular-nums; }
        .srv-camino i { color: var(--etapa-camino); }
        .srv-detalle { margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--adm-border); }
        .srv-oferta { display: flex; align-items: baseline; gap: 8px; padding: 10px 0 4px; font-size: 13px; color: var(--adm-muted); line-height: 1.5; }
        .srv-oferta i { flex: none; position: relative; top: 2px; }
        .srv-doc { padding: 12px 16px; border: 1px dashed var(--adm-border); border-radius: 12px; }
        .srv-doc-t { display: flex; align-items: center; gap: 4px 8px; flex-wrap: wrap; font-size: 13.5px; color: var(--adm-muted); }
        .srv-doc ul { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 4px; font-size: 13px; }
        .srv-doc li { display: flex; gap: 4px 10px; flex-wrap: wrap; align-items: baseline; }
        .srv-en-grupo { margin-left: 14px; border-left: 3px solid var(--adm-accent); }
        @media (max-width: 560px) {
          .srv-card { padding: 14px; }
          .srv-en-grupo { margin-left: 6px; }
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

      {enVivo && (enVivo.unidades.length + (enVivo.activos?.length ?? 0) + (enVivo.porAsignar?.length ?? 0) > 0) ? <MapaServicios datos={enVivo} ahora={ahora} /> : null}

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
        {ordenados.map((s) => {
          const tono = TONO_ESTADO[s.state] ?? 'accent';
          const aceptado = s.assignments.filter((a) => a.state === 'aceptado');
          const esperando = s.assignments.filter((a) => a.state === 'propuesto');
          const alterno = acciones[s.id];
          const oferta = resumenOferta(s);
          const unidad = s.state === 'en_traslado' ? unidadDe.get(s.id) : undefined;
          const camino = unidad ? enCaminoDe(unidad, ahora) : null;
          const hermanos = s.folio ? grupos.get(s.folio) : undefined;

          return (
            <Fragment key={s.id}>
            {hermanos?.[0].id === s.id ? <EncabezadoCotizacion folio={s.folio!} servicios={hermanos} /> : null}
            <article className={`adm-card srv-card${hermanos ? ' srv-en-grupo' : ''}`} style={{ '--c': COLOR_ETAPA[s.state] ?? 'var(--adm-border)' } as React.CSSProperties}>
              {/* TARJETA CORTA (2026-10-26): obra, máquina, operador y teléfono. Lo demás, en "Ver detalle". */}
              <div className="srv-top">
                <div style={{ minWidth: 0, flex: '1 1 300px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px 10px', flexWrap: 'wrap' }}>
                    <span className="adm-cell-title" style={{ fontSize: 15 }}>{s.obra ?? s.address ?? 'Obra sin nombre'}</span>
                    <span style={{ fontSize: 13, color: 'var(--adm-muted)' }}>{s.client}</span>
                    <span className="adm-mono" style={{ fontSize: 12, color: 'var(--adm-faint)' }}>{s.quoteNumber}</span>
                  </div>
                  <div className="adm-cell-sub" style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <i className="ph-bold ph-tractor" aria-hidden style={{ color: COLOR_ETAPA[s.state] ?? 'var(--adm-muted)' }} />
                    {s.equipo ?? s.categoryName ?? s.category ?? 'Sin equipo'}
                  </div>
                </div>

                <div className="srv-precio" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span className="srv-etapa" style={{ '--c': COLOR_ETAPA[s.state] ?? 'var(--adm-accent)' } as React.CSSProperties}>{s.stateLabel}</span>
                  {camino ? <span className="srv-camino"><i className="ph-bold ph-navigation-arrow" aria-hidden />{camino.texto}</span> : null}
                </div>
              </div>

              {/* Quién la lleva: el operador y su teléfono; sin operador, el aliado y el suyo. */}
              {aceptado.length > 0 && EN_OPERACION.includes(s.state) ? (
                <div className="srv-quien">
                  <OperadorServicio servicioId={s.id} operador={s.operator ?? null} />
                  {!s.operator ? aceptado.map((a) => (
                    <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                      <span style={{ color: 'var(--adm-text)', fontWeight: 600 }}>{a.provider}</span>
                      {a.phone ? <a href={`tel:${a.phone}`} className="adm-link adm-mono" style={{ fontSize: 12.5 }}><i className="ph ph-phone" aria-hidden /> {a.phone}</a> : null}
                    </span>
                  )) : null}
                </div>
              ) : null}
              {camino?.alertas.length ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {camino.alertas.map((a) => <Chip key={a.texto} tone={a.tono} title={a.titulo}>{a.texto}</Chip>)}
                </div>
              ) : null}

              {/* Sin aliado todavía: a quién se le mandó y en qué va (aquí sí hay que actuar). */}
              {aceptado.length === 0 && s.assignments.length > 0 ? aliadosDe(s, oferta) : null}

              {/* Sugeridos (2026-10-05): quién tiene publicado el equipo pedido. */}
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

              {/* Ver detalle: lo que ya no va a la vista, para cuando haga falta. */}
              {detalle.has(s.id) ? (
                <div className="srv-detalle">
                  <div style={{ margin: '2px 0 6px' }}>
                    <Bar pct={Math.round(s.progress * 100)} tone={tono} label={`Avance: ${s.stateLabel}`} />
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--adm-muted)', lineHeight: 1.55 }}>{s.stateHint}</div>
                  <div className="adm-cell-sub" style={{ marginTop: 8 }}>
                    {s.categoryName ?? s.category ?? 'Sin línea de servicio'}
                    {s.address ? ` · ${s.address}` : ''}
                    {s.phone ? <> · Cliente <span className="adm-mono">{s.phone}</span></> : null}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, color: 'var(--adm-text-2)' }}>
                    Importe: <span className="adm-num" style={{ fontWeight: 600, color: 'var(--adm-text)' }}>{money(s.total)}</span>
                  </div>
                  {aceptado.length > 0 && s.assignments.length > 0 ? aliadosDe(s, oferta) : null}
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
                {/* Buscar aliado solo mientras nadie lo atiende (2026-10-26): ya con aliado no
                    se suma otro; si el que tenía se bajó, vuelve a salir como "Buscar otro aliado". */}
                {aceptado.length === 0 && !['terminado', 'cerrado', 'cancelado'].includes(s.state) ? (
                  <Btn size="sm" icon="ph-magnifying-glass" onClick={() => setAsignando(s)}>
                    {s.assignments.some((a) => a.reason === MOTIVO_SE_BAJO) ? 'Buscar otro aliado' : 'Buscar aliado'}
                  </Btn>
                ) : null}

                {/*
                  Levantar una incidencia tiene que costar tres clics: si cuesta
                  trabajo no se levanta, y entonces el registro dice que todo va
                  bien porque nadie tuvo tiempo de decir lo contrario.
                */}
                <Btn size="sm" icon="ph-warning-diamond" onClick={() => setIncidencias(s)}>
                  Incidencias
                </Btn>

                {/*
                  LAS ETAPAS LAS REPORTA EL ALIADO (2026-10-23). Desde que hay
                  aliado, en traslado → en sitio → en curso → terminado los marca
                  él en su portal o su operador desde el celular; aquí no hay
                  botón para eso. A MAQSER24 le toca CERRAR, con la cantidad,
                  porque es lo que se cobra. Si el aliado se queda sin señal o
                  marcó mal, "Corregir etapa…" sigue a la mano, discreto.
                */}
                {(() => {
                  const pasos = s.next.filter((n) => n.state !== 'cancelado');
                  const cerrar = s.state === 'terminado' ? pasos.find((n) => n.state === 'cerrado') : undefined;
                  const corregir = pasos.filter((n) => n !== cerrar);
                  const siguiente = EN_OPERACION.includes(s.state) ? pasos.find((n) => n.state !== 'cerrado') : undefined;
                  return (
                    <>
                      {cerrar ? (
                        <Btn size="sm" variant="primary" icon="ph-flag-checkered" onClick={() => setCerrando(s)} disabled={ocupado === s.id}>Cerrar…</Btn>
                      ) : null}
                      {siguiente ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--adm-muted)' }}>
                          <i className="ph ph-device-mobile" aria-hidden />
                          {siguiente.label}: lo reporta el aliado
                        </span>
                      ) : null}
                      {corregir.length ? (
                        // El selector del panel (2026-10-26): el nativo se abría blanco, fuera del diseño.
                        <AdminSelect
                          size="sm"
                          className="w-auto min-w-[150px] h-[30px] text-[12.5px]"
                          ariaLabel={`Corregir la etapa de ${s.quoteNumber} (solo si el aliado no puede reportarla o la marcó mal)`}
                          value=""
                          placeholder="Corregir etapa…"
                          disabled={ocupado === s.id}
                          options={corregir.map((n) => ({ value: n.state, label: n.state === 'cerrado' ? 'Cerrar…' : n.label }))}
                          onChange={async (v) => {
                            const destino = corregir.find((n) => n.state === v);
                            if (!destino) return;
                            if (destino.state === 'cerrado') { setCerrando(s); return; }
                            const ok = await confirmar({
                              titulo: `¿Pasar ${s.quoteNumber} a «${destino.label}»?`,
                              mensaje: 'Normalmente lo reporta el aliado o su operador. Al cliente le llega el aviso igual que si lo hubiera marcado él.',
                              confirmar: 'Corregir etapa',
                            });
                            if (ok) mover(s, destino.state);
                          }}
                        />
                      ) : null}
                    </>
                  );
                })()}

                <Btn size="sm" variant="ghost" icon={detalle.has(s.id) ? 'ph-caret-up' : 'ph-caret-down'} onClick={() => verDetalle(s.id)} style={{ marginLeft: 'auto' }} aria-expanded={detalle.has(s.id)}>
                  {detalle.has(s.id) ? 'Ocultar detalle' : 'Ver detalle'}
                </Btn>
                {s.next.some((n) => n.state === 'cancelado') ? (
                  <Btn
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      // Con un aliado trabajándolo, primero qué pasó (2026-10-26): si se bajó
                      // él, el servicio NO se cancela; vuelve a Por asignar y se busca otro.
                      // Quién fue decide además si le cuenta en contra (2026-10-22).
                      let causa: string | undefined;
                      if (s.assignments.some((a) => a.state === 'aceptado')) {
                        const r = await pedirTexto({
                          titulo: `¿Qué pasó con ${s.quoteNumber}?`,
                          valor: 'cliente',
                          opciones: [
                            { valor: 'cliente', texto: 'El cliente lo canceló' },
                            { valor: 'aliado', texto: 'El aliado se bajó: buscar otro (el servicio sigue)' },
                            { valor: 'plataforma', texto: 'Lo cancelamos nosotros (MAQSER24)' },
                          ],
                          confirmar: 'Siguiente',
                          cancelar: 'Volver',
                        });
                        if (r === null) return;
                        causa = r;
                      }
                      if (causa === 'aliado') {
                        const motivo = await pedirTexto({
                          titulo: '¿Por qué se bajó?',
                          mensaje: 'Queda en el historial del servicio y en el del aliado. Puedes dejarlo en blanco.',
                          etiqueta: 'Motivo',
                          multilinea: true,
                          confirmar: 'Buscar otro aliado',
                          cancelar: 'Volver',
                        });
                        if (motivo === null) return;
                        await seBajo(s, motivo || null);
                        return;
                      }
                      const nota = await pedirTexto({
                        titulo: `¿Cancelar el servicio ${s.quoteNumber}?`,
                        mensaje: 'Escribe por qué se cancela; queda en su historial.',
                        etiqueta: 'Motivo',
                        multilinea: true,
                        confirmar: 'Cancelar servicio',
                        cancelar: 'Volver',
                        peligro: true,
                      });
                      if (nota === null) return;
                      mover(s, 'cancelado', { note: nota || undefined, causa });
                    }}
                    disabled={ocupado === s.id}
                    style={{ color: 'var(--adm-muted)' }}
                  >
                    Cancelar
                  </Btn>
                ) : null}
              </div>
            </article>
            </Fragment>
          );
        })}
      </div>

      {cerrando ? <ModalCierre servicio={cerrando} onCerrar={() => setCerrando(null)} onGuardar={mover} ocupado={ocupado === cerrando.id} /> : null}
      {/* Se queda abierta al ofrecer (2026-10-23): se le puede ofrecer a varios, uno por uno, sin volver a buscar. */}
      {asignando ? <ModalAsignar servicio={asignando} onCerrar={() => setAsignando(null)} onCambio={() => router.refresh()} /> : null}
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
  // Con los días cotizados ya puestos: casi siempre solo se confirma.
  const [cantidad, setCantidad] = useState(servicio.defaultUnit === 'dia' && servicio.quotedDays ? String(servicio.quotedDays) : '');
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
 *
 * Desde el 2026-10-23 nada sale solo cuando el cliente acepta: aquí MAQSER24
 * elige a quién se la da. A uno, a varios (la ventana se queda abierta) o
 * "Mandar a todos" los que llegan a la obra; el primero que acepta se la queda.
 */
function ModalAsignar({
  servicio, onCerrar, onCambio,
}: {
  servicio: ServicioRow;
  onCerrar: () => void;
  /** Se ofreció a alguien: el tablero se refresca sin cerrar la ventana. */
  onCambio: () => void;
}) {
  const [datos, setDatos] = useState<{
    motivo: string | null;
    obra?: { lat: number; lng: number; label: string } | null;
    matches: Array<{ providerId: number; name: string; verified: boolean; level: string; score: number; reasons: string[]; warnings: string[]; siteRequirements?: Array<{ texto: string; estado: string; nota: string }>; lat?: number | null; lng?: number | null; coverageRadiusKm?: number | null; distanceKm?: number | null }>;
  } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState<number | null>(null);
  /** A quiénes se les ofreció desde que se abrió la ventana (el `servicio` que llegó ya no se actualiza). */
  const [ofrecidosAhora, setOfrecidosAhora] = useState<Set<number>>(() => new Set());
  const [errorOferta, setErrorOferta] = useState<string | null>(null);
  /** "Mandar a todos": a quiénes les llegaría (la API aplica la misma regla) y a quiénes se les mandó. */
  const [todos, setTodos] = useState<{ candidatos: string[]; motivo: string | null } | null>(null);
  const [mandadoATodos, setMandadoATodos] = useState<string[] | null>(null);
  const [mandandoTodos, setMandandoTodos] = useState(false);
  const porAsignar = servicio.state === 'por_asignar' && !servicio.assignments.some((a) => a.state === 'aceptado');

  useEffect(() => {
    if (!porAsignar) return;
    let vivo = true;
    fetch(`/api/admin/services/${servicio.id}/ofrecer-todos`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo && d && Array.isArray(d.candidatos)) setTodos({ candidatos: d.candidatos, motivo: d.motivo ?? null }); })
      .catch(() => undefined);
    return () => { vivo = false; };
    // Se vuelve a pedir después de cada oferta: a quien ya se le ofreció ya no cuenta.
  }, [servicio.id, porAsignar, ofrecidosAhora]);

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
    setErrorOferta(null);
    const r = await fetch(`/api/admin/services/${servicio.id}/ofrecer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId }),
    }).catch(() => null);
    setEnviando(null);
    if (!r?.ok) {
      const j = await r?.json().catch(() => null);
      setErrorOferta(j?.message ?? 'No se pudo ofrecer. Inténtalo de nuevo.');
      return;
    }
    setOfrecidosAhora((prev) => new Set(prev).add(providerId));
    onCambio();
  }

  async function mandarATodos() {
    if (!todos?.candidatos.length) return;
    const n = todos.candidatos.length;
    const ok = await confirmar({
      titulo: `¿Mandarlo a ${n === 1 ? 'el aliado' : `los ${n} aliados`} que llegan a la obra?`,
      mensaje: `Le llega a ${todos.candidatos.join(', ')}. El primero que acepte se lo queda y a los demás se les retira.`,
      confirmar: `Mandar a ${n === 1 ? '1 aliado' : `${n} aliados`}`,
    });
    if (!ok) return;
    setMandandoTodos(true);
    setErrorOferta(null);
    const r = await fetch(`/api/admin/services/${servicio.id}/ofrecer-todos`, { method: 'POST' }).catch(() => null);
    setMandandoTodos(false);
    const j = await r?.json().catch(() => null);
    if (!r?.ok) { setErrorOferta(j?.message ?? 'No se pudo mandar. Inténtalo de nuevo.'); return; }
    if (!j?.ofrecidos?.length) { setErrorOferta(j?.motivo ?? 'No se le mandó a nadie.'); return; }
    setMandadoATodos(j.ofrecidos);
    const ids = (datos?.matches ?? []).filter((m) => j.ofrecidos.includes(m.name)).map((m) => m.providerId);
    setOfrecidosAhora((prev) => new Set([...prev, ...ids]));
    onCambio();
  }

  const matches = datos?.matches ?? [];

  return (
    <Modal
      abierto
      titulo="Buscar aliado"
      subtitulo={`${servicio.equipo ?? servicio.categoryName ?? servicio.category ?? 'Sin línea'} · ${servicio.obra ?? servicio.address ?? 'Sin zona'}. Ofrecerlo no lo asigna: queda esperando su respuesta.`}
      onCerrar={onCerrar}
      ancho={600}
      pie={<Btn onClick={onCerrar}>{ofrecidosAhora.size ? 'Listo' : 'Cerrar'}</Btn>}
    >
      {cargando ? <div style={{ fontSize: 13, color: 'var(--adm-muted)', padding: '6px 0 14px' }}>Consultando la red…</div> : null}

      {/* MANDAR A TODOS (2026-10-23): la otra forma de dárselo, además de "Ofrecerle" uno por uno. */}
      {mandadoATodos ? (
        <Note tone="ok" icon="ph-check-circle" style={{ marginBottom: 14 }}>
          Se le mandó a <strong>{mandadoATodos.join(', ')}</strong>. El primero que acepte se lo queda.
        </Note>
      ) : porAsignar && todos ? (
        todos.candidatos.length ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px 12px', flexWrap: 'wrap', marginBottom: 14, padding: '10px 12px', border: '1px solid var(--adm-border)', borderRadius: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--adm-text-2)', minWidth: 0, flex: '1 1 260px' }}>
              Llegan a la obra <strong style={{ color: 'var(--adm-text)' }}>{todos.candidatos.length}</strong> {todos.candidatos.length === 1 ? 'aliado' : 'aliados'} a los que aún no se les ofrece. Ofrécelo a uno abajo o mándalo a todos.
            </span>
            <Btn size="sm" variant="primary" icon="ph-paper-plane-tilt" onClick={mandarATodos} disabled={mandandoTodos || enviando !== null}>
              {mandandoTodos ? 'Mandando…' : `Mandar a todos (${todos.candidatos.length})`}
            </Btn>
          </div>
        ) : todos.motivo && matches.length > 0 ? (
          // Sin nadie en la lista, el motivo ya sale abajo: no se repite.
          <div style={{ fontSize: 12.5, color: 'var(--adm-muted)', marginBottom: 12 }}>{todos.motivo}</div>
        ) : null
      ) : null}
      {errorOferta ? <Note tone="bad" style={{ marginBottom: 12 }}>{errorOferta}</Note> : null}

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
            const ahora = ofrecidosAhora.has(m.providerId);
            const yaTiene = ahora || (previa !== undefined && previa.state !== 'retirado');
            const etiqueta =
              previa?.state === 'rechazado' ? 'Ya dijo que no'
                : previa?.state === 'aceptado' ? 'Ya aceptó'
                  : previa || ahora ? 'Ya se le ofreció'
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
