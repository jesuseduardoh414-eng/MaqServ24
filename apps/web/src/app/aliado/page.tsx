import type { Metadata } from 'next';
import { getTheme } from '@/lib/theme';
import { SiteFooter } from '@/components/SiteHeader';
import { PortalAliado, type DatosPortal } from './PortalAliado';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export const metadata: Metadata = {
  title: 'Tu panel de aliado',
  // No queremos esto en buscadores: es una pantalla personal aunque el enlace
  // sea la única credencial.
  robots: { index: false, follow: false },
};

/**
 * EL PANEL DEL ALIADO (documento institucional, sección 20).
 *
 * "La experiencia debe permitir al aliado registrar o actualizar sus equipos,
 * zonas, capacidades y documentos; recibir solicitudes que realmente
 * correspondan a su oferta; contestar disponibilidad y condiciones; conocer
 * asignaciones; y mantener historial."
 *
 * Se abre desde el enlace del correo. Sin cabecera del sitio: quien llega aquí
 * viene a contestar una solicitud desde el teléfono, no a navegar el catálogo.
 */
export default async function AliadoPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const theme = await getTheme();

  if (!t) {
    return <SinAcceso theme={theme} motivo="Este enlace está incompleto." />;
  }

  const res = await fetch(`${API_URL}/aliado?t=${encodeURIComponent(t)}`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    return (
      <SinAcceso
        theme={theme}
        motivo="Este enlace ya no sirve. Puede haber caducado o haberse dado de baja."
      />
    );
  }
  const datos = (await res.json()) as DatosPortal;

  return (
    <>
      <main style={{ background: 'var(--color-bg)', color: 'var(--color-text)', minHeight: '100vh' }}>
        <PortalAliado datos={datos} token={t} />
      </main>
      <SiteFooter theme={theme} />
    </>
  );
}

function SinAcceso({ theme, motivo }: { theme: Awaited<ReturnType<typeof getTheme>>; motivo: string }) {
  return (
    <>
      <main style={{ background: 'var(--color-bg)', color: 'var(--color-text)', minHeight: '70vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ maxWidth: 440, textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 28, margin: '0 0 12px' }}>
            No pudimos abrir tu panel
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 15, lineHeight: 1.65, margin: 0 }}>
            {motivo} Escríbenos o llámanos y te mandamos uno nuevo en un minuto.
          </p>
        </div>
      </main>
      <SiteFooter theme={theme} />
    </>
  );
}
