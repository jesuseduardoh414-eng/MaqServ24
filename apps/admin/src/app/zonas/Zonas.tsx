'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { mostrarResultado } from '@maqserv/ui';
import { Btn, Chip, IconBtn, Note, PageHeader, Panel, Segmented } from '@/components/ui';
import { COLORES_ZONA, MapaZonas, type AliadoMapaZonas } from './MapaZonas';

type Estado = 'sitio' | 'interna' | 'pausada';
export interface Zona { id: string; nombre: string; estado: Estado; municipios: string[] }
export interface SaludZona {
  id: string;
  /** Cada municipio con cuántos aliados llegan y su cabecera en el mapa (null si no se reconoció). */
  municipios: Array<{ nombre: string; aliados: number; lat: number | null; lng: number | null }>;
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
const TONO: Record<Estado, 'ok' | 'info' | 'muted'> = { sitio: 'ok', interna: 'info', pausada: 'muted' };

/** El id que lleva cada renglón de cobertura (ver Cobertura.tsx): "nuevo leon|apodaca" → cob-nuevo-leon-apodaca. */
const idCobertura = (nombre: string, estado = 'Nuevo León') => {
  const sinEstado = nombre.replace(/,\s*(Coah|Chih)\.?$/i, '').trim();
  const est = /,\s*Coah/i.test(nombre) ? 'Coahuila' : /,\s*Chih/i.test(nombre) ? 'Chihuahua' : estado;
  const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');
  return `cob-${normal(est)}-${normal(sinEstado)}`.replace(/-+/g, '-').replace(/-$/, '');
};

/**
 * ZONAS (2026-10-22, Fase B). Dónde da servicio MAQSER24, en un solo lugar: de
 * aquí salen los municipios de los dos cotizadores. Junto a cada municipio,
 * cuántos aliados llegan: rojo si ninguno, ámbar si depende de uno solo.
 *
 * CON MAPA Y MÁS COMPACTO (2026-10-28, revisión del módulo): arriba el mapa
 * de las zonas; cada zona es un renglón con su nombre, su estado y sus
 * municipios, y se edita con el lápiz (antes todas traían un campo de texto y
 * tres botones aunque nadie las estuviera editando).
 */
export function Zonas({ zonas: inicial, salud, sugerencias, aliados = [], puedeEditar = true, cobertura }: {
  zonas: Zona[];
  salud: SaludZona[];
  sugerencias: string[];
  /** Las bases de los aliados con su alcance, para el mapa. */
  aliados?: AliadoMapaZonas[];
  /** Solo Dirección (configuración) edita; los demás la ven (2026-10-26). */
  puedeEditar?: boolean;
  /** "Quién llega a cada municipio", debajo de las zonas (antes la pantalla Mapa y cobertura). */
  cobertura?: ReactNode;
}) {
  const router = useRouter();
  const [zonas, setZonas] = useState<Zona[]>(inicial);
  const [editando, setEditando] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cambio = useMemo(() => JSON.stringify(zonas) !== JSON.stringify(inicial), [zonas, inicial]);
  const aliadosDe = (zonaId: string, m: string) => salud.find((s) => s.id === zonaId)?.municipios.find((x) => x.nombre === m)?.aliados;
  const sinAliadoAnunciados = zonas.filter((z) => z.estado === 'sitio').flatMap((z) => salud.find((s) => s.id === z.id)?.sinAliado ?? []);
  const colorDe = (id: string) => COLORES_ZONA[Math.max(0, zonas.findIndex((z) => z.id === id)) % COLORES_ZONA.length];

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
    setEditando(id);
  }
  async function guardar() {
    setBusy(true); setError(null);
    const r = await fetch('/api/admin/zonas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(zonas) }).catch(() => null);
    setBusy(false);
    if (!r?.ok) { setError((await r?.json().catch(() => null))?.message ?? 'No se pudo guardar.'); return; }
    mostrarResultado('Zonas guardadas. Los cotizadores las toman en un minuto.', 'ok');
    setEditando(null);
    router.refresh();
  }
  /** Desde el mapa: bajar al renglón de cobertura de ese municipio (o a la sección, si no tiene solicitudes). */
  function irACobertura(nombre: string) {
    const el = document.getElementById(idCobertura(nombre)) ?? document.getElementById('cobertura');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (el && el.id !== 'cobertura') {
      el.style.outline = '2px solid var(--adm-accent)';
      el.style.outlineOffset = '-2px';
      setTimeout(() => { el.style.outline = ''; el.style.outlineOffset = ''; }, 1800);
    }
  }

  return (
    <div>
      <style>{`
        .zn-lista > .adm-panel { margin-top: 0; }
        .zn-fila { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; gap: 14px; align-items: start; }
        .zn-color { width: 10px; height: 10px; border-radius: 50%; margin-top: 6px; }
        .zn-cab { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .zn-sub { font-size: 12.5px; color: var(--adm-muted); }
        .zn-muns { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
        .zn-mun { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--adm-border); background: var(--adm-raised); }
        .zn-mun[data-n="0"] { border-color: var(--adm-bad); }
        .zn-mun[data-n="1"] { border-color: var(--adm-warn); }
        .zn-n { font-size: 11.5px; color: var(--adm-muted); }
        .zn-mun[data-n="0"] .zn-n { color: var(--adm-bad); }
        .zn-mun[data-n="1"] .zn-n { color: var(--adm-warn); }
        .zn-mun .zn-x { background: none; border: 0; color: var(--adm-faint); cursor: pointer; padding: 0 0 0 2px; font-size: 14px; line-height: 1; }
        .zn-x:hover, .zn-x:focus-visible { color: var(--adm-text); }
        @media (max-width: 760px) { .zn-mun .zn-x { min-width: 28px; min-height: 28px; display: inline-grid; place-items: center; padding: 0; } }
        .zn-edit { display: grid; gap: 12px; }
        @media (max-width: 640px) { .zn-fila { grid-template-columns: 10px minmax(0, 1fr); } .zn-fila > :last-child { grid-column: 2; } }
      `}</style>
      <PageHeader
        eyebrow={['Ajustes', 'Configuración']}
        title="Zonas y cobertura"
        subtitle={`Dónde da servicio MAQSER24 y qué aliados llegan a cada municipio. De aquí salen los municipios de los cotizadores; el precio no cambia por zona.${puedeEditar ? '' : ' Solo Dirección puede cambiar las zonas.'}`}
        actions={puedeEditar ? <><Btn variant="ghost" icon="ph-plus" onClick={agregarZona}>Agregar zona</Btn><Btn variant="primary" disabled={!cambio || busy} onClick={() => void guardar()}>{busy ? 'Guardando…' : 'Guardar'}</Btn></> : null}
      />
      {error ? <Note tone="bad" style={{ marginBottom: 12 }}>{error}</Note> : null}
      {sinAliadoAnunciados.length ? (
        <Note tone="warn" style={{ marginBottom: 16 }}>
          {sinAliadoAnunciados.length === 1
            ? <>Se anuncia <b>{sinAliadoAnunciados[0]}</b> y ningún aliado llega ahí.</>
            : <>Se anuncian <b>{sinAliadoAnunciados.length} municipios</b> donde ningún aliado llega (en rojo en el mapa y en cada zona).</>}
          {' '}<a className="adm-link" href="#cobertura">Ver dónde reclutar</a>
        </Note>
      ) : null}

      <MapaZonas zonas={zonas} salud={salud} aliados={aliados} onMunicipio={irACobertura} />

      <datalist id="zn-sugerencias">{sugerencias.map((m) => <option key={m} value={m} />)}</datalist>
      <div className="zn-lista" style={{ display: 'grid', gap: 10 }}>
        {zonas.map((z) => {
          const s = salud.find((x) => x.id === z.id);
          const enEdicion = puedeEditar && editando === z.id;
          return (
            <Panel key={z.id} style={{ padding: '14px 18px' }}>
              <div className="zn-fila">
                <span className="zn-color" style={{ background: colorDe(z.id) }} aria-hidden />
                <div style={{ minWidth: 0 }}>
                  {enEdicion ? (
                    <div className="zn-edit">
                      <div className="zn-cab">
                        <input className="adm-input" style={{ maxWidth: 320, fontWeight: 600 }} value={z.nombre} onChange={(e) => editar(z.id, { nombre: e.target.value })} aria-label="Nombre de la zona" autoFocus />
                        <Segmented<Estado> value={z.estado} onChange={(k) => editar(z.id, { estado: k })} ariaLabel={`Estado de ${z.nombre}`} items={ESTADOS} />
                      </div>
                      <div className="zn-sub">{AYUDA[z.estado]}</div>
                    </div>
                  ) : (
                    <>
                      <div className="zn-cab">
                        <span className="adm-cell-title" style={{ fontSize: 15 }}>{z.nombre}</span>
                        <Chip tone={TONO[z.estado]}>{ESTADOS.find((e) => e.key === z.estado)?.label}</Chip>
                        <span className="zn-sub">
                          {z.municipios.length} municipio{z.municipios.length === 1 ? '' : 's'}
                          {s ? ` · ${s.solicitudes90} solicitud${s.solicitudes90 === 1 ? '' : 'es'} en 90 días` : ''}
                          {s?.sinAliado.length ? ` · ${s.sinAliado.length} sin aliado` : ''}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="zn-muns">
                    {z.municipios.map((m) => {
                      const n = aliadosDe(z.id, m);
                      return (
                        <span key={m} className="zn-mun" data-n={n === undefined ? undefined : Math.min(n, 2)}>
                          {m}{n !== undefined ? <span className="zn-n">{n === 0 ? 'sin aliado' : n === 1 ? '1 aliado' : `${n} aliados`}</span> : null}
                          {enEdicion ? <button type="button" className="zn-x" aria-label={`Quitar ${m}`} onClick={() => editar(z.id, { municipios: z.municipios.filter((x) => x !== m) })}>×</button> : null}
                        </span>
                      );
                    })}
                    {z.municipios.length === 0 ? <span className="zn-sub">Sin municipios todavía.</span> : null}
                  </div>
                  {enEdicion ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                      <input className="adm-input" style={{ maxWidth: 280 }} list="zn-sugerencias" placeholder="Agregar municipio" value={nuevo[z.id] ?? ''} onChange={(e) => setNuevo((x) => ({ ...x, [z.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarMunicipio(z); } }} aria-label={`Agregar municipio a ${z.nombre}`} />
                      <Btn size="sm" onClick={() => agregarMunicipio(z)}>Agregar</Btn>
                      <Btn size="sm" variant="ghost" onClick={() => setEditando(null)}>Listo</Btn>
                      {z.municipios.length === 0 ? <Btn size="sm" variant="ghost" onClick={() => { setZonas((zs) => zs.filter((x) => x.id !== z.id)); setEditando(null); }}>Quitar zona</Btn> : null}
                    </div>
                  ) : null}
                </div>
                {puedeEditar && !enEdicion ? <IconBtn icon="ph-pencil-simple" label={`Editar ${z.nombre}`} onClick={() => setEditando(z.id)} /> : <span />}
              </div>
            </Panel>
          );
        })}
      </div>

      {/* Quién llega a cada municipio contra dónde piden (antes "Mapa y cobertura"). */}
      {cobertura ? (
        <section id="cobertura" style={{ marginTop: 34, scrollMarginTop: 90 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--adm-text)', margin: '0 0 4px' }}>Cobertura</h2>
          <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--adm-muted)' }}>
            Qué aliados llegan a cada municipio contra dónde piden (últimos 90 días): dónde nadie llega y dónde todo depende de uno solo, para saber dónde reclutar.
          </p>
          {cobertura}
        </section>
      ) : null}
    </div>
  );
}
