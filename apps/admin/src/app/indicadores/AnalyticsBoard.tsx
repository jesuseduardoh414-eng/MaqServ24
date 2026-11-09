'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Modal } from '@/components/Modal';
import { Bar, Chip, EmptyState, Note, PageHeader, Panel, Segmented, btnClass, type Tone } from '@/components/ui';

/**
 * ¿CÓMO VA EL NEGOCIO? (Indicadores, rediseño del 2026-10-27).
 *
 * El dueño, ante los doce cuadros iguales de antes: "no entiendo nada y el
 * diseño no me gusta". Ahora se lee de arriba abajo como una historia: el
 * camino de una solicitud (cuántas llegan, se cotizan, se aceptan y se
 * terminan), las tarjetas con semáforo y su meta escrita, dónde nos falta
 * red, las solicitudes por mes y los clientes que regresan. Cada número se
 * toca para ver qué solicitudes lo forman. La API es admin-analytics.controller.ts.
 *
 * USO DE LAS MÁQUINAS (2026-11-09): una tarjeta más y, al final, el uso por
 * tipo y por aliado (lo más ocupado arriba: ahí faltan aliados; abajo lo que
 * casi no se usa). Se quitó el 27 de octubre porque no se podía medir; ahora
 * sale solo de los servicios (la cuenta, en api/src/admin/uso-maquinas.ts).
 * Lo que forma cada número viene ya en el tablero: la ventana abre sin pedir
 * nada más.
 */

type Semaforo = 'verde' | 'amarillo' | 'rojo' | 'gris';
interface Embudo { llegaron: number; cotizadas: number; aceptadas: number; terminadas: number }
/** Un renglón del uso: un tipo de máquina o un aliado. */
interface FilaUso {
  clave: string; nombre: string; ids: number[]; maquinas: number; unidades: number; aliados: number;
  ocupados: number; posibles: number; pct: number | null; semaforo: Semaforo; senal: 'lleno' | 'casiNada' | null;
}
/** Una máquina con los servicios que la ocuparon en el periodo. */
interface MaquinaUso {
  id: number; nombre: string; aliadoId: number; aliado: string; tipo: string; unidades: number;
  ocupados: number; posibles: number; pct: number | null; semaforo: Semaforo;
  servicios: Array<{ id: number; folio: string; dias: number }>;
}
interface TarjetaUso {
  valor: number | null; muestra: number; antes: number | null; semaforo: Semaforo; meta: string;
  ocupados: number; posibles: number; maquinas: number; unidades: number; aliados: number;
}
export interface Tablero {
  periodo: { clave: string; desde: string; hasta: string };
  contexto: { aliadosActivos: number; equiposActivos: number; clientes: number };
  embudo: Embudo;
  embudoAntes: Embudo;
  tarjetas: {
    cotizacion: { valor: number | null; muestra: number; antes: number | null; semaforo: Semaforo; meta: string };
    aceptan: { valor: number | null; muestra: number; antes: number | null; semaforo: Semaforo; meta: string };
    problemas: { valor: number | null; muestra: number; antes: number | null; semaforo: Semaforo; meta: string; cancelados: number; conIncidencia: number };
    /** Opcional: si su cuenta falla (o el API es de antes del 2026-11-09) no llega, y el resto del tablero sale igual. */
    uso?: TarjetaUso;
    margen: { valor: number | null; servicios: number; antes: number | null };
  };
  faltaRed: Array<{ linea: string; lineaNombre: string; municipio: string; motivos: string[]; solicitudes: number; folios: Array<{ id: number; folio: string }> }>;
  porMes: Array<{ mes: string; solicitudes: number }>;
  clientes: { total: number; regresan: number };
  uso?: { porTipo: FilaUso[]; porAliado: FilaUso[]; detalle: MaquinaUso[]; sinMaquina: Array<{ id: number; folio: string }> };
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
const TONO: Record<Semaforo, Tone> = { verde: 'ok', amarillo: 'warn', rojo: 'bad', gris: 'muted' };
/** "1 máquina", "3 máquinas". */
const cuantas = (n: number, una: string, varias: string) => `${n} ${n === 1 ? una : varias}`;

/** Qué dice la tarjeta del uso, también cuando todavía no hay con qué medir. */
function textoUso(u: TarjetaUso): string {
  if (u.unidades === 0) return 'Todavía no hay máquinas de aliados dadas de alta: no hay qué medir.';
  if (u.valor === null) return `Ninguna de las ${cuantas(u.unidades, 'máquina', 'máquinas')} de los aliados salió a un servicio en este periodo: todavía no hay con qué medir.`;
  return `Trabajaron con MAQSER24 ${u.ocupados} de ${u.posibles} días hábiles posibles, entre ${cuantas(u.unidades, 'máquina', 'máquinas')} de ${cuantas(u.aliados, 'aliado', 'aliados')}. ${u.meta}.`;
}

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
  /** La ventana del uso: qué máquinas forman el número (`ids` null = todas). */
  const [usoAbierto, setUsoAbierto] = useState<{ titulo: string; ids: number[] | null } | null>(null);
  const [vistaUso, setVistaUso] = useState<'tipo' | 'aliado'>('tipo');

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
  const uso = tablero.uso;

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
        /* Cinco tarjetas (2026-11-09): con auto-fit la quinta se quedaba sola
           en otra fila. Se acomodan según el ancho de la caja: 5 en una fila,
           3 + 2, 2 + 2 + 1 a lo ancho, o una debajo de otra en el teléfono. */
        .ng-tarjetas-caja { container-type: inline-size; margin-top: 20px; }
        .ng-tarjetas { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
        @container (min-width: 460px) {
          .ng-tarjetas { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .ng-tarjetas > :last-child { grid-column: 1 / -1; }
        }
        @container (min-width: 760px) {
          .ng-tarjetas { grid-template-columns: repeat(6, minmax(0, 1fr)); }
          .ng-tarjetas > * { grid-column: span 2; }
          .ng-tarjetas > :nth-child(n+4) { grid-column: span 3; }
        }
        @container (min-width: 1100px) {
          .ng-tarjetas { grid-template-columns: repeat(5, minmax(0, 1fr)); }
          .ng-tarjetas > *, .ng-tarjetas > :nth-child(n+4) { grid-column: auto; }
        }
        .ng-tarjeta { display: grid; gap: 6px; align-content: start; padding: 18px 20px; border-radius: 14px; text-align: left; font: inherit; color: inherit;
          border: 1px solid color-mix(in srgb, var(--ng-c) 35%, var(--adm-border)); cursor: pointer; text-decoration: none;
          background: linear-gradient(160deg, color-mix(in srgb, var(--ng-c) 12%, var(--adm-card)), var(--adm-card) 70%); }
        .ng-tarjeta:hover { border-color: var(--ng-c); }
        .ng-tarjeta-cab { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px 8px; }
        .ng-tarjeta-l { display: flex; align-items: center; gap: 9px; font-size: 13.5px; font-weight: 600; color: var(--adm-text-2); }
        .ng-dice { display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700;
          color: var(--ng-c); background: color-mix(in srgb, var(--ng-c) 16%, transparent); }
        .ng-dice::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--ng-c); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ng-c) 25%, transparent); }
        .ng-valor { font-size: 34px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; color: var(--ng-c); font-variant-numeric: tabular-nums; }
        .ng-sub { font-size: 12.5px; color: var(--adm-muted); line-height: 1.45; }
        .ng-pie { font-size: 12px; margin-top: 4px; }
        .ng-abajo { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 14px; margin-top: 20px; align-items: start; }
        .ng-abajo > .adm-panel { margin-top: 0; }
        /* Uso de las máquinas: cada renglón se toca, como los pasos del camino. */
        .ng-uso-panel { margin-top: 20px; }
        .ng-uso-panel .adm-panel-head { flex-wrap: wrap; }
        .ng-uso { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) 56px; gap: 6px 16px; align-items: center;
          width: calc(100% + 20px); padding: 10px; margin: 0 -10px; border: 0; border-radius: 10px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
        .ng-uso:hover { background: var(--adm-raised); }
        .ng-uso-t { display: grid; gap: 2px; min-width: 0; }
        .ng-uso-n { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; font-size: 14px; font-weight: 600; color: var(--adm-text); }
        .ng-uso-barra { height: 10px; border-radius: 999px; overflow: hidden; background: color-mix(in srgb, var(--ng-c) 14%, transparent); }
        .ng-uso-barra > span { display: block; height: 100%; border-radius: 999px; background: var(--ng-c); transition: width .4s ease; }
        .ng-uso-num { font-size: 18px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; color: var(--ng-c); }
        .ng-como { width: 100%; }
        .ng-como summary { cursor: pointer; font-weight: 600; color: var(--adm-text-2); }
        .ng-como p { margin: 8px 0 0; line-height: 1.55; }
        @media (max-width: 760px) {
          .ng-uso { grid-template-columns: minmax(0, 1fr) 52px; }
          .ng-uso-barra { grid-column: 1 / -1; grid-row: 2; }
          .ng-uso-num { grid-column: 2; grid-row: 1; }
        }
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

      {/* ── 2. Las tarjetas ── */}
      <div className="ng-tarjetas-caja">
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
          {/* Sin con qué medir no dice "Pocos casos" ni pinta un 0%: dice que no hay datos. */}
          {t.uso ? (
            <Tarjeta icono="ph-gauge" titulo="Uso de las máquinas" s={t.uso.semaforo}
              dice={t.uso.valor === null ? 'Sin datos' : undefined}
              valor={t.uso.valor !== null ? `${t.uso.valor}%` : '—'}
              sub={textoUso(t.uso)}
              pie={<Antes valor={t.uso.valor} antes={t.uso.antes} subirEsBueno fmt={(n) => `${n}%`} />}
              onClick={() => setUsoAbierto({ titulo: 'Uso de las máquinas · cada máquina', ids: null })} />
          ) : null}
          <Tarjeta icono="ph-coins" titulo="Lo que ganamos" color="var(--adm-ok)" dice={null}
            valor={t.margen.valor !== null ? dinero(t.margen.valor) : '$0'}
            sub={`De ${t.margen.servicios} servicio${t.margen.servicios === 1 ? '' : 's'} cerrado${t.margen.servicios === 1 ? '' : 's'}, sin IVA. Toca para ver Margen.`}
            pie={<Antes valor={t.margen.valor} antes={t.margen.antes} subirEsBueno fmt={dinero} />}
            href="/administracion/margen" />
        </div>
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

      {/* ── 4. Uso de las máquinas: por tipo o por aliado ── */}
      {uso && t.uso ? (
        <Panel className="ng-uso-panel" title="Uso de las máquinas" icon="ph-gauge"
          desc="Arriba lo más ocupado: ahí conviene sumar aliados. Abajo lo que casi no se usa."
          action={t.uso.valor !== null
            ? <Segmented ariaLabel="Ver el uso" value={vistaUso} onChange={setVistaUso} items={[{ key: 'tipo', label: 'Por tipo' }, { key: 'aliado', label: 'Por aliado' }]} />
            : undefined}
          footer={<ComoSeCalcula sinMaquina={uso.sinMaquina} />}>
          {t.uso.valor === null ? (
            <EmptyState icon="ph-gauge"
              title={t.uso.unidades === 0 ? 'Todavía no hay máquinas de aliados' : 'Todavía no hay con qué medir'}
              sub={t.uso.unidades === 0
                ? 'Cuando los aliados registren sus máquinas y salgan a servicios, aquí se verá cuáles se ocupan más y cuáles casi no.'
                : 'Ninguna máquina de aliado salió a un servicio en este periodo. Cuando salgan, aquí se verá cuáles se ocupan más y cuáles casi no.'} />
          ) : (
            <div style={{ display: 'grid' }}>
              {(vistaUso === 'tipo' ? uso.porTipo : uso.porAliado).map((f) => (
                <FilaDeUso key={f.clave} f={f} vista={vistaUso}
                  onAbrir={() => setUsoAbierto({ titulo: `${f.nombre} · ${f.pct !== null ? `${f.pct}%` : 'sin días'}`, ids: f.ids })} />
              ))}
            </div>
          )}
        </Panel>
      ) : null}

      {casos ? <Casos clave={casos.clave} titulo={casos.titulo} periodo={periodo} onCerrar={() => setCasos(null)} /> : null}
      {usoAbierto && uso ? (
        <UsoDetalle titulo={usoAbierto.titulo}
          maquinas={usoAbierto.ids ? uso.detalle.filter((m) => usoAbierto.ids?.includes(m.id)) : uso.detalle}
          sinMaquina={usoAbierto.ids ? [] : uso.sinMaquina}
          onCerrar={() => setUsoAbierto(null)} />
      ) : null}
    </div>
  );
}

/**
 * Un renglón del uso. La etiqueta dice qué hacer con él: casi lleno es donde
 * conviene sumar aliados; casi nada, donde sobran (o al aliado casi no le
 * llega trabajo). Con muy pocos días no se etiqueta (lo decide el API).
 */
function FilaDeUso({ f, vista, onAbrir }: { f: FilaUso; vista: 'tipo' | 'aliado'; onAbrir: () => void }) {
  const etiqueta: { texto: string; tono: Tone; ayuda: string } | null = f.senal === 'lleno'
    ? vista === 'tipo'
      ? { texto: 'Faltan máquinas', tono: 'warn', ayuda: 'Casi nunca hay una libre: conviene sumar aliados con este tipo.' }
      : { texto: 'Casi siempre ocupado', tono: 'info', ayuda: 'Sus máquinas casi siempre andan trabajando con MAQSER24.' }
    : f.senal === 'casiNada'
      ? vista === 'tipo'
        ? { texto: 'Casi no se usa', tono: 'muted', ayuda: 'Hay más de las que se piden: no hace falta sumar aliados con este tipo.' }
        : { texto: 'Casi no le llega trabajo', tono: 'muted', ayuda: 'Sus máquinas casi no salen con MAQSER24.' }
      : null;
  const maquinas = cuantas(f.unidades, 'máquina', 'máquinas');
  const sub = vista === 'tipo'
    ? `${maquinas} de ${cuantas(f.aliados, 'aliado', 'aliados')} · ${f.ocupados} de ${f.posibles} días`
    : `${maquinas} · ${f.ocupados} de ${f.posibles} días`;
  return (
    <button type="button" className="ng-uso" style={{ '--ng-c': COLOR[f.semaforo] } as CSSProperties} onClick={onAbrir} title="Ver qué máquinas y servicios lo forman">
      <span className="ng-uso-t">
        <span className="ng-uso-n">{f.nombre}{etiqueta ? <Chip tone={etiqueta.tono} title={etiqueta.ayuda}>{etiqueta.texto}</Chip> : null}</span>
        <span className="ng-sub">{sub}</span>
      </span>
      <span className="ng-uso-barra" aria-hidden><span style={{ width: `${f.pct ?? 0}%` }} /></span>
      <span className="ng-uso-num">{f.pct !== null ? `${f.pct}%` : '—'}</span>
    </button>
  );
}

/** La regla, en corto y sin letra chiquita: también lo que NO se ve. */
function ComoSeCalcula({ sinMaquina }: { sinMaquina: Array<{ id: number; folio: string }> }) {
  return (
    <details className="ng-como">
      <summary>¿Cómo se calcula?</summary>
      <p>
        Por cada máquina de los aliados contamos sus días hábiles desde que se dio de alta (lunes a sábado, o los de su horario)
        y, de esos, cuántos anduvo en camino o trabajando en un servicio de MAQSER24: desde que sale a la obra hasta que se termina.
        El uso es días trabajados entre días hábiles.
      </p>
      <p>
        Cada máquina cuenta aparte: si un aliado tiene 2 retros y sale una, ese día va a la mitad. Apartarla para una fecha no
        cuenta hasta que sale. Los días en mantenimiento, o que se marcó a mano como no disponible, no cuentan: no se podía rentar.
      </p>
      <p>
        <b style={{ color: 'var(--adm-text)' }}>Ojo:</b> solo vemos lo que pasa por MAQSER24. Si el aliado la renta por su cuenta, aquí se ve libre.
      </p>
      {sinMaquina.length ? (
        <p>
          {sinMaquina.length === 1 ? 'Un servicio de este periodo no dice' : `${sinMaquina.length} servicios de este periodo no dicen`} qué
          máquina llevó (el aliado tiene varias de esa línea y la solicitud no trae el tipo), y no cuenta{sinMaquina.length === 1 ? '' : 'n'}:{' '}
          {sinMaquina.map((s, i) => (
            <span key={s.id}>{i ? ', ' : ''}<a className="adm-link adm-mono" href={`/cotizaciones?ver=${s.id}`}>{s.folio}</a></span>
          ))}.
        </p>
      ) : null}
    </details>
  );
}

/** Lo que forma un número del uso: cada máquina, cuántos días trabajó de los que podía y con qué servicios. */
function UsoDetalle({ titulo, maquinas, sinMaquina, onCerrar }: {
  titulo: string; maquinas: MaquinaUso[]; sinMaquina: Array<{ id: number; folio: string }>; onCerrar: () => void;
}) {
  return (
    <Modal abierto titulo={titulo} subtitulo="Cuántos días trabajó cada máquina con MAQSER24, de los que podía. Toca un folio para abrirlo." onCerrar={onCerrar} ancho={680}>
      {maquinas.length === 0 ? (
        <EmptyState icon="ph-truck" title="No hay máquinas de aliados en este periodo" />
      ) : (
        <div style={{ display: 'grid' }}>
          {maquinas.map((m) => (
            <div key={m.id} style={{ display: 'grid', gap: 6, padding: '12px 0', borderTop: '1px solid var(--adm-border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="adm-cell-title">{m.nombre}</div>
                  <div className="adm-cell-sub">{[m.aliado, m.tipo, m.unidades > 1 ? `${m.unidades} unidades` : null].filter(Boolean).join(' · ')}</div>
                </div>
                <span className="adm-num" style={{ fontSize: 17, fontWeight: 700, color: COLOR[m.semaforo] }}>{m.pct !== null ? `${m.pct}%` : '—'}</span>
              </div>
              <Bar pct={m.pct ?? 0} tone={TONO[m.semaforo]} label={`Trabajó ${m.ocupados} de ${m.posibles} días`} />
              <div className="adm-cell-sub" style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px' }}>
                <span>
                  {m.posibles === 0
                    ? 'Sin días hábiles disponibles en este periodo (mantenimiento o recién dada de alta).'
                    : `Trabajó ${m.ocupados} de ${m.posibles} días${m.servicios.length ? ':' : '.'}`}
                </span>
                {m.servicios.map((s) => (
                  <span key={s.id} style={{ whiteSpace: 'nowrap' }}>
                    <a className="adm-link adm-mono" href={`/cotizaciones?ver=${s.id}`}>{s.folio}</a> · {cuantas(s.dias, 'día', 'días')}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {sinMaquina.length ? (
        <Note tone="warn" style={{ marginTop: 12 }}>
          {sinMaquina.length === 1 ? 'Un servicio no dice' : `${sinMaquina.length} servicios no dicen`} qué máquina llevó y no
          cuenta{sinMaquina.length === 1 ? '' : 'n'}:{' '}
          {sinMaquina.map((s, i) => (
            <span key={s.id}>{i ? ', ' : ''}<a className="adm-link adm-mono" href={`/cotizaciones?ver=${s.id}`}>{s.folio}</a></span>
          ))}.
        </Note>
      ) : null}
    </Modal>
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
