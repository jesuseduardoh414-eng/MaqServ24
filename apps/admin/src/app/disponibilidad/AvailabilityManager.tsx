'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AdminSelect } from '@/components/AdminSelect';
import { AdminDatePicker } from '@/components/AdminFecha';
import {
  Btn, Chip, EmptyState, FormField, PageHeader, Panel, PanelLink, SearchBox, Segmented, Stat, Stats, StatusText, Switch, Toolbar,
} from '@/components/ui';
import { presentacionEstado } from '@maqserv/config';
import { colorVivo } from '@/components/modo';

export interface EquipoRow {
  id: number;
  name: string;
  stock: number | null;
  categoryId: number;
  category: string | null;
  /** La ficha del tipo a la que pertenece (Retroexcavadora 4x4…); null = por clasificar. */
  tipoId: number | null;
  tipo: string | null;
  /** Con qué cotizador del panel se cotiza su tipo; null = sin renglón en un tabulador. */
  cotizador: 'maquinaria' | 'triturados' | null;
  providerId: number | null;
  provider: string | null;
  /** En el catálogo: publicado, por revisar (aún no se le ofrece) o dado de baja. */
  publicacion: 'publicado' | 'por_revisar' | 'baja';
  /** Cuántas tiene y cómo están HOY: { disponible: 4, reservado: 1 }. */
  unidades: number;
  porEstado: Partial<Record<string, number>>;
  state: string;
  location: string | null;
  until: string | null;
  blocks: Array<{
    id: number; state: string; startsOn: string; endsOn: string | null; note: string | null;
    /** Lo puso un servicio: se mueve y se quita solo. */
    folio: string | null;
    /** Empieza después de hoy: no cambia el estado de hoy, pero ya está comprometido. */
    upcoming: boolean;
  }>;
}

/** Aliado de la red que aún no da de alta ningún equipo o servicio. */
export interface AliadoSinServicios { id: number; name: string; categoryIds: number[]; lineas: string[] }

export interface Disponibilidad {
  equipos: EquipoRow[];
  sinServicios: AliadoSinServicios[];
  categorias: Array<{ id: number; name: string }>;
}

/*
 * Los estados de una unidad, siempre a la vista (2026-10-26). Sin "por
 * confirmar" (ya no hay confirmación periódica) ni "limitada" (una máquina
 * libre está disponible; cuántas quedan lo dice el conteo). "Fuera de
 * cobertura" depende de la obra, no del equipo.
 */
const ESTADOS_UNIDAD = ['disponible', 'reservado', 'en-traslado', 'en-servicio', 'mantenimiento', 'inactivo'] as const;

/** Cómo se lee cada estado al contar unidades: "6 libres · 1 reservada". */
const EN_PLURAL: Record<string, [string, string]> = {
  disponible: ['libre', 'libres'],
  reservado: ['reservada', 'reservadas'],
  'en-traslado': ['en traslado', 'en traslado'],
  'en-servicio': ['en servicio', 'en servicio'],
  mantenimiento: ['en mantenimiento', 'en mantenimiento'],
  inactivo: ['inactiva', 'inactivas'],
};
const contar = (estado: string, n: number) => `${n} ${(EN_PLURAL[estado] ?? [estado, estado])[n === 1 ? 0 : 1]}`;

const colorEstado = (estado: string) => colorVivo(presentacionEstado(estado));

const MOTIVOS: Array<[string, string]> = [
  ['mantenimiento', 'Mantenimiento'],
  ['reservado', 'Reservado para otra obra'],
  ['en-servicio', 'En servicio'],
  ['en-traslado', 'En traslado'],
  ['inactivo', 'Inactivo (sin fecha)'],
];

/** Valor del filtro de tipo para lo que el aliado ofreció como "Otro". */
const SIN_TIPO = '__sin_tipo__';

/** Un tipo con sus unidades de todos los aliados: "Retroexcavadora 4x4 · 8 unidades". */
interface Grupo {
  clave: string;
  tipoId: number | null;
  nombre: string;
  categoria: string | null;
  cotizador: EquipoRow['cotizador'];
  equipos: EquipoRow[];
}

/** Lo «Nuevo» (no estaba en la lista de tipos) no se puede ofrecer: no cuenta como libre ni en ningún estado. Se decide en Inventario (2026-10-28). */
const porPublicar = (e: EquipoRow) => e.publicacion === 'por_revisar';

const sumaEstados = (lista: EquipoRow[]) => {
  const t: Record<string, number> = {};
  for (const e of lista) {
    if (porPublicar(e)) continue;
    for (const [s, n] of Object.entries(e.porEstado)) t[s] = (t[s] ?? 0) + (n ?? 0);
  }
  return t;
};

export function AvailabilityManager({ initial }: { initial: Disponibilidad }) {
  const [datos, setDatos] = useState(initial);
  // En vivo (2026-10-26): al llegar un aviso la campana pide la página otra vez;
  // la lista toma lo nuevo del servidor (lo que se escribe vive aparte y no se pierde).
  useEffect(() => { setDatos(initial); }, [initial]);
  const equipos = datos.equipos;
  const [query, setQuery] = useState('');
  const [soloAtencion, setSoloAtencion] = useState(false);
  /** Estado elegido en la barra (null = todos). */
  const [soloEstado, setSoloEstado] = useState<string | null>(null);
  /** Categoría (id) de la pestaña, tipo y aliado elegidos ('todas' / '' = sin filtro). */
  const [cat, setCat] = useState('todas');
  const [tipo, setTipo] = useState('');
  const [aliado, setAliado] = useState('');
  /** Tipos abiertos (clave del grupo); los demás se ven solo con su resumen. */
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  /** Equipo con el formulario de "Editar" abierto. */
  const [editando, setEditando] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);
  // Soltar una reserva de servicio pide un segundo clic: ya no se vuelve a poner sola.
  const [porLiberar, setPorLiberar] = useState<number | null>(null);

  // Formulario de "Editar" del equipo abierto
  const hoy = new Date().toISOString().slice(0, 10);
  const [motivo, setMotivo] = useState('mantenimiento');
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState('');
  const [nota, setNota] = useState('');
  const [ubicacion, setUbicacion] = useState('');

  async function recargar() {
    const r = await fetch('/api/admin/availability');
    if (r.ok) setDatos(await r.json());
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
    setPorLiberar(null);
    setOcupado(equipoId);
    await fetch(`/api/admin/availability/blocks/${blockId}`, { method: 'DELETE' });
    await recargar();
    setOcupado(null);
  }

  const necesitaAtencion = (e: EquipoRow) => e.location === null || e.publicacion === 'por_revisar' || e.tipoId === null;

  /*
   * Los filtros se aplican por capas para que cada conteo diga cuántos hay con
   * lo DEMÁS elegido: las pestañas cuentan sin la categoría; la barra de
   * estados, con categoría, tipo y aliado pero sin el estado.
   */
  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    return equipos.filter((e) => {
      if (soloAtencion && !necesitaAtencion(e)) return false;
      if (aliado && String(e.providerId) !== aliado) return false;
      if (!q) return true;
      return [e.name, e.location ?? '', e.provider ?? '', e.category ?? '', e.tipo ?? ''].some((t) => t.toLowerCase().includes(q));
    });
  }, [equipos, query, soloAtencion, aliado]);

  const deLaCategoria = useMemo(
    () => (cat === 'todas' ? base : base.filter((e) => String(e.categoryId) === cat)),
    [base, cat],
  );
  const sinEstado = useMemo(
    () => (tipo ? deLaCategoria.filter((e) => (tipo === SIN_TIPO ? e.tipoId === null : e.tipo === tipo)) : deLaCategoria),
    [deLaCategoria, tipo],
  );
  const filtrados = useMemo(
    () => (soloEstado ? sinEstado.filter((e) => !porPublicar(e) && (e.porEstado[soloEstado] ?? 0) > 0) : sinEstado),
    [sinEstado, soloEstado],
  );

  // Barra de estados: unidades en cada estado (en 0 se ven apagados).
  const porEstado = useMemo(() => sumaEstados(sinEstado), [sinEstado]);

  // Agrupados por tipo, en el orden de las pestañas y luego por nombre.
  const grupos = useMemo(() => {
    const ordenCat = new Map(datos.categorias.map((c, i) => [c.id, i]));
    const m = new Map<string, Grupo>();
    for (const e of filtrados) {
      const clave = e.tipoId !== null ? `t${e.tipoId}` : `sin${e.categoryId}`;
      const g = m.get(clave) ?? {
        clave, tipoId: e.tipoId, nombre: e.tipo ?? 'Por clasificar', categoria: e.category, cotizador: e.cotizador, equipos: [],
      };
      g.equipos.push(e);
      m.set(clave, g);
    }
    const catDe = (g: Grupo) => ordenCat.get(g.equipos[0].categoryId) ?? 999;
    return [...m.values()].sort((a, b) => catDe(a) - catDe(b) || Number(a.tipoId === null) - Number(b.tipoId === null) || a.nombre.localeCompare(b.nombre, 'es'));
  }, [filtrados, datos.categorias]);

  // Con un filtro que busca unidades concretas, los tipos se abren solos.
  const abrirTodo = Boolean(query.trim() || aliado || soloEstado || soloAtencion);
  const estaAbierto = (clave: string) => abrirTodo || abiertos.has(clave);
  const alternar = (clave: string) => setAbiertos((prev) => {
    const s = new Set(prev);
    if (s.has(clave)) s.delete(clave); else s.add(clave);
    return s;
  });

  const tiposDisponibles = useMemo(() => {
    const nombres = [...new Set(deLaCategoria.map((e) => e.tipo).filter((t): t is string => t !== null))].sort((a, b) => a.localeCompare(b, 'es'));
    return [
      { value: '', label: 'Todos los tipos' },
      ...nombres.map((n) => ({ value: n, label: n })),
      ...(deLaCategoria.some((e) => e.tipoId === null) ? [{ value: SIN_TIPO, label: 'Por clasificar' }] : []),
    ];
  }, [deLaCategoria]);

  const aliados = useMemo(() => {
    const m = new Map<number, string>();
    for (const e of equipos) if (e.providerId !== null) m.set(e.providerId, e.provider ?? `Aliado ${e.providerId}`);
    return [{ value: '', label: 'Todos los aliados' }, ...[...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es')).map(([id, n]) => ({ value: String(id), label: n }))];
  }, [equipos]);

  // Aliados sin nada dado de alta en la línea elegida (solo sin filtros que los excluyan).
  const sinServicios = useMemo(() => {
    if (aliado || tipo || soloEstado || soloAtencion) return [];
    const q = query.trim().toLowerCase();
    return datos.sinServicios.filter((a) =>
      (cat === 'todas' || a.categoryIds.includes(Number(cat))) && (!q || a.name.toLowerCase().includes(q)),
    );
  }, [datos.sinServicios, aliado, tipo, soloEstado, soloAtencion, query, cat]);

  const elegirCat = (c: string) => { setCat(c); setTipo(''); };

  const total = sumaEstados(equipos);
  const unidades = equipos.reduce((s, e) => s + e.unidades, 0);
  const libres = total.disponible ?? 0;
  const ocupadas = (total.reservado ?? 0) + (total['en-traslado'] ?? 0) + (total['en-servicio'] ?? 0);
  const enMantenimiento = total.mantenimiento ?? 0;
  const sinUbicacion = equipos.filter((e) => e.location === null).length;
  const unidadesDe = (lista: EquipoRow[]) => lista.reduce((s, e) => s + e.unidades, 0);

  return (
    <div>
      <style>{`
        .av-leyenda { display: flex; flex-wrap: wrap; gap: 6px; margin: -4px 0 14px; }
        .av-ley {
          display: inline-flex; align-items: center; gap: 7px; height: 30px; padding: 0 11px; border-radius: 999px; cursor: pointer;
          border: 1px solid var(--adm-border-strong); background: transparent; color: var(--adm-text-2);
          font: inherit; font-size: 12.5px; font-weight: 500; transition: background .15s ease, border-color .15s ease;
        }
        .av-ley:hover { background: rgba(var(--adm-ink), 0.04); }
        .av-ley[aria-pressed="true"] { border-color: color-mix(in srgb, var(--av-c) 60%, transparent); background: color-mix(in srgb, var(--av-c) 14%, transparent); color: var(--adm-text); }
        .av-ley-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--av-c); flex-shrink: 0; }
        .av-ley-n { color: var(--adm-faint); font-size: 12px; }
        .av-ley-quitar { color: var(--adm-muted); border-style: dashed; }
        .av-ley:disabled { opacity: .4; cursor: default; }
        .av-ley:disabled:hover { background: transparent; }
        .av-cats { overflow-x: auto; margin-bottom: 12px; }
        /* Renglón del tipo: nombre y resumen a la izquierda, Cotizar y abrir a la derecha. */
        .av-tipo { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 14px; align-items: center; }
        .av-tipo-abrir { display: flex; gap: 12px; align-items: flex-start; min-width: 0; text-align: left; background: none; border: 0; padding: 0; color: inherit; font: inherit; cursor: pointer; }
        .av-tipo-abrir .ph-caret-right { margin-top: 3px; color: var(--adm-muted); transition: transform .15s ease; }
        .av-tipo-abrir[aria-expanded="true"] .ph-caret-right { transform: rotate(90deg); }
        .av-resumen { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; margin-top: 4px; font-size: 12.5px; color: var(--adm-text-2); }
        .av-resumen > span { display: inline-flex; align-items: center; gap: 6px; }
        .av-aliados { margin-top: 3px; font-size: 12.5px; color: var(--adm-muted); }
        .av-unidades { border-top: 1px solid var(--adm-border); background: rgba(var(--adm-ink), 0.015); }
        .av-unidad { padding: 12px 18px 12px 46px; border-top: 1px solid var(--adm-border); }
        .av-unidad:first-child { border-top: 0; }
        .av-main { display: grid; grid-template-columns: minmax(0, 1fr) 170px auto; gap: 16px; align-items: center; }
        .av-quien { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; margin-top: 3px; font-size: 12.5px; color: var(--adm-text-2); }
        .av-quien > span + span::before { content: '·'; margin-right: 10px; color: var(--adm-faint); }
        /* En móvil se apila: nombre y datos arriba, estado y botones debajo. */
        @media (max-width: 900px) {
          .av-tipo { grid-template-columns: 1fr; }
          .av-unidad { padding-left: 18px; }
          .av-main { display: flex; flex-wrap: wrap; gap: 8px 12px; }
          .av-main > .av-name { flex: 1 1 100%; }
          .av-main > .av-actions { margin-left: auto; }
        }
      `}</style>

      <PageHeader
        eyebrow="2 · Cotizar"
        title="Disponibilidad"
        subtitle="Todos los equipos de los aliados, por tipo: cuántas unidades hay y cómo están hoy. Las reservas se ponen y se quitan solas con los servicios; el mantenimiento lo marca el aliado desde su portal o tú con «Editar». Desde aquí también empiezas una cotización."
      />

      <Stats>
        <Stat label="Unidades" icon="ph-wrench" tone="accent" value={unidades} />
        <Stat label="Libres hoy" icon="ph-check-circle" tone={libres > 0 ? 'ok' : 'muted'} value={libres} />
        <Stat label="Ocupadas hoy" icon="ph-lock-simple" tone={ocupadas > 0 ? 'accent' : 'muted'} value={ocupadas} />
        <Stat label="En mantenimiento" icon="ph-wrench" tone={enMantenimiento > 0 ? 'warn' : 'muted'} value={enMantenimiento} valueTone={enMantenimiento > 0 ? 'warn' : undefined} />
        <Stat label="Sin ubicación" icon="ph-map-pin" tone={sinUbicacion > 0 ? 'warn' : 'muted'} value={sinUbicacion} valueTone={sinUbicacion > 0 ? 'warn' : undefined} />
      </Stats>

      {/* Por categoría (2026-10-26): cuántas unidades de aliados hay en cada línea. */}
      <div className="av-cats">
        <Segmented<string>
          ariaLabel="Filtrar por categoría"
          value={cat}
          onChange={elegirCat}
          items={[
            { key: 'todas', label: 'Todas', count: unidadesDe(base) },
            ...datos.categorias.map((c) => ({ key: String(c.id), label: c.name, count: unidadesDe(base.filter((e) => e.categoryId === c.id)) })),
          ]}
        />
      </div>

      <Toolbar end={<span className="adm-num">{grupos.length} {grupos.length === 1 ? 'tipo' : 'tipos'} · {unidadesDe(filtrados)} unidades</span>}>
        <SearchBox placeholder="Buscar equipo, aliado, tipo o ubicación…" aria-label="Buscar equipo, aliado, tipo o ubicación" value={query} onChange={(e) => setQuery(e.target.value)} />
        <AdminSelect size="sm" className="w-auto min-w-[190px] h-9" ariaLabel="Filtrar por tipo" value={tipo} onChange={setTipo} options={tiposDisponibles} />
        <AdminSelect size="sm" className="w-auto min-w-[190px] h-9" ariaLabel="Filtrar por aliado" value={aliado} onChange={setAliado} options={aliados} />
        <Switch on={soloAtencion} onClick={() => setSoloAtencion((v) => !v)} label="Solo los que necesitan atención" />
      </Toolbar>

      {/* Los estados, siempre a la vista: el color de cada uno, cuántas unidades, y un clic filtra. */}
      <div className="av-leyenda" role="group" aria-label="Filtrar por estado">
        {ESTADOS_UNIDAD.map((estado) => {
          const p = presentacionEstado(estado);
          const n = porEstado[estado] ?? 0;
          const activo = soloEstado === estado;
          return (
            <button
              key={estado}
              type="button"
              className="av-ley"
              aria-pressed={activo}
              disabled={n === 0 && !activo}
              style={{ '--av-c': colorVivo(p) } as React.CSSProperties}
              onClick={() => setSoloEstado(activo ? null : estado)}
              title={p.nota}
            >
              <span className="av-ley-dot" aria-hidden />
              {p.nombre}
              <span className="adm-num av-ley-n">{n}</span>
            </button>
          );
        })}
        {soloEstado ? (
          <button type="button" className="av-ley av-ley-quitar" onClick={() => setSoloEstado(null)}>
            <i className="ph ph-x" aria-hidden />Ver todos
          </button>
        ) : null}
      </div>

      <Panel flush clip>
        {grupos.map((g) => {
          const abierto = estaAbierto(g.clave);
          const suma = sumaEstados(g.equipos);
          const nUnidades = unidadesDe(g.equipos);
          const nPorPublicar = unidadesDe(g.equipos.filter(porPublicar));
          // Quién lo tiene y cuántas: "Rentas Norte (5) · Maquinaria Sur (1)".
          const porAliado = new Map<string, number>();
          for (const e of g.equipos) porAliado.set(e.provider ?? 'Aliado', (porAliado.get(e.provider ?? 'Aliado') ?? 0) + e.unidades);
          return (
            <div key={g.clave} className="adm-trow" style={{ padding: 0 }}>
              <div className="av-tipo" style={{ padding: '14px 18px' }}>
                <button type="button" className="av-tipo-abrir" aria-expanded={abierto} onClick={() => alternar(g.clave)}>
                  <i className="ph ph-caret-right" aria-hidden />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="adm-cell-title" style={g.tipoId === null ? { color: 'var(--adm-warn)' } : undefined}>{g.nombre}</span>
                      <span style={{ fontSize: 12.5, color: 'var(--adm-faint)' }}>{g.categoria}</span>
                    </span>
                    <span className="av-resumen">
                      <span style={{ color: 'var(--adm-text)', fontWeight: 600 }}>{nUnidades} {nUnidades === 1 ? 'unidad' : 'unidades'}</span>
                      {ESTADOS_UNIDAD.filter((s) => (suma[s] ?? 0) > 0).map((s) => (
                        <span key={s} style={{ color: colorEstado(s) }}>
                          <span className="av-ley-dot" style={{ '--av-c': colorEstado(s) } as React.CSSProperties} aria-hidden />
                          {contar(s, suma[s] ?? 0)}
                        </span>
                      ))}
                      {nPorPublicar > 0 ? (
                        <span style={{ color: 'var(--adm-warn)' }}>{nPorPublicar} {nPorPublicar === 1 ? 'nuevo' : 'nuevos'}</span>
                      ) : null}
                    </span>
                    <span className="av-aliados" style={{ display: 'block' }}>
                      {[...porAliado.entries()].map(([n, u]) => `${n} (${u})`).join(' · ')}
                    </span>
                  </span>
                </button>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  {g.cotizador && g.tipoId !== null ? (
                    <Btn size="sm" icon="ph-calculator" href={`/cotizador/${g.cotizador}?tipo=${g.tipoId}`} title={`Abrir el cotizador de ${g.cotizador} con ${g.nombre}`}>
                      Cotizar
                    </Btn>
                  ) : null}
                </div>
              </div>

              {abierto ? (
                <div className="av-unidades">
                  {g.equipos.map((e) => {
                    const est = presentacionEstado(e.state);
                    const open = editando === e.id;
                    const reparto = Object.entries(e.porEstado).filter(([, n]) => (n ?? 0) > 0);
                    return (
                      <div key={e.id} className="av-unidad" style={{ opacity: ocupado === e.id ? 0.6 : 1 }}>
                        <div className="av-main">
                          <div className="av-name" style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                              <span className="adm-cell-title adm-ellipsis">{e.name}</span>
                              {e.publicacion === 'por_revisar' ? (
                                <Link href="/catalogo/servicios" title="No está en la lista de tipos: se decide en Inventario." style={{ textDecoration: 'none', flexShrink: 0 }}>
                                  <Chip tone="warn">Nuevo</Chip>
                                </Link>
                              ) : e.publicacion === 'baja' ? (
                                <Chip tone="muted" title="Dado de baja en el catálogo: no se ofrece." style={{ flexShrink: 0 }}>Dado de baja</Chip>
                              ) : null}
                            </div>
                            <div className="av-quien">
                              <span style={{ color: 'var(--adm-text)', fontWeight: 500 }}>{e.provider ?? 'Aliado sin nombre'}</span>
                              {e.location ? (
                                <span><i className="ph ph-map-pin" aria-hidden style={{ marginRight: 4 }} />{e.location}</span>
                              ) : (
                                <span style={{ color: 'var(--adm-warn)' }}>sin ubicación</span>
                              )}
                              <span style={{ color: 'var(--adm-faint)' }}>
                                {e.unidades === 1 ? '1 unidad' : `${e.unidades} unidades: ${reparto.map(([s, n]) => contar(s, n ?? 0)).join(', ')}`}
                              </span>
                            </div>
                          </div>
                          <div>
                            {porPublicar(e) ? (
                              <StatusText tone="warn" title="No está en la lista de tipos: se decide en Inventario">NUEVO</StatusText>
                            ) : (
                              <StatusText color={colorVivo(est)} title={est.nota}>{est.etiqueta}</StatusText>
                            )}
                            {e.until ? <div style={{ fontSize: 12, color: 'var(--adm-faint)', marginTop: 2 }}>hasta el {e.until}</div> : null}
                          </div>
                          <div className="av-actions" style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <Btn
                              size="sm"
                              variant="ghost"
                              icon={open ? 'ph-caret-up' : 'ph-pencil-simple'}
                              aria-expanded={open}
                              onClick={() => { setEditando(open ? null : e.id); setUbicacion(e.location ?? ''); }}
                            >
                              {open ? 'Cerrar' : 'Editar'}
                            </Btn>
                          </div>
                        </div>

                        {e.blocks.length > 0 ? (
                          <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                            {e.blocks.map((b) => (
                              <div key={b.id} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, columnGap: 10, fontSize: 12.5, color: 'var(--adm-muted)' }}>
                                {/* Cada bloqueo con el color de SU estado; una próxima, atenuada. */}
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: colorEstado(b.state), opacity: b.upcoming ? 0.75 : 1, fontWeight: 500 }}>
                                  <i className={`ph ${b.upcoming ? 'ph-calendar-check' : 'ph-lock-simple'}`} aria-hidden />
                                  {b.upcoming ? 'PRÓXIMA · ' : ''}{presentacionEstado(b.state).etiqueta}
                                </span>
                                <span className="adm-num">{b.startsOn} → {b.endsOn ?? 'sin fecha de retorno'}</span>
                                {b.folio ? (
                                  <span style={{ color: 'var(--adm-faint)' }}>· automática, servicio <span className="adm-num">{b.folio}</span></span>
                                ) : b.note ? <span style={{ color: 'var(--adm-faint)' }}>· {b.note}</span> : null}
                                {b.folio && porLiberar === b.id ? (
                                  <>
                                    <span style={{ color: 'var(--adm-warn)' }}>El servicio ya no la volverá a apartar.</span>
                                    <Btn size="sm" variant="ghost" onClick={() => liberar(b.id, e.id)}>Sí, liberar</Btn>
                                    <Btn size="sm" variant="ghost" onClick={() => setPorLiberar(null)}>No</Btn>
                                  </>
                                ) : (
                                  <Btn size="sm" variant="ghost" onClick={() => (b.folio ? setPorLiberar(b.id) : liberar(b.id, e.id))}>Liberar</Btn>
                                )}
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
                              <FormField label="Desde"><AdminDatePicker value={desde} onChange={setDesde} max={hasta || undefined} required /></FormField>
                              <FormField label="Hasta (opcional)"><AdminDatePicker value={hasta} onChange={setHasta} min={desde || undefined} placeholder="Sin fecha de fin" /></FormField>
                              <FormField label="Nota"><input className="adm-input" placeholder="Servicio de 500 horas" value={nota} onChange={(ev) => setNota(ev.target.value)} /></FormField>
                              <Btn icon="ph-lock-simple" onClick={() => bloquear(e.id)}>Bloquear</Btn>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}

        {grupos.length === 0 ? (
          equipos.length === 0
            ? <EmptyState icon="ph-wrench" title="Ningún aliado ha dado de alta equipos o servicios." />
            : <EmptyState icon="ph-funnel" title="Nada que mostrar con ese filtro." />
        ) : null}
      </Panel>

      {/* Aliados de la red sin nada dado de alta (2026-10-26): no se les puede apartar fecha hasta que lo hagan. */}
      {sinServicios.length > 0 ? (
        <Panel
          title="Aliados sin servicios dados de alta"
          icon="ph-user-circle"
          desc="Están en la red, pero sin equipos registrados no aparecen arriba ni se les puede apartar fecha. Se dan de alta desde su portal (Ofrecer un servicio) o desde su expediente."
          action={<PanelLink href="/proveedores">Proveedores</PanelLink>}
          flush
          style={{ marginTop: 16 }}
        >
          {sinServicios.map((a) => (
            <div key={a.id} className="adm-trow" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span className="adm-cell-title">{a.name}</span>
              <span className="adm-meta">{a.lineas.length ? a.lineas.join(' · ') : 'sin líneas en su expediente'}</span>
            </div>
          ))}
        </Panel>
      ) : null}
    </div>
  );
}
