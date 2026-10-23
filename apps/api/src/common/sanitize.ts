import sanitizeHtml from 'sanitize-html';

/**
 * Limpia HTML que escribió alguien en quien NO confiamos (hoy: los vendedores del
 * marketplace).
 *
 * Por qué hace falta: la descripción del producto se pinta con `dangerouslySetInnerHTML`
 * en la ficha pública, que ve cualquier visitante y también el admin. Sin limpiarla, un
 * vendedor aprobado podía dejar ahí `<img src=x onerror="...">` y ejecutar código en el
 * navegador de todos — incluido el del admin, que tiene sesión abierta en el panel.
 *
 * Se permite solo formato de texto. Nada de `<script>`, `<iframe>`, `<style>`, ni
 * atributos `on*`, ni `href="javascript:"`: `sanitize-html` trabaja con lista blanca,
 * así que lo que no está aquí se cae solo (no hay que ir adivinando qué prohibir).
 *
 * Los datos reales de hoy son texto plano (0 de 27 descripciones traen etiquetas), así
 * que esto no cambia cómo se ve nada: solo tapa el agujero.
 */
export function sanitizeUserHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'h3', 'h4', 'span', 'a'],
    allowedAttributes: { a: ['href', 'title', 'target', 'rel'] },
    // Sin esto, `href="javascript:..."` seguiría siendo un vector.
    allowedSchemes: ['http', 'https', 'mailto'],
    // Un enlace del vendedor no debe poder tocar la pestaña que lo abrió (tabnabbing).
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'nofollow noopener noreferrer', target: '_blank' }),
    },
    disallowedTagsMode: 'discard',
  });
}

/**
 * Limpia el HTML que escriben los ADMINISTRADORES y el sitio pinta tal cual:
 * blog, sectores, Quiénes somos (auditoría 2026-10-23).
 *
 * "Lo escribe alguien del equipo" no basta: la respuesta de una pregunta
 * frecuente la escribe Operaciones, y un `<img onerror>` ahí corría en el
 * navegador de cada visitante —y en el de Dirección, que entra al sitio con la
 * sesión del panel abierta en el mismo dominio—. Una cuenta del panel robada
 * tampoco debe poder plantar código en el sitio.
 *
 * Un poco más que `sanitizeUserHtml` (títulos, citas, imágenes, tablas) porque
 * el blog se escribe en HTML a mano. Lo guardado hoy solo usa <p> y <h2>.
 */
export function sanitizeRichHtml(dirty: string | null | undefined): string {
  if (!dirty) return '';
  return sanitizeHtml(dirty, {
    allowedTags: [
      'p', 'br', 'hr', 'b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup', 'small', 'span', 'div',
      'h2', 'h3', 'h4', 'h5', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a',
      'img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'loading'],
      th: ['colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
    },
    disallowedTagsMode: 'discard',
  });
}
