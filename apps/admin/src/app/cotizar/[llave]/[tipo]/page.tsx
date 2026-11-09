import type { Metadata, Viewport } from 'next';
import { notFound, redirect } from 'next/navigation';
import { calculadoraDelEnlace, esAccesoDirecto } from '@maqserv/config';
import { getAdmin, tieneModulo } from '@/lib/admin';
import { cargarCotizador } from '@/lib/cotizador';
import { llaveValida, cotizadorDirecto } from '@/lib/acceso-directo';
import { CotizadorPanel } from '@/app/cotizador/CotizadorPanel';
import { AppCotizador } from './AppCotizador';
import { CalculadoraEnlace } from './CalculadoraEnlace';

/**
 * ACCESO DIRECTO A UN COTIZADOR (2026-10-29).
 *
 * "Son solo para una persona, no deben ser públicos: no se entra con un botón
 * desde el panel ni desde el sitio; solo con los enlaces puedes entrar e
 * instalarlos en el celular, sin usuario ni contraseña." La dirección lleva
 * la llave (`/cotizar/<llave>/maquinaria`); sin ella, o con otra, es un 404.
 * Sin sesión, `/api/acceso-directo` la abre con la cuenta interna, que solo
 * puede usar los cotizadores, y vuelve aquí.
 *
 * Es el MISMO cotizador del panel (precios editables por cotización, clientes,
 * historial), sin el menú lateral. El manifiesto para instalarlo también lleva
 * la llave: el ícono del celular abre directo aquí.
 *
 * LOS SIETE COTIZADORES (2026-11-06, pedido del dueño: "un menú con todos los
 * cotizadores, como aparece en la web, ya no solo triturados y maquinaria").
 * El segmento `[tipo]` es la clave del cotizador del sitio (maquinaria, agua,
 * acarreos, carpeta-asfaltica, materiales, triturados, venta-de-maquinaria) y
 * la cotización abre con esa categoría.
 *
 * LAS CALCULADORAS DE MATERIAL (2026-11-09): `calculadora-pavimento` y
 * `m3-a-toneladas` abren en el mismo marco, con el mismo menú. "Por el momento
 * solo se deben mostrar en el enlace": no están en el sitio ni en el panel.
 */
type Params = { params: Promise<{ llave: string; tipo: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { llave, tipo: t } = await params;
  if (!llaveValida(llave)) return {};
  const calc = calculadoraDelEnlace(t);
  // Sin manifiesto propio: se instala desde un cotizador; la calculadora vive en su menú.
  if (calc) return { title: calc.titulo, robots: { index: false, follow: false }, referrer: 'no-referrer' };
  const c = cotizadorDirecto(t);
  if (!c) return {};
  return {
    title: `Cotizador de ${c.titulo.toLowerCase()}`,
    manifest: `/cotizar/${llave}/${c.clave}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: c.titulo, statusBarStyle: 'black-translucent' },
    // Con tamaño: así el iPhone usa este y no el ícono general del panel.
    icons: { apple: [{ url: `/pwa/${c.clave}-180.png`, sizes: '180x180' }] },
    // La dirección es la llave: que ningún buscador la guarde.
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

export const viewport: Viewport = { themeColor: '#0b0d11' };

export default async function CotizadorDirecto({ params }: Params) {
  const { llave, tipo: t } = await params;
  const calc = calculadoraDelEnlace(t);
  const c = cotizadorDirecto(t);
  if ((!c && !calc) || !llaveValida(llave)) notFound();

  // Sin sesión (o una sin el cotizador): la abre el enlace y vuelve aquí.
  const admin = await getAdmin();
  if (!admin || !tieneModulo(admin, 'cotizador')) redirect(`/api/acceso-directo?llave=${encodeURIComponent(llave)}&tipo=${(calc ?? c)!.clave}`);
  const nombre = esAccesoDirecto(admin.email) ? null : admin.name;

  // Una calculadora de material: no carga tabuladores ni productos.
  if (calc || !c) {
    return (
      <AppCotizador clave={t} llave={llave} nombre={nombre}>
        <CalculadoraEnlace clave={t} llave={llave} />
      </AppCotizador>
    );
  }

  // Como en /cotizador/<tipo>: los dos tabuladores (una cotización lleva cualquier
  // categoría, 2026-11-03); sin API, los de fábrica, y el servidor recalcula al guardar.
  const { tabuladores, productos } = await cargarCotizador();

  return (
    <AppCotizador clave={c.clave} llave={llave} nombre={nombre}>
      <CotizadorPanel
        // Otra categoría del menú = otra cotización, desde cero.
        key={c.clave}
        tabuladores={tabuladores}
        entrada={c.tipo}
        categoria={c.clave}
        productos={productos}
        titulo={`Cotizador de ${c.titulo.toLowerCase()}`}
        resumen={c.resumen}
        app
      />
    </AppCotizador>
  );
}
