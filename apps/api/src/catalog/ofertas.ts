/**
 * EQUIPOS QUE OFRECE UN ALIADO DESDE SU PORTAL (2026-09-24).
 *
 * El aliado llena un formulario guiado (qué es, marca, ficha técnica según su
 * línea, dónde está, fotos) y su equipo nace en `products` con
 * `status = ESTADO_POR_REVISAR`: ya existe y está a su nombre, pero el sitio
 * no lo muestra. MAQSER24 lo revisa, lo corrige si hace falta y lo publica
 * (`status = 1`), o lo rechaza con motivo.
 *
 * Por qué un estado de `products` y no una tabla de propuestas: publicar es
 * cambiar un número, no copiar datos de un lado a otro, y no hace falta
 * migración en producción. Todo lo público ya filtra `status = 1`, así que
 * un equipo por revisar no aparece en el catálogo, ni en el cotizador, ni en
 * el emparejamiento.
 *
 * Estados de `products.status`: 0 inactivo · 1 activo · 2 por revisar.
 */
export const ESTADO_POR_REVISAR = 2;
