'use client';

import { useEffect, useMemo, useState } from 'react';
import { useModoClaro } from '@/components/modo';
import { Panel, SearchBox, Toolbar, type Tone } from '@/components/ui';
import { MapaCobertura, type PuntoMapa, type RutaMapa } from '@/app/proveedores/MapaCobertura';

/** Un camino por calles con sus km y minutos reales (apps/api/src/common/rutas.ts). */
export interface RutaCalles { linea: Array<[number, number]>; km: number; min: number }

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
  /** Km que faltan en línea recta (respaldo si no hay ruta por calles). */
  km: number | null;
  /** Km del viaje completo, de la salida a la obra. */
  kmTramo: number | null;
  /** Qué tan lejos anda del camino directo entre la salida y la obra. */
  desvioKm: number | null;
  fueraDeRuta: boolean;
  /** Lo que le falta, por calles (2026-10-26); null: se dibuja en línea recta. */
  rutaFalta?: RutaCalles | null;
}

type Obra = NonNullable<UnidadEnCamino['obra']>;

/** Asignado (aún no sale), en obra o trabajando: de la base del aliado a la obra (2026-10-26). */
export interface ServicioActivo {
  quoteId: number;
  folio: string;
  etapa: 'asignado' | 'en_sitio' | 'en_curso';
  cliente: string;
  equipo: string | null;
  aliado: { id: number; nombre: string; telefono: string | null } | null;
  operador?: { nombre: string; telefono: string | null } | null;
  comprometida: string | null;
  base: { lat: number; lng: number; nombre: string } | null;
  obra: Obra | null;
  /** De la base a la obra, por calles; null: línea recta. */
  ruta?: RutaCalles | null;
}

/** Aceptado que espera aliado: solo la obra. */
export interface PorAsignarMapa { quoteId: number; folio: string; cliente: string; equipo: string | null; obra: Obra | null }

/** La red: la base de cada aliado ubicado y hasta dónde llega. */
export interface AliadoMapa { id: number; nombre: string; lat: number; lng: number; radioKm: number | null; ciudad: string | null }

/** Lo que manda `GET /admin/rastreo`. */
export interface Rastreo {
  unidades: UnidadEnCamino[];
  activos?: ServicioActivo[];
  porAsignar?: PorAsignarMapa[];
  aliados?: AliadoMapa[];
}

/** Cada cuánto se vuelve a preguntar dónde van. */
const REFRESCO_MS = 30_000;
/** Sin ubicación nueva en este tiempo: cerró el portal o se quedó sin señal. */
const VIEJA_MIN = 5;
/** Sin ruta por calles, para estimar la llegada: una cama baja con equipo, en tráfico de ciudad. */
const VELOCIDAD_KMH = 35;
/** Minutos de gracia antes de llamarla "retrasada". */
const TOLERANCIA_MIN = 10;
/** A esta distancia o menos ya va "llegando". */
const LLEGANDO_KM = 3;

/**
 * Los colores de cada etapa en el mapa. Los mismos tonos que Disponibilidad
 * usa para reservado / en traslado / en servicio, para que se lean igual.
 */
const ETAPA = {
  // `claro` (2026-10-28): en modo claro los tonos del modo oscuro no se leían sobre blanco (1.7–2.9:1).
  asignado: { nombre: 'Asignado', oscuro: '#A78BFA', claro: '#6D28D9' },
  en_traslado: { nombre: 'En camino', oscuro: '#008CFF', claro: '#1D4ED8' },
  en_sitio: { nombre: 'En obra', oscuro: '#2DD4BF', claro: '#0F766E' },
  en_curso: { nombre: 'Trabajando', oscuro: '#2DD4BF', claro: '#0F766E' },
  por_asignar: { nombre: 'Por asignar', oscuro: '#E0A32E', claro: '#A16207' },
} as const;
type Etapa = keyof typeof ETAPA;
const COLOR_BASE = '#22A06B';

/** El color de cada etapa, el mismo en el mapa y en las tarjetas de Servicios (2026-10-26). */
// Variables de globals.css (--etapa-*): cambian solas con el modo.
export const COLOR_ETAPA: Record<string, string> = {
  por_asignar: 'var(--etapa-espera)',
  asignado: 'var(--etapa-asignado)',
  en_traslado: 'var(--etapa-camino)',
  en_sitio: 'var(--etapa-obra)',
  en_curso: 'var(--etapa-obra)',
  terminado: 'var(--etapa-terminado)',
  cerrado: 'var(--etapa-cerrado)',
  cancelado: 'var(--etapa-cancelado)',
};

// Con zona fija: el servidor (UTC en producción) y el navegador escriben la misma hora.
const HORA = new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Monterrey' });
const hora = (t: number | string) => HORA.format(new Date(t));
const duracion = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`);
const hace = (iso: string, ahora: number) => {
  const m = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 60_000));
  return m < 1 ? 'ahora' : `hace ${duracion(m)}`;
};
const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

type Capa = 'camino' | 'asignados' | 'obra' | 'porAsignar' | 'aliados';

/**
 * Lo que hay que saber de una unidad en camino para contestarle al cliente
 * "¿ya mero?": cuánto le falta, a qué hora llega y si algo anda mal (va tarde,
 * va para otro lado o se perdió la señal). Lo usa la tarjeta del servicio.
 */
export function enCaminoDe(u: UnidadEnCamino, ahora: number): { texto: string; alertas: Array<{ tono: Tone; texto: string; titulo?: string }> } {
  const at = u.ultima ? new Date(u.ultima.at).getTime() : null;
  const vieja = at != null && ahora - at >= VIEJA_MIN * 60_000;
  // Por calles si se sabe; si no, en línea recta a la velocidad típica.
  const km = u.rutaFalta?.km ?? u.km;
  const min = u.rutaFalta ? u.rutaFalta.min : km != null ? Math.round((km / VELOCIDAD_KMH) * 60) : null;
  const llega = at != null && min != null ? Math.max(at + min * 60_000, ahora) : null;
  const prometida = u.comprometida ? new Date(u.comprometida).getTime() : null;
  // Sin ubicación no hay estimado, pero si ya pasó la hora prometida, va tarde igual.
  const retrasoMin = prometida != null ? Math.round(((llega ?? ahora) - prometida) / 60_000) : null;
  const retrasada = prometida != null && retrasoMin != null && retrasoMin >= TOLERANCIA_MIN;
  const senal = !u.ultima || vieja;
  const llegando = !senal && km != null && km <= LLEGANDO_KM;

  const alertas: Array<{ tono: Tone; texto: string; titulo?: string }> = [];
  if (retrasada) {
    alertas.push({
      tono: 'bad',
      texto: llega == null ? `Ya debió llegar · ${duracion(retrasoMin)} tarde` : `Retrasada ~${duracion(retrasoMin)}`,
      titulo: `Prometió llegar a las ${hora(prometida)}`,
    });
  }
  if (u.fueraDeRuta) alertas.push({ tono: 'bad', texto: `Fuera de ruta · a ${u.desvioKm} km del camino`, titulo: 'Anda lejos del camino entre la salida y la obra' });
  if (!u.ultima) alertas.push({ tono: 'warn', texto: 'No comparte su ubicación', titulo: 'El aliado no ha abierto su portal en el teléfono' });
  else if (vieja) alertas.push({ tono: 'warn', texto: `Sin señal · ${hace(u.ultima.at, ahora)}`, titulo: 'Cerró el portal o se quedó sin señal' });
  if (llegando) alertas.push({ tono: 'ok', texto: 'Llegando' });
  else if (prometida != null && !retrasada && llega != null) alertas.push({ tono: 'ok', texto: 'A tiempo', titulo: `Prometió llegar a las ${hora(prometida)}` });

  // Con la señal vieja no se promete hora: se dice de cuándo es el dato.
  const texto = !u.ultima
    ? 'Sin ubicación'
    : `Faltan ${km != null ? `${km} km` : '…'}${vieja ? ` · señal de ${hace(u.ultima.at, ahora)}` : llega != null ? (llega - ahora < 60_000 ? ' · llegando' : ` · llega ${hora(llega)}`) : ''}`;
  return { texto, alertas };
}

/**
 * Los datos del mapa en vivo: se vuelven a pedir cada 30 segundos y cuando la
 * campana refresca la página. Lo usa el tablero de Servicios para el mapa y
 * para la línea "faltan N km" de cada tarjeta.
 */
export function useRastreo(inicial: Rastreo | null): { datos: Rastreo | null; ahora: number } {
  const [datos, setDatos] = useState(inicial);
  useEffect(() => { setDatos(inicial); }, [inicial]);
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!inicial) return;
    const t = setInterval(async () => {
      const r = await fetch('/api/admin/rastreo', { cache: 'no-store' }).catch(() => null);
      if (r?.ok) setDatos((await r.json()) as Rastreo);
      setAhora(Date.now()); // "hace N min" y la hora estimada se recalculan aunque no haya punto nuevo.
    }, REFRESCO_MS);
    return () => clearInterval(t);
  }, [inicial]);
  return { datos, ahora };
}

/** Lo que se lee al tocar un servicio en el mapa: obra, máquina, operador y teléfono. */
function ficha(x: { cliente: string; obra: Obra | null; equipo: string | null; aliado: { nombre: string; telefono: string | null } | null; operador?: { nombre: string; telefono: string | null } | null }, etapa: string, folio: string): string {
  const quien = x.operador
    ? `Operador ${x.operador.nombre}${x.operador.telefono ? ` · ${x.operador.telefono}` : ''}`
    : x.aliado ? `${x.aliado.nombre}${x.aliado.telefono ? ` · ${x.aliado.telefono}` : ''}` : null;
  return [`${etapa} · ${folio}`, x.equipo, quien].filter(Boolean).join(' · ');
}

/**
 * MAPA DE SERVICIOS (2026-10-14 "En camino"; todos los servicios desde el
 * 2026-10-26). Lo que se está trabajando, en un mapa: de la base de cada
 * aliado a su obra, por calles, con el color de su etapa; las unidades en
 * camino con su ubicación en vivo; y como capas, lo que espera aliado y la red
 * de aliados con hasta dónde llega. Va entre los números y las tarjetas de
 * Servicios; lo de cada servicio (faltan N km, retrasada…) está en su tarjeta.
 */
export function MapaServicios({ datos, ahora }: { datos: Rastreo; ahora: number }) {
  const claro = useModoClaro();
  const col = (k: Etapa): string => (claro ? ETAPA[k].claro : ETAPA[k].oscuro);
  const [q, setQ] = useState('');
  // La red de aliados apagada de entrada: es para planear, no para el día a día.
  const [capas, setCapas] = useState<Record<Capa, boolean>>({ camino: true, asignados: true, obra: true, porAsignar: true, aliados: false });
  const alternar = (c: Capa) => setCapas((v) => ({ ...v, [c]: !v[c] }));

  const unidades = datos.unidades;
  const activos = datos.activos ?? [];
  const porAsignar = datos.porAsignar ?? [];
  const aliados = datos.aliados ?? [];

  // La búsqueda vale para todo lo del mapa: cliente, folio, equipo, aliado u obra.
  const t = normal(q.trim());
  const coincide = (partes: Array<string | null | undefined>) => !t || normal(partes.filter(Boolean).join(' ')).includes(t);
  const enCamino = unidades.filter((u) => coincide([u.folio, u.cliente, u.equipo, u.aliado?.nombre, u.operador?.nombre, u.obra?.nombre, u.obra?.direccion]));
  const activosVistos = activos.filter((a) => coincide([a.folio, a.cliente, a.equipo, a.aliado?.nombre, a.operador?.nombre, a.obra?.nombre, a.obra?.direccion]));
  const asignados = activosVistos.filter((a) => a.etapa === 'asignado');
  const enObra = activosVistos.filter((a) => a.etapa !== 'asignado');
  const esperan = porAsignar.filter((p) => coincide([p.folio, p.cliente, p.equipo, p.obra?.nombre, p.obra?.direccion]));
  const red = aliados.filter((a) => coincide([a.nombre, a.ciudad]));
  const nombreObra = (cliente: string, o: Obra | null) => `${o?.nombre ?? cliente}${o?.nombre ? ` · ${cliente}` : ''}`;

  const { puntos, rutas } = useMemo(() => {
    const p: PuntoMapa[] = [];
    const r: RutaMapa[] = [];
    // La red, abajo de todo.
    if (capas.aliados) {
      for (const a of red) p.push({ id: 6_000_000 + a.id, nombre: a.nombre, lat: a.lat, lng: a.lng, tipo: 'aliado', radioKm: a.radioKm, detalle: a.ciudad ? `Base en ${a.ciudad}` : null });
    }
    const servicio = (s: ServicioActivo) => {
      const etapa = ETAPA[s.etapa];
      if (s.base && s.obra) {
        // Por calles si se pudo; si no, en línea recta. Punteada mientras no sale.
        r.push({ linea: s.ruta?.linea ?? [[s.base.lat, s.base.lng], [s.obra.lat, s.obra.lng]], color: col(s.etapa), punteada: s.etapa === 'asignado', ancho: 5 });
      }
      if (s.base) p.push({ id: 4_000_000 + s.quoteId, nombre: `Base de ${s.aliado?.nombre ?? 'el aliado'}`, lat: s.base.lat, lng: s.base.lng, tipo: 'salida', color: COLOR_BASE, icono: 'ph-warehouse', detalle: s.ruta ? `A la obra: ${s.ruta.km} km · ${duracion(s.ruta.min)}` : null });
      if (s.obra) p.push({ id: 3_000_000 + s.quoteId, nombre: nombreObra(s.cliente, s.obra), lat: s.obra.lat, lng: s.obra.lng, tipo: 'obra', color: col(s.etapa), icono: s.etapa === 'asignado' ? 'ph-hard-hat' : 'ph-gear-six', detalle: ficha(s, etapa.nombre, s.folio) });
    };
    if (capas.asignados) asignados.forEach(servicio);
    if (capas.obra) enObra.forEach(servicio);
    if (capas.porAsignar) {
      for (const s of esperan) {
        if (!s.obra) continue;
        p.push({ id: 5_000_000 + s.quoteId, nombre: nombreObra(s.cliente, s.obra), lat: s.obra.lat, lng: s.obra.lng, tipo: 'obra', color: col('por_asignar'), icono: 'ph-hourglass-medium', detalle: [`Por asignar · ${s.folio}`, s.equipo, 'espera aliado'].filter(Boolean).join(' · ') });
      }
    }
    // Las unidades en camino al final, para que queden encima: lo que ya anduvo
    // (continuo, por donde mandó su teléfono) y lo que le falta (punteado, por calles).
    if (capas.camino) {
      for (const u of enCamino) {
        const hecho: Array<[number, number]> = [
          ...(u.salida ? [[u.salida.lat, u.salida.lng] as [number, number]] : []),
          ...u.recorrido.map((x) => [x.lat, x.lng] as [number, number]),
        ];
        const desde = u.ultima ?? u.salida;
        const falta: Array<[number, number]> = u.rutaFalta?.linea ?? (desde && u.obra ? [[desde.lat, desde.lng], [u.obra.lat, u.obra.lng]] : []);
        // Lo recorrido, continuo; lo que falta, punteado: los dos del color de "en camino".
        r.push({ linea: hecho, color: col('en_traslado'), ancho: 5 }, { linea: falta, color: col('en_traslado'), punteada: true, ancho: 5 });
        if (u.salida) p.push({ id: 2_000_000 + u.quoteId, nombre: `Salida · ${u.salida.nombre}`, lat: u.salida.lat, lng: u.salida.lng, tipo: 'salida', color: COLOR_BASE, icono: 'ph-warehouse', detalle: u.salio ? `Salió a las ${hora(u.salio)}` : null });
        if (u.obra) p.push({ id: 1_000_000 + u.quoteId, nombre: nombreObra(u.cliente, u.obra), lat: u.obra.lat, lng: u.obra.lng, tipo: 'obra', color: col('en_traslado'), icono: 'ph-flag-checkered', detalle: ficha(u, 'En camino', u.folio) });
        if (u.ultima) {
          p.push({
            id: u.quoteId, nombre: u.operador ? `Operador ${u.operador.nombre}` : u.aliado?.nombre ?? 'Unidad', lat: u.ultima.lat, lng: u.ultima.lng, tipo: 'unidad', color: col('en_traslado'), icono: 'ph-truck', pulso: true,
            detalle: [u.equipo, enCaminoDe(u, ahora).texto, `ubicación de ${hace(u.ultima.at, ahora)}`].filter(Boolean).join(' · '),
          });
        }
      }
    }
    return { puntos: p, rutas: r };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, capas, t, claro]);

  const capa = (c: Capa, texto: string, n: number, color: string, icono: string) => (
    <button type="button" className="ms-capa" aria-pressed={capas[c]} onClick={() => alternar(c)} style={{ '--c': color } as React.CSSProperties} title={capas[c] ? `Ocultar ${texto.toLowerCase()}` : `Mostrar ${texto.toLowerCase()}`}>
      <span className="ms-capa-ico"><i className={`ph-bold ${icono}`} aria-hidden /></span>
      {texto}
      <span className="adm-num ms-capa-n">{n}</span>
    </button>
  );

  return (
    <Panel
      title="Mapa de servicios"
      icon="ph-map-trifold"
      desc="De la base de cada aliado a su obra, por calles, con el color de su etapa. Los que van en camino, con su ubicación en vivo. Toca un punto para ver la obra, la máquina, el operador y su teléfono."
      style={{ marginBottom: 20 }}
    >
      <style>{`
        .ms-capas { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 2px 0 14px; }
        .ms-capa {
          display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 12px 0 5px; border-radius: 999px; cursor: pointer;
          font: inherit; font-size: 13px; font-weight: 600; color: var(--adm-muted);
          border: 1px solid var(--adm-border-strong); background: transparent; transition: background .15s ease, border-color .15s ease, color .15s ease;
        }
        .ms-capa-ico { width: 24px; height: 24px; border-radius: 999px; display: grid; place-items: center; font-size: 13px; color: var(--c); background: color-mix(in srgb, var(--c) 16%, transparent); }
        .ms-capa-n { font-size: 12px; font-weight: 500; color: var(--adm-faint); }
        .ms-capa[aria-pressed="true"] { color: var(--adm-text); border-color: color-mix(in srgb, var(--c) 55%, transparent); background: color-mix(in srgb, var(--c) 12%, transparent); }
        .ms-capa[aria-pressed="true"] .ms-capa-ico { background: var(--c); color: #fff; }
        .ms-capa[aria-pressed="false"] { opacity: var(--adm-atenuado); }
        .ms-capa:hover { opacity: 1; }
        .ms-base { display: inline-flex; align-items: center; gap: 7px; margin-left: 4px; font-size: 12.5px; color: var(--adm-muted); }
      `}</style>
      <Toolbar>
        <SearchBox value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cliente, folio, equipo, aliado u obra…" aria-label="Buscar en el mapa de servicios" />
      </Toolbar>
      <div className="ms-capas" role="group" aria-label="Qué enseñar en el mapa">
        {capa('asignados', 'Asignados', asignados.length, col('asignado'), 'ph-hard-hat')}
        {capa('camino', 'En camino', enCamino.length, col('en_traslado'), 'ph-truck')}
        {capa('obra', 'En obra', enObra.length, col('en_sitio'), 'ph-gear-six')}
        {capa('porAsignar', 'Por asignar', esperan.length, col('por_asignar'), 'ph-hourglass-medium')}
        {capa('aliados', 'Aliados', red.length, '#008CFF', 'ph-handshake')}
        <span className="ms-base"><span className="ms-capa-ico" style={{ '--c': COLOR_BASE, background: COLOR_BASE, color: '#fff' } as React.CSSProperties}><i className="ph-bold ph-warehouse" aria-hidden /></span>Base del aliado · punteada: aún no sale</span>
      </div>
      <MapaCobertura puntos={puntos} rutas={rutas} alto={440} tema="oscuro" />
    </Panel>
  );
}
