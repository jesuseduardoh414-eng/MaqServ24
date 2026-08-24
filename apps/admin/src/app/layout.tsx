import type { ReactNode } from 'react';
import { defaultTheme, themeSchema, themeToCss } from '@maqserv/config';
import { BrandingProvider } from '@/components/branding';
import './globals.css';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

// DEV: sin caché para ver los logos/tokens recién subidos al instante.
// PROD: ISR 60s. (Misma política que la web.)
const THEME_CACHE: RequestInit =
  process.env.NODE_ENV === 'production' ? { next: { revalidate: 60 } } : { cache: 'no-store' };

export const metadata = { title: 'Admin — MAQSER24' };

/** El admin comparte los tokens del tema activo (colores/tipografía/branding de la BD). */
export default async function RootLayout({ children }: { children: ReactNode }) {
  let tokens = defaultTheme.tokens;
  try {
    const res = await fetch(`${API_URL}/theme`, THEME_CACHE);
    if (res.ok) tokens = themeSchema.parse(await res.json()).tokens;
  } catch {
    /* tokens default */
  }
  const branding = tokens.branding ?? {};

  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css" />
        <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/bold/style.css" />
        {branding.favicon ? <link rel="icon" href={branding.favicon} /> : null}
        {branding.icon ? <link rel="apple-touch-icon" href={branding.icon} /> : null}
        <style id="theme-tokens" dangerouslySetInnerHTML={{ __html: themeToCss(tokens) }} />
      </head>
      <body>
        <BrandingProvider value={branding}>{children}</BrandingProvider>
      </body>
    </html>
  );
}
