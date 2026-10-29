import type { Tone } from '@/components/ui';

/** Cómo terminó cada envío, en palabras de quien opera. */
export const ESTADO: Record<string, { texto: string; tone: Tone; nota: string }> = {
  enviado: { texto: 'Enviado', tone: 'ok', nota: 'Salió del servidor' },
  fallido: { texto: 'Falló', tone: 'bad', nota: 'El servidor lo rechazó' },
  simulado: { texto: 'Simulado', tone: 'warn', nota: 'No salió: el envío está apagado' },
  omitido: { texto: 'Omitido', tone: 'muted', nota: 'Dirección inválida' },
};

export const estadoDe = (state: string) => ESTADO[state] ?? { texto: state, tone: 'muted' as Tone, nota: '' };

/** Qué correo es. Un tipo nuevo sin nombre aquí se muestra con su clave. */
export const TIPO: Record<string, string> = {
  quote_answered: 'Cotización respondida',
  quote_expiring: 'Cotización por vencer',
  quote_request_ack: 'Acuse de solicitud a la medida',
  quote_request_internal: 'Solicitud a la medida (aviso interno)',
  quoter_request_ack: 'Acuse de solicitud',
  quoter_request_internal: 'Solicitud nueva (aviso interno)',
  quoter_request_provider: 'Solicitud a un proveedor',
  quoter_quote_sent: 'Cotización enviada',
  service_status: 'Avance del servicio',
  provider_offer: 'Oferta a un aliado',
  provider_offer_reminder: 'Oferta sin contestar (aliado)',
  cobro_recordatorio: 'Recordatorio de pago (cliente)',
  factura_aliado_pendiente: 'Sube tu factura (aliado)',
  pago_aliado: 'Te pagamos (aliado)',
  cierre_mes: 'Cierre del mes (Dirección)',
  provider_assigned: 'Asignación a un aliado',
  provider_cancelled: 'Cancelación a un aliado',
  provider_departure: 'Hora de salir (aliado)',
  provider_day_before: 'Mañana tienes servicio (aliado)',
  service_day_before: 'Mañana llega tu servicio (cliente)',
  provider_departure_late: '¿Ya salió? (aliado)',
  provider_access: 'Enlace de acceso',
  provider_invite: 'Invitación a la red',
  provider_offer_review: 'Equipo por revisar (aviso interno)',
  provider_offer_published: 'Equipo publicado',
  provider_offer_rejected: 'Equipo no publicado',
  provider_signup_internal: 'Registro de proveedor (aviso interno)',
  provider_signup_ack: 'Acuse de registro de proveedor',
  availability_reminder: 'Recordatorio de disponibilidad',
  contact_internal: 'Mensaje nuevo (aviso interno)',
  contact_ack: 'Acuse de mensaje',
  email_verification: 'Confirmar cuenta',
  welcome: 'Bienvenida',
  password_reset: 'Restablecer contraseña',
  admin_password_reset: 'Contraseña del panel',
  admin_invitacion: 'Invitación al panel',
  question_answered: 'Pregunta respondida',
  contact_reply: 'Respuesta a un mensaje',
  prueba: 'Prueba',
};

export const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
