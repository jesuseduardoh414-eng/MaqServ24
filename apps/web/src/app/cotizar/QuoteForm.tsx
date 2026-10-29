'use client';

import { useEffect, useRef, useState } from 'react';
import { ShDatePicker, VistaDocumento, type DatosDocumento } from '@maqserv/ui';
import Link from '@/components/Enlace';
import type { AuthUser, ProductCard, QuoteDetail } from '@maqserv/types';
import type { RequestForm } from '@maqserv/config';
import { requestAnswersToText } from '@maqserv/config';
import { useCart } from '@/components/CartProvider';
import { Icon } from '@/components/Icon';
import { RequirementFields, CLAVES_UBICACION, CLAVES_FECHA, hoyLocal } from './RequirementFields';
import {
  SitePicker, DESTINO_VACIO, empresaElegida, esObraNueva, faltaEnDestino,
  type Destino, type EmpresaCliente,
} from './SitePicker';
import { Stepper } from './Stepper';

/**
 * Estilos: piezas del sistema de diseño (`ms-panel`, `ms-field`, `ms-input`,
 * `ms-btn`…, ver components/EstilosSistema.tsx). Lo propio de esta pantalla
 * lleva el prefijo `qf-` y vive aquí. Las etiquetas de los campos van
 * visibles, no como placeholder: un placeholder desaparece al escribir y el
 * manual pide que el cliente sepa siempre qué le están preguntando
 * (30 / ACCESIBILIDAD).
 */
const CSS_QF = `
.qf-form{ display:grid; gap:18px; }
.qf-paso{ gap:18px; }
.qf-panel-h{ margin-bottom:16px; }
.qf-panel-h .ms-h2-desc{ margin-top:6px; }
.qf-thumb{ width:56px; height:56px; flex-shrink:0; border-radius:8px; object-fit:cover; background:repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-text) 5%, transparent) 0 12px, transparent 12px 24px) var(--color-bg); border:1px solid var(--color-border); }
.qf-thumb-sm{ width:46px; height:46px; }
.qf-thumb-xs{ width:36px; height:36px; border-radius:6px; }
.qf-prod{ display:flex; gap:14px; align-items:center; flex-wrap:wrap; }
.qf-prod-nom{ flex:1 1 200px; min-width:0; font-size:16.5px; font-weight:600; line-height:1.35; }
.qf-num{ display:flex; gap:8px; align-items:center; font-size:13px; color:var(--color-text-muted); }
.qf-num .ms-input{ width:84px; text-align:center; font-variant-numeric:tabular-nums; }
.qf-items{ display:grid; margin-bottom:16px; border-top:1px solid var(--color-border); }
.qf-item{ display:flex; gap:12px; align-items:center; flex-wrap:wrap; padding:12px 0; border-bottom:1px solid var(--color-border); }
.qf-item-txt{ flex:1 1 140px; min-width:0; display:grid; gap:5px; justify-items:start; }
.qf-item-nom{ font-size:14.5px; font-weight:600; }
.qf-quitar{ width:36px; height:36px; display:grid; place-items:center; border-radius:8px; border:1px solid var(--color-border); background:transparent; color:var(--color-text-muted); cursor:pointer; transition:color .18s ease, border-color .18s ease; }
.qf-quitar:hover{ color:var(--color-error); border-color:color-mix(in srgb, var(--color-error) 45%, var(--color-border)); }
.qf-quitar:focus-visible{ outline:2px solid var(--color-primary); outline-offset:2px; }
.qf-res{ margin-top:8px; border:1px solid var(--color-border); border-radius:8px; background:var(--color-bg); overflow:hidden; }
.qf-res-msg{ margin:0; padding:12px 14px; font-size:13.5px; color:var(--color-text-muted); }
.qf-hit{ display:flex; gap:11px; align-items:center; width:100%; text-align:left; border:none; border-bottom:1px solid var(--color-border); background:transparent; padding:10px 14px; cursor:pointer; color:var(--color-text); font:inherit; }
.qf-hit:last-child{ border-bottom:none; }
.qf-hit:hover, .qf-hit:focus-visible{ background:color-mix(in srgb, var(--color-text) 5%, transparent); outline:none; }
.qf-hit-nom{ flex:1; min-width:0; font-size:14px; font-weight:600; }
.qf-hit-mas{ font-size:13px; font-weight:600; color:var(--color-primary); }
.qf-datos{ display:grid; gap:18px; }
.qf-kv{ display:grid; margin:0; }
.qf-kv > div{ display:flex; justify-content:space-between; gap:16px; padding:10px 0; font-size:14px; border-bottom:1px solid var(--color-border); }
.qf-kv > div:first-child{ padding-top:0; }
.qf-kv dt{ color:var(--color-text-muted); }
.qf-kv dd{ margin:0; text-align:right; font-weight:600; color:var(--color-text); min-width:0; overflow-wrap:anywhere; }
.qf-nota{ text-align:center; }
.qf-nav{ display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
.qf-nav .qf-sig{ margin-left:auto; min-width:180px; }
.qf-back{ justify-self:start; }
.qf-back:hover svg{ transform:translateX(-3px); }
.qf-ok .ms-ico{ color:var(--color-success); background:color-mix(in srgb, var(--color-success) 10%, transparent); border-color:color-mix(in srgb, var(--color-success) 30%, transparent); }
.qf-folio{ margin-top:14px; display:grid; gap:2px; }
.qf-folio b{ font-family:var(--font-display); font-size:24px; font-weight:700; letter-spacing:-.02em; font-variant-numeric:tabular-nums; }
@media (max-width: 640px){
  .qf-nav .qf-sig{ flex:1 1 auto; min-width:0; }
}
`;

interface PickedItem {
  productId: number;
  name: string;
  image: string | null;
  isRental: boolean;
  qty: number;
  days: number;
}

/**
 * Solicitud de cotización (B2B). De dónde salen los equipos:
 *  - con `product` (viene de /cotizar?producto=slug): ese producto + qty/días
 *  - sin producto: una lista editable que arranca con lo que traiga el carrito
 *    y se completa con el buscador. Antes, sin producto y con el carrito vacío,
 *    la página era un callejón sin salida.
 * EXIGE SESIÓN (2026-09-23): la página pinta el candado en su lugar cuando no
 * la hay. Nombre, correo y teléfono salen del perfil; el correo no se edita
 * porque es la identidad de la cuenta (y la API lo impone igual), y el
 * teléfono que se capture aquí por primera vez se guarda en la cuenta.
 */
export function QuoteForm({
  product,
  servicio,
  formulario,
  categoriaServicio,
  user,
  logoDocumento,
  labels,
}: {
  product: ProductCard | null;
  /**
   * Nombre de la categoría de servicio cuando la solicitud NO parte de un
   * equipo del catálogo (agua en pipas, triturados). Llega por
   * `/cotizar?servicio=<slug>`.
   */
  servicio?: string | null;
  /** Preguntas propias del servicio (documento, 8 a 13). Null si no hay definidas. */
  formulario?: RequestForm | null;
  categoriaServicio?: string | null;
  user: AuthUser;
  /** Logo para fondo claro: el documento de la vista previa va en papel blanco. */
  logoDocumento?: string | null;
  labels: {
    name: string;
    email: string;
    phone: string;
    company: string;
    region: string;
    industry: string;
    address: string;
    comments: string;
    qty: string;
    days: string;
    submit: string;
    successTitle: string;
    successBody: string;
    numberLabel: string;
    emailLocked: string;
    phoneSaved: string;
  };
}) {
  const cart = useCart();
  const [qty, setQty] = useState(1);
  const [days, setDays] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<QuoteDetail | null>(null);
  const [reqs, setReqs] = useState<Record<string, string>>({});
  /**
   * EMPRESA Y OBRA (2026-10-23): toda solicitud lleva las dos. `empresas` son
   * las de su cuenta, cada una con sus obras (null mientras cargan). La obra
   * elegida se guarda entera y no solo su id porque también rellena la
   * dirección.
   */
  const [empresas, setEmpresas] = useState<EmpresaCliente[] | null>(null);
  const [destino, setDestino] = useState<Destino>(DESTINO_VACIO);
  const [faltaObra, setFaltaObra] = useState<string | null>(null);
  const obra = destino.obra;
  const obraNueva = esObraNueva(empresas ?? [], destino);
  const [direccion, setDireccion] = useState(user?.address ?? '');

  useEffect(() => {
    let vivo = true;
    fetch('/api/proxy/quotes/mis-obras')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vivo) return;
        // Si la API todavía contesta como antes (una sola empresa), se arma igual.
        const lista: EmpresaCliente[] = Array.isArray(d?.empresas)
          ? d.empresas
          : d?.client ? [{ id: d.client.id, name: d.client.name, sites: Array.isArray(d.sites) ? d.sites : [] }] : [];
        setEmpresas(lista);
        // La primera empresa ya va elegida; la obra no: a qué obra va lo decide él.
        if (lista[0]) setDestino((x) => (x.empresa ? x : { ...x, empresa: String(lista[0].id), nueva: lista[0].sites.length === 0 }));
      })
      .catch(() => { if (vivo) setEmpresas([]); });
    return () => { vivo = false; };
  }, []);

  /** Lo que falta de empresa, obra o dirección de la obra nueva, o null. */
  function faltaUbicacion(): string | null {
    return faltaEnDestino(empresas ?? [], destino)
      ?? (obraNueva && !direccion.trim() ? 'Escribe la dirección de la obra nueva.' : null);
  }

  /*
   * LO QUE YA SE SABE NO SE VUELVE A PREGUNTAR (2026-10-22). Si viene de un
   * producto (Block de concreto 6"), su opción en las preguntas de la línea
   * (Material: Block 6") se elige sola; y si la línea pregunta su propia
   * cantidad (piezas, m³…), no se pide además la del paso 1, que no lleva unidad.
   */
  const cantidadAparte = Boolean(product && formulario?.fields.some((c) => c.key === 'cantidad'));
  useEffect(() => {
    if (!product || !formulario) return;
    const palabras = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const delProducto = new Set(palabras(product.name));
    for (const campo of formulario.fields) {
      const opcion = campo.type === 'opcion' ? campo.options?.find((o) => palabras(o).every((w) => delProducto.has(w))) : undefined;
      if (opcion) setReqs((r) => (r[campo.key] ? r : { ...r, [campo.key]: opcion }));
    }
  }, [product, formulario]);

  /**
   * ASISTENTE POR ETAPAS (manual, 23 / COTIZACIÓN).
   *
   * "El flujo ideal reduce captura manual: servicio → ubicación → fecha →
   * requerimiento → opciones → confirmación. El usuario siempre sabe en qué
   * etapa se encuentra."
   *
   * "Opciones" todavía no existe —es el paso donde la plataforma devolverá
   * proveedores compatibles, y para eso hace falta el emparejamiento— así que
   * no se finge: el último paso es la confirmación de lo que se va a enviar.
   *
   * Las secciones NO se desmontan al cambiar de paso, se ocultan. Los campos son
   * no controlados y se leen con FormData al enviar: desmontarlos perdería lo
   * escrito en cuanto alguien retrocediera un paso.
   */
  const [paso, setPaso] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  const pasos = formulario
    ? [
        { clave: 'servicio', titulo: 'Servicio' },
        { clave: 'ubicacion', titulo: 'Ubicación' },
        { clave: 'fecha', titulo: 'Fecha' },
        { clave: 'requerimiento', titulo: 'Requerimiento' },
        { clave: 'datos', titulo: 'Tus datos' },
        { clave: 'confirmar', titulo: 'Confirmación' },
      ]
    : // Sin preguntas propias del servicio no hay con qué llenar tres pasos, y
      // pasos vacíos son peor que no tenerlos.
      [
        { clave: 'servicio', titulo: 'Servicio' },
        { clave: 'ubicacion', titulo: 'Ubicación y fecha' },
        { clave: 'datos', titulo: 'Tus datos' },
        { clave: 'confirmar', titulo: 'Confirmación' },
      ];

  const claveDe = (i: number) => pasos[i]?.clave;
  const esUltimo = paso === pasos.length - 1;

  /**
   * Valida SOLO los campos del paso visible. Se usa la validación del navegador
   * en vez de reimplementarla: ya sabe de correos, mínimos y campos requeridos.
   */
  function pasoValido(): boolean {
    const cont = formRef.current?.querySelector<HTMLElement>(`[data-paso="${claveDe(paso)}"]`);
    if (!cont) return true;
    const campos = Array.from(cont.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea'));
    for (const c of campos) {
      if (!c.checkValidity()) {
        c.reportValidity();
        return false;
      }
    }
    return true;
  }

  function siguiente() {
    if (!pasoValido()) return;
    // Elegir una obra no es un campo: el navegador no lo revisa (2026-10-23).
    if (claveDe(paso) === 'ubicacion') {
      const falta = faltaUbicacion();
      setFaltaObra(falta);
      if (falta) return;
    }
    setError(null);
    setPaso((p) => Math.min(pasos.length - 1, p + 1));
  }

  // Lista editable (solo cuando no vino un producto por URL)
  const [picked, setPicked] = useState<PickedItem[]>([]);
  const [seeded, setSeeded] = useState(false);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<ProductCard[]>([]);
  const [searching, setSearching] = useState(false);

  // El carrito hidrata desde localStorage, así que se copia cuando ya llegó (una sola vez).
  useEffect(() => {
    if (product || seeded || cart.items.length === 0) return;
    setPicked(cart.items.map((i) => ({
      productId: i.productId, name: i.name, image: i.image,
      isRental: Boolean(i.period), qty: i.qty, days: 1,
    })));
    setSeeded(true);
  }, [cart.items, product, seeded]);

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/proxy/catalog/products?search=${encodeURIComponent(q)}`);
        const d = await r.json();
        setResults(Array.isArray(d?.items) ? (d.items as ProductCard[]).slice(0, 6) : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [term]);

  function addPicked(p: ProductCard) {
    setPicked((list) => list.some((x) => x.productId === p.id)
      ? list.map((x) => (x.productId === p.id ? { ...x, qty: x.qty + 1 } : x))
      : [...list, { productId: p.id, name: p.name, image: p.image, isRental: p.isRental, qty: 1, days: 1 }]);
    setTerm('');
    setResults([]);
  }
  const patchPicked = (id: number, patch: Partial<PickedItem>) =>
    setPicked((list) => list.map((x) => (x.productId === id ? { ...x, ...patch } : x)));
  const removePicked = (id: number) => setPicked((list) => list.filter((x) => x.productId !== id));

  const items = product
    ? [{ productId: product.id, qty, ...(product.isRental ? { days } : {}) }]
    : picked.map((i) => ({ productId: i.productId, qty: i.qty, ...(i.isRental ? { days: i.days } : {}) }));

  const anyRental = product ? product.isRental : picked.some((i) => i.isRental);

  /*
   * "Destino de obra" y "Dirección de entrega" eran la misma pregunta dos veces
   * (2026-10-22): ahora la contesta la dirección, que se llena sola al elegir
   * la obra. Solo se pregunta aparte cuando son dos lugares (origen y destino).
   */
  const pideUbicacion = Boolean(formulario?.fields.some((c) => c.key === 'obra_ubicacion' && c.required));
  const conUbicacion = (r: Record<string, string>) =>
    pideUbicacion && !r.obra_ubicacion?.trim() && direccion.trim() ? { ...r, obra_ubicacion: direccion.trim() } : r;

  /** Lo que se manda a la API: igual para la vista previa y para el envío. */
  function cuerpoSolicitud(form: FormData) {
    const respuestas = conUbicacion(reqs);
    const emp = empresaElegida(empresas ?? [], destino);
    return {
      items,
      ...(servicio ? { service: servicio } : {}),
      customer: {
        name: String(form.get('name') ?? ''),
        email: String(form.get('email') ?? ''),
        phone: String(form.get('phone') ?? ''),
        // La empresa sale del paso de la obra (2026-10-23): la elegida de las
        // suyas, o la que escribió. Con ella el documento y el correo la nombran.
        company: emp?.name ?? (destino.empresaNueva.trim() || undefined),
        region: String(form.get('region') ?? '') || undefined,
        industry: String(form.get('industry') ?? '') || undefined,
      },
      address: String(form.get('address') ?? '') || undefined,
      ...(obra ? { siteId: obra.id } : {}),
      ...(emp ? { clientId: emp.id } : {}),
      ...(!obra && obraNueva && destino.obraNueva.trim() ? { siteName: destino.obraNueva.trim() } : {}),
      // El resumen legible se antepone a los comentarios para que quien
      // cotiza lo lea sin depender de una pantalla nueva; el JSON va aparte.
      comments: [
        formulario ? requestAnswersToText(formulario, respuestas) : '',
        String(form.get('comments') ?? ''),
      ].filter(Boolean).join('\n\n') || undefined,
      ...(categoriaServicio ? { serviceCategory: categoriaServicio } : {}),
      ...(Object.keys(respuestas).length ? { requirements: respuestas } : {}),
      acquisitionOption: anyRental ? 'renta' : 'compra',
    };
  }

  /**
   * LA SOLICITUD COMO DOCUMENTO (2026-10-19). "En lugar de ese resumen debe
   * aparecer el resumen en el documento; ya después en el admin se agrega lo
   * demás." Al llegar a Confirmación se le pide a la API el mismo documento
   * que verá en Mis cotizaciones, sin precios. Si no llega, queda la lista de
   * siempre: la vista previa no puede impedir que envíe.
   */
  const [vista, setVista] = useState<{ estado: 'cargando' | 'listo' | 'error'; datos?: DatosDocumento }>({ estado: 'cargando' });
  const enConfirmacion = claveDe(paso) === 'confirmar';
  useEffect(() => {
    if (!enConfirmacion || !formRef.current) return;
    let vivo = true;
    setVista({ estado: 'cargando' });
    fetch('/api/cotizar/vista-previa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpoSolicitud(new FormData(formRef.current))),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (!vivo) return;
        if (!r.ok || !d?.documento) { setVista({ estado: 'error' }); return; }
        setVista({
          estado: 'listo',
          datos: {
            titulo: 'Solicitud de cotización',
            folio: d.folio,
            fecha: d.documento.emitida,
            cliente: d.cliente,
            obra: d.obra ?? '',
            atencion: d.atencion ?? '',
            municipio: d.municipio ?? '',
            notas: d.notas ?? '',
            detalle: d.detalle ?? [],
            empresa: d.documento.empresa,
            firma: d.documento.firma,
            saludo: d.documento.saludo,
            calc: d.documento.calc,
            mostrarPrecios: false,
            logo: logoDocumento ?? null,
          },
        });
      })
      .catch(() => { if (vivo) setVista({ estado: 'error' }); });
    return () => { vivo = false; };
    // Se pide al ENTRAR a Confirmación: ahí los campos ya no cambian (están
    // ocultos), y volver a un paso para corregir y regresar la vuelve a pedir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enConfirmacion]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Con `servicio` (pipas, triturados) no hay equipo que agregar: lo que
    // define la cotización va en el texto de la solicitud.
    if (items.length === 0 && !servicio) { setError('Agrega al menos un equipo a cotizar'); return; }
    // Se pudo llegar aquí tocando los pasos de arriba sin pasar por "Continuar".
    const faltaDestino = faltaUbicacion();
    if (faltaDestino) {
      setFaltaObra(faltaDestino);
      setPaso(Math.max(0, pasos.findIndex((p) => p.clave === 'ubicacion')));
      return;
    }
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch('/api/cotizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpoSolicitud(form)),
    });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (res.status === 401) {
      // La sesión caducó mientras llenaba el formulario.
      setError('Tu sesión terminó. Entra de nuevo y vuelve a enviar la solicitud.');
      return;
    }
    if (!res.ok || !data?.quoteNumber) {
      setError(typeof data?.message === 'string' ? data.message : 'No pudimos enviar tu solicitud');
      return;
    }
    if (!product) cart.clear(); // los equipos del carrito ya quedaron en la cotización
    setDone(data as QuoteDetail);
  }

  if (done) {
    return (
      <div className="ms-empty qf-ok" role="status">
        <style>{CSS_QF}</style>
        <span className="ms-ico ms-ico-lg" aria-hidden><Icon name="check" size={22} /></span>
        <h2 className="ms-empty-t">{labels.successTitle}</h2>
        <p className="ms-empty-p">{labels.successBody}</p>
        <div className="qf-folio">
          <span className="ms-small ms-muted">{labels.numberLabel}</span>
          <b>{done.quoteNumber}</b>
        </div>
        <div className="ms-empty-acts">
          <Link href="/cuenta/cotizaciones" className="ms-btn">Ver mis cotizaciones<Icon name="arrowRight" size={16} /></Link>
        </div>
      </div>
    );
  }

  /** Oculta en vez de desmontar: ver la nota del asistente arriba. */
  const visible = (clave: string): React.CSSProperties => ({
    display: claveDe(paso) === clave ? 'grid' : 'none',
  });

  return (
    <form ref={formRef} onSubmit={onSubmit} className="qf-form">
      <style>{CSS_QF}</style>
      <Stepper pasos={pasos} actual={paso} onIr={setPaso} />

      <div data-paso="servicio" className="qf-paso" style={visible('servicio')}>
      {product ? (
        <section className="ms-panel">
          <h2 className="ms-h2 qf-panel-h">Equipo a cotizar</h2>
          <div className="qf-prod">
            {product.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image} alt="" className="qf-thumb" />
            ) : <span className="qf-thumb" aria-hidden />}
            <strong className="qf-prod-nom">{product.name}</strong>
            {cantidadAparte ? null : (
              <label className="qf-num">
                {labels.qty}
                <CampoNumero valor={qty} max={999} onCambio={setQty} />
              </label>
            )}
            {product.isRental ? (
              <label className="qf-num">
                {labels.days}
                <CampoNumero valor={days} max={365} onCambio={setDays} />
              </label>
            ) : null}
          </div>
        </section>
      ) : (
        /* Lista editable + buscador: así /cotizar sirve aunque el carrito esté vacío. */
        <section className="ms-panel">
          <div className="qf-panel-h">
            <h2 className="ms-h2">
              {servicio ? `Servicio: ${servicio}` : `Equipos a cotizar${picked.length > 0 ? ` (${picked.length})` : ''}`}
            </h2>

            {servicio && picked.length === 0 ? (
              /* Agua en pipas y triturados no tienen catálogo: no hay equipo que
                 buscar, lo que define la cotización son volumen, origen, destino
                 y fechas. Se pide en el campo de comentarios de abajo. */
              <p className="ms-h2-desc">
                Este servicio se cotiza por volumen y recorrido, no por equipo. Indícanos cantidad,
                origen, destino y fechas en el campo de detalles y te devolvemos opciones.
              </p>
            ) : picked.length === 0 ? (
              <p className="ms-h2-desc">
                Busca el equipo que necesitas y agrégalo. Puedes incluir varios en la misma cotización.
              </p>
            ) : null}
          </div>

          {picked.length > 0 ? (
            <div className="qf-items">
              {picked.map((i) => (
                <div key={i.productId} className="qf-item">
                  {i.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.image} alt="" className="qf-thumb qf-thumb-sm" />
                  ) : <span className="qf-thumb qf-thumb-sm" aria-hidden />}
                  <span className="qf-item-txt">
                    <span className="qf-item-nom">{i.name}</span>
                    <span className="ms-chip">{i.isRental ? 'Renta' : 'Venta'}</span>
                  </span>
                  <label className="qf-num">
                    {labels.qty}
                    <CampoNumero valor={i.qty} max={999} onCambio={(n) => patchPicked(i.productId, { qty: n })} />
                  </label>
                  {i.isRental ? (
                    <label className="qf-num">
                      {labels.days}
                      <CampoNumero valor={i.days} max={365} onCambio={(n) => patchPicked(i.productId, { days: n })} />
                    </label>
                  ) : null}
                  <button type="button" onClick={() => removePicked(i.productId)} aria-label={`Quitar ${i.name}`} className="qf-quitar"><Icon name="x" size={16} /></button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="ms-field">
            <label htmlFor="qf-buscar" className="ms-label">Buscar equipo</label>
            <input
              id="qf-buscar"
              className="ms-input"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Escribe el nombre del equipo…"
            />
            {term.trim().length >= 2 ? (
              <div className="qf-res">
                {searching ? (
                  <p className="qf-res-msg">Buscando…</p>
                ) : results.length === 0 ? (
                  <p className="qf-res-msg">Sin resultados para “{term}”.</p>
                ) : (
                  results.map((r) => (
                    <button key={r.id} type="button" onClick={() => addPicked(r)} className="qf-hit">
                      {r.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.image} alt="" className="qf-thumb qf-thumb-xs" />
                      ) : <span className="qf-thumb qf-thumb-xs" aria-hidden />}
                      <span className="qf-hit-nom">{r.name}</span>
                      <span className="ms-chip">{r.isRental ? 'Renta' : 'Venta'}</span>
                      <span className="qf-hit-mas">Agregar</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </section>
      )}

      </div>

      {/* PASO · UBICACIÓN. El documento insiste en que la ubicación forma parte
          del producto: define el traslado y qué proveedor puede atender. Por eso
          tiene paso propio en vez de ir perdida entre las demás preguntas. */}
      <div data-paso="ubicacion" className="qf-paso" style={visible('ubicacion')}>
        {formulario ? (
          <RequirementFields
            form={formulario}
            values={reqs}
            onChange={(k, v) => setReqs((r) => ({ ...r, [k]: v }))}
            only={CLAVES_UBICACION.filter((k) => k !== 'obra_ubicacion')}
            titulo="¿Dónde se necesita?"
            intro="Con esto calculamos el traslado y vemos qué aliados cubren esa zona."
          />
        ) : null}
        {/* Empresa y obra (2026-10-23): las suyas para elegir, o nuevas. */}
        {empresas === null ? (
          <section className="ms-panel">
            <p className="ms-hint" role="status">Cargando tus obras…</p>
          </section>
        ) : (
          <SitePicker
            empresas={empresas}
            destino={destino}
            falta={faltaObra}
            onCambio={(d) => {
              setFaltaObra(null);
              // Elegir una obra rellena la dirección, no la bloquea: una obra
              // grande tiene varios accesos y el cliente tiene que poder
              // escribir "por la puerta 4". Pasar a una obra nueva la vacía
              // si era la de la obra que tenía elegida.
              if (d.obra && d.obra.id !== destino.obra?.id && d.obra.address) setDireccion(d.obra.address);
              else if (!d.obra && destino.obra && direccion === (destino.obra.address ?? '')) setDireccion('');
              setDestino(d);
            }}
          />
        )}
        <section className="ms-panel">
          <div className="ms-field">
            <label htmlFor="qf-address" className="ms-label">
              {obraNueva ? 'Dirección de la obra' : 'Dirección de entrega'}
              {pideUbicacion || obraNueva ? <span className="ms-req" aria-hidden>*</span> : null}
            </label>
            {/* Controlado SOLO este campo: elegir una obra tiene que poder
                rellenarlo, y un defaultValue no se vuelve a leer despues del
                primer render. Los demas siguen saliendo de FormData. */}
            <input
              id="qf-address"
              className="ms-input"
              name="address"
              value={direccion}
              required={pideUbicacion || obraNueva}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder={labels.address}
            />
            <p className="ms-hint">
              {obra
                ? 'Viene de tu obra. Cámbiala solo si se entrega por otro acceso.'
                : 'Calle, número, colonia y municipio. Entre más exacta, mejor calculamos el costo de traslado.'}
            </p>
          </div>
        </section>
        {/* Sin preguntas propias del servicio, la fecha se pide aquí: un paso
            solo para una fecha sería un paso vacío. */}
        {!formulario ? (
          <section className="ms-panel">
            <div className="ms-field">
              <label htmlFor="qf-fecha" className="ms-label">¿Para cuándo?</label>
              <ShDatePicker
                id="qf-fecha"
                min={hoyLocal()}
                value={reqs.fecha_inicio ?? ''}
                onChange={(v) => setReqs((r) => ({ ...r, fecha_inicio: v }))}
                placeholder="Elige el día de inicio"
              />
            </div>
          </section>
        ) : null}
      </div>

      {/* PASO · FECHA */}
      {formulario ? (
        <div data-paso="fecha" className="qf-paso" style={visible('fecha')}>
          <RequirementFields
            form={formulario}
            values={reqs}
            onChange={(k, v) => setReqs((r) => ({ ...r, [k]: v }))}
            only={CLAVES_FECHA}
            titulo="¿Para cuándo y por cuánto tiempo?"
            intro="La disponibilidad depende de la fecha: un equipo libre hoy puede estar comprometido la semana que entra."
          />
        </div>
      ) : null}

      {/* PASO · REQUERIMIENTO — el resto de las preguntas del servicio. */}
      {formulario ? (
        <div data-paso="requerimiento" className="qf-paso" style={visible('requerimiento')}>
          <RequirementFields
            form={formulario}
            values={reqs}
            onChange={(k, v) => setReqs((r) => ({ ...r, [k]: v }))}
            except={[...CLAVES_UBICACION, ...CLAVES_FECHA]}
          />
        </div>
      ) : null}

      {/* PASO · TUS DATOS. Van al final a propósito: el contacto es el trámite,
          no lo que define la cotización. */}
      <div data-paso="datos" className="qf-paso" style={visible('datos')}>
        <section className="ms-panel">
          <h2 className="ms-h2 qf-panel-h">Tus datos</h2>
          <div className="qf-datos">
            <div className="ms-field">
              <label htmlFor="qf-name" className="ms-label">{labels.name}<span className="ms-req" aria-hidden>*</span></label>
              <input id="qf-name" className="ms-input" name="name" required minLength={2} defaultValue={user.name ?? ''} />
            </div>
            <div className="ms-grid2">
              <div className="ms-field">
                <label htmlFor="qf-email" className="ms-label">{labels.email}</label>
                {/* Solo lectura: es la identidad de la cuenta y la API lo impone igual. */}
                <input id="qf-email" className="ms-input" name="email" type="email" required readOnly defaultValue={user.email} title={labels.emailLocked} style={{ color: 'var(--color-text-muted)', cursor: 'not-allowed' }} />
              </div>
              <div className="ms-field">
                <label htmlFor="qf-phone" className="ms-label">{labels.phone}<span className="ms-req" aria-hidden>*</span></label>
                <input id="qf-phone" className="ms-input" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="81 1234 5678" required maxLength={20} defaultValue={user.phone ?? ''} />
              </div>
              <p className="ms-hint ms-span">
                {labels.emailLocked}{!user.phone ? ` ${labels.phoneSaved}` : ''}
              </p>
              {/* La empresa ya no se pide aquí (2026-10-23): se eligió con la obra. */}
              <div className="ms-field">
                <label htmlFor="qf-industry" className="ms-label">{labels.industry}</label>
                <input id="qf-industry" className="ms-input" name="industry" />
              </div>
            </div>
            <div className="ms-field">
              <label htmlFor="qf-region" className="ms-label">{labels.region}</label>
              <input id="qf-region" className="ms-input" name="region" />
            </div>
            <div className="ms-field">
              <label htmlFor="qf-comments" className="ms-label">{labels.comments}</label>
              <textarea id="qf-comments" className="ms-textarea" name="comments" rows={3} />
            </div>
          </div>
        </section>
      </div>

      {/* PASO · CONFIRMACIÓN. Se enseña lo que se va a enviar antes de enviarlo:
          es la última oportunidad de corregir sin tener que llamar después. */}
      <div data-paso="confirmar" className="qf-paso" style={visible('confirmar')}>
        <section className="ms-panel">
          <div className="qf-panel-h">
            <h2 className="ms-h2">Revisa antes de enviar</h2>
            <p className="ms-h2-desc">
              Así nos llega tu solicitud. Los precios los agregamos al revisarla. Si algo no cuadra, toca cualquier paso de arriba para corregirlo.
            </p>
          </div>
          {vista.estado === 'listo' && vista.datos ? (
            <VistaDocumento datos={vista.datos} />
          ) : vista.estado === 'cargando' ? (
            <p className="ms-hint" role="status">Armando el documento…</p>
          ) : (
            <dl className="qf-kv">
              <Resumen etiqueta="Servicio" valor={servicio ?? (product ? product.name : `${picked.length} equipo(s)`)} />
              <Resumen etiqueta="Empresa" valor={empresaElegida(empresas ?? [], destino)?.name ?? destino.empresaNueva} />
              <Resumen etiqueta="Obra" valor={obra?.name ?? destino.obraNueva} />
              {formulario
                ? formulario.fields
                    .filter((f) => (reqs[f.key] ?? '').trim())
                    .map((f) => <Resumen key={f.key} etiqueta={f.label} valor={reqs[f.key]} />)
                : null}
            </dl>
          )}
        </section>

        {error ? (
          <div role="alert" className="ms-alert ms-alert-bad">
            <Icon name="warning" size={18} style={{ color: 'var(--color-error)', marginTop: 2 }} />
            <span>{error}</span>
          </div>
        ) : null}

        <button type="submit" className="ms-btn ms-btn-lg ms-btn-block" disabled={loading || (items.length === 0 && !servicio)}>
          {loading ? 'Enviando…' : labels.submit}
        </button>
        <p className="ms-hint qf-nota">
          Sin costo ni compromiso. Un asesor te responde con precios y disponibilidad.
        </p>
      </div>

      {/* Navegación. "Regresar" siempre disponible, como pide el manual. */}
      {!esUltimo ? (
        <div className="qf-nav">
          {paso > 0 ? (
            <button type="button" className="ms-btn ms-btn-sec" onClick={() => setPaso((p) => Math.max(0, p - 1))}>
              <Icon name="arrowLeft" size={16} />Regresar
            </button>
          ) : null}
          <button type="button" className="ms-btn qf-sig" onClick={siguiente}>
            Continuar<Icon name="arrowRight" size={16} />
          </button>
        </div>
      ) : (
        <button type="button" className="ms-link ms-link-muted qf-back" onClick={() => setPaso((p) => Math.max(0, p - 1))}>
          <Icon name="arrowLeft" size={15} />Regresar
        </button>
      )}
    </form>
  );
}

/**
 * CANTIDAD Y DÍAS (2026-10-19). Antes eran `type="number"` controlados y lo
 * borrado se volvía 1 al instante: no había forma de borrar y escribir otro
 * número. Además las flechas de subir y bajar solo estorbaban (y la rueda del
 * ratón cambiaba la cantidad sin querer al recorrer la página).
 *
 * Ahora es texto numérico: se puede dejar vacío mientras se escribe, solo
 * acepta dígitos, y cada número válido (1 a `max`) se pasa de inmediato. Si
 * sale del campo vacío o en 0, regresa al último número válido.
 */
function CampoNumero({ valor, max, onCambio }: { valor: number; max: number; onCambio: (n: number) => void }) {
  const [texto, setTexto] = useState(String(valor));
  // Si el número cambia desde fuera (agregar otra vez el mismo equipo suma 1).
  useEffect(() => setTexto(String(valor)), [valor]);
  return (
    <input
      className="ms-input"
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={String(max).length}
      value={texto}
      onChange={(e) => {
        const limpio = e.target.value.replace(/\D/g, '');
        setTexto(limpio);
        const n = Number(limpio);
        if (limpio && n >= 1) onCambio(Math.min(max, n));
      }}
      onBlur={() => setTexto(String(valor))}
    />
  );
}

/** Fila del resumen final. */
function Resumen({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt>{etiqueta}</dt>
      <dd>{valor}</dd>
    </div>
  );
}
