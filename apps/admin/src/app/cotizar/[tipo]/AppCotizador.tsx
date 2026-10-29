'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { COTIZADORES_ACTIVOS, COTIZADORES_META, type CotizadorTipo } from '@maqserv/config';
import { useBranding } from '@/components/branding';

/** El evento que Chrome/Edge en Android disparan cuando la página se puede instalar. */
interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * El marco del acceso directo (2026-10-29): sin menú lateral, con el cambio
 * entre cotizadores, la vuelta al panel y "Instalar en este celular".
 *
 * En Android el botón abre la instalación del navegador; en iPhone eso no
 * existe y se explica el camino de Safari (Compartir → Agregar a inicio). Ya
 * instalada (se abre sola, sin barra del navegador), el aviso no sale.
 */
export function AppCotizador({ tipo, nombre, children }: { tipo: CotizadorTipo; nombre: string; children: ReactNode }) {
  const branding = useBranding();
  const [instalar, setInstalar] = useState<EventoInstalar | null>(null);
  const [esIphone, setEsIphone] = useState(false);
  const [instalada, setInstalada] = useState(true);

  useEffect(() => {
    // Un service worker que solo pasa todo a la red (y avisa sin conexión): lo
    // piden los navegadores para ofrecer "Instalar".
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw-cotizar.js').catch(() => undefined);
    const nav = navigator as Navigator & { standalone?: boolean };
    setInstalada(window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true);
    setEsIphone(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const alPoder = (e: Event) => { e.preventDefault(); setInstalar(e as EventoInstalar); };
    const alInstalar = () => { setInstalar(null); setInstalada(true); };
    window.addEventListener('beforeinstallprompt', alPoder);
    window.addEventListener('appinstalled', alInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', alPoder);
      window.removeEventListener('appinstalled', alInstalar);
    };
  }, []);

  const logo = branding.logoLight || branding.logoAlt || null;

  return (
    <div className="cza">
      <style>{CSS}</style>
      <header className="cza-h">
        <div className="cza-marca">
          {logo ? <img src={logo} alt="MAQSER24" /> : <b>MAQSER24</b>}
        </div>
        <nav className="cza-tabs" aria-label="Cotizadores">
          {COTIZADORES_ACTIVOS.map((t) => (
            <Link key={t} href={`/cotizar/${t}`} data-on={t === tipo || undefined} aria-current={t === tipo ? 'page' : undefined}>
              {COTIZADORES_META[t].titulo}
            </Link>
          ))}
        </nav>
        <div className="cza-acc">
          <Link href={`/cotizador/historial?kind=${tipo}`}>Historial</Link>
          <Link href="/">Panel</Link>
        </div>
      </header>

      {!instalada && (instalar || esIphone) ? (
        <div className="cza-instalar">
          <span>
            <b>Ponlo en el inicio de tu celular.</b>{' '}
            {instalar
              ? `Se abre directo en el cotizador de ${COTIZADORES_META[tipo].titulo.toLowerCase()}, como una app.`
              : 'En Safari toca Compartir (el cuadro con la flecha) y luego «Agregar a inicio».'}
          </span>
          {instalar ? (
            <button
              type="button"
              onClick={async () => {
                await instalar.prompt();
                await instalar.userChoice.catch(() => undefined);
                setInstalar(null);
              }}
            >
              Instalar
            </button>
          ) : null}
        </div>
      ) : null}

      <main className="cza-main">
        <p className="cza-quien">Cotizando como {nombre}</p>
        {children}
      </main>
    </div>
  );
}

const CSS = `
.cza{ min-height:100vh; background:var(--adm-page); color:var(--adm-text); }
.cza-h{ position:sticky; top:0; z-index:20; display:flex; align-items:center; gap:12px; flex-wrap:wrap;
  padding:calc(env(safe-area-inset-top, 0px) + 10px) 16px 10px; background:var(--adm-page); border-bottom:1px solid var(--adm-border); }
.cza-marca img{ height:26px; width:auto; display:block; }
.cza-marca b{ font-size:15px; letter-spacing:.04em; }
.cza-tabs{ display:flex; gap:4px; padding:3px; border:1px solid var(--adm-border); border-radius:10px; }
.cza-tabs a{ padding:7px 12px; border-radius:7px; font-size:13.5px; font-weight:600; color:var(--adm-muted); text-decoration:none; min-height:36px; display:inline-flex; align-items:center; }
.cza-tabs a[data-on]{ background:var(--adm-accent, #008CFF); color:#fff; }
.cza-acc{ margin-left:auto; display:flex; gap:14px; }
.cza-acc a{ font-size:13.5px; color:var(--adm-muted); text-decoration:none; }
.cza-acc a:hover{ color:var(--adm-text); }
.cza-instalar{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin:12px 16px 0; padding:12px 14px; border-radius:10px;
  border:1px solid color-mix(in srgb, var(--adm-accent, #008CFF) 45%, var(--adm-border)); font-size:13.5px; line-height:1.5; }
.cza-instalar span{ flex:1 1 240px; }
.cza-instalar button{ height:36px; padding:0 16px; border-radius:8px; border:0; background:var(--adm-accent, #008CFF); color:#fff; font-weight:600; font-size:13.5px; cursor:pointer; }
.cza-main{ max-width:1240px; margin:0 auto; padding:14px 16px calc(env(safe-area-inset-bottom, 0px) + 40px); }
.cza-quien{ margin:0 0 10px; font-size:12.5px; color:var(--adm-muted); }
@media (max-width:640px){ .cza-acc{ width:100%; margin-left:0; justify-content:flex-end; } }
`;
