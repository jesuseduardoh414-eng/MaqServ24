import type { MetadataRoute } from 'next';
import { getTheme, t } from '@/lib/theme';
import { rutaCatalogo } from '@/lib/api';

/**
 * Manifiesto de la PWA (Next lo sirve en /manifest.webmanifest).
 *
 * Nombre y descripción salen de los copys del tema, como el resto del sitio;
 * los colores, de la paleta OSCURA porque es la identidad principal de
 * MAQSER24 (`defaultMode: 'dark'`): la pantalla de arranque y la barra del
 * sistema se pintan de negro tecnológico, no de blanco.
 *
 * Los iconos los genera `scripts/generar-iconos-pwa.cjs` a partir del isotipo
 * oficial. `maskable` va aparte porque Android recorta el icono con la forma
 * del launcher y solo garantiza el 80 % central.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const theme = await getTheme();
  const nombre = t(theme, 'site.name');
  const oscuro = theme.tokens.colors.dark;

  return {
    id: '/',
    name: nombre,
    short_name: nombre,
    description: t(theme, 'site.tagline'),
    lang: 'es',
    dir: 'ltr',
    // `origen=pwa` distingue en la analítica las visitas desde la app instalada.
    start_url: '/?origen=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: oscuro.background,
    theme_color: oscuro.background,
    categories: ['business'],
    icons: [
      { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/pwa/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Accesos directos al mantener pulsado el icono (Android / Windows).
    shortcuts: [
      { name: t(theme, 'nav.quoter'), url: '/cotizador?origen=pwa', icons: [{ src: '/pwa/icon-192.png', sizes: '192x192' }] },
      { name: t(theme, 'nav.services'), url: '/servicios?origen=pwa', icons: [{ src: '/pwa/icon-192.png', sizes: '192x192' }] },
      // Sin compras en línea (2026-10-08): el acceso de "Mis pedidos" pasa a
      // "Mis cotizaciones", que es lo que el cliente sí sigue desde su cuenta.
      { name: t(theme, 'account.quotes.title'), url: '/cuenta/cotizaciones?origen=pwa', icons: [{ src: '/pwa/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
