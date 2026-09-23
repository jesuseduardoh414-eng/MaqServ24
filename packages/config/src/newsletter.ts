/**
 * BOLETÍN Y CRM: APAGADOS (decisión del cliente, 2026-09-23).
 *
 * Ninguno de los dos está en el documento institucional de MAQSER24: no
 * menciona CRM, Perfex, boletín ni suscriptores. Vienen del brief anterior,
 * el de la tienda ("Hito 5: Perfex CRM", "Suscriptores"). MAQSER24 vende
 * servicios por cotización a empresas que llegan con una obra concreta: un
 * constructor no se suscribe a un boletín de maquinaria, cotiza.
 *
 * Igual que el marketplace, se APAGA y no se borra:
 *
 *  - `NEWSLETTER_ACTIVO=false`: el pie del sitio no ofrece el cuadro del
 *    boletín (aunque el tema lo tenga encendido), `POST /content/subscribe`
 *    responde 404, y en el panel desaparece Suscriptores del menú y su API
 *    contesta 404. Los correos ya guardados se quedan en la tabla.
 *
 *  - `CRM_ACTIVO=false`: Mensajes es una BANDEJA DE ENTRADA y nada más: lo
 *    que llega por Contacto se atiende desde el panel (nuevo, atendido,
 *    archivado). Se esconden el botón "Sincronizar con Perfex" y el aviso de
 *    CRM no conectado. La integración sigue por dentro, guiada por
 *    PERFEX_URL/PERFEX_TOKEN: sin ellas no hace nada, con ellas seguiría
 *    empujando leads en silencio. Si un día el cliente adopta un CRM, se
 *    enciende esto y se ponen las variables.
 */
export const NEWSLETTER_ACTIVO = false;
export const CRM_ACTIVO = false;
