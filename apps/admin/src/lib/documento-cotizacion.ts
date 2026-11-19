import type { CalculoCotizacion, CotizadorTipo, EmpresaCotizador, FirmaCotizador, PagoCotizador } from '@maqserv/config';
import { COTIZADORES_META } from '@maqserv/config';
import type { DatosDocumento } from '@maqserv/ui';

/** Una cotización emitida, como la da la API (`/admin/quoter/quotes/:id`). */
export interface CotizacionDetalle {
  id: number;
  tipo: CotizadorTipo;
  folio: string;
  origen: string;
  estado: string;
  cliente: string;
  obra: string | null;
  atencion: string | null;
  municipio: string | null;
  correo: string | null;
  telefono: string | null;
  notas: string | null;
  documento: {
    calc: CalculoCotizacion;
    empresa: EmpresaCotizador;
    firma: FirmaCotizador;
    saludo: string;
    /** Según lo que lleva: «Cotización de renta de maquinaria y servicios de agua» (2026-11-04). */
    titulo?: string;
    version: string;
    emitida: string;
    /** Fecha de inicio o entrega (2026-10-23). */
    fecha?: string;
    /** Triturados con flete (2026-10-29): la ubicación de la obra en Google Maps. */
    ubicacion?: string;
  };
  admin: string | null;
  fecha: string | null;
  /** Salió de una solicitud: la acepta el cliente (2026-10-26). */
  ligada?: boolean;
  vencida?: boolean;
  /** Datos para el pago vigentes (2026-10-30). */
  pago?: PagoCotizador | null;
}

/**
 * El documento de una cotización emitida: lo mismo para la vista, el PDF de
 * WhatsApp y el PDF que va adjunto en el correo (2026-11-18). Vive aquí, y no
 * en la página, para que «Mandar precio» de Solicitudes arme el mismo PDF.
 */
export function datosDelDocumento(cot: CotizacionDetalle): Omit<DatosDocumento, 'logo'> {
  const meta = COTIZADORES_META[cot.tipo];
  return {
    titulo: cot.documento.titulo ?? `Cotización de ${meta?.titulo?.toLowerCase() ?? cot.tipo}`,
    folio: cot.folio,
    fecha: cot.documento.emitida,
    cliente: cot.cliente,
    obra: cot.obra ?? '',
    atencion: cot.atencion ?? '',
    municipio: cot.municipio ?? '',
    notas: cot.notas ?? '',
    empresa: cot.documento.empresa,
    firma: cot.documento.firma,
    saludo: cot.documento.saludo,
    calc: cot.documento.calc,
    pago: cot.pago ?? null,
    ...(cot.documento.fecha || cot.documento.ubicacion
      ? {
          detalle: [
            ...(cot.documento.fecha ? [{
              label: cot.tipo === 'maquinaria' ? 'Inicio del servicio' : 'Fecha de entrega',
              valor: new Date(`${cot.documento.fecha}T12:00:00Z`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
            }] : []),
            // Triturados con flete (2026-10-29): dónde medir los km.
            ...(cot.documento.ubicacion ? [{ label: 'Ubicación (Google Maps)', valor: cot.documento.ubicacion }] : []),
          ],
        }
      : {}),
    mostrarPrecios: true,
  };
}
