'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  ANALITICA_ACTIVA,
  EVENTO_CONSENTIMIENTO,
  EVENTO_VISTA,
  aplicarConsentimiento,
  cargarGtm,
  evento,
  leerConsentimiento,
  type Consentimiento,
} from '@/lib/analitica';

/**
 * Pega GTM al sitio. No pinta nada. Tres trabajos:
 *
 *  1. Consentimiento: lee la decisión guardada y escucha los cambios. Con
 *     "aceptado" concede Consent Mode y carga gtm.js; con "rechazado" lo
 *     deniega (si GTM ya estaba cargado, deja de enviar sin recargar).
 *  2. Vista de página en cada cambio de ruta (`vista_pagina`). Next no
 *     recarga al navegar, y GA4 solo vería la primera; en GA4 se apaga el
 *     page_view automático para no contar dos veces la primera.
 *  3. Clics que valen dinero, por delegación en `document`: llamar
 *     (`tel:`), WhatsApp, correo y cualquier elemento con `data-evento`.
 *     Un solo listener en vez de tocar cada botón.
 *
 * Va dentro de <Suspense> en el layout: `useSearchParams` lo exige en las
 * páginas estáticas.
 */
export function Analitica() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [consentimiento, setConsentimiento] = useState<Consentimiento | null>(null);

  useEffect(() => {
    if (!ANALITICA_ACTIVA) return;
    const leer = () => setConsentimiento(leerConsentimiento());
    leer();
    window.addEventListener(EVENTO_CONSENTIMIENTO, leer);
    return () => window.removeEventListener(EVENTO_CONSENTIMIENTO, leer);
  }, []);

  useEffect(() => {
    if (!ANALITICA_ACTIVA || consentimiento === null) return;
    aplicarConsentimiento(consentimiento);
    if (consentimiento === 'aceptado') cargarGtm();
  }, [consentimiento]);

  const qs = search?.toString() ?? '';
  useEffect(() => {
    if (!ANALITICA_ACTIVA) return;
    // Un tic después: el <title> de la ruta nueva ya está puesto.
    const id = window.setTimeout(() => {
      (window.dataLayer ??= []).push({
        event: EVENTO_VISTA,
        page_path: pathname + (qs ? `?${qs}` : ''),
        page_location: window.location.href,
        page_title: document.title,
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, [pathname, qs]);

  useEffect(() => {
    if (!ANALITICA_ACTIVA) return;
    const alHacerClic = (e: MouseEvent) => {
      const origen = e.target instanceof Element ? e.target : null;
      const el = origen?.closest<HTMLElement>('a[href], button, [data-evento]');
      if (!el) return;
      const href = el.getAttribute('href') ?? '';
      const etiqueta = (el.dataset.etiqueta ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
      if (el.dataset.evento) {
        evento(el.dataset.evento, { etiqueta });
        return;
      }
      if (href.startsWith('tel:')) evento('clic_llamar', { etiqueta });
      else if (/wa\.me|whatsapp\.com|^whatsapp:/.test(href)) evento('clic_whatsapp', { etiqueta });
      else if (href.startsWith('mailto:')) evento('clic_correo', { etiqueta });
    };
    // Captura: se registra antes de que el enlace navegue.
    document.addEventListener('click', alHacerClic, true);
    return () => document.removeEventListener('click', alHacerClic, true);
  }, []);

  return null;
}
