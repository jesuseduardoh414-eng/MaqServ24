/**
 * RUTA POR CALLES (2026-10-26).
 *
 * "¿Hay manera de que no muestre una línea recta, sino una ruta, como cuando
 * se va en Uber o DiDi?" El Mapa de servicios dibuja el camino por calles de
 * la base del aliado a la obra, y para la unidad en camino, de donde va a la
 * obra (con los km y minutos reales en vez del promedio de 35 km/h).
 *
 * Decisión del dueño: "la mejor opción". Se usa la mejor que haya:
 *   1. Google Directions, si hay llave (GOOGLE_DIRECTIONS_API_KEY, o la de
 *      Distance Matrix del cotizador si tiene Directions habilitado): la más
 *      precisa y con tráfico.
 *   2. OSRM, el servidor público de rutas de OpenStreetMap: sin llave ni costo.
 *      Su política pide uso ligero (una consulta por segundo, sin abusar) y
 *      un User-Agent que diga quién llama; por eso cada ruta se guarda y se
 *      reutiliza, y las consultas van de una en una.
 *   3. Si ninguno responde, null: el mapa dibuja la línea recta, como antes.
 *
 * A los dos solo se les mandan dos coordenadas; nunca nombres ni direcciones.
 */

export interface Punto { lat: number; lng: number }
export interface Ruta {
  /** [lat, lng] del camino, ya reducido para el mapa. */
  linea: Array<[number, number]>;
  km: number;
  min: number;
  fuente: 'google' | 'osrm';
}

const DIA = 86_400_000;
/** Sin ruta (los dos fallaron): se reintenta en 5 minutos, no en cada vuelta del mapa. */
const REINTENTO_MS = 5 * 60_000;
const MAX_PUNTOS = 400;
const TIMEOUT_MS = 6_000;
const AGENTE = 'MAQSER24/1.0 (+https://maqser24.com; panel de operaciones)';

const guardadas = new Map<string, { hasta: number; ruta: Ruta | null }>();
const enCamino = new Map<string, Promise<Ruta | null>>();

/**
 * El camino por calles de `a` a `b`. `precision` = decimales con los que se
 * reconoce "la misma ruta" (4 ≈ 11 m; 3 ≈ 110 m para una unidad que se mueve).
 */
export function rutaPorCalles(a: Punto, b: Punto, opts: { vigenciaMs?: number; precision?: number } = {}): Promise<Ruta | null> {
  const p = opts.precision ?? 4;
  const clave = `${a.lat.toFixed(p)},${a.lng.toFixed(p)}>${b.lat.toFixed(p)},${b.lng.toFixed(p)}`;
  const g = guardadas.get(clave);
  if (g && g.hasta > Date.now()) return Promise.resolve(g.ruta);
  // La misma ruta pedida dos veces a la vez: una sola consulta.
  const ya = enCamino.get(clave);
  if (ya) return ya;
  const pedida = (async () => {
    const ruta = (await deGoogle(a, b)) ?? (await deOsrm(a, b));
    guardadas.set(clave, { hasta: Date.now() + (ruta ? opts.vigenciaMs ?? DIA : REINTENTO_MS), ruta });
    if (guardadas.size > 3000) {
      const ahora = Date.now();
      for (const [k, v] of guardadas) if (v.hasta < ahora) guardadas.delete(k);
    }
    return ruta;
  })().finally(() => enCamino.delete(clave));
  enCamino.set(clave, pedida);
  return pedida;
}

/** Lo que alcance a llegar en `ms`; lo demás se termina de pedir y queda guardado para la siguiente vuelta. */
export function rutaConTiempo(a: Punto, b: Punto, ms: number, opts?: { vigenciaMs?: number; precision?: number }): Promise<Ruta | null> {
  return Promise.race([rutaPorCalles(a, b, opts), new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

// ── Google Directions ──

async function deGoogle(a: Punto, b: Punto): Promise<Ruta | null> {
  const key = process.env.GOOGLE_DIRECTIONS_API_KEY || process.env.GOOGLE_DISTANCE_MATRIX_API_KEY;
  if (!key) return null;
  try {
    const params = new URLSearchParams({ origin: `${a.lat},${a.lng}`, destination: `${b.lat},${b.lng}`, mode: 'driving', departure_time: 'now', key });
    const res = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const d = (await res.json()) as {
      status: string;
      routes?: Array<{ overview_polyline?: { points?: string }; legs?: Array<{ distance?: { value: number }; duration?: { value: number }; duration_in_traffic?: { value: number } }> }>;
    };
    const r = d.status === 'OK' ? d.routes?.[0] : undefined;
    const leg = r?.legs?.[0];
    if (!r?.overview_polyline?.points || !leg?.distance) return null;
    return {
      linea: reducir(decodificar(r.overview_polyline.points)),
      km: Math.round(leg.distance.value / 100) / 10,
      min: Math.round((leg.duration_in_traffic?.value ?? leg.duration?.value ?? 0) / 60),
      fuente: 'google',
    };
  } catch {
    return null;
  }
}

/** El "encoded polyline" de Google → [lat, lng]. */
function decodificar(s: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let i = 0, lat = 0, lng = 0;
  while (i < s.length) {
    for (const eje of [0, 1]) {
      let res = 0, sh = 0, b: number;
      do { b = s.charCodeAt(i++) - 63; res |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20);
      const delta = res & 1 ? ~(res >> 1) : res >> 1;
      if (eje === 0) lat += delta; else lng += delta;
    }
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}

// ── OSRM (servidor público de OpenStreetMap) ──

/** Una consulta por segundo, en fila: es lo que pide su política de uso. */
let fila: Promise<unknown> = Promise.resolve();
let ultima = 0;

function deOsrm(a: Punto, b: Punto): Promise<Ruta | null> {
  const turno = fila.then(async () => {
    const espera = ultima + 1_000 - Date.now();
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
    ultima = Date.now();
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url, { headers: { 'User-Agent': AGENTE }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) return null;
      const d = (await res.json()) as { code: string; routes?: Array<{ distance: number; duration: number; geometry?: { coordinates?: Array<[number, number]> } }> };
      const r = d.code === 'Ok' ? d.routes?.[0] : undefined;
      const coords = r?.geometry?.coordinates;
      if (!r || !coords?.length) return null;
      return {
        linea: reducir(coords.map(([lng, lat]) => [lat, lng] as [number, number])),
        km: Math.round(r.distance / 100) / 10,
        min: Math.round(r.duration / 60),
        fuente: 'osrm' as const,
      };
    } catch {
      return null;
    }
  });
  fila = turno.catch(() => null);
  return turno;
}

/** Menos puntos para el mapa, sin perder la forma: uno de cada N, y siempre el último. */
function reducir(l: Array<[number, number]>): Array<[number, number]> {
  if (l.length <= MAX_PUNTOS) return l;
  const paso = Math.ceil(l.length / MAX_PUNTOS);
  const out = l.filter((_, i) => i % paso === 0);
  if (out[out.length - 1] !== l[l.length - 1]) out.push(l[l.length - 1]);
  return out;
}
