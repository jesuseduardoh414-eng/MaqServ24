import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { OPERADOR_COOKIE } from '@/lib/cookies';
import { getTheme } from '@/lib/theme';
import { Icon } from '@/components/Icon';
import { EncabezadoPortal } from '../aliado/EncabezadoPortal';
import { ActualizarEnVivo } from '@/components/ActualizarEnVivo';
import { PortalOperador, type ServicioOperador } from './PortalOperador';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export const metadata: Metadata = {
  title: 'Tu servicio',
  robots: { index: false, follow: false },
};

/**
 * EL ENLACE DEL OPERADOR (2026-10-15).
 *
 * Lo abre quien maneja la unidad, desde el WhatsApp que le mandó su empresa o
 * MAQSER24. Un servicio y nada más: a dónde va, con quién habla, qué le piden
 * para entrar, y los botones para avisar que salió y que llegó. Mientras va
 * en camino comparte su ubicación desde aquí.
 */
export default async function OperadorPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  // El middleware canjea el `?t=` por la cookie; el query queda de respaldo.
  const { t } = await searchParams;
  const token = (await cookies()).get(OPERADOR_COOKIE)?.value ?? t;
  const theme = await getTheme();
  const c = theme.tokens.contact;
  const telefono = c?.phone || null;

  const sinAcceso = (motivo: string) => (
    <>
      <EncabezadoPortal theme={theme} />
      <main className="ms-page" style={{ minHeight: '70vh', display: 'grid', alignItems: 'center' }}>
        <div className="ms-wrap-narrow" style={{ width: '100%', boxSizing: 'border-box' }}>
          <div className="ms-empty">
            <span className="ms-ico ms-ico-lg" aria-hidden><Icon name="link" size={22} /></span>
            <h1 className="ms-empty-t">No pudimos abrir tu servicio</h1>
            <p className="ms-empty-p">{motivo} Pídele a tu empresa que te mande el enlace otra vez.</p>
            {telefono ? (
              <div className="ms-empty-acts">
                <a href={`tel:${telefono.replace(/[^\d+]/g, '')}`} className="ms-btn"><Icon name="phone" size={16} />Llamar a MAQSER24</a>
              </div>
            ) : (
              <div className="ms-empty-acts"><Link href="/contacto" className="ms-btn">Contactar a MAQSER24</Link></div>
            )}
          </div>
        </div>
      </main>
    </>
  );

  if (!token) return sinAcceso('Este enlace está incompleto.');
  const res = await fetch(`${API_URL}/operador`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!res?.ok) return sinAcceso('Este enlace ya no sirve: el servicio terminó o te mandaron uno más nuevo.');
  const servicio = (await res.json()) as ServicioOperador;

  return (
    <>
      <ActualizarEnVivo />
      <EncabezadoPortal theme={theme} />
      <main className="ms-page" style={{ minHeight: '100vh' }}>
        <PortalOperador servicio={servicio} telefonoMaqser={telefono} />
      </main>
    </>
  );
}
