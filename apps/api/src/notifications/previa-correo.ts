import {
  correoAccesoAliado, correoAcuseContacto, correoAcuseProveedor, correoAcuseSolicitud, correoAcuseSolicitudAMedida,
  correoAsignacionAAliado, correoBienvenida, correoCierreMes, correoCobroRecordatorio, correoConfirmarCuenta,
  correoContactoInterno, correoCotizacionDelPanel, correoCotizacionPorVencer, correoCotizacionRespondida,
  correoEquipoPropuesto, correoEquipoPublicado, correoEquipoRechazado, correoFacturaAliadoPendiente, correoHoraDeSalir,
  correoInvitacionAliado, correoInvitacionPanel, correoMensajeRespondido, correoOfertaAAliado, correoPagoAliado,
  correoPreguntaRespondida, correoRecordatorioAliado, correoRecordatorioOferta, correoRecordatorioServicio,
  correoRestablecerContrasena, correoServicioAvanzo, correoServicioCanceladoAliado, correoSolicitudAMedidaInterna,
  correoSolicitudInterna, correoSolicitudProveedorInterno,
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
      return correoServicioAvanzo({ nombre: e.nombre, folio: e.folio, etapa: 'En camino', mensaje: e.mensaje, aliados: [e.aliados], cierre: null, llegada: e.llegada, unidad: e.unidad }, p);
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

    // Segunda entrega (2026-11-09)
    case 'quoter_request_ack':
      return correoAcuseSolicitud({ nombre: e.nombre, folio: e.folio, cotizador: e.cotizador, url: `${SITIO}/cuenta/cotizaciones/${e.folio}` }, p);
    case 'quote_request_ack':
      return correoAcuseSolicitudAMedida({ nombre: e.nombre, folio: e.folio, pidio: e.pidio, url: `${SITIO}/cuenta/cotizaciones/${e.folio}` }, p);
    case 'quoter_quote_sent':
      return correoCotizacionDelPanel({
        nombre: e.nombre, folio: e.folio, cotizador: e.cotizador, obra: e.obra,
        saludo: 'Con gusto te compartimos la cotización que nos pediste.',
        renglones: [
          { clase: 'equipo', concepto: 'Retroexcavadora 4x4 con operador', unidad: 'HR', cantidad: 8, pu: 950, importe: 7600 },
          { clase: 'flete', concepto: 'Flete ida y vuelta', unidad: 'VIAJE', cantidad: 1, pu: 2500, importe: 2500 },
        ],
        subtotal: 10100, iva: 1616, total: 11716,
        condiciones: [{ titulo: 'Condiciones', puntos: ['Mínimo 8 horas por equipo.', 'Precios más IVA.'] }],
        notas: null,
        firma: { nombre: 'Carlos Pérez', puesto: 'Ventas', telefono: '81 1234 5678' },
        aceptarUrl: `${SITIO}/cotizacion/aceptar?t=ejemplo`,
      }, p);
    case 'service_day_before':
      return correoRecordatorioServicio({ para: 'cliente', nombre: e.nombre, folio: e.folio, llegada: e.llegada, aliado: e.aliado, obra: e.obra, direccion: e.direccion, unidad: 'Eco. 12 · placas RX-12-345', url: `${SITIO}/cuenta/cotizaciones/${e.folio}` }, p);
    case 'provider_day_before':
      return correoRecordatorioServicio({ para: 'aliado', nombre: e.contacto, folio: e.folio, llegada: e.llegada, aliado: null, obra: e.obra, direccion: e.direccion, requisitos: e.requisitos.split(' · '), url }, p);
    case 'provider_cancelled':
      return correoServicioCanceladoAliado({ contacto: e.contacto, folio: e.folio, categoria: e.categoria, direccion: e.direccion, motivo: e.motivo }, p);
    case 'provider_access':
      return correoAccesoAliado({ aliado: e.aliado, contacto: e.contacto, url, dias: 30, porContestar: 2 }, p);
    case 'provider_invite':
      return correoInvitacionAliado({ nombre: e.empresa, contacto: e.contacto, url: `${SITIO}/proveedores?invitacion=ejemplo` }, p);
    case 'availability_reminder':
      return correoRecordatorioAliado({ aliado: e.aliado, contacto: e.contacto, url, documentos: [{ texto: 'Falta', nombre: 'Constancia de situación fiscal' }, { texto: 'Vence el 20 de noviembre', nombre: 'Póliza de seguro' }] }, p);
    case 'provider_offer_published':
      return correoEquipoPublicado({ contacto: e.contacto, equipo: e.equipo, tipo: e.tipo }, p);
    case 'provider_offer_rejected':
      return correoEquipoRechazado({ contacto: e.contacto, equipo: e.equipo, motivo: e.motivo }, p);
    case 'provider_signup_ack':
      return correoAcuseProveedor({ nombre: e.nombre }, p);
    case 'contact_ack':
      return correoAcuseContacto({ nombre: e.nombre, mensaje: '', telefono: null }, p);
    case 'contact_reply':
      return correoMensajeRespondido({ nombre: e.nombre, mensaje: e.mensaje, respuesta: e.respuesta }, p);
    case 'question_answered':
      return correoPreguntaRespondida({ nombre: e.nombre, pregunta: e.pregunta, respuesta: e.respuesta, url: '/preguntas-frecuentes' }, p);
    case 'email_verification':
      return correoConfirmarCuenta({ nombre: e.nombre, url: `${SITIO}/api/auth/verificar?t=ejemplo`, horas: Number(e.horas) }, p);
    case 'welcome':
      return correoBienvenida({ nombre: e.nombre, url: `${SITIO}/cuenta` }, p);
    case 'password_reset':
      return correoRestablecerContrasena({ nombre: e.nombre, url: `${SITIO}/restablecer?token=ejemplo`, minutos: 60 }, p);
    case 'quoter_request_internal':
      return correoSolicitudInterna({ folio: e.folio, cotizador: e.cotizador, cliente: e.cliente, correo: 'laura@ejemplo.com', telefono: '81 1234 5678', municipio: 'Escobedo', obra: 'Bodega Escobedo', total: 18560, conceptos: ['Grava 3/4" · 28 t', 'Flete a obra'], url: `${SITIO}/cotizaciones` }, p);
    case 'quote_request_internal':
      return correoSolicitudAMedidaInterna({ folio: e.folio, cliente: 'Laura Treviño', empresa: e.cliente, correo: 'laura@ejemplo.com', telefono: '81 1234 5678', pidio: 'Grúa de 30 t con operador, 2 días', direccion: 'Av. Industrial 1500, Apodaca', fecha: '20 de noviembre de 2026', comentarios: null, url: `${SITIO}/cotizaciones` }, p);
    case 'contact_internal':
      return correoContactoInterno({ nombre: e.nombre, correo: 'pedro@ejemplo.com', telefono: '81 1234 5678', empresa: 'Constructora Ramírez', tema: 'Renta de maquinaria', mensaje: '¿Rentan retroexcavadora por semana en Apodaca?', url: `${SITIO}/mensajes` }, p);
    case 'provider_signup_internal':
      return correoSolicitudProveedorInterno({ nombre: e.nombre, tipo: 'Empresa', contacto: 'Mario', telefono: '81 1234 5678', correo: 'mario@ejemplo.com', ubicacion: 'Apodaca, N.L.', ofrece: 'Grúas', mensaje: 'Tenemos 3 grúas de 30 t.', url: `${SITIO}/proveedores` }, p);
    case 'provider_offer_review':
      return correoEquipoPropuesto({ aliado: e.aliado, equipo: e.equipo, marca: e.marca, linea: e.linea, url: `${SITIO}/catalogo` }, p);
    case 'admin_invitacion':
      return correoInvitacionPanel({ nombre: e.nombre, invitadoPor: e.quien, rolNombre: e.rol, url: `${SITIO}/restablecer?token=ejemplo&nuevo=1`, dias: Number(e.dias) }, p);
    case 'cierre_mes':
      return correoCierreMes({ mes: e.mes, servicios: 20, ventas: 241500, pagoAliados: 169800, margen: 71700, porCobrar: 28000, vencido: 6500, porPagar: 16269, url: `${SITIO}/administracion/margen` }, p);
    default:
      throw new Error('sin vista previa');
  }
}
