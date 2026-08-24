import type { ReactNode } from 'react';
import { themeToCss } from '@maqserv/config';
import { getTheme, t } from '@/lib/theme';
import { CartProvider } from '@/components/CartProvider';
import { DevAutoRefresh } from '@/components/DevAutoRefresh';
import './globals.css';

export async function generateMetadata() {
  const theme = await getTheme();
  return { title: t(theme, 'site.name') };
}

/**
 * Familias de Google Fonts que existen en UN SOLO peso. Pedirles un eje `wght`
 * hace que Google devuelva 400 y no cargue la fuente.
 */
const FUENTES_UN_SOLO_PESO = new Set(['Archivo Black', 'Ultra', 'Bungee', 'Lobster', 'Pacifico']);

/**
 * URLs de Google Fonts a partir de las familias del tema (configurables).
 *
 * Devuelve UNA URL POR FAMILIA a propósito. Antes iban todas en un solo
 * stylesheet, y bastaba que una familia fuera inválida para que Google
 * respondiera 400 y el sitio se quedara sin NINGUNA fuente — incluida la de
 * texto. Separadas, una familia rota solo se pierde a sí misma.
 *
 * Las familias de titular también piden pesos: la identidad MAQSER24 usa Inter
 * Tight, que es variable, y sin el eje `wght` Google sirve solo el peso 400 —
 * los titulares saldrían en regular. Las de un solo peso van sin eje.
 */
function googleFontsHrefs(sans: string, displayFamilies: Array<string | undefined>): string[] {
  const enc = (f: string) => f.replace(/ /g, '+');
  const url = (spec: string) => `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
  const hrefs = [url(`${enc(sans)}:wght@300;400;500;600;700;800`)];
  for (const fam of new Set(displayFamilies.filter((f): f is string => Boolean(f) && f !== sans))) {
    hrefs.push(url(FUENTES_UN_SOLO_PESO.has(fam) ? enc(fam) : `${enc(fam)}:wght@400;500;600;700;800`));
  }
  return hrefs;
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {googleFontsHrefs(fontSans, [fontHeading, fontDisplay]).map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
        {theme.tokens.branding?.favicon ? <link rel="icon" href={theme.tokens.branding.favicon} /> : null}
        {theme.tokens.branding?.icon ? <link rel="apple-touch-icon" href={theme.tokens.branding.icon} /> : null}
        <style
          id="theme-tokens"
          dangerouslySetInnerHTML={{ __html: themeToCss(theme.tokens) }}
        />
      </head>
      <body>
        <CartProvider>{children}</CartProvider>
        <DevAutoRefresh />
      </body>
    </html>
  );
}
