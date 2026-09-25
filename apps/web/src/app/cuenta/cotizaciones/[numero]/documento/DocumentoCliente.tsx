'use client';

import { VistaDocumento, type DatosDocumento } from '@maqserv/ui';

/**
 * El documento de la cotización tal como se imprime (2026-09-25): el mismo
 * componente que usa el panel en Cotizador → Historial. El logo llega ya
 * resuelto desde el servidor (variante para fondo claro: el papel es blanco).
 */
export function DocumentoCliente({ datos }: { datos: DatosDocumento }) {
  return <VistaDocumento datos={datos} />;
}
