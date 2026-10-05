import type { Metadata } from 'next';
import { VistaPreviaCliente } from './VistaPreviaCliente';
import { pintarVistaPrevia } from './pintar';

export const metadata: Metadata = {
  title: 'Vista previa',
  robots: { index: false, follow: false },
};

/**
 * Lienzo de la vista previa del panel (Diseño → cualquier sección). No tiene
 * contenido propio: espera a que el panel, que la carga en un iframe, le mande
 * los cambios sin publicar. Ver `vista-previa.ts` en @maqserv/config.
 *
 * La acción se importa AQUÍ (en el servidor) y baja al cliente como prop, en vez
 * de importarla desde el componente cliente. Así las secciones entran en el
 * árbol de esta página y sus componentes cliente (Image, CountUp, Carousel…)
 * quedan en el manifiesto; si no, React no puede mandarlos y la acción falla con
 * "Could not find the module … in the React Client Manifest".
 */
export default function VistaPreviaPage() {
  return <VistaPreviaCliente pintar={pintarVistaPrevia} />;
}
