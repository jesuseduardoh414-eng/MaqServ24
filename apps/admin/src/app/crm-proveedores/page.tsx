import { redirect } from 'next/navigation';

/**
 * El CRM de proveedores se juntó con Proveedores (2026-10-08): los datos del
 * aliado se editan ahí, y sus máquinas con lo que cobra por hora viven en su
 * expediente, en "Costos de referencia". El Excel también se descarga desde
 * Proveedores. Esta ruta solo redirige, por si alguien la tenía guardada.
 */
export default function CrmProveedores() {
  redirect('/proveedores');
}
