import {
  correoAsignacionAAliado, correoCobroRecordatorio, correoCotizacionPorVencer, correoCotizacionRespondida,
  correoFacturaAliadoPendiente, correoHoraDeSalir, correoOfertaAAliado, correoPagoAliado,
  correoRecordatorioOferta, correoServicioAvanzo,
} from './email-templates';
import { CORREOS, DISENO_FABRICA, leerDiseno, leerTextos, type DisenoCorreo, type Previa } from './textos-correo';

/**
 * VISTA PREVIA DE UN CORREO (2026-10-28). Arma el correo con la MISMA
 * plantilla que manda el sistema, con datos de ejemplo. Los textos y el diseño
 * que se le pasan (lo que la persona está escribiendo, aún sin guardar) van
 * encima de lo guardado, y se le entregan a la plantilla como `previa`: ella
 * los usa en vez de leer el ajuste. Lo que se ve es lo que sale.
 */
const SITIO = process.env.SITE_URL ?? 'https://maqser24.com';

export async function previaDe(kind: string, textos: Record<string, string>, diseno?: Partial<DisenoCorreo>): Promise<{ subject: string; html: string }> {
  const def = Object.prototype.hasOwnProperty.call(CORREOS, kind) ? CORREOS[kind] : undefined;
  if (!def) throw new Error('correo desconocido');
  const [guardados, guardadoDiseno] = await Promise.all([leerTextos(), leerDiseno()]);
  const previa: Previa = {
    textos: { ...(guardados[kind] ?? {}), ...textos },
    diseno: { ...DISENO_FABRICA, ...guardadoDiseno, ...(diseno ?? {}) },
  };
  return armar(kind, def.ejemplo, previa);
}

async function armar(kind: string, e: Record<string, string>, p: Previa): Promise<{ subject: string; html: string }> {
  const url = `${SITIO}/aliado?t=ejemplo`;
  switch (kind) {
    case 'quote_answered':
      return correoCotizacionRespondida({ nombre: e.nombre, folio: e.folio, total: 48720, validUntil: e.vigencia, included: 'Operador y diésel', excluded: 'Permisos de obra', documento: e.documento }, p);
    case 'quote_expiring':
      return correoCotizacionPorVencer({ nombre: e.nombre, folio: e.folio, total: 48720, validUntil: e.vigencia, dias: 1 }, p);
    case 'service_status':
      return correoServicioAvanzo({ nombre: e.nombre, folio: e.folio, etapa: 'En camino', mensaje: e.mensaje, aliados: [e.aliados], cierre: null, llegada: e.llegada }, p);
    case 'provider_offer':
      return correoOfertaAAliado({ aliado: e.aliado, contacto: e.contacto, categoria: e.categoria, zona: 'Apodaca', folio: e.folio, detalle: 'Excavación para cimentación, 3 días.', pago: { monto: 41400, masIva: true }, partidas: [{ concepto: 'Excavadora 20 t c/ cucharón', cantidad: '3 días' }], url, automatica: true }, p);
    case 'provider_offer_reminder':
      return correoRecordatorioOferta({ aliado: e.aliado, contacto: e.contacto, folio: e.folio, categoria: e.categoria, zona: e.zona, esperando: e.esperando, url }, p);
    case 'provider_assigned':
      return correoAsignacionAAliado({ aliado: e.aliado, contacto: e.contacto, folio: e.folio, categoria: e.categoria, zona: 'Apodaca', direccion: e.direccion, contactoObra: 'Ing. Pérez', telefonoObra: '81 1234 5678', requisitos: e.requisitos.split(' · ') }, p);
    case 'provider_departure':
      return correoHoraDeSalir({ contacto: e.contacto, folio: e.folio, obra: e.obra, direccion: e.direccion, llegada: e.llegada, salida: e.salida, minutos: 55, url, tarde: false }, p);
    case 'cobro_recordatorio':
      return correoCobroRecordatorio({ nombre: e.nombre, folio: e.folio, servicio: 'Excavadora 20 t · 3 días', saldo: 48720, vence: e.vence, dias: -3, datosPago: { banco: 'BBVA', clabe: '012345678901234567', beneficiario: 'MAQSER24 S.A. de C.V.' }, url: `${SITIO}/cuenta` }, p);
    case 'factura_aliado_pendiente':
      return correoFacturaAliadoPendiente({ contacto: e.contacto, servicios: [{ folio: e.folio, monto: 41400 }, { folio: 'COT-ADM00009', monto: 16269 }], url }, p);
    case 'pago_aliado':
      return correoPagoAliado({ contacto: e.contacto, servicios: [{ folio: 'COT-ADM00009', monto: 16269 }], referencia: 'SPEI 4471', fecha: e.fecha }, p);
    default:
      throw new Error('sin vista previa');
  }
}
