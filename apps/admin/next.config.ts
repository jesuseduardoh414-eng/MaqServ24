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
  transpilePackages: ['@maqserv/ui'],
  images: {
    remotePatterns: [
      // Assets migrados a Supabase Storage (bucket público `media`).
      { protocol: 'https', hostname: 'kxewnuotuolwloccusqx.supabase.co', pathname: '/storage/v1/object/public/media/**' },
      { protocol: 'https', hostname: 'scava.website' },
      { protocol: 'http', hostname: 'localhost', port: '4000' },
    ],
  },
};

export default nextConfig;
