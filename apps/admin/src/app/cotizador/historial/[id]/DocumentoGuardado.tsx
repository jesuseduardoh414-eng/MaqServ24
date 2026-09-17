'use client';

import { VistaDocumento } from '@maqserv/ui';
import type { DatosDocumento } from '@maqserv/ui';
import { useBranding } from '@/components/branding';

/**
 * Pinta una cotización guardada usando su propio cálculo congelado.
 *
 * El logo se resuelve aquí y no en el servidor porque el documento se imprime
 * sobre papel blanco: hace falta la variante para fondo claro, que es la que
 * el contexto de marca ya tiene resuelta para todo el panel.
 */
export function DocumentoGuardado({ datos }: { datos: Omit<DatosDocumento, 'logo'> }) {
  const branding = useBranding();
  return <VistaDocumento datos={{ ...datos, logo: branding.logoLight || branding.logoAlt || null }} />;
}
