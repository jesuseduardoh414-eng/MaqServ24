'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from '@/components/Enlace';
import { CALCULADORAS_ENLACE, COTIZADORES_SITIO, calculadoraDelEnlace, cotizadorDelSitio } from '@maqserv/config';
import { IconoCotizador } from '@maqserv/ui';
import { useBranding } from '@/components/branding';

/**
 * El marco del acceso directo (2026-10-29): sin menú lateral, con el cambio
 * entre cotizadores y el historial. No lleva al resto del panel: el enlace es
 * solo para cotizar.
 *
 * MENÚ CON LOS SIETE COTIZADORES (2026-11-06, pedido del dueño: "como aparece
 * en la web, que tenga los 6 o 7 disponibles y ya no solo triturados y
 * maquinaria"): el mismo orden, nombre y resumen que el menú «Cotizador» del
 * sitio (`COTIZADORES_SITIO`). Elegir uno abre una cotización nueva con esa
 * categoría; para sumar otra a la MISMA cotización sigue estando «¿Necesitas
 * otro servicio?» abajo.
 *
 * CALCULADORAS DE MATERIAL (2026-11-09): debajo de los cotizadores, el mismo
 * menú lista «Calculadoras» (pavimento y m³ ↔ toneladas). Solo existen aquí.
 *
 * SIN AVISO DE «AGREGAR AL INICIO» (2026-11-12, pedido del dueño: "quitar el
 * mensaje de agregar al inicio"). Ya no sale el recuadro «Ponlo en el inicio
 * de tu celular» con su botón Instalar. Se sigue pudiendo instalar desde el
 * menú del navegador (Chrome: ⋮ → Agregar a la pantalla principal; Safari:
 * Compartir → Agregar a inicio): el manifiesto y el service worker se quedan.
 * Tampoco sale la barrita propia de Chrome, que se apaga aquí.
 */
export function AppCotizador({ clave, llave, nombre, children }: {
  /** El cotizador abierto (maquinaria, agua, acarreos…) o la calculadora. */
  clave: string;
  /** La llave del enlace: el cambio entre cotizadores la conserva. */
  llave: string;
  /** Quién cotiza, si entró con su cuenta; null con la cuenta del acceso directo. */
  nombre: string | null;
  children: ReactNode;
}) {
  const branding = useBranding();
  const calc = calculadoraDelEnlace(clave);
  const actual = cotizadorDelSitio(clave) ?? COTIZADORES_SITIO[0];
  // Lo que dice el botón del menú: el cotizador o la calculadora abierta.
  const boton = calc ? { icono: calc.icono, grupo: 'Calculadora', titulo: calc.titulo } : { icono: actual.icono, grupo: 'Cotizador', titulo: actual.titulo };
  const [abierto, setAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Un service worker que solo pasa todo a la red (y avisa sin conexión): lo
    // piden los navegadores para poder instalarlo desde su menú.
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw-cotizar.js').catch(() => undefined);
    // Sin aviso de instalar (2026-11-12): tampoco la barrita propia de Chrome en Android.
    const sinAviso = (e: Event) => e.preventDefault();
    window.addEventListener('beforeinstallprompt', sinAviso);
    return () => window.removeEventListener('beforeinstallprompt', sinAviso);
  }, []);

  // Al cambiar de cotizador el menú se cierra solo.
  useEffect(() => { setAbierto(false); }, [clave]);

  // Se cierra con Esc o tocando fuera.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', esc);
    };
  }, [abierto]);

  const logo = branding.logoLight || branding.logoAlt || null;

  // Un renglón del menú (cotizador o calculadora): ícono, nombre, resumen y la palomita si está abierto.
  const opcion = (c: { clave: string; titulo: string; resumen: string; icono: string }, on: boolean) => (
    <Link
      key={c.clave}
      href={`/cotizar/${llave}/${c.clave}`}
      data-on={on || undefined}
      aria-current={on ? 'page' : undefined}
      onClick={() => setAbierto(false)}
    >
      <span className="cza-ico"><IconoCotizador nombre={c.icono} size={26} /></span>
      <span className="cza-item">
        <b>{c.titulo}</b>
        <small>{c.resumen}</small>
      </span>
      {on ? (
        <svg className="cza-check" viewBox="0 0 16 16" width={16} height={16} aria-hidden>
          <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </Link>
  );

  return (
    <div className="cza">
      <style>{CSS}</style>
      <header className="cza-h">
        <div className="cza-marca">
          {logo ? <img src={logo} alt="MAQSER24" /> : <b>MAQSER24</b>}
        </div>

        <div className="cza-menu" ref={menuRef}>
          <button
            type="button"
            className="cza-menu-btn"
            aria-haspopup="true"
            aria-expanded={abierto}
            aria-controls="cza-cotizadores"
            onClick={() => setAbierto((a) => !a)}
          >
            <IconoCotizador nombre={boton.icono} size={22} />
            <span className="cza-menu-txt">
              <small>{boton.grupo}</small>
              <b>{boton.titulo}</b>
            </span>
            <svg className="cza-flecha" viewBox="0 0 16 16" width={14} height={14} aria-hidden>
              <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {abierto ? (
            <nav id="cza-cotizadores" className="cza-lista" aria-label="Cotizadores y calculadoras">
              <p className="cza-lista-t">Cotizadores</p>
              {COTIZADORES_SITIO.map((c) => opcion(c, !calc && c.clave === actual.clave))}
              <p className="cza-lista-t cza-lista-sep">Calculadoras</p>
              {CALCULADORAS_ENLACE.map((c) => opcion(c, c.clave === calc?.clave))}
            </nav>
          ) : null}
        </div>

        <div className="cza-acc">
          <Link href={calc ? '/cotizador/historial' : `/cotizador/historial?kind=${actual.tipo}`}>Historial</Link>
        </div>
      </header>

      <main className="cza-main">
        {nombre ? <p className="cza-quien">Cotizando como {nombre}</p> : null}
        {children}
      </main>
    </div>
  );
}

const CSS = `
.cza{ min-height:100vh; background:var(--adm-page); color:var(--adm-text); }
.cza-h{ position:sticky; top:0; z-index:20; display:flex; align-items:center; gap:12px;
  padding:calc(env(safe-area-inset-top, 0px) + 10px) 16px 10px; background:var(--adm-page); border-bottom:1px solid var(--adm-border); }
.cza-marca img{ height:26px; width:auto; display:block; }
.cza-marca b{ font-size:15px; letter-spacing:.04em; }
.cza-menu{ position:relative; min-width:0; }
.cza-menu-btn{ display:flex; align-items:center; gap:10px; min-height:44px; max-width:100%; padding:4px 12px 4px 10px; border-radius:10px;
  border:1px solid var(--adm-border); background:transparent; color:var(--adm-text); cursor:pointer; text-align:left; font:inherit; }
.cza-menu-btn:hover, .cza-menu-btn[aria-expanded="true"]{ border-color:color-mix(in srgb, var(--adm-accent, #008CFF) 55%, var(--adm-border)); }
.cza-menu-btn > svg:first-child{ flex:none; color:var(--adm-accent, #008CFF); }
.cza-menu-txt{ display:flex; flex-direction:column; min-width:0; line-height:1.15; }
.cza-menu-txt small{ font-size:11px; color:var(--adm-muted); }
.cza-menu-txt b{ font-size:14px; font-weight:650; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cza-flecha{ flex:none; color:var(--adm-muted); transition:transform .15s; }
.cza-menu-btn[aria-expanded="true"] .cza-flecha{ transform:rotate(180deg); }
.cza-lista{ position:absolute; top:calc(100% + 8px); left:0; width:340px; max-height:calc(100vh - 90px); overflow:auto; padding:6px;
  border:1px solid var(--adm-border); border-radius:12px; background:var(--adm-page); box-shadow:0 14px 40px rgba(0,0,0,.35); }
.cza-lista-t{ margin:6px 10px 6px; font-size:11px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--adm-muted); }
.cza-lista-sep{ margin-top:10px; padding-top:10px; border-top:1px solid var(--adm-border); }
.cza-lista a{ display:flex; align-items:center; gap:12px; padding:9px 10px; border-radius:9px; color:var(--adm-text); text-decoration:none; min-height:52px; }
.cza-lista a:hover{ background:color-mix(in srgb, var(--adm-text) 6%, transparent); }
.cza-lista a[data-on]{ background:color-mix(in srgb, var(--adm-accent, #008CFF) 14%, transparent); }
.cza-ico{ flex:none; display:grid; place-items:center; width:40px; height:40px; border-radius:9px; border:1px solid var(--adm-border); color:var(--adm-muted); }
.cza-lista a[data-on] .cza-ico{ color:var(--adm-accent, #008CFF); border-color:color-mix(in srgb, var(--adm-accent, #008CFF) 50%, var(--adm-border)); }
.cza-item{ flex:1; display:flex; flex-direction:column; gap:2px; min-width:0; }
.cza-item b{ font-size:14px; font-weight:600; }
.cza-item small{ font-size:12.5px; color:var(--adm-muted); line-height:1.35; }
.cza-check{ flex:none; color:var(--adm-accent, #008CFF); }
.cza-acc{ margin-left:auto; display:flex; gap:14px; flex:none; }
.cza-acc a{ font-size:13.5px; color:var(--adm-muted); text-decoration:none; }
.cza-acc a:hover{ color:var(--adm-text); }
.cza-main{ max-width:1240px; margin:0 auto; padding:14px 16px calc(env(safe-area-inset-bottom, 0px) + 40px); }
.cza-quien{ margin:0 0 10px; font-size:12.5px; color:var(--adm-muted); }
@media (max-width:640px){
  .cza-h{ flex-wrap:wrap; row-gap:10px; }
  .cza-menu{ order:3; flex:1 1 100%; position:static; }
  .cza-menu-btn{ width:100%; }
  .cza-menu-btn .cza-menu-txt{ flex:1; }
  .cza-lista{ left:12px; right:12px; width:auto; top:calc(100% + 4px); max-height:calc(100vh - 150px); }
}
`;
