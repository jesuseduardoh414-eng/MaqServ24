'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { DIAS_SEMANA, HORARIO_DEFAULT, atributosDe, horarioDe, margenDe, precioConMargen, rutaPanelDeCatalogo, tipoDeCatalogo, unidadesDeTarifa, type Horario, type TipoCatalogo } from '@maqserv/config';
import { AdminSelect } from '@/components/AdminSelect';
import { AdminTimePicker } from '@/components/AdminFecha';
import { Btn, Chip, IconBtn, Note, PageHeader, Panel, btnClass } from '@/components/ui';
import { PrecioEnCotizador, type PrecioEnCotizadorControl } from '@/components/PrecioEnCotizador';
import { mostrarResultado } from '@maqserv/ui';

export interface ProductFormData {
  id?: number;
  name?: string;
  categoryId?: number;
  price?: number;
  oldPrice?: number | null;
  description?: string;
  short?: string | null;
  specs?: Array<{ label: string; value: string }>;
  stock?: number | null;
  brand?: string | null;
  isRental?: boolean;
  rentalFreight?: number | null;
  featured?: boolean;
  image?: string | null;
  /** De qué aliado es el equipo. Null = la ficha del tipo (lleva el precio; no es una máquina). */
  providerId?: number | null;
  /** Máquina de aliado: la ficha del tipo a la que pertenece (2026-10-22). */
  tipoId?: number | null;
  /** 0 inactivo · 1 activo · 2 por revisar (lo ofreció el aliado desde su portal). */
  status?: number;
  /** Ficha técnica estructurada por línea (`atributosDe`). */
  attributes?: Record<string, unknown> | null;
  location?: string | null;
  /** Unidad del precio (`UNIDADES`): día, mes, viaje, tonelada… '' = precio total / por pieza. */
  priceUnit?: string | null;
  /** Precio al público por unidad. */
  tarifas?: Record<string, number> | null;
  /** Lo que cobra el aliado por unidad. */
  costoAliado?: Record<string, number> | null;
  minimo?: number | null;
  horario?: Horario | null;
}

interface Categoria { id: number; name: string; slug?: string; status?: number }

interface Proveedor { id: number; name: string; level?: string }
/** Una ficha de tipo (sin aliado), para el selector "Tipo" de una máquina de aliado. */
interface TipoFicha { id: number; name: string; category_id: number; status: number }
interface Foto { id: number; url: string | null }

/** Lo mismo que acepta la API (admin-catalog: IMAGE_TYPES y 8 MB por archivo). */
const TIPOS_IMAGEN = 'image/png,image/jpeg,image/webp,image/avif';
const MAX_MB = 8;
const MAX_GALERIA = 6;
function problemaImagen(f: File): string | null {
  if (!TIPOS_IMAGEN.split(',').includes(f.type)) return `«${f.name}» no es una imagen PNG, JPG, WebP o AVIF.`;
  if (f.size > MAX_MB * 1024 * 1024) return `«${f.name}» pesa más de ${MAX_MB} MB.`;
  return null;
}

/** Igual que el tope de `POST admin/catalog/products/:id/video` en la API. */
const VIDEO_MAX_MB = 30;

/** XHR y no fetch: fetch no informa el avance de la subida. */
function subirVideoPrincipal(id: number, archivo: File, onAvance: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/admin/catalog/products/${id}/video`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onAvance(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let d: { message?: string; video?: string } | null = null;
      try { d = JSON.parse(xhr.responseText); } catch { /* sin cuerpo */ }
      if (xhr.status >= 200 && xhr.status < 300 && d?.video) resolve(d.video);
      else if (xhr.status === 413) reject(new Error(`El video pesa más de ${VIDEO_MAX_MB} MB`));
      else reject(new Error(d?.message ?? 'No se pudo subir el video'));
    };
    xhr.onerror = () => reject(new Error('Se cortó la conexión al subir el video'));
    const fd = new FormData();
    fd.set('video', archivo);
    xhr.send(fd);
  });
}

/**
 * Un cuadro del video, en JPG, para usarlo de foto principal cuando el
 * servicio no tiene: el carrito, las cotizaciones y lo que se comparte en
 * redes solo saben de fotos, y sin esto saldrían en blanco.
 */
function cuadroDelVideo(archivo: File): Promise<File | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(archivo);
    const v = document.createElement('video');
    let listo = false;
    const fin = (f: File | null) => { if (listo) return; listo = true; URL.revokeObjectURL(url); resolve(f); };
    setTimeout(() => fin(null), 10_000); // un códec que el navegador no abre no debe colgar la subida
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    // Un poco adentro: el primer cuadro suele ser negro o un fundido.
    v.onloadeddata = () => { v.currentTime = Math.min(1, (v.duration || 3) / 3); };
    v.onseeked = () => {
      const lado = Math.max(v.videoWidth, v.videoHeight);
      if (!lado) return fin(null);
      const k = Math.min(1, 1600 / lado);
      const c = document.createElement('canvas');
      c.width = Math.round(v.videoWidth * k);
      c.height = Math.round(v.videoHeight * k);
      const ctx = c.getContext('2d');
      if (!ctx) return fin(null);
      ctx.drawImage(v, 0, 0, c.width, c.height);
      c.toBlob((b) => fin(b ? new File([b], 'portada-del-video.jpg', { type: 'image/jpeg' }) : null), 'image/jpeg', 0.86);
    };
    v.onerror = () => fin(null);
    v.src = url;
  });
}

const POR_REVISAR = 2;

/**
 * FICHA DE EQUIPO (alta, edición y REVISIÓN) — 2026-09-24.
 *
 * Era el formulario genérico del legado: una columna, sin la ficha técnica por
 * línea que llena el aliado, sin su galería ni su ubicación, y con un bloque
 * "médico" (lote, caducidad) de otra vertical. Al revisar una propuesta del
 * aliado había que publicar desde el expediente sin haber visto lo que mandó.
 *
 * Ahora:
 *  - Dos columnas: lo que se edita a la izquierda; fotos, dueño y la revisión
 *    a la derecha.
 *  - Ficha técnica con los MISMOS campos que el aliado llenó (`atributosDe`),
 *    más datos extra libres.
 *  - Con `status = 2` es una revisión: aviso arriba y, a un lado, "Cuenta como
 *    en el cotizador", Guardar y publicar, y Rechazar con motivo.
 *  - Lote y caducidad ya no se muestran; el PATCH no los toca si no llegan.
 */
export function ProductForm({
  initial,
  categories,
  providers = [],
  tipo,
  puedeTarifas = true,
}: {
  initial: ProductFormData;
  categories: Categoria[];
  providers?: Proveedor[];
  /** Servicio (se cotiza) o producto (precio fijo). Al editar sale de la categoría de la ficha. */
  tipo?: TipoCatalogo;
  /** Puede cambiar el precio en el cotizador (módulo Tarifas, de fábrica solo Dirección). */
  puedeTarifas?: boolean;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const isEdit = Boolean(initial.id);
  const enRevision = isEdit && initial.status === POR_REVISAR;
  const proveedor = providers.find((p) => p.id === initial.providerId);
  const tipoActual: TipoCatalogo = tipo ?? (initial.categoryId ? tipoDeCatalogo(categories.find((c) => c.id === initial.categoryId)?.slug) : 'servicio');
  const singular = tipoActual === 'servicio' ? 'servicio' : 'producto';

  const [categoryId, setCategoryId] = useState(initial.categoryId ? String(initial.categoryId) : '');
  // Un producto siempre se vende a precio fijo; en un servicio se elige cómo se cobra.
  const [isRental, setIsRental] = useState(initial.isRental ?? tipoActual === 'servicio');
  const [attrs, setAttrs] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(initial.attributes ?? {}).map(([k, v]) => [k, v == null ? '' : String(v)])),
  );
  const [specs, setSpecs] = useState<Array<{ label: string; value: string }>>(initial.specs ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'guardar' | 'publicar' | 'rechazar'>(null);

  const slug = categories.find((c) => String(c.id) === categoryId)?.slug ?? null;
  const campos = useMemo(() => atributosDe(slug), [slug]);
  // Solo líneas activas; la actual se conserva aunque esté apagada, para no perderla al guardar.
  const lineas = categories.filter((c) => tipoDeCatalogo(c.slug) === tipoActual && (c.status === undefined || c.status === 1 || String(c.id) === String(initial.categoryId ?? '')));

  /**
   * PRECIOS POR UNIDAD (2026-09-25). La máquina es la unidad de cotización:
   * cada ficha trae lo que cobra el aliado y el precio al público por día,
   * semana, mes (o viaje, tonelada…). `unidad` es la principal: la que sale en
   * el catálogo y la que manda a `cprice`.
   */
  const unidadesPrecio = useMemo(() => unidadesDeTarifa(slug, isRental ? 'renta' : 'venta'), [slug, isRental]);
  const aTexto = (t?: Record<string, number> | null) => Object.fromEntries(Object.entries(t ?? {}).map(([k, v]) => [k, String(v)]));
  const [costo, setCosto] = useState<Record<string, string>>(() => aTexto(initial.costoAliado));
  const [publico, setPublico] = useState<Record<string, string>>(() => aTexto(initial.tarifas));
  const [unidad, setUnidad] = useState(initial.priceUnit ?? '');
  const [margenPct, setMargenPct] = useState<number | null>(null);
  useEffect(() => {
    void fetch('/api/admin/catalog/ajustes').then((r) => (r.ok ? r.json() : null)).then((d) => { if (typeof d?.margenPct === 'number') setMargenPct(d.margenPct); }).catch(() => undefined);
  }, []);
  const numeros = (t: Record<string, string>) =>
    Object.fromEntries(unidadesPrecio.map((u) => [u.clave, Number(t[u.clave])]).filter(([, n]) => Number.isFinite(n) && (n as number) > 0)) as Record<string, number>;
  const tarifasNum = numeros(publico);
  const costoNum = numeros(costo);
  useEffect(() => {
    // La unidad principal tiene que tener precio; si no, la primera que lo tenga.
    if (!tarifasNum[unidad]) setUnidad(Object.keys(tarifasNum)[0] ?? unidadesPrecio[0]?.clave ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publico, unidadesPrecio]);
  /** Propone el precio al público con el margen: costo × (1 + m). Solo llena lo vacío… o todo si se pide. */
  function proponer(todo: boolean) {
    if (margenPct === null) return;
    setPublico((p) => {
      const n = { ...p };
      for (const u of unidadesPrecio) {
        const c = Number(costo[u.clave]);
        if (Number.isFinite(c) && c > 0 && (todo || !Number(n[u.clave]))) n[u.clave] = String(precioConMargen(c, margenPct));
      }
      return n;
    });
  }
  const [minimo, setMinimo] = useState(initial.minimo != null ? String(initial.minimo) : '');
  const [horario, setHorario] = useState<Horario | null>(initial.horario ? horarioDe(initial.horario) : null);

  /**
   * El precio en el cotizador vive en la ficha del TIPO (2026-10-19): la de
   * MAQSER24, sin aliado. El equipo de un aliado se cotiza con el de su tipo.
   */
  const esTipo = tipoActual === 'servicio' && !initial.providerId;
  const precioCotizador = useRef<PrecioEnCotizadorControl | null>(null);

  // ---- Revisión: rechazo ----
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');

  /**
   * EL TIPO DE UNA MÁQUINA DE ALIADO (2026-10-22). Reemplaza al selector
   * "Cuenta como en el cotizador", que la API ignoraba desde el 2026-09-25: la
   * máquina apunta a la ficha de su tipo, y así las solicitudes de ese tipo le
   * llegan a su aliado y al aceptar se aparta ESTA máquina.
   */
  const esUnidad = Boolean(initial.providerId) && tipoActual === 'servicio';
  const [tipos, setTipos] = useState<TipoFicha[]>([]);
  const [tipoSel, setTipoSel] = useState(initial.tipoId ? String(initial.tipoId) : '');
  const [nuevoTipo, setNuevoTipo] = useState<string | null>(null); // null = cerrado
  useEffect(() => {
    if (!esUnidad) return;
    void fetch('/api/admin/catalog/tipos')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: TipoFicha[]) => setTipos(Array.isArray(d) ? d : []))
      .catch(() => undefined);
  }, [esUnidad]);
  const tiposLinea = tipos.filter((t) => t.category_id === Number(categoryId));
  const tipoNombre = tiposLinea.find((t) => String(t.id) === tipoSel)?.name ?? null;

  async function crearTipo() {
    const nombre = nuevoTipo?.trim() ?? '';
    if (!initial.id || nombre.length < 3) return;
    const r = await fetch(`/api/admin/catalog/products/${initial.id}/crear-tipo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre }),
    });
    const d = await r.json().catch(() => null) as { id: number; nombre: string; yaExistia: boolean; message?: string } | null;
    if (!r.ok || !d) { setError(d?.message ?? 'No se pudo crear el tipo.'); return; }
    setTipos((ts) => (ts.some((t) => t.id === d.id) ? ts : [...ts, { id: d.id, name: d.nombre, category_id: Number(categoryId), status: 1 }]));
    setTipoSel(String(d.id));
    setNuevoTipo(null);
    mostrarResultado(d.yaExistia ? `Ya existía el tipo "${d.nombre}": quedó asignado.` : `Se creó el tipo "${d.nombre}". Ponle su precio en su ficha, en Inventario.`, 'ok');
  }

  // ---- Foto principal ----
  /*
   * Antes el archivo elegido se quedaba esperando en el formulario hasta pulsar
   * "Guardar cambios", sin mostrar nada: parecía que no se había subido. Ahora,
   * al EDITAR se sube en cuanto se elige y se ve de inmediato; al CREAR (aún no
   * hay id) se muestra la vista previa y se sube junto con el alta.
   */
  const [principal, setPrincipal] = useState<string | null>(initial.image ?? null);
  const [subiendoPrincipal, setSubiendoPrincipal] = useState(false);

  async function elegirPrincipal(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    const problema = problemaImagen(file);
    if (problema) { mostrarResultado(problema, 'bad'); input.value = ''; return; }
    const vista = URL.createObjectURL(file);
    if (!initial.id) { setPrincipal(vista); return; } // se va con el alta (name="photo")
    setSubiendoPrincipal(true);
    const fd = new FormData();
    fd.set('photo', file);
    try {
      const r = await fetch(`/api/admin/catalog/products/${initial.id}`, { method: 'PATCH', body: fd });
      if (r.ok) {
        setPrincipal(vista);
        mostrarResultado('Foto principal actualizada');
      } else URL.revokeObjectURL(vista); // el motivo lo dice el aviso automático
    } catch {
      URL.revokeObjectURL(vista);
    } finally {
      setSubiendoPrincipal(false);
      // Ya está arriba: que "Guardar cambios" no la vuelva a mandar.
      input.value = '';
    }
  }

  // ---- Video principal (2026-10-20; solo al editar: necesita el id) ----
  /*
   * La principal puede ser foto o video. Con video, la tarjeta y la ficha lo
   * enseñan en lugar de la foto, que se queda de portada; si el equipo no
   * tiene foto, se toma un cuadro del video y se sube como foto principal.
   * La galería sigue siendo solo de fotos.
   */
  const [video, setVideo] = useState<string | null>(null);
  const [subiendoVideo, setSubiendoVideo] = useState<number | null>(null);
  useEffect(() => {
    if (!initial.id) return;
    void fetch(`/api/admin/catalog/products/${initial.id}/video`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { video?: string | null } | null) => setVideo(d?.video ?? null))
      .catch(() => undefined);
  }, [initial.id]);

  async function elegirVideo(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (!file || !initial.id) return;
    // El tipo lo revisa la API por los bytes (y explica qué hacer con un .mov de iPhone).
    if (file.size > VIDEO_MAX_MB * 1024 * 1024) { mostrarResultado(`El video pesa más de ${VIDEO_MAX_MB} MB.`, 'bad'); return; }
    const sinFoto = !principal;
    setSubiendoVideo(0);
    try {
      const url = await subirVideoPrincipal(initial.id, file, setSubiendoVideo);
      setVideo(url);
      let nota = '';
      if (sinFoto) {
        const cuadro = await cuadroDelVideo(file);
        if (cuadro) {
          const fd = new FormData();
          fd.set('photo', cuadro);
          const r = await fetch(`/api/admin/catalog/products/${initial.id}`, { method: 'PATCH', body: fd }).catch(() => null);
          if (r?.ok) { setPrincipal(URL.createObjectURL(cuadro)); nota = ' Tomamos un cuadro del video como foto de portada.'; }
        }
      }
      mostrarResultado(`Video principal listo: ya se ve en la tarjeta y en la ficha.${nota}`);
    } catch (e) {
      mostrarResultado((e as Error).message, 'bad');
    } finally {
      setSubiendoVideo(null);
    }
  }
  async function quitarVideo() {
    if (!initial.id) return;
    const r = await fetch(`/api/admin/catalog/products/${initial.id}/video`, { method: 'DELETE' });
    if (r.ok) { setVideo(null); mostrarResultado('Video quitado: vuelve a verse la foto principal.'); }
  }

  // ---- Galería (solo al editar: necesita el id) ----
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [subiendo, setSubiendo] = useState<{ va: number; de: number } | null>(null);
  useEffect(() => {
    if (!initial.id) return;
    void fetch(`/api/admin/catalog/products/${initial.id}/gallery`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Foto[]) => setFotos(Array.isArray(d) ? d : []))
      .catch(() => undefined);
  }, [initial.id]);

  /**
   * Varias de una vez (antes: una por una). Se suben en orden, una tras otra,
   * hasta llenar los 6 lugares; lo que no quepa se avisa en vez de perderse
   * en silencio.
   */
  async function subirFotos(lista: File[]) {
    if (!initial.id || !lista.length) return;
    const libres = MAX_GALERIA - fotos.length;
    const validas = lista.filter((f) => !problemaImagen(f));
    const invalidas = lista.length - validas.length;
    const tanda = validas.slice(0, libres);
    const sobran = validas.length - tanda.length;
    let ok = 0;
    for (let i = 0; i < tanda.length; i++) {
      setSubiendo({ va: i + 1, de: tanda.length });
      const fd = new FormData();
      fd.set('photo', tanda[i]);
      try {
        const r = await fetch(`/api/admin/catalog/products/${initial.id}/gallery`, { method: 'POST', body: fd });
        const d = await r.json().catch(() => null);
        if (r.ok && d) { setFotos((f) => [...f, d as Foto]); ok++; }
      } catch { /* sin conexión: ya avisado */ }
    }
    setSubiendo(null);
    const notas = [
      sobran ? `${sobran} no ${sobran === 1 ? 'cupo' : 'cupieron'} (máximo ${MAX_GALERIA})` : '',
      invalidas ? `${invalidas} no ${invalidas === 1 ? 'es imagen válida' : 'son imágenes válidas'} o ${invalidas === 1 ? 'pesa' : 'pesan'} más de 8 MB` : '',
      tanda.length - ok ? `${tanda.length - ok} no se ${tanda.length - ok === 1 ? 'pudo' : 'pudieron'} subir` : '',
    ].filter(Boolean);
    if (!ok && !notas.length) return;
    const titulo = ok ? `${ok} ${ok === 1 ? 'foto agregada' : 'fotos agregadas'} a la galería` : 'No se agregó ninguna foto';
    mostrarResultado(notas.length ? `${titulo}. ${notas.join('; ')}.` : titulo, notas.length ? (ok ? 'warn' : 'bad') : 'ok');
  }
  async function quitarFoto(id: number) {
    if (!initial.id) return;
    const r = await fetch(`/api/admin/catalog/products/${initial.id}/gallery/${id}`, { method: 'DELETE' });
    if (r.ok) setFotos((f) => f.filter((x) => x.id !== id));
  }

  /** Guarda la ficha. Devuelve true si quedó guardada. */
  async function guardar(): Promise<boolean> {
    if (!form.current) return false;
    if (!form.current.reportValidity()) return false;
    setError(null);
    const fd = new FormData(form.current);
    if (esUnidad) fd.set('tipoId', tipoSel);
    if (isRental) fd.set('isRental', 'true');
    else { fd.set('isRental', 'false'); fd.delete('rentalFreight'); }
    fd.set('featured', fd.get('featured') === 'on' ? 'true' : 'false');
    fd.set('specs', JSON.stringify(specs.map((s) => ({ label: s.label.trim(), value: s.value.trim() })).filter((s) => s.label)));
    // Solo las preguntas de la línea elegida: si se cambió de línea, lo de la otra no aplica.
    const ficha = Object.fromEntries(campos.map((c) => [c.clave, (attrs[c.clave] ?? '').trim()]).filter(([, v]) => v));
    fd.set('attributes', Object.keys(ficha).length ? JSON.stringify(ficha) : '');
    for (const k of ['oldPrice', 'stock', 'rentalFreight']) if (fd.get(k) === '') fd.delete(k);
    fd.delete('_principal');
    const res = await fetch(isEdit ? `/api/admin/catalog/products/${initial.id}` : '/api/admin/catalog/products', {
      method: isEdit ? 'PATCH' : 'POST',
      body: fd,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(typeof data?.message === 'string' ? data.message : 'No se pudo guardar');
      return false;
    }
    // Con la ficha guardada, su precio en el cotizador (es la misma pantalla).
    const id = isEdit ? initial.id : (typeof data?.id === 'number' ? data.id : null);
    if (esTipo && id && precioCotizador.current) {
      const fallo = await precioCotizador.current.guardar(id, String(fd.get('name') ?? ''));
      if (fallo) {
        if (isEdit) { setError(`La ficha se guardó, pero su precio en el cotizador no: ${fallo}`); return false; }
        // Recién creada: se abre ya como edición para corregir el precio sin duplicar la ficha.
        mostrarResultado(`La ficha se creó, pero su precio en el cotizador no: ${fallo}`, 'bad');
        router.push(`/productos/editar/${id}`);
        return false;
      }
    }
    return true;
  }

  async function onGuardar() {
    setBusy('guardar');
    const ok = await guardar();
    setBusy(null);
    if (!ok) return;
    router.push(enRevision ? '/proveedores' : rutaPanelDeCatalogo(tipoActual));
    router.refresh();
  }

  async function onPublicar() {
    setBusy('publicar');
    if (!(await guardar())) { setBusy(null); return; }
    // El tipo ya va en lo guardado (2026-10-22).
    const r = await fetch(`/api/admin/providers/equipos/${initial.id}/publicar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const d = await r.json().catch(() => null);
    setBusy(null);
    if (!r.ok) { setError(d?.message ?? 'Se guardó, pero no se pudo publicar.'); return; }
    router.push('/proveedores');
    router.refresh();
  }

  async function onRechazar() {
    if (motivo.trim().length < 4) return;
    setBusy('rechazar');
    const r = await fetch(`/api/admin/providers/equipos/${initial.id}/rechazar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo: motivo.trim() }),
    });
    const d = await r.json().catch(() => null);
    setBusy(null);
    if (!r.ok) { setError(d?.message ?? 'No se pudo rechazar.'); return; }
    router.push('/proveedores');
    router.refresh();
  }

  const titulo = isEdit ? initial.name ?? (tipoActual === 'servicio' ? 'Servicio' : 'Producto') : `Nuevo ${singular}`;
  const volver = enRevision
    ? { href: '/proveedores', texto: 'Proveedores' }
    : { href: rutaPanelDeCatalogo(tipoActual), texto: tipoActual === 'servicio' ? 'Servicios' : 'Productos' };

  const estado = enRevision
    ? <Chip tone="warn">Por revisar</Chip>
    : isEdit && initial.status === 0
      ? <Chip tone="muted">Inactivo</Chip>
      : isEdit
        ? <Chip tone="ok">Publicado</Chip>
        : null;

  return (
    <form ref={form} onSubmit={(e) => { e.preventDefault(); void onGuardar(); }} encType="multipart/form-data" className="pf">
      <style>{CSS}</style>

      {/* ── Encabezado ── */}
      <PageHeader
        eyebrow={[[volver.texto, volver.href]]}
        title={
          <>
            {titulo}
            {estado ? <span style={{ display: 'inline-flex', marginLeft: 12, verticalAlign: 'middle', position: 'relative', top: -2 }}>{estado}</span> : null}
          </>
        }
        subtitle={proveedor ? (
          <>
            Equipo de <strong style={{ color: 'var(--adm-text)', fontWeight: 600 }}>{proveedor.name}</strong>
            {enRevision ? ' · lo ofreció desde su portal' : ''}
          </>
        ) : undefined}
      />

      {enRevision ? (
        <Note tone="warn" icon="ph-clipboard-text" style={{ marginBottom: 18 }}>
          <strong style={{ color: 'var(--adm-text)', fontWeight: 600 }}>Revisa lo que mandó el aliado.</strong> Corrige lo que haga falta (nombre, ficha, fotos), confirma
          de qué tipo es y publícalo. Si no sirve, recházalo con el motivo: le llega por correo.
        </Note>
      ) : null}

      <div className="pf-cols">
        {/* ════════ Columna principal ════════ */}
        <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
          <Tarjeta titulo="Qué es" icono="ph-package">
            <Campo etiqueta="Nombre" nota='Como lo buscaría un cliente: tipo y tamaño. Ej. "Excavadora 20 t".'>
              <input name="name" required minLength={2} defaultValue={initial.name ?? ''} className="adm-input" />
            </Campo>
            <div className="pf-2">
              <Campo etiqueta={tipoActual === 'servicio' ? 'Línea de servicio' : 'Categoría'}>
                <AdminSelect
                  name="categoryId"
                  required
                  ariaLabel="Línea de servicio"
                  placeholder="Selecciona…"
                  value={categoryId}
                  onChange={setCategoryId}
                  options={lineas.map((c) => ({ value: String(c.id), label: c.name }))}
                />
              </Campo>
              <Campo etiqueta="Marca y modelo">
                <input name="brand" defaultValue={initial.brand ?? ''} placeholder="CAT 320, John Deere 310L…" className="adm-input" />
              </Campo>
            </div>
            <Campo etiqueta="Resumen" nota="Una línea que sale arriba de la ficha en el sitio.">
              <input name="short" defaultValue={initial.short ?? ''} placeholder="Excavadora de 20 t con cucharón, lista para obra." className="adm-input" />
            </Campo>
            <Campo etiqueta="Descripción">
              <textarea name="description" required minLength={4} rows={5} defaultValue={initial.description ?? ''} className="adm-textarea" style={{ lineHeight: 1.55 }} />
            </Campo>
          </Tarjeta>

          <Tarjeta titulo="Ficha técnica" icono="ph-list-checks" ayuda={campos.length ? 'Las mismas preguntas que responde el aliado. Con ellas el emparejamiento sabe si el equipo alcanza lo que pide la obra.' : undefined}>
            {campos.length ? (
              <div className="pf-2">
                {campos.map((c) => (
                  <Campo key={c.clave} etiqueta={c.label} nota={c.hint}>
                    {c.tipo === 'opcion' ? (
                      <AdminSelect
                        ariaLabel={c.label}
                        value={attrs[c.clave] ?? ''}
                        onChange={(v) => setAttrs({ ...attrs, [c.clave]: v })}
                        options={[{ value: '', label: 'Sin dato' }, ...(c.opciones ?? []).map((o) => ({ value: o, label: o }))]}
                      />
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <input
                          value={attrs[c.clave] ?? ''}
                          onChange={(e) => setAttrs({ ...attrs, [c.clave]: e.target.value })}
                          inputMode={c.tipo === 'numero' ? 'decimal' : undefined}
                          className="adm-input"
                          style={c.unidad ? { paddingRight: 48 } : undefined}
                        />
                        {c.unidad ? <span style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--adm-muted)' }}>{c.unidad}</span> : null}
                      </div>
                    )}
                  </Campo>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--adm-muted)' }}>
                {slug ? 'Esta línea no tiene preguntas fijas: usa los datos extra.' : 'Elige la línea de servicio para ver sus preguntas.'}
              </p>
            )}
            <div style={{ borderTop: '1px solid var(--adm-border)', paddingTop: 14, display: 'grid', gap: 8 }}>
              <span className="adm-label">Datos extra (opcional)</span>
              {specs.map((s, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) auto', gap: 8, alignItems: 'center' }}>
                  <input value={s.label} onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Peso operativo" className="adm-input" aria-label="Dato" />
                  <input value={s.value} onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} placeholder="20,500 kg" className="adm-input" aria-label="Valor" />
                  <IconBtn icon="ph-x" label="Quitar dato" onClick={() => setSpecs(specs.filter((_, j) => j !== i))} />
                </div>
              ))}
              <div><Btn size="sm" icon="ph-plus" onClick={() => setSpecs([...specs, { label: '', value: '' }])}>Agregar dato</Btn></div>
            </div>
          </Tarjeta>

          {esTipo ? (
            <Tarjeta titulo="Precio en el cotizador" icono="ph-calculator" ayuda="Lo que se cobra al cotizarlo, en el sitio y en el panel. Un solo precio de MAQSER24 para todos los aliados que lo tengan.">
              <PrecioEnCotizador productId={initial.id} linea={slug} controlRef={precioCotizador} puedeEditar={puedeTarifas} />
            </Tarjeta>
          ) : null}

          <Tarjeta
            titulo={tipoActual === 'servicio' ? 'Disponibilidad' : 'Venta y existencias'}
            icono="ph-tag"
            ayuda={tipoActual === 'servicio'
              ? 'Cuántas hay, dónde están y en qué horario atienden.'
              : 'Precio fijo al que se vende y va al carrito.'}
          >
            <input type="hidden" name="priceUnit" value={unidad} />
            {/* Un servicio no lleva precio propio (precio único): se mandan vacíos para limpiar precios viejos. */}
            <input type="hidden" name="price" value={tipoActual === 'servicio' ? 0 : tarifasNum[unidad] ?? 0} />
            <input type="hidden" name="tarifas" value={tipoActual === 'servicio' ? '{}' : JSON.stringify(tarifasNum)} />
            <input type="hidden" name="costoAliado" value={tipoActual === 'servicio' ? '{}' : JSON.stringify(costoNum)} />
            <input type="hidden" name="minimo" value={Math.max(0, Number(minimo) || 0)} />
            <input type="hidden" name="horario" value={horario ? JSON.stringify(horario) : ''} />
            {tipoActual === 'servicio' ? (
              esTipo ? null : (
                <div style={{ fontSize: 13.5, color: 'var(--adm-muted)', lineHeight: 1.6 }}>
                  Es el equipo de un aliado: no lleva precio propio. Se cotiza con el precio de su tipo, que se pone en la ficha de
                  MAQSER24 de esta línea (Inventario).
                </div>
              )
            ) : (
            <>
            <div style={{ overflowX: 'auto' }}>
              <table className="adm-tbl pf-tarifas">
                <thead>
                  <tr>
                    <th>Por</th>
                    {proveedor ? <th>Cobra el aliado</th> : null}
                    <th>Precio al cliente</th>
                    {proveedor ? <th>Margen</th> : null}
                    <th style={{ textAlign: 'center' }}>Principal</th>
                  </tr>
                </thead>
                <tbody>
                  {unidadesPrecio.map((u) => {
                    const m = margenDe(tarifasNum[u.clave], costoNum[u.clave]);
                    return (
                      <tr key={u.clave}>
                        <td style={{ whiteSpace: 'nowrap' }}>{u.singular}</td>
                        {proveedor ? (
                          <td>
                            <input type="number" min={0} step="0.01" value={costo[u.clave] ?? ''} onChange={(e) => setCosto({ ...costo, [u.clave]: e.target.value })} placeholder="—" aria-label={`Cobra el aliado por ${u.singular}`} className="adm-input adm-num" style={{ width: 120, height: 34 }} />
                          </td>
                        ) : null}
                        <td>
                          <input type="number" min={0} step="0.01" value={publico[u.clave] ?? ''} onChange={(e) => setPublico({ ...publico, [u.clave]: e.target.value })} placeholder="—" aria-label={`Precio al cliente por ${u.singular}`} disabled={!puedeTarifas} className="adm-input adm-num" style={{ width: 130, height: 34 }} />
                        </td>
                        {proveedor ? (
                          <td className="adm-num" style={{ color: m === null ? 'var(--adm-muted)' : m < 0 ? 'var(--adm-bad)' : m < 10 ? 'var(--adm-warn)' : 'var(--adm-ok)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {m === null ? '—' : `${m} %`}
                          </td>
                        ) : null}
                        <td style={{ textAlign: 'center' }}>
                          <input type="radio" name="_principal" checked={unidad === u.clave} disabled={!puedeTarifas || !tarifasNum[u.clave]} onChange={() => setUnidad(u.clave)} aria-label={`${u.singular} como unidad principal`} style={{ accentColor: 'var(--adm-accent)' }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {proveedor ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <Btn size="sm" onClick={() => proponer(true)} disabled={!puedeTarifas || margenPct === null || Object.keys(costoNum).length === 0}>
                  Proponer con margen{margenPct !== null ? ` de ${margenPct} %` : ''}
                </Btn>
                <span className="adm-help">
                  El cliente ve solo el precio al cliente. El margen se cambia en Cotizador → Tarifas.
                </span>
              </div>
            ) : null}
            {/* Precios solo con el permiso "Tarifas" (decisión de Dirección, 2026-10-23):
                la API tampoco los guarda sin él. */}
            {!puedeTarifas ? (
              <span className="adm-help">Los precios al cliente solo los cambia Dirección (permiso «Tarifas»). Puedes guardar lo demás de la ficha.</span>
            ) : null}
            </>
            )}
            <div className="pf-2">
              {tipoActual === 'servicio' ? null : (
                <Campo etiqueta="Mínimo" nota={unidad ? `En ${unidadesPrecio.find((u) => u.clave === unidad)?.plural ?? 'unidades'}. 0 = sin mínimo.` : '0 = sin mínimo.'}>
                  <input type="number" min={0} step="1" value={minimo} onChange={(e) => setMinimo(e.target.value)} disabled={!puedeTarifas} className="adm-input" />
                </Campo>
              )}
              {/* `grupo`: lleva varios botones; dentro de un <label>, tocar el texto pulsaba el primero. */}
              <Campo grupo etiqueta="Horario en que atiende" nota="Solo se recomienda para trabajos dentro de este horario.">
                {horario ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {DIAS_SEMANA.map((d, i) => {
                        const on = horario.dias.includes(i);
                        return (
                          <button key={d} type="button" aria-pressed={on} onClick={() => setHorario({ ...horario, dias: on ? horario.dias.filter((x) => x !== i) : [...horario.dias, i].sort() })}
                            className={btnClass('secondary', 'sm', on ? 'pf-dia is-on' : 'pf-dia')}>
                            {d}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <div style={{ width: 128 }}><AdminTimePicker value={horario.desde} onChange={(v) => setHorario({ ...horario, desde: v })} aria-label="Desde" /></div>
                      <span style={{ color: 'var(--adm-muted)', fontSize: 13 }}>a</span>
                      <div style={{ width: 128 }}><AdminTimePicker value={horario.hasta} onChange={(v) => setHorario({ ...horario, hasta: v })} aria-label="Hasta" min={horario.desde} /></div>
                      <Btn size="sm" variant="ghost" onClick={() => setHorario(null)}>Quitar</Btn>
                    </div>
                  </div>
                ) : (
                  <Btn
                    onClick={() => setHorario(HORARIO_DEFAULT)}
                    style={{ justifyContent: 'flex-start', textAlign: 'left', whiteSpace: 'normal', height: 'auto', minHeight: 38, paddingTop: 8, paddingBottom: 8, lineHeight: 1.4, fontWeight: 500 }}
                  >
                    Sin horario: atiende siempre. Definir uno…
                  </Btn>
                )}
              </Campo>
            </div>
            <div className="pf-2">
              {tipoActual === 'servicio' ? null : isRental ? (
                <Campo etiqueta="Flete por km" nota="Opcional. Vacío = tarifa general del traslado.">
                  <input name="rentalFreight" type="number" step="0.01" min={0} defaultValue={initial.rentalFreight ?? ''} readOnly={!puedeTarifas} className="adm-input" />
                </Campo>
              ) : (
                <Campo etiqueta="Precio anterior" nota="Opcional, se muestra tachado como oferta.">
                  <input name="oldPrice" type="number" step="0.01" min={0} defaultValue={initial.oldPrice ?? ''} readOnly={!puedeTarifas} className="adm-input" />
                </Campo>
              )}
              <Campo etiqueta={isRental ? 'Unidades iguales' : 'Existencias'} nota={isRental ? 'Cuántas máquinas iguales tiene para rentar.' : 'Cuántas tiene para vender. Vacío = sin control.'}>
                <input name="stock" type="number" min={0} defaultValue={initial.stock ?? ''} className="adm-input" />
              </Campo>
            </div>
            <Campo etiqueta="Dónde está" nota="Patio o ciudad; sirve para calcular el traslado.">
              <input name="location" defaultValue={initial.location ?? ''} placeholder="Patio en García, N.L." className="adm-input" />
            </Campo>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13.5, color: 'var(--adm-text)', cursor: 'pointer' }}>
              <input type="checkbox" name="featured" defaultChecked={initial.featured} style={{ width: 16, height: 16, accentColor: 'var(--adm-accent)' }} />
              Destacado (aparece en el inicio del sitio)
            </label>
          </Tarjeta>
        </div>

        {/* ════════ Columna lateral ════════ */}
        <aside className="pf-side">
          {enRevision ? (
            <Tarjeta titulo="Revisión" icono="ph-seal-check" acento>
              {error ? <div role="alert"><Note tone="bad">{error}</Note></div> : null}
              {esUnidad ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--adm-muted)', lineHeight: 1.5 }}>
                  {tipoNombre
                    ? <>Tipo: <strong style={{ color: 'var(--adm-text)' }}>{tipoNombre}</strong>. Le llegarán las solicitudes de ese tipo.</>
                    : 'Sin tipo: elígelo o créalo en la tarjeta "Tipo" para que le lleguen las solicitudes de ese tipo.'}
                </p>
              ) : null}
              {rechazando ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Qué le falta o por qué no se publica (le llega por correo)" aria-label="Motivo del rechazo" className="adm-textarea" />
                  <Btn variant="danger" disabled={busy !== null || motivo.trim().length < 4} onClick={() => void onRechazar()}>
                    {busy === 'rechazar' ? 'Rechazando…' : 'Rechazar y avisarle'}
                  </Btn>
                  <Btn variant="ghost" onClick={() => { setRechazando(false); setMotivo(''); }}>Cancelar</Btn>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  <Btn variant="primary" disabled={busy !== null} onClick={() => void onPublicar()}>
                    {busy === 'publicar' ? 'Publicando…' : 'Guardar y publicar'}
                  </Btn>
                  <Btn type="submit" disabled={busy !== null}>
                    {busy === 'guardar' ? 'Guardando…' : 'Guardar sin publicar'}
                  </Btn>
                  <Btn variant="danger" onClick={() => setRechazando(true)}>Rechazar</Btn>
                </div>
              )}
            </Tarjeta>
          ) : null}

          {esUnidad ? (
            <Tarjeta titulo="Tipo" icono="ph-tag">
              {/* `key`: al crear un tipo, la opción nueva y el valor llegan juntos y
                  Radix se quedaba en "Sin tipo" (y al guardar lo borraba). */}
              <AdminSelect
                key={tiposLinea.map((t) => t.id).join('-')}
                ariaLabel="Tipo de equipo"
                value={tipoSel}
                onChange={setTipoSel}
                options={[
                  { value: '', label: 'Sin tipo' },
                  ...tiposLinea.map((t) => ({ value: String(t.id), label: `${t.name}${t.status !== 1 ? ' (inactivo)' : ''}` })),
                ]}
              />
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--adm-muted)', lineHeight: 1.5 }}>
                El tipo es la ficha que lleva el precio. Las solicitudes de ese tipo le llegan a este aliado, y al aceptar se aparta esta máquina.
              </p>
              {isEdit ? (
                nuevoTipo === null ? (
                  <Btn variant="ghost" onClick={() => setNuevoTipo(initial.name ?? '')}>Crear tipo nuevo</Btn>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <input value={nuevoTipo} onChange={(e) => setNuevoTipo(e.target.value)} aria-label="Nombre del tipo nuevo" placeholder="Retroexcavadora 4x4" className="adm-input" />
                    <Btn variant="primary" disabled={nuevoTipo.trim().length < 3} onClick={() => void crearTipo()}>Crear y asignar</Btn>
                    <Btn variant="ghost" onClick={() => setNuevoTipo(null)}>Cancelar</Btn>
                  </div>
                )
              ) : null}
            </Tarjeta>
          ) : null}

          <Tarjeta titulo="Fotos" icono="ph-images">
            <div style={{ display: 'grid', gap: 8 }}>
              <span className="adm-label">Principal <span style={{ color: 'var(--adm-faint)', fontWeight: 400 }}>· foto o video</span></span>
              {video ? (
                <video src={video} poster={principal ?? undefined} muted loop autoPlay playsInline style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 8, background: '#000', border: '1px solid var(--adm-border)', display: 'block' }} />
              ) : principal ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={principal} alt="" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 8, background: 'var(--adm-raised)', border: '1px solid var(--adm-border)', opacity: subiendoPrincipal ? 0.5 : 1 }} />
              ) : (
                <div style={{ aspectRatio: '4 / 3', borderRadius: 8, border: '1px dashed var(--adm-border-strong)', display: 'grid', placeItems: 'center', color: 'var(--adm-muted)', fontSize: 13 }}>Sin foto ni video</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: initial.id ? '1fr 1fr' : '1fr', gap: 6 }}>
                <label className={btnClass('secondary')} aria-disabled={subiendoPrincipal}>
                  <i className="ph ph-image" aria-hidden />
                  {subiendoPrincipal ? 'Subiendo…' : principal ? (video ? 'Cambiar portada' : 'Cambiar foto') : 'Subir foto'}
                  {/* `name="photo"`: al CREAR viaja con el alta. Al editar se sube sola al elegirla. */}
                  <input type="file" name="photo" accept={TIPOS_IMAGEN} style={{ display: 'none' }} disabled={subiendoPrincipal}
                    onChange={(e) => void elegirPrincipal(e.currentTarget)} />
                </label>
                {initial.id ? (
                  <label className={btnClass('secondary')} aria-disabled={subiendoVideo !== null}>
                    <i className="ph ph-video-camera" aria-hidden />
                    {subiendoVideo !== null ? `Subiendo… ${subiendoVideo}%` : video ? 'Cambiar video' : 'Subir video'}
                    <input type="file" accept="video/mp4,video/webm" style={{ display: 'none' }} disabled={subiendoVideo !== null}
                      onChange={(e) => void elegirVideo(e.currentTarget)} />
                  </label>
                ) : null}
              </div>
              {video && subiendoVideo === null ? (
                <Btn size="sm" variant="ghost" icon="ph-trash" onClick={() => void quitarVideo()}>Quitar video (vuelve la foto)</Btn>
              ) : null}
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--adm-muted)' }}>
                {!initial.id
                  ? principal ? 'La foto se sube al crear el equipo; el video, si quieres, después de crearlo.' : 'El video se puede subir después de crear el equipo.'
                  : video
                    ? 'El video se ve en la tarjeta y en la ficha; la foto queda de portada.'
                    : `Si subes video (MP4 o WebM, hasta ${VIDEO_MAX_MB} MB), se ve en lugar de la foto.`}
              </p>
            </div>
            {initial.id ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <span className="adm-label">Galería <span className="adm-num" style={{ color: 'var(--adm-faint)' }}>({fotos.length}/{MAX_GALERIA})</span></span>
                {fotos.length ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {fotos.map((f) => (
                      <div key={f.id} style={{ position: 'relative' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.url ?? ''} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, background: 'var(--adm-raised)', display: 'block' }} />
                        <button type="button" aria-label="Quitar foto" title="Quitar foto" onClick={() => void quitarFoto(f.id)} style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 6, border: 'none', background: 'rgba(0,0,0,.7)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 11 }}>
                          <i className="ph ph-x" aria-hidden />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                {fotos.length < MAX_GALERIA ? (
                  <>
                    <label className={btnClass('secondary')} aria-disabled={!!subiendo}>
                      {subiendo ? null : <i className="ph ph-plus" aria-hidden />}
                      {subiendo ? `Subiendo ${subiendo.va} de ${subiendo.de}…` : 'Agregar a la galería'}
                      <input type="file" multiple accept={TIPOS_IMAGEN} style={{ display: 'none' }} disabled={!!subiendo}
                        onChange={(e) => { const l = Array.from(e.target.files ?? []); e.target.value = ''; void subirFotos(l); }} />
                    </label>
                    <p style={{ margin: 0, fontSize: 12.5, color: 'var(--adm-muted)' }}>
                      Puedes elegir varias a la vez (caben {MAX_GALERIA - fotos.length} más).
                    </p>
                  </>
                ) : null}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--adm-muted)' }}>La galería se llena después de crear el equipo.</p>
            )}
          </Tarjeta>

          <Tarjeta titulo="De quién es" icono="ph-handshake">
            <AdminSelect
              name="providerId"
              ariaLabel="Proveedor"
              defaultValue={initial.providerId ? String(initial.providerId) : ''}
              options={[
                { value: '', label: tipoActual === 'servicio' ? 'Sin aliado · ficha del tipo' : 'Sin aliado' },
                ...providers.map((p) => ({ value: String(p.id), label: `${p.name}${p.level ? ` · ${p.level}` : ''}` })),
              ]}
            />
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--adm-muted)', lineHeight: 1.5 }}>
              Con proveedor, el aliado lo ve en su portal y el emparejamiento sabe que tiene esta máquina.
              {tipoActual === 'servicio' ? ' Sin aliado es la ficha del tipo: lleva el precio del cotizador, no es una máquina y nunca se aparta. Toda máquina real va a nombre del aliado que la tiene.' : null}
            </p>
          </Tarjeta>
        </aside>
      </div>

      {/* ── Barra de acciones (en revisión las acciones viven en la tarjeta Revisión) ── */}
      {enRevision ? null : (
      <div className="pf-bar">
        {error ? (
          <p role="alert" style={{ color: 'var(--adm-bad)', margin: 0, fontSize: 13.5, flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ph ph-warning-circle" aria-hidden style={{ fontSize: 16 }} />{error}
          </p>
        ) : <span style={{ flex: 1 }} />}
        <Btn variant="ghost" onClick={() => router.push(volver.href)}>Cancelar</Btn>
        {enRevision ? null : (
          <Btn variant="primary" type="submit" disabled={busy !== null}>
            {busy === 'guardar' ? 'Guardando…' : isEdit ? 'Guardar cambios' : `Crear ${singular}`}
          </Btn>
        )}
      </div>
      )}
    </form>
  );
}

// ---- piezas ----

/** Sección del formulario: un panel del kit con título, icono y ayuda opcional. */
function Tarjeta({ titulo, icono, ayuda, acento, children }: { titulo: string; icono: string; ayuda?: string; acento?: boolean; children: ReactNode }) {
  return (
    <Panel
      title={titulo}
      icon={icono}
      desc={ayuda}
      // margin 0: las secciones ya van separadas por el gap de su columna
      // (sin esto `.adm-panel + .adm-panel` sumaba 20px más).
      style={{ margin: 0, ...(acento ? { borderColor: 'color-mix(in srgb, var(--adm-warn) 45%, transparent)' } : null) }}
    >
      <div style={{ display: 'grid', gap: 14 }}>{children}</div>
    </Panel>
  );
}

function Campo({ etiqueta, nota, grupo, children }: { etiqueta: string; nota?: string; grupo?: boolean; children: ReactNode }) {
  // `grupo`: varios botones adentro; un <label> haría que tocar el texto pulse el primero.
  const Tag = grupo ? 'div' : 'label';
  return (
    <Tag className="adm-field">
      <span className="adm-label">{etiqueta}</span>
      {children}
      {nota ? <span className="adm-help">{nota}</span> : null}
    </Tag>
  );
}

function Opcion({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={btnClass('secondary', 'lg', activo ? 'pf-dia is-on' : undefined)}
    >
      {children}
    </button>
  );
}

const CSS = `
.pf { max-width: 1120px; margin: 0 auto; padding: 4px 0 24px; }
.pf-cols { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; align-items: start; }
.pf-side { display: grid; gap: 16px; position: sticky; top: 16px; }
.pf-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 16px; }
.pf-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px 16px; }
/* Renglones del precio en el cotizador: separados por una línea fina. */
.pf-renglon { display: grid; gap: 12px; padding-top: 14px; border-top: 1px solid var(--adm-border); }
/* Tabla de precios dentro del panel: sin la sangría de las tablas a todo lo ancho. */
.pf-tarifas th, .pf-tarifas td { padding: 8px 10px; }
.pf-tarifas th:first-child, .pf-tarifas td:first-child { padding-left: 0; }
.pf-tarifas th:last-child, .pf-tarifas td:last-child { padding-right: 0; }
.pf-tarifas tbody tr:hover td { background: none; }
/* Días del horario: varios se eligen a la vez, así que son botones que se
   prenden (acento), no un filtro segmentado. */
.adm-btn.pf-dia { min-width: 40px; padding: 0 8px; color: var(--adm-muted); font-weight: 500; }
.adm-btn.pf-dia.is-on { color: var(--adm-text); font-weight: 600; border-color: color-mix(in srgb, var(--adm-accent) 60%, transparent); background: color-mix(in srgb, var(--adm-accent) 13%, transparent); }
.pf-bar {
  position: sticky; bottom: 0; margin-top: 18px; display: flex; gap: 8px; align-items: center;
  padding: 14px 0; background: var(--adm-page); border-top: 1px solid var(--adm-border);
}
@media (max-width: 980px) {
  .pf-cols { grid-template-columns: minmax(0, 1fr); }
  .pf-side { position: static; }
}
@media (max-width: 620px) {
  .pf-2, .pf-3 { grid-template-columns: minmax(0, 1fr); }
}
`;
