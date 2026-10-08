'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { MENSAJE_VISTA_PREVIA, type BorradorVistaPrevia, type VistaPrevia } from '@maqserv/config';

/**
 * VISTA PREVIA REAL (2026-10-05).
 *
 * Antes cada editor de Diseño dibujaba su propia copia de la sección, y esas
 * copias se quedaban atrás cada vez que se rediseñaba el sitio: colores del
 * tema viejo, mayúsculas, cifras vacías… Ahora se carga `/vista-previa` del
 * SITIO en un iframe y se le mandan los cambios sin publicar; el sitio pinta su
 * componente real. Lo que se ve aquí es lo que sale al publicar.
 *
 * El iframe se pinta al ancho real del sitio (1280 px en escritorio, 390 en
 * móvil) y se reduce con `transform: scale` para caber en la columna.
 */

type Borrador = Omit<BorradorVistaPrevia, 'vista' | 'modo'>;
type Modo = 'dark' | 'light';
type Dispositivo = 'escritorio' | 'movil';

const ANCHO: Record<Dispositivo, number> = { escritorio: 1280, movil: 390 };

/**
 * URL del sitio público. Se deduce del host del panel (`admin.X` → `X`) en vez
 * de leer una variable: en producción el panel no tiene una fiable (el ejemplo
 * del .env todavía apunta al dominio viejo). En local, el sitio corre en :3000.
 */
function urlDelSitio(): string {
  const { protocol, hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return `${protocol}//${hostname}:3000`;
  return `${protocol}//${hostname.replace(/^admin\./, '')}`;
}

export function VistaPreviaSitio({
  vista,
  borrador,
  modoInicial = 'dark',
  etiqueta,
  aviso,
}: {
  vista: VistaPrevia;
  borrador: Borrador;
  /** Modo con el que arranca; lo normal es el modo por defecto del tema. */
  modoInicial?: Modo;
  /** Texto junto al punto verde: "home", "página /categorias"… */
  etiqueta: string;
  /** Nota opcional bajo la vista previa (p. ej. "La sección está oculta"). */
  aviso?: ReactNode;
}) {
  const [sitio, setSitio] = useState<string | null>(null);
  const [modo, setModo] = useState<Modo>(modoInicial);
  const [dispositivo, setDispositivo] = useState<Dispositivo>('escritorio');
  const [grande, setGrande] = useState(false);
  const [lista, setLista] = useState(false);
  const [alto, setAlto] = useState(0);
  const [pintado, setPintado] = useState(false);
  const [sinRespuesta, setSinRespuesta] = useState(false);
  const [ancho, setAncho] = useState(0);
  const marco = useRef<HTMLIFrameElement>(null);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => setSitio(urlDelSitio()), []);
  const origen = useMemo(() => (sitio ? new URL(sitio).origin : null), [sitio]);

  // Mensajes del sitio: "listo" y el alto de lo pintado.
  useEffect(() => {
    if (!origen) return;
    const alRecibir = (e: MessageEvent) => {
      if (e.origin !== origen || e.source !== marco.current?.contentWindow) return;
      const d = e.data as { tipo?: string; alto?: number; pintado?: boolean } | null;
      if (d?.tipo === MENSAJE_VISTA_PREVIA.lista) setLista(true);
      if (d?.tipo === MENSAJE_VISTA_PREVIA.alto && typeof d.alto === 'number') {
        setAlto(d.alto);
        setPintado(Boolean(d.pintado));
      }
    };
    window.addEventListener('message', alRecibir);
    return () => window.removeEventListener('message', alRecibir);
  }, [origen]);

  // Si el sitio no contesta, se dice en vez de dejar un recuadro vacío.
  useEffect(() => {
    if (lista || !sitio) return;
    const t = setTimeout(() => setSinRespuesta(true), 15_000);
    return () => clearTimeout(t);
  }, [lista, sitio]);

  // Manda el borrador cada vez que cambia (el sitio espera 220 ms y pinta el último).
  const clave = JSON.stringify(borrador);
  useEffect(() => {
    if (!lista || !origen) return;
    const mensaje = { tipo: MENSAJE_VISTA_PREVIA.borrador, vista, modo, ...borrador };
    marco.current?.contentWindow?.postMessage(mensaje, origen);
    // `clave` resume `borrador`: así no se reenvía por cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista, origen, vista, modo, clave]);

  // Ancho disponible, para calcular la escala.
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAncho(el.clientWidth));
    ro.observe(el);
    setAncho(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Esc cierra la vista ampliada.
  useEffect(() => {
    if (!grande) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setGrande(false);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [grande]);

  const virtual = ANCHO[dispositivo];
  const escala = ancho > 0 ? Math.min(1, ancho / virtual) : 0;
  const altoReal = Math.max(alto, 1);
  const vacio = pintado && alto < 4;
  const cargando = !pintado && !sinRespuesta;

  /* Cromo del panel con las clases del kit (.adm-seg): mismos selectores
     segmentados que los filtros del resto de los módulos. Solo icono, por eso
     el padding más corto; el `title` hace de nombre accesible. */
  const opcion = (on: boolean) => `adm-seg-item${on ? ' is-active' : ''}`;
  const soloIcono: CSSProperties = { padding: '0 8px' };

  return (
    <>
      {grande ? <div onClick={() => setGrande(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 199 }} /> : null}
      <div
        style={
          grande
            ? { position: 'fixed', inset: '24px clamp(12px, 3vw, 40px)', zIndex: 200, background: 'var(--adm-card)', border: '1px solid var(--adm-border-strong)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', boxShadow: '0 40px 90px -30px rgba(0,0,0,.9)' }
            : { display: 'flex', flexDirection: 'column' }
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--adm-faint)' }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--adm-ok)', flexShrink: 0 }} /> Vista previa · {etiqueta}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <div className="adm-seg">
              <button type="button" title="Escritorio" aria-pressed={dispositivo === 'escritorio'} onClick={() => setDispositivo('escritorio')} className={opcion(dispositivo === 'escritorio')} style={soloIcono}><i className="ph ph-desktop" style={{ fontSize: 14 }} /></button>
              <button type="button" title="Móvil" aria-pressed={dispositivo === 'movil'} onClick={() => setDispositivo('movil')} className={opcion(dispositivo === 'movil')} style={soloIcono}><i className="ph ph-device-mobile" style={{ fontSize: 14 }} /></button>
            </div>
            <div className="adm-seg">
              <button type="button" title="Modo oscuro" aria-pressed={modo === 'dark'} onClick={() => setModo('dark')} className={opcion(modo === 'dark')} style={soloIcono}><i className="ph ph-moon" style={{ fontSize: 14 }} /></button>
              <button type="button" title="Modo claro" aria-pressed={modo === 'light'} onClick={() => setModo('light')} className={opcion(modo === 'light')} style={soloIcono}><i className="ph ph-sun" style={{ fontSize: 14 }} /></button>
            </div>
            <div className="adm-seg">
              <button type="button" title={grande ? 'Cerrar (Esc)' : 'Ampliar'} aria-pressed={grande} onClick={() => setGrande((g) => !g)} className={opcion(grande)} style={soloIcono}>
                <i className={`ph ${grande ? 'ph-corners-in' : 'ph-corners-out'}`} style={{ fontSize: 14 }} />
              </button>
            </div>
          </div>
        </div>

        <div
          ref={caja}
          style={{
            position: 'relative', border: '1px solid var(--adm-border-strong)', borderRadius: 12, overflowX: 'hidden', overflowY: 'auto',
            // Fondo del SITIO, no del panel: el del modo que se previsualiza.
            background: modo === 'dark' ? '#07090C' : '#F5F7FA',
            maxHeight: grande ? undefined : 'calc(100vh - 150px)', flex: grande ? 1 : undefined, minHeight: 160,
          }}
        >
          <div style={{ width: virtual * escala, height: altoReal * escala, margin: '0 auto', overflow: 'hidden', opacity: pintado && !vacio ? 1 : 0 }}>
            {sitio ? (
              <iframe
                ref={marco}
                src={`${sitio}/vista-previa`}
                title={`Vista previa · ${etiqueta}`}
                style={{ width: virtual, height: altoReal, border: 0, display: 'block', transform: `scale(${escala})`, transformOrigin: 'top left' }}
              />
            ) : null}
          </div>

          {cargando || vacio || sinRespuesta ? (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 20, textAlign: 'center', fontSize: 13, color: modo === 'dark' ? 'var(--adm-muted)' : '#4A545F' }}>
              {sinRespuesta && !lista ? (
                <span>
                  <i className="ph ph-plug" style={{ fontSize: 20, display: 'block', marginBottom: 6 }} />
                  No se pudo cargar el sitio en <b>{sitio}</b>.<br />Revisa que esté en línea y recarga la página.
                </span>
              ) : vacio ? (
                <span>
                  <i className="ph ph-eye-slash" style={{ fontSize: 20, display: 'block', marginBottom: 6 }} />
                  Con estos ajustes la sección no se muestra en el sitio.<br />Revisa que esté encendida y tenga contenido.
                </span>
              ) : (
                <span><i className="ph ph-spinner-gap" style={{ fontSize: 18, display: 'block', marginBottom: 6 }} />Cargando el sitio…</span>
              )}
            </div>
          ) : null}
        </div>
        {aviso ? <div style={{ margin: '10px 2px 0', fontSize: 12.5, color: 'var(--adm-muted)' }}>{aviso}</div> : null}
      </div>
    </>
  );
}
