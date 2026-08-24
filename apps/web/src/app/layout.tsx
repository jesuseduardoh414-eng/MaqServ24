import type { ReactNode } from 'react';
import { googleFontsHrefs, themeToCss } from '@maqserv/config';
import { getTheme, t } from '@/lib/theme';
import { CartProvider } from '@/components/CartProvider';
import { DevAutoRefresh } from '@/components/DevAutoRefresh';
import './globals.css';

export async function generateMetadata() {
  const theme = await getTheme();
  return { title: t(theme, 'site.name') };
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
