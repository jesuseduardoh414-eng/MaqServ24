'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Modal } from '@/components/Modal';
import { Btn, Chip, EmptyState, PageHeader, Panel, SearchBox, Segmented, Stat, Stats, StatusText, Toolbar, type Tone } from '@/components/ui';
import { AvisoDiseno, accionDeDiseno as diseno } from '@/components/Diseno';
import {
  HOY, IVA, PAGOS, cobroDe, conIva, diasEntre, dinero, fechaCorta, servicioDe, type EstadoPago, type Pago,
} from '../datos-ejemplo';

const MOTIVO = 'Se conecta cuando se defina cómo gana dinero MAQSER24 (quién factura, márgenes por línea y plazos de cobro y pago).';
const accionDeDiseno = (nombre: string) => diseno(nombre, MOTIVO);

/**
 * PAGOS A ALIADOS — diseño (2026-10-09).
 *
 * Lo que MAQSER24 le debe a cada aliado por los servicios que hizo: su costo
 * acordado al asignarlo por la cantidad que se cerró, su factura y cuándo se
 * le paga. Montos CON IVA. Datos de ejemplo: ver datos-ejemplo.ts.
 */

type Filtro = 'todos' | 'por-pagar' | 'programados' | 'pagados';

const ESTADO: Record<EstadoPago, { texto: string; tono: Tone }> = {
  'falta-factura': { texto: 'Falta su factura', tono: 'warn' },
  'esperando-cobro': { texto: 'Espera al cliente', tono: 'muted' },
  programado: { texto: 'Programado', tono: 'accent' },
  pagado: { texto: 'Pagado', tono: 'ok' },
};

const GRID = 'minmax(0,1.1fr) minmax(0,1.2fr) 108px minmax(0,1.15fr)';

interface Fila extends Pago { total: number; resta: number }

export function Pagos() {
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [q, setQ] = useState('');
  const [viendo, setViendo] = useState<Fila | null>(null);

  const filas: Fila[] = useMemo(() => PAGOS.map((p) => {
    const total = conIva(servicioDe(p.folio).costoAliado);
    return { ...p, total, resta: Math.max(0, total - p.pagado) };
  }), []);

  const pendientes = filas.filter((f) => f.estado !== 'pagado');
  const proximos = filas.filter((f) => f.estado === 'programado' && f.fecha && diasEntre(HOY, f.fecha) <= 15);
  const pagadoMes = filas.filter((f) => f.estado === 'pagado' && f.fecha?.startsWith(HOY.slice(0, 7))).reduce((a, f) => a + f.pagado, 0);
  const esperan = filas.filter((f) => f.estado === 'esperando-cobro');

  const visibles = filas.filter((f) => {
    const ok = filtro === 'todos' ? true
      : filtro === 'por-pagar' ? f.estado === 'falta-factura' || f.estado === 'esperando-cobro'
        : filtro === 'programados' ? f.estado === 'programado'
          : f.estado === 'pagado';
    if (!ok) return false;
    const s = servicioDe(f.folio);
    const t = q.trim().toLowerCase();
    return !t || [f.folio, s.aliado, s.cliente, f.facturaAliado ?? ''].some((x) => x.toLowerCase().includes(t));
  });

  // Por aliado: lo que se le debe y lo que ya se le pagó este mes.
  const porAliado = useMemo(() => {
    const m = new Map<string, { servicios: number; debe: number; pagadoMes: number; proximo: string | null }>();
    for (const f of filas) {
      const a = servicioDe(f.folio).aliado;
      const r = m.get(a) ?? { servicios: 0, debe: 0, pagadoMes: 0, proximo: null };
      r.servicios += 1;
      r.debe += f.resta;
      if (f.estado === 'pagado' && f.fecha?.startsWith(HOY.slice(0, 7))) r.pagadoMes += f.pagado;
      if (f.estado === 'programado' && f.fecha && (!r.proximo || f.fecha < r.proximo)) r.proximo = f.fecha;
      m.set(a, r);
    }
    return [...m.entries()].sort((a, b) => b[1].debe - a[1].debe);
  }, [filas]);

  return (
    <div>
      <style>{`
        .pg-row { display: grid; grid-template-columns: ${GRID}; gap: 16px; align-items: center; }
        .pg-row.adm-trow { cursor: pointer; }
        .pg-num { text-align: right; font-variant-numeric: tabular-nums; }
        .pg-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 340px); gap: 20px; align-items: start; }
        .pg-al { padding: 12px 20px; border-bottom: 1px solid var(--adm-border); }
        .pg-al:last-child { border-bottom: 0; }
        @media (max-width: 1280px) { .pg-grid { grid-template-columns: minmax(0, 1fr); } }
        @media (max-width: 1000px) {
          .pg-thead { display: none !important; }
          .pg-row { display: flex; flex-wrap: wrap; gap: 6px 16px; }
          .pg-row > :nth-child(1), .pg-row > :nth-child(2) { flex: 1 1 100%; }
          .pg-num { text-align: left; }
        }
      `}</style>

      <PageHeader
        eyebrow={['4 · Cobrar y medir', 'Administración']}
        title="Pagos a aliados"
        subtitle="Lo que MAQSER24 le debe a cada aliado por los servicios que hizo: su costo acordado, su factura y cuándo se le paga. Montos con IVA."
        actions={
          <>
            <Btn icon="ph-download-simple" onClick={() => accionDeDiseno('Exportar a Excel')}>Exportar</Btn>
            <Btn variant="primary" icon="ph-plus" onClick={() => accionDeDiseno('Registrar pago')}>Registrar pago</Btn>
          </>
        }
      />

      <AvisoDiseno falta="Para construirla falta decidir cómo gana dinero MAQSER24." />

      <Stats>
        <Stat label="Por pagar" icon="ph-hand-coins" tone="accent" value={dinero(pendientes.reduce((a, f) => a + f.resta, 0))} hint={`a ${new Set(pendientes.map((f) => servicioDe(f.folio).aliado)).size} aliados`} />
        <Stat label="Programado" icon="ph-calendar-check" tone="info" value={dinero(proximos.reduce((a, f) => a + f.resta, 0))} hint="próximos 15 días" />
        <Stat label="Esperan al cliente" icon="ph-hourglass-medium" tone="muted" value={dinero(esperan.reduce((a, f) => a + f.resta, 0))} hint={`${esperan.length} servicios: se pagan al cobrar`} />
        <Stat label="Pagado este mes" icon="ph-check-circle" tone="ok" value={dinero(pagadoMes)} hint="octubre" />
      </Stats>

      <Toolbar end={`${visibles.length} de ${filas.length}`}>
        <SearchBox value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar aliado, folio o factura…" aria-label="Buscar pago" />
        <Segmented<Filtro>
          value={filtro}
          onChange={setFiltro}
          ariaLabel="Filtrar por estado"
          items={[
            { key: 'todos', label: 'Todos', count: filas.length },
            { key: 'por-pagar', label: 'Por pagar', count: filas.filter((f) => f.estado === 'falta-factura' || f.estado === 'esperando-cobro').length },
            { key: 'programados', label: 'Programados', count: filas.filter((f) => f.estado === 'programado').length },
            { key: 'pagados', label: 'Pagados', count: filas.filter((f) => f.estado === 'pagado').length },
          ]}
        />
      </Toolbar>

      <div className="pg-grid">
        <Panel flush clip>
          <div className="adm-thead pg-row pg-thead">
            <div>Servicio</div><div>Aliado</div><div className="pg-num">Monto</div><div>Estado</div>
          </div>
          {visibles.length === 0 ? (
            <EmptyState icon="ph-hand-coins" title="Nada por aquí" sub="Prueba con otro filtro o búsqueda." />
          ) : visibles.map((f) => {
            const s = servicioDe(f.folio);
            const e = ESTADO[f.estado];
            return (
              <div
                key={f.folio}
                className="adm-trow pg-row"
                role="button"
                tabIndex={0}
                onClick={() => setViendo(f)}
                onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setViendo(f); } }}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="adm-mono" style={{ fontSize: 13, fontWeight: 600 }}>{f.folio}</div>
                  <div className="adm-cell-sub adm-ellipsis">{s.detalle}</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="adm-cell-title adm-ellipsis">{s.aliado}</div>
                  <div className="adm-cell-sub adm-ellipsis">{f.facturaAliado ? `Factura ${f.facturaAliado}` : 'Aún no manda su factura'}</div>
                </div>
                <div className="pg-num" style={{ fontSize: 13.5, fontWeight: 600 }}>
                  {dinero(f.total)}
                  {f.pagado > 0 && f.resta > 0 ? <div className="adm-cell-sub">resta {dinero(f.resta)}</div> : null}
                </div>
                {/* Estado y, debajo, cuándo se paga: una columna menos y nada se corta. */}
                <div style={{ minWidth: 0 }}>
                  <StatusText tone={e.tono}>{e.texto}</StatusText>
                  <div className="adm-cell-sub adm-ellipsis">
                    {f.estado === 'pagado' && f.fecha ? `El ${fechaCorta(f.fecha)}${f.comprobante ? ` · ${f.comprobante}` : ''}`
                      : f.estado === 'programado' && f.fecha ? `Para el ${fechaCorta(f.fecha)}`
                        : f.estado === 'esperando-cobro' ? `${f.condicion} · el cliente ${cobroDe(f.folio).estado === 'vencida' ? 'está vencido' : 'aún no paga'}`
                          : `${f.condicion} · sin fecha hasta tener su factura`}
                  </div>
                </div>
              </div>
            );
          })}
        </Panel>

        <Panel title="Por aliado" icon="ph-handshake" flush clip>
          {porAliado.map(([aliado, r]) => (
            <div key={aliado} className="pg-al">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                <span className="adm-cell-title adm-ellipsis" style={{ minWidth: 0 }}>{aliado}</span>
                <span className="adm-num" style={{ fontWeight: 600, fontSize: 14, color: r.debe > 0 ? 'var(--adm-text)' : 'var(--adm-faint)' }}>{r.debe > 0 ? dinero(r.debe) : 'Al día'}</span>
              </div>
              <div className="adm-meta">
                <span>{r.servicios} {r.servicios === 1 ? 'servicio' : 'servicios'}</span>
                {r.pagadoMes > 0 ? <span>pagado en oct: {dinero(r.pagadoMes)}</span> : null}
                {r.proximo ? <span>próximo pago: {fechaCorta(r.proximo)}</span> : null}
              </div>
            </div>
          ))}
        </Panel>
      </div>

      {viendo ? <DetallePago f={viendo} onCerrar={() => setViendo(null)} /> : null}
    </div>
  );
}

function DetallePago({ f, onCerrar }: { f: Fila; onCerrar: () => void }) {
  const s = servicioDe(f.folio);
  const cobro = cobroDe(f.folio);
  const e = ESTADO[f.estado];
  const fila = (t: string, v: ReactNode, fuerte?: boolean) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '7px 0', borderTop: '1px solid var(--adm-border)', fontSize: 13.5 }}>
      <span style={{ color: 'var(--adm-muted)' }}>{t}</span>
      <span className="adm-num" style={fuerte ? { fontWeight: 600, color: 'var(--adm-text)' } : { color: 'var(--adm-text-2)', textAlign: 'right' }}>{v}</span>
    </div>
  );
  const COBRO_TEXTO = { 'sin-factura': 'Falta facturarle', 'por-cobrar': 'Por cobrar', vencida: 'Vencida', cobrada: 'Cobrada' } as const;
  return (
    <Modal
      abierto
      titulo={`${f.folio} · ${s.aliado}`}
      subtitulo={s.detalle}
      onCerrar={onCerrar}
      ancho={680}
      pie={
        <>
          {!f.facturaAliado ? <Btn icon="ph-upload-simple" onClick={() => accionDeDiseno('Subir factura del aliado')}>Subir su factura</Btn> : null}
          {f.estado !== 'pagado' ? <Btn icon="ph-calendar-plus" onClick={() => accionDeDiseno('Programar pago')}>Programar</Btn> : null}
          {f.resta > 0 ? <Btn variant="primary" icon="ph-check" onClick={() => accionDeDiseno('Registrar pago al aliado')}>Registrar pago</Btn> : null}
        </>
      }
    >
      <div style={{ display: 'grid', gap: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <StatusText tone={e.tono}>{e.texto}</StatusText>
          {f.facturaAliado ? <Chip>Su factura {f.facturaAliado}</Chip> : <Chip tone="warn">Sin factura</Chip>}
          <Chip>{s.linea}</Chip>
        </div>

        <section>
          <h3 style={H3}>Servicio</h3>
          {fila('Cliente', `${s.cliente} · ${s.obra}`)}
          {fila('Cerrado el', fechaCorta(s.cerrado))}
          {fila('Cuándo se paga', f.condicion)}
          {fila('Cobro al cliente', `${COBRO_TEXTO[cobro.estado]}${cobro.factura ? ` (factura ${cobro.factura})` : ''}`)}
        </section>

        <section>
          <h3 style={H3}>Lo que se le debe</h3>
          {fila('Costo acordado', dinero(s.costoAliado))}
          {fila(`IVA ${Math.round(IVA * 100)}%`, dinero(f.total - s.costoAliado))}
          {fila('Total', dinero(f.total), true)}
          {fila('Pagado', f.pagado > 0 ? `${dinero(f.pagado)}${f.comprobante ? ` · ${f.comprobante}` : ''}` : '—')}
          {fila('Resta', f.resta === 0 ? 'Liquidado' : dinero(f.resta), true)}
        </section>

        {f.condicion.includes('cobrar') && cobro.estado !== 'cobrada' ? (
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--adm-text-2)' }}>
            Este pago espera a que el cliente pague: con él se acordó pagarle al cobrar. Si el cobro se atrasa, conviene avisarle al aliado.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

const H3 = { margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: 'var(--adm-text)' } as const;
