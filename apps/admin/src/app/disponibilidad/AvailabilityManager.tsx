'use client';

import { useMemo, useState, type CSSProperties } from 'react';

export interface EquipoRow {
  id: number;
  name: string;
  stock: number | null;
  category: string | null;
  provider: string | null;
  state: string;
  location: string | null;
  confirmedAt: string | null;
  until: string | null;
  blocks: Array<{ id: number; state: string; startsOn: string; endsOn: string | null; note: string | null }>;
}

const C = {
  panel: '#141416', panel2: '#1b1e26', line: 'rgba(255,255,255,0.07)', line2: 'rgba(255,255,255,0.12)',
  ink: '#f2f4f7', muted: '#9aa1ad', dim: '#6b7280',
  accent: 'var(--color-primary)', accentInk: 'var(--color-primary-fg)',
  warn: 'var(--color-warning)', ok: 'var(--color-success)', bad: 'var(--color-error)',
};

/** Mismas etiquetas que ve el cliente en el sitio, para no hablar dos idiomas. */
const ESTADO: Record<string, { texto: string; color: string }> = {
  disponible: { texto: 'DISPONIBLE', color: C.ok },
  limitada: { texto: 'LIMITADA', color: C.warn },
  'por-confirmar': { texto: 'POR CONFIRMAR', color: C.warn },
  reservado: { texto: 'RESERVADO', color: C.warn },
  'en-traslado': { texto: 'EN TRASLADO', color: C.warn },
  'en-servicio': { texto: 'EN SERVICIO', color: C.warn },
  mantenimiento: { texto: 'MANTENIMIENTO', color: C.bad },
  'no-disponible': { texto: 'NO DISPONIBLE', color: C.bad },
  inactivo: { texto: 'INACTIVO', color: C.dim },
  'fuera-de-cobertura': { texto: 'FUERA DE COBERTURA', color: C.bad },
};

const MOTIVOS: Array<[string, string]> = [
  ['reservado', 'Reservado para otra obra'],
  ['en-servicio', 'En servicio'],
  ['en-traslado', 'En traslado'],
  ['mantenimiento', 'Mantenimiento'],
  ['inactivo', 'Inactivo (sin fecha)'],
];

const input: CSSProperties = {
  width: '100%', background: C.panel2, border: `1px solid ${C.line2}`, color: C.ink,
  borderRadius: 10, padding: '10px 12px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit',
};
const label: CSSProperties = { fontSize: 12, color: C.muted, marginBottom: 5, display: 'block' };
const boton: CSSProperties = {
  background: C.accent, color: C.accentInk, border: 'none', borderRadius: 9,
  padding: '9px 15px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
};
const botonSec: CSSProperties = {
  background: 'none', border: `1px solid ${C.line2}`, color: C.ink, borderRadius: 9,
  padding: '9px 15px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
};

/** "hace 4 días" a partir de la fecha ISO de confirmación. */
function haceCuanto(iso: string | null): { texto: string; viejo: boolean } {
  if (!iso) return { texto: 'nunca confirmado', viejo: true };
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return { texto: 'confirmado hoy', viejo: false };
  if (dias === 1) return { texto: 'confirmado ayer', viejo: false };
  return { texto: `confirmado hace ${dias} días`, viejo: dias > 14 };
}

export function AvailabilityManager({ initial }: { initial: EquipoRow[] }) {
  const [equipos, setEquipos] = useState(initial);
  const [query, setQuery] = useState('');
  const [soloAtencion, setSoloAtencion] = useState(false);
  const [abierto, setAbierto] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);

  // Formulario de bloqueo del equipo abierto
  const hoy = new Date().toISOString().slice(0, 10);
  const [motivo, setMotivo] = useState('mantenimiento');
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState('');
  const [nota, setNota] = useState('');
  const [ubicacion, setUbicacion] = useState('');

  async function recargar() {
    const r = await fetch('/api/admin/availability');
    if (r.ok) setEquipos(await r.json());
  }

  async function confirmar(id: number) {
    setOcupado(id);
    await fetch(`/api/admin/availability/${id}/confirm`, { method: 'POST' });
    await recargar();
    setOcupado(null);
  }

  async function guardarUbicacion(id: number) {
    setOcupado(id);
    await fetch(`/api/admin/availability/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: ubicacion || null }),
    });
    await recargar();
    setOcupado(null);
  }

  async function bloquear(id: number) {
    setOcupado(id);
    const r = await fetch(`/api/admin/availability/${id}/block`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: motivo, startsOn: desde, endsOn: hasta || null, note: nota || null }),
    });
    if (r.ok) { setNota(''); setHasta(''); await recargar(); }
    setOcupado(null);
  }

  async function liberar(blockId: number, equipoId: number) {
    setOcupado(equipoId);
    await fetch(`/api/admin/availability/blocks/${blockId}`, { method: 'DELETE' });
    await recargar();
    setOcupado(null);
  }

  const necesitaAtencion = (e: EquipoRow) =>
    e.state === 'por-confirmar' || e.location === null || haceCuanto(e.confirmedAt).viejo;

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    return equipos.filter((e) => {
      if (soloAtencion && !necesitaAtencion(e)) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        (e.location ?? '').toLowerCase().includes(q) ||
        (e.provider ?? '').toLowerCase().includes(q)
      );
    });
  }, [equipos, query, soloAtencion]);

  const porConfirmar = equipos.filter((e) => e.state === 'por-confirmar').length;
  const bloqueados = equipos.filter((e) => e.blocks.length > 0).length;
  const sinUbicacion = equipos.filter((e) => e.location === null).length;

  return (
    <div style={{ color: C.ink }}>
      <h1 className="adm-page-title">Disponibilidad</h1>
      <p style={{ color: C.muted, fontSize: 14, margin: '6px 0 22px', maxWidth: 760, lineHeight: 1.6 }}>
        Un equipo con existencias no siempre se puede asignar. Aquí se confirma que
        la disponibilidad sigue siendo cierta, se ubica el equipo y se bloquea cuando
        está ocupado. Una confirmación de más de 14 días deja de contar sola.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 20 }}>
        {[
          ['Equipos', equipos.length, C.ink],
          ['Por confirmar', porConfirmar, porConfirmar > 0 ? C.warn : C.dim],
          ['Bloqueados hoy', bloqueados, bloqueados > 0 ? C.warn : C.dim],
          ['Sin ubicación', sinUbicacion, sinUbicacion > 0 ? C.warn : C.dim],
        ].map(([t, n, col]) => (
          <div key={String(t)} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: '15px 18px' }}>
            <div style={{ fontSize: 12.5, color: C.muted }}>{t}</div>
            <div style={{ fontSize: 25, fontWeight: 800, marginTop: 4, color: col as string }}>{n as number}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <input style={{ ...input, maxWidth: 340 }} placeholder="Buscar equipo, ubicación o aliado…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button
          type="button"
          onClick={() => setSoloAtencion((v) => !v)}
          style={soloAtencion ? boton : botonSec}
        >
          Solo los que necesitan atención
        </button>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {filtrados.map((e) => {
          const est = ESTADO[e.state] ?? { texto: e.state.toUpperCase(), color: C.dim };
          const conf = haceCuanto(e.confirmedAt);
          const open = abierto === e.id;
          return (
            <div key={e.id} style={{ background: C.panel, border: `1px solid ${e.blocks.length ? `color-mix(in srgb, ${C.warn} 35%, transparent)` : C.line}`, borderRadius: 13, padding: '14px 16px', opacity: ocupado === e.id ? 0.6 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 15, minWidth: 210 }}>{e.name}</strong>
                <span style={{
                  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em', padding: '3px 9px', borderRadius: 6,
                  color: est.color,
                  border: `1px solid color-mix(in srgb, ${est.color} 40%, transparent)`,
                  background: `color-mix(in srgb, ${est.color} 12%, transparent)`,
                }}>
                  {est.texto}
                </span>
                <span style={{ fontSize: 12.5, color: conf.viejo ? C.warn : C.muted }}>{conf.texto}</span>
                <span style={{ fontSize: 12.5, color: e.location ? C.muted : C.warn }}>
                  {e.location ? `📍 ${e.location}` : 'sin ubicación'}
                </span>
                <span style={{ fontSize: 12.5, color: C.dim }}>
                  {e.stock === null ? 'sin control de stock' : `${e.stock} en inventario`}
                </span>

                <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <button type="button" style={boton} onClick={() => confirmar(e.id)}>Confirmar</button>
                  <button
                    type="button"
                    style={botonSec}
                    onClick={() => { setAbierto(open ? null : e.id); setUbicacion(e.location ?? ''); }}
                  >
                    {open ? 'Cerrar' : 'Ajustar'}
                  </button>
                </span>
              </div>

              {e.blocks.length > 0 ? (
                <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                  {e.blocks.map((b) => (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: C.muted }}>
                      <span style={{ color: C.warn }}>{ESTADO[b.state]?.texto ?? b.state}</span>
                      <span>{b.startsOn} → {b.endsOn ?? 'sin fecha de retorno'}</span>
                      {b.note ? <span style={{ color: C.dim }}>· {b.note}</span> : null}
                      <button type="button" onClick={() => liberar(b.id, e.id)} style={{ ...botonSec, padding: '4px 10px', fontSize: 12 }}>
                        Liberar
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {open ? (
                <div style={{ marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 14, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 240px' }}>
                      <span style={label}>Dónde está el equipo</span>
                      <input style={input} placeholder="Apodaca" value={ubicacion} onChange={(ev) => setUbicacion(ev.target.value)} />
                    </div>
                    <button type="button" style={botonSec} onClick={() => guardarUbicacion(e.id)}>Guardar ubicación</button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, alignItems: 'end' }}>
                    <div>
                      <span style={label}>Motivo del bloqueo</span>
                      <select style={input} value={motivo} onChange={(ev) => setMotivo(ev.target.value)}>
                        {MOTIVOS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                      </select>
                    </div>
                    <div><span style={label}>Desde</span><input style={input} type="date" value={desde} onChange={(ev) => setDesde(ev.target.value)} /></div>
                    <div><span style={label}>Hasta (opcional)</span><input style={input} type="date" value={hasta} onChange={(ev) => setHasta(ev.target.value)} /></div>
                    <div><span style={label}>Nota</span><input style={input} placeholder="Servicio de 500 horas" value={nota} onChange={(ev) => setNota(ev.target.value)} /></div>
                    <button type="button" style={boton} onClick={() => bloquear(e.id)}>Bloquear</button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}

        {filtrados.length === 0 ? (
          <div style={{ color: C.muted, padding: 30, textAlign: 'center', border: `1px dashed ${C.line2}`, borderRadius: 14 }}>
            Nada que mostrar con ese filtro.
          </div>
        ) : null}
      </div>
    </div>
  );
}
