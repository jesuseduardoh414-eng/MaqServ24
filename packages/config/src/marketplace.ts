/**
 * EL MARKETPLACE ESTÁ APAGADO (decisión del cliente, 2026-09-23).
 *
 * La plataforma nació como tienda y trae un marketplace heredado: un cliente
 * pedía abrir "su tienda", publicaba productos con precio, vendía directo por
 * carrito y retiraba su saldo. El documento institucional de MAQSER24 no tiene
 * esa figura: los actores son tres —el cliente, el PROVEEDOR (la red de
 * aliados, que recibe solicitudes y las acepta o rechaza con MAQSER24 en
 * medio) y MAQSER24—, y dice expresamente que no debe ser "una página de
 * anuncios donde cada proveedor publica sin estándares". Retiros de dinero no
 * debe haber: el modelo económico se define fuera de la plataforma.
 *
 * Se APAGA, no se borra: es un interruptor para que, si algún día el cliente
 * decide que un proveedor publique por su cuenta, se retome desde aquí (y lo
 * correcto entonces sería hacerlo desde el portal del aliado, no revivir la
 * tienda). Con `false`:
 *  - el módulo `marketplace` del panel desaparece del menú, de Permisos y del
 *    guard (nadie lo alcanza, ni Dirección);
 *  - las tarjetas de retiros y vendedores no salen en el Inicio del panel;
 *  - el sitio no enlaza a "Vender", y /vendedor, /vendedores y /tienda dan 404;
 *  - la API responde 404 en /vendors y /vendor (incluido pedir retiros).
 */
export const MARKETPLACE_ACTIVO = false;
