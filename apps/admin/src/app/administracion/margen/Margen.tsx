'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, Btn, Chip, PageHeader, Panel, Segmented, Stat, Stats, StatusText, type Tone } from '@/components/ui';
import { AvisoDiseno, accionDeDiseno as diseno } from '@/components/Diseno';
import {
  DIFERENCIAS, HISTORIAL_MESES, HOY, SERVICIOS, cobroDe, dinero, fechaCorta, mesCorto, mesLargo, mesTitulo, pagoDe, pct,
  type EstadoConciliacion, type Linea,
} from '../datos-ejemplo';

const MOTIVO = 'Se conecta cuando se defina cómo gana dinero MAQSER24 (quién factura, márgenes por línea y plazos de cobro y pago).';
const accionDeDiseno = (nombre: string) => diseno(nombre, MOTIVO);

/**
 * MARGEN Y CONCILIACIÓN — diseño (2026-10-09).
 *
 * Cuánto gana MAQSER24: lo cobrado al cliente menos lo pagado al aliado, SIN
 * IVA (el IVA no es ingreso). Por mes, por línea y por servicio, y si cada
 * servicio cuadra (cobrado, pagado y con las dos facturas). Es la pantalla que
 * alimentará el indicador "Margen / contribución". Datos de ejemplo.
 */

type Mes = '2026-10' | '2026-09';

const CONCILIACION: Record<EstadoConciliacion, { texto: string; tono: Tone }> = {
  cuadra: { texto: 'Cuadra', tono: 'ok' },
  'falta-cobrar': { texto: 'Falta cobrar', tono: 'info' },
  'falta-pagar': { texto: 'Falta pagar', tono: 'info' },
  'falta-factura': { texto: 'Falta factura del aliado', tono: 'warn' },
  diferencia: { texto: 'Diferencia', tono: 'bad' },
};

function conciliacionDe(folio: string): EstadoConciliacion {
  if (DIFERENCIAS[folio]) return 'diferencia';
  if (!pagoDe(folio).facturaAliado) return 'falta-factura';
  if (cobroDe(folio).estado !== 'cobrada') return 'falta-cobrar';
  if (pagoDe(folio).estado !== 'pagado') return 'falta-pagar';
  return 'cuadra';
}

const GRID_LINEA = 'minmax(0,1.6fr) 80px 118px 118px 110px minmax(0,1fr)';
const GRID_SERV = 'minmax(0,1.3fr) minmax(0,1.1fr) 104px 104px 96px minmax(0,1.1fr)';

export function Margen() {
  const [mes, setMes] = useState<Mes>(HOY.slice(0, 7) as Mes);
  const [vista, setVista] = useState<'grafica' | 'tabla'>('grafica');

  const delMes = SERVICIOS.filter((s) => s.cerrado.startsWith(mes));
  const cobrado = delMes.reduce((a, s) => a + s.precioCliente, 0);
  const pagado = delMes.reduce((a, s) => a + s.costoAliado, 0);
  const margen = cobrado - pagado;
  const cuadran = delMes.filter((s) => conciliacionDe(s.folio) === 'cuadra').length;

  // Seis meses: los cuatro del historial + los dos que salen de los servicios.
  const meses = useMemo(() => {
    const calc = (m: string) => {
      const ss = SERVICIOS.filter((s) => s.cerrado.startsWith(m));
      return { mes: m, cobrado: ss.reduce((a, s) => a + s.precioCliente, 0), pagado: ss.reduce((a, s) => a + s.costoAliado, 0) };
    };
    return [...HISTORIAL_MESES, calc('2026-09'), calc('2026-10')].map((x) => ({
      ...x, margen: x.cobrado - x.pagado, pct: ((x.cobrado - x.pagado) / x.cobrado) * 100, enCurso: x.mes === HOY.slice(0, 7),
    }));
  }, []);

  const porLinea = useMemo(() => {
    const m = new Map<Linea, { servicios: number; cobrado: number; pagado: number }>();
    for (const s of delMes) {
      const r = m.get(s.linea) ?? { servicios: 0, cobrado: 0, pagado: 0 };
      r.servicios += 1; r.cobrado += s.precioCliente; r.pagado += s.costoAliado;
      m.set(s.linea, r);
    }
    return [...m.entries()].map(([linea, r]) => ({ linea, ...r, margen: r.cobrado - r.pagado, pct: ((r.cobrado - r.pagado) / r.cobrado) * 100 }))
      .sort((a, b) => b.margen - a.margen);
  }, [delMes]);

  return (
    <div>
      <style>{`
        .mg-linea { display: grid; grid-template-columns: ${GRID_LINEA}; gap: 16px; align-items: center; }
        .mg-serv { display: grid; grid-template-columns: ${GRID_SERV}; gap: 16px; align-items: center; }
        .mg-num { text-align: right; font-variant-numeric: tabular-nums; }
        .mg-tabla { width: 100%; border-collapse: collapse; }
        @media (max-width: 1000px) {
          .mg-thead { display: none !important; }
          .mg-linea, .mg-serv { display: flex; flex-wrap: wrap; gap: 6px 16px; }
          .mg-linea > :first-child, .mg-serv > :first-child { flex: 1 1 100%; }
          .mg-num { text-align: left; }
        }
      `}</style>

      <PageHeader
        eyebrow={['4 · Cobrar y medir', 'Administración']}
        title="Margen y conciliación"
        subtitle="Cuánto gana MAQSER24: lo cobrado al cliente menos lo pagado al aliado, sin IVA. Por mes, por línea y por servicio, y si cada servicio cuadra."
        actions={<Btn icon="ph-download-simple" onClick={() => accionDeDiseno('Exportar a Excel')}>Exportar</Btn>}
      />

      <AvisoDiseno falta="Para construirla falta decidir cómo gana dinero MAQSER24." />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
        <Segmented<Mes>
          value={mes}
          onChange={setMes}
          ariaLabel="Mes"
          items={[
            { key: '2026-10', label: 'Octubre · en curso' },
            { key: '2026-09', label: 'Septiembre' },
          ]}
        />
        <span style={{ fontSize: 13, color: 'var(--adm-muted)' }}>Servicios cerrados en {mesLargo(mes)}</span>
      </div>

      <Stats>
        <Stat label="Cobrado a clientes" icon="ph-arrow-down-left" tone="info" value={dinero(cobrado)} hint={`${delMes.length} servicios`} />
        <Stat label="Pagado a aliados" icon="ph-arrow-up-right" tone="muted" value={dinero(pagado)} />
        <Stat label="Margen" icon="ph-trend-up" tone="ok" value={dinero(margen)} hint={`${pct((margen / Math.max(1, cobrado)) * 100)} de lo cobrado`} />
        <Stat label="Conciliados" icon="ph-scales" tone={cuadran === delMes.length ? 'ok' : 'warn'} value={`${cuadran} de ${delMes.length}`} hint="cobrados, pagados y con facturas" />
      </Stats>

      <div style={{ display: 'grid', gap: 20 }}>
        <Panel
          title="Margen por mes"
          icon="ph-chart-bar"
          desc="Lo que quedó después de pagar a los aliados, sin IVA. Octubre va en curso."
          action={
            <Segmented<'grafica' | 'tabla'>
              value={vista}
              onChange={setVista}
              ariaLabel="Ver como"
              items={[{ key: 'grafica', label: 'Gráfica' }, { key: 'tabla', label: 'Tabla' }]}
            />
          }
        >
          {vista === 'grafica' ? <GraficaMargen datos={meses} /> : (
            <table className="adm-tbl">
              <thead><tr><th>Mes</th><th style={{ textAlign: 'right' }}>Cobrado</th><th style={{ textAlign: 'right' }}>Pagado</th><th style={{ textAlign: 'right' }}>Margen</th><th style={{ textAlign: 'right' }}>% del cobrado</th></tr></thead>
              <tbody>
                {meses.map((m) => (
                  <tr key={m.mes}>
                    <td>{mesTitulo(m.mes)}{m.enCurso ? <span style={{ color: 'var(--adm-faint)' }}> · en curso</span> : null}</td>
                    <td className="mg-num">{dinero(m.cobrado)}</td>
                    <td className="mg-num">{dinero(m.pagado)}</td>
                    <td className="mg-num" style={{ fontWeight: 600 }}>{dinero(m.margen)}</td>
                    <td className="mg-num">{pct(m.pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Por línea" icon="ph-squares-four" desc={`${mesTitulo(mes)} · el margen objetivo de cada línea todavía no se define.`} action={<Chip tone="warn">Meta por definir</Chip>} flush clip>
          <div className="adm-thead mg-linea mg-thead">
            <div>Línea</div><div className="mg-num">Servicios</div><div className="mg-num">Cobrado</div><div className="mg-num">Pagado</div><div className="mg-num">Margen</div><div>% del cobrado</div>
          </div>
          {porLinea.map((l) => (
            <div key={l.linea} className="adm-trow mg-linea">
              <div className="adm-cell-title">{l.linea}</div>
              <div className="mg-num" style={{ fontSize: 13.5 }}>{l.servicios}</div>
              <div className="mg-num" style={{ fontSize: 13.5 }}>{dinero(l.cobrado)}</div>
              <div className="mg-num" style={{ fontSize: 13.5, color: 'var(--adm-text-2)' }}>{dinero(l.pagado)}</div>
              <div className="mg-num" style={{ fontSize: 13.5, fontWeight: 600 }}>{dinero(l.margen)}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="adm-num" style={{ fontSize: 13.5, minWidth: 44 }}>{pct(l.pct)}</span>
                {/* Escala fija de 0 a 20 %: las barras se comparan entre líneas y entre meses. */}
                <Bar pct={(l.pct / 20) * 100} width={90} label={`${pct(l.pct)} de margen`} />
              </div>
            </div>
          ))}
        </Panel>

        <Panel title="Conciliación por servicio" icon="ph-scales" desc="Un servicio cuadra cuando el cliente ya pagó, al aliado ya se le pagó y están las dos facturas." flush clip>
          <div className="adm-thead mg-serv mg-thead">
            <div>Servicio</div><div>Aliado</div><div className="mg-num">Cobrado</div><div className="mg-num">Pagado</div><div className="mg-num">Margen</div><div>Estado</div>
          </div>
          {delMes.map((s) => {
            const c = CONCILIACION[conciliacionDe(s.folio)];
            const m = s.precioCliente - s.costoAliado;
            return (
              <div key={s.folio} className="adm-trow mg-serv">
                <div style={{ minWidth: 0 }}>
                  <div className="adm-cell-title adm-ellipsis">{s.cliente}</div>
                  <div className="adm-cell-sub adm-ellipsis"><span className="adm-mono">{s.folio}</span> · {s.detalle}</div>
                </div>
                <div className="adm-ellipsis" style={{ fontSize: 13.5, color: 'var(--adm-text-2)' }}>{s.aliado}</div>
                <div className="mg-num" style={{ fontSize: 13.5 }}>{dinero(s.precioCliente)}</div>
                <div className="mg-num" style={{ fontSize: 13.5, color: 'var(--adm-text-2)' }}>{dinero(s.costoAliado)}</div>
                <div className="mg-num" style={{ fontSize: 13.5, fontWeight: 600 }}>
                  {dinero(m)}
                  <div className="adm-cell-sub">{pct((m / s.precioCliente) * 100)}</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <StatusText tone={c.tono}>{c.texto}</StatusText>
                  {DIFERENCIAS[s.folio] ? <div className="adm-cell-sub" style={{ whiteSpace: 'normal' }}>{DIFERENCIAS[s.folio]}</div>
                    : <div className="adm-cell-sub">Cerrado el {fechaCorta(s.cerrado)}</div>}
                </div>
              </div>
            );
          })}
        </Panel>
      </div>
    </div>
  );
}

/* ── Gráfica: margen por mes ─────────────────────────────────────────────
   Una sola serie (el título la nombra, sin leyenda), columnas de 24 px como
   máximo con la punta redondeada y la base recta, rejilla de líneas finas y
   un tooltip por columna con hover y con teclado. Etiqueta directa solo en el
   último mes; los demás valores están en el tooltip y en la vista de tabla. */

interface PuntoMes { mes: string; cobrado: number; pagado: number; margen: number; pct: number; enCurso: boolean }

function escalaBonita(max: number): { tope: number; paso: number } {
  const crudo = max / 3;
  const mag = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((p) => p >= crudo) ?? 10 * mag;
  return { tope: Math.ceil(max / paso) * paso, paso };
}

const kMiles = (n: number) => (n === 0 ? '$0' : `$${Math.round(n / 1000)}k`);

function GraficaMargen({ datos }: { datos: PuntoMes[] }) {
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(640);
  const [activo, setActivo] = useState<number | null>(null);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const alto = 220;
  const izq = 48, der = 8, arriba = 22, ejeX = 40;
  const plotW = ancho - izq - der;
  const plotH = alto - arriba - ejeX;
  const { tope, paso } = escalaBonita(Math.max(...datos.map((d) => d.margen)));
  const y = (v: number) => arriba + plotH - (v / tope) * plotH;
  const banda = plotW / datos.length;
  const barW = Math.min(24, banda * 0.45);
  const ticks: number[] = [];
  for (let v = 0; v <= tope + 1; v += paso) ticks.push(v);
  const ultimo = datos.length - 1;

  const columna = (x: number, top: number, w: number, base: number) => {
    const h = base - top;
    const r = Math.min(4, h, w / 2);
    return `M${x},${base} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + w - r},${top} Q${x + w},${top} ${x + w},${top + r} L${x + w},${base} Z`;
  };

  const d = activo !== null ? datos[activo] : null;
  const xTip = activo !== null ? izq + banda * activo + banda / 2 : 0;

  return (
    <div ref={caja} style={{ position: 'relative' }}>
      <svg
        width={ancho}
        height={alto}
        role="img"
        aria-label={`Margen por mes: ${datos.map((p) => `${mesLargo(p.mes)} ${dinero(p.margen)}`).join(', ')}. La vista de tabla tiene el detalle.`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={izq} x2={ancho - der} y1={y(t)} y2={y(t)} stroke="var(--adm-border)" strokeWidth={1} />
            <text x={izq - 10} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--adm-faint)" style={{ fontVariantNumeric: 'tabular-nums' }}>{kMiles(t)}</text>
          </g>
        ))}
        {datos.map((p, i) => {
          const x = izq + banda * i + (banda - barW) / 2;
          const on = activo === i;
          return (
            <g
              key={p.mes}
              tabIndex={0}
              role="button"
              aria-label={`${mesLargo(p.mes)}: ${dinero(p.margen)} de margen, ${pct(p.pct)} de ${dinero(p.cobrado)} cobrado`}
              onMouseEnter={() => setActivo(i)}
              onMouseLeave={() => setActivo(null)}
              onFocus={() => setActivo(i)}
              onBlur={() => setActivo(null)}
              style={{ cursor: 'default', outline: 'none' }}
            >
              {/* Zona de hover: toda la banda, no solo la columna. */}
              <rect x={izq + banda * i} y={arriba} width={banda} height={plotH} fill={on ? 'rgba(255,255,255,0.035)' : 'transparent'} />
              <path d={columna(x, y(p.margen), barW, y(0))} fill="var(--adm-accent)" opacity={p.enCurso ? 0.55 : 1} />
              <text x={izq + banda * i + banda / 2} y={alto - ejeX + 18} textAnchor="middle" fontSize={12} fill={on ? 'var(--adm-text)' : 'var(--adm-muted)'} style={{ textTransform: 'capitalize' }}>
                {mesCorto(p.mes)}
              </text>
              {p.enCurso ? (
                <text x={izq + banda * i + banda / 2} y={alto - ejeX + 32} textAnchor="middle" fontSize={11} fill="var(--adm-faint)">en curso</text>
              ) : null}
              {i === ultimo ? (
                <text x={x + barW / 2} y={y(p.margen) - 8} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--adm-text)">{dinero(p.margen)}</text>
              ) : null}
            </g>
          );
        })}
        <line x1={izq} x2={ancho - der} y1={y(0)} y2={y(0)} stroke="var(--adm-border-strong)" strokeWidth={1} />
      </svg>

      {d ? (
        <div
          role="tooltip"
          style={{
            position: 'absolute', left: Math.min(Math.max(xTip, 110), ancho - 110), top: Math.max(0, y(d.margen) - 96), transform: 'translateX(-50%)',
            pointerEvents: 'none', minWidth: 190, padding: '10px 12px', borderRadius: 8, background: 'var(--adm-raised)',
            border: '1px solid var(--adm-border-strong)', boxShadow: '0 14px 30px -14px rgba(0,0,0,.8)', fontSize: 12.5, lineHeight: 1.5,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--adm-text)' }}>{dinero(d.margen)} <span style={{ fontSize: 12.5, fontWeight: 400, color: 'var(--adm-muted)' }}>de margen</span></div>
          <div style={{ color: 'var(--adm-text-2)' }}>{pct(d.pct)} de {dinero(d.cobrado)} cobrado</div>
          <div style={{ color: 'var(--adm-text-2)' }}>Pagado a aliados: {dinero(d.pagado)}</div>
          <div style={{ color: 'var(--adm-faint)', marginTop: 2 }}>{mesTitulo(d.mes)}{d.enCurso ? ' · en curso' : ''}</div>
        </div>
      ) : null}
    </div>
  );
}
