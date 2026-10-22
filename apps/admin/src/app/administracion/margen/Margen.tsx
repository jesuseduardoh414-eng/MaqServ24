'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { mostrarResultado } from '@maqserv/ui';
import { Btn, EmptyState, FormField, Note, PageHeader, Panel, Stat, Stats } from '@/components/ui';
import { DIAS_SEMANA, dinero, enviar, mesCorto, mesTitulo, pct } from '../formato';

export interface ReglasDinero {
  comisionPct: number;
  comisionPorLinea: Record<string, number>;
  diaDePago: number;
  datosPago: { banco: string; clabe: string; beneficiario: string } | null;
}
export interface DatosMargen {
  mes: string;
  servicios: number;
  ventas: number;
  pagoAliados: number;
  margen: number;
  porLinea: Array<{ linea: string; nombre: string; servicios: number; ventas: number; margen: number }>;
  tendencia: Array<{ mes: string; ventas: number; margen: number }>;
  porCobrar: number;
  vencido: number;
  porPagar: number;
  reglas: ReglasDinero;
  lineas: Array<{ slug: string; nombre: string }>;
}

const otroMes = (ym: string, d: number) => {
  let [a, m] = ym.split('-').map(Number);
  m += d; if (m === 0) { m = 12; a -= 1; } if (m === 13) { m = 1; a += 1; }
  return `${a}-${String(m).padStart(2, '0')}`;
};

/**
 * MARGEN (2026-10-22, Fase A). Lo que ganó MAQSER24 con los servicios cerrados
 * del mes, sin IVA. No se captura nada: sale de cada servicio cerrado (lo
 * cotizado menos la parte del aliado). Las reglas van abajo, plegadas.
 */
export function Margen({ d }: { d: DatosMargen }) {
  const hoyMes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey' }).format(new Date()).slice(0, 7);
  const maxVentas = Math.max(1, ...d.tendencia.map((t) => t.ventas));
  const porcentaje = d.ventas > 0 ? (d.margen / d.ventas) * 100 : 0;

  return (
    <div>
      <PageHeader
        eyebrow={['4 · Cobrar y medir', 'Administración']}
        title="Margen"
        subtitle="Lo que gana MAQSER24 con los servicios cerrados en el mes, sin IVA. Se calcula solo."
        actions={
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <Btn variant="ghost" icon="ph-caret-left" href={`/administracion/margen?mes=${otroMes(d.mes, -1)}`}>{mesCorto(otroMes(d.mes, -1))}</Btn>
            <strong style={{ fontSize: 14 }}>{mesTitulo(d.mes)}</strong>
            {d.mes < hoyMes ? <Btn variant="ghost" href={`/administracion/margen?mes=${otroMes(d.mes, 1)}`}>{mesCorto(otroMes(d.mes, 1))} ›</Btn> : null}
          </span>
        }
      />

      <Stats>
        <Stat label="Margen" icon="ph-trend-up" tone="ok" value={dinero(d.margen)} hint={d.ventas > 0 ? `${pct(porcentaje)} de las ventas` : 'sin servicios cerrados'} />
        <Stat label="Ventas" icon="ph-receipt" tone="info" value={dinero(d.ventas)} hint={`${d.servicios} servicio${d.servicios === 1 ? '' : 's'} cerrado${d.servicios === 1 ? '' : 's'}`} />
        <Stat label="Pago a aliados" icon="ph-hand-coins" tone="muted" value={dinero(d.pagoAliados)} />
      </Stats>

      {/* En rejilla los paneles no llevan el margen de "uno debajo del otro". */}
      <div className="mg-rejilla" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        <style>{'.mg-rejilla > .adm-panel { margin-top: 0; }'}</style>
        <Panel title="Por línea">
          {d.porLinea.length === 0 ? <EmptyState icon="ph-chart-bar" title="Sin servicios cerrados este mes" /> : (
            <div style={{ display: 'grid', gap: 8 }}>
              {d.porLinea.map((l) => (
                <div key={l.linea} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5, borderTop: '1px solid var(--adm-border)', paddingTop: 8 }}>
                  <span>{l.nombre} <span style={{ color: 'var(--adm-faint)' }}>· {l.servicios}</span></span>
                  <span className="adm-num"><strong>{dinero(l.margen)}</strong> <span style={{ color: 'var(--adm-muted)' }}>de {dinero(l.ventas)}</span></span>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Últimos 6 meses" desc="Ventas y margen.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, alignItems: 'end', height: 130 }} role="img" aria-label="Ventas y margen de los últimos 6 meses">
            {d.tendencia.map((t) => (
              <div key={t.mes} style={{ display: 'grid', gap: 4, justifyItems: 'center', height: '100%', alignContent: 'end' }} title={`${mesTitulo(t.mes)}: ventas ${dinero(t.ventas)}, margen ${dinero(t.margen)}`}>
                <div style={{ width: '70%', display: 'grid', alignContent: 'end', height: 100 }}>
                  <div style={{ height: `${(t.ventas / maxVentas) * 100}px`, minHeight: t.ventas > 0 ? 2 : 0, background: 'var(--adm-raised)', borderRadius: 4, display: 'grid', alignContent: 'end', overflow: 'hidden' }}>
                    <div style={{ height: `${(Math.max(0, t.margen) / maxVentas) * 100}px`, background: 'var(--adm-ok)' }} />
                  </div>
                </div>
                <span style={{ fontSize: 11.5, color: t.mes === d.mes ? 'var(--adm-text)' : 'var(--adm-muted)' }}>{mesCorto(t.mes)}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Hoy" desc="Con IVA.">
          <div style={{ display: 'grid', gap: 8, fontSize: 13.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><a className="adm-link" href="/administracion/cobranza">Por cobrar</a><span className="adm-num">{dinero(d.porCobrar)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>De eso, vencido</span><span className="adm-num" style={{ color: d.vencido > 0 ? 'var(--adm-bad)' : undefined }}>{dinero(d.vencido)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><a className="adm-link" href="/administracion/pagos">Por pagar a aliados</a><span className="adm-num">{dinero(d.porPagar)}</span></div>
          </div>
        </Panel>
      </div>

      <details style={{ marginTop: 18 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13.5, color: 'var(--adm-muted)' }}>Reglas: comisión {pct(d.reglas.comisionPct)}, se paga a aliados los {DIAS_SEMANA[d.reglas.diaDePago]}</summary>
        <Reglas d={d} />
      </details>
    </div>
  );
}

function Reglas({ d }: { d: DatosMargen }) {
  const router = useRouter();
  const [general, setGeneral] = useState(String(d.reglas.comisionPct));
  const [porLinea, setPorLinea] = useState<Record<string, string>>(Object.fromEntries(Object.entries(d.reglas.comisionPorLinea).map(([k, v]) => [k, String(v)])));
  const [dia, setDia] = useState(d.reglas.diaDePago);
  const [banco, setBanco] = useState(d.reglas.datosPago?.banco ?? '');
  const [clabe, setClabe] = useState(d.reglas.datosPago?.clabe ?? '');
  const [beneficiario, setBeneficiario] = useState(d.reglas.datosPago?.beneficiario ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function guardar() {
    const g = Number(general);
    if (!Number.isFinite(g) || g < 0 || g > 90) { setError('La comisión va de 0 a 90%.'); return; }
    const lineas: Record<string, number> = {};
    for (const [k, v] of Object.entries(porLinea)) if (v.trim() !== '') lineas[k] = Number(v);
    setBusy(true); setError(null);
    const fallo = await enviar('/api/admin/dinero/reglas', 'PUT', {
      comisionPct: g, comisionPorLinea: lineas, diaDePago: dia,
      datosPago: clabe.trim() ? { banco: banco.trim(), clabe: clabe.trim(), beneficiario: beneficiario.trim() } : null,
    });
    setBusy(false);
    if (fallo) { setError(fallo); return; }
    mostrarResultado('Reglas guardadas. Valen para los servicios que se cierren de aquí en adelante.', 'ok');
    router.refresh();
  }

  return (
    <Panel style={{ marginTop: 10 }} desc="Valen para los servicios que se cierren desde que se guardan; lo ya cerrado no cambia.">
      <div style={{ display: 'grid', gap: 16 }}>
        {error ? <Note tone="bad">{error}</Note> : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <FormField label="Comisión de MAQSER24 (%)" help="Del precio sin IVA. Lo demás es del aliado."><input className="adm-input" inputMode="decimal" value={general} onChange={(e) => setGeneral(e.target.value)} aria-label="Comisión general" /></FormField>
          <FormField label="Día de pago a aliados"><select className="adm-input" value={dia} onChange={(e) => setDia(Number(e.target.value))} aria-label="Día de pago">{DIAS_SEMANA.map((n, i) => <option key={i} value={i}>{n.charAt(0).toUpperCase() + n.slice(1)}</option>)}</select></FormField>
        </div>
        <FormField label="Comisión distinta por línea" help="Vacío = la general.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
            {d.lineas.map((l) => (
              <label key={l.slug} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span style={{ flex: 1 }}>{l.nombre}</span>
                <input className="adm-input" style={{ width: 80 }} inputMode="decimal" placeholder={general} value={porLinea[l.slug] ?? ''} onChange={(e) => setPorLinea((p) => ({ ...p, [l.slug]: e.target.value }))} aria-label={`Comisión de ${l.nombre}`} />
              </label>
            ))}
          </div>
        </FormField>
        <FormField label="Datos para que el cliente transfiera" help="Van en los recordatorios de pago. Vacío = no se ponen.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
            <input className="adm-input" value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="Banco" aria-label="Banco" />
            <input className="adm-input" value={clabe} onChange={(e) => setClabe(e.target.value)} placeholder="CLABE" aria-label="CLABE" />
            <input className="adm-input" value={beneficiario} onChange={(e) => setBeneficiario(e.target.value)} placeholder="A nombre de" aria-label="Beneficiario" />
          </div>
        </FormField>
        <div><Btn variant="primary" disabled={busy} onClick={() => void guardar()}>{busy ? 'Guardando…' : 'Guardar reglas'}</Btn></div>
      </div>
    </Panel>
  );
}
