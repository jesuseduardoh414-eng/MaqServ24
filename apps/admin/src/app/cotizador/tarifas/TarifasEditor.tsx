'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import {
  COTIZADORES_META,
  COTIZADORES_ACTIVOS,
  type CatalogoCotizador,
  type CatalogoMaquinaria,
  type CatalogoTriturados,
  type CotizadorTipo,
} from '@maqserv/config';
import { Btn, Chip, FormField, Note, Panel, Segmented, Switch, Toolbar } from '@/components/ui';
import { confirmar } from '@/components/Dialogos';

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
 */
/**
 * DESDE EL 2026-10-19 LOS RENGLONES SON DE SU FICHA. Equipos, servicios y
 * materiales se dan de alta y se les pone precio en su ficha de Inventario;
 * aquí solo se ven, con el enlace para editarlos ahí. Esta pantalla guarda lo
 * general: publicación, documento, tramos, fletes, zonas y condiciones.
 */
/** A qué ficha de Inventario pertenece un renglón (GET admin/quoter/catalog/:kind/fichas). */
export interface FichaDeRenglon {
  id: number;
  nombre: string;
  activa: boolean;
}

const money = (n: number) => `$${Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;

export function TarifasEditor({
  inicial,
}: {
  inicial: Record<CotizadorTipo, CatalogoCotizador>;
}) {
  const [tipo, setTipo] = useState<CotizadorTipo>('maquinaria');
  const [cats, setCats] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: 'ok' | 'bad'; texto: string } | null>(null);

  const cat = cats[tipo];
  // null mientras carga: así no parpadea "Sin ficha" en cada renglón.
  const [fichas, setFichas] = useState<Record<string, FichaDeRenglon | null> | null>(null);
  useEffect(() => {
    let vivo = true;
    void fetch(`/api/admin/quoter/catalog/${tipo}/fichas`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: Record<string, FichaDeRenglon | null>) => { if (vivo) setFichas(d ?? {}); })
      .catch(() => undefined);
    return () => { vivo = false; };
  }, [tipo]);
  const set = (patch: Partial<CatalogoCotizador>) =>
    setCats((prev) => ({ ...prev, [tipo]: { ...prev[tipo], ...patch } as CatalogoCotizador }));

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    try {
      const res = await fetch(`/api/admin/quoter/catalog/${tipo}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cat),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message ?? 'No se pudo guardar.');
      setCats((prev) => ({ ...prev, [tipo]: body as CatalogoCotizador }));
      setMensaje({ tono: 'ok', texto: 'Guardado. Las cotizaciones nuevas ya usan estos datos.' });
    } catch (e) {
      setMensaje({ tono: 'bad', texto: e instanceof Error ? e.message : 'No se pudo guardar.' });
    } finally {
      setGuardando(false);
    }
  }

  async function restaurar() {
    if (!(await confirmar({ titulo: '¿Volver al tabulador de fábrica?', mensaje: 'Vuelven a su valor de fábrica los datos del documento, las condiciones, los tramos, los fletes y las zonas de este cotizador. El precio de cada tipo no se toca: vive en su ficha.', confirmar: 'Restaurar', peligro: true }))) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const res = await fetch(`/api/admin/quoter/catalog/${tipo}/reset`, { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message ?? 'No se pudo restaurar.');
      setCats((prev) => ({ ...prev, [tipo]: body as CatalogoCotizador }));
      setMensaje({ tono: 'ok', texto: 'Tabulador restaurado a los valores de fábrica.' });
    } catch (e) {
      setMensaje({ tono: 'bad', texto: e instanceof Error ? e.message : 'No se pudo restaurar.' });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <style>{`
        /* Renglones (equipos, servicios, materiales, zonas, condiciones): filas
           separadas por una línea fina dentro del panel, no una caja por cada uno. */
        .tf-renglon{ padding:18px 0; border-top:1px solid var(--adm-border); }
        .tf-renglon:first-child{ padding-top:0; border-top:0; }
        .tf-renglon-grid{ display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:14px 16px; }
      `}</style>

      <Toolbar>
        <Segmented<CotizadorTipo>
          ariaLabel="Cotizador"
          value={tipo}
          onChange={(t) => { setTipo(t); setMensaje(null); }}
          items={(Object.keys(cats) as CotizadorTipo[])
            .filter((t) => COTIZADORES_ACTIVOS.includes(t))
            .map((t) => ({ key: t, label: COTIZADORES_META[t].titulo }))}
        />
      </Toolbar>

      <Bloque
        titulo="Publicación"
        ayuda="Qué ve un visitante del sitio. Con los precios ocultos el cotizador sigue funcionando: la persona arma su requerimiento y lo envía sin ver importes, y el precio se lo pone alguien desde el panel."
      >
        <Interruptor
          etiqueta="Visible en el sitio público"
          on={cat.publico.habilitado}
          onChange={(v) => set({ publico: { ...cat.publico, habilitado: v } } as Partial<CatalogoCotizador>)}
        />
        <Interruptor
          etiqueta="Mostrar precios a los visitantes"
          nota="Apagado, el tabulador no sale del servidor: ni en la pantalla ni en la respuesta de la API."
          on={cat.publico.mostrarPrecios}
          onChange={(v) => set({ publico: { ...cat.publico, mostrarPrecios: v } } as Partial<CatalogoCotizador>)}
        />
      </Bloque>

      <MargenAliado />

      <Bloque titulo="Datos del documento" ayuda="Lo que sale impreso en el encabezado y el pie de la cotización. Los campos vacíos sencillamente no se imprimen.">
        <Rejilla>
          <Campo etiqueta="Razón social">
            <input className="adm-input" value={cat.empresa.nombre} onChange={(e) => set({ empresa: { ...cat.empresa, nombre: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="RFC">
            <input className="adm-input" data-campo="rfc" maxLength={13} value={cat.empresa.rfc} placeholder="Sin capturar" onChange={(e) => set({ empresa: { ...cat.empresa, rfc: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Domicilio fiscal" ancho>
            <input className="adm-input" value={cat.empresa.direccion} placeholder="Sin capturar" onChange={(e) => set({ empresa: { ...cat.empresa, direccion: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Teléfono">
            <input className="adm-input" type="tel" inputMode="tel" maxLength={20} value={cat.empresa.telefono} onChange={(e) => set({ empresa: { ...cat.empresa, telefono: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Correo">
            <input className="adm-input" type="email" maxLength={190} value={cat.empresa.correo} onChange={(e) => set({ empresa: { ...cat.empresa, correo: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Sitio web">
            <input className="adm-input" value={cat.empresa.web} onChange={(e) => set({ empresa: { ...cat.empresa, web: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Firma · nombre" nota="Vacío = el documento no lleva bloque de firma.">
            <input className="adm-input" data-campo="nombre" maxLength={190} value={cat.firma.nombre} placeholder="Sin capturar" onChange={(e) => set({ firma: { ...cat.firma, nombre: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Firma · puesto">
            <input className="adm-input" value={cat.firma.puesto} onChange={(e) => set({ firma: { ...cat.firma, puesto: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Firma · teléfono">
            <input className="adm-input" type="tel" inputMode="tel" maxLength={20} value={cat.firma.telefono} onChange={(e) => set({ firma: { ...cat.firma, telefono: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Párrafo de saludo" ancho>
            <textarea className="adm-textarea" rows={3} value={cat.saludo} onChange={(e) => set({ saludo: e.target.value } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="IVA" nota="0.16 = 16 %">
            <input className="adm-input" type="number" step="0.01" min="0" max="1" value={cat.iva} onChange={(e) => set({ iva: Number(e.target.value) } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Versión" nota="Se guarda con cada cotización emitida.">
            <input className="adm-input" value={cat.version} onChange={(e) => set({ version: e.target.value } as Partial<CatalogoCotizador>)} />
          </Campo>
        </Rejilla>
      </Bloque>

      {cat.tipo === 'maquinaria' ? (
        <EditorMaquinaria cat={cat} set={set} fichas={fichas} />
      ) : (
        <EditorTriturados cat={cat} set={set} fichas={fichas} />
      )}

      <Bloque titulo="Condiciones comerciales" ayuda="Se imprimen al pie, y solo los bloques que apliquen a las partidas de esa cotización. Un punto por renglón.">
        {Object.entries(cat.condiciones).map(([clave, bloque]) => (
          <div key={clave} className="tf-renglon" style={{ display: 'grid', gap: 12 }}>
            <Campo etiqueta={`Título · ${clave}`} ancho>
              <input
                className="adm-input"
                value={bloque.titulo}
                onChange={(e) => set({ condiciones: { ...cat.condiciones, [clave]: { ...bloque, titulo: e.target.value } } } as Partial<CatalogoCotizador>)}
              />
            </Campo>
            <Campo etiqueta="Puntos (uno por renglón)" ancho>
              <TextoLista
                className="adm-textarea"
                style={{ height: 150, lineHeight: 1.6 }}
                valor={bloque.puntos}
                onCambio={(puntos) =>
                  set({
                    condiciones: {
                      ...cat.condiciones,
                      [clave]: { ...bloque, puntos },
                    },
                  } as Partial<CatalogoCotizador>)
                }
              />
            </Campo>
          </div>
        ))}
      </Bloque>

      {/* Los municipios salen de Configuración › Zonas (2026-10-22): una sola lista para los dos cotizadores. */}
      <Bloque titulo="Municipios" ayuda="Salen de Configuración › Zonas.">
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--adm-muted)', lineHeight: 1.55 }}>
          Los municipios del cotizador se editan en <a className="adm-link" href="/zonas">Zonas</a>: ahí se dice qué se anuncia en el sitio y qué se atiende sin anunciarse.
          El precio es el mismo en todas las zonas.
        </p>
      </Bloque>

      {/* Barra de guardar pegada abajo: el tabulador es largo y se guarda
          entero. Fondo sólido del panel con una línea fina, sin degradado. */}
      <div
        style={{
          position: 'sticky', bottom: 0, zIndex: 2, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
          marginTop: 20, padding: '14px 0', background: 'var(--adm-page)', borderTop: '1px solid var(--adm-border)',
        }}
      >
        <Btn variant="primary" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : `Guardar ${COTIZADORES_META[tipo].titulo.toLowerCase()}`}
        </Btn>
        <Btn onClick={restaurar} disabled={guardando}>
          Restaurar valores de fábrica
        </Btn>
        {mensaje ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: mensaje.tono === 'ok' ? 'var(--adm-ok)' : 'var(--adm-bad)' }}>
            <i className={`ph ${mensaje.tono === 'ok' ? 'ph-check-circle' : 'ph-warning-circle'}`} aria-hidden />
            {mensaje.texto}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function EditorMaquinaria({
  cat,
  set,
  fichas,
}: {
  cat: CatalogoMaquinaria;
  set: (p: Partial<CatalogoCotizador>) => void;
  fichas: Record<string, FichaDeRenglon | null> | null;
}) {
  const tiposFlete = Object.keys(cat.fletes);
  return (
    <>
      <Bloque titulo="Jornada y tramos" ayuda="Los tramos deciden qué tarifa se aplica según los días de renta.">
        <Rejilla>
          <Campo etiqueta="Horas por jornada">
            <input className="adm-input" type="number" min="1" max="24" value={cat.jornada_horas} onChange={(e) => set({ jornada_horas: Number(e.target.value) } as Partial<CatalogoCotizador>)} />
          </Campo>
          {cat.tiers.map((t, i) => (
            <Campo key={t.id} etiqueta={`${t.label} · desde / hasta días`}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="adm-input"
                  type="number"
                  min="1"
                  value={t.desde_dias}
                  onChange={(e) => {
                    const tiers = [...cat.tiers];
                    tiers[i] = { ...t, desde_dias: Number(e.target.value) };
                    set({ tiers } as Partial<CatalogoCotizador>);
                  }}
                />
                <input
                  className="adm-input"
                  type="number"
                  min="1"
                  placeholder="sin tope"
                  value={t.hasta_dias ?? ''}
                  onChange={(e) => {
                    const tiers = [...cat.tiers];
                    tiers[i] = { ...t, hasta_dias: e.target.value === '' ? null : Number(e.target.value) };
                    set({ tiers } as Partial<CatalogoCotizador>);
                  }}
                />
              </div>
            </Campo>
          ))}
        </Rejilla>
      </Bloque>

      <Bloque titulo="Fletes por tipo de equipo" ayuda="Costo de llevar y traer el equipo a obra. Se cobra una vez por equipo.">
        <Rejilla>
          {tiposFlete.map((k) => (
            <Campo key={k} etiqueta={k}>
              <input
                className="adm-input"
                type="number"
                min="0"
                value={cat.fletes[k]}
                onChange={(e) => set({ fletes: { ...cat.fletes, [k]: Number(e.target.value) } } as Partial<CatalogoCotizador>)}
              />
            </Campo>
          ))}
        </Rejilla>
      </Bloque>

      <ListaDelCotizador
        titulo="Equipos"
        fichas={fichas}
        filas={cat.equipos.map((eq) => ({
          id: eq.id,
          nombre: eq.nombre,
          precio: `${money(eq.tarifas.dia)} · ${money(eq.tarifas.semana)} · ${money(eq.tarifas.mes)} por día`,
          detalle: `Flete: ${eq.flete_tipo}${cat.fletes[eq.flete_tipo] !== undefined ? ` (${money(cat.fletes[eq.flete_tipo])})` : ''}`,
          oculto: eq.oculto,
        }))}
      />

      <ListaDelCotizador
        titulo="Servicios"
        fichas={fichas}
        filas={cat.servicios.map((sv) => ({
          id: sv.id,
          nombre: sv.nombre,
          precio: `${money(sv.precio)} por ${sv.unidad || 'viaje'}`,
          detalle: cat.condiciones[sv.cond]?.titulo ? `Condiciones: ${cat.condiciones[sv.cond].titulo}` : undefined,
          oculto: sv.oculto,
        }))}
      />
    </>
  );
}

function EditorTriturados({
  cat,
  set,
  fichas,
}: {
  cat: CatalogoTriturados;
  set: (p: Partial<CatalogoCotizador>) => void;
  fichas: Record<string, FichaDeRenglon | null> | null;
}) {
  return (
    <>
      <ListaDelCotizador
        titulo="Materiales"
        fichas={fichas}
        filas={cat.productos.map((p) => ({ id: p.id, nombre: p.nombre, precio: `${money(p.precio_ton)} por tonelada`, oculto: p.oculto }))}
      />

      <Bloque
        titulo="Zonas de entrega"
        ayuda="Precio por viaje puesto en obra. Si no hay precio explícito para un material, se calcula: flete de la zona + precio por tonelada × toneladas por viaje."
      >
        <Rejilla>
          <Campo etiqueta="Toneladas por viaje">
            <input className="adm-input" type="number" min="1" value={cat.ton_por_viaje} onChange={(e) => set({ ton_por_viaje: Number(e.target.value) } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Nota del viaje" ancho>
            <input className="adm-input" value={cat.nota_zona} onChange={(e) => set({ nota_zona: e.target.value } as Partial<CatalogoCotizador>)} />
          </Campo>
        </Rejilla>
        <div style={{ height: 18 }} />
        {cat.zonas.map((z, i) => (
          <Renglon key={z.id} onQuitar={() => set({ zonas: cat.zonas.filter((_, j) => j !== i) } as Partial<CatalogoCotizador>)}>
            <Campo etiqueta="Zona" ancho>
              <input
                className="adm-input"
                value={z.nombre}
                onChange={(e) => {
                  const zonas = [...cat.zonas];
                  zonas[i] = { ...z, nombre: e.target.value };
                  set({ zonas } as Partial<CatalogoCotizador>);
                }}
              />
            </Campo>
            <Campo etiqueta="Flete del viaje">
              <input
                className="adm-input"
                type="number"
                min="0"
                value={z.flete}
                onChange={(e) => {
                  const zonas = [...cat.zonas];
                  zonas[i] = { ...z, flete: Number(e.target.value) };
                  set({ zonas } as Partial<CatalogoCotizador>);
                }}
              />
            </Campo>
          </Renglon>
        ))}
        <BotonAgregar
          texto="Agregar zona"
          onClick={() => set({ zonas: [...cat.zonas, { id: `z_${Date.now()}`, nombre: 'Zona nueva', flete: 0 }] } as Partial<CatalogoCotizador>)}
        />
      </Bloque>

      <Bloque titulo="Flete por tonelada y material de banco">
        <Rejilla>
          <Campo etiqueta="Fletes sugeridos por tonelada (coma)" ancho nota="Salen como botones rápidos al cotizar.">
            <input
              className="adm-input"
              value={cat.fletes_ton.join(', ')}
              onChange={(e) => set({ fletes_ton: e.target.value.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0) } as Partial<CatalogoCotizador>)}
            />
          </Campo>
          <Campo etiqueta="Material de banco · nombre">
            <input className="adm-input" value={cat.material_banco.nombre} onChange={(e) => set({ material_banco: { ...cat.material_banco, nombre: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Precio por m³">
            <input className="adm-input" type="number" min="0" value={cat.material_banco.precio_m3_default} onChange={(e) => set({ material_banco: { ...cat.material_banco, precio_m3_default: Number(e.target.value) } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="m³ del camión">
            <input className="adm-input" type="number" min="0" value={cat.material_banco.camion_m3} onChange={(e) => set({ material_banco: { ...cat.material_banco, camion_m3: Number(e.target.value) } } as Partial<CatalogoCotizador>)} />
          </Campo>
        </Rejilla>
        <div style={{ height: 8 }} />
        <Interruptor
          etiqueta="Cotizar con IVA por defecto"
          nota="Se puede cambiar en cada cotización; esto es solo con qué arranca."
          on={cat.iva_por_defecto}
          onChange={(v) => set({ iva_por_defecto: v } as Partial<CatalogoCotizador>)}
        />
      </Bloque>
    </>
  );
}

// ---- piezas ----

/**
 * LO QUE SALE EN EL COTIZADOR, SOLO PARA VER (2026-10-19). Cada renglón lleva
 * a su ficha, que es donde se le pone precio: así se captura una sola vez.
 */
function ListaDelCotizador({
  titulo,
  filas,
  fichas,
}: {
  titulo: string;
  filas: Array<{ id: string; nombre: string; precio: string; detalle?: string; oculto?: boolean }>;
  fichas: Record<string, FichaDeRenglon | null> | null;
}) {
  return (
    <Bloque titulo={titulo} ayuda="El precio de cada tipo se pone en su ficha de Inventario. Aquí solo se ve, para no capturarlo dos veces.">
      {filas.length === 0 ? (
        <p className="adm-help" style={{ margin: '0 0 12px' }}>Todavía no hay nada en esta parte del cotizador.</p>
      ) : (
        filas.map((f) => {
          const ficha = fichas ? fichas[f.id] : undefined;
          return (
            <div key={f.id} className="tf-renglon" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontWeight: 600, color: 'var(--adm-text)' }}>{f.nombre}</div>
                <div className="adm-help">{f.precio}{f.detalle ? ` · ${f.detalle}` : ''}</div>
              </div>
              {f.oculto ? <Chip tone="muted">{ficha && !ficha.activa ? 'Ficha inactiva' : 'No sale en el cotizador'}</Chip> : null}
              {ficha ? (
                <Btn size="sm" href={`/productos/editar/${ficha.id}`} icon="ph-pencil-simple">Editar en su ficha</Btn>
              ) : ficha === null ? (
                <Chip tone="warn">Sin ficha en Inventario</Chip>
              ) : null}
            </div>
          );
        })
      )}
      <div style={{ marginTop: 14 }}>
        <Btn size="sm" icon="ph-plus" href="/productos/nuevo?tipo=servicio">Agregar un tipo nuevo</Btn>
      </div>
    </Bloque>
  );
}



/**
 * MARGEN DE MAQSER24 SOBRE EL COSTO DEL ALIADO (2026-09-25).
 *
 * Desde que la máquina es la unidad de cotización, el precio al cliente se
 * propone como costo del aliado + este porcentaje. Se guarda en
 * `platform_settings` (no en el tema, que es público) y se puede ajustar por
 * máquina al publicarla.
 */
function MargenAliado() {
  const [margen, setMargen] = useState<string>('');
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'guardando' | 'ok' | 'error'>('cargando');
  useEffect(() => {
    void fetch('/api/admin/catalog/ajustes')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (typeof d?.margenPct === 'number') { setMargen(String(d.margenPct)); setEstado('listo'); } else setEstado('error'); })
      .catch(() => setEstado('error'));
  }, []);
  async function guardar() {
    setEstado('guardando');
    const r = await fetch('/api/admin/catalog/ajustes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ margenPct: Number(margen) }) });
    setEstado(r.ok ? 'ok' : 'error');
  }
  return (
    <Bloque titulo="Margen sobre el costo del aliado (solo PRODUCTOS)" ayuda="Solo para productos que se venden a precio fijo: al publicarlos, el precio al cliente se propone como lo que cobra el aliado más este porcentaje. Los SERVICIOS no lo usan: se cotizan con este tabulador.">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 140 }}>
          <input className="adm-input adm-num" style={{ paddingRight: 30 }} type="number" min={0} max={300} step="1" value={margen} disabled={estado === 'cargando'} onChange={(e) => { setMargen(e.target.value); setEstado('listo'); }} aria-label="Margen en porcentaje" />
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--adm-muted)', fontSize: 13, pointerEvents: 'none' }}>%</span>
        </div>
        <Btn onClick={() => void guardar()} disabled={estado === 'cargando' || estado === 'guardando' || margen === ''}>
          {estado === 'guardando' ? 'Guardando…' : 'Guardar margen'}
        </Btn>
        {estado === 'ok' ? <span style={{ fontSize: 13, color: 'var(--adm-ok)' }}>Guardado.</span> : null}
        {estado === 'error' ? <span style={{ fontSize: 13, color: 'var(--adm-bad)' }}>No se pudo leer o guardar (¿falta correr el SQL de platform_settings?).</span> : null}
      </div>
    </Bloque>
  );
}

/** Una sección del tabulador: es un formulario, así que va en un panel con su título y su ayuda. */
function Bloque({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: ReactNode }) {
  return (
    <Panel
      title={titulo}
      desc={ayuda ? <span style={{ display: 'block', maxWidth: '78ch', lineHeight: 1.55 }}>{ayuda}</span> : undefined}
    >
      {children}
    </Panel>
  );
}

function Rejilla({ children }: { children: ReactNode }) {
  return <div className="adm-form-grid">{children}</div>;
}

/**
 * `grupo`: el campo trae VARIOS controles (chips con su "×", un selector…).
 * Dentro de un <label> el clic en la etiqueta o en la ayuda activaba el
 * primero de ellos: en "Equipos que cuentan" eso quitaba el primer equipo.
 */
function Campo({ etiqueta, nota, ancho, grupo, children }: { etiqueta: string; nota?: string; ancho?: boolean; grupo?: boolean; children: ReactNode }) {
  const estilo = ancho ? { gridColumn: '1 / -1' } : undefined;
  if (grupo) {
    return (
      <div className="adm-field" role="group" aria-label={etiqueta} style={estilo}>
        <span className="adm-label">{etiqueta}</span>
        {children}
        {nota ? <span className="adm-help">{nota}</span> : null}
      </div>
    );
  }
  return (
    <FormField label={etiqueta} help={nota} style={estilo}>
      {children}
    </FormField>
  );
}

function Renglon({ children, onQuitar }: { children: ReactNode; onQuitar: () => void }) {
  return (
    <div className="tf-renglon">
      <div className="tf-renglon-grid">{children}</div>
      <Btn size="sm" variant="ghost" icon="ph-trash" onClick={onQuitar} style={{ marginTop: 10, marginLeft: -10 }}>
        Quitar
      </Btn>
    </div>
  );
}

function BotonAgregar({ texto, onClick }: { texto: string; onClick: () => void }) {
  return (
    <Btn icon="ph-plus" onClick={onClick} style={{ width: '100%', borderStyle: 'dashed', marginTop: 4 }}>
      {texto}
    </Btn>
  );
}

function Interruptor({ etiqueta, nota, on, onChange }: { etiqueta: string; nota?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ padding: '8px 0' }}>
      <Switch
        on={on}
        onClick={() => onChange(!on)}
        label={
          <span style={{ display: 'grid', gap: 2, textAlign: 'left' }}>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--adm-text)' }}>{etiqueta}</span>
            {nota ? <span style={{ fontSize: 12.5, color: 'var(--adm-muted)' }}>{nota}</span> : null}
          </span>
        }
      />
    </div>
  );
}

/**
 * Lista "uno por renglón" que SÍ deja escribir (QA 2026-09-28): antes cada
 * tecla pasaba por split/trim/filter y se comía el Enter y los espacios, así
 * que no se podía agregar un municipio al final. Ahora el texto es libre y se
 * limpia (renglones vacíos fuera) al salir del campo.
 */
function TextoLista({ valor, onCambio, className, style }: { valor: string[]; onCambio: (lista: string[]) => void; className?: string; style?: CSSProperties }) {
  const [texto, setTexto] = useState(valor.join('\n'));
  const [editando, setEditando] = useState(false);
  const externo = valor.join('\n');
  // Si la lista cambia desde fuera (botón de municipios, restaurar), se refleja.
  useEffect(() => { if (!editando) setTexto(externo); }, [externo, editando]);
  const limpiar = (t: string) => t.split('\n').map((s) => s.trim()).filter(Boolean);
  return (
    <textarea
      className={className}
      style={style}
      value={texto}
      onFocus={() => setEditando(true)}
      onChange={(e) => { setTexto(e.target.value); onCambio(limpiar(e.target.value)); }}
      onBlur={() => { setEditando(false); onCambio(limpiar(texto)); }}
    />
  );
}
