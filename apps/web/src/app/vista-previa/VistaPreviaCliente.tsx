'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MENSAJE_VISTA_PREVIA, type BorradorVistaPrevia } from '@maqserv/config';
import type { pintarVistaPrevia } from './pintar';

/**
 * Solo el panel puede mandar borradores: `admin.` + este dominio, o localhost
 * en desarrollo. Sin esta comprobación, cualquier página que abriera esta en
 * una ventana podría hacerla pintar lo que quisiera.
 */
function esDelPanel(origen: string): boolean {
  try {
    const o = new URL(origen);
    const aqui = window.location.hostname.replace(/^www\./, '');
    if (o.hostname === `admin.${aqui}`) return true;
    const local = (h: string) => h === 'localhost' || h === '127.0.0.1';
    return local(aqui) && local(o.hostname);
  } catch {
    return false;
  }
}

const RECARGA = 'maqser-vp:recargada';

/** Recarga la página si no se recargó en el último minuto (sin ciclos). */
function recargarUnaVez(): boolean {
  try {
    const antes = Number(sessionStorage.getItem(RECARGA) ?? 0);
    if (Date.now() - antes < 60_000) return false;
    sessionStorage.setItem(RECARGA, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** Al padre. No es información sensible: un aviso de "listo" y un alto. */
function avisar(tipo: string, extra: Record<string, unknown> = {}) {
  if (window.parent !== window) window.parent.postMessage({ tipo, ...extra }, '*');
}

export function VistaPreviaCliente({ pintar }: { pintar: typeof pintarVistaPrevia }) {
  const [nodo, setNodo] = useState<ReactNode>(null);
  const [error, setError] = useState<string | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const turno = useRef(0);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recibe borradores del panel y pinta el último (los anteriores se descartan).
  useEffect(() => {
    const alRecibir = (e: MessageEvent) => {
      if (!esDelPanel(e.origin)) return;
      const d = e.data as ({ tipo?: string } & BorradorVistaPrevia) | null;
      if (!d || d.tipo !== MENSAJE_VISTA_PREVIA.borrador) return;
      document.documentElement.setAttribute('data-theme', d.modo === 'light' ? 'light' : 'dark');
      if (espera.current) clearTimeout(espera.current);
      espera.current = setTimeout(async () => {
        const mio = ++turno.current;
        const borrador = { vista: d.vista, modo: d.modo, tokens: d.tokens, copys: d.copys, datos: d.datos };
        // Dos intentos: el servidor puede estar reiniciando (al subir cambios) o saturado un momento.
        let motivo = '';
        for (let intento = 1; intento <= 2; intento++) {
          try {
            const r = await pintar(borrador);
            if (mio !== turno.current) return;
            if (r.ok) {
              setNodo(r.nodo);
              setError(null);
            } else setError(r.error);
            try { sessionStorage.removeItem(RECARGA); } catch { /* sin almacenamiento */ }
            return;
          } catch (e) {
            if (mio !== turno.current) return;
            motivo = e instanceof Error ? e.message : String(e);
            if (intento === 1) await new Promise((r) => setTimeout(r, 1500));
          }
        }
        // Tras una subida, esta página (cargada antes) apunta a una versión del
        // sitio que ya no existe y ningún reintento la arregla: se recarga una
        // vez y el panel vuelve a mandar el borrador al oír «lista».
        if (recargarUnaVez()) return;
        // El motivo se enseña: sin él no hay forma de saber qué pasó en el navegador de quien lo ve.
        setError(`El sitio no pudo pintar la vista previa. Reintenta en unos segundos.${motivo ? ` (Motivo: ${motivo.slice(0, 160)})` : ''}`);
      }, 220);
    };
    window.addEventListener('message', alRecibir);
    avisar(MENSAJE_VISTA_PREVIA.lista);
    return () => window.removeEventListener('message', alRecibir);
  }, [pintar]);

  // Le dice al panel cuánto mide lo pintado, para que el iframe no tenga scroll.
  // `pintado` distingue "todavía no llega nada" de "la sección no se muestra".
  const pintado = nodo !== null || error !== null;
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => avisar(MENSAJE_VISTA_PREVIA.alto, { alto: Math.ceil(el.getBoundingClientRect().height), pintado });
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    medir();
    return () => ro.disconnect();
  }, [pintado, nodo]);

  // Es una vista previa: los enlaces y formularios no llevan a ningún lado.
  useEffect(() => {
    const frenar = (e: Event) => {
      const t = e.target as Element | null;
      if (e.type === 'submit' || t?.closest?.('a[href]')) e.preventDefault();
    };
    document.addEventListener('click', frenar, true);
    document.addEventListener('submit', frenar, true);
    return () => {
      document.removeEventListener('click', frenar, true);
      document.removeEventListener('submit', frenar, true);
    };
  }, []);

  return (
    <>
      <style>{'html,body{overflow:hidden;margin:0;background:var(--color-bg);}'}</style>
      <div ref={caja} style={{ display: 'flow-root' }}>
        {error ? (
          <p style={{ margin: 16, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--color-error)', color: 'var(--color-error)', fontSize: 14 }}>{error}</p>
        ) : null}
        {nodo}
      </div>
    </>
  );
}
