import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

/**
 * Raíz del monorepo. En auto-hospedaje el trazado de archivos tiene que arrancar
 * aquí y no en la carpeta de la app: si no, el bundle sale sin los paquetes
 * `workspace:*` (@maqserv/ui, @maqserv/config…) y revienta al arrancar.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Auto-hospedaje (cPanel/Passenger, VPS, Docker). Con `BUILD_STANDALONE=1`,
 * `next build` emite `.next/standalone/` con su propio `server.js` y SOLO las
 * dependencias que el runtime usa. Es imprescindible en cPanel, que corre
 * `npm install` y no sabe resolver los `workspace:*` de pnpm.
 *
 * Apagado por defecto para NO alterar el pipeline de Vercel, que hace su
 * propio empaquetado.
 */
const standalone = process.env.BUILD_STANDALONE === '1';

const nextConfig: NextConfig = {
  ...(standalone ? { output: 'standalone' as const, outputFileTracingRoot: repoRoot } : {}),
  /**
   * Marca de la compilación, incrustada en el service worker (/sw.js). Cada
   * `next build` produce un valor distinto → el navegador ve un worker nuevo →
   * instala el nuevo y borra las cachés de la versión anterior. Sin esto, una
   * PWA instalada podría quedarse con activos de un despliegue viejo.
   */
  env: { BUILD_STAMP: new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 12) },
  // @maqserv/ui se consume como fuente TS; Next lo transpila
  transpilePackages: ['@maqserv/ui'],
  images: {
    /**
     * 30 días de caché para cada imagen optimizada. El valor por defecto es 60 s:
     * pasado un minuto, cada tamaño de cada foto se volvía a recortar con sharp,
     * y sharp abre un hilo por núcleo del servidor. En la jaula de CloudLinux
     * los hilos cuentan como procesos (NPROC), así que esto era una parte
     * silenciosa del "100 de 100". Las fotos son inmutables —el nombre lleva la
     * fecha de subida—, así que guardarlas un mes no muestra nada viejo.
     */
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      // Legacy: fotos que aún apunten al bucket de Supabase (hasta que se re-suban a disco).
      { protocol: 'https', hostname: 'kxewnuotuolwloccusqx.supabase.co', pathname: '/storage/v1/object/public/media/**' },
      // Legacy (por si queda alguna URL de scava.website sin migrar).
      { protocol: 'https', hostname: 'scava.website' },
      // Archivos en disco: en cPanel los sirve Apache desde media.*; en local, la API en /media/.
      { protocol: 'https', hostname: 'media.maqserv24.com' },
      { protocol: 'https', hostname: 'api.maqserv24.com', pathname: '/media/**' },
      { protocol: 'http', hostname: 'localhost', port: '4000', pathname: '/media/**' },
    ],
  },
  /**
   * Redirects 301 de las URLs del Laravel viejo → rutas nuevas.
   * CRÍTICO para conservar el SEO al lanzar. Nuestro slug termina en -id,
   * y el parser solo lee el id, así que el texto del slug viejo da igual.
   */
  async redirects() {
    return [
      { source: '/product/:id/:slug', destination: '/productos/:slug-:id', permanent: true },
      { source: '/category/:slug', destination: '/productos?categoria=:slug', permanent: true },
      { source: '/category/:slug/:sort', destination: '/productos?categoria=:slug', permanent: true },
      { source: '/subcategory/:slug', destination: '/productos', permanent: true },
      { source: '/subcategory/:slug/:sort', destination: '/productos', permanent: true },
      { source: '/childcategory/:slug', destination: '/productos', permanent: true },
      { source: '/childcategory/:slug/:sort', destination: '/productos', permanent: true },
      { source: '/search/:q', destination: '/productos?q=:q', permanent: true },
      { source: '/search/:q/:sort', destination: '/productos?q=:q', permanent: true },
      // Equivalentes definitivos de las páginas legacy
      { source: '/faq', destination: '/', permanent: true }, // FAQ es sección de la home
      { source: '/contact', destination: '/contacto', permanent: true },
      { source: '/stores', destination: '/vendedores', permanent: true },
      { source: '/Marcas', destination: '/vendedores', permanent: true },
      { source: '/track', destination: '/rastreo', permanent: true },
    ];
  },
};

export default nextConfig;
