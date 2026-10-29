'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Modal } from '@/components/Modal';
import { EmptyState, Note, PageHeader, Panel, Segmented, btnClass } from '@/components/ui';

/**
 * ¿CÓMO VA EL NEGOCIO? (Indicadores, rediseño del 2026-10-27).
 *
 * El dueño, ante los doce cuadros iguales de antes: "no entiendo nada y el
 * diseño no me gusta". Ahora se lee de arriba abajo como una historia: el
 * camino de una solicitud (cuántas llegan, se cotizan, se aceptan y se
 * terminan), cuatro tarjetas con semáforo y su meta escrita, dónde nos falta
 * red, las solicitudes por mes y los clientes que regresan. Cada número se
 * toca para ver qué solicitudes lo forman. La API es admin-analytics.controller.ts.
 */

type Semaforo = 'verde' | 'amarillo' | 'rojo' | 'gris';
interface Embudo { llegaron: number; cotizadas: number; aceptadas: number; terminadas: number }
export interface Tablero {
  periodo: { clave: string; desde: string; hasta: string };
  contexto: { aliadosActivos: number; equiposActivos: number; clientes: number };
  embudo: Embudo;
  embudoAntes: Embudo;
  tarjetas: {
    cotizacion: { valor: number | null; muestra: number; antes: number | null; semaforo: Semaforo; meta: string };
    aceptan: { valor: number | null; muestra: number; antes: number | null; semaforo: Semaforo; meta: string };
    problemas: { valor: number | null; muestra: number; antes: number | null; semaforo: Semaforo; meta: string; cancelados: number; conIncidencia: number };
    margen: { valor: number | null; servicios: number; antes: number | null };
  };
  faltaRed: Array<{ linea: string; lineaNombre: string; municipio: string; motivos: string[]; solicitudes: number; folios: Array<{ id: number; folio: string }> }>;
  porMes: Array<{ mes: string; solicitudes: number }>;
  clientes: { total: number; regresan: number };
}
interface Caso { id: number; folio: string; cliente: string; linea: string | null; fecha: string | null; enQueVa: string; horasACotizar: number | null }

const PERIODOS: Array<[string, string]> = [['mes', 'Este mes'], ['90', '3 meses'], ['180', '6 meses'], ['365', 'Año']];
/** Colores del camino: cada paso el suyo, siempre los mismos. */
const PASOS: Array<{ clave: keyof Embudo; texto: string; icono: string; color: string; puente?: string }> = [
  { clave: 'llegaron', texto: 'Llegaron', icono: 'ph-tray-arrow-down', color: 'var(--adm-info)' },
  { clave: 'cotizadas', texto: 'Se cotizaron', icono: 'ph-calculator', color: 'var(--estado-reservado)', puente: 'se cotizan' },
  { clave: 'aceptadas', texto: 'Aceptaron', icono: 'ph-handshake', color: 'var(--adm-warn)', puente: 'aceptan' },
  { clave: 'terminadas', texto: 'Se terminaron', icono: 'ph-flag-checkered', color: 'var(--adm-ok)', puente: 'se terminan' },
];
const COLOR: Record<Semaforo, string> = { verde: 'var(--adm-ok)', amarillo: 'var(--adm-warn)', rojo: 'var(--adm-bad)', gris: 'var(--adm-faint)' };
const DICE: Record<Semaforo, string> = { verde: 'Bien', amarillo: 'Ojo', rojo: 'Mal', gris: 'Pocos casos' };

const dinero = (n: number) => `$${Math.round(n).toLocaleString('es-MX')}`;
const dia = (iso: string) => new Date(`${iso}T12:00:00`);
const fechaCorta = (iso: string) => new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(dia(iso)).replace('.', '');
const mesCorto = (ym: string) => new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(dia(`${ym}-01`)).replace('.', '');
/** "42 min", "2 h", "3 días". */
function tiempo(h: number): string {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h * 10) / 10} h`;
  return `${Math.round(h / 24)} días`;
}

/** "↑ antes 7", pintado según si subir es bueno en ESE número. */
function Antes({ valor, antes, subirEsBueno, fmt }: { valor: number | null; antes: number | null; subirEsBueno: boolean; fmt: (n: number) => string }) {
  if (antes === null || valor === null) return <span style={{ color: 'var(--adm-faint)' }}>Sin dato del periodo anterior</span>;
  if (valor === antes) return <span style={{ color: 'var(--adm-muted)' }}>Igual que antes ({fmt(antes)})</span>;
  const sube = valor > antes;
  const bueno = sube === subirEsBueno;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: bueno ? 'var(--adm-ok)' : 'var(--adm-bad)' }}>
      <i className={`ph-bold ${sube ? 'ph-arrow-up' : 'ph-arrow-down'}`} aria-hidden />
      <span>Antes: {fmt(antes)}</span>
    </span>
  );
}

export function AnalyticsBoard({ tablero, periodo }: { tablero: Tablero | null; periodo: string }) {
  const [casos, setCasos] = useState<{ clave: string; titulo: string } | null>(null);

  const encabezado = (sub?: string) => (
    <PageHeader
      eyebrow={['4 · Cobrar y medir', 'Indicadores']}
      title="¿Cómo va el negocio?"
      subtitle={sub}
      actions={<Segmented ariaLabel="Periodo" value={periodo} items={PERIODOS.map(([k, t]) => ({ key: k, label: t, href: k === '90' ? '/indicadores' : `/indicadores?periodo=${k}` }))} />}
    />
  );
  if (!tablero) return <div>{encabezado()}<Note tone="bad">No se pudieron cargar los indicadores.</Note></div>;

  const { embudo: e, tarjetas: t } = tablero;
  const max = Math.max(1, e.llegaron);
  const frase = e.cotizadas > 0
    ? `De cada 10 que cotizamos, ${Math.round((e.aceptadas / e.cotizadas) * 10)} aceptan el precio.`
    : 'Todavía no hay cotizaciones en este periodo.';
  const maxMes = Math.max(1, ...tablero.porMes.map((m) => m.solicitudes));
  const mesActual = tablero.porMes[tablero.porMes.length - 1]?.mes;
  const c = tablero.contexto;

  return (
    <div>
      <style>{`
        .ng-paso { display: grid; grid-template-columns: 150px minmax(0, 1fr) 64px; gap: 14px; align-items: center; width: 100%; padding: 8px 10px;
          margin: 0 -10px; border: 0; border-radius: 10px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
        .ng-paso:hover { background: var(--adm-raised); }
        .ng-paso-t { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 600; color: var(--adm-text); }
        .ng-ico { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; flex: none; font-size: 17px;
          color: var(--ng-c); background: color-mix(in srgb, var(--ng-c) 16%, transparent); }
        .ng-barra { height: 26px; border-radius: 8px; background: color-mix(in srgb, var(--ng-c) 10%, transparent); overflow: hidden; }
        .ng-barra > span { display: block; height: 100%; border-radius: 8px; transition: width .4s ease;
          background: linear-gradient(90deg, color-mix(in srgb, var(--ng-c) 70%, transparent), var(--ng-c)); }
        .ng-num { font-size: 22px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; color: var(--adm-text); }
        .ng-puente { display: flex; align-items: center; gap: 6px; padding: 0 0 0 176px; font-size: 12.5px; color: var(--adm-muted); }
        .ng-tarjetas { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-top: 20px; }
        .ng-tarjeta { display: grid; gap: 6px; align-content: start; padding: 18px 20px; border-radius: 14px; text-align: left; font: inherit; color: inherit;
          border: 1px solid color-mix(in srgb, var(--ng-c) 35%, var(--adm-border)); cursor: pointer; text-decoration: none;
          background: linear-gradient(160deg, color-mix(in srgb, var(--ng-c) 12%, var(--adm-card)), var(--adm-card) 70%); }
        .ng-tarjeta:hover { border-color: var(--ng-c); }
        .ng-tarjeta-cab { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .ng-tarjeta-l { display: flex; align-items: center; gap: 9px; font-size: 13.5px; font-weight: 600; color: var(--adm-text-2); }
        .ng-dice { display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700;
          color: var(--ng-c); background: color-mix(in srgb, var(--ng-c) 16%, transparent); }
        .ng-dice::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--ng-c); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ng-c) 25%, transparent); }
        .ng-valor { font-size: 34px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; color: var(--ng-c); font-variant-numeric: tabular-nums; }
        .ng-sub { font-size: 12.5px; color: var(--adm-muted); line-height: 1.45; }
        .ng-pie { font-size: 12px; margin-top: 4px; }
        .ng-abajo { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 14px; margin-top: 20px; align-items: start; }
        .ng-abajo > .adm-panel { margin-top: 0; }
        @media (max-width: 900px) {
          .ng-abajo { grid-template-columns: 1fr; }
          .ng-paso { grid-template-columns: 1fr 52px; }
          .ng-paso .ng-barra { grid-column: 1 / -1; grid-row: 2; }
          .ng-puente { padding-left: 10px; }
        }
      `}</style>

      {encabezado(`Del ${fechaCorta(tablero.periodo.desde)}${tablero.periodo.desde.slice(0, 4) !== tablero.periodo.hasta.slice(0, 4) ? ` de ${tablero.periodo.desde.slice(0, 4)}` : ''} al ${fechaCorta(tablero.periodo.hasta)} · ${c.aliadosActivos} aliados activos · ${c.equiposActivos} equipos · ${c.clientes} clientes`)}

      {/* ── 1. El camino de una solicitud ── */}
      <Panel title="El camino de una solicitud" icon="ph-path" desc={frase}>
        <div style={{ display: 'grid', gap: 2 }}>
          {PASOS.map((p, i) => {
            const n = e[p.clave];
            const previo = i > 0 ? e[PASOS[i - 1].clave] : 0;
            return (
              <div key={p.clave} style={{ display: 'grid', gap: 2 }}>
                {i > 0 ? (
                  <div className="ng-puente">
                    <i className="ph-bold ph-arrow-down" aria-hidden />
                    {previo > 0 ? `${Math.round((n / previo) * 100)}% ${p.puente}` : p.puente}
                  </div>
                ) : null}
                <button type="button" className="ng-paso" style={{ '--ng-c': p.color } as CSSProperties} onClick={() => setCasos({ clave: p.clave, titulo: `${p.texto} · ${n}` })}
                  title="Ver las solicitudes">
                  <span className="ng-paso-t"><span className="ng-ico"><i className={`ph-bold ${p.icono}`} aria-hidden /></span>{p.texto}</span>
                  <span className="ng-barra"><span style={{ width: `${(n / max) * 100}%` }} /></span>
                  <span className="ng-num">{n}</span>
                </button>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 12, fontSize: 12.5 }}>
          <Antes valor={e.llegaron} antes={tablero.embudoAntes.llegaron} subirEsBueno fmt={(n) => `${n} solicitudes`} />
        </div>
      </Panel>

      {/* ── 2. Las cuatro tarjetas ── */}
      <div className="ng-tarjetas">
        <Tarjeta icono="ph-timer" titulo="Tiempo para cotizar" s={t.cotizacion.semaforo}
          valor={t.cotizacion.valor !== null ? tiempo(t.cotizacion.valor) : '—'}
          sub={`Lo que normalmente tarda el cliente en tener precio. ${t.cotizacion.meta}.`}
          pie={<Antes valor={t.cotizacion.valor} antes={t.cotizacion.antes} subirEsBueno={false} fmt={tiempo} />}
          onClick={() => setCasos({ clave: 'cotizacion', titulo: 'Tiempo para cotizar · las más lentas arriba' })} />
        <Tarjeta icono="ph-handshake" titulo="Aceptan el precio" s={t.aceptan.semaforo}
          valor={t.aceptan.valor !== null ? `${t.aceptan.valor}%` : '—'}
          sub={`De las ${t.aceptan.muestra} que cotizamos. ${t.aceptan.meta}.`}
          pie={<Antes valor={t.aceptan.valor} antes={t.aceptan.antes} subirEsBueno fmt={(n) => `${n}%`} />}
          onClick={() => setCasos({ clave: 'aceptan', titulo: 'Las que cotizamos · en qué van' })} />
        <Tarjeta icono="ph-warning" titulo="Servicios con problemas" s={t.problemas.semaforo}
          valor={t.problemas.valor !== null ? `${t.problemas.valor}%` : '—'}
          sub={`${t.problemas.cancelados} cancelado${t.problemas.cancelados === 1 ? '' : 's'} y ${t.problemas.conIncidencia} con incidencia, de ${t.problemas.muestra} terminados. ${t.problemas.meta}.`}
          pie={<Antes valor={t.problemas.valor} antes={t.problemas.antes} subirEsBueno={false} fmt={(n) => `${n}%`} />}
          onClick={() => setCasos({ clave: 'problemas', titulo: 'Servicios cancelados o con incidencia' })} />
        <Tarjeta icono="ph-coins" titulo="Lo que ganamos" color="var(--adm-ok)" dice={null}
          valor={t.margen.valor !== null ? dinero(t.margen.valor) : '$0'}
          sub={`De ${t.margen.servicios} servicio${t.margen.servicios === 1 ? '' : 's'} cerrado${t.margen.servicios === 1 ? '' : 's'}, sin IVA. Toca para ver Margen.`}
          pie={<Antes valor={t.margen.valor} antes={t.margen.antes} subirEsBueno fmt={dinero} />}
          href="/administracion/margen" />
      </div>

      {/* ── 3. Dónde nos falta red · Solicitudes por mes ── */}
      <div className="ng-abajo">
        <Panel flush clip title="Dónde nos falta red" icon="ph-map-pin-area" desc="Solicitudes que ningún aliado pudo tomar. Ahí conviene buscar aliados.">
          {tablero.faltaRed.length === 0 ? (
            <EmptyState icon="ph-check-circle" title="La red alcanzó para todo" sub="Ninguna solicitud de este periodo se quedó sin quién la tomara." />
          ) : tablero.faltaRed.map((g) => (
            <div key={`${g.linea}|${g.municipio}`} className="adm-trow" style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: 14, alignItems: 'center' }}>
              <span className="adm-num" style={{ width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 700, color: 'var(--adm-bad)', background: 'color-mix(in srgb, var(--adm-bad) 14%, transparent)' }}>{g.solicitudes}</span>
              <div style={{ minWidth: 0 }}>
                <div className="adm-cell-title">{g.lineaNombre} · {g.municipio}</div>
                <div className="adm-cell-sub">{g.motivos.join(' · ')}</div>
                <div className="adm-cell-sub" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                  {g.folios.map((f) => <a key={f.id} className="adm-link adm-mono" href={`/cotizaciones?ver=${f.id}`}>{f.folio}</a>)}
                </div>
              </div>
              <a className={btnClass('secondary', 'sm')} href="/proveedores" style={{ whiteSpace: 'nowrap' }}>
                <i className="ph ph-user-plus" aria-hidden />Buscar aliados
              </a>
            </div>
          ))}
        </Panel>

        <Panel title="Solicitudes por mes" icon="ph-chart-bar" desc="Si el trabajo sube o baja.">
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tablero.porMes.length}, 1fr)`, gap: 8, alignItems: 'end', height: 150 }} role="img" aria-label="Solicitudes por mes">
            {tablero.porMes.map((m) => {
              const sel = m.mes === mesActual;
              return (
                <div key={m.mes} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 4, height: '100%' }} title={`${m.solicitudes} solicitudes`}>
                  <span className="adm-num" style={{ fontSize: 11.5, fontWeight: 600, color: sel ? 'var(--adm-text)' : 'var(--adm-muted)' }}>{m.solicitudes}</span>
                  <span style={{ width: '70%', height: `${(m.solicitudes / maxMes) * 100}px`, minHeight: m.solicitudes ? 4 : 0, borderRadius: '6px 6px 2px 2px',
                    background: sel ? 'linear-gradient(180deg, var(--adm-info), color-mix(in srgb, var(--adm-info) 60%, transparent))' : 'color-mix(in srgb, var(--adm-info) 40%, transparent)' }} />
                  <span style={{ fontSize: 11.5, fontWeight: sel ? 700 : 400, color: sel ? 'var(--adm-text)' : 'var(--adm-muted)' }}>{mesCorto(m.mes)}</span>
                </div>
              );
            })}
          </div>
          {/* Clientes que regresan: una línea, con su barrita. */}
          <div style={{ borderTop: '1px solid var(--adm-border)', marginTop: 16, paddingTop: 14, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, color: 'var(--adm-text-2)' }}>
                <i className="ph-bold ph-arrows-clockwise" aria-hidden style={{ color: 'var(--estado-reservado)' }} />Clientes que regresan
              </span>
              <span className="adm-num" style={{ fontSize: 14, fontWeight: 700 }}>{tablero.clientes.regresan} de {tablero.clientes.total}</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'color-mix(in srgb, #a78bfa 14%, transparent)', overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${tablero.clientes.total ? (tablero.clientes.regresan / tablero.clientes.total) * 100 : 0}%`, background: 'var(--estado-reservado)', borderRadius: 999 }} />
            </div>
            <span className="ng-sub">Han pedido más de una vez desde que son clientes.</span>
          </div>
        </Panel>
      </div>

      {casos ? <Casos clave={casos.clave} titulo={casos.titulo} periodo={periodo} onCerrar={() => setCasos(null)} /> : null}
    </div>
  );
}

function Tarjeta({ icono, titulo, s, color, dice, valor, sub, pie, onClick, href }: {
  icono: string; titulo: string; s?: Semaforo; color?: string; dice?: string | null;
  valor: string; sub: string; pie: ReactNode; onClick?: () => void; href?: string;
}) {
  const c = color ?? COLOR[s ?? 'gris'];
  const etiqueta = dice === undefined ? DICE[s ?? 'gris'] : dice;
  const cuerpo = (
    <>
      <div className="ng-tarjeta-cab">
        <span className="ng-tarjeta-l"><i className={`ph-bold ${icono}`} aria-hidden style={{ color: c, fontSize: 17 }} />{titulo}</span>
        {etiqueta ? <span className="ng-dice">{etiqueta}</span> : null}
      </div>
      <div className="ng-valor">{valor}</div>
      <div className="ng-sub">{sub}</div>
      <div className="ng-pie">{pie}</div>
    </>
  );
  const estilo = { '--ng-c': c } as CSSProperties;
  return href
    ? <a className="ng-tarjeta" href={href} style={estilo}>{cuerpo}</a>
    : <button type="button" className="ng-tarjeta" style={estilo} onClick={onClick}>{cuerpo}</button>;
}

/** Las solicitudes detrás de un número, en una ventana. */
function Casos({ clave, titulo, periodo, onCerrar }: { clave: string; titulo: string; periodo: string; onCerrar: () => void }) {
  const [filas, setFilas] = useState<Caso[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let vivo = true;
    fetch(`/api/admin/analytics/casos?clave=${encodeURIComponent(clave)}&periodo=${encodeURIComponent(periodo)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Caso[]) => { if (vivo) setFilas(d); })
      .catch(() => { if (vivo) setError(true); });
    return () => { vivo = false; };
  }, [clave, periodo]);
  return (
    <Modal abierto titulo={titulo} subtitulo="Toca un folio para abrirlo." onCerrar={onCerrar} ancho={680}>
      {error ? <Note tone="bad">No se pudieron cargar.</Note> : filas === null ? (
        <div className="ng-sub">Cargando…</div>
      ) : filas.length === 0 ? (
        <EmptyState icon="ph-tray" title="Ninguna en este periodo" />
      ) : (
        <div style={{ display: 'grid' }}>
          {filas.map((f) => (
            <div key={f.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--adm-border)' }}>
              <div style={{ minWidth: 0 }}>
                <a className="adm-link adm-mono" href={`/cotizaciones?ver=${f.id}`} style={{ fontWeight: 600 }}>{f.folio}</a>
                <span style={{ color: 'var(--adm-text)' }}> · {f.cliente}</span>
                <div className="adm-cell-sub">{[f.linea, f.fecha ? fechaCorta(f.fecha) : null, clave === 'cotizacion' && f.horasACotizar !== null ? `cotizada en ${tiempo(f.horasACotizar)}` : null].filter(Boolean).join(' · ')}</div>
              </div>
              <span className="adm-cell-sub" style={{ whiteSpace: 'nowrap' }}>{f.enQueVa}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
