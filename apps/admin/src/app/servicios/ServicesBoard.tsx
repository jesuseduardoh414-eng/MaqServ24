'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Incidencias } from './Incidencias';
import { useRouter } from 'next/navigation';

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

const C = {
  panel: '#141416', panel2: '#1b1e26', line: 'rgba(255,255,255,0.07)', line2: 'rgba(255,255,255,0.12)',
  ink: '#f2f4f7', muted: '#9aa1ad', dim: '#6b7280',
  accent: 'var(--color-primary)', accentInk: 'var(--color-primary-fg)',
  warn: 'var(--color-warning)', ok: 'var(--color-success)', bad: 'var(--color-error)',
};

const COLOR_ESTADO: Record<string, string> = {
  por_asignar: C.warn,
  asignado: C.accent,
  en_traslado: C.accent,
  en_sitio: C.accent,
  en_curso: C.accent,
  terminado: C.ok,
  cerrado: C.dim,
  cancelado: C.bad,
};

const ESTADO_ASIGNACION: Record<string, { texto: string; color: string }> = {
  propuesto: { texto: 'Esperando respuesta', color: C.warn },
  aceptado: { texto: 'Aceptó', color: C.ok },
  rechazado: { texto: 'Rechazó', color: C.bad },
  retirado: { texto: 'Se retiró', color: C.dim },
};

const input: CSSProperties = {
  width: '100%', background: C.panel2, border: `1px solid ${C.line2}`, color: C.ink,
  borderRadius: 10, padding: '10px 12px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit',
};
const boton: CSSProperties = {
  background: C.accent, color: C.accentInk, border: 'none', borderRadius: 9,
  padding: '8px 14px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
};
const botonSec: CSSProperties = {
  background: 'none', border: `1px solid ${C.line2}`, color: C.ink, borderRadius: 9,
  padding: '8px 14px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
};

const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fecha(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ServicesBoard({ initial }: { initial: ServicioRow[] }) {
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
    <div style={{ color: C.ink }}>
      <header style={{ marginBottom: 22 }}>
        <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800, letterSpacing: '-0.02em' }}>Servicios</h1>
        <p style={{ margin: '7px 0 0', fontSize: 13.5, color: C.muted, lineHeight: 1.6, maxWidth: 640 }}>
          Lo que pasa después de que el cliente acepta: a quién se le asignó, en qué va y con qué se cerró.
          Los cerrados y cancelados no aparecen aquí.
        </p>
      </header>

      <input
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Buscar por folio, cliente, servicio o zona…"
        style={{ ...input, maxWidth: 420, marginBottom: 18 }}
      />

      {error ? (
        <div style={{ background: 'color-mix(in srgb, var(--color-error) 12%, transparent)', border: `1px solid ${C.bad}`, color: C.ink, borderRadius: 11, padding: '12px 15px', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      ) : null}

      {filtrados.length === 0 ? (
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: '56px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.muted }}>
            {initial.length === 0 ? 'No hay servicios activos' : 'Sin resultados'}
          </div>
          <div style={{ fontSize: 13, color: C.dim, marginTop: 7, lineHeight: 1.6 }}>
            {initial.length === 0
              ? 'Un servicio entra aquí cuando el cliente acepta su cotización.'
              : 'Prueba con otro término.'}
          </div>
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 14 }}>
        {filtrados.map((s) => {
          const color = COLOR_ESTADO[s.state] ?? C.accent;
          const aceptado = s.assignments.filter((a) => a.state === 'aceptado');
          const esperando = s.assignments.filter((a) => a.state === 'propuesto');

          return (
            <div key={s.id} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15.5, fontWeight: 700 }}>{s.client}</span>
                    <span style={{ fontSize: 12, color: C.dim, fontFamily: 'ui-monospace, monospace' }}>{s.quoteNumber}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: C.muted, marginTop: 5 }}>
                    {s.category ?? 'Sin línea de servicio'}
                    {s.address ? ` · ${s.address}` : ''}
                    {s.phone ? ` · ${s.phone}` : ''}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color, background: `color-mix(in srgb, ${color} 11%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 26%, transparent)`, padding: '4px 11px', borderRadius: 20 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                    {s.stateLabel}
                  </span>
                  <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 7, fontFamily: 'ui-monospace, monospace' }}>{money(s.total)}</div>
                </div>
              </div>

              {/* Barra de avance: dice de un vistazo qué tan lejos va sin
                  obligar a leer el nombre del estado. */}
              <div style={{ height: 3, background: C.line2, borderRadius: 3, margin: '14px 0 6px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round(s.progress * 100)}%`, background: color, borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.55 }}>{s.stateHint}</div>

              {/* Aliados */}
              {s.assignments.length > 0 ? (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}`, display: 'grid', gap: 8 }}>
                  {s.assignments.map((a) => {
                    const e = ESTADO_ASIGNACION[a.state] ?? { texto: a.state, color: C.dim };
                    return (
                      <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 0, fontSize: 13 }}>
                          <span style={{ fontWeight: 600 }}>{a.provider}</span>
                          <span style={{ color: e.color, marginLeft: 9, fontSize: 11.5, fontWeight: 700 }}>{e.texto}</span>
                          {a.reason ? <span style={{ color: C.dim, marginLeft: 8, fontSize: 12 }}>· {a.reason}</span> : null}
                          {a.phone ? <a href={`tel:${a.phone}`} style={{ color: C.accent, marginLeft: 9, fontSize: 12, textDecoration: 'none' }}>{a.phone}</a> : null}
                        </div>
                        {a.state === 'propuesto' ? (
                          <div style={{ display: 'flex', gap: 7 }}>
                            <button type="button" onClick={() => responderAliado(a.id, 'aceptado')} style={{ ...botonSec, color: C.ok, borderColor: 'color-mix(in srgb, var(--color-success) 40%, transparent)' }}>Aceptó</button>
                            <button
                              type="button"
                              onClick={() => {
                                // Por qué rechazó es el dato que dice si la red
                                // alcanza para esa zona; sin él solo queda un "no".
                                const r = window.prompt('¿Por qué no puede? (para saber qué le falta a la red)');
                                if (r !== null) responderAliado(a.id, 'rechazado', r || undefined);
                              }}
                              style={{ ...botonSec, color: C.bad, borderColor: 'color-mix(in srgb, var(--color-error) 40%, transparent)' }}
                            >
                              No puede
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {s.closed ? (
                <div style={{ marginTop: 12, fontSize: 12.5, color: C.muted }}>
                  Cierre: <span style={{ color: C.ink, fontWeight: 600 }}>{s.closed}</span> · {fecha(s.closedAt)}
                </div>
              ) : null}

              {/*
                PROVEEDOR ALTERNO. Antes, una propuesta sin respuesta se quedaba
                parada hasta que alguien se acordaba de ella. El silencio se
                mide contra lo que ESE aliado suele tardar, no contra un plazo
                fijo: cuatro horas dicen algo de quien contesta en once minutos
                y no dicen nada de quien siempre tarda dos horas y media.
              */}
              {acciones[s.id]?.accion ? (
                <div style={{ marginTop: 12, background: 'color-mix(in srgb, var(--color-warning) 9%, transparent)', border: `1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)`, borderRadius: 11, padding: '10px 13px', display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12.5, color: C.ink }}>{acciones[s.id].accion}</span>
                  {acciones[s.id].alternativas > 0 ? (
                    <button type="button" onClick={() => setAsignando(s)} style={{ ...botonSec, borderColor: C.warn, color: C.ink }}>
                      Ver {acciones[s.id].alternativas} alterno(s)
                    </button>
                  ) : null}
                </div>
              ) : null}

              {/* Acciones */}
              <div style={{ marginTop: 14, paddingTop: 13, borderTop: `1px solid ${C.line}`, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(s.state === 'por_asignar' || esperando.length === 0) && aceptado.length === 0 ? (
                  <button type="button" onClick={() => setAsignando(s)} style={boton}>Buscar aliado</button>
                ) : (
                  <button type="button" onClick={() => setAsignando(s)} style={botonSec}>Sumar otro aliado</button>
                )}

                {/*
                  Levantar una incidencia tiene que costar tres clics: si cuesta
                  trabajo no se levanta, y entonces el registro dice que todo va
                  bien porque nadie tuvo tiempo de decir lo contrario.
                */}
                <button type="button" onClick={() => setIncidencias(s)} style={botonSec}>
                  Incidencias
                </button>

                {s.next.map((n) =>
                  n.state === 'cerrado' ? (
                    <button key={n.state} type="button" onClick={() => setCerrando(s)} disabled={ocupado === s.id} style={botonSec}>
                      Cerrar…
                    </button>
                  ) : n.state === 'cancelado' ? null : (
                    <button
                      key={n.state}
                      type="button"
                      onClick={() => mover(s, n.state)}
                      disabled={ocupado === s.id}
                      style={{ ...botonSec, opacity: ocupado === s.id ? 0.5 : 1 }}
                    >
                      {n.label}
                    </button>
                  ),
                )}

                {s.next.some((n) => n.state === 'cancelado') ? (
                  <button
                    type="button"
                    onClick={() => {
                      const nota = window.prompt('¿Por qué se cancela?');
                      if (nota !== null) mover(s, 'cancelado', { note: nota || undefined });
                    }}
                    disabled={ocupado === s.id}
                    style={{ ...botonSec, color: C.dim, marginLeft: 'auto' }}
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
            </div>
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cerrar servicio"
      onClick={onCerrar}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', padding: 20, zIndex: 200 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: C.panel, border: `1px solid ${C.line2}`, borderRadius: 18, padding: 24, width: 'min(460px, 100%)', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', color: C.ink }}
      >
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>Cerrar servicio</h2>
        <p style={{ margin: '0 0 18px', fontSize: 12.5, color: C.muted, lineHeight: 1.55 }}>
          {servicio.client} · {servicio.quoteNumber}. Registra cuánto se usó: es de lo que dependen la factura y el historial.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, color: C.muted }}>Cantidad</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              autoFocus
              style={input}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, color: C.muted }}>Unidad</span>
            <select value={unidad} onChange={(e) => setUnidad(e.target.value)} style={input}>
              {servicio.units.map((u) => (
                <option key={u.clave} value={u.clave}>{u.label}</option>
              ))}
            </select>
          </label>
        </div>

        <label style={{ display: 'grid', gap: 6, marginTop: 14 }}>
          <span style={{ fontSize: 12, color: C.muted }}>Observaciones del cierre (opcional)</span>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
            placeholder="Ajustes, incidencias, tiempos de espera…"
            style={{ ...input, resize: 'vertical', lineHeight: 1.55 }}
          />
        </label>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onCerrar} style={{ ...botonSec, flex: 1, padding: '11px 16px' }}>Cancelar</button>
          <button
            type="button"
            disabled={!valido || ocupado}
            onClick={() => onGuardar(servicio, 'cerrado', { quantity: n, unit: unidad, note: nota.trim() || undefined })}
            style={{ ...boton, flex: 2, padding: '11px 18px', fontSize: 14, opacity: !valido || ocupado ? 0.5 : 1, cursor: !valido || ocupado ? 'default' : 'pointer' }}
          >
            {ocupado ? 'Cerrando…' : 'Cerrar servicio'}
          </button>
        </div>
      </div>
    </div>
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
    matches: Array<{ providerId: number; name: string; verified: boolean; level: string; score: number; reasons: string[]; warnings: string[]; siteRequirements?: Array<{ texto: string; estado: string; nota: string }> }>;
  } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/admin/quotes/${servicio.id}/matches`)
      .then((r) => r.json())
      .then((d) => { if (vivo) setDatos(d); })
      .catch(() => { if (vivo) setDatos({ motivo: 'No se pudo consultar la red.', matches: [] }); })
      .finally(() => { if (vivo) setCargando(false); });
    // `vivo` evita escribir en un componente ya cerrado: el modal se puede
    // cerrar antes de que conteste la API.
    return () => { vivo = false; };
  }, [servicio.id]);

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Buscar aliado"
      onClick={onCerrar}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', padding: 20, zIndex: 200 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: C.panel, border: `1px solid ${C.line2}`, borderRadius: 18, padding: 24, width: 'min(600px, 100%)', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', color: C.ink }}
      >
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>Buscar aliado</h2>
        <p style={{ margin: '0 0 18px', fontSize: 12.5, color: C.muted, lineHeight: 1.55 }}>
          {servicio.category ?? 'Sin línea'} · {servicio.address ?? 'Sin zona'}. Ofrecerlo no lo asigna: queda esperando su respuesta.
        </p>

        {cargando ? <div style={{ fontSize: 13, color: C.muted, padding: '18px 0' }}>Consultando la red…</div> : null}

        {datos && datos.matches.length === 0 && !cargando ? (
          <div style={{ padding: '22px 0', fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{datos.motivo}</div>
        ) : null}

        <div style={{ display: 'grid', gap: 10 }}>
          {(datos?.matches ?? []).map((m) => {
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
              <div key={m.providerId} style={{ border: `1px solid ${C.line2}`, borderRadius: 13, padding: '13px 15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{m.name}</span>
                    {m.verified ? <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, color: C.accent }}>✓ VERIFICADO</span> : null}
                  </div>
                  <button
                    type="button"
                    disabled={yaTiene || enviando !== null}
                    onClick={() => ofrecer(m.providerId)}
                    style={{ ...(yaTiene ? botonSec : boton), opacity: yaTiene || enviando !== null ? 0.5 : 1, cursor: yaTiene ? 'default' : 'pointer' }}
                  >
                    {etiqueta ?? (enviando === m.providerId ? 'Enviando…' : 'Ofrecerle')}
                  </button>
                </div>
                {previa?.reason ? (
                  <div style={{ marginTop: 7, fontSize: 12, color: C.dim }}>Dijo: “{previa.reason}”</div>
                ) : null}
                <ul style={{ margin: '9px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 3 }}>
                  {m.reasons.map((r) => (
                    <li key={r} style={{ fontSize: 12.5, color: C.muted }}><span style={{ color: C.accent, marginRight: 7 }}>+</span>{r}</li>
                  ))}
                  {m.warnings.map((w) => (
                    <li key={w} style={{ fontSize: 12.5, color: C.dim }}><span style={{ color: C.warn, marginRight: 7 }}>!</span>{w}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <button type="button" onClick={onCerrar} style={{ ...botonSec, width: '100%', marginTop: 20, padding: '11px 16px' }}>Cerrar</button>
      </div>
    </div>
  );
}
