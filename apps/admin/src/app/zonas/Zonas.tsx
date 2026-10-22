'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mostrarResultado } from '@maqserv/ui';
import { Btn, Note, PageHeader, Panel, Segmented } from '@/components/ui';

type Estado = 'sitio' | 'interna' | 'pausada';
export interface Zona { id: string; nombre: string; estado: Estado; municipios: string[] }
export interface SaludZona {
  id: string;
  municipios: Array<{ nombre: string; aliados: number }>;
  sinAliado: string[];
  unSolo: string[];
  solicitudes90: number;
}

const ESTADOS: Array<{ key: Estado; label: string }> = [
  { key: 'sitio', label: 'Se anuncia' },
  { key: 'interna', label: 'Interna' },
  { key: 'pausada', label: 'En pausa' },
];
const AYUDA: Record<Estado, string> = {
  sitio: 'Sale en el cotizador del sitio y se cotiza.',
  interna: 'Se atiende a quien la pida (el panel la cotiza); el sitio no la anuncia.',
  pausada: 'No se toman solicitudes nuevas.',
};

/**
 * ZONAS (2026-10-22, Fase B). Dónde da servicio MAQSER24, en un solo lugar: de
 * aquí salen los municipios de los dos cotizadores. Junto a cada municipio,
 * cuántos aliados llegan: rojo si ninguno, ámbar si depende de uno solo.
 */
export function Zonas({ zonas: inicial, salud, sugerencias }: { zonas: Zona[]; salud: SaludZona[]; sugerencias: string[] }) {
  const router = useRouter();
  const [zonas, setZonas] = useState<Zona[]>(inicial);
  const [nuevo, setNuevo] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cambio = useMemo(() => JSON.stringify(zonas) !== JSON.stringify(inicial), [zonas, inicial]);
  const aliadosDe = (zonaId: string, m: string) => salud.find((s) => s.id === zonaId)?.municipios.find((x) => x.nombre === m)?.aliados;
  const sinAliadoAnunciados = zonas.filter((z) => z.estado === 'sitio').flatMap((z) => salud.find((s) => s.id === z.id)?.sinAliado ?? []);

  const editar = (id: string, patch: Partial<Zona>) => setZonas((zs) => zs.map((z) => (z.id === id ? { ...z, ...patch } : z)));
  function agregarMunicipio(z: Zona) {
    const m = (nuevo[z.id] ?? '').trim();
    if (m.length < 2) return;
    if (zonas.some((x) => x.municipios.some((y) => y.toLowerCase() === m.toLowerCase()))) { setError(`${m} ya está en una zona.`); return; }
    editar(z.id, { municipios: [...z.municipios, m] });
    setNuevo((n) => ({ ...n, [z.id]: '' }));
    setError(null);
  }
  function agregarZona() {
    const id = `zona-${Date.now().toString(36)}`;
    setZonas((zs) => [...zs, { id, nombre: 'Zona nueva', estado: 'interna', municipios: [] }]);
  }
  async function guardar() {
    setBusy(true); setError(null);
    const r = await fetch('/api/admin/zonas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(zonas) }).catch(() => null);
    setBusy(false);
    if (!r?.ok) { setError((await r?.json().catch(() => null))?.message ?? 'No se pudo guardar.'); return; }
    mostrarResultado('Zonas guardadas. Los cotizadores las toman en un minuto.', 'ok');
    router.refresh();
  }

  return (
    <div>
      <style>{`
        .zn-lista > .adm-panel { margin-top: 0; }
        .zn-muns { display: flex; flex-wrap: wrap; gap: 6px; }
        .zn-mun { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; padding: 4px 6px 4px 10px; border-radius: 999px; border: 1px solid var(--adm-border); background: var(--adm-raised); }
        .zn-mun[data-n="0"] { border-color: var(--adm-bad); }
        .zn-mun[data-n="1"] { border-color: var(--adm-warn); }
        .zn-n { font-size: 11.5px; color: var(--adm-muted); }
        .zn-mun[data-n="0"] .zn-n { color: var(--adm-bad); }
        .zn-mun[data-n="1"] .zn-n { color: var(--adm-warn); }
        .zn-x { background: none; border: 0; color: var(--adm-faint); cursor: pointer; padding: 0 4px; font-size: 14px; line-height: 1; }
        .zn-x:hover, .zn-x:focus-visible { color: var(--adm-text); }
      `}</style>
      <PageHeader
        eyebrow={['Ajustes', 'Configuración']}
        title="Zonas"
        subtitle="Dónde da servicio MAQSER24. De aquí salen los municipios de los cotizadores; el precio no cambia por zona."
        actions={<><Btn variant="ghost" icon="ph-plus" onClick={agregarZona}>Agregar zona</Btn><Btn variant="primary" disabled={!cambio || busy} onClick={() => void guardar()}>{busy ? 'Guardando…' : 'Guardar'}</Btn></>}
      />
      {error ? <Note tone="bad" style={{ marginBottom: 12 }}>{error}</Note> : null}
      {sinAliadoAnunciados.length ? (
        <Note tone="warn" style={{ marginBottom: 12 }}>
          Se anuncia en {sinAliadoAnunciados.join(', ')} y ningún aliado llega ahí. <a className="adm-link" href="/cobertura">Ver dónde reclutar</a>
        </Note>
      ) : null}

      <datalist id="zn-sugerencias">{sugerencias.map((m) => <option key={m} value={m} />)}</datalist>
      <div className="zn-lista" style={{ display: 'grid', gap: 12 }}>
        {zonas.map((z) => {
          const s = salud.find((x) => x.id === z.id);
          return (
            <Panel key={z.id}>
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                  <input className="adm-input" style={{ maxWidth: 320, fontWeight: 600 }} value={z.nombre} onChange={(e) => editar(z.id, { nombre: e.target.value })} aria-label="Nombre de la zona" />
                  <Segmented<Estado> value={z.estado} onChange={(k) => editar(z.id, { estado: k })} ariaLabel={`Estado de ${z.nombre}`} items={ESTADOS} />
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--adm-muted)' }}>
                  {AYUDA[z.estado]}{s ? ` · ${s.solicitudes90} solicitud${s.solicitudes90 === 1 ? '' : 'es'} en 90 días` : ''}
                </div>
                <div className="zn-muns">
                  {z.municipios.map((m) => {
                    const n = aliadosDe(z.id, m);
                    return (
                      <span key={m} className="zn-mun" data-n={n === undefined ? undefined : Math.min(n, 2)}>
                        {m}{n !== undefined ? <span className="zn-n">{n === 0 ? 'sin aliado' : n === 1 ? '1 aliado' : `${n} aliados`}</span> : null}
                        <button type="button" className="zn-x" aria-label={`Quitar ${m}`} onClick={() => editar(z.id, { municipios: z.municipios.filter((x) => x !== m) })}>×</button>
                      </span>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input className="adm-input" style={{ maxWidth: 280 }} list="zn-sugerencias" placeholder="Agregar municipio" value={nuevo[z.id] ?? ''} onChange={(e) => setNuevo((x) => ({ ...x, [z.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarMunicipio(z); } }} aria-label={`Agregar municipio a ${z.nombre}`} />
                  <Btn size="sm" onClick={() => agregarMunicipio(z)}>Agregar</Btn>
                  {z.municipios.length === 0 ? <Btn size="sm" variant="ghost" onClick={() => setZonas((zs) => zs.filter((x) => x.id !== z.id))}>Quitar zona</Btn> : null}
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
