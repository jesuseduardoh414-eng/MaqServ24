import { RestablecerForm } from './RestablecerForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Restablecer contraseña — Admin MAQSER24', robots: { index: false } };

/** Destino del enlace del correo de "¿Olvidaste tu contraseña?" (`/restablecer?token=…`). */
export default async function RestablecerPage({ searchParams }: { searchParams: Promise<{ token?: string; nuevo?: string }> }) {
  const sp = await searchParams;
  const token = typeof sp.token === 'string' ? sp.token : '';
  // `nuevo=1`: viene de la invitación al panel (2026-10-28): crea su primera contraseña.
  return <RestablecerForm token={token} nuevo={sp.nuevo === '1'} />;
}
