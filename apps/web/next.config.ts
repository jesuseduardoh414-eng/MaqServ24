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

/**
 * Dominios desde los que se aceptan Server Actions además del propio host.
 *
 * La única Server Action del sitio es la de /vista-previa (el panel la usa
 * para pintar las secciones con cambios sin publicar). Next compara el
 * `Origin` con `x-forwarded-host`/`host`, y detrás del proxy de cPanel el
 * host puede llegar como la dirección interna de Node (ver lib/origen.ts):
 * sin esta lista la acción se rechazaría en producción.
 */
const dominioPublico = (() => {
  try {
    return process.env.SITE_URL ? new URL(process.env.SITE_URL).hostname.replace(/^www\./, '') : null;
  } catch {
    return null;
  }
})();
const origenesAcciones = [...new Set([dominioPublico ?? 'maqserv24.com', 'maqserv24.com'])].flatMap((d) => [d, `www.${d}`]);

const nextConfig: NextConfig = {
  ...(standalone ? { output: 'standalone' as const, outputFileTracingRoot: repoRoot } : {}),
  /**
   * Marca de la compilación, incrustada en el service worker (/sw.js). Cada
   * `next build` produce un valor distinto → el navegador ve un worker nuevo →
   * instala el nuevo y borra las cachés de la versión anterior. Sin esto, una
   * PWA instalada podría quedarse con activos de un despliegue viejo.
   */
  env: { BUILD_STAMP: new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 12) },
  experimental: {
    serverActions: {
      allowedOrigins: origenesAcciones,
      // La vista previa del hero puede traer la imagen nueva (aún sin subir)
      // como data URL reducida; el tope por defecto es 1 MB.
      bodySizeLimit: '4mb',
    },
  },
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
    // Destinos en /servicios (2026-10-08): sin venta en línea /productos solo
    // redirige ahí, y apuntar directo evita encadenar dos saltos.
    return [
      { source: '/product/:id/:slug', destination: '/servicios/:slug-:id', permanent: true },
      { source: '/category/:slug', destination: '/servicios?categoria=:slug', permanent: true },
      { source: '/category/:slug/:sort', destination: '/servicios?categoria=:slug', permanent: true },
      { source: '/subcategory/:slug', destination: '/servicios', permanent: true },
      { source: '/subcategory/:slug/:sort', destination: '/servicios', permanent: true },
      { source: '/childcategory/:slug', destination: '/servicios', permanent: true },
      { source: '/childcategory/:slug/:sort', destination: '/servicios', permanent: true },
      { source: '/search/:q', destination: '/servicios?q=:q', permanent: true },
      { source: '/search/:q/:sort', destination: '/servicios?q=:q', permanent: true },
      // Equivalentes definitivos de las páginas legacy
      { source: '/faq', destination: '/', permanent: true }, // FAQ es sección de la home
      { source: '/contact', destination: '/contacto', permanent: true },
      // Antes iban a /vendedores, que da 404 desde que se apagó el marketplace
      // (MARKETPLACE_ACTIVO=false): un 301 a un 404 tira el valor SEO de la
      // URL vieja. El catálogo es lo más parecido a "tiendas"/"marcas".
      { source: '/stores', destination: '/servicios', permanent: true },
      { source: '/Marcas', destination: '/servicios', permanent: true },
      // /rastreo se quitó con las compras en línea (2026-10-08): ya no hay
      // pedidos que rastrear; la URL vieja cae en la home en vez de un 404.
      { source: '/track', destination: '/', permanent: true },
      // El pie del sitio (Diseño → Footer, en la BD) todavía enlaza "Rastrear
      // pedido" a /rastreo. Lo más cercano hoy es el seguimiento de sus
      // cotizaciones; temporal, no permanente, por si la ruta vuelve a usarse.
      { source: '/rastreo', destination: '/cuenta/cotizaciones', permanent: false },
    ];
  },
};

export default nextConfig;
