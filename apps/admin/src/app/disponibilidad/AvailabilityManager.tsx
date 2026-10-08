'use client';

import { useMemo, useState } from 'react';
import { AdminSelect } from '@/components/AdminSelect';
import {
  Btn, EmptyState, FormField, PageHeader, Panel, SearchBox, Stat, Stats, StatusText, Switch, Toolbar, type Tone,
} from '@/components/ui';

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

/** Mismas etiquetas que ve el cliente en el sitio, para no hablar dos idiomas. */
const ESTADO: Record<string, { texto: string; tone: Tone }> = {
  disponible: { texto: 'DISPONIBLE', tone: 'ok' },
  limitada: { texto: 'LIMITADA', tone: 'warn' },
  'por-confirmar': { texto: 'POR CONFIRMAR', tone: 'warn' },
  reservado: { texto: 'RESERVADO', tone: 'warn' },
  'en-traslado': { texto: 'EN TRASLADO', tone: 'warn' },
  'en-servicio': { texto: 'EN SERVICIO', tone: 'warn' },
  mantenimiento: { texto: 'MANTENIMIENTO', tone: 'bad' },
  'no-disponible': { texto: 'NO DISPONIBLE', tone: 'bad' },
  inactivo: { texto: 'INACTIVO', tone: 'muted' },
  'fuera-de-cobertura': { texto: 'FUERA DE COBERTURA', tone: 'bad' },
};

const MOTIVOS: Array<[string, string]> = [
  ['reservado', 'Reservado para otra obra'],
  ['en-servicio', 'En servicio'],
  ['en-traslado', 'En traslado'],
  ['mantenimiento', 'Mantenimiento'],
  ['inactivo', 'Inactivo (sin fecha)'],
];

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
    <div>
      <style>{`
        .av-main { display: grid; grid-template-columns: minmax(0, 1fr) 180px auto; gap: 16px; align-items: center; }
        /* En móvil la fila se apila: nombre y datos arriba, estado y botones debajo. */
        @media (max-width: 900px) {
          .av-main { display: flex; flex-wrap: wrap; gap: 8px 12px; }
          .av-main > .av-name { flex: 1 1 100%; }
          .av-main > .av-actions { margin-left: auto; }
        }
      `}</style>

      <PageHeader
        eyebrow="2 · Cotizar"
        title="Disponibilidad"
        subtitle="Un equipo con existencias no siempre se puede asignar. Aquí se confirma que la disponibilidad sigue siendo cierta, se ubica el equipo y se bloquea cuando está ocupado. Una confirmación de más de 14 días deja de contar sola."
      />

      <Stats>
        <Stat label="Equipos" icon="ph-wrench" tone="accent" value={equipos.length} />
        <Stat label="Por confirmar" icon="ph-clock-countdown" tone={porConfirmar > 0 ? 'warn' : 'muted'} value={porConfirmar} valueTone={porConfirmar > 0 ? 'warn' : undefined} />
        <Stat label="Bloqueados hoy" icon="ph-lock-simple" tone={bloqueados > 0 ? 'warn' : 'muted'} value={bloqueados} valueTone={bloqueados > 0 ? 'warn' : undefined} />
        <Stat label="Sin ubicación" icon="ph-map-pin" tone={sinUbicacion > 0 ? 'warn' : 'muted'} value={sinUbicacion} valueTone={sinUbicacion > 0 ? 'warn' : undefined} />
      </Stats>

      <Toolbar end={<span className="adm-num">{filtrados.length} de {equipos.length}</span>}>
        <SearchBox placeholder="Buscar equipo, ubicación o aliado…" aria-label="Buscar equipo, ubicación o aliado" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Switch on={soloAtencion} onClick={() => setSoloAtencion((v) => !v)} label="Solo los que necesitan atención" />
      </Toolbar>

      <Panel flush clip>
        {filtrados.map((e) => {
          const est = ESTADO[e.state] ?? { texto: e.state.toUpperCase(), tone: 'muted' as Tone };
          const conf = haceCuanto(e.confirmedAt);
          const open = abierto === e.id;
          return (
            <div key={e.id} className="adm-trow" style={{ opacity: ocupado === e.id ? 0.6 : 1 }}>
              <div className="av-main">
                <div className="av-name" style={{ minWidth: 0 }}>
                  <div className="adm-cell-title adm-ellipsis">{e.name}</div>
                  <div className="adm-meta">
                    <span style={conf.viejo ? { color: 'var(--adm-warn)' } : undefined}>{conf.texto}</span>
                    {e.location ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><i className="ph ph-map-pin" aria-hidden />{e.location}</span>
                    ) : (
                      <span style={{ color: 'var(--adm-warn)' }}>sin ubicación</span>
                    )}
                    <span style={{ color: 'var(--adm-faint)' }}>
                      {e.stock === null ? 'sin control de stock' : `${e.stock} en inventario`}
                    </span>
                  </div>
                </div>
                <div className="av-state">
                  <StatusText tone={est.tone}>{est.texto}</StatusText>
                </div>
                <div className="av-actions" style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <Btn size="sm" icon="ph-check" onClick={() => confirmar(e.id)}>Confirmar</Btn>
                  <Btn
                    size="sm"
                    variant="ghost"
                    icon={open ? 'ph-caret-up' : 'ph-sliders-horizontal'}
                    aria-expanded={open}
                    onClick={() => { setAbierto(open ? null : e.id); setUbicacion(e.location ?? ''); }}
                  >
                    {open ? 'Cerrar' : 'Ajustar'}
                  </Btn>
                </div>
              </div>

              {e.blocks.length > 0 ? (
                <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                  {e.blocks.map((b) => (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, columnGap: 10, fontSize: 12.5, color: 'var(--adm-muted)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--adm-warn)', fontWeight: 500 }}>
                        <i className="ph ph-lock-simple" aria-hidden />{ESTADO[b.state]?.texto ?? b.state}
                      </span>
                      <span className="adm-num">{b.startsOn} → {b.endsOn ?? 'sin fecha de retorno'}</span>
                      {b.note ? <span style={{ color: 'var(--adm-faint)' }}>· {b.note}</span> : null}
                      <Btn size="sm" variant="ghost" onClick={() => liberar(b.id, e.id)}>Liberar</Btn>
                    </div>
                  ))}
                </div>
              ) : null}

              {open ? (
                <div style={{ marginTop: 14, borderTop: '1px solid var(--adm-border)', paddingTop: 14, display: 'grid', gap: 14 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <FormField label="Dónde está el equipo" style={{ flex: '1 1 240px' }}>
                      <input className="adm-input" placeholder="Apodaca" value={ubicacion} onChange={(ev) => setUbicacion(ev.target.value)} />
                    </FormField>
                    <Btn onClick={() => guardarUbicacion(e.id)}>Guardar ubicación</Btn>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, alignItems: 'end' }}>
                    <div className="adm-field">
                      <span className="adm-label">Motivo del bloqueo</span>
                      <AdminSelect ariaLabel="Motivo del bloqueo" value={motivo} onChange={setMotivo} options={MOTIVOS.map(([k, n]) => ({ value: k, label: n }))} />
                    </div>
                    <FormField label="Desde"><input className="adm-input" type="date" value={desde} onChange={(ev) => setDesde(ev.target.value)} /></FormField>
                    <FormField label="Hasta (opcional)"><input className="adm-input" type="date" value={hasta} onChange={(ev) => setHasta(ev.target.value)} /></FormField>
                    <FormField label="Nota"><input className="adm-input" placeholder="Servicio de 500 horas" value={nota} onChange={(ev) => setNota(ev.target.value)} /></FormField>
                    <Btn icon="ph-lock-simple" onClick={() => bloquear(e.id)}>Bloquear</Btn>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}

        {filtrados.length === 0 ? (
          <EmptyState icon="ph-funnel" title="Nada que mostrar con ese filtro." />
        ) : null}
      </Panel>
    </div>
  );
}
