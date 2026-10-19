import type { ModuloAdmin } from './admin-roles';

/**
 * DE QUÉ MÓDULO ES CADA CORREO (2026-10-12).
 *
 * "Solo deben ver los correos de ellos": en Configuración › Correo cada rol ve
 * los correos de los módulos que atiende, y un correo que falla avisa en la
 * campana de quien atiende ese módulo. Dirección los ve todos.
 *
 * Un tipo que no esté aquí cae en 'configuracion' (solo Dirección): si alguien
 * agrega un correo nuevo y olvida esta tabla, se esconde de más, no se enseña
 * de más.
 */
export const MODULO_DE_CORREO: Record<string, ModuloAdmin> = {
  // Solicitudes del sitio y su respuesta.
  quote_answered: 'cotizaciones',
  quote_expiring: 'cotizaciones',
  quoter_request_internal: 'cotizaciones',
  quoter_request_ack: 'cotizaciones',
  quoter_request_provider: 'cotizaciones',
  quoter_quote_sent: 'cotizador',
  // El servicio en marcha: avances al cliente y ofertas/asignaciones al aliado.
  service_status: 'servicios',
  provider_offer: 'servicios',
  provider_assigned: 'servicios',
  provider_departure: 'servicios',
  provider_day_before: 'servicios',
  service_day_before: 'servicios',
  provider_departure_late: 'servicios',
  // La red de aliados.
  provider_access: 'proveedores',
  provider_offer_review: 'proveedores',
  provider_offer_published: 'proveedores',
  provider_offer_rejected: 'proveedores',
  provider_signup_internal: 'proveedores',
  provider_signup_ack: 'proveedores',
  availability_reminder: 'disponibilidad',
  // Mensajes y cuentas del sitio (Mensajes y Cuentas del sitio son 'comunidad').
  contact_internal: 'comunidad',
  contact_ack: 'comunidad',
  email_verification: 'comunidad',
  welcome: 'comunidad',
  password_reset: 'comunidad',
  question_answered: 'comunidad',
  contact_reply: 'comunidad',
  // Del panel.
  admin_password_reset: 'admins',
  prueba: 'configuracion',
};

export const moduloDeCorreo = (kind: string): ModuloAdmin => MODULO_DE_CORREO[kind] ?? 'configuracion';

/** Los módulos que tienen algún correo: con uno de ellos ya se entra a Correo. */
export const MODULOS_CON_CORREO: readonly ModuloAdmin[] = [...new Set(Object.values(MODULO_DE_CORREO))];

/** Los tipos de correo de esos módulos. */
export const tiposDeCorreoDe = (modulos: readonly ModuloAdmin[]): string[] =>
  Object.keys(MODULO_DE_CORREO).filter((k) => modulos.includes(MODULO_DE_CORREO[k]));
