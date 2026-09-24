'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { DIAS_SEMANA, HORARIO_DEFAULT, atributosDe, horarioDe, margenDe, precioConMargen, unidadesDeTarifa, type Horario } from '@maqserv/config';
import { AdminSelect } from '@/components/AdminSelect';
import { D } from '@/components/design-tokens';

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
}: {
  initial: ProductFormData;
  categories: Categoria[];
  providers?: Proveedor[];
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const isEdit = Boolean(initial.id);
  const enRevision = isEdit && initial.status === POR_REVISAR;
  const proveedor = providers.find((p) => p.id === initial.providerId);

  const [categoryId, setCategoryId] = useState(initial.categoryId ? String(initial.categoryId) : '');
  const [isRental, setIsRental] = useState(initial.isRental ?? true);
  const [attrs, setAttrs] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(initial.attributes ?? {}).map(([k, v]) => [k, v == null ? '' : String(v)])),
  );
  const [specs, setSpecs] = useState<Array<{ label: string; value: string }>>(initial.specs ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'guardar' | 'publicar' | 'rechazar'>(null);

  const slug = categories.find((c) => String(c.id) === categoryId)?.slug ?? null;
  const campos = useMemo(() => atributosDe(slug), [slug]);
  // Solo líneas activas; la actual se conserva aunque esté apagada, para no perderla al guardar.
  const lineas = categories.filter((c) => c.status === undefined || c.status === 1 || String(c.id) === String(initial.categoryId ?? ''));

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
    router.push(enRevision ? '/proveedores' : '/productos');
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

  const titulo = isEdit ? initial.name ?? 'Equipo' : 'Nuevo equipo';
  const volver = enRevision ? { href: '/proveedores', texto: 'Proveedores' } : { href: '/productos', texto: 'Productos' };

  return (
    <form ref={form} onSubmit={(e) => { e.preventDefault(); void onGuardar(); }} encType="multipart/form-data" className="pf">
      <style>{CSS}</style>

      {/* ── Encabezado ── */}
      <header style={{ marginBottom: 18 }}>
        <Link href={volver.href} style={{ fontSize: 12.5, color: D.muted2, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i className="ph ph-arrow-left" /> {volver.texto}
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
          <h1 style={{ margin: 0, fontSize: 26, letterSpacing: '-0.02em', color: D.text }}>{titulo}</h1>
          {enRevision ? <Chip color={D.warn}>Por revisar</Chip> : isEdit && initial.status === 0 ? <Chip color={D.muted2}>Inactivo</Chip> : isEdit ? <Chip color={D.ok}>Publicado</Chip> : null}
        </div>
        {proveedor ? (
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: D.muted2 }}>
            Equipo de <strong style={{ color: D.text }}>{proveedor.name}</strong>
            {enRevision ? ' · lo ofreció desde su portal' : ''}
          </p>
        ) : null}
      </header>

      {enRevision ? (
        <div style={{ background: `color-mix(in srgb, ${D.warn} 9%, transparent)`, border: `1px solid color-mix(in srgb, ${D.warn} 40%, transparent)`, borderRadius: 14, padding: '14px 16px', marginBottom: 18, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <i className="ph ph-clipboard-text" style={{ fontSize: 22, color: D.warn, marginTop: 1 }} />
          <div style={{ fontSize: 13.5, lineHeight: 1.55, color: D.text }}>
            <strong>Revisa lo que mandó el aliado.</strong> Corrige lo que haga falta (nombre, ficha, fotos), elige a qué
            renglón del cotizador cuenta y publícalo. Si no sirve, recházalo con el motivo: le llega por correo.
          </div>
        </div>
      ) : null}

      <div className="pf-cols">
        {/* ════════ Columna principal ════════ */}
        <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
          <Tarjeta titulo="Qué es" icono="ph-package">
            <Campo etiqueta="Nombre" nota='Como lo buscaría un cliente: tipo y tamaño. Ej. "Excavadora 20 t".'>
              <input name="name" required minLength={2} defaultValue={initial.name ?? ''} style={input} />
            </Campo>
            <div className="pf-2">
              <Campo etiqueta="Línea de servicio">
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
                <input name="brand" defaultValue={initial.brand ?? ''} placeholder="CAT 320, John Deere 310L…" style={input} />
              </Campo>
            </div>
            <Campo etiqueta="¿Se renta o se vende?" grupo>
              <div className="pf-2">
                <Opcion activo={isRental} onClick={() => setIsRental(true)}>Se renta</Opcion>
                <Opcion activo={!isRental} onClick={() => setIsRental(false)}>Se vende</Opcion>
              </div>
            </Campo>
            <Campo etiqueta="Resumen" nota="Una línea que sale arriba de la ficha en el sitio.">
              <input name="short" defaultValue={initial.short ?? ''} placeholder="Excavadora de 20 t con cucharón, lista para obra." style={input} />
            </Campo>
            <Campo etiqueta="Descripción">
              <textarea name="description" required minLength={4} rows={5} defaultValue={initial.description ?? ''} style={{ ...input, resize: 'vertical', lineHeight: 1.55 }} />
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
                          style={{ ...input, paddingRight: c.unidad ? 48 : undefined }}
                        />
                        {c.unidad ? <span style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: D.muted2 }}>{c.unidad}</span> : null}
                      </div>
                    )}
                  </Campo>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 13.5, color: D.muted2 }}>
                {slug ? 'Esta línea no tiene preguntas fijas: usa los datos extra.' : 'Elige la línea de servicio para ver sus preguntas.'}
              </p>
            )}
            <div style={{ borderTop: `1px solid ${D.cardBorder}`, paddingTop: 14, display: 'grid', gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: D.muted2 }}>Datos extra (opcional)</span>
              {specs.map((s, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) auto', gap: 8, alignItems: 'center' }}>
                  <input value={s.label} onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Peso operativo" style={input} />
                  <input value={s.value} onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} placeholder="20,500 kg" style={input} />
                  <button type="button" aria-label="Quitar dato" onClick={() => setSpecs(specs.filter((_, j) => j !== i))} style={botonIcono}>×</button>
                </div>
              ))}
              <div><button type="button" onClick={() => setSpecs([...specs, { label: '', value: '' }])} style={botonSec}>+ Agregar dato</button></div>
            </div>
          </Tarjeta>

          <Tarjeta
            titulo={isRental ? 'Renta y disponibilidad' : 'Venta y disponibilidad'}
            icono="ph-tag"
            ayuda={isRental
              ? 'Con estos precios cotiza el sitio: el cliente elige esta máquina y ve el importe al momento. Sin precio, el sitio dice “precio bajo cotización”.'
              : 'Con estos precios cotiza el sitio. Sin precio, el sitio dice “precio bajo cotización”.'}
          >
            <input type="hidden" name="priceUnit" value={unidad} />
            <input type="hidden" name="price" value={tarifasNum[unidad] ?? 0} />
            <input type="hidden" name="tarifas" value={JSON.stringify(tarifasNum)} />
            <input type="hidden" name="costoAliado" value={JSON.stringify(costoNum)} />
            <input type="hidden" name="minimo" value={Math.max(0, Number(minimo) || 0)} />
            <input type="hidden" name="horario" value={horario ? JSON.stringify(horario) : ''} />
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ color: D.muted2, fontSize: 12, textAlign: 'left' }}>
                    <th style={{ padding: '4px 6px 8px 0', fontWeight: 700 }}>Por</th>
                    {proveedor ? <th style={{ padding: '4px 6px 8px', fontWeight: 700 }}>Cobra el aliado</th> : null}
                    <th style={{ padding: '4px 6px 8px', fontWeight: 700 }}>Precio al cliente</th>
                    {proveedor ? <th style={{ padding: '4px 0 8px 6px', fontWeight: 700 }}>Margen</th> : null}
                    <th style={{ padding: '4px 0 8px 6px', fontWeight: 700, whiteSpace: 'nowrap' }}>Principal</th>
                  </tr>
                </thead>
                <tbody>
                  {unidadesPrecio.map((u) => {
                    const m = margenDe(tarifasNum[u.clave], costoNum[u.clave]);
                    return (
                      <tr key={u.clave} style={{ borderTop: `1px solid ${D.cardBorder}` }}>
                        <td style={{ padding: '8px 6px 8px 0', color: D.text, whiteSpace: 'nowrap' }}>{u.singular}</td>
                        {proveedor ? (
                          <td style={{ padding: '6px' }}>
                            <input type="number" min={0} step="1" value={costo[u.clave] ?? ''} onChange={(e) => setCosto({ ...costo, [u.clave]: e.target.value })} placeholder="—" style={{ ...input, padding: '8px 10px', width: 120 }} />
                          </td>
                        ) : null}
                        <td style={{ padding: '6px' }}>
                          <input type="number" min={0} step="1" value={publico[u.clave] ?? ''} onChange={(e) => setPublico({ ...publico, [u.clave]: e.target.value })} placeholder="—" style={{ ...input, padding: '8px 10px', width: 130 }} />
                        </td>
                        {proveedor ? (
                          <td style={{ padding: '6px 0 6px 6px', color: m === null ? D.muted2 : m < 0 ? D.bad : m < 10 ? D.warn : D.ok, fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {m === null ? '—' : `${m} %`}
                          </td>
                        ) : null}
                        <td style={{ padding: '6px 0 6px 6px', textAlign: 'center' }}>
                          <input type="radio" name="_principal" checked={unidad === u.clave} disabled={!tarifasNum[u.clave]} onChange={() => setUnidad(u.clave)} style={{ accentColor: 'var(--color-primary)' }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {proveedor ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => proponer(true)} disabled={margenPct === null || Object.keys(costoNum).length === 0} style={{ ...botonSec, padding: '8px 12px', fontSize: 13 }}>
                  Proponer con margen{margenPct !== null ? ` de ${margenPct} %` : ''}
                </button>
                <span style={{ fontSize: 12, color: D.muted2 }}>
                  El cliente ve solo el precio al cliente. El margen se cambia en Cotizador → Tarifas.
                </span>
              </div>
            ) : null}
            <div className="pf-2">
              <Campo etiqueta="Mínimo" nota={unidad ? `En ${unidadesPrecio.find((u) => u.clave === unidad)?.plural ?? 'unidades'}. 0 = sin mínimo.` : '0 = sin mínimo.'}>
                <input type="number" min={0} step="1" value={minimo} onChange={(e) => setMinimo(e.target.value)} style={input} />
              </Campo>
              <Campo etiqueta="Horario en que atiende" nota="Solo se recomienda para trabajos dentro de este horario.">
                {horario ? (
                  <div style={{ display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {DIAS_SEMANA.map((d, i) => {
                        const on = horario.dias.includes(i);
                        return (
                          <button key={d} type="button" aria-pressed={on} onClick={() => setHorario({ ...horario, dias: on ? horario.dias.filter((x) => x !== i) : [...horario.dias, i].sort() })}
                            style={{ ...botonSec, padding: '5px 8px', fontSize: 12, borderColor: on ? D.accent : D.inputBorder, background: on ? D.accentSoft : 'transparent' }}>
                            {d}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="time" value={horario.desde} onChange={(e) => setHorario({ ...horario, desde: e.target.value })} style={{ ...input, padding: '7px 9px', width: 110 }} />
                      <span style={{ color: D.muted2 }}>a</span>
                      <input type="time" value={horario.hasta} onChange={(e) => setHorario({ ...horario, hasta: e.target.value })} style={{ ...input, padding: '7px 9px', width: 110 }} />
                      <button type="button" onClick={() => setHorario(null)} style={{ ...botonSec, padding: '6px 9px', fontSize: 12 }}>Quitar</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setHorario(HORARIO_DEFAULT)} style={{ ...botonSec, padding: '9px 12px', fontSize: 13, textAlign: 'left' }}>
                    Sin horario: atiende siempre. Definir uno…
                  </button>
                )}
              </Campo>
            </div>
            <div className="pf-2">
              {isRental ? (
                <Campo etiqueta="Flete por km" nota="Opcional. Vacío = tarifa general del traslado.">
                  <input name="rentalFreight" type="number" step="0.01" min={0} defaultValue={initial.rentalFreight ?? ''} style={input} />
                </Campo>
              ) : (
                <Campo etiqueta="Precio anterior" nota="Opcional, se muestra tachado como oferta.">
                  <input name="oldPrice" type="number" step="0.01" min={0} defaultValue={initial.oldPrice ?? ''} style={input} />
                </Campo>
              )}
              <Campo etiqueta={isRental ? 'Unidades iguales' : 'Existencias'} nota={isRental ? 'Cuántas máquinas iguales tiene para rentar.' : 'Cuántas tiene para vender. Vacío = sin control.'}>
                <input name="stock" type="number" min={0} defaultValue={initial.stock ?? ''} style={input} />
              </Campo>
            </div>
            <Campo etiqueta="Dónde está" nota="Patio o ciudad; sirve para calcular el traslado.">
              <input name="location" defaultValue={initial.location ?? ''} placeholder="Patio en García, N.L." style={input} />
            </Campo>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13.5, color: D.text, cursor: 'pointer' }}>
              <input type="checkbox" name="featured" defaultChecked={initial.featured} style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }} />
              Destacado (aparece en el inicio del sitio)
            </label>
          </Tarjeta>
        </div>

        {/* ════════ Columna lateral ════════ */}
        <aside className="pf-side">
          {enRevision ? (
            <Tarjeta titulo="Revisión" icono="ph-seal-check" acento>
              {error ? <p role="alert" style={{ color: D.bad, margin: 0, fontSize: 13 }}>{error}</p> : null}
              {renglonesLinea.length > 0 ? (
                <Campo etiqueta="Cuenta como en el cotizador" nota="Cuando un cliente cotice ese renglón, la solicitud le llega a este aliado.">
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
                <p style={{ margin: 0, fontSize: 13, color: D.muted2, lineHeight: 1.5 }}>
                  Esta línea no tiene renglones en el cotizador: se publica solo en el catálogo.
                </p>
              )}
              {rechazando ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Qué le falta o por qué no se publica (le llega por correo)" style={{ ...input, resize: 'vertical' }} />
                  <button type="button" disabled={busy !== null || motivo.trim().length < 4} onClick={() => void onRechazar()} style={{ ...botonPri, background: D.bad, color: '#fff', opacity: motivo.trim().length < 4 ? 0.5 : 1 }}>
                    {busy === 'rechazar' ? 'Rechazando…' : 'Rechazar y avisarle'}
                  </button>
                  <button type="button" onClick={() => { setRechazando(false); setMotivo(''); }} style={botonSec}>Cancelar</button>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  <button type="button" disabled={busy !== null} onClick={() => void onPublicar()} style={{ ...botonPri, opacity: busy ? 0.6 : 1 }}>
                    {busy === 'publicar' ? 'Publicando…' : 'Guardar y publicar'}
                  </button>
                  <button type="submit" disabled={busy !== null} style={botonSec}>
                    {busy === 'guardar' ? 'Guardando…' : 'Guardar sin publicar'}
                  </button>
                  <button type="button" onClick={() => setRechazando(true)} style={{ ...botonSec, color: D.bad }}>Rechazar</button>
                </div>
              )}
            </Tarjeta>
          ) : null}

          <Tarjeta titulo="Fotos" icono="ph-images">
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: D.muted2 }}>Principal</span>
              {initial.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={initial.image} alt="" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 12, background: D.previewBg }} />
              ) : (
                <div style={{ aspectRatio: '4 / 3', borderRadius: 12, border: `1px dashed ${D.inputBorder}`, display: 'grid', placeItems: 'center', color: D.muted2, fontSize: 13 }}>Sin foto</div>
              )}
              <label style={{ ...botonSec, textAlign: 'center', cursor: 'pointer' }}>
                {initial.image ? 'Cambiar foto principal' : 'Subir foto principal'}
                <input type="file" name="photo" accept="image/png,image/jpeg,image/webp,image/avif" style={{ display: 'none' }} />
              </label>
            </div>
            {initial.id ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: D.muted2 }}>Galería ({fotos.length}/6)</span>
                {fotos.length ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {fotos.map((f) => (
                      <div key={f.id} style={{ position: 'relative' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.url ?? ''} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, background: D.previewBg }} />
                        <button type="button" aria-label="Quitar foto" onClick={() => void quitarFoto(f.id)} style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 999, border: 'none', background: 'rgba(0,0,0,.7)', color: '#fff', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</button>
                      </div>
                    ))}
                  </div>
                ) : null}
                {fotos.length < 6 ? (
                  <label style={{ ...botonSec, textAlign: 'center', cursor: 'pointer', opacity: subiendo ? 0.6 : 1 }}>
                    {subiendo ? 'Subiendo…' : '+ Agregar a la galería'}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" style={{ display: 'none' }} disabled={subiendo}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void subirFoto(f); e.target.value = ''; }} />
                  </label>
                ) : null}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 12.5, color: D.muted2 }}>La galería se llena después de crear el equipo.</p>
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
            <p style={{ margin: 0, fontSize: 12.5, color: D.muted2, lineHeight: 1.5 }}>
              Con proveedor, el aliado lo ve en su portal y el emparejamiento sabe que tiene esta máquina.
            </p>
          </Tarjeta>
        </aside>
      </div>

      {/* ── Barra de acciones (en revisión las acciones viven en la tarjeta Revisión) ── */}
      {enRevision ? null : (
      <div className="pf-bar">
        {error ? <p role="alert" style={{ color: D.bad, margin: 0, fontSize: 13.5, flex: 1 }}>{error}</p> : <span style={{ flex: 1 }} />}
        <button type="button" onClick={() => router.push(volver.href)} style={botonSec}>Cancelar</button>
        {enRevision ? null : (
          <button type="submit" disabled={busy !== null} style={{ ...botonPri, opacity: busy ? 0.6 : 1 }}>
            {busy === 'guardar' ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear equipo'}
          </button>
        )}
      </div>
      )}
    </form>
  );
}

// ---- piezas ----

function Tarjeta({ titulo, icono, ayuda, acento, children }: { titulo: string; icono: string; ayuda?: string; acento?: boolean; children: ReactNode }) {
  return (
    <section style={{ background: D.card, border: `1px solid ${acento ? `color-mix(in srgb, ${D.warn} 45%, transparent)` : D.cardBorder}`, borderRadius: 16, padding: 20, display: 'grid', gap: 14 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: D.text, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className={`ph ${icono}`} style={{ color: acento ? D.warn : D.accent, fontSize: 18 }} /> {titulo}
        </h2>
        {ayuda ? <p style={{ margin: '5px 0 0', fontSize: 12.5, color: D.muted2, lineHeight: 1.5 }}>{ayuda}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Campo({ etiqueta, nota, grupo, children }: { etiqueta: string; nota?: string; grupo?: boolean; children: ReactNode }) {
  // `grupo`: varios botones adentro; un <label> haría que tocar el texto pulse el primero.
  const Tag = grupo ? 'div' : 'label';
  return (
    <Tag style={{ display: 'grid', gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#c4c4c8' }}>{etiqueta}</span>
      {children}
      {nota ? <span style={{ fontSize: 11.5, color: D.muted2, lineHeight: 1.45 }}>{nota}</span> : null}
    </Tag>
  );
}

function Opcion({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      style={{
        padding: '11px 14px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
        background: activo ? D.accentSoft : D.inputBg,
        border: `1px solid ${activo ? D.accent : D.inputBorder}`,
        color: D.text,
      }}
    >
      {children}
    </button>
  );
}

function Chip({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color, border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`, background: `color-mix(in srgb, ${color} 10%, transparent)`, borderRadius: 999, padding: '4px 10px' }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} /> {children}
    </span>
  );
}

const input: CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: D.inputBg, border: `1px solid ${D.inputBorder}`, borderRadius: 10,
  padding: '10px 13px', fontSize: 14, color: D.text, fontFamily: 'inherit', outline: 'none',
};
const botonPri: CSSProperties = {
  background: D.accent, color: D.accentInk, border: 'none', borderRadius: 10, padding: '11px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
};
const botonSec: CSSProperties = {
  background: 'transparent', color: D.text, border: `1px solid ${D.inputBorder}`, borderRadius: 10, padding: '10px 14px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
};
const botonIcono: CSSProperties = {
  width: 38, height: 38, borderRadius: 10, border: `1px solid ${D.inputBorder}`, background: 'transparent', color: D.muted2, cursor: 'pointer', fontSize: 18,
};

const CSS = `
.pf { max-width: 1120px; margin: 0 auto; padding: 4px 0 24px; }
.pf-cols { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; align-items: start; }
.pf-side { display: grid; gap: 16px; position: sticky; top: 16px; }
.pf-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.pf-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.pf input:focus, .pf textarea:focus { border-color: var(--color-primary); }
.pf-bar { position: sticky; bottom: 0; margin-top: 18px; display: flex; gap: 10px; align-items: center; padding: 14px 0; background: linear-gradient(to top, #0b0b0d 70%, transparent); }
@media (max-width: 980px) {
  .pf-cols { grid-template-columns: minmax(0, 1fr); }
  .pf-side { position: static; }
}
@media (max-width: 620px) {
  .pf-2, .pf-3 { grid-template-columns: minmax(0, 1fr); }
}
`;
