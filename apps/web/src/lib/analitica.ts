/**
 * Medición del sitio: Google Tag Manager + Consent Mode v2.
 *
 * En el código va SOLO GTM. GA4, Google Ads y cualquier píxel se configuran
 * desde el panel de GTM. Con `NEXT_PUBLIC_GTM_ID` vacía no se carga nada.
 *
 * REGLA: a `dataLayer` no van datos personales (correo, teléfono, nombre).
 * Solo nombres de evento, etiquetas de botones y categorías.
 */

export const GTM_ID = (process.env.NEXT_PUBLIC_GTM_ID ?? '').trim();
export const ANALITICA_ACTIVA = /^GTM-[A-Z0-9]+$/.test(GTM_ID);

/**
 * UN solo nombre de evento para todo el negocio; el nombre real viaja en
 * `nombre_evento`. Así basta un disparador en GTM ("evento personalizado =
 * sitio_evento") y una variable de capa de datos para `nombre_evento`.
 */
export const EVENTO = 'sitio_evento';
/** Vista de página en cada cambio de ruta (GA4 con el page_view automático apagado). */
export const EVENTO_VISTA = 'vista_pagina';

export type Consentimiento = 'aceptado' | 'rechazado';
const CLAVE = 'cookies-consentimiento';
/** Se dispara en `window` cuando el visitante decide (o cambia) su consentimiento. */
export const EVENTO_CONSENTIMIENTO = 'cookies-consentimiento-cambio';
/** Se dispara en `window` para volver a abrir el aviso (enlace "Cookies" del pie). */
export const EVENTO_ABRIR_AVISO = 'cookies-abrir';

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export function leerConsentimiento(): Consentimiento | null {
  try {
    const v = localStorage.getItem(CLAVE);
    return v === 'aceptado' || v === 'rechazado' ? v : null;
  } catch {
    return null;
  }
}

export function guardarConsentimiento(valor: Consentimiento) {
  try { localStorage.setItem(CLAVE, valor); } catch { /* sin storage: vale para esta visita */ }
  window.dispatchEvent(new Event(EVENTO_CONSENTIMIENTO));
}

/**
 * `gtag` como lo define Google: empuja el objeto `arguments` (no un array).
 * Consent Mode lo necesita así; con un array GTM no reconoce la orden.
 */
export function gtag(..._args: unknown[]) {
  // eslint-disable-next-line prefer-rest-params
  (window.dataLayer ??= []).push(arguments);
}

const TODO_DENEGADO = {
  ad_storage: 'denied',
  analytics_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
} as const;
const TODO_CONCEDIDO = {
  ad_storage: 'granted',
  analytics_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted',
} as const;

/** Aplica el consentimiento sin recargar: GTM deja de enviar en cuanto se retira. */
export function aplicarConsentimiento(valor: Consentimiento) {
  gtag('consent', 'update', valor === 'aceptado' ? TODO_CONCEDIDO : TODO_DENEGADO);
}

/**
 * Script en línea para el <head>, ANTES de cualquier etiqueta: declara Consent
 * Mode v2 con todo denegado. Lo estrictamente necesario (funcionalidad y
 * seguridad) sí se concede; no son cookies de rastreo.
 */
export const SCRIPT_CONSENTIMIENTO_DEFAULT =
  "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}" +
  "gtag('consent','default',{ad_storage:'denied',analytics_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:500});";

/** Carga gtm.js una sola vez (el snippet oficial, sin iframe: sin JS no hay consentimiento posible). */
export function cargarGtm() {
  if (!ANALITICA_ACTIVA) return;
  if (document.querySelector('script[src*="googletagmanager.com/gtm.js"]')) return;
  (window.dataLayer ??= []).push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`;
  document.head.appendChild(s);
}

/**
 * Evento de negocio. Se empuja aunque GTM aún no haya cargado: la capa de
 * datos es un array y GTM procesa lo acumulado al arrancar. Si el visitante
 * nunca acepta, se queda en memoria y no sale a ningún lado.
 */
export function evento(nombre: string, params: Record<string, string | number | boolean> = {}) {
  if (typeof window === 'undefined' || !ANALITICA_ACTIVA) return;
  (window.dataLayer ??= []).push({ event: EVENTO, nombre_evento: nombre, ...params });
}
