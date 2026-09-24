'use client';

import { useEffect, useState } from 'react';

/** `beforeinstallprompt` no está tipado en lib.dom. */
type PromptInstalar = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DESCARTE_KEY = 'pwa-instalar-descartado';
const DESCARTE_DIAS = 30;

type Labels = { title: string; text: string; cta: string; later: string; brand: string };

/**
 * Tres cosas de la PWA que solo puede hacer el navegador:
 *
 *  1. Registrar el service worker (/sw.js). SOLO en producción: en desarrollo
 *     una caché de estáticos encima de Turbopack —que ya sirve CSS viejo por su
 *     cuenta— sería horas de "no se refleja el cambio". Si quedó uno registrado
 *     de una prueba anterior en localhost, se quita.
 *  2. Mantener `theme-color` (color de la barra del sistema en la app instalada)
 *     igual al fondo real: el toggle claro/oscuro cambia `data-theme` y el meta
 *     con media query NO se entera.
 *  3. Ofrecer instalar. Chrome/Edge/Android avisan con `beforeinstallprompt`
 *     cuando el sitio cumple los requisitos; se guarda el evento y se muestra
 *     una tarjeta discreta. iOS no dispara nada (se instala desde Compartir →
 *     "Agregar a inicio"), y ahí no se muestra nada: nada de fingir botones.
 */
export function Pwa({ labels }: { labels: Labels }) {
  const [evento, setEvento] = useState<PromptInstalar | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
      return;
    }
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
  }, []);

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const sync = () => {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim();
      if (bg) meta.setAttribute('content', bg);
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', sync);
    return () => {
      obs.disconnect();
      mq.removeEventListener('change', sync);
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return; // ya instalada
    try {
      const desde = Number(localStorage.getItem(DESCARTE_KEY));
      if (desde && Date.now() - desde < DESCARTE_DIAS * 864e5) return;
    } catch { /* sin storage: se ofrece igual */ }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvento(e as PromptInstalar);
    };
    const onInstalled = () => setEvento(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!evento) return null;

  const descartar = () => {
    try { localStorage.setItem(DESCARTE_KEY, String(Date.now())); } catch { /* ignora */ }
    setEvento(null);
  };
  const instalar = async () => {
    const ev = evento;
    setEvento(null);
    try {
      await ev.prompt();
      const { outcome } = await ev.userChoice;
      if (outcome === 'dismissed') descartar();
    } catch { /* el navegador ya no permite el prompt: se cierra y ya */ }
  };

  return (
    <aside
      role="dialog"
      aria-label={labels.title}
      style={{
        position: 'fixed', left: 16, right: 16, bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        maxWidth: 440, marginLeft: 'auto', zIndex: 80,
        display: 'flex', gap: 14, alignItems: 'center', padding: '14px 16px',
        background: 'var(--color-surface)', color: 'var(--color-text)',
        border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg, 12px)',
        boxShadow: '0 12px 40px rgba(0,0,0,.35)', fontFamily: 'var(--font-sans)',
      }}
    >
      <img src="/pwa/icon-192.png" alt="" width={44} height={44} style={{ borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14.5, lineHeight: 1.3 }}>{labels.title}</p>
        <p style={{ margin: '3px 0 0', fontSize: 13, lineHeight: 1.4, color: 'var(--color-text-muted)' }}>{labels.text}</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button
            type="button"
            onClick={instalar}
            style={{ font: 'inherit', fontWeight: 700, fontSize: 13.5, background: 'var(--color-primary)', color: 'var(--color-primary-fg)', border: 'none', padding: '8px 16px', borderRadius: 'var(--radius-button, 6px)', cursor: 'pointer' }}
          >
            {labels.cta}
          </button>
          <button
            type="button"
            onClick={descartar}
            style={{ font: 'inherit', fontWeight: 600, fontSize: 13.5, background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', padding: '8px 14px', borderRadius: 'var(--radius-button, 6px)', cursor: 'pointer' }}
          >
            {labels.later}
          </button>
        </div>
      </div>
    </aside>
  );
}
