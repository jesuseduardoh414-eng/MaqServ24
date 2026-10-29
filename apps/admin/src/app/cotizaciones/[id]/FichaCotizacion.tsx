'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mostrarResultado } from '@maqserv/ui';
import {
  alinearATarifa,
  calcularCotizacion,
  conZonaDeLaObra,
  equipoDe,
  ponerPrecio,
  productoDe,
  quitarPrecio,
  renglonesPorPartida,
  servicioDe,
  minimoHorasDe,
  porZona,
  zonaDe,
  zonasDelServicio,
  type CatalogoCotizador,
  type FichasDeRenglones,
  type FilaDesglose,
  type FilaExplicada,
  type OpcionesCotizador,
  type PartidaCotizador,
} from '@maqserv/config';
import { AdminSelect } from '@/components/AdminSelect';
import { AdminDatePicker } from '@/components/AdminFecha';
import { confirmar } from '@/components/Dialogos';
import { Btn, Chip, IconBtn, Note, PageHeader, Panel } from '@/components/ui';
import { QuoteRespond } from '../QuoteRespond';

/**
 * LA FICHA DE LA COTIZACIÓN (2026-10-23).
 *
 * "Volver a cotizar no es que abra el cotizador otra vez: es para ver qué se
 * está cotizando a detalle y sus costos, y si se quiere editar algo, se hace
 * ahí." Una pantalla con el encabezado (empresa, obra, contacto), los avisos,
 * cada partida con sus cantidades y sus renglones (de dónde sale cada precio,
 * con el lápiz) y el resumen al lado.
 *
 * Todo lo que se edita (cantidades, precios especiales, partidas agregadas o
 * quitadas) se recalcula aquí con el MISMO motor que la API y se guarda junto
 * con "Guardar". Corregir una TARIFA es distinto: cambia el tabulador para
 * todos, así que se guarda en el momento, con confirmación.
 *
 * Las solicitudes del formulario (sin cotizador) no traen partidas del
 * tabulador: se ven sus renglones y el lápiz cambia cantidad y precio en el
 * momento.
 */

type Modo = 'editar' | 'nueva_version' | 'ver';

interface Ficha {
  solicitud: {
    id: number;
    quoteNumber: string;
    status: string;
    aceptada: boolean;
    empresa: string;
    contacto: string;
    telefono: string | null;
    correo: string | null;
    obra: { id: number | null; name: string; address: string | null; municipality: string | null };
    atencion: string | null;
    fechaInicio: string | null;
    notas: string | null;
    pide: string | null;
    comentarios: string | null;
    validUntil: string | null;
    subtotal: number;
    freightCost: number;
    tax: number;
    total: number;
  };
  modo: Modo;
  documento: {
    id: number;
    folio: string;
    kind: 'maquinaria' | 'triturados';
    state: string;
    partidas: PartidaCotizador[];
    opciones: Partial<OpcionesCotizador>;
    subtotal: number;
    iva: number;
    total: number;
  } | null;
  partes: Array<{ id: number; quoteNumber: string; linea: string | null; total: number }>;
  /** Las obras de su empresa, para cambiar de obra. */
  obras: ObraCorta[];
  formulario: { filas: FilaDesglose[]; subtotal: number; iva: number; total: number } | null;
  avisos: string[];
  puedeTarifas: boolean;
}

interface ObraCorta { id: number; name: string; address: string | null; municipality: string | null }

/** Los datos de la entrega mientras se editan (null en la ficha = sin cambios). */
interface DatosEdit {
  obraId: number | null;
  nueva: { nombre: string; direccion: string; municipio: string } | null;
  fechaInicio: string;
  atencion: string;
  telefono: string;
  notas: string;
}

const money = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cantidad = (n: number) => n.toLocaleString('es-MX', { maximumFractionDigits: 2 });
const leer = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url);
  const b = await r.json().catch(() => null);
  if (!r.ok) throw new Error(b?.message ?? 'No se pudo leer la cotización.');
  return b as T;
};

export function FichaCotizacion({ id }: { id: number }) {
  const router = useRouter();
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [cat, setCat] = useState<CatalogoCotizador | null>(null);
  const [fichas, setFichas] = useState<FichasDeRenglones>({});
  const [partidas, setPartidas] = useState<PartidaCotizador[]>([]);
  const [opciones, setOpciones] = useState<Partial<OpcionesCotizador>>({});
  const [sucio, setSucio] = useState(false);
  // Los datos de la entrega editados (null = sin cambios) y si el editor está abierto.
  const [datos, setDatos] = useState<DatosEdit | null>(null);
  const [editandoDatos, setEditandoDatos] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const f = await leer<Ficha>(`/api/admin/quotes/${id}/cotizacion`);
      setFicha(f);
      if (f.documento) {
        const [c, fx] = await Promise.all([
          leer<CatalogoCotizador>(`/api/admin/quoter/catalog/${f.documento.kind}`),
          leer<FichasDeRenglones>(`/api/admin/quoter/catalog/${f.documento.kind}/fichas`).catch(() => ({})),
        ]);
        setCat(c);
        setFichas(fx);
        // El agua de un documento sin zona toma la del municipio de la obra (2026-10-29).
        setPartidas(conZonaDeLaObra(c, structuredClone(f.documento.partidas), f.solicitud.obra?.municipality));
        setOpciones(f.documento.opciones ?? {});
      }
      setSucio(false);
      setDatos(null);
      setEditandoDatos(false);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => { void cargar(); }, [cargar]);

  // Un aviso nuevo (p. ej. el cliente aceptó) o cualquier cambio guardado en el sistema vuelve a leer la
  // ficha, salvo que haya cambios sin guardar (2026-10-26).
  useEffect(() => {
    if (sucio || datos || editandoDatos || guardando) return;
    const alAviso = () => { void cargar(); };
    window.addEventListener('adm:avisos', alAviso);
    window.addEventListener('adm:cambios', alAviso);
    return () => {
      window.removeEventListener('adm:avisos', alAviso);
      window.removeEventListener('adm:cambios', alAviso);
    };
  }, [cargar, sucio, datos, editandoDatos, guardando]);

  // Avisa antes de salir con cambios sin guardar.
  useEffect(() => {
    if (!sucio && !datos) return;
    const antes = (ev: BeforeUnloadEvent) => { ev.preventDefault(); };
    window.addEventListener('beforeunload', antes);
    return () => window.removeEventListener('beforeunload', antes);
  }, [sucio, datos]);

  const calc = useMemo(() => (cat ? calcularCotizacion(cat, partidas, opciones) : null), [cat, partidas, opciones]);
  const porPartida = useMemo(() => (cat ? renglonesPorPartida(cat, partidas, opciones, fichas) : []), [cat, partidas, opciones, fichas]);

  if (error) return <Note tone="bad" icon="ph-warning">{error}</Note>;
  if (!ficha) return <p style={{ color: 'var(--adm-muted)' }}>Cargando la cotización…</p>;

  const s = ficha.solicitud;
  const doc = ficha.documento;
  const edita = ficha.modo !== 'ver';
  // Las tarifas cambiaron desde que se guardó: con las de hoy sale otro total.
  const desactualizado = !!(doc && calc && !sucio && Math.abs(calc.total - doc.total) >= 0.01);

  const cambiar = (fn: (copia: PartidaCotizador[]) => void) => {
    const copia = structuredClone(partidas);
    fn(copia);
    setPartidas(copia);
    setSucio(true);
  };

  const conCambios = sucio || datos !== null;

  /** Lo que se manda de los datos de la entrega: la obra solo si cambió. */
  const datosParaGuardar = () => datos && {
    ...(datos.nueva ? { obraNueva: datos.nueva } : datos.obraId && datos.obraId !== s.obra.id ? { obraId: datos.obraId } : {}),
    fechaInicio: datos.fechaInicio,
    atencion: datos.atencion,
    telefono: datos.telefono,
    notas: datos.notas,
  };

  async function guardar() {
    if (!doc && !datos) return;
    if (datos?.nueva && (datos.nueva.nombre.trim().length < 2 || datos.nueva.direccion.trim().length < 5)) {
      mostrarResultado('La obra nueva necesita nombre y dirección.', 'bad');
      setEditandoDatos(true);
      return;
    }
    if (doc && ficha?.modo === 'nueva_version') {
      const ok = await confirmar({
        titulo: 'Guardar como versión nueva',
        mensaje: `Ya se le mandó el precio de ${doc.folio}. Sale un documento nuevo con estos cambios y la solicitud vuelve a «Por cotizar» para mandarle el bueno.`,
        confirmar: 'Guardar versión nueva',
      });
      if (!ok) return;
    }
    setGuardando(true);
    const r = await fetch(`/api/admin/quotes/${id}/cotizacion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(doc ? { partidas, opciones } : {}), ...(datos ? { datos: datosParaGuardar() } : {}) }),
    }).catch(() => null);
    const b = await r?.json().catch(() => null);
    setGuardando(false);
    if (!r?.ok) { mostrarResultado(b?.message ?? 'No se pudo guardar.', 'bad'); return; }
    mostrarResultado(b?.nuevaVersion ? `Se guardó como ${b.folio}; la solicitud volvió a «Por cotizar»` : b?.folio ? `Guardado en ${b.folio}` : 'Guardado', 'ok');
    await cargar();
    router.refresh();
  }

  /** Corregir la tarifa: se guarda en el tabulador en el momento (es para todos). */
  async function corregirTarifa(i: number, f: FilaExplicada, valor: number): Promise<boolean> {
    if (!doc || !f.ref) return false;
    const ok = await confirmar({
      titulo: 'Corregir la tarifa',
      mensaje: (
        <>
          <strong>{f.concepto}</strong> pasa de {money(f.edicion?.tarifa ?? 0)} a {money(valor)} {f.edicion?.unidad} en todo el sistema: los dos
          cotizadores y las solicitudes que siguen por cotizar.
          {f.edicion?.usos && f.edicion.usos > 1 ? <> Esta tarifa la usan {f.edicion.usos} equipos.</> : null}
          {' '}Lo que ya se le mandó a un cliente no cambia.
        </>
      ),
      confirmar: 'Corregir la tarifa',
    });
    if (!ok) return false;
    const r = await fetch(`/api/admin/quotes/${id}/tarifa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: doc.kind, ref: f.ref, valor }),
    }).catch(() => null);
    const b = await r?.json().catch(() => null);
    if (!r?.ok) { mostrarResultado(b?.message ?? 'No se pudo corregir la tarifa.', 'bad'); return false; }
    const nuevo = await leer<CatalogoCotizador>(`/api/admin/quoter/catalog/${doc.kind}`);
    setCat(nuevo);
    // Esta partida deja su precio especial y lo que traía la tarifa vieja escrita pasa a la nueva.
    const copia = structuredClone(partidas);
    quitarPrecio(copia, i, f.clase, valor);
    alinearATarifa(nuevo, copia, f.ref, b?.antes ?? null, valor);
    setPartidas(copia);
    setSucio(true);
    mostrarResultado(`Tarifa corregida${b?.recalculadas ? ` · se recalcularon ${b.recalculadas} solicitud(es)` : ''}. Guarda esta cotización para que tome los cambios.`, 'ok');
    return true;
  }

  return (
    <div>
      <style>{`
        .fc-grid{ display:grid; grid-template-columns:minmax(0,1fr) 320px; gap:20px; align-items:start; }
        .fc-aside{ position:sticky; top:84px; display:grid; gap:12px; }
        @media (max-width: 1100px){ .fc-grid{ grid-template-columns:minmax(0,1fr); } .fc-aside{ position:static; scroll-margin-top:16px; } }
        /* Barra fija abajo (2026-10-28): el total siempre a la vista y un toque para llegar a guardar o mandar. */
        .fc-barra-movil{ display:none; }
        @media (max-width: 1100px){
          .fc-barra-movil{ display:flex; align-items:center; justify-content:space-between; gap:12px; position:sticky; bottom:-56px; z-index:3;
            margin:18px 0 -56px; padding:12px 0 68px; background:var(--adm-page); border-top:1px solid var(--adm-border); }
          .fc-barra-movil b{ font-size:18px; font-weight:600; color:var(--adm-text); }
        }
        @media (max-width: 760px){ .fc-barra-movil{ bottom:-40px; margin-bottom:-40px; padding-bottom:50px; } }
        .fc-dl{ display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:14px 24px; margin:0; }
        .fc-dl dt{ font-size:11.5px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:var(--adm-faint); margin-bottom:4px; }
        .fc-dl dd{ margin:0; font-size:14px; color:var(--adm-text); overflow-wrap:anywhere; }
        .fc-dl dd .fc-sub{ display:block; font-size:12.5px; color:var(--adm-muted); margin-top:2px; }
        .fc-part{ border:1px solid var(--adm-border); border-radius:10px; overflow:hidden; }
        .fc-part-h{ display:flex; gap:12px; align-items:center; justify-content:space-between; flex-wrap:wrap; padding:12px 14px; background:rgba(var(--adm-ink),0.025); border-bottom:1px solid var(--adm-border); }
        .fc-cant{ display:flex; gap:12px; flex-wrap:wrap; align-items:end; }
        .fc-cant label{ display:grid; gap:4px; font-size:11.5px; color:var(--adm-muted); }
        .fc-cant input{ width:86px; }
        .fc-ren{ display:flex; gap:12px; align-items:flex-start; padding:10px 14px; border-top:1px solid var(--adm-border); }
        .fc-ren:first-of-type{ border-top:0; }
        .fc-tot{ display:flex; justify-content:space-between; padding:4px 0; font-size:13.5px; color:var(--adm-muted); }
        .fc-tot b{ color:var(--adm-text); font-weight:500; }
      `}</style>

      <PageHeader
        eyebrow={['1 · Recibir', ['Solicitudes', `/cotizaciones?ver=${s.id}`], 'Cotización']}
        title={<>{s.quoteNumber}{doc ? <span style={{ color: 'var(--adm-muted)', fontWeight: 500 }}> · {doc.folio}</span> : null}</>}
        subtitle={`${s.empresa} · ${s.obra.name}`}
        actions={
          <>
            <Btn href={`/cotizaciones?ver=${s.id}`} icon="ph-arrow-left">Volver a Solicitudes</Btn>
            {doc ? <Btn href={`/cotizador/historial/${doc.id}`} icon="ph-file-text">Ver documento</Btn> : null}
          </>
        }
      />

      <div className="fc-grid">
        <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
          <Panel>
            <dl className="fc-dl">
              <div><dt>Empresa</dt><dd>{s.empresa}{[s.contacto !== s.empresa ? s.contacto : null, s.atencion ? `Atención: ${s.atencion}` : null].filter(Boolean).length ? <span className="fc-sub">{[s.contacto !== s.empresa ? s.contacto : null, s.atencion ? `Atención: ${s.atencion}` : null].filter(Boolean).join(' · ')}</span> : null}</dd></div>
              <div><dt>Obra</dt><dd>{s.obra.name}<span className="fc-sub">{dondeObra(s.obra) || 'Sin dirección'}</span></dd></div>
              <div><dt>Inicio o entrega</dt><dd>{s.fechaInicio ? fechaLarga(s.fechaInicio) : <span style={{ color: 'var(--adm-warn)' }}>Sin fecha</span>}</dd></div>
              <div><dt>Contacto</dt><dd>{s.telefono || '—'}<span className="fc-sub">{s.correo || '—'}</span></dd></div>
              <div><dt>Estado</dt><dd>
                {ficha.modo === 'editar' ? <Chip tone="accent">Por cotizar</Chip> : ficha.modo === 'nueva_version' ? <Chip tone="warn">Ya se le mandó el precio</Chip> : <Chip tone="ok">{s.aceptada ? 'Aceptada por el cliente' : 'Solo consulta'}</Chip>}
                {s.validUntil && ficha.modo !== 'editar' ? <span className="fc-sub">Vale hasta el {s.validUntil}</span> : null}
              </dd></div>
            </dl>
            {s.notas ? <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--adm-text-2)' }}><strong style={{ fontWeight: 600 }}>Notas para el cliente:</strong> {s.notas}</p> : null}
            {(doc ? edita : ficha.modo === 'editar') ? (
              editandoDatos ? (
                <EditarEntrega
                  ficha={ficha}
                  datos={datos ?? { obraId: s.obra.id, nueva: null, fechaInicio: s.fechaInicio ?? '', atencion: s.atencion ?? '', telefono: s.telefono ?? '', notas: s.notas ?? '' }}
                  conDocumento={!!doc}
                  onCambio={setDatos}
                  onListo={() => setEditandoDatos(false)}
                />
              ) : (
                <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Btn size="sm" icon="ph-pencil-simple" onClick={() => setEditandoDatos(true)}>Editar datos de la entrega</Btn>
                  {datos ? <span style={{ fontSize: 12.5, color: 'var(--adm-warn)' }}>Datos cambiados: se aplican al guardar.</span> : null}
                </div>
              )
            ) : null}
            {s.comentarios ? (
              <details style={{ marginTop: 14 }}>
                <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--adm-text-2)' }}>Lo que escribió el cliente</summary>
                <p style={{ margin: '8px 0 0', fontSize: 13, whiteSpace: 'pre-wrap', color: 'var(--adm-text-2)' }}>{s.comentarios}</p>
              </details>
            ) : null}
          </Panel>

          {ficha.avisos.length ? (
            <Note tone="warn" icon="ph-warning">
              <div style={{ display: 'grid', gap: 4 }}>
                <strong style={{ fontWeight: 600 }}>Revisa antes de mandarle el precio</strong>
                <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 2 }}>{ficha.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
              </div>
            </Note>
          ) : null}

          {ficha.partes.length > 1 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--adm-muted)' }}>
              El documento viene en {ficha.partes.length} partes, una por línea ({ficha.partes.map((p) => p.quoteNumber).join(', ')}): cada una se le ofrece a
              aliados distintos, pero el cliente recibe un solo precio.
            </p>
          ) : null}

          {ficha.modo === 'nueva_version' ? (
            <Note tone="info" icon="ph-info">Ya se le mandó el precio al cliente. Si cambias algo, al guardar sale una versión nueva y la solicitud vuelve a «Por cotizar».</Note>
          ) : null}
          {desactualizado && calc && doc ? (
            <Note tone="warn" icon="ph-clock-counter-clockwise">
              Las tarifas cambiaron desde que se armó: con las de hoy sale <strong>{money(calc.total)}</strong> y el documento guardado dice {money(doc.total)}. Guarda para actualizarlo.
            </Note>
          ) : null}

          {doc && cat ? (
            <>
              {partidas.map((p, i) => (
                <Partida
                  key={i}
                  cat={cat}
                  p={p}
                  filas={porPartida[i] ?? []}
                  edita={edita}
                  puedeTarifas={ficha.puedeTarifas}
                  onCantidad={(patch) => cambiar((c) => { c[i] = { ...c[i], ...patch } as PartidaCotizador; })}
                  onQuitar={() => cambiar((c) => { c.splice(i, 1); })}
                  onPrecio={(f, valor) => cambiar((c) => ponerPrecio(cat, c, i, f.clase, valor))}
                  onTarifa={(f, valor) => corregirTarifa(i, f, valor)}
                />
              ))}
              {!partidas.length ? <Note tone="warn" icon="ph-warning">La cotización se quedó sin partidas: agrega al menos una.</Note> : null}
              {edita ? <AgregarPartida cat={cat} onAgregar={(p) => cambiar((c) => { c.push(...conZonaDeLaObra(cat, [p], ficha.solicitud.obra?.municipality)); })} /> : null}
              <Opciones cat={cat} opciones={opciones} edita={edita} onCambio={(o) => { setOpciones(o); setSucio(true); }} />
            </>
          ) : ficha.formulario ? (
            <FilasFormulario
              quoteId={id}
              filas={ficha.formulario.filas}
              edita={ficha.modo === 'editar'}
              puedeTarifas={ficha.puedeTarifas}
              onListo={async () => { await cargar(); router.refresh(); }}
            />
          ) : (
            <Note tone="info" icon="ph-info">Llegó sin renglones con precio. Ponle el precio al mandarlo.</Note>
          )}
        </div>

        <aside className="fc-aside" id="fc-aside">
          <Panel>
            <h3 style={{ margin: '0 0 10px', fontSize: 11.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--adm-faint)' }}>Resumen</h3>
            {calc ? (
              <>
                {calc.desglose.renta > 0 ? <div className="fc-tot"><span>Renta de equipos</span><b className="adm-num">{money(calc.desglose.renta)}</b></div> : null}
                {calc.desglose.servicios > 0 ? <div className="fc-tot"><span>Servicios</span><b className="adm-num">{money(calc.desglose.servicios)}</b></div> : null}
                {calc.desglose.materiales > 0 ? <div className="fc-tot"><span>Materiales</span><b className="adm-num">{money(calc.desglose.materiales)}</b></div> : null}
                {calc.desglose.fletes > 0 ? <div className="fc-tot"><span>Fletes</span><b className="adm-num">{money(calc.desglose.fletes)}</b></div> : null}
                <div className="fc-tot"><span>Subtotal</span><b className="adm-num">{money(calc.subtotal)}</b></div>
                <div className="fc-tot"><span>{calc.con_iva ? `IVA ${Math.round(calc.iva_tasa * 100)}%` : 'Sin IVA (remisionado)'}</span><b className="adm-num">{money(calc.iva)}</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10, marginTop: 6, borderTop: '1px solid var(--adm-border)' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>Total</span>
                  <strong className="adm-num" style={{ fontSize: 22, fontWeight: 600 }}>{money(calc.total)}</strong>
                </div>
              </>
            ) : ficha.formulario ? (
              <>
                <div className="fc-tot"><span>Subtotal</span><b className="adm-num">{money(ficha.formulario.subtotal)}</b></div>
                {ficha.formulario.iva > 0 ? <div className="fc-tot"><span>IVA</span><b className="adm-num">{money(ficha.formulario.iva)}</b></div> : null}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10, marginTop: 6, borderTop: '1px solid var(--adm-border)' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>Total estimado</span>
                  <strong className="adm-num" style={{ fontSize: 22, fontWeight: 600 }}>{money(ficha.formulario.total)}</strong>
                </div>
              </>
            ) : null}
          </Panel>

          {(doc && edita) || (!doc && datos) ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <Btn variant="primary" icon="ph-floppy-disk" onClick={guardar} disabled={guardando || (!!doc && !partidas.length) || (!conCambios && !desactualizado)}>
                {guardando ? 'Guardando…' : doc && ficha.modo === 'nueva_version' ? 'Guardar como versión nueva' : 'Guardar cambios'}
              </Btn>
              {conCambios ? <Btn variant="ghost" onClick={() => void cargar()} disabled={guardando}>Descartar cambios</Btn> : null}
            </div>
          ) : null}

          {s.status === 'pending' && !s.aceptada ? (
            <div style={{ display: 'grid', gap: 6 }}>
              {conCambios ? <p style={{ margin: 0, fontSize: 12.5, color: 'var(--adm-warn)' }}>Guarda los cambios antes de mandarle el precio.</p> : (
                <QuoteRespond
                  quoteId={s.id}
                  subtotal={s.subtotal}
                  freight={s.freightCost}
                  tax={s.tax}
                  documento={doc?.folio ?? null}
                  totalDocumento={ficha.partes.length > 1 ? ficha.partes.reduce((t, p) => t + p.total, 0) : undefined}
                  principal
                  onListo={async () => { await cargar(); }}
                />
              )}
            </div>
          ) : null}
        </aside>
      </div>
      {/* Solo en tableta y teléfono (ver .fc-barra-movil). */}
      {calc || ficha.formulario ? (
        <div className="fc-barra-movil">
          <span style={{ fontSize: 13, color: 'var(--adm-muted)' }}>{calc ? 'Total' : 'Total estimado'} <b className="adm-num">{money(calc ? calc.total : ficha.formulario!.total)}</b></span>
          <Btn size="sm" variant="primary" onClick={() => document.getElementById('fc-aside')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            {conCambios ? 'Guardar cambios' : s.status === 'pending' && !s.aceptada ? 'Mandar precio' : 'Ver resumen'} <i className="ph ph-arrow-down" aria-hidden />
          </Btn>
        </div>
      ) : null}
    </div>
  );
}

const fechaLarga = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const OBRA_NUEVA = '__nueva__';

/**
 * Editar los datos de la entrega: la obra (otra de su empresa o una nueva), la
 * fecha de inicio o entrega, a quién va dirigida, el teléfono y las notas que
 * salen en el documento. Se aplican con "Guardar cambios".
 */
function EditarEntrega({ ficha, datos, conDocumento, onCambio, onListo }: {
  ficha: Ficha;
  datos: DatosEdit;
  conDocumento: boolean;
  onCambio: (d: DatosEdit) => void;
  onListo: () => void;
}) {
  const set = (patch: Partial<DatosEdit>) => onCambio({ ...datos, ...patch });
  const campo: React.CSSProperties = { display: 'grid', gap: 5, fontSize: 12.5, color: 'var(--adm-text-2)' };
  const valorObra = datos.nueva ? OBRA_NUEVA : datos.obraId ? String(datos.obraId) : '';
  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--adm-border)', display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <label style={campo}>
          Obra
          <AdminSelect
            ariaLabel="Obra"
            value={valorObra}
            placeholder="Elige la obra…"
            onChange={(v) => set(v === OBRA_NUEVA ? { obraId: null, nueva: { nombre: '', direccion: '', municipio: '' } } : { obraId: Number(v) || null, nueva: null })}
            options={[
              ...ficha.obras.map((o) => ({ value: String(o.id), label: `${o.name}${o.municipality ? ` · ${o.municipality}` : ''}` })),
              { value: OBRA_NUEVA, label: 'Obra nueva…' },
            ]}
          />
        </label>
        {/* Un div y no un label: dentro de un label, el clic en el calendario no llegaba. */}
        <div style={campo}>
          Fecha de inicio o entrega
          <AdminDatePicker value={datos.fechaInicio} onChange={(v) => set({ fechaInicio: v })} placeholder="Sin fecha" aria-label="Fecha de inicio o entrega" />
        </div>
        {conDocumento ? (
          <label style={campo}>
            Atención a
            <input className="adm-input" value={datos.atencion} maxLength={190} onChange={(e) => set({ atencion: e.target.value })} placeholder="Ing. / Lic." />
          </label>
        ) : null}
        <label style={campo}>
          Teléfono de contacto
          <input className="adm-input" inputMode="tel" value={datos.telefono} maxLength={40} onChange={(e) => set({ telefono: e.target.value })} />
        </label>
      </div>
      {datos.nueva ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <label style={campo}>
            Nombre de la obra nueva
            <input className="adm-input" value={datos.nueva.nombre} maxLength={190} onChange={(e) => set({ nueva: { ...datos.nueva!, nombre: e.target.value } })} placeholder="Ej. Bodega Escobedo" />
          </label>
          <label style={campo}>
            Dirección
            <input className="adm-input" value={datos.nueva.direccion} maxLength={300} onChange={(e) => set({ nueva: { ...datos.nueva!, direccion: e.target.value } })} placeholder="Calle, número y colonia" />
          </label>
          <label style={campo}>
            Municipio
            <input className="adm-input" value={datos.nueva.municipio} maxLength={120} onChange={(e) => set({ nueva: { ...datos.nueva!, municipio: e.target.value } })} placeholder="Ej. Apodaca" />
          </label>
        </div>
      ) : null}
      {conDocumento ? (
        <label style={campo}>
          Notas para el cliente (salen en el documento)
          <textarea className="adm-textarea" rows={2} value={datos.notas} maxLength={2000} onChange={(e) => set({ notas: e.target.value })} placeholder="Vigencia, condiciones especiales, contacto en obra…" />
        </label>
      ) : null}
      <div><Btn size="sm" onClick={onListo}>Listo</Btn></div>
    </div>
  );
}

/** Dirección y municipio de la obra, sin repetir el municipio si ya viene en la dirección. */
function dondeObra(o: { address: string | null; municipality: string | null }): string {
  const dir = (o.address ?? '').trim();
  const mun = (o.municipality ?? '').trim();
  if (!mun || dir.toLowerCase().includes(mun.toLowerCase())) return dir;
  return [dir, mun].filter(Boolean).join(' · ');
}

/* ── Una partida: cantidades y sus renglones ─────────────────────────── */

function nombreDePartida(cat: CatalogoCotizador, p: PartidaCotizador): string {
  if (cat.tipo === 'maquinaria') {
    if (p.tipo === 'equipo') return equipoDe(cat, p.id)?.nombre ?? 'Equipo que ya no está en el tabulador';
    if (p.tipo === 'servicio') return servicioDe(cat, p.id)?.nombre ?? 'Servicio que ya no está en el tabulador';
  } else {
    if (p.tipo === 'material') return productoDe(cat, p.id)?.nombre ?? p.nombre ?? 'Material';
    if (p.tipo === 'zona') return `${productoDe(cat, p.producto_id)?.nombre ?? 'Material'} · ${zonaDe(cat, p.zona_id)?.nombre ?? 'zona'}`;
    if (p.tipo === 'banco') return cat.material_banco.nombre;
  }
  return 'Partida';
}

/** Un número que se puede borrar mientras se escribe: se manda al salir del campo. */
function Num({ valor, onCambio, label, min = 0, max, entero = true, disabled }: {
  valor: number; onCambio: (n: number) => void; label: string; min?: number; max?: number; entero?: boolean; disabled?: boolean;
}) {
  const [texto, setTexto] = useState(String(valor));
  useEffect(() => { setTexto(String(valor)); }, [valor]);
  const confirmarValor = () => {
    let n = Number(texto.replace(',', '.'));
    if (!Number.isFinite(n)) n = valor;
    n = Math.max(min, max !== undefined ? Math.min(max, n) : n);
    if (entero) n = Math.round(n);
    setTexto(String(n));
    if (n !== valor) onCambio(n);
  };
  return (
    <label>
      {label}
      <input
        className="adm-input"
        inputMode={entero ? 'numeric' : 'decimal'}
        value={texto}
        disabled={disabled}
        onChange={(e) => setTexto(e.target.value.replace(/[^\d.,]/g, ''))}
        onBlur={confirmarValor}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        aria-label={label}
      />
    </label>
  );
}

function Partida({ cat, p, filas, edita, puedeTarifas, onCantidad, onQuitar, onPrecio, onTarifa }: {
  cat: CatalogoCotizador;
  p: PartidaCotizador;
  filas: FilaExplicada[];
  edita: boolean;
  puedeTarifas: boolean;
  onCantidad: (patch: Record<string, number | string>) => void;
  onQuitar: () => void;
  onPrecio: (f: FilaExplicada, valor: number) => void;
  onTarifa: (f: FilaExplicada, valor: number) => Promise<boolean>;
}) {
  const importe = filas.reduce((s, f) => s + f.importe, 0);
  const jornada = cat.tipo === 'maquinaria' ? cat.jornada_horas : 8;
  // El agua se cobra por zona (2026-10-29): sus zonas, para elegir a cuál se lleva.
  const sv = cat.tipo === 'maquinaria' && p.tipo === 'servicio' ? servicioDe(cat, p.id) : null;
  const zonasAgua = cat.tipo === 'maquinaria' && sv && porZona(sv) ? zonasDelServicio(cat, sv) : [];
  return (
    <div className="fc-part">
      <div className="fc-part-h">
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600 }}>{nombreDePartida(cat, p)}</div>
          {p.tipo === 'equipo' && cat.tipo === 'maquinaria' ? (
            <div style={{ fontSize: 12, color: 'var(--adm-muted)', marginTop: 2 }}>Por hora · jornada de {jornada} h · mínimo {minimoHorasDe(cat)} h por equipo</div>
          ) : null}
        </div>
        <div className="fc-cant">
          {p.tipo === 'equipo' ? (
            <>
              <Num label="Días" valor={p.dias ?? 0} onCambio={(n) => onCantidad({ dias: n })} max={3650} disabled={!edita} />
              <Num label="Horas extra" valor={p.horas ?? 0} onCambio={(n) => onCantidad({ horas: n })} max={jornada - 1} disabled={!edita} />
              <Num label="Equipos" valor={p.cantidad ?? 1} onCambio={(n) => onCantidad({ cantidad: n })} min={1} max={99} disabled={!edita} />
            </>
          ) : p.tipo === 'servicio' ? (
            <>
              <Num label={`Cantidad (${(cat.tipo === 'maquinaria' && servicioDe(cat, p.id)?.unidad) || 'viajes'})`} valor={p.cantidad ?? 1} onCambio={(n) => onCantidad({ cantidad: n })} min={1} max={999} disabled={!edita} />
              {zonasAgua.length ? (
                <label>
                  Zona
                  <AdminSelect
                    size="sm"
                    ariaLabel="Zona de la obra"
                    value={p.zona ?? ''}
                    placeholder="Elige la zona…"
                    disabled={!edita}
                    onChange={(v) => v && onCantidad({ zona: v })}
                    options={zonasAgua.map((z) => ({ value: z.id, label: z.nombre }))}
                  />
                </label>
              ) : null}
            </>
          ) : p.tipo === 'material' ? (
            <Num label="Toneladas" valor={p.toneladas ?? 0} onCambio={(n) => onCantidad({ toneladas: n })} entero={false} max={1_000_000} disabled={!edita} />
          ) : p.tipo === 'zona' ? (
            <Num label="Viajes" valor={p.viajes ?? 1} onCambio={(n) => onCantidad({ viajes: n })} min={1} max={999} disabled={!edita} />
          ) : p.tipo === 'banco' ? (
            <Num label="m³" valor={p.m3 ?? 0} onCambio={(n) => onCantidad({ m3: n })} entero={false} max={1_000_000} disabled={!edita} />
          ) : null}
          {edita ? <IconBtn icon="ph-trash" label={`Quitar ${nombreDePartida(cat, p)}`} danger onClick={onQuitar} /> : null}
        </div>
      </div>
      {filas.length ? filas.map((f, j) => (
        <Renglon key={j} f={f} edita={edita} puedeTarifas={puedeTarifas} onPrecio={(v) => onPrecio(f, v)} onTarifa={(v) => onTarifa(f, v)} />
      )) : (
        <div className="fc-ren" style={{ color: 'var(--adm-warn)', fontSize: 13 }}>Sin cantidad, no suma nada: ponle días, viajes o toneladas.</div>
      )}
      {filas.length > 1 ? (
        <div className="fc-ren" style={{ justifyContent: 'flex-end', fontSize: 13, color: 'var(--adm-muted)' }}>
          Esta partida: <strong className="adm-num" style={{ color: 'var(--adm-text)', marginLeft: 6 }}>{money(importe)}</strong>
        </div>
      ) : null}
    </div>
  );
}

/** Un renglón con su precio y el lápiz (solo esta cotización / corregir la tarifa). */
function Renglon({ f, edita, puedeTarifas, onPrecio, onTarifa }: {
  f: FilaDesglose;
  edita: boolean;
  puedeTarifas: boolean;
  onPrecio: (valor: number) => void;
  onTarifa: (valor: number) => Promise<boolean>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const v = Number(valor);
  const valido = Number.isFinite(v) && v > 0;
  return (
    <div className="fc-ren" style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{f.concepto}</div>
          <div style={{ fontSize: 12, color: 'var(--adm-muted)', marginTop: 3, lineHeight: 1.45 }}>
            {f.negociado ? <Chip tone="info" style={{ marginRight: 6 }}>Especial</Chip> : null}
            {f.fuente}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="adm-num" style={{ fontSize: 14, fontWeight: 600 }}>{money(f.importe)}</div>
          <div className="adm-num" style={{ fontSize: 12, color: 'var(--adm-muted)', marginTop: 2 }}>{cantidad(f.cantidad)} {f.unidad.toLowerCase()} × {money(f.pu)}</div>
        </div>
        {edita && f.edicion ? (
          <IconBtn icon="ph-pencil-simple" label={`Cambiar el precio de ${f.concepto}`} plain onClick={() => { setAbierto(!abierto); setValor(String(f.edicion?.valor ?? '')); }} style={{ marginTop: -4 }} />
        ) : null}
      </div>
      {abierto && f.edicion ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--adm-text-2)' }}>
            Precio {f.edicion.unidad}
            <input className="adm-input" inputMode="decimal" autoFocus value={valor} style={{ width: 160 }}
              onChange={(e) => setValor(e.target.value.replace(/[^\d.]/g, ''))} aria-label={`Precio ${f.edicion.unidad}`} />
          </label>
          <Btn size="sm" disabled={!valido} onClick={() => { onPrecio(v); setAbierto(false); }}>Solo esta cotización</Btn>
          <Btn size="sm" variant="primary" disabled={!valido || ocupado || !puedeTarifas || f.edicion.tarifa === null}
            title={!puedeTarifas ? 'Corregir tarifas es del módulo Tarifas (Dirección).' : f.edicion.tarifa === null ? 'Este precio no sale de una tarifa.' : undefined}
            onClick={async () => { setOcupado(true); const ok = await onTarifa(v); setOcupado(false); if (ok) setAbierto(false); }}>
            Corregir la tarifa
          </Btn>
          <Btn size="sm" variant="ghost" onClick={() => setAbierto(false)}>Cancelar</Btn>
          {f.edicion.tarifa !== null ? (
            <span style={{ fontSize: 12, color: 'var(--adm-muted)', flexBasis: '100%' }}>
              La tarifa hoy: {money(f.edicion.tarifa)} {f.edicion.unidad}{f.edicion.usos && f.edicion.usos > 1 ? ` · la usan ${f.edicion.usos} equipos` : ''}.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ── Agregar otra partida del tabulador ──────────────────────────────── */

function AgregarPartida({ cat, onAgregar }: { cat: CatalogoCotizador; onAgregar: (p: PartidaCotizador) => void }) {
  const opciones = cat.tipo === 'maquinaria'
    ? [
        ...cat.equipos.filter((e) => !e.oculto).map((e) => ({ value: `equipo:${e.id}`, label: `Equipo · ${e.nombre}` })),
        ...cat.servicios.filter((s) => !s.oculto).map((s) => ({ value: `servicio:${s.id}`, label: `Servicio · ${s.nombre}` })),
      ]
    : [
        ...cat.productos.filter((p) => !p.oculto).map((p) => ({ value: `material:${p.id}`, label: `Material por tonelada · ${p.nombre}` })),
        ...(cat.material_banco.precio_m3_default > 0 ? [{ value: 'banco:', label: `${cat.material_banco.nombre} (por m³)` }] : []),
      ];
  const agregar = (v: string) => {
    const [tipo, id] = v.split(':');
    if (tipo === 'equipo') onAgregar({ tipo: 'equipo', id, dias: 1, horas: 0, cantidad: 1, precio_hora: null });
    else if (tipo === 'servicio') onAgregar({ tipo: 'servicio', id, precio: 0, cantidad: 1 });
    else if (tipo === 'material') onAgregar({ tipo: 'material', id, toneladas: 1, flete_ton: 0 });
    else if (tipo === 'banco') onAgregar({ tipo: 'banco', precio_m3: 0, m3: 1 });
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 13, color: 'var(--adm-muted)' }}>Agregar partida</span>
      <AdminSelect size="sm" className="w-auto min-w-[320px]" ariaLabel="Agregar partida del tabulador" placeholder="Elige del tabulador…" value="" onChange={(v) => v && agregar(v)} options={opciones} />
    </div>
  );
}

function Opciones({ cat, opciones, edita, onCambio }: {
  cat: CatalogoCotizador;
  opciones: Partial<OpcionesCotizador>;
  edita: boolean;
  onCambio: (o: Partial<OpcionesCotizador>) => void;
}) {
  if (cat.tipo === 'maquinaria') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13, color: 'var(--adm-muted)' }}>
        Presentar cantidades en
        <AdminSelect size="sm" className="w-auto min-w-[150px]" ariaLabel="Presentar cantidades en" disabled={!edita}
          value={opciones.modo_unidad ?? 'horas'} onChange={(v) => onCambio({ ...opciones, modo_unidad: v as 'horas' | 'dias' })}
          options={[{ value: 'horas', label: 'Horas' }, { value: 'dias', label: 'Jornadas (días)' }]} />
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13, color: 'var(--adm-muted)' }}>
      Facturación
      <AdminSelect size="sm" className="w-auto min-w-[200px]" ariaLabel="Facturación" disabled={!edita}
        value={(opciones.con_iva ?? cat.iva_por_defecto) ? 'si' : 'no'} onChange={(v) => onCambio({ ...opciones, con_iva: v === 'si' })}
        options={[{ value: 'si', label: `Con factura (IVA ${Math.round(cat.iva * 100)}%)` }, { value: 'no', label: 'Remisionado, sin IVA' }]} />
    </div>
  );
}

/* ── Solicitud del formulario: sus renglones, cantidad y precio ─────────── */

function FilasFormulario({ quoteId, filas, edita, puedeTarifas, onListo }: {
  quoteId: number;
  filas: FilaDesglose[];
  edita: boolean;
  puedeTarifas: boolean;
  onListo: () => Promise<void>;
}) {
  const [abierta, setAbierta] = useState<number | null>(null);
  const [precio, setPrecio] = useState('');
  const [cant, setCant] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function guardar(fila: number, f: FilaDesglose, alcance: 'esta' | 'tarifa') {
    const valor = Number(precio);
    const unidades = Number(cant);
    if (!Number.isFinite(valor) || valor <= 0) { mostrarResultado('Escribe un precio mayor a cero.', 'bad'); return; }
    if (alcance === 'tarifa') {
      const ok = await confirmar({
        titulo: 'Corregir la tarifa',
        mensaje: <>El precio de <strong>{f.concepto}</strong> pasa a {money(valor)} {f.edicion?.unidad} en su ficha, y las solicitudes que siguen por cotizar con ella se recalculan.</>,
        confirmar: 'Corregir la tarifa',
      });
      if (!ok) return;
    }
    setOcupado(true);
    const r = await fetch(`/api/admin/quotes/${quoteId}/precio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fila, valor, alcance, cantidad: Number.isFinite(unidades) && unidades > 0 ? unidades : null }),
    }).catch(() => null);
    const b = await r?.json().catch(() => null);
    setOcupado(false);
    if (!r?.ok) { mostrarResultado(b?.message ?? 'No se pudo guardar.', 'bad'); return; }
    setAbierta(null);
    mostrarResultado(alcance === 'esta' ? 'Guardado en esta cotización' : 'Tarifa corregida', 'ok');
    await onListo();
  }

  return (
    <div className="fc-part">
      {filas.map((f, i) => (
        <div key={i} className="fc-ren" style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{f.concepto}</div>
              <div style={{ fontSize: 12, color: 'var(--adm-muted)', marginTop: 3 }}>
                {f.negociado ? <Chip tone="info" style={{ marginRight: 6 }}>Especial</Chip> : null}{f.fuente}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="adm-num" style={{ fontSize: 14, fontWeight: 600 }}>{money(f.importe)}</div>
              <div className="adm-num" style={{ fontSize: 12, color: 'var(--adm-muted)', marginTop: 2 }}>{cantidad(f.cantidad)} {f.unidad.toLowerCase()} × {money(f.pu)}</div>
            </div>
            {edita && f.edicion ? (
              <IconBtn icon="ph-pencil-simple" label={`Cambiar ${f.concepto}`} plain style={{ marginTop: -4 }}
                onClick={() => { setAbierta(abierta === i ? null : i); setPrecio(String(f.edicion?.valor || '')); setCant(String(f.cantidad)); }} />
            ) : null}
          </div>
          {abierta === i && f.edicion ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--adm-text-2)' }}>
                Cantidad
                <input className="adm-input" inputMode="decimal" value={cant} style={{ width: 110 }} onChange={(e) => setCant(e.target.value.replace(/[^\d.]/g, ''))} aria-label="Cantidad" />
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--adm-text-2)' }}>
                Precio {f.edicion.unidad}
                <input className="adm-input" inputMode="decimal" autoFocus value={precio} style={{ width: 150 }} onChange={(e) => setPrecio(e.target.value.replace(/[^\d.]/g, ''))} aria-label={`Precio ${f.edicion.unidad}`} />
              </label>
              <Btn size="sm" disabled={ocupado} onClick={() => guardar(i, f, 'esta')}>Solo esta cotización</Btn>
              <Btn size="sm" variant="primary" disabled={ocupado || !puedeTarifas || f.edicion.tarifa === null}
                title={!puedeTarifas ? 'Corregir tarifas es del módulo Tarifas (Dirección).' : undefined}
                onClick={() => guardar(i, f, 'tarifa')}>Corregir la tarifa</Btn>
              <Btn size="sm" variant="ghost" onClick={() => setAbierta(null)}>Cancelar</Btn>
            </div>
          ) : null}
        </div>
      ))}
      {!filas.length ? <div className="fc-ren" style={{ fontSize: 13, color: 'var(--adm-muted)' }}>Llegó sin renglones con precio: ponle el precio al mandarlo.</div> : null}
    </div>
  );
}
