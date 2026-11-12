import { redirect } from 'next/navigation';

/**
 * «MI FLOTA» SE QUITÓ (2026-11-12, el dueño: "el administrador ya sabe lo que es
 * de él"). Lo de MAQSER24 no se captura; en su lugar del menú están los
 * Servicios de proveedores. Un enlace viejo a /disponibilidad llega ahí.
 */
export default function AdminDisponibilidad() {
  redirect('/servicios-proveedores');
}
