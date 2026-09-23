import { Logger } from '@nestjs/common';
import { prisma } from '@maqserv/db';

/**
 * LO QUE LA CUENTA YA SABE DEL CLIENTE.
 *
 * Desde que pedir cotización exige cuenta, el correo de la solicitud es el de
 * la cuenta y no el que venga en el formulario: es la identidad con la que
 * después va a entrar a ver, aceptar y seguir esa cotización. Si se aceptara
 * otro correo, la cotización quedaría ligada a la cuenta pero los avisos
 * saldrían a otra dirección, y el cliente no entendería por qué no le llegan.
 *
 * El teléfono va al revés: el registro no lo pide (solo correo y contraseña,
 * o Google), así que la PRIMERA solicitud es donde se conoce, y se guarda en
 * la cuenta para no volver a preguntarlo. "Sus demás datos se guardan después"
 * es exactamente esto.
 */

const log = new Logger('Cuenta');

export interface DatosCuenta {
  name: string;
  email: string;
  phone: string | null;
}

export async function datosDeCuenta(userId: number): Promise<DatosCuenta | null> {
  const u = await prisma.users.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true },
  });
  return u ? { name: u.name, email: u.email, phone: u.phone } : null;
}

/**
 * Guarda el teléfono en la cuenta SOLO si la cuenta no tenía uno.
 *
 * No sobreescribe: si el cliente ya puso su teléfono en el perfil y en esta
 * solicitud escribió el del contacto en obra, el del perfil sigue siendo el
 * suyo. Y nunca lanza: completar el perfil es un extra, no puede tumbar la
 * solicitud que ya se guardó.
 */
export async function completarTelefono(userId: number, phone: string | null | undefined): Promise<void> {
  const tel = phone?.trim();
  if (!tel) return;
  try {
    await prisma.users.updateMany({
      where: { id: userId, OR: [{ phone: null }, { phone: '' }] },
      data: { phone: tel.slice(0, 40), updated_at: new Date() },
    });
  } catch (err) {
    log.warn(`No se pudo completar el teléfono de la cuenta ${userId}: ${(err as Error).message}`);
  }
}
