/**
 * Imagen elegida pero AÚN NO SUBIDA, lista para la vista previa del sitio.
 *
 * El editor la muestra con un `blob:` URL, pero ese URL solo existe dentro del
 * panel: el iframe del sitio (otro dominio) no puede leerlo. Se manda como
 * data URL WebP reducida (conserva la transparencia de los PNG del hero) para
 * no pasar del tope de la Server Action del sitio.
 */
export async function imagenParaVistaPrevia(file: File, ladoMax = 1400): Promise<string | null> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, ladoMax / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * k));
    const h = Math.max(1, Math.round(bmp.height * k));
    const lienzo = document.createElement('canvas');
    lienzo.width = w;
    lienzo.height = h;
    const ctx = lienzo.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    return lienzo.toDataURL('image/webp', 0.85);
  } catch {
    return null;
  }
}
