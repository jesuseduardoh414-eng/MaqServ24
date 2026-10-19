'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bar, Chip, Panel, SearchBox, Segmented, Toolbar, type Tone } from '@/components/ui';
import { MapaCobertura, type PuntoMapa, type RutaMapa } from '@/app/proveedores/MapaCobertura';

export interface UnidadEnCamino {
  quoteId: number;
  folio: string;
  cliente: string;
  servicio: string | null;
  /** El equipo que lleva, de la cotización ("Retroexcavadora c/ cucharón"). */
  equipo: string | null;
  aliado: { id: number; nombre: string; telefono: string | null } | null;
  /** Quien maneja la unidad y comparte la ubicación (2026-10-15). */
  operador?: { nombre: string; telefono: string | null } | null;
  /** Cuándo marcó "Ya salió la unidad". */
  salio: string | null;
  /** La llegada que prometió al aceptar. */
  comprometida: string | null;
  /** De dónde salió: la base del aliado, o el primer punto que mandó si no está ubicada. */
  salida: { lat: number; lng: number; nombre: string } | null;
  obra: { lat: number; lng: number; aproximada: boolean; nombre: string | null; direccion: string | null } | null;
  ultima: { lat: number; lng: number; precision: number | null; at: string } | null;
  recorrido: Array<{ lat: number; lng: number }>;
  km: number | null;
  /** Km del viaje completo, de la salida a la obra. */
  kmTramo: number | null;
  /** Qué tan lejos anda del camino directo entre la salida y la obra. */
  desvioKm: number | null;
  fueraDeRuta: boolean;
}

/** Cada cuánto se vuelve a preguntar dónde van. */
const REFRESCO_MS = 30_000;
/** Sin ubicación nueva en este tiempo: cerró el portal o se quedó sin señal. */
const VIEJA_MIN = 5;
/** Para estimar la llegada: una cama baja con equipo, en tráfico de ciudad. */
const VELOCIDAD_KMH = 35;
/** Minutos de gracia antes de llamarla "retrasada". */
const TOLERANCIA_MIN = 10;
/** A esta distancia o menos ya va "llegando". */
const LLEGANDO_KM = 3;

// Con zona fija: el servidor (UTC en producción) y el navegador escriben la misma hora.
const HORA = new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Monterrey' });
const hora = (t: number | string) => HORA.format(new Date(t));
const duracion = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`);
const hace = (iso: string, ahora: number) => {
  const m = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 60_000));
  return m < 1 ? 'ahora' : `hace ${duracion(m)}`;
};
const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

type Filtro = 'todas' | 'retrasadas' | 'fuera' | 'senal' | 'llegando';

interface Lectura {
  vieja: boolean;
  retrasada: boolean;
  /** Sin ubicación o con una vieja. */
  senal: boolean;
  llegando: boolean;
  /** Hora estimada de llegada (ms), si se sabe dónde va. */
  llega: number | null;
  /** % del viaje hecho, por km. */
  avance: number | null;
  alertas: Array<{ tono: Tone; texto: string; titulo?: string }>;
  /** Para ordenar: lo que hay que atender primero, arriba. */
  gravedad: number;
}

/**
 * Lo que hay que saber de una unidad para contestarle al cliente "¿ya
 * mero?": cuándo llega, si va tarde, si va para otro lado o si se perdió la señal.
 */
function leer(u: UnidadEnCamino, ahora: number): Lectura {
  const at = u.ultima ? new Date(u.ultima.at).getTime() : null;
  const vieja = at != null && ahora - at >= VIEJA_MIN * 60_000;
  // Desde su última ubicación a la velocidad típica; si ya debía haber llegado, lo más pronto es "ya".
  const llega = at != null && u.km != null ? Math.max(at + (u.km / VELOCIDAD_KMH) * 3_600_000, ahora) : null;
  const prometida = u.comprometida ? new Date(u.comprometida).getTime() : null;
  // Sin ubicación no hay estimado, pero si ya pasó la hora prometida, va tarde igual.
  const retrasoMin = prometida != null ? Math.round(((llega ?? ahora) - prometida) / 60_000) : null;
  const retrasada = prometida != null && retrasoMin != null && retrasoMin >= TOLERANCIA_MIN;
  const senal = !u.ultima || vieja;
  const llegando = !senal && u.km != null && u.km <= LLEGANDO_KM;
  const avance = u.kmTramo && u.km != null ? Math.round(Math.max(0, Math.min(1, 1 - u.km / u.kmTramo)) * 100) : null;

  const alertas: Lectura['alertas'] = [];
  if (retrasada) {
    alertas.push({
      tono: 'bad',
      texto: llega == null ? `Ya debió llegar · ${duracion(retrasoMin)} tarde` : `Retrasada ~${duracion(retrasoMin)}`,
      titulo: `Prometió llegar a las ${hora(prometida)}`,
    });
  }
  if (u.fueraDeRuta) {
    alertas.push({ tono: 'bad', texto: `Fuera de ruta · a ${u.desvioKm} km del camino`, titulo: 'Anda lejos del camino entre la salida y la obra' });
  }
  if (!u.ultima) alertas.push({ tono: 'warn', texto: 'No comparte su ubicación', titulo: 'El aliado no ha abierto su portal en el teléfono' });
  else if (vieja) alertas.push({ tono: 'warn', texto: `Sin señal · ${hace(u.ultima.at, ahora)}`, titulo: 'Cerró el portal o se quedó sin señal' });
  if (llegando) alertas.push({ tono: 'ok', texto: 'Llegando' });
  if (prometida != null && !retrasada && llega != null) alertas.push({ tono: 'ok', texto: 'A tiempo', titulo: `Prometió llegar a las ${hora(prometida)}` });

  return {
    vieja, retrasada, senal, llegando, llega, avance, alertas,
    gravedad: (retrasada ? 4 : 0) + (u.fueraDeRuta ? 3 : 0) + (senal ? 2 : 0),
  };
}

const PASA: Record<Filtro, (u: UnidadEnCamino, l: Lectura) => boolean> = {
  todas: () => true,
  retrasadas: (_u, l) => l.retrasada,
  fuera: (u) => u.fueraDeRuta,
  senal: (_u, l) => l.senal,
  llegando: (_u, l) => l.llegando,
};

/**
 * EN CAMINO (2026-10-14) — de dónde salió, a dónde va, por dónde va y qué tan
 * bien va. Pensado para la llamada del cliente: se busca por su nombre, folio,
 * equipo u obra y se ve si va a tiempo. Se actualiza solo cada 30 segundos.
 * La ubicación la manda el teléfono del aliado desde su portal (quotes/rastreo.ts).
 */
export function UnidadesEnCamino({
  inicial,
  ahora: ahoraServidor,
}: {
  inicial: UnidadEnCamino[];
  /** La hora del servidor: así el primer dibujo sale igual en el servidor y en el navegador. */
  ahora: number;
}) {
  const [unidades, setUnidades] = useState(inicial);
  const [ahora, setAhora] = useState(ahoraServidor);
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [sel, setSel] = useState<number | null>(null);

  useEffect(() => {
    setAhora(Date.now());
    const t = setInterval(async () => {
      const r = await fetch('/api/admin/rastreo', { cache: 'no-store' }).catch(() => null);
      if (r?.ok) setUnidades(((await r.json()) as { unidades: UnidadEnCamino[] }).unidades);
      setAhora(Date.now()); // "hace N min" y la hora estimada se recalculan aunque no haya punto nuevo.
    }, REFRESCO_MS);
    return () => clearInterval(t);
  }, []);

  const destino = (u: UnidadEnCamino) => u.obra?.nombre ?? u.cliente;

  const lecturas = useMemo(() => new Map(unidades.map((u) => [u.quoteId, leer(u, ahora)])), [unidades, ahora]);
  const de = (u: UnidadEnCamino) => lecturas.get(u.quoteId)!;

  // Primero la búsqueda (los conteos de los filtros son de lo que se buscó), luego el filtro.
  const buscadas = useMemo(() => {
    const t = normal(q.trim());
    if (!t) return unidades;
    return unidades.filter((u) =>
      normal([u.folio, u.cliente, u.equipo, u.servicio, u.aliado?.nombre, u.aliado?.telefono, u.obra?.nombre, u.obra?.direccion].filter(Boolean).join(' ')).includes(t),
    );
  }, [unidades, q]);
  const cuenta = (f: Filtro) => buscadas.filter((u) => PASA[f](u, de(u))).length;
  const visibles = buscadas
    .filter((u) => PASA[filtro](u, de(u)))
    .sort((a, b) => de(b).gravedad - de(a).gravedad || (a.km ?? 1e9) - (b.km ?? 1e9));
  const elegida = sel != null ? visibles.find((u) => u.quoteId === sel) ?? null : null;

  // El mapa se rehace solo cuando cambian las unidades que enseña o llega un
  // punto nuevo, no a cada tecla de la búsqueda.
  const enMapa = elegida ? [elegida] : visibles;
  const claveMapa = enMapa.map((u) => u.quoteId).join(',');

  // Tres puntos por unidad: de dónde salió, a dónde va y por dónde va ahora
  // (esa al final, para que quede encima de las otras).
  const puntos = useMemo<PuntoMapa[]>(() => {
    const p: PuntoMapa[] = [];
    for (const u of enMapa) {
      if (u.salida) {
        p.push({
          id: 2_000_000 + u.quoteId, nombre: `Salida · ${u.salida.nombre}`, lat: u.salida.lat, lng: u.salida.lng, tipo: 'salida',
          detalle: u.salio ? `Salió a las ${hora(u.salio)}` : null, etiqueta: 'Salida',
        });
      }
      if (u.obra) {
        p.push({
          id: 1_000_000 + u.quoteId, nombre: `Destino · ${destino(u)}`, lat: u.obra.lat, lng: u.obra.lng, tipo: 'obra',
          detalle: [u.obra.direccion, u.cliente].filter(Boolean).join(' · '), etiqueta: 'Destino',
        });
      }
      if (u.ultima) {
        p.push({
          id: u.quoteId, nombre: u.aliado?.nombre ?? 'Unidad', lat: u.ultima.lat, lng: u.ultima.lng, tipo: 'unidad',
          detalle: [u.equipo, u.km != null ? `Faltan ${u.km} km` : null, `ubicación de ${hace(u.ultima.at, ahora)}`].filter(Boolean).join(' · '),
          etiqueta: de(u).vieja ? `Última señal · ${hace(u.ultima.at, ahora)}` : 'Va aquí',
        });
      }
    }
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidades, claveMapa]);
  // Lo recorrido sale de la base y sigue los puntos del teléfono; lo que falta va de
  // la última ubicación (o de la base, si aún no comparte) a la obra.
  const rutas = useMemo<RutaMapa[]>(() => enMapa.flatMap((u) => {
    const hecho: Array<[number, number]> = [
      ...(u.salida ? [[u.salida.lat, u.salida.lng] as [number, number]] : []),
      ...u.recorrido.map((r) => [r.lat, r.lng] as [number, number]),
    ];
    const desde = u.ultima ?? u.salida;
    const falta: Array<[number, number]> = desde && u.obra ? [[desde.lat, desde.lng], [u.obra.lat, u.obra.lng]] : [];
    return [{ linea: hecho }, { linea: falta, falta: true }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [unidades, claveMapa]);

  if (unidades.length === 0) return null;

  // Un filtro con algo adentro se pinta de su color: se ve sin tener que contar.
  const filtroItem = (key: Filtro, texto: string, tono: Tone) => {
    const n = cuenta(key);
    return { key, count: n, label: n > 0 ? <span className={`t-${tono} adm-tone`}>{texto}</span> : texto };
  };
  const elegir = (id: number) => setSel((s) => (s === id ? null : id));

  return (
    <Panel
      title={`En camino (${unidades.length})`}
      icon="ph-truck"
      action={
        <span style={{ display: 'flex', gap: 14, fontSize: 12.5, color: 'var(--adm-muted)' }}>
          <span><Punto color="#22A06B" />Salida</span>
          <span><Punto color="#008CFF" />Unidad</span>
          <span><Punto color="#E0A32E" />Destino</span>
        </span>
      }
    >
      <Toolbar>
        <SearchBox
          value={q}
          onChange={(e) => { setQ(e.target.value); setSel(null); }}
          placeholder="Cliente, folio, equipo, aliado u obra…"
          aria-label="Buscar unidad en camino"
        />
        <Segmented<Filtro>
          ariaLabel="Filtrar unidades en camino"
          value={filtro}
          onChange={(f) => { setFiltro(f); setSel(null); }}
          items={[
            { key: 'todas', label: 'Todas', count: buscadas.length },
            filtroItem('retrasadas', 'Retrasadas', 'bad'),
            filtroItem('fuera', 'Fuera de ruta', 'bad'),
            filtroItem('senal', 'Sin señal', 'warn'),
            filtroItem('llegando', 'Llegando', 'ok'),
          ]}
        />
      </Toolbar>

      <div style={{ position: 'relative' }}>
        <MapaCobertura puntos={puntos} rutas={rutas} alto={320} />
        {elegida ? (
          <button
            type="button"
            onClick={() => setSel(null)}
            className="adm-chip"
            style={{ position: 'absolute', top: 10, right: 10, zIndex: 1, cursor: 'pointer', height: 28, background: 'var(--adm-raised)', border: '1px solid var(--adm-border-strong)', color: 'var(--adm-text)' }}
          >
            <i className="ph ph-arrows-out" aria-hidden /> Ver todas en el mapa
          </button>
        ) : null}
      </div>

      <div style={{ display: 'grid', marginTop: 12 }}>
        {visibles.length === 0 ? (
          <div style={{ padding: '14px 0', fontSize: 13.5, color: 'var(--adm-muted)', borderTop: '1px solid var(--adm-border)' }}>
            Ninguna unidad con {q.trim() ? 'esa búsqueda' : 'este filtro'}.
          </div>
        ) : null}
        {visibles.map((u) => {
          const l = de(u);
          const activa = sel === u.quoteId;
          const mal = l.retrasada || u.fueraDeRuta;
          return (
            <div
              key={u.quoteId}
              role="button"
              tabIndex={0}
              aria-pressed={activa}
              title={activa ? 'Volver a ver todas en el mapa' : 'Ver solo esta en el mapa'}
              onClick={() => elegir(u.quoteId)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(u.quoteId); } }}
              style={{
                display: 'grid', gap: 8, padding: '12px 12px 12px 10px', cursor: 'pointer',
                borderTop: '1px solid var(--adm-border)',
                borderLeft: `3px solid ${activa ? 'var(--adm-accent)' : mal ? 'var(--adm-bad)' : 'transparent'}`,
                background: activa ? 'color-mix(in srgb, var(--adm-accent) 8%, transparent)' : undefined,
              }}
            >
              <div style={{ display: 'flex', gap: '4px 16px', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ minWidth: 0, flex: '1 1 280px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--adm-text)', fontSize: 14 }}>
                    {u.cliente} <span style={{ color: 'var(--adm-muted)', fontWeight: 400 }}>→ {destino(u)}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--adm-muted)' }}>
                    {[u.folio, u.equipo ?? u.servicio].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--adm-muted)' }}>
                    {u.operador ? (
                      <>
                        Operador {u.operador.nombre}
                        {u.operador.telefono ? <> · <a href={`tel:${u.operador.telefono}`} onClick={(e) => e.stopPropagation()} style={{ color: 'inherit' }}>{u.operador.telefono}</a></> : null}
                        {' · '}
                      </>
                    ) : null}
                    {u.aliado?.nombre ?? 'Sin aliado'}
                    {u.aliado?.telefono ? (
                      <> · <a href={`tel:${u.aliado.telefono}`} onClick={(e) => e.stopPropagation()} style={{ color: 'inherit' }}>{u.aliado.telefono}</a></>
                    ) : null}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--adm-text)', fontVariantNumeric: 'tabular-nums' }}>
                    {!u.ultima ? 'Sin ubicación' : u.km != null ? `Faltan ${u.km} km` : 'En camino'}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--adm-muted)' }}>
                    {l.llega == null
                      ? u.comprometida ? `Prometió llegar ${hora(u.comprometida)}` : null
                      : l.llega - ahora < 60_000 ? 'Debería estar llegando' : `Llega aprox. ${hora(l.llega)} · en ${duracion(Math.round((l.llega - ahora) / 60_000))}`}
                  </div>
                </div>
              </div>

              {l.avance != null ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--adm-muted)' }}>
                  <div style={{ flex: 1 }}>
                    <Bar pct={l.avance} tone={mal ? 'bad' : l.llegando ? 'ok' : 'accent'} width="100%" label={`${l.avance}% del camino`} />
                  </div>
                  <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{l.avance}% de {u.kmTramo} km</span>
                </div>
              ) : null}

              {l.alertas.length ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {l.alertas.map((a) => <Chip key={a.texto} tone={a.tono} title={a.titulo}>{a.texto}</Chip>)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function Punto({ color }: { color: string }) {
  return <i aria-hidden style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: color, marginRight: 6 }} />;
}
