/**
 * CRM: APAGADO (decisión del cliente, 2026-09-23).
 *
 * El documento institucional de MAQSER24 no menciona CRM ni Perfex: viene del
 * brief anterior, el de la tienda ("Hito 5: Perfex CRM"). El boletín de ese
 * mismo brief se retiró del código el 2026-10-15 (los correos ya guardados se
 * quedan en la tabla `subscribers`); el CRM se queda apagado:
 *
 *  - `CRM_ACTIVO=false`: Mensajes es una BANDEJA DE ENTRADA y nada más: lo
 *    que llega por Contacto se atiende desde el panel (nuevo, atendido,
 *    archivado). Se esconden el botón "Sincronizar con Perfex" y el aviso de
 *    CRM no conectado. La integración sigue por dentro, guiada por
 *    PERFEX_URL/PERFEX_TOKEN: sin ellas no hace nada, con ellas seguiría
 *    empujando leads en silencio. Si un día el cliente adopta un CRM, se
 *    enciende esto y se ponen las variables.
 */
export const CRM_ACTIVO = false;
