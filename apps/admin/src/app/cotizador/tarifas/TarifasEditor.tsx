'use client';

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { AdminSelect } from '@/components/AdminSelect';
import {
  COTIZADORES_META,
  COTIZADORES_ACTIVOS,
  MUNICIPIOS_NORTE,
  LINEA_MAQUINARIA,
  LINEA_TRANSPORTE,
  LINEA_TRITURADOS,
  lineaDeServicio,
  renglonesDe,
  type CatalogoCotizador,
  type CatalogoMaquinaria,
  type CatalogoTriturados,
  type CotizadorTipo,
} from '@maqserv/config';
import { Btn, Chip, FormField, Note, Panel, Segmented, Switch, Toolbar } from '@/components/ui';

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
/** Un proveedor como lo ve este selector: lo justo para elegirlo. */
export interface ProveedorOpcion {
  id: number;
  nombre: string;
  /** Sin correo, asignarlo se ve igual en pantalla y no avisa a nadie. */
  conCorreo: boolean;
}

/** Un equipo publicado que se puede ligar a un renglón (GET admin/quoter/ligables). */
export interface EquipoLigable {
  id: number;
  name: string;
  linea: string | null;
  providerId: number | null;
  provider: string | null;
}

/** Lo que necesita cada renglón para elegir sus equipos. */
interface Ligas {
  proveedores: ProveedorOpcion[];
  ligables: EquipoLigable[];
  /** Equipos ya ligados a algún renglón de este tabulador: uno cuenta como UNA cosa. */
  usados: Set<number>;
}

export function TarifasEditor({
  inicial,
  proveedores,
  ligables,
}: {
  inicial: Record<CotizadorTipo, CatalogoCotizador>;
  proveedores: ProveedorOpcion[];
  ligables: EquipoLigable[];
}) {
  const [tipo, setTipo] = useState<CotizadorTipo>('maquinaria');
  const [cats, setCats] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: 'ok' | 'bad'; texto: string } | null>(null);

  const cat = cats[tipo];
  const ligas = useMemo<Ligas>(
    () => ({ proveedores, ligables, usados: new Set(renglonesDe(cat).flatMap((r) => r.productos)) }),
    [proveedores, ligables, cat],
  );
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
      setMensaje({ tono: 'ok', texto: 'Tabulador guardado. Las cotizaciones nuevas ya usan estos precios.' });
    } catch (e) {
      setMensaje({ tono: 'bad', texto: e instanceof Error ? e.message : 'No se pudo guardar.' });
    } finally {
      setGuardando(false);
    }
  }

  async function restaurar() {
    if (!confirm('¿Volver al tabulador de fábrica? Se pierde lo que hayas cambiado en este cotizador.')) return;
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
            <input className="adm-input" value={cat.empresa.rfc} placeholder="Sin capturar" onChange={(e) => set({ empresa: { ...cat.empresa, rfc: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Domicilio fiscal" ancho>
            <input className="adm-input" value={cat.empresa.direccion} placeholder="Sin capturar" onChange={(e) => set({ empresa: { ...cat.empresa, direccion: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Teléfono">
            <input className="adm-input" value={cat.empresa.telefono} onChange={(e) => set({ empresa: { ...cat.empresa, telefono: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Correo">
            <input className="adm-input" value={cat.empresa.correo} onChange={(e) => set({ empresa: { ...cat.empresa, correo: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Sitio web">
            <input className="adm-input" value={cat.empresa.web} onChange={(e) => set({ empresa: { ...cat.empresa, web: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Firma · nombre" nota="Vacío = el documento no lleva bloque de firma.">
            <input className="adm-input" value={cat.firma.nombre} placeholder="Sin capturar" onChange={(e) => set({ firma: { ...cat.firma, nombre: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Firma · puesto">
            <input className="adm-input" value={cat.firma.puesto} onChange={(e) => set({ firma: { ...cat.firma, puesto: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Firma · teléfono">
            <input className="adm-input" value={cat.firma.telefono} onChange={(e) => set({ firma: { ...cat.firma, telefono: e.target.value } } as Partial<CatalogoCotizador>)} />
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
        <EditorMaquinaria cat={cat} set={set} ligas={ligas} />
      ) : (
        <EditorTriturados cat={cat} set={set} ligas={ligas} />
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

      <Bloque titulo="Municipios sugeridos" ayuda="Salen como sugerencia en el campo de entrega. Uno por renglón.">
        {/* TRES ESTADOS (2026-09-28): NL, Coahuila y Chihuahua. Nota pendiente del cliente. */}
        <Note tone="warn" style={{ marginBottom: 12 }}>
          <strong style={{ color: 'var(--adm-text)', fontWeight: 600 }}>Pendiente de definir:</strong> la operación se extiende a Nuevo León, Coahuila y Chihuahua,
          pero aún no se decide si estas tarifas valen igual en los tres estados o si cada uno tendrá su tabla.
          Hoy el municipio NO cambia el precio: solo aparece en el documento.
        </Note>
        <Btn
          size="sm"
          icon="ph-plus"
          onClick={() => set({ municipios: [...new Set([...cat.municipios, ...MUNICIPIOS_NORTE])] } as Partial<CatalogoCotizador>)}
          style={{ marginBottom: 12 }}
        >
          Agregar municipios de NL, Coahuila y Chihuahua
        </Btn>
        <TextoLista
          className="adm-textarea"
          style={{ height: 130, lineHeight: 1.6 }}
          valor={cat.municipios}
          onCambio={(lista) => set({ municipios: [...new Set(lista)] } as Partial<CatalogoCotizador>)}
        />
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
  ligas,
}: {
  cat: CatalogoMaquinaria;
  set: (p: Partial<CatalogoCotizador>) => void;
  ligas: Ligas;
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

      <Bloque
        titulo="Equipos"
        ayuda="Tarifa por día en cada tramo. El costo por hora sale de dividir entre la jornada. El proveedor es quien recibe el aviso cuando alguien cotiza ese equipo desde el sitio."
      >
        {cat.equipos.map((eq, i) => (
          <Renglon
            key={eq.id}
            onQuitar={() => set({ equipos: cat.equipos.filter((_, j) => j !== i) } as Partial<CatalogoCotizador>)}
          >
            <Campo etiqueta="Nombre" ancho>
              <input
                className="adm-input"
                value={eq.nombre}
                onChange={(e) => {
                  const equipos = [...cat.equipos];
                  equipos[i] = { ...eq, nombre: e.target.value };
                  set({ equipos } as Partial<CatalogoCotizador>);
                }}
              />
            </Campo>
            <Campo etiqueta="Tipo de flete">
              <AdminSelect
                className="h-[38px]"
                ariaLabel="Tipo de flete"
                value={eq.flete_tipo}
                onChange={(v) => {
                  const equipos = [...cat.equipos];
                  equipos[i] = { ...eq, flete_tipo: v };
                  set({ equipos } as Partial<CatalogoCotizador>);
                }}
                options={tiposFlete.map((k) => ({ value: k, label: k }))}
              />
            </Campo>
            <CampoEquipos
              ligas={ligas}
              linea={LINEA_MAQUINARIA}
              productos={eq.productos}
              proveedorId={eq.proveedor_id ?? null}
              onChange={(patch) => {
                const equipos = [...cat.equipos];
                equipos[i] = { ...eq, ...patch };
                set({ equipos } as Partial<CatalogoCotizador>);
              }}
            />
            {(['dia', 'semana', 'mes'] as const).map((k) => (
              <Campo key={k} etiqueta={`Tarifa ${k}`}>
                <input
                  className="adm-input"
                  type="number"
                  min="0"
                  value={eq.tarifas[k]}
                  onChange={(e) => {
                    const equipos = [...cat.equipos];
                    equipos[i] = { ...eq, tarifas: { ...eq.tarifas, [k]: Number(e.target.value) } };
                    set({ equipos } as Partial<CatalogoCotizador>);
                  }}
                />
              </Campo>
            ))}
          </Renglon>
        ))}
        <BotonAgregar
          texto="Agregar equipo"
          onClick={() =>
            set({
              equipos: [
                ...cat.equipos,
                // Nace sin dueño a propósito: adivinarlo mandaría el aviso a
                // quien no le toca, y eso es peor que no mandarlo.
                { id: `eq_${Date.now()}`, nombre: 'Equipo nuevo', icono: 'excavadora', flete_tipo: tiposFlete[0] ?? 'Excavadora', tarifas: { dia: 0, semana: 0, mes: 0 }, proveedor_id: null },
              ],
            } as Partial<CatalogoCotizador>)
          }
        />
      </Bloque>

      <Bloque titulo="Servicios" ayuda="Pipas y retiro de material. `Condición` decide qué bloque de condiciones se imprime.">
        {cat.servicios.map((sv, i) => (
          <Renglon key={sv.id} onQuitar={() => set({ servicios: cat.servicios.filter((_, j) => j !== i) } as Partial<CatalogoCotizador>)}>
            <Campo etiqueta="Nombre" ancho>
              <input
                className="adm-input"
                value={sv.nombre}
                onChange={(e) => {
                  const servicios = [...cat.servicios];
                  servicios[i] = { ...sv, nombre: e.target.value };
                  set({ servicios } as Partial<CatalogoCotizador>);
                }}
              />
            </Campo>
            <Campo etiqueta="Unidad">
              <input
                className="adm-input"
                value={sv.unidad}
                onChange={(e) => {
                  const servicios = [...cat.servicios];
                  servicios[i] = { ...sv, unidad: e.target.value };
                  set({ servicios } as Partial<CatalogoCotizador>);
                }}
              />
            </Campo>
            <Campo etiqueta="Precio">
              <input
                className="adm-input"
                type="number"
                min="0"
                value={sv.precio}
                onChange={(e) => {
                  const servicios = [...cat.servicios];
                  servicios[i] = { ...sv, precio: Number(e.target.value) };
                  set({ servicios } as Partial<CatalogoCotizador>);
                }}
              />
            </Campo>
            <Campo etiqueta="Línea de servicio" nota="Con esta línea se registra la solicitud y se busca al aliado.">
              <AdminSelect
                className="h-[38px]"
                ariaLabel="Línea de servicio"
                value={lineaDeServicio(sv)}
                onChange={(v) => {
                  const servicios = [...cat.servicios];
                  servicios[i] = { ...sv, linea: v };
                  set({ servicios } as Partial<CatalogoCotizador>);
                }}
                options={[
                  { value: LINEA_MAQUINARIA, label: 'Maquinaria pesada' },
                  { value: LINEA_TRANSPORTE, label: 'Transporte y servicios de obra' },
                ]}
              />
            </Campo>
            <CampoEquipos
              ligas={ligas}
              linea={lineaDeServicio(sv)}
              productos={sv.productos}
              proveedorId={sv.proveedor_id ?? null}
              onChange={(patch) => {
                const servicios = [...cat.servicios];
                servicios[i] = { ...sv, ...patch };
                set({ servicios } as Partial<CatalogoCotizador>);
              }}
            />
            <Campo etiqueta="Condición">
              <AdminSelect
                className="h-[38px]"
                ariaLabel="Bloque de condiciones"
                value={sv.cond}
                onChange={(v) => {
                  const servicios = [...cat.servicios];
                  servicios[i] = { ...sv, cond: v };
                  set({ servicios } as Partial<CatalogoCotizador>);
                }}
                options={Object.keys(cat.condiciones).map((k) => ({ value: k, label: k }))}
              />
            </Campo>
            <Campo etiqueta="Precios sugeridos (coma)" ancho>
              <input
                className="adm-input"
                value={sv.presets.join(', ')}
                onChange={(e) => {
                  const servicios = [...cat.servicios];
                  servicios[i] = { ...sv, presets: e.target.value.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0) };
                  set({ servicios } as Partial<CatalogoCotizador>);
                }}
              />
            </Campo>
          </Renglon>
        ))}
        <BotonAgregar
          texto="Agregar servicio"
          onClick={() =>
            set({
              servicios: [
                ...cat.servicios,
                { id: `sv_${Date.now()}`, nombre: 'Servicio nuevo', icono: 'retiro', unidad: 'viaje', precio: 0, presets: [], cond: Object.keys(cat.condiciones)[0] ?? 'renta' },
              ],
            } as Partial<CatalogoCotizador>)
          }
        />
      </Bloque>
    </>
  );
}

function EditorTriturados({
  cat,
  set,
  ligas,
}: {
  cat: CatalogoTriturados;
  set: (p: Partial<CatalogoCotizador>) => void;
  ligas: Ligas;
}) {
  return (
    <>
      <Bloque titulo="Materiales" ayuda="Precio por tonelada, cargado en planta.">
        {cat.productos.map((p, i) => (
          <Renglon key={p.id} onQuitar={() => set({ productos: cat.productos.filter((_, j) => j !== i) } as Partial<CatalogoCotizador>)}>
            <Campo etiqueta="Nombre" ancho>
              <input
                className="adm-input"
                value={p.nombre}
                onChange={(e) => {
                  const productos = [...cat.productos];
                  productos[i] = { ...p, nombre: e.target.value };
                  set({ productos } as Partial<CatalogoCotizador>);
                }}
              />
            </Campo>
            <Campo etiqueta="Precio / ton">
              <input
                className="adm-input"
                type="number"
                min="0"
                value={p.precio_ton}
                onChange={(e) => {
                  const productos = [...cat.productos];
                  productos[i] = { ...p, precio_ton: Number(e.target.value) };
                  set({ productos } as Partial<CatalogoCotizador>);
                }}
              />
            </Campo>
            <CampoEquipos
              ligas={ligas}
              linea={LINEA_TRITURADOS}
              productos={p.productos}
              proveedorId={p.proveedor_id ?? null}
              onChange={(patch) => {
                const productos = [...cat.productos];
                productos[i] = { ...p, ...patch };
                set({ productos } as Partial<CatalogoCotizador>);
              }}
            />
          </Renglon>
        ))}
        <BotonAgregar
          texto="Agregar material"
          onClick={() => set({ productos: [...cat.productos, { id: `mat_${Date.now()}`, nombre: 'Material nuevo', precio_ton: 0 }] } as Partial<CatalogoCotizador>)}
        />
      </Bloque>

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
          <CampoEquipos
            ligas={ligas}
            linea={LINEA_TRITURADOS}
            productos={cat.material_banco.productos}
            proveedorId={cat.material_banco.proveedor_id ?? null}
            onChange={(patch) => set({ material_banco: { ...cat.material_banco, ...patch } } as Partial<CatalogoCotizador>)}
          />
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
 * DE QUIÉN ES ESTA PARTIDA.
 *
 * El dueño decide a quién le llega el correo cuando alguien la cotiza desde el
 * sitio. "Sin asignar" es una opción legítima y es como nacen las partidas
 * nuevas: adivinar el proveedor mandaría trabajo a quien no le toca.
 *
 * A los que no tienen correo capturado se les avisa en la propia opción. Sin
 * eso, asignarlos se ve idéntico a asignar a cualquier otro y el aviso
 * simplemente no sale, sin que nadie se entere.
 */
function CampoProveedor({
  proveedores,
  valor,
  onChange,
}: {
  proveedores: ProveedorOpcion[];
  valor: number | null;
  onChange: (v: number | null) => void;
}) {
  const elegido = proveedores.find((p) => p.id === valor);
  return (
    <Campo
      etiqueta="Proveedor de respaldo"
      nota={
        proveedores.length === 0
          ? 'No hay proveedores activos todavía.'
          : elegido && !elegido.conCorreo
            ? 'Sin correo capturado: no recibirá el aviso.'
            : 'Recibe el aviso cuando lo cotizan.'
      }
    >
      <AdminSelect
        className="h-[38px]"
        ariaLabel="Proveedor dueño"
        value={valor === null || valor === undefined ? '' : String(valor)}
        onChange={(v) => onChange(v ? Number(v) : null)}
        options={[
          { value: '', label: 'Sin asignar' },
          ...proveedores.map((p) => ({ value: String(p.id), label: `${p.nombre}${p.conCorreo ? '' : ' (sin correo)'}` })),
        ]}
      />
    </Campo>
  );
}

/**
 * QUÉ EQUIPOS DEL CATÁLOGO CUENTAN COMO ESTE RENGLÓN (2026-09-24).
 *
 * El dueño ya no se captura aparte: es quien tiene publicado el equipo ligado.
 * Si lo cotizan, la solicitud se le ofrece a él; si varios aliados tienen
 * equipos ligados, queda "por asignar" y Operaciones elige. Solo se ofrecen
 * equipos de la misma línea y que no estén ya en otro renglón.
 *
 * Sin equipos ligados se ve el proveedor de antes, como respaldo.
 */
function CampoEquipos({
  ligas,
  linea,
  productos,
  proveedorId,
  onChange,
}: {
  ligas: Ligas;
  linea: string;
  productos?: number[];
  proveedorId: number | null;
  onChange: (patch: { productos?: number[]; proveedor_id?: number | null }) => void;
}) {
  const ids = productos ?? [];
  const porId = new Map(ligas.ligables.map((e) => [e.id, e]));
  const libres = ligas.ligables.filter((e) => e.linea === linea && !ligas.usados.has(e.id));
  const duenos = new Set(ids.map((id) => porId.get(id)?.providerId).filter(Boolean));
  return (
    <>
      <Campo
        etiqueta="Equipos que cuentan como este renglón"
        ancho
        grupo
        nota={
          // Precio único (2026-09-28): la solicitud SIEMPRE queda por asignar y
          // la asigna MAQSER24; quién tiene el equipo es sólo una sugerencia.
          ids.length === 0
            ? 'Sin equipos ligados. La solicitud queda por asignar sin aliado sugerido.'
            : duenos.size > 1
              ? 'La solicitud queda por asignar; en Servicios verás a estos aliados como sugeridos.'
              : 'La solicitud queda por asignar; en Servicios verás a su dueño como sugerido.'
        }
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: ids.length ? 6 : 0 }}>
          {ids.map((id) => {
            const e = porId.get(id);
            return (
              <Chip
                key={id}
                tone={e ? undefined : 'muted'}
                style={{ height: 'auto', minHeight: 26, padding: '3px 3px 3px 9px', fontSize: 12.5, fontWeight: 500, whiteSpace: 'normal', lineHeight: 1.35 }}
              >
                {e ? `${e.name} · ${e.provider ?? 'sin aliado'}` : `Equipo #${id} (ya no está publicado)`}
                <button
                  type="button"
                  aria-label="Quitar equipo"
                  title="Quitar equipo"
                  className="adm-ibtn is-plain"
                  onClick={() => onChange({ productos: ids.filter((x) => x !== id) })}
                  style={{ width: 20, height: 20, borderRadius: 4 }}
                >
                  <i className="ph ph-x" aria-hidden style={{ fontSize: 12 }} />
                </button>
              </Chip>
            );
          })}
        </div>
        <AdminSelect
          className="h-[38px]"
          ariaLabel="Ligar un equipo"
          value=""
          onChange={(v) => { if (v) onChange({ productos: [...ids, Number(v)] }); }}
          options={[
            { value: '', label: libres.length ? '+ Ligar un equipo publicado…' : 'No hay equipos publicados libres de esta línea' },
            ...libres.map((e) => ({ value: String(e.id), label: `${e.name} · ${e.provider ?? 'sin aliado'}` })),
          ]}
        />
      </Campo>
      {ids.length === 0 ? (
        <CampoProveedor proveedores={ligas.proveedores} valor={proveedorId} onChange={(v) => onChange({ proveedor_id: v })} />
      ) : null}
    </>
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
