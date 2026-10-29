import { redirect } from 'next/navigation';

/** Mapa y cobertura se juntó con Zonas (2026-10-26): los enlaces viejos llevan ahí. */
export default function AdminCobertura() {
  redirect('/zonas#cobertura');
}
