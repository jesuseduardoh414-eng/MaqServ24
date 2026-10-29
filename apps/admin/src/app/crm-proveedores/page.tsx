import { redirect } from 'next/navigation';

/**
 * El CRM de proveedores se juntó con Proveedores (2026-10-08): los datos del
 * aliado se editan ahí. Sus "costos de referencia" por hora se quitaron el
 * 2026-10-27 (no movían ningún precio); la tabla `provider_machines` sigue en
 * la base, sin pantalla. El Excel se descarga desde Proveedores. Esta ruta
 * solo redirige, por si alguien la tenía guardada.
 */
export default function CrmProveedores() {
  redirect('/proveedores');
}
