'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Modal } from '@/components/Modal';
import { Btn, Chip, EmptyState, PageHeader, Panel, SearchBox, Segmented, Stat, Stats, StatusText, Toolbar, type Tone } from '@/components/ui';
import { AvisoDiseno, accionDeDiseno as diseno } from '@/components/Diseno';
import {
  COBROS, HOY, IVA, cobradoDe, conIva, diasEntre, dinero, fechaCorta, servicioDe, type Cobro, type EstadoCobro,
} from '../datos-ejemplo';

const MOTIVO = 'Se conecta cuando se defina cómo gana dinero MAQSER24 (quién factura, márgenes por línea y plazos de cobro y pago).';
const accionDeDiseno = (nombre: string) => diseno(nombre, MOTIVO);

/**
 * COBRANZA A CLIENTES — diseño (2026-10-09).
 *
 * Lo que cada cliente debe por sus servicios cerrados: factura, anticipo,
 * vencimiento y lo que ya pagó. Montos CON IVA, porque es el dinero que se
 * mueve. Datos de ejemplo: ver datos-ejemplo.ts.
 */

type Filtro = 'todas' | 'por-cobrar' | 'vencidas' | 'cobradas';

const ESTADO: Record<EstadoCobro, { texto: string; tono: Tone }> = {
  'sin-factura': { texto: 'Falta factura', tono: 'warn' },
  'por-cobrar': { texto: 'Por cobrar', tono: 'info' },
  vencida: { texto: 'Vencida', tono: 'bad' },
  cobrada: { texto: 'Cobrada', tono: 'ok' },
};

const GRID = 'minmax(0,1.25fr) minmax(0,1.45fr) 118px 118px 128px 120px';

interface Fila extends Cobro { total: number; cobrado: number; saldo: number }

export function Cobranza() {
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [q, setQ] = useState('');
  const [viendo, setViendo] = useState<Fila | null>(null);

  const filas: Fila[] = useMemo(() => COBROS.map((c) => {
    const total = conIva(servicioDe(c.folio).precioCliente);
    const cobrado = cobradoDe(c);
    return { ...c, total, cobrado, saldo: Math.max(0, total - cobrado) };
  }), []);

  const abiertas = filas.filter((f) => f.estado !== 'cobrada');
  const vencidas = filas.filter((f) => f.estado === 'vencida');
  const cobradoMes = filas.flatMap((f) => f.movimientos).filter((m) => m.fecha.startsWith(HOY.slice(0, 7))).reduce((a, m) => a + m.monto, 0);
  const cobradas = filas.filter((f) => f.estado === 'cobrada');
  const diasCobro = Math.round(
    cobradas.reduce((a, f) => a + diasEntre(servicioDe(f.folio).cerrado, f.movimientos[f.movimientos.length - 1].fecha), 0) / Math.max(1, cobradas.length),
  );

  const enFiltro = (f: Fila) =>
    filtro === 'todas' ? true
      : filtro === 'por-cobrar' ? f.estado === 'por-cobrar' || f.estado === 'sin-factura'
        : filtro === 'vencidas' ? f.estado === 'vencida'
          : f.estado === 'cobrada';
  const visibles = filas.filter((f) => {
    if (!enFiltro(f)) return false;
    const s = servicioDe(f.folio);
    const t = q.trim().toLowerCase();
    return !t || [f.folio, s.cliente, s.obra, s.municipio, f.factura ?? ''].some((x) => x.toLowerCase().includes(t));
  });

  return (
    <div>
      <style>{`
        .cb-row { display: grid; grid-template-columns: ${GRID}; gap: 16px; align-items: center; }
        .cb-row.adm-trow { cursor: pointer; }
        .cb-num { text-align: right; font-variant-numeric: tabular-nums; }
        @media (max-width: 1000px) {
          .cb-thead { display: none !important; }
          .cb-row { display: flex; flex-wrap: wrap; gap: 6px 16px; }
          .cb-row > :nth-child(1), .cb-row > :nth-child(2) { flex: 1 1 100%; }
          .cb-num { text-align: left; }
        }
      `}</style>

      <PageHeader
        eyebrow={['4 · Cobrar y medir', 'Administración']}
        title="Cobranza a clientes"
        subtitle="Lo que cada cliente debe por sus servicios cerrados: factura, anticipo, vencimiento y lo que ya pagó. Montos con IVA."
        actions={
          <>
            <Btn icon="ph-download-simple" onClick={() => accionDeDiseno('Exportar a Excel')}>Exportar</Btn>
            <Btn variant="primary" icon="ph-plus" onClick={() => accionDeDiseno('Registrar cobro')}>Registrar cobro</Btn>
          </>
        }
      />

      <AvisoDiseno falta="Para construirla falta decidir cómo gana dinero MAQSER24." />

      <Stats>
        <Stat label="Por cobrar" icon="ph-hourglass-medium" tone="info" value={dinero(abiertas.reduce((a, f) => a + f.saldo, 0))} hint={`en ${abiertas.length} servicios`} />
        <Stat label="Vencido" icon="ph-warning-circle" tone="bad" value={dinero(vencidas.reduce((a, f) => a + f.saldo, 0))} valueTone="bad" hint={`${vencidas.length} clientes con atraso`} />
        <Stat label="Cobrado este mes" icon="ph-check-circle" tone="ok" value={dinero(cobradoMes)} hint="octubre" />
        <Stat label="Tiempo de cobro" icon="ph-clock" tone="muted" value={`${diasCobro} días`} hint="del cierre al pago, en promedio" />
      </Stats>

      <Toolbar end={`${visibles.length} de ${filas.length}`}>
        <SearchBox value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente, folio, obra o factura…" aria-label="Buscar cobro" />
        <Segmented<Filtro>
          value={filtro}
          onChange={setFiltro}
          ariaLabel="Filtrar por estado"
          items={[
            { key: 'todas', label: 'Todas', count: filas.length },
            { key: 'por-cobrar', label: 'Por cobrar', count: filas.filter((f) => f.estado === 'por-cobrar' || f.estado === 'sin-factura').length },
            { key: 'vencidas', label: 'Vencidas', count: vencidas.length },
            { key: 'cobradas', label: 'Cobradas', count: cobradas.length },
          ]}
        />
      </Toolbar>

      <Panel flush clip>
        <div className="adm-thead cb-row cb-thead">
          <div>Servicio</div><div>Cliente</div><div className="cb-num">Total</div><div className="cb-num">Saldo</div><div>Vence</div><div>Estado</div>
        </div>
        {visibles.length === 0 ? (
          <EmptyState icon="ph-receipt" title="Nada por aquí" sub="Prueba con otro filtro o búsqueda." />
        ) : visibles.map((f) => {
          const s = servicioDe(f.folio);
          const dias = diasEntre(HOY, f.vence);
          const e = ESTADO[f.estado];
          return (
            <div
              key={f.folio}
              className="adm-trow cb-row"
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
                <div className="adm-cell-title adm-ellipsis">{s.cliente}</div>
                <div className="adm-cell-sub adm-ellipsis">{s.obra} · {s.municipio}</div>
              </div>
              <div className="cb-num" style={{ fontSize: 13.5 }}>{dinero(f.total)}</div>
              <div className="cb-num" style={{ fontSize: 13.5, fontWeight: 600, color: f.saldo === 0 ? 'var(--adm-faint)' : f.estado === 'vencida' ? 'var(--adm-bad)' : 'var(--adm-text)' }}>
                {f.saldo === 0 ? '—' : dinero(f.saldo)}
              </div>
              <div style={{ fontSize: 13 }}>
                {f.estado === 'cobrada' ? (
                  <span style={{ color: 'var(--adm-faint)' }}>Pagó el {fechaCorta(f.movimientos[f.movimientos.length - 1].fecha)}</span>
                ) : (
                  <>
                    <div>{fechaCorta(f.vence)}</div>
                    <div className="adm-cell-sub" style={dias < 0 ? { color: 'var(--adm-bad)' } : undefined}>
                      {dias < 0 ? `hace ${-dias} ${-dias === 1 ? 'día' : 'días'}` : dias === 0 ? 'vence hoy' : `en ${dias} días`}
                    </div>
                  </>
                )}
              </div>
              <div><StatusText tone={e.tono}>{e.texto}</StatusText></div>
            </div>
          );
        })}
      </Panel>

      {viendo ? <DetalleCobro f={viendo} onCerrar={() => setViendo(null)} /> : null}
    </div>
  );
}

function DetalleCobro({ f, onCerrar }: { f: Fila; onCerrar: () => void }) {
  const s = servicioDe(f.folio);
  const subtotal = s.precioCliente;
  const e = ESTADO[f.estado];
  const fila = (t: string, v: ReactNode, fuerte?: boolean) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '7px 0', borderTop: '1px solid var(--adm-border)', fontSize: 13.5 }}>
      <span style={{ color: 'var(--adm-muted)' }}>{t}</span>
      <span className="adm-num" style={fuerte ? { fontWeight: 600, color: 'var(--adm-text)' } : { color: 'var(--adm-text-2)' }}>{v}</span>
    </div>
  );
  return (
    <Modal
      abierto
      titulo={`${f.folio} · ${s.cliente}`}
      subtitulo={s.detalle}
      onCerrar={onCerrar}
      ancho={680}
      pie={
        <>
          {f.estado !== 'cobrada' ? <Btn variant="ghost" icon="ph-paper-plane-tilt" onClick={() => accionDeDiseno('Enviar recordatorio de pago')}>Enviar recordatorio</Btn> : null}
          {f.factura ? <Btn icon="ph-file-pdf" onClick={() => accionDeDiseno(`Ver factura ${f.factura}`)}>Ver factura</Btn> : <Btn icon="ph-upload-simple" onClick={() => accionDeDiseno('Subir factura')}>Subir factura</Btn>}
          {f.saldo > 0 ? <Btn variant="primary" icon="ph-plus" onClick={() => accionDeDiseno('Registrar cobro')}>Registrar cobro</Btn> : null}
        </>
      }
    >
      <div style={{ display: 'grid', gap: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <StatusText tone={e.tono}>{e.texto}</StatusText>
          {f.factura ? <Chip>Factura {f.factura}</Chip> : <Chip tone="warn">Sin factura</Chip>}
          <Chip>{s.linea}</Chip>
        </div>

        <section>
          <h3 style={H3}>Servicio</h3>
          {fila('Obra', `${s.obra}, ${s.municipio}`)}
          {fila('Lo hizo', s.aliado)}
          {fila('Cerrado el', fechaCorta(s.cerrado))}
          {fila('Condiciones', f.condiciones)}
          {fila('Vence', fechaCorta(f.vence))}
        </section>

        <section>
          <h3 style={H3}>Montos</h3>
          {fila('Subtotal', dinero(subtotal))}
          {fila(`IVA ${Math.round(IVA * 100)}%`, dinero(f.total - subtotal))}
          {fila('Total', dinero(f.total), true)}
          {fila('Cobrado', dinero(f.cobrado))}
          {fila('Saldo', f.saldo === 0 ? 'Liquidado' : dinero(f.saldo), true)}
        </section>

        <section>
          <h3 style={H3}>Pagos recibidos</h3>
          {f.movimientos.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--adm-faint)' }}>Todavía no hay pagos registrados.</p>
          ) : f.movimientos.map((m) => (
            <div key={m.fecha + m.concepto} style={{ display: 'grid', gridTemplateColumns: '70px minmax(0,1fr) auto', gap: 12, alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--adm-border)', fontSize: 13.5 }}>
              <span style={{ color: 'var(--adm-muted)' }}>{fechaCorta(m.fecha)}</span>
              <span>{m.concepto} <span style={{ color: 'var(--adm-faint)' }}>· {m.forma}</span></span>
              <span className="adm-num" style={{ fontWeight: 600 }}>{dinero(m.monto)}</span>
            </div>
          ))}
        </section>
      </div>
    </Modal>
  );
}

const H3 = { margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: 'var(--adm-text)' } as const;
