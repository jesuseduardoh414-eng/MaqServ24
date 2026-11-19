import { documentoPdf, type DatosDocumento } from '@maqserv/ui';
import { datosDelDocumento, type CotizacionDetalle } from './documento-cotizacion';

/**
 * EL PDF QUE VA ADJUNTO EN EL CORREO DE LA COTIZACIÓN (2026-11-18, el dueño:
 * «en el correo debe llevar el PDF con la cotización con el precio, además del
 * botón para ir a la página»).
 *
 * Es el mismo documento de «Imprimir» y de «Mandar por WhatsApp», hecho en el
 * navegador (la API no tiene con qué dibujarlo). Solo para componentes de
 * cliente. Devuelve null si no se pudo armar: quien lo llama decide si manda
 * el correo sin él.
 */

/** «Cotizacion-MQ-2611-0009.pdf», igual que el de WhatsApp y el de la API. */
export const nombrePdf = (folio: string) => `Cotizacion-${folio.replace(/[^A-Za-z0-9-]+/g, '')}.pdf`;

export async function pdfDeDatos(datos: Omit<DatosDocumento, 'logo'>, logo: string | null): Promise<File | null> {
  try {
    const blob = await documentoPdf({ ...datos, logo });
    return new File([blob], nombrePdf(datos.folio), { type: 'application/pdf' });
  } catch {
    return null;
  }
}

/** El PDF de un documento guardado, leyéndolo de la API (para «Mandar precio» de Solicitudes). */
export async function pdfDelDocumento(id: number, logo: string | null): Promise<File | null> {
  try {
    const r = await fetch(`/api/admin/quoter/quotes/${id}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const cot = (await r.json()) as CotizacionDetalle;
    return await pdfDeDatos(datosDelDocumento(cot), logo);
  } catch {
    return null;
  }
}
