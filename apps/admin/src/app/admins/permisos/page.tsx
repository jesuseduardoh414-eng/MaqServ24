import { redirect } from 'next/navigation';

/** Permisos vive desde el 2026-10-28 como pestaña de Equipo del panel. */
export default function PermisosPage() {
  redirect('/admins?p=permisos');
}
