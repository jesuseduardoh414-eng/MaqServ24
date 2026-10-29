import { DOCUMENTO_CSS, documentoCuerpo, type DatosDocumento } from './documento';

/**
 * EL DOCUMENTO COMO ARCHIVO PDF, hecho en el navegador (2026-10-29).
 *
 * Para el acceso directo del celular, que solo consulta precios: no se guarda
 * nada, el documento se descarga o se manda por WhatsApp. Para mandarlo como
 * archivo hace falta el PDF en la mano (la impresión del navegador no da un
 * archivo que se pueda compartir), así que aquí se arma: el mismo documento
 * de siempre, a lo ancho de una hoja carta (sale con su tabla, como impreso),
 * se fotografía y se reparte en páginas.
 *
 * Las librerías pesan: se cargan solo cuando se pide el PDF.
 */

/** Hoja carta a 96 ppp. Con este ancho el documento sale con su tabla. */
const ANCHO_HOJA = 816;
/** Margen arriba y abajo de cada hoja, en puntos (las siguientes a la primera no traen el relleno del documento). */
const MARGEN = 28;

/**
 * Las fotos de otro dominio (el logo vive en media.maqser24.com) no se pueden
 * dibujar sin permiso de ese servidor. Se piden por el optimizador de imágenes
 * de la propia app, que está en el mismo dominio.
 */
function mismaFuente(src: string): string {
  try {
    const u = new URL(src, window.location.href);
    if (u.origin === window.location.origin || u.protocol === 'data:') return src;
    return `/_next/image?url=${encodeURIComponent(u.href)}&w=640&q=90`;
  } catch {
    return src;
  }
}

export async function documentoPdf(d: DatosDocumento): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);

  const caja = document.createElement('div');
  caja.className = 'czdoc-hoja';
  caja.setAttribute('aria-hidden', 'true');
  caja.style.cssText = `position:fixed;left:-${ANCHO_HOJA + 200}px;top:0;width:${ANCHO_HOJA}px;background:#fff;pointer-events:none;`;
  // El relleno de la hoja, aunque la pantalla sea de celular (DOCUMENTO_CSS lo achica ahí), y viñetas
  // propias: las del navegador salían pegadas al texto en la foto.
  caja.innerHTML = `<style>${DOCUMENTO_CSS}.czdoc-hoja .czdoc{padding:34px 38px}.czdoc-hoja .czdoc-cond ul{list-style:none;padding-left:16px}.czdoc-hoja .czdoc-cond li{position:relative}.czdoc-hoja .czdoc-cond li::before{content:"•";position:absolute;left:-12px;color:#5a626b}</style>${documentoCuerpo(d)}`;
  caja.querySelectorAll('img').forEach((img) => img.setAttribute('src', mismaFuente(img.getAttribute('src') ?? '')));
  document.body.appendChild(caja);

  try {
    await document.fonts?.ready;
    await Promise.all(
      [...caja.querySelectorAll('img')].map((img) =>
        img.complete ? null : new Promise((listo) => { img.onload = listo; img.onerror = listo; }),
      ),
    );
    const doc = caja.querySelector<HTMLElement>('.czdoc');
    if (!doc) throw new Error('Sin documento');

    const escala = 2;
    const lienzo = await html2canvas(doc, { scale: escala, backgroundColor: '#ffffff', logging: false, windowWidth: ANCHO_HOJA });

    // Dónde se puede cortar la hoja: al terminar un renglón, una viñeta o un bloque; nunca a media línea.
    const arriba = doc.getBoundingClientRect().top;
    const cortes = [...doc.querySelectorAll('tr, li, p, h4, .czdoc-hd, .czdoc-meta, .czdoc-tot, .czdoc-det, .czdoc-note, .czdoc-sign')]
      .map((e) => (e.getBoundingClientRect().bottom - arriba) * escala)
      .sort((a, b) => a - b);

    const pdf = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait', compress: true });
    const anchoPt = pdf.internal.pageSize.getWidth();
    const altoPt = pdf.internal.pageSize.getHeight();
    const pxPorPt = lienzo.width / anchoPt;

    // Si sobra poco de una hoja (el pie, dos viñetas), se encoge un poco y va
    // en una sola: una segunda hoja casi vacía se ve descuidada.
    const altoTodo = lienzo.height / pxPorPt;
    const cabeEnUna = altoPt - MARGEN;
    if (altoTodo > cabeEnUna && altoTodo * 0.86 <= cabeEnUna) {
      const f = cabeEnUna / altoTodo;
      pdf.addImage(lienzo.toDataURL('image/jpeg', 0.9), 'JPEG', (anchoPt - anchoPt * f) / 2, 0, anchoPt * f, altoTodo * f);
      return pdf.output('blob');
    }

    let inicio = 0;
    let hoja = 0;
    while (inicio < lienzo.height - 2) {
      const arribaPt = hoja === 0 ? 0 : MARGEN;
      const cabe = Math.floor((altoPt - arribaPt - MARGEN) * pxPorPt);
      let fin = Math.min(inicio + cabe, lienzo.height);
      if (fin < lienzo.height) {
        const corte = cortes.filter((c) => c > inicio + cabe * 0.5 && c <= fin).pop();
        if (corte) fin = Math.ceil(corte);
      }
      const trozo = document.createElement('canvas');
      trozo.width = lienzo.width;
      trozo.height = fin - inicio;
      const ctx = trozo.getContext('2d');
      if (!ctx) throw new Error('Sin lienzo');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, trozo.width, trozo.height);
      ctx.drawImage(lienzo, 0, inicio, lienzo.width, trozo.height, 0, 0, lienzo.width, trozo.height);
      if (hoja > 0) pdf.addPage();
      pdf.addImage(trozo.toDataURL('image/jpeg', 0.9), 'JPEG', 0, arribaPt, anchoPt, trozo.height / pxPorPt);
      inicio = fin;
      hoja += 1;
    }
    return pdf.output('blob');
  } finally {
    caja.remove();
  }
}

/** Baja el archivo al teléfono o a la computadora. */
export function descargarArchivo(archivo: File) {
  const url = URL.createObjectURL(archivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = archivo.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Abre el menú de compartir del teléfono con el PDF (de ahí, WhatsApp).
 * Solo el archivo, sin texto: con los dos, WhatsApp a veces manda solo el texto.
 */
export async function compartirArchivo(archivo: File): Promise<'compartido' | 'cancelado' | 'sin-soporte'> {
  if (typeof navigator === 'undefined' || !navigator.canShare?.({ files: [archivo] })) return 'sin-soporte';
  try {
    await navigator.share({ files: [archivo], title: archivo.name });
    return 'compartido';
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'cancelado';
    throw e;
  }
}
