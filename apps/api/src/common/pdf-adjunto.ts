import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

/**
 * EL PDF DE LA COTIZACIÓN, ADJUNTO EN EL CORREO (2026-11-18, el dueño: «en el
 * correo debe llevar el PDF con la cotización con el precio, además del botón
 * para ir a la página»).
 *
 * El PDF lo arma el panel en el navegador, con el mismo documento de
 * «Imprimir» y de «Mandar por WhatsApp» (packages/ui, cotizador/pdf.ts), y lo
 * sube junto con el envío. Aquí no se guarda: se valida, viaja en memoria al
 * correo y se suelta. Por eso «Volver a mandar» del registro de Correo no lo
 * puede repetir y manda al documento (ver admin-mail.controller.ts).
 */
export const PDF_ADJUNTO = { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 } };

/** El PDF subido, comprobado por sus bytes; null si no vino. */
export function pdfDeLaSubida(archivo?: Express.Multer.File | null): Buffer | null {
  if (!archivo?.buffer?.length) return null;
  if (archivo.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new BadRequestException('El archivo adjunto no es un PDF.');
  }
  return archivo.buffer;
}

/**
 * Los campos del envío. Con PDF el panel manda un formulario (multipart) y el
 * resto viaja como JSON en el campo `datos`; sin PDF, el JSON de siempre.
 */
export function cuerpoDe(body: unknown): unknown {
  const datos = (body as { datos?: unknown } | null)?.datos;
  if (typeof datos !== 'string') return body;
  try {
    return JSON.parse(datos);
  } catch {
    throw new BadRequestException('Datos inválidos');
  }
}

/** «Cotizacion-MQ-2611-0009.pdf»: el mismo nombre que el PDF de WhatsApp. */
export const nombrePdf = (folio: string) => `Cotizacion-${folio.replace(/[^A-Za-z0-9-]+/g, '')}.pdf`;
