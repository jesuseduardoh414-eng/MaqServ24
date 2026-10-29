'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  COTIZADORES_META,
  cobraFlete,
  minimoHorasDe,
  precioHoraDe,
  type CatalogoCotizador,
  type CatalogoMaquinaria,
  type CatalogoTriturados,
  type CotizadorTipo,
} from '@maqserv/config';
import { mostrarResultado } from '@maqserv/ui';
import { Btn, Chip, FormField, IconBtn, Panel, Segmented, Stat, Stats, Switch } from '@/components/ui';
import { confirmar } from '@/components/Dialogos';
import { AdminSelect } from '@/components/AdminSelect';

/**
 * TABULADOR DE LOS COTIZADORES.
 *
 * Esta pantalla es la razón de haber traído los cotizadores a la plataforma.
 * En el sistema del que vienen, cambiar el precio de una excavadora exigía
 * editar un `catalogo.json` por FTP y reiniciar el servicio: en la práctica lo
 * hacía el programador, no quien pone los precios.
 *
 * Se guarda el documento COMPLETO, no campo por campo. Es deliberado: el
 * tabulador se lee entero (una tarifa no se entiende sin su flete ni sin sus
 * condiciones), y con parches sueltos dos personas editando a la vez dejarían
 * una mezcla que ninguna de las dos escribió.
 *
 * DESDE EL 2026-10-19 LOS RENGLONES SON DE SU FICHA. Equipos, servicios y
 * materiales se dan de alta y se les pone precio en su ficha de Inventario;
 * aquí solo se ven, con el enlace para editarlos ahí.
 *
 * POR PESTAÑAS (2026-10-28, revisión del módulo). "Solo hace falta mejor
 * diseño y acomodo": eran diez cajas iguales una debajo de otra, con los datos
 * del documento repetidos en los dos cotizadores. Ahora: Maquinaria,
 * Triturados, Condiciones y Documento. El documento (razón social, firma,
 * IVA…) se captura UNA vez y se guarda en los dos tabuladores; las listas de
 * solo lectura van compactas; y el margen de productos se fue a Inventario.
 */
export interface FichaDeRenglon {
  id: number;
  nombre: string;
  activa: boolean;
}

type Pestana = 'maquinaria' | 'triturados' | 'condiciones' | 'documento';
const PESTANAS: Pestana[] = ['maquinaria', 'triturados', 'condiciones', 'documento'];
const esPestana = (v: string | null): v is Pestana => PESTANAS.includes(v as Pestana);

/** Qué tabulador guarda cada pestaña: Condiciones y Documento tocan los dos. */
const GUARDA: Record<Pestana, CotizadorTipo[]> = {
  maquinaria: ['maquinaria'],
  triturados: ['triturados'],
  condiciones: ['maquinaria', 'triturados'],
  documento: ['maquinaria', 'triturados'],
};

const money = (n: number) => `$${Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;

export function TarifasEditor({ inicial }: { inicial: Record<CotizadorTipo, CatalogoCotizador> }) {
  const router = useRouter();
  const sp = useSearchParams();
  const pestana: Pestana = esPestana(sp.get('p')) ? (sp.get('p') as Pestana) : 'maquinaria';
  const [cats, setCats] = useState(inicial);
  const [guardados, setGuardados] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  /** El último error al guardar, en la barra: un aviso que se va no basta para corregir un RFC. */
  const [error, setError] = useState<string | null>(null);

  // null mientras carga: así no parpadea "Sin ficha" en cada renglón.
  const [fichas, setFichas] = useState<Partial<Record<CotizadorTipo, Record<string, FichaDeRenglon | null>>>>({});
  useEffect(() => {
    let vivo = true;
    for (const t of ['maquinaria', 'triturados'] as CotizadorTipo[]) {
      void fetch(`/api/admin/quoter/catalog/${t}/fichas`)
        .then((r) => (r.ok ? r.json() : {}))
        .then((d: Record<string, FichaDeRenglon | null>) => { if (vivo) setFichas((f) => ({ ...f, [t]: d ?? {} })); })
        .catch(() => undefined);
    }
    return () => { vivo = false; };
  }, []);

  const setDe = (t: CotizadorTipo) => (patch: Partial<CatalogoCotizador>) =>
    setCats((prev) => ({ ...prev, [t]: { ...prev[t], ...patch } as CatalogoCotizador }));

  /** Lo que es de MAQSER24 (documento, IVA, versión) se escribe en los dos tabuladores a la vez. */
  const setComun = (patch: Partial<CatalogoCotizador>) =>
    setCats((prev) => ({
      maquinaria: { ...prev.maquinaria, ...patch } as CatalogoCotizador,
      triturados: { ...prev.triturados, ...patch } as CatalogoCotizador,
    }));

  const sucios = useMemo(
    () => GUARDA[pestana].filter((t) => JSON.stringify(cats[t]) !== JSON.stringify(guardados[t])),
    [cats, guardados, pestana],
  );
  const hayCambios = sucios.length > 0;

  // Cambios sin guardar: avisar al cerrar la pestaña del navegador.
  useEffect(() => {
    const algo = (['maquinaria', 'triturados'] as CotizadorTipo[]).some((t) => JSON.stringify(cats[t]) !== JSON.stringify(guardados[t]));
    if (!algo) return;
    const f = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [cats, guardados]);

  function irA(p: Pestana) {
    router.replace(p === 'maquinaria' ? '/cotizador/tarifas' : `/cotizador/tarifas?p=${p}`, { scroll: false });
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      for (const t of sucios) {
        const res = await fetch(`/api/admin/quoter/catalog/${t}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cats[t]),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.message ?? 'No se pudo guardar.');
        setCats((prev) => ({ ...prev, [t]: body as CatalogoCotizador }));
        setGuardados((prev) => ({ ...prev, [t]: body as CatalogoCotizador }));
      }
      mostrarResultado('Guardado. Las cotizaciones nuevas ya usan estos datos.', 'ok');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  async function restaurar(t: CotizadorTipo) {
    const nombre = COTIZADORES_META[t].titulo.toLowerCase();
    if (!(await confirmar({ titulo: `¿Volver al tabulador de fábrica de ${nombre}?`, mensaje: 'Vuelven a su valor de fábrica los datos del documento, las condiciones, el cobro por hora, los fletes y las zonas de este cotizador. El precio de cada tipo no se toca: vive en su ficha.', confirmar: 'Restaurar', peligro: true }))) return;
    setGuardando(true);
    try {
      const res = await fetch(`/api/admin/quoter/catalog/${t}/reset`, { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message ?? 'No se pudo restaurar.');
      setCats((prev) => ({ ...prev, [t]: body as CatalogoCotizador }));
      setGuardados((prev) => ({ ...prev, [t]: body as CatalogoCotizador }));
      mostrarResultado(`Tabulador de ${nombre} restaurado a los valores de fábrica.`, 'ok');
    } catch (e) {
      mostrarResultado(e instanceof Error ? e.message : 'No se pudo restaurar.', 'bad');
    } finally {
      setGuardando(false);
    }
  }

  const maq = cats.maquinaria as CatalogoMaquinaria;
  const tri = cats.triturados as CatalogoTriturados;
  const textoGuardar = pestana === 'maquinaria' ? 'Guardar maquinaria' : pestana === 'triturados' ? 'Guardar triturados' : pestana === 'condiciones' ? 'Guardar condiciones' : 'Guardar documento';

  return (
    <div>
      <style>{`
        /* Tablas compactas de solo lectura y de captura. */
        .tf-tabla .adm-thead, .tf-tabla .adm-trow { display: grid; gap: 12px; align-items: center; padding-left: 16px; padding-right: 16px; }
        .tf-tabla .adm-trow { padding-top: 9px; padding-bottom: 9px; }
        .tf-lista .adm-thead, .tf-lista .adm-trow { grid-template-columns: minmax(0, 1.6fr) minmax(0, 1.4fr) minmax(0, 1fr) 36px; }
        .tf-fletes .adm-thead, .tf-fletes .adm-trow { grid-template-columns: minmax(0, 1fr) 160px; }
        .tf-zonas .adm-thead, .tf-zonas .adm-trow { grid-template-columns: minmax(0, 1fr) 150px 36px; }
        .tf-tabla .adm-input { height: 34px; font-size: 13.5px; }
        .tf-nombre { font-size: 13.5px; font-weight: 500; color: var(--adm-text); min-width: 0; }
        .tf-sub { font-size: 12.5px; color: var(--adm-muted); }
        .tf-dos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; align-items: stretch; }
        /* Sin el margen que un panel pone al seguir a otro: aquí van lado a lado. */
        .tf-dos > .adm-panel { display: flex; flex-direction: column; margin-top: 0; }
        .tf-dos > .adm-panel > .adm-panel-head { min-height: 68px; }
        .tf-dos > .adm-panel > .adm-panel-body { flex: 1; }
        /* Un renglón de captura suelto dentro de una tabla (la jornada, las toneladas por viaje). */
        .tf-tabla .tf-suelto { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 16px; border-bottom: 1px solid var(--adm-border); }
        .tf-tabla .tf-suelto .adm-input { width: 90px; height: 34px; font-size: 13.5px; }
        .tf-pesos { position: relative; }
        .tf-pesos::before { content: '$'; position: absolute; left: 11px; top: 50%; transform: translateY(-50%); font-size: 13px; color: var(--adm-muted); pointer-events: none; }
        .tf-pesos .adm-input { padding-left: 22px; }
        .tf-pct { position: relative; }
        .tf-pct::after { content: '%'; position: absolute; right: 11px; top: 50%; transform: translateY(-50%); font-size: 13px; color: var(--adm-muted); pointer-events: none; }
        /* Condiciones: cada bloque plegado con su título; abierto, sus puntos. */
        .tf-cond { border: 1px solid var(--adm-border); border-radius: 10px; }
        .tf-cond + .tf-cond { margin-top: 10px; }
        .tf-cond > summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 10px; padding: 12px 16px; font-size: 13.5px; font-weight: 600; color: var(--adm-text); }
        .tf-cond > summary::-webkit-details-marker { display: none; }
        .tf-cond > summary i { color: var(--adm-muted); transition: transform .15s ease; }
        .tf-cond[open] > summary i { transform: rotate(90deg); }
        .tf-cond > summary .tf-sub { font-weight: 400; margin-left: auto; }
        .tf-cond-cuerpo { padding: 0 16px 16px; display: grid; gap: 12px; border-top: 1px solid var(--adm-border); padding-top: 14px; }
        .tf-barra { position: sticky; bottom: -56px; z-index: 2; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin: 20px 0 -56px; padding: 14px 0 70px; background: var(--adm-page); border-top: 1px solid var(--adm-border); }
        .tf-aviso { font-size: 13px; color: var(--adm-muted); margin-left: 4px; }
        .tf-aviso[data-on="true"] { color: var(--adm-warn); }
        .tf-aviso[data-error="true"] { color: var(--adm-bad); }
        @media (max-width: 760px) {
          /* En el teléfono la barra es una sola línea: el aviso va en chico y el botón de restaurar sin texto largo. */
          .tf-barra { gap: 8px; bottom: -40px; margin-bottom: -40px; padding: 10px 0 48px; }
          .tf-barra .adm-btn { height: 34px; padding: 0 12px; font-size: 13px; }
          .tf-barra .tf-aviso { flex: 1 1 100%; margin: 0; font-size: 12px; line-height: 1.35; }
          /* Sin cambios ni error, el aviso sobra; y "Restaurar" en corto (2026-10-28). */
          .tf-barra .tf-aviso[data-on="false"][data-error="false"] { display: none; }
          .tf-barra .tf-largo { display: none; }
          .tf-barra .tf-corto { display: inline !important; }
          .tf-dos { grid-template-columns: minmax(0, 1fr); }
          .tf-lista .adm-thead { display: none; }
          .tf-lista .adm-trow { grid-template-columns: minmax(0, 1fr) 36px; }
          .tf-lista .adm-trow > :nth-child(2), .tf-lista .adm-trow > :nth-child(3) { grid-column: 1; }
        }
      `}</style>

      {/* De un vistazo, sin bajar. */}
      <Stats>
        <Stat label="Equipos en el cotizador" icon="ph-crane" tone="info" value={maq.equipos.filter((e) => !e.oculto).length} hint={maq.equipos.some((e) => e.oculto) ? `${maq.equipos.filter((e) => e.oculto).length} ocultos` : undefined} />
        <Stat label="Servicios" icon="ph-truck" tone="info" value={maq.servicios.filter((s) => !s.oculto).length} />
        <Stat label="Materiales" icon="ph-cube" tone="info" value={tri.productos.filter((p) => !p.oculto).length} hint={`${tri.zonas.length} zonas de entrega`} />
        <Stat label="IVA" icon="ph-percent" tone="muted" value={`${Math.round(maq.iva * 100)} %`} hint={`versión ${maq.version}`} />
      </Stats>

      <div style={{ marginBottom: 20 }}>
        <Segmented<Pestana>
          ariaLabel="Parte del tabulador"
          value={pestana}
          onChange={irA}
          items={[
            { key: 'maquinaria', label: 'Maquinaria' },
            { key: 'triturados', label: 'Triturados' },
            { key: 'condiciones', label: 'Condiciones' },
            { key: 'documento', label: 'Documento' },
          ]}
        />
      </div>

      {pestana === 'maquinaria' ? <EditorMaquinaria cat={maq} set={setDe('maquinaria')} fichas={fichas.maquinaria ?? null} /> : null}
      {pestana === 'triturados' ? <EditorTriturados cat={tri} set={setDe('triturados')} fichas={fichas.triturados ?? null} /> : null}
      {pestana === 'condiciones' ? <EditorCondiciones maq={maq} tri={tri} setMaq={setDe('maquinaria')} setTri={setDe('triturados')} /> : null}
      {pestana === 'documento' ? <EditorDocumento cat={maq} set={setComun} /> : null}

      {/* Barra de guardar pegada abajo: dice qué guarda y si hay cambios. */}
      <div className="tf-barra">
        <Btn variant="primary" onClick={guardar} disabled={guardando || !hayCambios}>
          {guardando ? 'Guardando…' : textoGuardar}
        </Btn>
        {pestana === 'maquinaria' || pestana === 'triturados' ? (
          <Btn variant="ghost" onClick={() => void restaurar(pestana)} disabled={guardando}><span className="tf-largo">Restaurar valores de fábrica</span><span className="tf-corto" style={{ display: 'none' }}>Restaurar</span></Btn>
        ) : null}
        <span className="tf-aviso" data-on={hayCambios} data-error={Boolean(error)} role={error ? 'alert' : undefined}>
          {error ? <><i className="ph ph-warning-circle" aria-hidden /> {error}</> : hayCambios
            ? `Hay cambios sin guardar${pestana === 'condiciones' || pestana === 'documento' ? ` (${sucios.map((t) => COTIZADORES_META[t].titulo.toLowerCase()).join(' y ')})` : ''}.`
            : 'Sin cambios. Lo que guardes aplica a las cotizaciones nuevas.'}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function EditorMaquinaria({ cat, set, fichas }: {
  cat: CatalogoMaquinaria;
  set: (p: Partial<CatalogoCotizador>) => void;
  fichas: Record<string, FichaDeRenglon | null> | null;
}) {
  const tiposFlete = Object.keys(cat.fletes);
  const conFlete = cobraFlete(cat);
  return (
    <>
      <Publicacion cat={cat} set={set} />

      <div className="tf-dos" style={{ marginTop: 20 }}>
        <Panel
          flush
          clip
          icon="ph-clock"
          title="Cobro por hora"
          desc="Cada máquina tiene un solo precio por hora, sin descuentos por semana o mes."
        >
          <div className="tf-tabla">
            <div className="tf-suelto">
              <span className="tf-nombre">Horas por jornada (un día de renta)</span>
              <input className="adm-input adm-num" type="number" min="1" max="24" value={cat.jornada_horas} onChange={(e) => set({ jornada_horas: Number(e.target.value) } as Partial<CatalogoCotizador>)} aria-label="Horas por jornada" />
            </div>
            <div className="tf-suelto">
              <span className="tf-nombre">Mínimo de horas por equipo</span>
              <input className="adm-input adm-num" type="number" min="0" max="240" value={minimoHorasDe(cat)} onChange={(e) => set({ minimo_horas: Math.max(0, Math.trunc(Number(e.target.value) || 0)) } as Partial<CatalogoCotizador>)} aria-label="Mínimo de horas por equipo" />
            </div>
            <p className="tf-sub" style={{ margin: 0, padding: '10px 16px 14px', lineHeight: 1.5 }}>
              Si piden menos del mínimo, se cobra el mínimo y la cotización lo dice. La cotización también trae la
              leyenda «Si desea negociar el costo, comuníquese a la línea de {cat.empresa.nombre || 'MAQSER24'}» con el
              teléfono de la pestaña Documento.
            </p>
          </div>
        </Panel>

        <Panel flush clip icon="ph-truck-trailer" title="Fletes por tipo de equipo" desc="Llevar y traer el equipo a obra. Se cobra una vez por equipo.">
          <div className="tf-tabla tf-fletes">
            <div className="tf-suelto">
              <span className="tf-nombre">{conFlete ? 'Se cobra el flete a obra' : 'El flete no se cobra por ahora'}</span>
              <Switch on={conFlete} onClick={() => set({ cobrar_flete: !conFlete } as Partial<CatalogoCotizador>)} ariaLabel="Cobrar el flete a obra" />
            </div>
            <div className="adm-thead"><div>Tipo de equipo</div><div>Flete</div></div>
            {tiposFlete.map((k) => (
              <div key={k} className="adm-trow" style={conFlete ? undefined : { opacity: 0.45 }}>
                <div className="tf-nombre">{k}</div>
                <div className="tf-pesos">
                  <input className="adm-input adm-num" type="number" min="0" value={cat.fletes[k]} disabled={!conFlete} onChange={(e) => set({ fletes: { ...cat.fletes, [k]: Number(e.target.value) } } as Partial<CatalogoCotizador>)} aria-label={`Flete de ${k}`} />
                </div>
              </div>
            ))}
            {!conFlete ? (
              <p className="tf-sub" style={{ margin: 0, padding: '10px 16px 14px', lineHeight: 1.5 }}>
                Ninguna máquina lo cobra y no sale en la cotización. Cada equipo conserva su tipo de flete y estos montos se
                guardan para cuando lo vuelvas a encender.
              </p>
            ) : null}
          </div>
        </Panel>
      </div>

      <ListaDelCotizador
        titulo="Equipos"
        icono="ph-crane"
        encabezados={['Equipo', 'Precio por hora', 'Flete']}
        fichas={fichas}
        filas={cat.equipos.map((eq) => ({
          id: eq.id,
          nombre: eq.nombre,
          precio: `${money(precioHoraDe(cat, eq))} / hora`,
          detalle: !conFlete
            ? `${eq.flete_tipo} · no se cobra`
            : `${eq.flete_tipo}${cat.fletes[eq.flete_tipo] !== undefined ? ` · ${money(cat.fletes[eq.flete_tipo])}` : ''}`,
          oculto: eq.oculto,
        }))}
      />

      <ListaDelCotizador
        titulo="Servicios"
        icono="ph-truck"
        encabezados={['Servicio', 'Precio', 'Condiciones']}
        fichas={fichas}
        filas={cat.servicios.map((sv) => ({
          id: sv.id,
          nombre: sv.nombre,
          // Por zona (el agua): el precio de cada zona.
          precio: sv.precios_zona && Object.keys(sv.precios_zona).length
            ? (cat.zonas_precio ?? []).filter((z) => (sv.precios_zona?.[z.id] ?? 0) > 0).map((z) => `${z.nombre} ${money(sv.precios_zona![z.id])}`).join(' · ') + ` por ${sv.unidad || 'viaje'}`
            : `${money(sv.precio)} por ${sv.unidad || 'viaje'}`,
          detalle: cat.condiciones[sv.cond]?.titulo ? tituloCorto(cat.condiciones[sv.cond].titulo) : '—',
          oculto: sv.oculto,
        }))}
      />

      <ZonasAgua cat={cat} set={set} />
    </>
  );
}

/**
 * LAS ZONAS DE AGUA Y RETIRO (2026-10-29). Se cobran según la zona de la obra
 * y fuera de estas zonas no se ofrece. Aquí se mueven los municipios; el
 * precio de cada zona va en la ficha de cada pipa.
 */
function ZonasAgua({ cat, set }: { cat: CatalogoMaquinaria; set: (p: Partial<CatalogoCotizador>) => void }) {
  const zonas = cat.zonas_precio ?? [];
  if (!zonas.length) return null;
  const enAlguna = new Set(zonas.flatMap((z) => z.municipios));
  const sinZona = cat.municipios.filter((m) => !enAlguna.has(m));
  const poner = (i: number, municipios: string[]) =>
    set({ zonas_precio: zonas.map((z, j) => (j === i ? { ...z, municipios } : z)) } as Partial<CatalogoCotizador>);
  return (
    <Panel
      icon="ph-drop"
      title="Zonas de agua y retiro"
      desc="El agua y el retiro de material se cobran según la zona de la obra; fuera de estas zonas no se ofrecen. El precio de cada zona va en la ficha de cada servicio."
    >
      <div style={{ display: 'grid', gap: 16 }}>
        {zonas.map((z, i) => (
          <div key={z.id} style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                className="adm-input"
                style={{ width: 160, height: 34, fontSize: 13.5, fontWeight: 600 }}
                value={z.nombre}
                maxLength={80}
                aria-label={`Nombre de ${z.nombre}`}
                onChange={(e) => set({ zonas_precio: zonas.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)) } as Partial<CatalogoCotizador>)}
              />
              <span className="tf-sub">{z.municipios.length} municipio{z.municipios.length === 1 ? '' : 's'}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {z.municipios.map((m) => (
                <Chip key={m} tone="info">
                  {m}
                  <button
                    type="button"
                    aria-label={`Quitar ${m} de ${z.nombre}`}
                    onClick={() => poner(i, z.municipios.filter((x) => x !== m))}
                    style={{ marginLeft: 6, background: 'none', border: 0, color: 'inherit', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                  >
                    ×
                  </button>
                </Chip>
              ))}
              {sinZona.length ? (
                <AdminSelect
                  size="sm"
                  className="w-auto min-w-[200px]"
                  ariaLabel={`Agregar municipio a ${z.nombre}`}
                  placeholder="+ Agregar municipio…"
                  value=""
                  onChange={(v) => v && poner(i, [...z.municipios, v])}
                  options={sinZona.map((m) => ({ value: m, label: m }))}
                />
              ) : null}
            </div>
          </div>
        ))}
        <p className="tf-sub" style={{ margin: 0 }}>
          {sinZona.length ? `Sin agua ni retiro (en ninguna zona): ${sinZona.join(', ')}.` : 'Todos los municipios del cotizador están en alguna zona.'}
        </p>
      </div>
    </Panel>
  );
}

function EditorTriturados({ cat, set, fichas }: {
  cat: CatalogoTriturados;
  set: (p: Partial<CatalogoCotizador>) => void;
  fichas: Record<string, FichaDeRenglon | null> | null;
}) {
  const ponerZona = (i: number, patch: Partial<CatalogoTriturados['zonas'][number]>) => {
    const zonas = [...cat.zonas];
    zonas[i] = { ...zonas[i], ...patch };
    set({ zonas } as Partial<CatalogoCotizador>);
  };
  return (
    <>
      <Publicacion cat={cat} set={set} />

      <ListaDelCotizador
        titulo="Materiales"
        icono="ph-cube"
        encabezados={['Material', 'Precio por tonelada', '']}
        fichas={fichas}
        filas={cat.productos.map((p) => ({ id: p.id, nombre: p.nombre, precio: money(p.precio_ton), oculto: p.oculto }))}
        estiloLista
      />

      <Panel
        flush
        clip
        icon="ph-map-pin"
        title="Zonas de entrega"
        desc="Precio del viaje puesto en obra. Si un material no tiene precio propio: flete de la zona + precio por tonelada × toneladas por viaje."
      >
        <div className="tf-tabla tf-zonas">
          <div className="tf-suelto">
            <span className="tf-nombre">Toneladas por viaje</span>
            <input className="adm-input adm-num" type="number" min="1" value={cat.ton_por_viaje} onChange={(e) => set({ ton_por_viaje: Number(e.target.value) } as Partial<CatalogoCotizador>)} aria-label="Toneladas por viaje" />
          </div>
          <div className="adm-thead"><div>Zona</div><div>Flete del viaje</div><div /></div>
          {cat.zonas.map((z, i) => (
            <div key={z.id} className="adm-trow">
              <input className="adm-input" value={z.nombre} onChange={(e) => ponerZona(i, { nombre: e.target.value })} aria-label={`Nombre de la zona ${i + 1}`} />
              <div className="tf-pesos">
                <input className="adm-input adm-num" type="number" min="0" value={z.flete} onChange={(e) => ponerZona(i, { flete: Number(e.target.value) })} aria-label={`Flete de ${z.nombre}`} />
              </div>
              <IconBtn icon="ph-trash" label={`Quitar ${z.nombre}`} danger onClick={() => set({ zonas: cat.zonas.filter((_, j) => j !== i) } as Partial<CatalogoCotizador>)} />
            </div>
          ))}
          <div style={{ padding: '10px 16px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--adm-border)' }}>
            <Btn size="sm" icon="ph-plus" onClick={() => set({ zonas: [...cat.zonas, { id: `z_${Date.now()}`, nombre: 'Zona nueva', flete: 0 }] } as Partial<CatalogoCotizador>)}>Agregar zona</Btn>
            <input className="adm-input" style={{ flex: '1 1 260px', height: 34, fontSize: 13.5 }} value={cat.nota_zona} onChange={(e) => set({ nota_zona: e.target.value } as Partial<CatalogoCotizador>)} placeholder="Nota que sale junto a las zonas en la cotización" aria-label="Nota del viaje" />
          </div>
        </div>
      </Panel>

      <div className="tf-dos" style={{ marginTop: 20 }}>
        <Panel icon="ph-mountains" title="Material de banco" desc="Se cotiza por m³ y se entrega en camión; no se pesa.">
          <div className="adm-form-grid">
            <FormField label="Nombre" style={{ gridColumn: '1 / -1' }}>
              <input className="adm-input" value={cat.material_banco.nombre} onChange={(e) => set({ material_banco: { ...cat.material_banco, nombre: e.target.value } } as Partial<CatalogoCotizador>)} />
            </FormField>
            <FormField label="Precio por m³">
              <div className="tf-pesos"><input className="adm-input adm-num" type="number" min="0" value={cat.material_banco.precio_m3_default} onChange={(e) => set({ material_banco: { ...cat.material_banco, precio_m3_default: Number(e.target.value) } } as Partial<CatalogoCotizador>)} /></div>
            </FormField>
            <FormField label="m³ del camión">
              <input className="adm-input adm-num" type="number" min="0" value={cat.material_banco.camion_m3} onChange={(e) => set({ material_banco: { ...cat.material_banco, camion_m3: Number(e.target.value) } } as Partial<CatalogoCotizador>)} />
            </FormField>
          </div>
        </Panel>

        <Panel icon="ph-sliders-horizontal" title="Al cotizar" desc="Con qué arranca cada cotización de triturados.">
          <FormField label="Fletes sugeridos por tonelada" help="Separados con coma. Salen como botones rápidos al cotizar.">
            <input
              className="adm-input adm-num"
              value={cat.fletes_ton.join(', ')}
              onChange={(e) => set({ fletes_ton: e.target.value.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0) } as Partial<CatalogoCotizador>)}
            />
          </FormField>
          <div style={{ marginTop: 14 }}>
            <Switch on={cat.iva_por_defecto} onClick={() => set({ iva_por_defecto: !cat.iva_por_defecto } as Partial<CatalogoCotizador>)} label="Cotizar con IVA por defecto" title="Se puede cambiar en cada cotización" />
          </div>
        </Panel>
      </div>
    </>
  );
}

/** Lo que ve un visitante del sitio: si el cotizador existe ahí. */
function Publicacion({ cat, set }: { cat: CatalogoCotizador; set: (p: Partial<CatalogoCotizador>) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '12px 16px', border: '1px solid var(--adm-border)', borderRadius: 10 }}>
      <Switch
        on={cat.publico.habilitado}
        onClick={() => set({ publico: { ...cat.publico, habilitado: !cat.publico.habilitado } } as Partial<CatalogoCotizador>)}
        label={cat.publico.habilitado ? 'Visible en el sitio público' : 'Oculto en el sitio público'}
      />
      {cat.publico.habilitado ? (
        <Switch
          on={cat.publico.mostrarPrecios}
          onClick={() => set({ publico: { ...cat.publico, mostrarPrecios: !cat.publico.mostrarPrecios } } as Partial<CatalogoCotizador>)}
          label={cat.publico.mostrarPrecios ? 'Enseña los precios de lista' : 'Sin precios en el sitio'}
        />
      ) : null}
      <span className="tf-sub">
        {cat.publico.mostrarPrecios
          ? 'El cliente ve estos precios al armar su pedido, con la nota para llamar si quiere mejorarlo. Cambiarlos para un cliente se hace en el cotizador del panel.'
          : 'El cliente arma su pedido sin ver precios y MAQSER24 le manda la cotización desde Solicitudes.'}
      </span>
    </div>
  );
}

// ---- Condiciones ----

/** «Condiciones comerciales · Renta de maquinaria» → «Renta de maquinaria». */
const tituloCorto = (t: string) => t.replace(/^condiciones comerciales\s*[·:-]\s*/i, '').trim() || t;

function EditorCondiciones({ maq, tri, setMaq, setTri }: {
  maq: CatalogoMaquinaria;
  tri: CatalogoTriturados;
  setMaq: (p: Partial<CatalogoCotizador>) => void;
  setTri: (p: Partial<CatalogoCotizador>) => void;
}) {
  const grupos: Array<{ titulo: string; cat: CatalogoCotizador; set: (p: Partial<CatalogoCotizador>) => void }> = [
    { titulo: 'Maquinaria', cat: maq, set: setMaq },
    { titulo: 'Triturados', cat: tri, set: setTri },
  ];
  return (
    <>
      <p className="tf-sub" style={{ margin: '0 0 16px', maxWidth: '78ch', lineHeight: 1.55 }}>
        Se imprimen al pie de la cotización, y solo los bloques que apliquen a las partidas de esa cotización. Un punto por renglón.
      </p>
      {grupos.map((g) => (
        <Panel key={g.titulo} title={g.titulo} desc={`${Object.keys(g.cat.condiciones).length} bloques`}>
          {Object.entries(g.cat.condiciones).map(([clave, bloque], i) => (
            <details key={clave} className="tf-cond" open={i === 0}>
              <summary>
                <i className="ph ph-caret-right" aria-hidden />
                {bloque.titulo || clave}
                <span className="tf-sub">{bloque.puntos.length} punto{bloque.puntos.length === 1 ? '' : 's'}</span>
              </summary>
              <div className="tf-cond-cuerpo">
                <FormField label="Título del bloque">
                  <input
                    className="adm-input"
                    value={bloque.titulo}
                    onChange={(e) => g.set({ condiciones: { ...g.cat.condiciones, [clave]: { ...bloque, titulo: e.target.value } } } as Partial<CatalogoCotizador>)}
                  />
                </FormField>
                <FormField
                  label="Puntos"
                  help={g.cat.tipo === 'maquinaria' && clave === 'renta'
                    ? 'Uno por renglón. Se agregan solos el primero («es por hora de trabajo, con su mínimo») y el último (la leyenda para negociar el costo con su teléfono).'
                    : 'Uno por renglón.'}
                >
                  <TextoLista
                    className="adm-textarea"
                    style={{ minHeight: 120, lineHeight: 1.6 }}
                    valor={bloque.puntos}
                    onCambio={(puntos) => g.set({ condiciones: { ...g.cat.condiciones, [clave]: { ...bloque, puntos } } } as Partial<CatalogoCotizador>)}
                  />
                </FormField>
              </div>
            </details>
          ))}
        </Panel>
      ))}
    </>
  );
}

// ---- Documento ----

/** Lo que sale impreso en toda cotización, de maquinaria o de triturados: se captura una vez. */
function EditorDocumento({ cat, set }: { cat: CatalogoCotizador; set: (p: Partial<CatalogoCotizador>) => void }) {
  const emp = (patch: Partial<CatalogoCotizador['empresa']>) => set({ empresa: { ...cat.empresa, ...patch } } as Partial<CatalogoCotizador>);
  const fir = (patch: Partial<CatalogoCotizador['firma']>) => set({ firma: { ...cat.firma, ...patch } } as Partial<CatalogoCotizador>);
  return (
    <>
      <p className="tf-sub" style={{ margin: '0 0 16px', maxWidth: '78ch', lineHeight: 1.55 }}>
        Encabezado, firma y pie de toda cotización, de maquinaria o de triturados. Se captura una sola vez. Los campos vacíos no se imprimen.
      </p>
      <div className="tf-dos">
        <Panel icon="ph-buildings" title="Quién cotiza" desc="Sale en el encabezado del documento.">
          <div className="adm-form-grid">
            <FormField label="Razón social" style={{ gridColumn: '1 / -1' }}>
              <input className="adm-input" value={cat.empresa.nombre} onChange={(e) => emp({ nombre: e.target.value })} />
            </FormField>
            <FormField label="RFC">
              <input className="adm-input adm-mono" data-campo="rfc" maxLength={13} value={cat.empresa.rfc} placeholder="Sin capturar" onChange={(e) => emp({ rfc: e.target.value })} />
            </FormField>
            <FormField label="Teléfono">
              <input className="adm-input" type="tel" inputMode="tel" maxLength={20} value={cat.empresa.telefono} onChange={(e) => emp({ telefono: e.target.value })} />
            </FormField>
            <FormField label="Domicilio fiscal" style={{ gridColumn: '1 / -1' }}>
              <input className="adm-input" value={cat.empresa.direccion} placeholder="Sin capturar" onChange={(e) => emp({ direccion: e.target.value })} />
            </FormField>
            <FormField label="Correo">
              <input className="adm-input" type="email" maxLength={190} value={cat.empresa.correo} onChange={(e) => emp({ correo: e.target.value })} />
            </FormField>
            <FormField label="Sitio web">
              <input className="adm-input" value={cat.empresa.web} onChange={(e) => emp({ web: e.target.value })} />
            </FormField>
          </div>
        </Panel>

        <div style={{ display: 'grid', gap: 20 }}>
          <Panel icon="ph-pen-nib" title="Firma" desc="Vacío el nombre, el documento no lleva bloque de firma.">
            <div className="adm-form-grid">
              <FormField label="Nombre" style={{ gridColumn: '1 / -1' }}>
                <input className="adm-input" data-campo="nombre" maxLength={190} value={cat.firma.nombre} placeholder="Sin capturar" onChange={(e) => fir({ nombre: e.target.value })} />
              </FormField>
              <FormField label="Puesto">
                <input className="adm-input" value={cat.firma.puesto} onChange={(e) => fir({ puesto: e.target.value })} />
              </FormField>
              <FormField label="Teléfono">
                <input className="adm-input" type="tel" inputMode="tel" maxLength={20} value={cat.firma.telefono} onChange={(e) => fir({ telefono: e.target.value })} />
              </FormField>
            </div>
          </Panel>

          <Panel icon="ph-receipt" title="Impuestos y versión">
            <div className="adm-form-grid">
              <FormField label="IVA">
                <div className="tf-pct">
                  <input className="adm-input adm-num" type="number" step="1" min="0" max="100" value={Math.round(cat.iva * 100)} onChange={(e) => set({ iva: Math.min(100, Math.max(0, Number(e.target.value))) / 100 } as Partial<CatalogoCotizador>)} aria-label="IVA en porcentaje" />
                </div>
              </FormField>
              <FormField label="Versión del tabulador" help="Se guarda con cada cotización emitida.">
                <input className="adm-input adm-mono" value={cat.version} onChange={(e) => set({ version: e.target.value } as Partial<CatalogoCotizador>)} />
              </FormField>
            </div>
          </Panel>
        </div>
      </div>

      <Panel icon="ph-chat-text" title="Párrafo de saludo" desc="Arriba de las partidas." style={{ marginTop: 20 }}>
        <textarea className="adm-textarea" rows={3} value={cat.saludo} onChange={(e) => set({ saludo: e.target.value } as Partial<CatalogoCotizador>)} aria-label="Párrafo de saludo" />
      </Panel>
    </>
  );
}

// ---- piezas ----

/**
 * LO QUE SALE EN EL COTIZADOR, SOLO PARA VER (2026-10-19). Cada renglón lleva
 * a su ficha, que es donde se le pone precio: así se captura una sola vez.
 * Compacto (2026-10-28): una línea por renglón, en tabla.
 */
function ListaDelCotizador({ titulo, icono, encabezados, filas, fichas, estiloLista }: {
  titulo: string;
  icono: string;
  encabezados: [string, string, string];
  filas: Array<{ id: string; nombre: string; precio: string; detalle?: string; oculto?: boolean }>;
  fichas: Record<string, FichaDeRenglon | null> | null;
  /** Sin tercera columna (materiales). */
  estiloLista?: boolean;
}) {
  return (
    <Panel
      flush
      clip
      icon={icono}
      title={titulo}
      desc="El precio se pone en su ficha de Inventario; aquí solo se ve."
      action={<Btn size="sm" icon="ph-plus" href="/productos/nuevo?tipo=servicio">Agregar tipo</Btn>}
      style={{ marginTop: 20 }}
    >
      <div className="tf-tabla tf-lista">
        {filas.length === 0 ? (
          <p className="adm-help" style={{ margin: 0, padding: '14px 16px' }}>Todavía no hay nada en esta parte del cotizador.</p>
        ) : (
          <>
            <div className="adm-thead"><div>{encabezados[0]}</div><div>{encabezados[1]}</div><div>{estiloLista ? '' : encabezados[2]}</div><div /></div>
            {filas.map((f) => {
              const ficha = fichas ? fichas[f.id] : undefined;
              return (
                <div key={f.id} className="adm-trow" style={f.oculto ? { opacity: 0.55 } : undefined}>
                  <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="tf-nombre adm-ellipsis">{f.nombre}</span>
                    {f.oculto ? <Chip tone="muted">{ficha && !ficha.activa ? 'Ficha inactiva' : 'No sale'}</Chip> : null}
                    {ficha === null ? <Chip tone="warn">Sin ficha</Chip> : null}
                  </div>
                  <div className="adm-num" style={{ fontSize: 13.5, color: 'var(--adm-text)' }}>{f.precio}</div>
                  <div className="tf-sub adm-ellipsis">{estiloLista ? '' : f.detalle ?? ''}</div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    {ficha ? <IconBtn icon="ph-pencil-simple" label={`Editar ${f.nombre} en su ficha`} href={`/productos/editar/${ficha.id}`} /> : null}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </Panel>
  );
}

/**
 * Lista "uno por renglón" que SÍ deja escribir (QA 2026-09-28): antes cada
 * tecla pasaba por split/trim/filter y se comía el Enter y los espacios, así
 * que no se podía agregar un punto al final. Ahora el texto es libre y se
 * limpia (renglones vacíos fuera) al salir del campo.
 */
function TextoLista({ valor, onCambio, className, style }: { valor: string[]; onCambio: (lista: string[]) => void; className?: string; style?: CSSProperties }) {
  const [texto, setTexto] = useState(valor.join('\n'));
  const editando = useRef(false);
  const externo = valor.join('\n');
  // Si la lista cambia desde fuera (restaurar), se refleja.
  useEffect(() => { if (!editando.current) setTexto(externo); }, [externo]);
  const limpiar = (t: string) => t.split('\n').map((s) => s.trim()).filter(Boolean);
  return (
    <textarea
      className={className}
      style={style}
      value={texto}
      onFocus={() => { editando.current = true; }}
      onChange={(e) => { setTexto(e.target.value); onCambio(limpiar(e.target.value)); }}
      onBlur={() => { editando.current = false; onCambio(limpiar(texto)); }}
    />
  );
}

