'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { UNIDADES, atributosDe, resumenDetalle, unidadesDe, type DetalleServicio } from '@maqserv/config';
import { mostrarResultado } from '@maqserv/ui';
import { AdminSelect } from '@/components/AdminSelect';
import { Btn, IconBtn, Note, PageHeader, Segmented, Switch } from '@/components/ui';

/**
 * EL FORMULARIO DEL SERVICIO DE UN PROVEEDOR (2026-11-12, el dueño: "cuando sea
 * algo diferente, un servicio diferente, que tenga la opción de poner todo
 * completo, sus costos, todo; ese formulario debe ser más completo").
 *
 * Antes se usaba el del catálogo de MAQSER24, que a un equipo de aliado le
 * decía «no lleva precio propio» y no dejaba poner qué cobra. Este es solo para
 * proveedores y pide, en este orden: qué es (en una línea que ya existe o en
 * una nueva), lo que cobra y en qué condiciones (precio por unidad, IVA,
 * factura, qué incluye y qué no, mínimo, flete, cargos extra, depósito, forma
 * de pago, vigencia), cuántos tiene y con cuánto tiempo pedirlo, su ficha
 * técnica, lo que la obra debe tener y notas internas. Nada se publica.
 */

export interface OpcionesServicio {
  categorias: Array<{ id: number; name: string; slug: string; status: number; tipos: Array<{ id: number; name: string }> }>;
  proveedores: Array<{ id: number; name: string; city: string | null; categories: string[] }>;
}

export interface ServicioGuardado {
  id: number;
  proveedorId: number;
  proveedor: string | null;
  categoryId: number;
  tipoId: number | null;
  name: string;
  brand: string | null;
  description: string;
  stock: number | null;
  location: string | null;
  rental: boolean;
  precio: Record<string, number>;
  precioNota: string | null;
  detalle: DetalleServicio;
  atributos: Record<string, string>;
}

const NUEVA = '__nueva__';
/** Las unidades en que puede cobrar, en el orden en que se piensan. */
const ORDEN_UNIDADES = ['hora', 'jornada', 'dia', 'semana', 'mes', 'viaje', 'visita', 'servicio', 'pieza', 'm2', 'm3', 'tonelada', 'litro', 'bulto'];
const OPCIONES_UNIDAD = ORDEN_UNIDADES.filter((u) => UNIDADES[u]).map((u) => ({ value: u, label: `por ${UNIDADES[u].singular}` }));

type Fila = { unidad: string; monto: string };
type Extra = { concepto: string; costo: string; por: string };
type Dato = { label: string; valor: string };

/** «6,500» o «6500.50» → número; vacío → null. */
const num = (s: string) => {
  const n = Number(s.replace(/[^\d.]/g, ''));
  return s.trim() && Number.isFinite(n) ? n : null;
};
const soloNumero = (s: string) => s.replace(/[^\d.]/g, '');

export function FormServicioProveedor({ opciones, inicial, proveedorInicial, volver }: {
  opciones: OpcionesServicio;
  /** Al corregir: lo que ya tiene. */
  inicial?: ServicioGuardado | null;
  /** Desde su ficha: ya viene elegido. */
  proveedorInicial?: number;
  /** A dónde regresar al guardar o cancelar. */
  volver: string;
}) {
  const router = useRouter();
  const d0 = inicial?.detalle ?? {};

  // ── Qué es ──
  const [proveedorId, setProveedorId] = useState(String(inicial?.proveedorId ?? proveedorInicial ?? ''));
  const [linea, setLinea] = useState(inicial ? String(inicial.categoryId) : '');
  const [lineaNueva, setLineaNueva] = useState('');
  const [tipoId, setTipoId] = useState(inicial?.tipoId ? String(inicial.tipoId) : '');
  const [nombre, setNombre] = useState(inicial?.name ?? '');
  const [marca, setMarca] = useState(inicial?.brand ?? '');
  const [renta, setRenta] = useState<'renta' | 'servicio'>(inicial && !inicial.rental ? 'servicio' : 'renta');
  const [descripcion, setDescripcion] = useState(inicial?.description ?? '');

  // ── Lo que cobra ──
  const [precios, setPrecios] = useState<Fila[]>(() => {
    const xs = Object.entries(inicial?.precio ?? {}).map(([unidad, v]) => ({ unidad, monto: String(v) }));
    return xs.length ? xs : [{ unidad: '', monto: '' }];
  });
  const [conIva, setConIva] = useState<'mas' | 'incluido'>(d0.conIva ? 'incluido' : 'mas');
  const [factura, setFactura] = useState(d0.factura !== false);
  const [incluye, setIncluye] = useState(inicial?.precioNota ?? '');
  const [noIncluye, setNoIncluye] = useState(d0.noIncluye ?? '');
  const [minCant, setMinCant] = useState(d0.minimo ? String(d0.minimo.cantidad) : '');
  const [minUnidad, setMinUnidad] = useState(d0.minimo?.unidad ?? '');
  const [fleteIncluido, setFleteIncluido] = useState(Boolean(d0.flete?.incluido));
  const [fleteEntrega, setFleteEntrega] = useState(d0.flete?.entrega ? String(d0.flete.entrega) : '');
  const [fleteRetiro, setFleteRetiro] = useState(d0.flete?.retiro ? String(d0.flete.retiro) : '');
  const [fleteNota, setFleteNota] = useState(d0.flete?.nota ?? '');
  const [extras, setExtras] = useState<Extra[]>((d0.extras ?? []).map((x) => ({ concepto: x.concepto, costo: String(x.costo), por: x.por ?? '' })));
  const [deposito, setDeposito] = useState(d0.deposito ? String(d0.deposito) : '');
  const [pago, setPago] = useState<'' | 'contado' | 'anticipo' | 'credito'>(d0.pago?.forma ?? '');
  const [anticipoPct, setAnticipoPct] = useState(d0.pago?.anticipoPct ? String(d0.pago.anticipoPct) : '');
  const [creditoDias, setCreditoDias] = useState(d0.pago?.creditoDias ? String(d0.pago.creditoDias) : '');
  const [vigencia, setVigencia] = useState(d0.vigencia ?? '');

  // ── Capacidad y tiempos ──
  const [cuantos, setCuantos] = useState(inicial?.stock ? String(inicial.stock) : '1');
  const [donde, setDonde] = useState(inicial?.location ?? '');
  const [anticipacion, setAnticipacion] = useState(d0.anticipacion ?? '');
  const [horario, setHorario] = useState(d0.horario ?? '');

  // ── Ficha, obra y notas ──
  const [atributos, setAtributos] = useState<Record<string, string>>(inicial?.atributos ?? {});
  const [ficha, setFicha] = useState<Dato[]>(d0.ficha ?? []);
  const [requisitos, setRequisitos] = useState(d0.requisitos ?? '');
  const [notas, setNotas] = useState(d0.notas ?? '');

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const proveedor = opciones.proveedores.find((p) => String(p.id) === proveedorId) ?? null;
  const categoria = opciones.categorias.find((c) => String(c.id) === linea) ?? null;
  const esNueva = linea === NUEVA;
  const preguntas = categoria ? atributosDe(categoria.slug) : [];
  const unidadSugerida = unidadesDe(esNueva ? null : categoria?.slug)[0]?.clave ?? 'dia';

  // Primero las líneas que ya da ese proveedor; luego todas; al final, «algo nuevo».
  const opcionesLinea = useMemo(() => {
    const suyas = new Set(proveedor?.categories ?? []);
    const orden = [...opciones.categorias].sort((a, b) => Number(suyas.has(b.slug)) - Number(suyas.has(a.slug)) || a.name.localeCompare(b.name, 'es'));
    return [
      ...orden.map((c) => ({ value: String(c.id), label: `${c.name}${suyas.has(c.slug) ? ' (ya la da)' : ''}` })),
      { value: NUEVA, label: 'Es algo nuevo, no está en la lista…' },
    ];
  }, [opciones.categorias, proveedor]);

  const detalle: DetalleServicio = {
    noIncluye: noIncluye.trim() || undefined,
    conIva: conIva === 'incluido',
    factura,
    minimo: num(minCant) && (minUnidad || unidadSugerida) ? { cantidad: num(minCant) as number, unidad: minUnidad || unidadSugerida } : null,
    flete: fleteIncluido
      ? { incluido: true, nota: fleteNota.trim() || undefined }
      : num(fleteEntrega) || num(fleteRetiro) || fleteNota.trim()
        ? { incluido: false, entrega: num(fleteEntrega), retiro: num(fleteRetiro), nota: fleteNota.trim() || undefined }
        : null,
    extras: extras.filter((x) => x.concepto.trim() && num(x.costo) != null).map((x) => ({ concepto: x.concepto.trim(), costo: num(x.costo) as number, por: x.por.trim() || undefined })),
    deposito: num(deposito),
    pago: pago ? { forma: pago, anticipoPct: pago === 'anticipo' ? num(anticipoPct) : null, creditoDias: pago === 'credito' ? num(creditoDias) : null } : null,
    vigencia: vigencia || null,
    anticipacion: anticipacion.trim() || undefined,
    horario: horario.trim() || undefined,
    requisitos: requisitos.trim() || undefined,
    ficha: ficha.filter((x) => x.label.trim() && x.valor.trim()).map((x) => ({ label: x.label.trim(), valor: x.valor.trim() })),
    notas: notas.trim() || undefined,
  };
  const resumen = resumenDetalle(detalle);
  const preciosListos = precios.filter((p) => num(p.monto) && (p.unidad || unidadSugerida));

  async function guardar() {
    setError(null);
    if (!proveedorId) { setError('Elige qué proveedor lo da.'); return; }
    if (!linea) { setError('Elige qué tipo de servicio es, o «Es algo nuevo».'); return; }
    if (esNueva && lineaNueva.trim().length < 3) { setError('Escribe cómo se llama ese tipo de servicio nuevo.'); return; }
    if (nombre.trim().length < 2) { setError('Escribe cómo se llama el servicio.'); return; }
    if (pago === 'anticipo' && anticipoPct && !(Number(anticipoPct) <= 100)) { setError('El anticipo va de 0 a 100 %.'); return; }
    const precio = Object.fromEntries(preciosListos.map((p) => [p.unidad || unidadSugerida, num(p.monto) as number]));
    setGuardando(true);
    const cuerpo = {
      name: nombre.trim(),
      categoryId: esNueva ? null : Number(linea),
      categoriaNueva: esNueva ? lineaNueva.trim() : null,
      tipoId: tipoId ? Number(tipoId) : null,
      brand: marca.trim(),
      description: descripcion.trim(),
      stock: num(cuantos) ? Math.round(num(cuantos) as number) : 1,
      location: donde.trim(),
      rental: renta === 'renta',
      precio,
      precioNota: incluye.trim(),
      detalle,
      atributos,
    };
    const r = await fetch(inicial ? `/api/admin/providers/servicios/${inicial.id}` : `/api/admin/providers/${proveedorId}/servicios`, {
      method: inicial ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    }).catch(() => null);
    const res = await r?.json().catch(() => null);
    setGuardando(false);
    if (!r?.ok) { setError(typeof res?.message === 'string' ? res.message : 'No se pudo guardar. Intenta otra vez.'); return; }
    mostrarResultado(
      `«${nombre.trim()}» ${inicial ? 'quedó corregido' : `quedó en los servicios de ${proveedor?.name ?? 'el proveedor'}`}.${res?.categoriaNueva ? ` Se creó el tipo «${res.categoriaNueva}» (solo para proveedores, no sale en el sitio).` : ''}`,
      'ok',
    );
    router.push(volver);
    router.refresh();
  }

  // Lo que falta para poder guardar: se ve en el resumen, no solo al tocar «Guardar».
  const faltan = [
    !proveedorId ? 'el proveedor' : null,
    !linea ? 'el tipo de servicio' : esNueva && lineaNueva.trim().length < 3 ? 'el nombre del tipo nuevo' : null,
    nombre.trim().length < 2 ? 'el nombre del servicio' : null,
  ].filter((x): x is string => !!x);
  const tipoTexto = esNueva ? (lineaNueva.trim() ? `${lineaNueva.trim()} (nuevo)` : 'Tipo nuevo') : categoria?.name ?? null;
  const condiciones = resumen.filter((t) => !/IVA|factura/i.test(t));
  const marcaCampo = (
    <Campo label="Marca y modelo">
      <input className="adm-input" value={marca} maxLength={190} placeholder="Opcional" onChange={(e) => setMarca(e.target.value)} />
    </Campo>
  );

  return (
    <div className="fs">
      <style>{CSS}</style>
      <PageHeader
        eyebrow={[['Servicios de proveedores', '/servicios-proveedores'], inicial ? 'Corregir' : 'Nuevo']}
        title={inicial ? inicial.name : 'Nuevo servicio de un proveedor'}
        subtitle="Lo que te cobra el proveedor y en qué condiciones, para cotizarlo sin volver a llamarle. El cliente nunca ve esto."
      />

      <div className="fs-layout">
        <div className="fs-main">
          {/* 1 · Qué es */}
          <Seccion n={1} titulo="¿Qué servicio es?">
            {inicial || proveedorInicial ? null : (
              <div className="fs-row c1">
                <Campo label="Proveedor *">
                  <AdminSelect ariaLabel="Proveedor" placeholder="Elige el proveedor…" value={proveedorId} onChange={setProveedorId}
                    options={opciones.proveedores.map((p) => ({ value: String(p.id), label: `${p.name}${p.city ? ` · ${p.city}` : ''}` }))} />
                </Campo>
              </div>
            )}
            <div className="fs-row c1">
              <Campo label="Nombre del servicio *">
                <input className="adm-input" value={nombre} maxLength={200} placeholder="Ej. Sanitario portátil con lavamanos" onChange={(e) => setNombre(e.target.value)} />
              </Campo>
            </div>
            <div className="fs-row c2">
              <Campo label="Tipo de servicio *">
                <AdminSelect ariaLabel="Tipo de servicio" placeholder="Elige…" value={linea} options={opcionesLinea}
                  onChange={(v) => { setLinea(v); setTipoId(''); }} />
              </Campo>
              {esNueva ? (
                <Campo label="Nombre del tipo nuevo *">
                  <input className="adm-input" value={lineaNueva} maxLength={100} placeholder="Ej. Bombeo de concreto" onChange={(e) => setLineaNueva(e.target.value)} />
                </Campo>
              ) : categoria?.tipos.length ? (
                <Campo label="Equivale a (opcional)">
                  <AdminSelect ariaLabel="Equivale a" value={tipoId} onChange={setTipoId}
                    options={[{ value: '', label: 'Ninguna ficha de MAQSER24' }, ...categoria.tipos.map((t) => ({ value: String(t.id), label: t.name }))]} />
                </Campo>
              ) : marcaCampo}
            </div>
            {esNueva ? <p className="fs-nota"><i className="ph ph-info" aria-hidden />El tipo nuevo es solo para proveedores: no sale en el sitio.</p> : null}
            <div className="fs-row c2">
              <Campo label="¿Cómo es?">
                <Segmented ariaLabel="¿Renta o servicio?" value={renta} onChange={setRenta}
                  items={[{ key: 'renta', label: 'Renta (se regresa)' }, { key: 'servicio', label: 'Servicio o venta' }]} />
              </Campo>
              {esNueva || categoria?.tipos.length ? marcaCampo : null}
            </div>
            <div className="fs-row c1">
              <Campo label="Descripción">
                <textarea className="adm-input fs-area" rows={3} value={descripcion} maxLength={5000} placeholder="Qué es y cómo lo hace, como se lo dirías a un cliente." onChange={(e) => setDescripcion(e.target.value)} />
              </Campo>
            </div>
          </Seccion>

          {/* 2 · Precio */}
          <Seccion n={2} titulo="Lo que cobra" desc="Lo que te cobra a ti. Con esto armas tu precio con tu margen.">
            <div className="fs-tabla" role="group" aria-label="Precios">
              <div className="fs-tabla-cab" aria-hidden><span>Precio</span><span>Unidad</span><span /></div>
              {precios.map((p, i) => (
                <div key={i} className="fs-tabla-fila">
                  <span className="fs-pesos"><span aria-hidden>$</span>
                    <input className="adm-input adm-num" inputMode="decimal" value={p.monto} placeholder="0" aria-label={`Precio ${i + 1}`}
                      onChange={(e) => setPrecios((xs) => xs.map((x, j) => (j === i ? { ...x, monto: soloNumero(e.target.value) } : x)))} />
                  </span>
                  <AdminSelect ariaLabel={`Unidad del precio ${i + 1}`} value={p.unidad || unidadSugerida} options={OPCIONES_UNIDAD}
                    onChange={(v) => setPrecios((xs) => xs.map((x, j) => (j === i ? { ...x, unidad: v } : x)))} />
                  {precios.length > 1 ? <IconBtn icon="ph-x" label="Quitar este precio" onClick={() => setPrecios((xs) => xs.filter((_, j) => j !== i))} /> : <span />}
                </div>
              ))}
              <div className="fs-tabla-pie">
                <Btn size="sm" variant="ghost" icon="ph-plus" onClick={() => setPrecios((xs) => [...xs, { unidad: '', monto: '' }])}>Agregar otro precio</Btn>
                <span className="fs-help">¿Se cotiza por obra? Déjalo en blanco y dilo en «Qué incluye».</span>
              </div>
            </div>
            <div className="fs-row c2">
              <Campo label="IVA">
                <Segmented ariaLabel="IVA" value={conIva} onChange={setConIva} items={[{ key: 'mas', label: 'Más IVA' }, { key: 'incluido', label: 'IVA incluido' }]} />
              </Campo>
              <Campo label="Factura">
                <div className="fs-switch"><Switch on={factura} onClick={() => setFactura((v) => !v)} label={factura ? 'Sí da factura' : 'No da factura'} /></div>
              </Campo>
            </div>
            <div className="fs-row c1">
              <Campo label="¿Qué incluye el precio?">
                <input className="adm-input" value={incluye} maxLength={300} placeholder="Ej. Entrega, recolección y limpieza una vez por semana" onChange={(e) => setIncluye(e.target.value)} />
              </Campo>
            </div>
            <div className="fs-row c1">
              <Campo label="¿Qué no incluye?">
                <input className="adm-input" value={noIncluye} maxLength={500} placeholder="Ej. Limpiezas extra, daños, maniobras con grúa" onChange={(e) => setNoIncluye(e.target.value)} />
              </Campo>
            </div>
          </Seccion>

          {/* 3 · Condiciones */}
          <Seccion n={3} titulo="Condiciones" desc="Mínimo, flete, cargos extra y cómo hay que pagarle.">
            <div className="fs-row c2">
              <Campo label="Mínimo">
                <div className="fs-par">
                  <input className="adm-input adm-num" inputMode="decimal" value={minCant} placeholder="Sin mínimo" aria-label="Cantidad mínima" onChange={(e) => setMinCant(soloNumero(e.target.value))} />
                  <AdminSelect ariaLabel="Unidad del mínimo" value={minUnidad || unidadSugerida} options={OPCIONES_UNIDAD} onChange={setMinUnidad} />
                </div>
              </Campo>
              <Campo label="Depósito o garantía">
                <span className="fs-pesos"><span aria-hidden>$</span>
                  <input className="adm-input adm-num" inputMode="decimal" value={deposito} placeholder="Sin depósito" onChange={(e) => setDeposito(soloNumero(e.target.value))} />
                </span>
              </Campo>
            </div>

            <div className="fs-grupo">
              <div className="fs-grupo-cab">
                <span className="fs-grupo-t"><i className="ph ph-truck" aria-hidden />Flete</span>
                <Switch on={fleteIncluido} onClick={() => setFleteIncluido((v) => !v)} label={fleteIncluido ? 'Va incluido en el precio' : 'Se cobra aparte'} />
              </div>
              {!fleteIncluido ? (
                <div className="fs-row c2">
                  <Campo label="Entrega">
                    <span className="fs-pesos"><span aria-hidden>$</span>
                      <input className="adm-input adm-num" inputMode="decimal" value={fleteEntrega} placeholder="0" onChange={(e) => setFleteEntrega(soloNumero(e.target.value))} />
                    </span>
                  </Campo>
                  <Campo label="Retiro">
                    <span className="fs-pesos"><span aria-hidden>$</span>
                      <input className="adm-input adm-num" inputMode="decimal" value={fleteRetiro} placeholder="0" onChange={(e) => setFleteRetiro(soloNumero(e.target.value))} />
                    </span>
                  </Campo>
                </div>
              ) : null}
              <div className="fs-row c1">
                <Campo label="Nota del flete">
                  <input className="adm-input" value={fleteNota} maxLength={200} placeholder="Ej. Dentro del área metropolitana; fuera, $25 por km" onChange={(e) => setFleteNota(e.target.value)} />
                </Campo>
              </div>
            </div>

            <div className="fs-grupo">
              <div className="fs-grupo-cab">
                <span className="fs-grupo-t"><i className="ph ph-plus-circle" aria-hidden />Cargos extra</span>
                <Btn size="sm" variant="ghost" icon="ph-plus" onClick={() => setExtras((xs) => [...xs, { concepto: '', costo: '', por: '' }])}>Agregar cargo</Btn>
              </div>
              {extras.length === 0 ? <p className="fs-vacio">Sin cargos extra.</p> : (
                <div className="fs-tabla">
                  <div className="fs-tabla-cab fs-cols-extra" aria-hidden><span>Concepto</span><span>Costo</span><span>Por</span><span /></div>
                  {extras.map((x, i) => (
                    <div key={i} className="fs-tabla-fila fs-cols-extra">
                      <input className="adm-input" value={x.concepto} maxLength={120} placeholder="Ej. Limpieza adicional" aria-label={`Cargo extra ${i + 1}`}
                        onChange={(e) => setExtras((xs) => xs.map((y, j) => (j === i ? { ...y, concepto: e.target.value } : y)))} />
                      <span className="fs-pesos"><span aria-hidden>$</span>
                        <input className="adm-input adm-num" inputMode="decimal" value={x.costo} placeholder="0" aria-label={`Costo del cargo ${i + 1}`}
                          onChange={(e) => setExtras((xs) => xs.map((y, j) => (j === i ? { ...y, costo: soloNumero(e.target.value) } : y)))} />
                      </span>
                      <input className="adm-input" value={x.por} maxLength={60} placeholder="Ej. por servicio" aria-label={`Por qué se cobra el cargo ${i + 1}`}
                        onChange={(e) => setExtras((xs) => xs.map((y, j) => (j === i ? { ...y, por: e.target.value } : y)))} />
                      <IconBtn icon="ph-x" label="Quitar este cargo" onClick={() => setExtras((xs) => xs.filter((_, j) => j !== i))} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="fs-grupo">
              <div className="fs-grupo-cab"><span className="fs-grupo-t"><i className="ph ph-wallet" aria-hidden />Pago</span></div>
              <div className="fs-row c1">
                <Campo label="Forma de pago">
                  <Segmented ariaLabel="Forma de pago" value={pago || 'sin'} onChange={(k) => setPago(k === 'sin' ? '' : k)}
                    items={[{ key: 'sin', label: 'Sin definir' }, { key: 'contado', label: 'Contado' }, { key: 'anticipo', label: 'Anticipo' }, { key: 'credito', label: 'Crédito' }]} />
                </Campo>
              </div>
              <div className="fs-row c2">
                {pago === 'anticipo' ? (
                  <Campo label="Anticipo (%)">
                    <input className="adm-input adm-num" inputMode="numeric" value={anticipoPct} placeholder="Ej. 50" onChange={(e) => setAnticipoPct(soloNumero(e.target.value))} />
                  </Campo>
                ) : pago === 'credito' ? (
                  <Campo label="Días de crédito">
                    <input className="adm-input adm-num" inputMode="numeric" value={creditoDias} placeholder="Ej. 15" onChange={(e) => setCreditoDias(e.target.value.replace(/\D/g, ''))} />
                  </Campo>
                ) : null}
                <Campo label="Respeta el precio hasta">
                  <input className="adm-input" type="date" value={vigencia} onChange={(e) => setVigencia(e.target.value)} />
                </Campo>
              </div>
            </div>
          </Seccion>

          {/* 4 · Cuántos y cuándo */}
          <Seccion n={4} titulo="Cuántos tiene y cuándo">
            <div className="fs-row c2">
              <Campo label="Cuántos tiene">
                <input className="adm-input adm-num" inputMode="numeric" value={cuantos} placeholder="Unidades o cuadrillas" onChange={(e) => setCuantos(e.target.value.replace(/\D/g, ''))} />
              </Campo>
              <Campo label="Dónde está">
                <input className="adm-input" value={donde} maxLength={160} placeholder={proveedor?.city ? `Ej. ${proveedor.city}` : 'Patio o ciudad'} onChange={(e) => setDonde(e.target.value)} />
              </Campo>
            </div>
            <div className="fs-row c2">
              <Campo label="Con cuánto tiempo pedirlo">
                <input className="adm-input" value={anticipacion} maxLength={80} placeholder="Ej. 24 horas" onChange={(e) => setAnticipacion(e.target.value)} />
              </Campo>
              <Campo label="Horario">
                <input className="adm-input" value={horario} maxLength={120} placeholder="Ej. Lunes a sábado, 7 a 18 h" onChange={(e) => setHorario(e.target.value)} />
              </Campo>
            </div>
          </Seccion>

          {/* 5 · Ficha técnica, obra y notas */}
          <Seccion n={5} titulo="Ficha técnica y notas">
            {preguntas.length ? (
              <div className="fs-row c2">
                {preguntas.map((a) => (
                  <Campo key={a.clave} label={`${a.label}${a.unidad ? ` (${a.unidad})` : ''}`}>
                    {a.tipo === 'opcion' && a.opciones?.length ? (
                      <AdminSelect ariaLabel={a.label} value={atributos[a.clave] ?? ''} onChange={(v) => setAtributos((x) => ({ ...x, [a.clave]: v }))}
                        options={[{ value: '', label: '—' }, ...a.opciones.map((o) => ({ value: o, label: o }))]} />
                    ) : (
                      <input className={`adm-input${a.tipo === 'numero' ? ' adm-num' : ''}`} inputMode={a.tipo === 'numero' ? 'decimal' : undefined} value={atributos[a.clave] ?? ''} maxLength={160}
                        placeholder={a.hint ?? ''} onChange={(e) => setAtributos((x) => ({ ...x, [a.clave]: e.target.value }))} />
                    )}
                  </Campo>
                ))}
              </div>
            ) : null}
            <div className="fs-grupo fs-grupo-primero">
              <div className="fs-grupo-cab">
                <span className="fs-grupo-t"><i className="ph ph-list-bullets" aria-hidden />Datos técnicos</span>
                <Btn size="sm" variant="ghost" icon="ph-plus" onClick={() => setFicha((xs) => [...xs, { label: '', valor: '' }])}>Agregar dato</Btn>
              </div>
              {ficha.length === 0 ? <p className="fs-vacio">Medidas, capacidad, modelo… lo que ayude a saber si sirve para la obra.</p> : (
                <div className="fs-tabla">
                  {ficha.map((x, i) => (
                    <div key={i} className="fs-tabla-fila fs-cols-dato">
                      <input className="adm-input" value={x.label} maxLength={60} placeholder="Dato (ej. Medidas)" aria-label={`Dato ${i + 1}`}
                        onChange={(e) => setFicha((xs) => xs.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} />
                      <input className="adm-input" value={x.valor} maxLength={160} placeholder="Valor (ej. 6 x 2.4 m)" aria-label={`Valor del dato ${i + 1}`}
                        onChange={(e) => setFicha((xs) => xs.map((y, j) => (j === i ? { ...y, valor: e.target.value } : y)))} />
                      <IconBtn icon="ph-x" label="Quitar este dato" onClick={() => setFicha((xs) => xs.filter((_, j) => j !== i))} />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="fs-grupo">
              <div className="fs-row c1">
                <Campo label="Lo que la obra debe tener">
                  <textarea className="adm-input fs-area" rows={2} value={requisitos} maxLength={600} placeholder="Acceso, piso firme, toma de agua o luz, permisos…" onChange={(e) => setRequisitos(e.target.value)} />
                </Campo>
              </div>
              <div className="fs-row c1">
                <Campo label="Notas internas" help="Solo las ve MAQSER24.">
                  <textarea className="adm-input fs-area" rows={3} value={notas} maxLength={1000} placeholder="Cómo trabaja, con quién hablar, lo que pasó la última vez…" onChange={(e) => setNotas(e.target.value)} />
                </Campo>
              </div>
            </div>
          </Seccion>
        </div>

        {/* El resumen, fijo a un lado: cómo va a quedar y el botón de guardar siempre a la vista. */}
        <aside className="fs-aside" aria-label="Resumen del servicio">
          <div className="adm-panel fs-resumen">
            <div className="fs-res-eyebrow">Así queda en la lista</div>
            <div className="fs-res-nombre">{nombre.trim() || 'Nombre del servicio'}</div>
            <div className="fs-res-sub">
              {[proveedor?.name ?? inicial?.proveedor ?? null, tipoTexto].filter(Boolean).join(' · ') || 'Proveedor y tipo'}
            </div>
            <div className="fs-res-precios">
              {preciosListos.length ? preciosListos.map((p, i) => (
                <div key={i} className="fs-res-precio">
                  <b>${(num(p.monto) as number).toLocaleString('es-MX')}</b>
                  <span>/ {UNIDADES[p.unidad || unidadSugerida]?.singular}</span>
                </div>
              )) : <div className="fs-res-sinprecio">Sin precio</div>}
              <div className="fs-res-iva">{conIva === 'incluido' ? 'IVA incluido' : 'Más IVA'}{factura ? ' · con factura' : ' · sin factura'}</div>
            </div>
            {incluye.trim() ? <p className="fs-res-incluye">{incluye.trim()}</p> : null}
            {condiciones.length ? (
              <ul className="fs-res-lista">
                {condiciones.map((t) => <li key={t}>{t}</li>)}
              </ul>
            ) : null}
            {faltan.length ? (
              <p className="fs-res-falta"><i className="ph ph-warning-circle" aria-hidden />Falta {faltan.join(', ')}.</p>
            ) : null}
            {error ? <div role="alert" style={{ marginTop: 12 }}><Note tone="bad">{error}</Note></div> : null}
            <div className="fs-res-acc">
              <Btn variant="primary" icon="ph-check" onClick={() => void guardar()} disabled={guardando}>
                {guardando ? 'Guardando…' : inicial ? 'Guardar cambios' : 'Guardar servicio'}
              </Btn>
              <Btn variant="ghost" href={volver}>Cancelar</Btn>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Seccion({ n, titulo, desc, children }: { n: number; titulo: string; desc?: string; children: ReactNode }) {
  return (
    <section className="adm-panel fs-sec" aria-label={titulo}>
      <header className="fs-sec-cab">
        <span className="fs-sec-n" aria-hidden>{n}</span>
        <div>
          <h2 className="fs-sec-t">{titulo}</h2>
          {desc ? <p className="fs-sec-d">{desc}</p> : null}
        </div>
      </header>
      <div className="fs-sec-cuerpo">{children}</div>
    </section>
  );
}

function Campo({ label, help, children }: { label: ReactNode; help?: ReactNode; children: ReactNode }) {
  return (
    <div className="fs-campo">
      <span className="adm-label">{label}</span>
      {children}
      {help ? <span className="adm-help">{help}</span> : null}
    </div>
  );
}

const CSS = `
.fs { max-width: 1180px; margin: 0 auto; padding-bottom: 48px; }
.fs-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 24px; align-items: start; }
.fs-main { display: grid; gap: 16px; min-width: 0; }
.fs .adm-panel + .adm-panel { margin-top: 0; }

/* Secciones numeradas */
.fs-sec-cab { display: flex; gap: 14px; align-items: flex-start; padding: 16px 22px; border-bottom: 1px solid var(--adm-border); }
.fs-sec-n { flex: none; width: 26px; height: 26px; border-radius: 999px; display: grid; place-items: center; font-size: 13px; font-weight: 700;
  color: var(--adm-accent); background: color-mix(in srgb, var(--adm-accent) 14%, transparent); }
.fs-sec-t { margin: 2px 0 0; font-size: 15.5px; font-weight: 650; color: var(--adm-text); letter-spacing: -0.005em; }
.fs-sec-d { margin: 3px 0 0; font-size: 13px; color: var(--adm-muted); }
.fs-sec-cuerpo { padding: 18px 22px 22px; display: grid; gap: 16px; }

/* Filas con columnas fijas: nada se acomoda solo ni deja huecos */
.fs-row { display: grid; gap: 16px; align-items: start; }
.fs-row.c1 { grid-template-columns: minmax(0, 1fr); }
.fs-row.c2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.fs-campo { display: grid; gap: 7px; min-width: 0; }
/* Un nombre largo en un desplegable se corta con «…» en vez de salirse de su caja. */
.fs-campo [role="combobox"], .fs-tabla [role="combobox"], .fs-par [role="combobox"] { width: 100%; min-width: 0; max-width: 100%; }
.fs-campo [role="combobox"] > span, .fs-tabla [role="combobox"] > span, .fs-par [role="combobox"] > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fs-area { height: auto; padding: 10px 12px; line-height: 1.5; resize: vertical; font-family: inherit; }
.fs-switch { min-height: 38px; display: flex; align-items: center; }
.fs-nota { margin: -6px 0 0; font-size: 12.5px; color: var(--adm-muted); display: flex; gap: 6px; align-items: center; }
.fs-help { font-size: 12.5px; color: var(--adm-muted); }
.fs-vacio { margin: 0; font-size: 13px; color: var(--adm-faint); }
.fs-par { display: grid; grid-template-columns: minmax(0, 110px) minmax(0, 1fr); gap: 8px; }
.fs-pesos { position: relative; display: block; }
.fs-pesos > span { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--adm-muted); pointer-events: none; }
.fs-pesos > input { padding-left: 26px; width: 100%; }

/* Tablas pequeñas: precios, cargos extra, datos técnicos */
.fs-tabla { display: grid; gap: 8px; }
.fs-tabla-cab, .fs-tabla-fila { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 36px; gap: 10px; align-items: center; }
.fs-tabla-cab span { font-size: 12px; font-weight: 600; color: var(--adm-muted); }
.fs-tabla-pie { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; }
.fs-cols-extra { grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr) 36px; }
.fs-cols-dato { grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr) 36px; }

/* Grupos dentro de una sección (flete, cargos, pago, ficha) */
.fs-grupo { display: grid; gap: 14px; padding-top: 16px; border-top: 1px solid var(--adm-border); }
.fs-grupo-primero:first-child { padding-top: 0; border-top: 0; }
.fs-grupo-cab { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; }
.fs-grupo-t { display: inline-flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 650; color: var(--adm-text); }
.fs-grupo-t i { font-size: 16px; color: var(--adm-muted); }

/* Resumen fijo */
.fs-aside { position: sticky; top: 16px; }
.fs-resumen { padding: 18px 18px 16px; }
.fs-res-eyebrow { font-size: 11.5px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; color: var(--adm-faint); }
.fs-res-nombre { margin-top: 8px; font-size: 16px; font-weight: 650; color: var(--adm-text); line-height: 1.3; }
.fs-res-sub { margin-top: 3px; font-size: 12.5px; color: var(--adm-muted); }
.fs-res-precios { margin-top: 14px; padding: 12px 14px; border-radius: 10px; background: color-mix(in srgb, var(--adm-text) 4%, transparent); display: grid; gap: 4px; }
.fs-res-precio { display: flex; align-items: baseline; gap: 6px; }
.fs-res-precio b { font-size: 20px; font-weight: 700; color: var(--adm-text); font-variant-numeric: tabular-nums; }
.fs-res-precio span { font-size: 13px; color: var(--adm-muted); }
.fs-res-sinprecio { font-size: 14px; color: var(--adm-faint); }
.fs-res-iva { font-size: 12px; color: var(--adm-muted); margin-top: 2px; }
.fs-res-incluye { margin: 12px 0 0; font-size: 13px; color: var(--adm-text-2); line-height: 1.45; }
.fs-res-lista { margin: 10px 0 0; padding: 0; list-style: none; display: grid; gap: 5px; }
.fs-res-lista li { position: relative; padding-left: 14px; font-size: 12.5px; color: var(--adm-text-2); line-height: 1.4; }
.fs-res-lista li::before { content: ''; position: absolute; left: 2px; top: 7px; width: 5px; height: 5px; border-radius: 99px; background: var(--adm-accent); }
.fs-res-falta { margin: 12px 0 0; font-size: 12.5px; color: var(--adm-warn); display: flex; gap: 6px; align-items: flex-start; line-height: 1.4; }
.fs-res-acc { margin-top: 16px; display: grid; gap: 8px; }
.fs-res-acc > * { width: 100%; justify-content: center; }

@media (max-width: 1100px) {
  .fs-layout { grid-template-columns: minmax(0, 1fr); }
  .fs-aside { position: static; }
}
@media (max-width: 640px) {
  .fs-sec-cab { padding: 14px 16px; }
  .fs-sec-cuerpo { padding: 16px; }
  .fs-row.c2 { grid-template-columns: minmax(0, 1fr); }
  .fs-cols-extra { grid-template-columns: minmax(0, 1fr) 36px; }
  .fs-cols-extra > :nth-child(2), .fs-cols-extra > :nth-child(3) { grid-column: 1; }
  .fs-cols-extra.fs-tabla-cab { display: none; }
  .fs-cols-dato { grid-template-columns: minmax(0, 1fr) 36px; }
  .fs-cols-dato > :nth-child(2) { grid-column: 1; }
}
`;
