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
export function DocumentoGuardado({
  datos,
  acciones,
}: {
  datos: Omit<DatosDocumento, 'logo'>;
  /** Va junto al botón de imprimir: enviar al cliente, por ahora. */
  acciones?: React.ReactNode;
}) {
  const branding = useBranding();
  return (
    <VistaDocumento
      datos={{ ...datos, logo: branding.logoLight || branding.logoAlt || null }}
      acciones={acciones}
    />
  );
}
