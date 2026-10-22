'use client';

import { VistaDocumento, type DatosDocumento } from '@maqserv/ui';

/**
 * El documento de la cotización en el portal del aliado (2026-10-19): el mismo
 * componente que usan el cliente y el panel, para que los tres vean y
 * impriman exactamente el mismo papel.
 */
export function DocumentoAliado({ datos }: { datos: DatosDocumento }) {
  return <VistaDocumento datos={datos} />;
}
