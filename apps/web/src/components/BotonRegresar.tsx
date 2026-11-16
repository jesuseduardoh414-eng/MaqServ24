'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';

/**
 * BOTÓN «REGRESAR» EN TODAS LAS PÁGINAS (2026-11-16, el dueño: «en todas las
 * páginas no veo un botón para retroceder, favor de agregarlo»). Va debajo del
 * menú, en todas menos el inicio.
 *
 * Regresa a la página anterior DENTRO del sitio. Si se llegó directo (de
 * Google, de un enlace, recargando), «atrás» sacaría del sitio: entonces sube
 * a la sección de arriba (/servicios/x → /servicios; /cuenta → inicio).
 *
 * `pila`: las páginas vistas en esta visita (vive mientras la pestaña no se
 * recarga). Con «atrás» —el del navegador o este botón— sale la última.
 */
const pila: string[] = [];
let volviendo = false;
let escuchando = false;

function alVolverDelNavegador() {
  pila.pop();
  volviendo = true;
}

export function BotonRegresar() {
  const ruta = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!escuchando) {
      window.addEventListener('popstate', alVolverDelNavegador);
      escuchando = true;
    }
    if (volviendo) { volviendo = false; return; }
    if (ruta && pila[pila.length - 1] !== ruta) pila.push(ruta);
  }, [ruta]);

  if (!ruta || ruta === '/') return null;

  const regresar = () => {
    if (pila.length > 1) { router.back(); return; }
    const partes = ruta.split('/').filter(Boolean);
    partes.pop();
    router.push(`/${partes.join('/')}`);
  };

  return (
    <div className="br-fila">
      <style>{BR_CSS}</style>
      <button type="button" className="br-btn" onClick={regresar}>
        <Icon name="arrowLeft" size={16} />
        Regresar
      </button>
    </div>
  );
}

const BR_CSS = `
/* Mismo ancho que el contenido de las páginas (.ms-wrap): el botón queda alineado con lo que sigue. */
.br-fila{ position:relative; z-index:2; max-width:1180px; margin:0 auto; padding: 16px 32px 0; }
.br-btn{ display:inline-flex; align-items:center; gap:7px; height:36px; padding:0 15px 0 11px; border-radius:9px; cursor:pointer;
  border:1px solid color-mix(in srgb, var(--color-text) 20%, transparent);
  background: color-mix(in srgb, var(--color-surface) 72%, transparent); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
  color: var(--color-text); font-family: var(--font-display); font-weight:700; font-size:13.5px; line-height:1;
  transition: border-color .2s ease, box-shadow .2s ease; }
.br-btn svg{ color: var(--color-primary); transition: transform .2s ease; }
.br-btn:hover{ border-color: color-mix(in srgb, var(--color-primary) 60%, transparent); box-shadow: 0 0 18px -6px var(--color-primary); }
.br-btn:hover svg{ transform: translateX(-3px); }
.br-btn:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; }
@media (max-width: 640px){ .br-fila{ padding: 14px 16px 0; } }
@media (prefers-reduced-motion: reduce){ .br-btn svg{ transition:none; } }
`;
