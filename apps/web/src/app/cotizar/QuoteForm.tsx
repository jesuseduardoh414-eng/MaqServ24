'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { AuthUser, ProductCard, QuoteDetail } from '@maqserv/types';
import type { RequestForm } from '@maqserv/config';
import { requestAnswersToText } from '@maqserv/config';
import { useCart } from '@/components/CartProvider';
import { Icon } from '@/components/Icon';
import { RequirementFields, CLAVES_UBICACION, CLAVES_FECHA } from './RequirementFields';
import { SitePicker, type ObraCliente } from './SitePicker';
import { Stepper } from './Stepper';

const MONO = "'Inter', system-ui, sans-serif";
const DISPLAY = 'var(--font-display)';
const stripe = 'repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-text) 5%, transparent) 0 12px, transparent 12px 24px)';

const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 4,
  padding: '22px 24px',
};

const legendStyle: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: 11,
  letterSpacing: '0.14em',
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  margin: '0 0 16px',
};

const fieldStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '13px 14px',
  fontSize: 14.5,
  fontFamily: 'inherit',
  color: 'var(--color-text)',
  background: 'var(--color-bg)',
  border: '1px solid var(--color-border)',
  borderRadius: 4,
  outline: 'none',
};

/** Etiqueta de las preguntas del servicio. Van visibles, no como placeholder:
 *  un placeholder desaparece al escribir y el manual pide que el cliente sepa
 *  siempre que le estan preguntando (30 / ACCESIBILIDAD). */
const labelReqStyle: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 };

const numField: React.CSSProperties = { ...fieldStyle, width: 66, padding: '8px 8px', textAlign: 'center', fontFamily: MONO, fontSize: 13 };

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
 * Funciona para invitados; si hay sesión se prellenan los datos.
 */
export function QuoteForm({
  product,
  servicio,
  formulario,
  categoriaServicio,
  user,
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
  user: AuthUser | null;
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
   * Obra elegida, cuando el cliente ya tiene obras registradas. Se guarda el
   * objeto y no solo el id porque tambien rellena la direccion y el contacto.
   */
  const [obra, setObra] = useState<ObraCliente | null>(null);
  const [direccion, setDireccion] = useState(user?.address ?? '');

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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Con `servicio` (pipas, triturados) no hay equipo que agregar: lo que
    // define la cotización va en el texto de la solicitud.
    if (items.length === 0 && !servicio) { setError('Agrega al menos un equipo a cotizar'); return; }
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch('/api/cotizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        ...(servicio ? { service: servicio } : {}),
        customer: {
          name: String(form.get('name') ?? ''),
          email: String(form.get('email') ?? ''),
          phone: String(form.get('phone') ?? ''),
          company: String(form.get('company') ?? '') || undefined,
          region: String(form.get('region') ?? '') || undefined,
          industry: String(form.get('industry') ?? '') || undefined,
        },
        address: String(form.get('address') ?? '') || undefined,
        ...(obra ? { siteId: obra.id } : {}),
        // El resumen legible se antepone a los comentarios para que quien
        // cotiza lo lea sin depender de una pantalla nueva; el JSON va aparte.
        comments: [
          formulario ? requestAnswersToText(formulario, reqs) : '',
          String(form.get('comments') ?? ''),
        ].filter(Boolean).join('\n\n') || undefined,
        ...(categoriaServicio ? { serviceCategory: categoriaServicio } : {}),
        ...(Object.keys(reqs).length ? { requirements: reqs } : {}),
        acquisitionOption: anyRental ? 'renta' : 'compra',
      }),
    });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok || !data?.quoteNumber) {
      setError(typeof data?.message === 'string' ? data.message : 'No pudimos enviar tu solicitud');
      return;
    }
    if (!product) cart.clear(); // los equipos del carrito ya quedaron en la cotización
    setDone(data as QuoteDetail);
  }

  if (done) {
    return (
      <div style={{ ...cardStyle, maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '40px 28px' }}>
        <div style={{ width: 52, height: 52, margin: '0 auto 18px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--color-success)', color: 'var(--color-bg)', fontSize: 26, fontWeight: 800 }} aria-hidden><Icon name="check" size={26} /></div>
        <h2 style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 10px' }}>{labels.successTitle}</h2>
        <p style={{ color: 'var(--color-text-muted)', margin: '0 0 20px', lineHeight: 1.6 }}>{labels.successBody}</p>
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 18 }}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{labels.numberLabel}</div>
          <div style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 4 }}>{done.quoteNumber}</div>
        </div>
        <Link href="/cuenta/cotizaciones" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 22, fontFamily: DISPLAY, fontWeight: 700, fontSize: 15, background: 'var(--color-primary)', color: 'var(--color-primary-fg)', textDecoration: 'none', padding: '13px 26px', borderRadius: 100 }}>Ver mis cotizaciones<Icon name="arrowRight" size={15} /></Link>
      </div>
    );
  }

  /** Oculta en vez de desmontar: ver la nota del asistente arriba. */
  const visible = (clave: string): React.CSSProperties => ({
    display: claveDe(paso) === clave ? 'grid' : 'none',
    gap: 18,
  });

  return (
    <form ref={formRef} onSubmit={onSubmit} style={{ display: 'grid', gap: 18 }}>
      <Stepper pasos={pasos} actual={paso} onIr={setPaso} />

      <div data-paso="servicio" style={visible('servicio')}>
      {product ? (
        <div style={cardStyle}>
          <h2 style={legendStyle}>Equipo a cotizar</h2>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            {product.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image} alt="" style={{ width: 56, height: 56, borderRadius: 3, objectFit: 'cover', background: 'var(--color-bg)' }} />
            ) : <span style={{ width: 56, height: 56, borderRadius: 3, background: stripe }} />}
            <strong style={{ flex: '1 1 200px', fontFamily: DISPLAY, fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em' }}>{product.name}</strong>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              {labels.qty}
              <input type="number" min={1} max={999} value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} style={numField} />
            </label>
            {product.isRental ? (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                {labels.days}
                <input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value) || 1)} style={numField} />
              </label>
            ) : null}
          </div>
        </div>
      ) : (
        /* Lista editable + buscador: así /cotizar sirve aunque el carrito esté vacío. */
        <div style={cardStyle}>
          <h2 style={legendStyle}>
            {servicio ? `Servicio · ${servicio}` : `Equipos a cotizar ${picked.length > 0 ? `· ${picked.length}` : ''}`}
          </h2>

          {servicio && picked.length === 0 ? (
            /* Agua en pipas y triturados no tienen catálogo: no hay equipo que
               buscar, lo que define la cotización son volumen, origen, destino
               y fechas. Se pide en el campo de comentarios de abajo. */
            <p style={{ margin: '0 0 14px', color: 'var(--color-text-muted)', fontSize: 13.5, lineHeight: 1.6 }}>
              Este servicio se cotiza por volumen y recorrido, no por equipo. Indícanos cantidad,
              origen, destino y fechas en el campo de detalles y te devolvemos opciones.
            </p>
          ) : picked.length === 0 ? (
            <p style={{ margin: '0 0 14px', color: 'var(--color-text-muted)', fontSize: 13.5, lineHeight: 1.6 }}>
              Busca el equipo que necesitas y agrégalo. Puedes incluir varios en la misma cotización.
            </p>
          ) : (
            <div style={{ display: 'grid', marginBottom: 14 }}>
              {picked.map((i) => (
                <div key={i.productId} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--color-border)', padding: '12px 0' }}>
                  {i.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.image} alt="" style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 3, objectFit: 'cover', background: 'var(--color-bg)' }} />
                  ) : <span style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 3, background: stripe }} />}
                  <span style={{ flex: '1 1 140px', minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{i.name}</span>
                    <span style={{ display: 'block', fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginTop: 2 }}>{i.isRental ? 'RENTA' : 'VENTA'}</span>
                  </span>
                  <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                    {labels.qty}
                    <input type="number" min={1} max={999} value={i.qty} onChange={(e) => patchPicked(i.productId, { qty: Number(e.target.value) || 1 })} style={numField} />
                  </label>
                  {i.isRental ? (
                    <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                      {labels.days}
                      <input type="number" min={1} max={365} value={i.days} onChange={(e) => patchPicked(i.productId, { days: Number(e.target.value) || 1 })} style={numField} />
                    </label>
                  ) : null}
                  <button type="button" onClick={() => removePicked(i.productId)} aria-label={`Quitar ${i.name}`} style={{ border: 'none', background: 'transparent', color: 'var(--color-error)', cursor: 'pointer', fontSize: 14, fontWeight: 700, padding: '4px 6px' }}><Icon name="x" size={14} /></button>
                </div>
              ))}
            </div>
          )}

          <div style={{ position: 'relative' }}>
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Buscar equipo por nombre…"
              aria-label="Buscar equipo"
              style={fieldStyle}
            />
            {term.trim().length >= 2 ? (
              <div style={{ marginTop: 8, border: '1px solid var(--color-border)', borderRadius: 4, background: 'var(--color-bg)', overflow: 'hidden' }}>
                {searching ? (
                  <p style={{ margin: 0, padding: '11px 14px', fontFamily: MONO, fontSize: 11.5, letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>BUSCANDO…</p>
                ) : results.length === 0 ? (
                  <p style={{ margin: 0, padding: '11px 14px', fontSize: 13, color: 'var(--color-text-muted)' }}>Sin resultados para “{term}”.</p>
                ) : (
                  results.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => addPicked(r)}
                      className="qf-hit"
                      style={{ display: 'flex', gap: 11, alignItems: 'center', width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid var(--color-border)', background: 'transparent', padding: '10px 14px', cursor: 'pointer', color: 'var(--color-text)', fontFamily: 'inherit' }}
                    >
                      {r.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.image} alt="" style={{ width: 34, height: 34, borderRadius: 3, objectFit: 'cover', background: 'var(--color-surface)' }} />
                      ) : <span style={{ width: 34, height: 34, borderRadius: 3, background: stripe }} />}
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600 }}>{r.name}</span>
                      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>{r.isRental ? 'RENTA' : 'VENTA'}</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)', lineHeight: 1 }}>+</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      </div>

      {/* PASO · UBICACIÓN. El documento insiste en que la ubicación forma parte
          del producto: define el traslado y qué proveedor puede atender. Por eso
          tiene paso propio en vez de ir perdida entre las demás preguntas. */}
      <div data-paso="ubicacion" style={visible('ubicacion')}>
        {formulario ? (
          <RequirementFields
            form={formulario}
            values={reqs}
            onChange={(k, v) => setReqs((r) => ({ ...r, [k]: v }))}
            estilos={{ campo: fieldStyle, etiqueta: labelReqStyle, tarjeta: cardStyle, leyenda: legendStyle }}
            only={CLAVES_UBICACION}
            titulo="¿Dónde se necesita?"
            intro="Con esto calculamos el traslado y vemos qué aliados cubren esa zona."
          />
        ) : null}
        {/* A quien ya nos dijo donde trabaja no se le vuelve a preguntar.
            Si no tiene obras, esto no pinta nada. */}
        <SitePicker
          estilos={{ tarjeta: cardStyle, leyenda: legendStyle }}
          onElegir={(o) => {
            setObra(o);
            // Rellena, no bloquea: una obra grande tiene varios accesos y el
            // cliente tiene que poder escribir "por la puerta 4".
            if (o?.address) setDireccion(o.address);
          }}
        />
        <div style={cardStyle}>
          <h2 style={legendStyle}>Dirección de entrega</h2>
          {/* Controlado SOLO este campo: elegir una obra tiene que poder
              rellenarlo, y un defaultValue no se vuelve a leer despues del
              primer render. Los demas siguen saliendo de FormData. */}
          <input
            className="qf-field"
            name="address"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            placeholder={labels.address}
            aria-label={labels.address}
            style={fieldStyle}
          />
          <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
            Entre más exacta, mejor calculamos el costo de traslado.
          </p>
        </div>
        {/* Sin preguntas propias del servicio, la fecha se pide aquí: un paso
            solo para una fecha sería un paso vacío. */}
        {!formulario ? (
          <div style={cardStyle}>
            <h2 style={legendStyle}>¿Para cuándo?</h2>
            <input
              className="qf-field"
              type="date"
              value={reqs.fecha_inicio ?? ''}
              onChange={(e) => setReqs((r) => ({ ...r, fecha_inicio: e.target.value }))}
              aria-label="Fecha de inicio"
              style={fieldStyle}
            />
          </div>
        ) : null}
      </div>

      {/* PASO · FECHA */}
      {formulario ? (
        <div data-paso="fecha" style={visible('fecha')}>
          <RequirementFields
            form={formulario}
            values={reqs}
            onChange={(k, v) => setReqs((r) => ({ ...r, [k]: v }))}
            estilos={{ campo: fieldStyle, etiqueta: labelReqStyle, tarjeta: cardStyle, leyenda: legendStyle }}
            only={CLAVES_FECHA}
            titulo="¿Para cuándo y por cuánto tiempo?"
            intro="La disponibilidad depende de la fecha: un equipo libre hoy puede estar comprometido la semana que entra."
          />
        </div>
      ) : null}

      {/* PASO · REQUERIMIENTO — el resto de las preguntas del servicio. */}
      {formulario ? (
        <div data-paso="requerimiento" style={visible('requerimiento')}>
          <RequirementFields
            form={formulario}
            values={reqs}
            onChange={(k, v) => setReqs((r) => ({ ...r, [k]: v }))}
            estilos={{ campo: fieldStyle, etiqueta: labelReqStyle, tarjeta: cardStyle, leyenda: legendStyle }}
            except={[...CLAVES_UBICACION, ...CLAVES_FECHA]}
          />
        </div>
      ) : null}

      {/* PASO · TUS DATOS. Van al final a propósito: el contacto es el trámite,
          no lo que define la cotización. */}
      <div data-paso="datos" style={visible('datos')}>
        <div style={cardStyle}>
          <h2 style={legendStyle}>Tus datos</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <input className="qf-field" name="name" required minLength={2} defaultValue={user?.name ?? ''} placeholder={labels.name} aria-label={labels.name} style={fieldStyle} />
            <div className="qf-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input className="qf-field" name="email" type="email" required defaultValue={user?.email ?? ''} placeholder={labels.email} aria-label={labels.email} style={fieldStyle} />
              <input className="qf-field" name="phone" required minLength={7} defaultValue={user?.phone ?? ''} placeholder={labels.phone} aria-label={labels.phone} style={fieldStyle} />
            </div>
            <div className="qf-two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input className="qf-field" name="company" placeholder={labels.company} aria-label={labels.company} style={fieldStyle} />
              <input className="qf-field" name="industry" placeholder={labels.industry} aria-label={labels.industry} style={fieldStyle} />
            </div>
            <input className="qf-field" name="region" placeholder={labels.region} aria-label={labels.region} style={fieldStyle} />
            <textarea className="qf-field" name="comments" rows={3} placeholder={labels.comments} aria-label={labels.comments} style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.55 }} />
          </div>
        </div>
      </div>

      {/* PASO · CONFIRMACIÓN. Se enseña lo que se va a enviar antes de enviarlo:
          es la última oportunidad de corregir sin tener que llamar después. */}
      <div data-paso="confirmar" style={visible('confirmar')}>
        <div style={cardStyle}>
          <h2 style={legendStyle}>Revisa antes de enviar</h2>
          <dl style={{ margin: 0, display: 'grid', gap: 10 }}>
            <Resumen etiqueta="Servicio" valor={servicio ?? (product ? product.name : `${picked.length} equipo(s)`)} />
            {formulario
              ? formulario.fields
                  .filter((f) => (reqs[f.key] ?? '').trim())
                  .map((f) => <Resumen key={f.key} etiqueta={f.label} valor={reqs[f.key]} />)
              : null}
          </dl>
          <p style={{ margin: '16px 0 0', fontSize: 12.5, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            Si algo no cuadra, toca cualquier paso de arriba para corregirlo.
          </p>
        </div>

        {error ? (
          <p role="alert" style={{ color: 'var(--color-error)', margin: 0, fontSize: 13, textAlign: 'center' }}>{error}</p>
        ) : null}

        <button type="submit" disabled={loading || (items.length === 0 && !servicio)} style={{ width: '100%', fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, background: 'var(--color-primary)', color: 'var(--color-primary-fg)', border: 'none', padding: 16, borderRadius: 100, cursor: loading ? 'default' : 'pointer', opacity: loading || (items.length === 0 && !servicio) ? 0.5 : 1 }}>
          {loading ? 'Enviando…' : labels.submit}
        </button>
        <p style={{ margin: 0, fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em', color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.6, textTransform: 'uppercase' }}>
          Sin costo ni compromiso · Un asesor te responde con precios y disponibilidad
        </p>
      </div>

      {/* Navegación. "Regresar" siempre disponible, como pide el manual. */}
      {!esUltimo ? (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {paso > 0 ? (
            <button
              type="button"
              onClick={() => setPaso((p) => Math.max(0, p - 1))}
              style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 100, padding: '15px 24px', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <Icon name="arrowLeft" size={15} />Regresar
            </button>
          ) : null}
          <button
            type="button"
            onClick={siguiente}
            style={{ flex: 1, minWidth: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, background: 'var(--color-primary)', color: 'var(--color-primary-fg)', border: 'none', padding: 16, borderRadius: 100, cursor: 'pointer' }}
          >
            Continuar<Icon name="arrowRight" size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPaso((p) => Math.max(0, p - 1))}
          style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--color-text-muted)', border: 'none', padding: 0, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}
        >
          <Icon name="arrowLeft" size={13.5} />Regresar
        </button>
      )}
    </form>
  );
}

/** Fila del resumen final. */
function Resumen({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 14, borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
      <dt style={{ color: 'var(--color-text-muted)' }}>{etiqueta}</dt>
      <dd style={{ margin: 0, color: 'var(--color-text)', textAlign: 'right', fontWeight: 600 }}>{valor}</dd>
    </div>
  );
}
