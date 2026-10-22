'use client';

import { useEffect, useMemo, useState, type MutableRefObject } from 'react';
import { seccionDeLinea, type CatalogoCotizador, type ClaseRenglon, type SeccionCotizador } from '@maqserv/config';
import { AdminSelect } from '@/components/AdminSelect';
import { Btn, IconBtn, Note, Switch } from '@/components/ui';

/**
 * EL PRECIO DEL TIPO EN EL COTIZADOR, DESDE SU FICHA (2026-10-19).
 *
 * "Que cuando se haga un cambio en algo que tiene relación con otro ya no se
 * haga doble trabajo." Antes el equipo se daba de alta en Inventario y otra vez
 * en Tarifas y condiciones. Ahora esta tarjeta es el único lugar donde se pone
 * cuánto cuesta en el cotizador: el del sitio y el del panel leen de aquí.
 *
 * El cliente nunca ve este precio en el catálogo: solo en su cotización.
 *
 * Se guarda junto con la ficha (`controlRef.current.guardar`), no con un botón
 * propio: es una sola pantalla y un solo "Guardar".
 */

export interface PrecioEnCotizadorControl {
  /** Guarda si hubo cambios. Devuelve el error, o null si quedó (o no había nada que guardar). */
  guardar: (productId: number, nombreFicha: string) => Promise<string | null>;
}

interface Renglon {
  id?: string;
  nombre: string;
  dia: string;
  semana: string;
  mes: string;
  flete: string;
  precio: string;
  cond: string;
}

interface Ficha {
  linea: string | null;
  seccion: SeccionCotizador | null;
  activa: boolean;
  oculto: boolean;
  renglones: Array<{ id?: string; nombre: string; tarifas?: { dia: number; semana: number; mes: number }; flete_tipo?: string; precio?: number; cond?: string }>;
  fletes: Array<{ nombre: string; monto: number }>;
  condiciones: Array<{ clave: string; titulo: string }>;
  tramos: Array<{ id: string; label: string; desde: number; hasta: number | null }>;
}

const NUEVO_FLETE = '__nuevo__';
const money = (n: number) => `$${n.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;
const vacio = (cond = ''): Renglon => ({ nombre: '', dia: '', semana: '', mes: '', flete: '', precio: '', cond });

/** Lo que sale de la API, a texto para los campos. */
function aRenglon(r: Ficha['renglones'][number]): Renglon {
  const t = (n?: number) => (n === undefined || n === null ? '' : String(n));
  return { id: r.id, nombre: r.nombre, dia: t(r.tarifas?.dia), semana: t(r.tarifas?.semana), mes: t(r.tarifas?.mes), flete: r.flete_tipo ?? '', precio: t(r.precio), cond: r.cond ?? '' };
}

/** Para una ficha nueva todavía no hay a quién preguntarle: se arma con el tabulador de su línea. */
function fichaDeCatalogo(cat: CatalogoCotizador, linea: string, seccion: SeccionCotizador): Ficha {
  return {
    linea,
    seccion,
    activa: true,
    oculto: false,
    renglones: [],
    fletes: cat.tipo === 'maquinaria' ? Object.entries(cat.fletes).map(([nombre, monto]) => ({ nombre, monto })) : [],
    condiciones: Object.entries(cat.condiciones).map(([clave, b]) => ({ clave, titulo: b.titulo })),
    tramos: cat.tipo === 'maquinaria' ? cat.tiers.map((t) => ({ id: t.id, label: t.label, desde: t.desde_dias, hasta: t.hasta_dias })) : [],
  };
}

const AGREGAR: Record<ClaseRenglon, string> = {
  equipo: 'Agregar variante (ej. con martillo)',
  servicio: 'Agregar otra capacidad',
  material: 'Agregar otra presentación',
};

export function PrecioEnCotizador({
  productId,
  linea,
  controlRef,
  puedeEditar = true,
}: {
  /** Ausente: la ficha se está creando. */
  productId?: number;
  /** La línea elegida en la ficha (puede cambiar mientras se edita). */
  linea: string | null;
  controlRef: MutableRefObject<PrecioEnCotizadorControl | null>;
  /** Sin el módulo Tarifas no se carga ni se guarda: el precio lo pone Dirección. */
  puedeEditar?: boolean;
}) {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'sin-permiso' | 'error'>('cargando');
  const [renglones, setRenglones] = useState<Renglon[]>([]);
  const [sale, setSale] = useState(true);
  const [fletesNuevos, setFletesNuevos] = useState<Record<number, { nombre: string; monto: string }>>({});
  const [inicial, setInicial] = useState('');

  const seccionElegida = seccionDeLinea(linea);

  // La ficha guardada manda; para una nueva, el tabulador de la línea elegida.
  useEffect(() => {
    let vivo = true;
    async function cargar() {
      if (!puedeEditar) { setEstado('sin-permiso'); return; }
      setEstado('cargando');
      try {
        let f: Ficha | null = null;
        if (productId) {
          const r = await fetch(`/api/admin/quoter/ficha/${productId}`);
          if (r.status === 401 || r.status === 403) { if (vivo) setEstado('sin-permiso'); return; }
          if (!r.ok) throw new Error();
          f = (await r.json()) as Ficha;
        } else if (seccionElegida && linea) {
          const r = await fetch(`/api/admin/quoter/catalog/${seccionElegida.tipo}`);
          if (r.status === 401 || r.status === 403) { if (vivo) setEstado('sin-permiso'); return; }
          if (!r.ok) throw new Error();
          f = fichaDeCatalogo((await r.json()) as CatalogoCotizador, linea, seccionElegida);
        }
        if (!vivo) return;
        setFicha(f);
        const rs = (f?.renglones ?? []).map(aRenglon);
        setRenglones(rs);
        setSale(!(f?.oculto ?? false));
        setFletesNuevos({});
        setInicial(JSON.stringify({ rs, sale: !(f?.oculto ?? false) }));
        setEstado('listo');
      } catch {
        if (vivo) setEstado('error');
      }
    }
    void cargar();
    return () => { vivo = false; };
    // Una ficha guardada no cambia de sección hasta que se guarda; una nueva sí.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, productId ? null : linea, puedeEditar]);

  const seccion = ficha?.seccion ?? null;
  const cambioDeLinea = !!productId && !!ficha && ficha.linea !== linea;
  const cambiado = JSON.stringify({ rs: renglones, sale }) !== inicial || Object.keys(fletesNuevos).length > 0;

  const tramos = ficha?.tramos ?? [];
  const textoTramo = (id: 'dia' | 'semana' | 'mes') => {
    const t = tramos.find((x) => x.id === id);
    if (!t) return id === 'dia' ? 'Por día' : id === 'semana' ? 'Por día, rentando por semana' : 'Por día, rentando por mes';
    return `${t.label} · ${t.desde}${t.hasta ? `–${t.hasta}` : '+'} días`;
  };

  /** Lo que se manda. Null + mensaje si algo no cuadra. */
  const armar = (nombreFicha: string): { body: unknown } | { error: string } => {
    if (!seccion) return { error: '' };
    const num = (s: string) => Number(s);
    const nuevos: Record<string, number> = {};
    const out = [];
    for (const [i, r] of renglones.entries()) {
      const nombre = r.nombre.trim() || nombreFicha.trim();
      if (nombre.length < 2) return { error: 'Pon el nombre con el que sale cada renglón en el cotizador.' };
      if (seccion.clase === 'equipo') {
        let flete = r.flete;
        if (flete === NUEVO_FLETE) {
          const f = fletesNuevos[i];
          if (!f || f.nombre.trim().length < 2) return { error: `«${nombre}»: escribe el nombre del flete nuevo.` };
          if (!(num(f.monto) > 0)) return { error: `«${nombre}»: pon cuánto cuesta el flete nuevo.` };
          flete = f.nombre.trim();
          nuevos[flete] = num(f.monto);
        }
        if (!flete) return { error: `«${nombre}»: elige qué flete se le cobra.` };
        if (sale && !(num(r.dia) > 0 && num(r.semana) > 0 && num(r.mes) > 0)) {
          return { error: `«${nombre}»: pon las tres tarifas. En $0 se cotizaría gratis.` };
        }
        out.push({ id: r.id, nombre, flete_tipo: flete, tarifas: { dia: num(r.dia) || 0, semana: num(r.semana) || 0, mes: num(r.mes) || 0 } });
      } else {
        if (sale && !(num(r.precio) > 0)) return { error: `«${nombre}»: pon su precio. En $0 se cotizaría gratis.` };
        out.push({ id: r.id, nombre, precio: num(r.precio) || 0, ...(seccion.clase === 'servicio' ? { cond: r.cond || undefined } : {}) });
      }
    }
    return { body: { renglones: out, oculto: !sale, ...(Object.keys(nuevos).length ? { fletesNuevos: nuevos } : {}) } };
  };

  // Lo llama la ficha al guardar.
  controlRef.current = {
    async guardar(id, nombreFicha) {
      if (estado !== 'listo' || !seccion || cambioDeLinea) return null;
      // Ficha nueva sin renglones: no hay nada que mandar al cotizador.
      if (!cambiado && (productId || renglones.length === 0)) return null;
      const a = armar(nombreFicha);
      if ('error' in a) return a.error || null;
      const r = await fetch(`/api/admin/quoter/ficha/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(a.body),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) return typeof d?.message === 'string' ? d.message : 'No se pudo guardar el precio del cotizador.';
      return null;
    },
  };

  const opcionesFlete = useMemo(
    () => [
      ...(ficha?.fletes ?? []).map((f) => ({ value: f.nombre, label: `${f.nombre} · ${money(f.monto)}` })),
      { value: NUEVO_FLETE, label: '+ Nuevo tipo de flete…' },
    ],
    [ficha],
  );

  const set = (i: number, patch: Partial<Renglon>) => setRenglones((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const quitar = (i: number) => {
    setRenglones((rs) => rs.filter((_, j) => j !== i));
    setFletesNuevos((f) => Object.fromEntries(Object.entries(f).filter(([k]) => Number(k) !== i).map(([k, v]) => [Number(k) > i ? Number(k) - 1 : k, v])));
  };
  const agregar = () => setRenglones((rs) => [...rs, vacio(ficha?.condiciones[0]?.clave ?? '')]);

  // ---- Lo que no se edita aquí ----
  if (!seccionElegida && !(productId && seccion)) {
    return (
      <p className="adm-help" style={{ margin: 0 }}>
        {linea
          ? 'Esta línea no tiene cotizador: el cliente la pide con «Cotizar» y el precio se pone al responder la solicitud.'
          : 'Elige la línea de servicio para poner su precio en el cotizador.'}
      </p>
    );
  }
  if (estado === 'cargando') return <p className="adm-help" style={{ margin: 0 }}>Cargando el precio del cotizador…</p>;
  if (estado === 'sin-permiso') {
    return <Note tone="info" icon="ph-lock-key">El precio en el cotizador lo pone Dirección (permiso de Tarifas).</Note>;
  }
  if (estado === 'error' || !seccion) {
    return <Note tone="bad" icon="ph-warning-circle">No se pudo leer el precio del cotizador. Recarga la página antes de guardar.</Note>;
  }
  if (cambioDeLinea) {
    return (
      <Note tone="warn" icon="ph-arrows-left-right">
        Cambiaste la línea de servicio. Guarda la ficha y vuelve a abrirla para poner su precio en el cotizador de esa línea.
      </Note>
    );
  }

  const unidad = seccion.clase === 'servicio' ? 'por viaje' : 'por tonelada';

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {!ficha?.activa ? (
        <Note tone="warn" icon="ph-eye-slash">La ficha está inactiva: mientras siga así no sale en el cotizador.</Note>
      ) : null}

      {renglones.length === 0 ? (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="adm-help" style={{ flex: 1, minWidth: 220 }}>
            No sale en el cotizador. Agrégalo para que se pueda cotizar con precio desde el sitio y el panel.
          </span>
          <Btn size="sm" icon="ph-plus" onClick={agregar}>Ponerlo en el cotizador</Btn>
        </div>
      ) : (
        <>
          <Switch on={sale} onClick={() => setSale(!sale)} label={sale ? 'Sale en el cotizador' : 'No sale en el cotizador (conserva su precio)'} />
          {renglones.map((r, i) => (
            <div key={r.id ?? `nuevo-${i}`} className="pf-renglon">
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <label style={{ display: 'grid', gap: 6, flex: 1 }}>
                  <span className="adm-label">Cómo sale en el cotizador</span>
                  <input
                    className="adm-input"
                    value={r.nombre}
                    onChange={(e) => set(i, { nombre: e.target.value })}
                    placeholder={seccion.clase === 'equipo' ? 'Retroexcavadora c/ cucharón' : seccion.clase === 'servicio' ? 'Pipa de agua 10 m³' : 'Base hidráulica'}
                  />
                </label>
                <IconBtn icon="ph-trash" label="Quitar del cotizador" onClick={() => quitar(i)} />
              </div>
              {seccion.clase === 'equipo' ? (
                <>
                  <div className="pf-3">
                    {(['dia', 'semana', 'mes'] as const).map((k) => (
                      <label key={k} style={{ display: 'grid', gap: 6 }}>
                        <span className="adm-label">{textoTramo(k)}</span>
                        <input className="adm-input adm-num" type="number" min={0} step="0.01" value={r[k]} onChange={(e) => set(i, { [k]: e.target.value })} placeholder="$ por día" />
                      </label>
                    ))}
                  </div>
                  <div className="pf-2">
                    <label style={{ display: 'grid', gap: 6 }}>
                      <span className="adm-label">Flete (llevar y traer)</span>
                      <AdminSelect ariaLabel="Tipo de flete" value={r.flete} onChange={(v) => set(i, { flete: v })} placeholder="Elige…" options={opcionesFlete} />
                    </label>
                    {r.flete === NUEVO_FLETE ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 120px', gap: 8, alignItems: 'end' }}>
                        <label style={{ display: 'grid', gap: 6 }}>
                          <span className="adm-label">Nombre del flete</span>
                          <input className="adm-input" value={fletesNuevos[i]?.nombre ?? ''} onChange={(e) => setFletesNuevos((f) => ({ ...f, [i]: { nombre: e.target.value, monto: f[i]?.monto ?? '' } }))} placeholder="Minicargador" />
                        </label>
                        <label style={{ display: 'grid', gap: 6 }}>
                          <span className="adm-label">Cuesta</span>
                          <input className="adm-input adm-num" type="number" min={0} value={fletesNuevos[i]?.monto ?? ''} onChange={(e) => setFletesNuevos((f) => ({ ...f, [i]: { nombre: f[i]?.nombre ?? '', monto: e.target.value } }))} placeholder="$" />
                        </label>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="pf-2">
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span className="adm-label">Precio {unidad}</span>
                    <input className="adm-input adm-num" type="number" min={0} step="0.01" value={r.precio} onChange={(e) => set(i, { precio: e.target.value })} placeholder="$" />
                  </label>
                  {seccion.clase === 'servicio' ? (
                    <label style={{ display: 'grid', gap: 6 }}>
                      <span className="adm-label">Condiciones que se imprimen</span>
                      <AdminSelect
                        ariaLabel="Condiciones"
                        value={r.cond}
                        onChange={(v) => set(i, { cond: v })}
                        options={(ficha?.condiciones ?? []).map((c) => ({ value: c.clave, label: c.titulo }))}
                      />
                    </label>
                  ) : null}
                </div>
              )}
            </div>
          ))}
          <div><Btn size="sm" icon="ph-plus" onClick={agregar}>{AGREGAR[seccion.clase]}</Btn></div>
        </>
      )}
      <p className="adm-help" style={{ margin: 0 }}>
        El cliente nunca ve este precio en el catálogo: solo aparece en su cotización. Se guarda con la ficha y aplica a las cotizaciones nuevas.
      </p>
    </div>
  );
}
