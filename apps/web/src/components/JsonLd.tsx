/**
 * Datos estructurados (schema.org) en JSON-LD. `<` se escapa para que un
 * texto del panel con "</script>" no pueda cerrar la etiqueta.
 */
export function JsonLd({ data }: { data: object | object[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}
