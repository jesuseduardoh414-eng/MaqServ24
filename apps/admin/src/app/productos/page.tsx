import { redirect } from 'next/navigation';

/** La gestión se partió en Servicios y Productos (2026-09-25); los enlaces viejos caen en Servicios. */
export default function AdminProducts() {
  redirect('/catalogo/servicios');
}
