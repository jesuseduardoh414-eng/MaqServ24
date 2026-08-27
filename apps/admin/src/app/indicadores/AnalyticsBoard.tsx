'use client';

import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

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

const C = {
  panel: '#141416', panel2: '#1b1e26', line: 'rgba(255,255,255,0.07)', line2: 'rgba(255,255,255,0.12)',
  ink: '#f2f4f7', muted: '#9aa1ad', dim: '#6b7280',
  accent: 'var(--color-primary)', accentInk: 'var(--color-primary-fg)',
  warn: 'var(--color-warning)', ok: 'var(--color-success)', bad: 'var(--color-error)',
};

const input: CSSProperties = {
  background: C.panel2, border: `1px solid ${C.line2}`, color: C.ink,
  borderRadius: 9, padding: '8px 11px', fontSize: 13, outline: 'none', fontFamily: 'inherit',
};

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
    return <div style={{ color: C.muted, fontSize: 14 }}>No se pudieron cargar los indicadores.</div>;
  }

  const medibles = tablero.indicadores.filter((i) => i.estado === 'ok').length;
  const pendientes = tablero.indicadores.filter((i) => i.estado === 'no-medible' || i.estado === 'bloqueado');

  return (
    <div style={{ color: C.ink }}>
      <header style={{ marginBottom: 20 }}>
        <h1 className="adm-page-title">Indicadores</h1>
        <p style={{ color: C.muted, fontSize: 14, margin: '6px 0 0', maxWidth: 660, lineHeight: 1.6 }}>
          Los doce que pide el documento. El panel de inicio dice qué hay que atender; esto dice si
          lo que se hizo sirvió.
        </p>
      </header>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
        {PERIODOS.map(([v, t]) => (
          <button
            key={v}
            type="button"
            onClick={() => ir({ dias: v })}
            style={{
              ...input, cursor: 'pointer', fontWeight: filtros.dias === v ? 700 : 400,
              borderColor: filtros.dias === v ? C.accent : C.line2,
            }}
          >
            {t}
          </button>
        ))}
        <select value={filtros.categoria} onChange={(e) => ir({ categoria: e.target.value })} style={{ ...input, cursor: 'pointer' }}>
          <option value="">Todas las líneas</option>
          {categorias.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
        <input
          value={zona}
          onChange={(e) => setZona(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') ir({ zona }); }}
          onBlur={() => { if (zona !== filtros.zona) ir({ zona }); }}
          placeholder="Municipio…"
          style={{ ...input, width: 150 }}
        />
      </div>

      {/* Contexto: sin esto, un 12% de conversión no se puede leer. */}
      <div style={{ fontSize: 12.5, color: C.dim, marginBottom: 20, lineHeight: 1.6 }}>
        Del {tablero.periodo.desde} al {tablero.periodo.hasta} · {tablero.contexto.aliadosActivos} aliados
        activos · {tablero.contexto.equiposActivos} equipos · {tablero.contexto.clientes} clientes ·
        <span style={{ color: C.muted }}> {medibles} de 12 indicadores con dato</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(255px, 1fr))', gap: 12 }}>
        {tablero.indicadores.map((i) => (
          <Tarjeta key={i.clave} i={i} abierto={abierto === i.clave} onAbrir={() => setAbierto(abierto === i.clave ? null : i.clave)} filtros={filtros} />
        ))}
      </div>

      {pendientes.length > 0 ? (
        <div style={{ marginTop: 24, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: '17px 19px' }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 5 }}>
            {pendientes.length} de los doce todavía no se pueden calcular
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
            Se muestran a propósito. Rellenarlos con una aproximación silenciosa sería peor que
            dejarlos en blanco: nadie volvería a preguntarse por ellos.
          </p>
          <div style={{ display: 'grid', gap: 9 }}>
            {pendientes.map((i) => (
              <div key={i.clave} style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.55 }}>
                <span style={{ color: i.estado === 'bloqueado' ? C.warn : C.ink, fontWeight: 600 }}>{i.label}</span>
                {i.estado === 'bloqueado' ? <span style={{ color: C.warn, marginLeft: 7, fontSize: 11 }}>ESPERA UNA DECISIÓN</span> : null}
                <div style={{ marginTop: 2 }}>{i.nota}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Tarjeta({
  i, abierto, onAbrir, filtros,
}: {
  i: Indicador;
  abierto: boolean;
  onAbrir: () => void;
  filtros: { dias: string; categoria: string };
}) {
  const hayDato = i.estado === 'ok' && i.valor !== null;
  const color =
    i.estado === 'bloqueado' ? C.warn : i.estado === 'no-medible' ? C.dim : hayDato ? C.ink : C.dim;

  // Comparación con el periodo anterior. Se pinta bien o mal según lo que
  // signifique subir en ESE indicador: bajar el tiempo a cotización es bueno.
  let delta: { texto: string; color: string } | null = null;
  if (hayDato && i.anterior !== null && i.anterior !== 0 && i.valor !== null) {
    const pct = Math.round(((i.valor - i.anterior) / i.anterior) * 100);
    if (pct !== 0) {
      const bueno = i.subirEsBueno === null ? null : pct > 0 === i.subirEsBueno;
      delta = {
        texto: `${pct > 0 ? '+' : ''}${pct}% vs. antes`,
        color: bueno === null ? C.dim : bueno ? C.ok : C.bad,
      };
    }
  }

  const auditable = ['conversion', 'cotizacion', 'cancelaciones', 'no-cubierta'].includes(i.clave);

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: '15px 17px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.35 }}>{i.label}</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
        <span style={{ fontSize: hayDato ? 30 : 15, fontWeight: 800, color, letterSpacing: '-0.02em' }}>
          {hayDato ? formatear(i.valor!, i.formato) : i.estado === 'bloqueado' ? 'Falta decidir' : i.estado === 'no-medible' ? 'No se mide aún' : 'Sin datos'}
        </span>
        {delta ? <span style={{ fontSize: 12, fontWeight: 700, color: delta.color }}>{delta.texto}</span> : null}
      </div>

      {/* La muestra va siempre y en pequeño: es lo que permite discutir el
          número en vez de creérselo. */}
      {i.muestra > 0 ? (
        <div style={{ fontSize: 11.5, color: C.dim }}>de {i.muestra} caso{i.muestra === 1 ? '' : 's'}</div>
      ) : null}

      <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.5, marginTop: 2 }}>{i.revela}</div>

      {i.nota ? (
        <button
          type="button"
          onClick={onAbrir}
          style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: C.muted, fontSize: 11.5, marginTop: 'auto', paddingTop: 8, textDecoration: 'underline', textUnderlineOffset: 3 }}
        >
          {abierto ? 'Ocultar detalle' : 'Por qué'}
        </button>
      ) : null}

      {abierto && i.nota ? (
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 9, padding: '10px 12px', marginTop: 4 }}>
          {i.nota}
          {auditable ? (
            <a
              href={`/api/admin/analytics/casos?clave=${i.clave}&dias=${filtros.dias}${filtros.categoria ? `&categoria=${filtros.categoria}` : ''}`}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'block', marginTop: 8, color: C.accent, fontSize: 12 }}
            >
              Ver los casos que lo componen →
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
