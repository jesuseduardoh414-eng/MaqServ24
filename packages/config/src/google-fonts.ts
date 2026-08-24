/**
 * Construcción de las URLs de Google Fonts a partir de las familias del tema.
 *
 * Vive en `config` y no en la app web porque el ADMIN también tiene que cargar
 * las mismas familias. Antes el panel las traía escritas a mano (Manrope +
 * Space Grotesk), así que un cambio de tipografía en Diseño movía el sitio y
 * dejaba el panel con otra letra.
 */

/**
 * Familias que existen en UN SOLO peso. Pedirles un eje `wght` hace que Google
 * devuelva 400 y no cargue la fuente.
 */
const UN_SOLO_PESO = new Set(['Archivo Black', 'Ultra', 'Bungee', 'Lobster', 'Pacifico']);

/**
 * Devuelve UNA URL POR FAMILIA a propósito. Antes iban todas en un solo
 * stylesheet, y bastaba que una familia fuera inválida para que Google
 * respondiera 400 y la página se quedara sin NINGUNA fuente — incluida la de
 * texto. Separadas, una familia rota solo se pierde a sí misma.
 *
 * Las familias de titular también piden pesos: Inter Tight es variable, y sin
 * el eje `wght` Google sirve solo el peso 400, así que los titulares saldrían
 * en regular. Las de un solo peso van sin eje.
 */
export function googleFontsHrefs(sans: string, displayFamilies: Array<string | undefined>): string[] {
  const enc = (f: string) => f.replace(/ /g, '+');
  const url = (spec: string) => `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
  const hrefs = [url(`${enc(sans)}:wght@300;400;500;600;700;800`)];
  for (const fam of new Set(displayFamilies.filter((f): f is string => Boolean(f) && f !== sans))) {
    hrefs.push(url(UN_SOLO_PESO.has(fam) ? enc(fam) : `${enc(fam)}:wght@400;500;600;700;800`));
  }
  return hrefs;
}
