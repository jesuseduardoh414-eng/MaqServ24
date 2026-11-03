/**
 * A DÓNDE LLEVA UN BOTÓN GENERAL DE COTIZAR (2026-11-03, pedido del dueño).
 *
 * "Solicitar cotización" del hero, "Cotizar" de Categorías, las promociones y
 * el ícono de la lista llevaban al formulario a la medida (/cotizar), que abre
 * con "Buscar equipo". Ahora llevan al cotizador por categorías (/cotizador),
 * donde se elige qué y se cotiza en una pantalla con el cliente arriba. El
 * formulario queda para lo que no tiene precio y "Pedir algo a la medida".
 *
 * El diseño del sitio guarda "/cotizar" en algunos botones (el del hero): se
 * corrige aquí al pintarlos, sin tocar lo guardado en el panel.
 */
export const COTIZADOR = '/cotizador';

/**
 * El formulario a la medida abre solo con algo que cotizar: un equipo
 * (?producto), una categoría sin precio (?servicio), la lista que el cliente
 * fue juntando o un "pedir algo a la medida". Sin nada, /cotizar lleva al
 * cotizador (ver app/cotizar/page.tsx).
 */
export const LISTA_PARA_COTIZAR = '/cotizar?lista=1';
export const A_LA_MEDIDA = '/cotizar?medida=1';

export function hrefDeCotizar(href: string | null | undefined): string {
  const h = (href ?? '').trim();
  return !h || h === '/cotizar' ? COTIZADOR : h;
}
