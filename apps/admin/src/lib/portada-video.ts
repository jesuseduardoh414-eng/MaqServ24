/**
 * PORTADA SACADA DEL VIDEO (2026-11-16).
 *
 * Una tarjeta con video y sin portada se ve negra mientras el video carga (o si
 * el navegador no lo reproduce solo). El dueño subió cuatro promociones así y
 * «no se veía nada». Aquí se toma un cuadro del propio video, en el navegador,
 * y se sube como imagen: no hace falta ningún programa en el servidor.
 *
 * El cuadro va hacia el segundo 4 (o a la cuarta parte si el video es corto):
 * en los videos de promoción el primer cuadro suele ser el fondo, antes de que
 * entre el texto.
 */

function esperar(v: HTMLVideoElement, evento: string, ms: number): Promise<void> {
  return new Promise((ok, mal) => {
    const t = setTimeout(() => { limpiar(); mal(new Error('tiempo')); }, ms);
    const listo = () => { limpiar(); ok(); };
    const fallo = () => { limpiar(); mal(new Error('video')); };
    const limpiar = () => { clearTimeout(t); v.removeEventListener(evento, listo); v.removeEventListener('error', fallo); };
    v.addEventListener(evento, listo, { once: true });
    v.addEventListener('error', fallo, { once: true });
  });
}

/**
 * Saca un cuadro del video como JPG. `fuente` es el archivo recién elegido o
 * la URL de uno ya subido (se lee por la API: el dominio de los archivos no
 * deja leerlos desde el panel). Devuelve null si no se pudo.
 */
export async function portadaDeVideo(fuente: File | string): Promise<File | null> {
  let url: string;
  if (typeof fuente === 'string') {
    const nombre = fuente.split('/uploads/')[1]?.split(/[?#]/)[0];
    if (!nombre) return null;
    const r = await fetch(`/api/admin/cms/video-guardado?ruta=${encodeURIComponent(`uploads/${nombre}`)}`).catch(() => null);
    if (!r?.ok) return null;
    url = URL.createObjectURL(await r.blob());
  } else url = URL.createObjectURL(fuente);

  const v = document.createElement('video');
  try {
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.src = url;
    await esperar(v, 'loadedmetadata', 15_000);
    const dur = Number.isFinite(v.duration) ? v.duration : 0;
    const t = Math.min(4, Math.max(0.3, dur * 0.25), Math.max(0, dur - 0.1));
    v.currentTime = t;
    await esperar(v, 'seeked', 15_000);
    if (!v.videoWidth || !v.videoHeight) return null;
    const escala = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(v.videoWidth * escala);
    c.height = Math.round(v.videoHeight * escala);
    const g = c.getContext('2d');
    if (!g) return null;
    g.drawImage(v, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.85));
    return blob ? new File([blob], 'portada-del-video.jpg', { type: 'image/jpeg' }) : null;
  } catch {
    return null;
  } finally {
    v.removeAttribute('src');
    v.load();
    URL.revokeObjectURL(url);
  }
}

/** Sube la portada como cualquier imagen del sitio; devuelve su URL o null. */
export async function subirPortada(f: File): Promise<string | null> {
  const fd = new FormData();
  fd.append('file', f);
  const r = await fetch('/api/admin/cms/upload', { method: 'POST', body: fd }).catch(() => null);
  const d = (await r?.json().catch(() => null)) as { url?: string } | null;
  return r?.ok && d?.url ? d.url : null;
}
