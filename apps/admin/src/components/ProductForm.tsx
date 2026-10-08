'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { DIAS_SEMANA, HORARIO_DEFAULT, atributosDe, horarioDe, margenDe, precioConMargen, rutaPanelDeCatalogo, tipoDeCatalogo, unidadesDeTarifa, type Horario, type TipoCatalogo } from '@maqserv/config';
import { AdminSelect } from '@/components/AdminSelect';
import { Btn, Chip, IconBtn, Note, PageHeader, Panel, btnClass } from '@/components/ui';

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
  /** De qué aliado es el equipo. Null = equipo propio de MAQSER24. */
  providerId?: number | null;
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
interface Renglon { tipo: string; id: string; nombre: string; linea: string; productos: number[] }
interface Foto { id: number; url: string | null }

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
}: {
  initial: ProductFormData;
  categories: Categoria[];
  providers?: Proveedor[];
  /** Servicio (se cotiza) o producto (precio fijo). Al editar sale de la categoría de la ficha. */
  tipo?: TipoCatalogo;
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

  // ---- Revisión: renglones del cotizador + rechazo ----
  const [renglones, setRenglones] = useState<Renglon[]>([]);
  const [cuentaComo, setCuentaComo] = useState('');
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState('');
  useEffect(() => {
    if (!enRevision) return;
    void fetch('/api/admin/providers/cotizador/renglones')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Renglon[]) => setRenglones(Array.isArray(d) ? d : []))
      .catch(() => undefined);
  }, [enRevision]);
  const renglonesLinea = renglones.filter((r) => !slug || r.linea === slug);

  // ---- Galería (solo al editar: necesita el id) ----
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  useEffect(() => {
    if (!initial.id) return;
    void fetch(`/api/admin/catalog/products/${initial.id}/gallery`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Foto[]) => setFotos(Array.isArray(d) ? d : []))
      .catch(() => undefined);
  }, [initial.id]);

  async function subirFoto(file: File) {
    if (!initial.id) return;
    setSubiendo(true);
    const fd = new FormData();
    fd.set('photo', file);
    const r = await fetch(`/api/admin/catalog/products/${initial.id}/gallery`, { method: 'POST', body: fd });
    const d = await r.json().catch(() => null);
    setSubiendo(false);
    if (!r.ok) { setError(d?.message ?? 'No se pudo subir la foto'); return; }
    setFotos((f) => [...f, d as Foto]);
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
    const [tipo, ...id] = cuentaComo.split(':');
    const r = await fetch(`/api/admin/providers/equipos/${initial.id}/publicar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ renglon: cuentaComo ? { tipo, id: id.join(':') } : null }),
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
          <strong style={{ color: 'var(--adm-text)', fontWeight: 600 }}>Revisa lo que mandó el aliado.</strong> Corrige lo que haga falta (nombre, ficha, fotos), elige a qué
          renglón del cotizador cuenta y publícalo. Si no sirve, recházalo con el motivo: le llega por correo.
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

          <Tarjeta
            titulo={tipoActual === 'servicio' ? 'Disponibilidad' : 'Venta y existencias'}
            icono="ph-tag"
            ayuda={tipoActual === 'servicio'
              ? 'El servicio se cotiza con el tabulador estándar de MAQSER24 (Cotizador → Tarifas y condiciones), no con precios por máquina ni por aliado.'
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
              <div style={{ fontSize: 13.5, color: 'var(--adm-muted)', lineHeight: 1.6 }}>
                Este equipo no lleva precio propio. Las tarifas por día, semana, mes, viaje o tonelada se editan en{' '}
                <a href="/cotizador/tarifas" style={{ color: 'var(--adm-accent)', fontWeight: 600, textDecoration: 'none' }}>Cotizador → Tarifas y condiciones</a>.
              </div>
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
                            <input type="number" min={0} step="1" value={costo[u.clave] ?? ''} onChange={(e) => setCosto({ ...costo, [u.clave]: e.target.value })} placeholder="—" aria-label={`Cobra el aliado por ${u.singular}`} className="adm-input adm-num" style={{ width: 120, height: 34 }} />
                          </td>
                        ) : null}
                        <td>
                          <input type="number" min={0} step="1" value={publico[u.clave] ?? ''} onChange={(e) => setPublico({ ...publico, [u.clave]: e.target.value })} placeholder="—" aria-label={`Precio al cliente por ${u.singular}`} className="adm-input adm-num" style={{ width: 130, height: 34 }} />
                        </td>
                        {proveedor ? (
                          <td className="adm-num" style={{ color: m === null ? 'var(--adm-muted)' : m < 0 ? 'var(--adm-bad)' : m < 10 ? 'var(--adm-warn)' : 'var(--adm-ok)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {m === null ? '—' : `${m} %`}
                          </td>
                        ) : null}
                        <td style={{ textAlign: 'center' }}>
                          <input type="radio" name="_principal" checked={unidad === u.clave} disabled={!tarifasNum[u.clave]} onChange={() => setUnidad(u.clave)} aria-label={`${u.singular} como unidad principal`} style={{ accentColor: 'var(--adm-accent)' }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {proveedor ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <Btn size="sm" onClick={() => proponer(true)} disabled={margenPct === null || Object.keys(costoNum).length === 0}>
                  Proponer con margen{margenPct !== null ? ` de ${margenPct} %` : ''}
                </Btn>
                <span className="adm-help">
                  El cliente ve solo el precio al cliente. El margen se cambia en Cotizador → Tarifas.
                </span>
              </div>
            ) : null}
            </>
            )}
            <div className="pf-2">
              {tipoActual === 'servicio' ? null : (
                <Campo etiqueta="Mínimo" nota={unidad ? `En ${unidadesPrecio.find((u) => u.clave === unidad)?.plural ?? 'unidades'}. 0 = sin mínimo.` : '0 = sin mínimo.'}>
                  <input type="number" min={0} step="1" value={minimo} onChange={(e) => setMinimo(e.target.value)} className="adm-input" />
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
                      <input type="time" value={horario.desde} onChange={(e) => setHorario({ ...horario, desde: e.target.value })} aria-label="Desde" className="adm-input" style={{ width: 110, padding: '0 9px' }} />
                      <span style={{ color: 'var(--adm-muted)', fontSize: 13 }}>a</span>
                      <input type="time" value={horario.hasta} onChange={(e) => setHorario({ ...horario, hasta: e.target.value })} aria-label="Hasta" className="adm-input" style={{ width: 110, padding: '0 9px' }} />
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
                  <input name="rentalFreight" type="number" step="0.01" min={0} defaultValue={initial.rentalFreight ?? ''} className="adm-input" />
                </Campo>
              ) : (
                <Campo etiqueta="Precio anterior" nota="Opcional, se muestra tachado como oferta.">
                  <input name="oldPrice" type="number" step="0.01" min={0} defaultValue={initial.oldPrice ?? ''} className="adm-input" />
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
              {renglonesLinea.length > 0 ? (
                <Campo etiqueta="Cuenta como en el cotizador" nota="Cuando un cliente cotice ese renglón, este aliado aparece como sugerido para asignarle el servicio.">
                  <AdminSelect
                    ariaLabel="Renglón del cotizador"
                    value={cuentaComo}
                    onChange={setCuentaComo}
                    options={[
                      { value: '', label: 'No está en el cotizador' },
                      ...renglonesLinea.map((x) => ({
                        value: `${x.tipo}:${x.id}`,
                        label: `${x.nombre}${x.productos.length ? ` · ya lo tienen ${x.productos.length}` : ''}`,
                      })),
                    ]}
                  />
                </Campo>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--adm-muted)', lineHeight: 1.5 }}>
                  Esta línea no tiene renglones en el cotizador: se publica solo en el catálogo.
                </p>
              )}
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

          <Tarjeta titulo="Fotos" icono="ph-images">
            <div style={{ display: 'grid', gap: 8 }}>
              <span className="adm-label">Principal</span>
              {initial.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={initial.image} alt="" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 8, background: 'var(--adm-raised)', border: '1px solid var(--adm-border)' }} />
              ) : (
                <div style={{ aspectRatio: '4 / 3', borderRadius: 8, border: '1px dashed var(--adm-border-strong)', display: 'grid', placeItems: 'center', color: 'var(--adm-muted)', fontSize: 13 }}>Sin foto</div>
              )}
              <label className={btnClass('secondary')}>
                <i className="ph ph-upload-simple" aria-hidden />
                {initial.image ? 'Cambiar foto principal' : 'Subir foto principal'}
                <input type="file" name="photo" accept="image/png,image/jpeg,image/webp,image/avif" style={{ display: 'none' }} />
              </label>
            </div>
            {initial.id ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <span className="adm-label">Galería <span className="adm-num" style={{ color: 'var(--adm-faint)' }}>({fotos.length}/6)</span></span>
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
                {fotos.length < 6 ? (
                  <label className={btnClass('secondary')} aria-disabled={subiendo}>
                    {subiendo ? null : <i className="ph ph-plus" aria-hidden />}
                    {subiendo ? 'Subiendo…' : 'Agregar a la galería'}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" style={{ display: 'none' }} disabled={subiendo}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void subirFoto(f); e.target.value = ''; }} />
                  </label>
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
                { value: '', label: 'MAQSER24 · equipo propio' },
                ...providers.map((p) => ({ value: String(p.id), label: `${p.name}${p.level ? ` · ${p.level}` : ''}` })),
              ]}
            />
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--adm-muted)', lineHeight: 1.5 }}>
              Con proveedor, el aliado lo ve en su portal y el emparejamiento sabe que tiene esta máquina.
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
