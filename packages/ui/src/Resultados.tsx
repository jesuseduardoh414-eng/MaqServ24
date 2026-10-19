'use client';

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * EL RESULTADO DE CADA CAMBIO (2026-10-15). Compartido por el panel y el sitio.
 *
 * "Cada vez que haga un cambio, por muy pequeño que sea, siempre debe aparecer
 * un mensaje de que sí se hizo o no." Antes dependía de cada pantalla: unas
 * mostraban un aviso, otras un texto junto al botón (que con la página
 * desplazada nadie veía) y otras nada.
 *
 * Por eso no se confía en que cada pantalla se acuerde: `ResultadosHost`
 * (montado una vez por app) observa TODA petición que modifica algo —POST,
 * PUT, PATCH o DELETE— a las rutas que la app le indica (`observar`) y avisa
 * sola cómo terminó:
 *   - bien → "Cambios guardados", "Eliminado", "Publicado"…
 *   - mal  → "No se guardó: <lo que respondió la API>", o sin conexión.
 * Las lecturas (GET) nunca avisan, ni lo que la app pone en `silencio`
 * (entrar, salir, marcar avisos como leídos: pasan solos o ya tienen su UI).
 *
 * Cuando la pantalla tiene algo más preciso que decir ("Laura ahora tiene el
 * rol Administración"), llama a `mostrarResultado` y su texto SUSTITUYE al
 * automático del mismo signo: el automático espera un instante justo para eso.
 *
 * Colores: variables `--res-*` con valores por defecto oscuros; cada app pasa
 * los suyos en `colores` (tokens del panel o del sitio).
 */

export type TonoResultado = 'ok' | 'bad' | 'warn' | 'info';

interface Resultado {
  id: number;
  tono: TonoResultado;
  texto: ReactNode;
  /** Puesto por el observador de peticiones, no por la pantalla. */
  auto: boolean;
}

const DURACION: Record<TonoResultado, number> = { ok: 3500, info: 4500, warn: 6500, bad: 8000 };
const MAXIMO = 3;
/** Lo que espera el automático por si la pantalla trae su propio mensaje. */
const ESPERA_AUTO = 350;

let siguiente = 1;
let pintar: ((cambio: (lista: Resultado[]) => Resultado[]) => void) | null = null;
const enEspera: Omit<Resultado, 'id'>[] = [];
/** Automáticos que aún esperan su turno, con su tono. */
const pendientes = new Map<ReturnType<typeof setTimeout>, TonoResultado>();
const esError = (t: TonoResultado) => t === 'bad' || t === 'warn';

function agregar(r: Omit<Resultado, 'id'>) {
  if (!pintar) {
    enEspera.push(r);
    return;
  }
  const nuevo: Resultado = { ...r, id: siguiente++ };
  pintar((lista) => {
    // Lo que dijo la pantalla manda sobre el "Cambios guardados" genérico.
    let base = r.auto ? lista : lista.filter((x) => !(x.auto && x.tono === 'ok'));
    // El mismo aviso dos veces seguidas (tres casillas marcadas al hilo) se
    // queda en uno, con el reloj reiniciado.
    base = base.filter((x) => !(x.tono === r.tono && typeof x.texto === 'string' && x.texto === r.texto));
    return [...base, nuevo].slice(-MAXIMO);
  });
}

/**
 * Avisa cómo terminó una acción, con el texto de la pantalla. Sustituye al
 * automático del MISMO signo: un "listo" de la pantalla no puede tapar el
 * error de otra petición que salió a la vez.
 */
export function mostrarResultado(texto: ReactNode, tono: TonoResultado = 'ok') {
  for (const [t, suTono] of pendientes) {
    if (esError(suTono) === esError(tono)) {
      clearTimeout(t);
      pendientes.delete(t);
    }
  }
  agregar({ texto, tono, auto: false });
}

function avisoAuto(texto: string, tono: TonoResultado) {
  const t = setTimeout(() => {
    pendientes.delete(t);
    agregar({ texto, tono, auto: true });
  }, ESPERA_AUTO);
  pendientes.set(t, tono);
}

/* ── Qué se dice de cada petición ───────────────────────────────────────── */

const MODIFICAN = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function textoExito(metodo: string, ruta: string): string {
  const fin = ruta.split('/').filter(Boolean).pop() ?? '';
  if (metodo === 'DELETE') return fin === 'publicar' ? 'Se quitó del sitio' : 'Eliminado';
  if (fin === 'publish' || fin === 'publicar') return 'Publicado';
  if (fin === 'upload' || fin === 'image' || fin === 'gallery' || fin === 'documentos') return 'Archivo subido';
  if (['enviar', 'reenviar', 'responder', 'prueba', 'ofrecer'].includes(fin)) return 'Enviado';
  return metodo === 'POST' ? 'Listo' : 'Cambios guardados';
}

/** Los textos de fábrica de Nest vienen en inglés y no le dicen nada a nadie. */
const GENERICOS = /^(unauthorized|forbidden|not found|bad request|internal server error|datos inválidos)$/i;

async function textoError(res: Response, metodo: string): Promise<string> {
  const no = metodo === 'DELETE' ? 'No se eliminó' : 'No se guardó';
  if (res.status === 401) return `${no}: tu sesión se cerró. Vuelve a entrar y repite el cambio.`;
  let mensaje: unknown = null;
  try {
    mensaje = (await res.json())?.message;
  } catch {
    /* sin cuerpo JSON */
  }
  const m = typeof mensaje === 'string' ? mensaje : Array.isArray(mensaje) && typeof mensaje[0] === 'string' ? mensaje[0] : null;
  if (m && !GENERICOS.test(m.trim())) return `${no}: ${m}`;
  if (res.status === 403) return `${no}: no tienes permiso para hacer este cambio.`;
  if (res.status === 404) return `${no}: ya no existe (quizá alguien más lo borró). Recarga la página.`;
  if (res.status === 429) return `${no}: demasiados intentos seguidos. Espera un momento.`;
  if (res.status >= 500) return `${no}: el servidor falló. Intenta de nuevo en un momento.`;
  return `${no}: revisa los datos e intenta de nuevo.`;
}

/* ── Pantalla ───────────────────────────────────────────────────────────── */

function Icono({ tono }: { tono: TonoResultado }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="res-ico">
      <circle cx="12" cy="12" r="9.5" />
      {tono === 'ok' ? <polyline points="7.5 12.5 10.5 15.5 16.5 9" /> : tono === 'info' ? <path d="M12 11v5.5M12 7.6h.01" /> : <path d="M12 7v6M12 16.6h.01" />}
    </svg>
  );
}

function Aviso({ r, cerrar }: { r: Resultado; cerrar: (id: number) => void }) {
  // Con el cursor encima no se va: da tiempo de leer un error largo.
  const [pausa, setPausa] = useState(false);
  useEffect(() => {
    if (pausa) return;
    const t = setTimeout(() => cerrar(r.id), DURACION[r.tono]);
    return () => clearTimeout(t);
  }, [pausa, r.id, r.tono, cerrar]);

  return (
    <div
      className="res-aviso"
      data-tono={r.tono}
      role={r.tono === 'bad' ? 'alert' : 'status'}
      onMouseEnter={() => setPausa(true)}
      onMouseLeave={() => setPausa(false)}
    >
      <Icono tono={r.tono} />
      <span style={{ minWidth: 0 }}>{r.texto}</span>
      <button type="button" className="res-x" onClick={() => cerrar(r.id)} aria-label="Cerrar aviso">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/** Colores del aviso, como valores CSS (pueden ser `var(--token)` de la app). */
export interface ColoresResultado {
  fondo?: string;
  texto?: string;
  borde?: string;
  tenue?: string;
  ok?: string;
  mal?: string;
  alerta?: string;
  info?: string;
}

export function ResultadosHost({
  observar,
  silencio = [],
  callar401 = false,
  colores = {},
}: {
  /**
   * Con los tokens de cada app. Van como estilo en línea de la pila (variables
   * `--res-*` que heredan los avisos) y no en el CSS global: el procesador de
   * CSS del sitio descartaba un bloque `:root` con variables que ninguna regla
   * de ese archivo usaba.
   */
  colores?: ColoresResultado;
  /** Prefijos de ruta (mismo origen) cuyas escrituras se avisan: ['/api/admin/']. */
  observar: string[];
  /** Prefijos que, aun dentro de `observar`, no avisan nunca. */
  silencio?: string[];
  /**
   * Sitio: un 401 es un visitante sin cuenta (el corazón de favoritos lo manda
   * a "Iniciar sesión"); decirle "tu sesión se cerró" lo confundiría.
   */
  callar401?: boolean;
}) {
  const [lista, setLista] = useState<Resultado[]>([]);
  const cerrar = useCallback((id: number) => setLista((l) => l.filter((x) => x.id !== id)), []);
  // Las listas llegan como props: se fijan en una clave para no reinstalar el
  // observador en cada render del layout.
  const claveObservar = observar.join('|');
  const claveSilencio = silencio.join('|');

  useEffect(() => {
    pintar = setLista;
    for (const r of enEspera.splice(0)) agregar(r);

    const prefijos = claveObservar.split('|').filter(Boolean);
    const callados = claveSilencio.split('|').filter(Boolean);
    const seObserva = (metodo: string, url: URL) =>
      MODIFICAN.has(metodo) &&
      url.origin === window.location.origin &&
      prefijos.some((p) => url.pathname.startsWith(p)) &&
      !callados.some((p) => url.pathname.startsWith(p));

    const original = window.fetch;
    const observado: typeof fetch = async (input, init) => {
      const metodo = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href);
      if (!seObserva(metodo, url)) return original.call(window, input, init);

      let res: Response;
      try {
        res = await original.call(window, input, init);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError')) {
          avisoAuto('No hubo conexión con el servidor: el cambio no se guardó.', 'bad');
        }
        throw e;
      }
      if (res.ok) avisoAuto(textoExito(metodo, url.pathname), 'ok');
      // Copia: el cuerpo original queda intacto para la pantalla que lo pidió.
      else if (!(res.status === 401 && callar401)) void textoError(res.clone(), metodo).then((t) => avisoAuto(t, 'bad'));
      return res;
    };
    window.fetch = observado;

    return () => {
      if (window.fetch === observado) window.fetch = original;
      pintar = null;
    };
  }, [claveObservar, claveSilencio, callar401]);

  const vars = Object.fromEntries(
    Object.entries(colores).filter(([, v]) => v).map(([k, v]) => [`--res-${k}`, v]),
  ) as CSSProperties;

  return (
    <div className="res-pila" aria-live="polite" style={vars}>
      <style>{CSS}</style>
      {lista.map((r) => (
        <Aviso key={r.id} r={r} cerrar={cerrar} />
      ))}
    </div>
  );
}

/**
 * El aviso que ya usaban las pantallas del panel (`{toast ? <Toast>…</Toast> : null}`).
 * No se pinta en su sitio: entrega su texto al mismo sistema, para que no salgan
 * dos avisos encimados y su texto sustituya al automático.
 */
export function Toast({ kind = 'ok', children }: { kind?: TonoResultado; children: ReactNode }) {
  useEffect(() => {
    mostrarResultado(children, kind);
  }, [kind, children]);
  return null;
}

// Pila abajo al centro, sobre los modales (1000) y bajo las confirmaciones (1200).
const CSS = `
.res-pila{
  position:fixed; bottom:24px; left:50%; transform:translateX(-50%); z-index:1100;
  display:flex; flex-direction:column; align-items:center; gap:8px;
  width:max-content; max-width:calc(100vw - 32px); pointer-events:none;
}
.res-aviso{
  display:flex; align-items:center; gap:10px; padding:9px 8px 9px 14px; border-radius:var(--res-radio, 10px);
  max-width:min(520px, calc(100vw - 32px)); pointer-events:auto;
  background:var(--res-fondo, #1a1a1d); color:var(--res-texto, #f4f4f5);
  border:1px solid var(--res-borde, rgba(255,255,255,.12));
  font-family:inherit; font-size:13.5px; font-weight:500; line-height:1.45;
  box-shadow:0 20px 50px -20px rgba(0,0,0,.6);
  animation:res-entra .2s ease;
}
.res-aviso[data-tono="ok"]{ --res-tono:var(--res-ok, #22c55e); }
.res-aviso[data-tono="bad"]{ --res-tono:var(--res-mal, #ef4444); border-color:color-mix(in srgb, var(--res-tono) 45%, transparent); }
.res-aviso[data-tono="warn"]{ --res-tono:var(--res-alerta, #f59e0b); border-color:color-mix(in srgb, var(--res-tono) 45%, transparent); }
.res-aviso[data-tono="info"]{ --res-tono:var(--res-info, #5b9dff); }
.res-ico{ flex-shrink:0; color:var(--res-tono); }
.res-x{
  width:24px; height:24px; flex-shrink:0; padding:0; display:grid; place-items:center;
  border:0; border-radius:6px; background:transparent; color:var(--res-tenue, rgba(244,244,245,.5)); cursor:pointer;
}
.res-x:hover{ background:color-mix(in srgb, var(--res-texto, #f4f4f5) 8%, transparent); color:var(--res-texto, #f4f4f5); }
.res-x:focus-visible{ outline:2px solid var(--res-tono, currentColor); outline-offset:1px; }
@keyframes res-entra{ from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:none; } }
@media (prefers-reduced-motion: reduce){ .res-aviso{ animation:none; } }
`;
