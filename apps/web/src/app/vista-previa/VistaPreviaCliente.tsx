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
        try {
          const r = await pintar({ vista: d.vista, modo: d.modo, tokens: d.tokens, copys: d.copys, datos: d.datos });
          if (mio !== turno.current) return;
          if (r.ok) {
            setNodo(r.nodo);
            setError(null);
          } else setError(r.error);
        } catch {
          if (mio === turno.current) setError('El sitio no pudo pintar la vista previa. Reintenta en unos segundos.');
        }
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
