import type { MetadataRoute } from 'next';
import { RUTAS_PRIVADAS, SITE_URL } from '@/lib/seo';

/**
 * /robots.txt. Lo público se rastrea; lo privado (sesión, trámites, login) no.
 * La lista vive en lib/seo.ts para que robots, el `noindex` de cada página y
 * el sitemap no se contradigan. `/_next/` se queda abierto a propósito: Google
 * necesita el CSS y el JS para renderizar la página.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: RUTAS_PRIVADAS },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
