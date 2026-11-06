import { NextResponse } from 'next/server';
import { llaveValida, cotizadorDirecto } from '@/lib/acceso-directo';

/**
 * El manifiesto para instalar el acceso directo (2026-10-29). Lleva la llave
 * en `start_url`: el ícono del celular abre el cotizador ya con ella, también
 * en el iPhone, donde la app instalada no comparte sesión con Safari. Sin la
 * llave correcta, 404.
 *
 * Desde 2026-11-06 hay uno por cada cotizador del menú (agua, acarreos…). El
 * `id` de maquinaria y triturados no cambia: lo ya instalado sigue igual.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ llave: string; tipo: string }> }) {
  const { llave, tipo: t } = await params;
  const c = cotizadorDirecto(t);
  if (!c || !llaveValida(llave)) return new NextResponse('No encontrado', { status: 404 });
  const nombre = c.titulo;
  const manifiesto = {
    id: `/cotizar/${c.clave}`,
    name: `Cotizador de ${nombre.toLowerCase()} · MAQSER24`,
    short_name: nombre,
    description: `Acceso directo al cotizador de ${nombre.toLowerCase()} de MAQSER24.`,
    lang: 'es-MX',
    start_url: `/cotizar/${llave}/${c.clave}`,
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b0d11',
    theme_color: '#0b0d11',
    icons: [
      { src: `/pwa/${c.clave}-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `/pwa/${c.clave}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `/pwa/${c.clave}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  return new NextResponse(JSON.stringify(manifiesto), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' },
  });
}
