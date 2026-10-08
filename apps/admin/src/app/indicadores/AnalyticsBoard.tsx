'use client';

import { useState } from 'react';
import { AdminSelect } from '@/components/AdminSelect';
import { useRouter } from 'next/navigation';
import { Chip, Note, PageHeader, Panel, SearchBox, Segmented, Toolbar, type Tone } from '@/components/ui';

/**
 * TABLERO DE INDICADORES.
 *
 * Un tablero es lo que alguien enseña en una junta, así que la letra chica
 * pesa más que en otras pantallas: cada número dice de cuántos casos sale, y
 * los que no se pueden calcular se ven —con su motivo— en vez de desaparecer.
 * Un hueco que nadie nota es un hueco que nadie arregla.
 */

export interface Indicador {
  clave: string;
  label: string;
  revela: string;
  valor: number | null;
  formato: 'conteo' | 'porcentaje' | 'dias' | 'horas' | 'dinero';
  estado: 'ok' | 'sin-muestra' | 'no-medible' | 'bloqueado';
  muestra: number;
  nota: string | null;
  anterior: number | null;
  subirEsBueno: boolean | null;
}

export interface Tablero {
  periodo: { dias: number; desde: string; hasta: string };
  filtros: { categoria: string | null; zona: string | null };
  contexto: { aliadosActivos: number; equiposActivos: number; clientes: number };
  indicadores: Indicador[];
}

const PERIODOS: Array<[string, string]> = [
  ['30', '30 días'], ['90', '90 días'], ['180', '6 meses'], ['365', '1 año'],
];

function formatear(v: number, f: Indicador['formato']): string {
  if (f === 'porcentaje') return `${v}%`;
  if (f === 'dias') return `${v} d`;
  if (f === 'horas') return v >= 48 ? `${Math.round(v / 24)} d` : `${v} h`;
  if (f === 'dinero') return `$${v.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;
  return v.toLocaleString('es-MX');
}

const ENCABEZADO = (
  <PageHeader
    eyebrow={['4 · Cobrar y medir', 'Analítica']}
    title="Indicadores"
    subtitle="Los doce que pide el documento. El panel de inicio dice qué hay que atender; esto dice si lo que se hizo sirvió."
  />
);

export function AnalyticsBoard({
  tablero, categorias, filtros,
}: {
  tablero: Tablero | null;
  categorias: Array<{ slug: string; name: string }>;
  filtros: { dias: string; categoria: string; zona: string };
}) {
  const router = useRouter();
  const [zona, setZona] = useState(filtros.zona);
  const [abierto, setAbierto] = useState<string | null>(null);

  function ir(cambios: Partial<typeof filtros>) {
    const f = { ...filtros, ...cambios };
    const qs = new URLSearchParams();
    if (f.dias && f.dias !== '90') qs.set('dias', f.dias);
    if (f.categoria) qs.set('categoria', f.categoria);
    if (f.zona) qs.set('zona', f.zona);
    router.push(`/indicadores${qs.size ? `?${qs}` : ''}`);
  }

  if (!tablero) {
    return (
      <div>
        {ENCABEZADO}
        <Note tone="bad">No se pudieron cargar los indicadores.</Note>
      </div>
    );
  }

  const medibles = tablero.indicadores.filter((i) => i.estado === 'ok').length;
  const pendientes = tablero.indicadores.filter((i) => i.estado === 'no-medible' || i.estado === 'bloqueado');

  return (
    <div>
      <style>{`
        /* Una sola rejilla: las celdas se separan con líneas finas, no con
           tarjetas. El margen negativo esconde la línea del borde exterior
           (el panel la recorta), así queda solo la que separa celdas. */
        .ind-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); margin: 0 -1px -1px 0; }
        .ind-celda {
          min-width: 0; padding: 18px 20px; display: flex; flex-direction: column; gap: 6px;
          border-right: 1px solid var(--adm-border); border-bottom: 1px solid var(--adm-border);
        }
        @media (max-width: 560px) { .ind-celda { padding: 16px; } }
      `}</style>

      {ENCABEZADO}

      {/* Filtros */}
      <Toolbar>
        <Segmented
          ariaLabel="Periodo"
          value={filtros.dias}
          onChange={(v) => ir({ dias: v })}
          items={PERIODOS.map(([v, t]) => ({ key: v, label: t }))}
        />
        <AdminSelect
          size="sm"
          className="w-auto min-w-[190px]"
          ariaLabel="Línea de servicio"
          value={filtros.categoria}
          onChange={(v) => ir({ categoria: v })}
          options={[{ value: '', label: 'Todas las líneas' }, ...categorias.map((c) => ({ value: c.slug, label: c.name }))]}
        />
        <SearchBox
          value={zona}
          onChange={(e) => setZona(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') ir({ zona }); }}
          onBlur={() => { if (zona !== filtros.zona) ir({ zona }); }}
          placeholder="Municipio…"
          aria-label="Municipio"
          style={{ flex: '0 1 200px' }}
        />
      </Toolbar>

      {/* Contexto: sin esto, un 12% de conversión no se puede leer. */}
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--adm-muted)', lineHeight: 1.6 }}>
        Del {tablero.periodo.desde} al {tablero.periodo.hasta} · <span className="adm-num">{tablero.contexto.aliadosActivos}</span> aliados
        activos · <span className="adm-num">{tablero.contexto.equiposActivos}</span> equipos · <span className="adm-num">{tablero.contexto.clientes}</span> clientes ·
        <span style={{ color: 'var(--adm-text-2)' }}> <span className="adm-num">{medibles}</span> de 12 indicadores con dato</span>
      </p>

      <Panel flush clip>
        <div className="ind-grid">
          {tablero.indicadores.map((i) => (
            <Celda key={i.clave} i={i} abierto={abierto === i.clave} onAbrir={() => setAbierto(abierto === i.clave ? null : i.clave)} filtros={filtros} />
          ))}
        </div>
      </Panel>

      {pendientes.length > 0 ? (
        <Panel
          flush
          clip
          style={{ marginTop: 24 }}
          title={`${pendientes.length} de los doce todavía no se pueden calcular`}
          desc="Se muestran a propósito. Rellenarlos con una aproximación silenciosa sería peor que dejarlos en blanco: nadie volvería a preguntarse por ellos."
        >
          {pendientes.map((i) => (
            <div key={i.clave} className="adm-trow">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="adm-cell-title" style={{ fontSize: 13.5 }}>{i.label}</span>
                {i.estado === 'bloqueado' ? <Chip tone="warn">Espera una decisión</Chip> : null}
              </div>
              <div className="adm-cell-sub" style={{ lineHeight: 1.55 }}>{i.nota}</div>
            </div>
          ))}
        </Panel>
      ) : null}
    </div>
  );
}

function Celda({
  i, abierto, onAbrir, filtros,
}: {
  i: Indicador;
  abierto: boolean;
  onAbrir: () => void;
  filtros: { dias: string; categoria: string };
}) {
  const hayDato = i.estado === 'ok' && i.valor !== null;
  const color =
    i.estado === 'bloqueado' ? 'var(--adm-warn)' : hayDato ? 'var(--adm-text)' : 'var(--adm-faint)';

  // Comparación con el periodo anterior. Se pinta bien o mal según lo que
  // signifique subir en ESE indicador: bajar el tiempo a cotización es bueno.
  let delta: { texto: string; tono: Tone } | null = null;
  if (hayDato && i.anterior !== null && i.anterior !== 0 && i.valor !== null) {
    const pct = Math.round(((i.valor - i.anterior) / i.anterior) * 100);
    if (pct !== 0) {
      const bueno = i.subirEsBueno === null ? null : pct > 0 === i.subirEsBueno;
      delta = {
        texto: `${pct > 0 ? '+' : ''}${pct}% vs. antes`,
        tono: bueno === null ? 'muted' : bueno ? 'ok' : 'bad',
      };
    }
  }

  const auditable = ['conversion', 'cotizacion', 'cancelaciones', 'no-cubierta'].includes(i.clave);

  return (
    <div className="ind-celda">
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--adm-text-2)', lineHeight: 1.35 }}>{i.label}</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px 9px', flexWrap: 'wrap', marginTop: 2 }}>
        <span
          className="adm-num"
          style={{
            fontSize: hayDato ? 26 : 14.5, fontWeight: hayDato ? 600 : 500, lineHeight: 1.15,
            letterSpacing: hayDato ? '-0.02em' : 0, color,
          }}
        >
          {hayDato ? formatear(i.valor!, i.formato) : i.estado === 'bloqueado' ? 'Falta decidir' : i.estado === 'no-medible' ? 'No se mide aún' : 'Sin datos'}
        </span>
        {delta ? <span className={`adm-tone adm-num t-${delta.tono}`} style={{ fontSize: 12.5, fontWeight: 600 }}>{delta.texto}</span> : null}
      </div>

      {/* La muestra va siempre y en pequeño: es lo que permite discutir el
          número en vez de creérselo. */}
      {i.muestra > 0 ? (
        <div className="adm-num" style={{ fontSize: 12, color: 'var(--adm-faint)' }}>de {i.muestra} caso{i.muestra === 1 ? '' : 's'}</div>
      ) : null}

      <div style={{ fontSize: 12.5, color: 'var(--adm-muted)', lineHeight: 1.5, marginTop: 2 }}>{i.revela}</div>

      {i.nota ? (
        <button
          type="button"
          onClick={onAbrir}
          aria-expanded={abierto}
          className="adm-panel-link"
          style={{ marginTop: 'auto', paddingTop: 8, fontSize: 12.5, alignSelf: 'flex-start' }}
        >
          {abierto ? 'Ocultar detalle' : 'Por qué'}
          <i className={`ph ${abierto ? 'ph-caret-up' : 'ph-caret-down'}`} aria-hidden />
        </button>
      ) : null}

      {abierto && i.nota ? (
        <div style={{ fontSize: 12.5, color: 'var(--adm-text-2)', lineHeight: 1.6, background: 'var(--adm-raised)', border: '1px solid var(--adm-border)', borderRadius: 8, padding: '10px 12px', marginTop: 4 }}>
          {i.nota}
          {auditable ? (
            <a
              href={`/api/admin/analytics/casos?clave=${i.clave}&dias=${filtros.dias}${filtros.categoria ? `&categoria=${filtros.categoria}` : ''}`}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'block', marginTop: 8, color: 'var(--adm-accent)', fontSize: 12.5, textDecoration: 'none' }}
            >
              Ver los casos que lo componen →
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
