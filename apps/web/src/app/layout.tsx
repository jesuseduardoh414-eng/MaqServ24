import { Suspense, type ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { Analitica } from '@/components/Analitica';
import { AvisoCookies } from '@/components/AvisoCookies';
import { ANALITICA_ACTIVA, SCRIPT_CONSENTIMIENTO_DEFAULT } from '@/lib/analitica';
import { googleFontsHrefs, themeToCss } from '@maqserv/config';
import { getTheme, t } from '@/lib/theme';
import { CartProvider } from '@/components/CartProvider';
import { DevAutoRefresh } from '@/components/DevAutoRefresh';
import { Pwa } from '@/components/Pwa';
import { IMAGEN_OG, SITE_URL } from '@/lib/seo';
import { fotoLigera } from '@/lib/foto';
import './globals.css';
import { FiltroDeCampos, ResultadosHost } from '@maqserv/ui';
import { EstilosSistema } from '@/components/EstilosSistema';
import { DialogosHost } from '@/components/Dialogos';

/**
 * CADUCIDAD DE LAS PÁGINAS (red de seguridad del panel).
 *
 * Sin esto, las páginas salían del build como estáticas PURAS y se quedaban
 * congeladas para siempre: medido el 2026-08-27, la home llevaba 2 h 40 min
 * sirviendo el mismo prerender (`X-Vercel-Cache: HIT` con el `Age` subiendo sin
 * parar, ni un solo `STALE`) mientras la API ya devolvía el hero recién
 * publicado. El `revalidate: 60` de los fetch (`CONTENT_CACHE`) NO bastaba.
 *
 * Al declararlo en el layout raíz, lo heredan todas las rutas: lo que el
 * cliente publica desde el panel aparece solo, como mucho un minuto después.
 *
 * Esto NO sustituye a `REVALIDATE_SECRET` (que hace el cambio instantáneo y
 * hoy falta en Vercel, ver `/api/revalidate` → 503): es la red por debajo, para
 * que una variable mal puesta no vuelva a dejar el panel sin efecto.
 */
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const theme = await getTheme();
  const nombre = t(theme, 'site.name');
  const b = theme.tokens.branding ?? {};
  return {
    // Con esto los canonical y las imágenes OG relativos de cada página salen
    // absolutos (https://maqserv24.com/...). Cada página pone su canonical con
    // paginaSeo(); aquí NO va uno, o lo heredarían todas.
    metadataBase: new URL(SITE_URL),
    title: nombre,
    description: t(theme, 'seo.home.description'),
    openGraph: { siteName: nombre, locale: 'es_MX', type: 'website', images: [{ url: IMAGEN_OG, width: 1200, height: 630, alt: nombre }] },
    twitter: { card: 'summary_large_image' },
    // PWA: manifiesto + cómo se comporta al "Agregar a inicio" en iOS (que no
    // lee el manifiesto). Los iconos del panel (Diseño → Identidad) mandan;
    // si no hay, los de marca del repo.
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, title: nombre, statusBarStyle: 'black' },
    icons: {
      // Reducido: el subido pesaba 265 KB y lo baja cada primera visita.
      icon: b.favicon ? fotoLigera(b.favicon, 96) : '/brand/favicon.png',
      apple: b.icon || '/pwa/apple-touch-icon.png',
    },
  };
}

/**
 * `theme-color` pinta la barra del sistema en la app instalada. Sale del fondo
 * del modo por defecto del tema; el componente <Pwa> lo va actualizando cuando
 * el visitante alterna claro/oscuro.
 */
export async function generateViewport(): Promise<Viewport> {
  const theme = await getTheme();
  const modo = theme.tokens.defaultMode === 'light' ? 'light' : 'dark';
  return {
    width: 'device-width',
    initialScale: 1,
    themeColor: theme.tokens.colors[modo].background,
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // El tema (colores, tipografía, radios…) viene de la BD vía API y se
  // inyecta como variables CSS ANTES del primer render: sin flash de estilos.
  const theme = await getTheme();
  const { fontSans, fontHeading, fontDisplay } = theme.tokens.typography;
  const defaultMode = theme.tokens.defaultMode ?? 'auto';
  // Anti-parpadeo: fija data-theme ANTES del primer pintado, según la
  // preferencia guardada por el usuario o el modo por defecto del tema (BD).
  const themeInit = `(function(){try{var s=localStorage.getItem('theme');var d='${defaultMode}';var m=s||(d==='auto'?'':d);if(m==='light'||m==='dark')document.documentElement.setAttribute('data-theme',m);}catch(e){}})();`;

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        {/* Consent Mode v2 con todo denegado, ANTES de cualquier etiqueta. GTM
            no se carga hasta que el visitante acepta (ver <Analitica>). */}
        {ANALITICA_ACTIVA ? <script dangerouslySetInnerHTML={{ __html: SCRIPT_CONSENTIMIENTO_DEFAULT }} /> : null}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {googleFontsHrefs(fontSans, [fontHeading, fontDisplay]).map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
        {/* Piezas comunes de todas las pantallas (ver EstilosSistema). */}
        <EstilosSistema />
        <style
          id="theme-tokens"
          dangerouslySetInnerHTML={{ __html: themeToCss(theme.tokens) }}
        />
      </head>
      <body>
        {/* Qué entra en cada campo: filtra por tipo (una letra no entra en un teléfono) y recorta espacios. */}
        <FiltroDeCampos />
        <CartProvider>{children}</CartProvider>
        {/* confirmar / pedirTexto: en lugar de los diálogos del navegador. */}
        <DialogosHost />
        {/* "Sí se hizo / no se hizo" tras cada cambio de la persona (perfil, favoritos, portal de aliado, formularios). Entrar/salir y marcar avisos leídos no avisan: ya tienen su propia respuesta. */}
        <ResultadosHost
          observar={['/api/proxy/', '/api/contacto', '/api/cotizar', '/api/proveedores', '/api/preguntas', '/api/resena', '/api/cotizacion/aceptar']}
          // La vista previa de /cotizar es un POST que no guarda nada: ni
          // "Guardado" ni "No se guardó" (si falla, la pantalla enseña la lista).
          silencio={['/api/proxy/notifications/', '/api/cotizar/vista-previa']}
          callar401
          colores={{
            fondo: 'var(--color-surface)', texto: 'var(--color-text)', borde: 'var(--color-border)', tenue: 'var(--color-text-muted)',
            ok: 'var(--color-success)', mal: 'var(--color-error)', alerta: 'var(--color-warning)', info: 'var(--color-primary)',
          }}
        />
        <Pwa
          labels={{
            brand: t(theme, 'site.name'),
            title: t(theme, 'pwa.install.title'),
            text: t(theme, 'pwa.install.text'),
            cta: t(theme, 'pwa.install.cta'),
            later: t(theme, 'pwa.install.later'),
          }}
        />
        {ANALITICA_ACTIVA ? (
          <>
            <Suspense fallback={null}>
              <Analitica />
            </Suspense>
            <AvisoCookies
              labels={{
                title: t(theme, 'cookies.title'),
                text: t(theme, 'cookies.text'),
                accept: t(theme, 'cookies.accept'),
                reject: t(theme, 'cookies.reject'),
                link: t(theme, 'cookies.link'),
              }}
            />
          </>
        ) : null}
        <DevAutoRefresh />
      </body>
    </html>
  );
}
