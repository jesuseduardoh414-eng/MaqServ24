'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AdminSelect } from '@/components/AdminSelect';
import {
  COTIZADORES_META,
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
import { D } from '@/components/design-tokens';

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
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {(Object.keys(cats) as CotizadorTipo[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTipo(t); setMensaje(null); }}
            style={{
              height: 40, padding: '0 16px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13.5, fontWeight: 700,
              background: t === tipo ? D.accentSoft : 'transparent',
              color: t === tipo ? D.accent : D.muted2,
              border: `1px solid ${t === tipo ? D.accent : D.cardBorder}`,
            }}
          >
            {COTIZADORES_META[t].titulo}
          </button>
        ))}
      </div>

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
            <input style={input} value={cat.empresa.nombre} onChange={(e) => set({ empresa: { ...cat.empresa, nombre: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="RFC">
            <input style={input} value={cat.empresa.rfc} placeholder="Sin capturar" onChange={(e) => set({ empresa: { ...cat.empresa, rfc: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Domicilio fiscal" ancho>
            <input style={input} value={cat.empresa.direccion} placeholder="Sin capturar" onChange={(e) => set({ empresa: { ...cat.empresa, direccion: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Teléfono">
            <input style={input} value={cat.empresa.telefono} onChange={(e) => set({ empresa: { ...cat.empresa, telefono: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Correo">
            <input style={input} value={cat.empresa.correo} onChange={(e) => set({ empresa: { ...cat.empresa, correo: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Sitio web">
            <input style={input} value={cat.empresa.web} onChange={(e) => set({ empresa: { ...cat.empresa, web: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Firma · nombre" nota="Vacío = el documento no lleva bloque de firma.">
            <input style={input} value={cat.firma.nombre} placeholder="Sin capturar" onChange={(e) => set({ firma: { ...cat.firma, nombre: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Firma · puesto">
            <input style={input} value={cat.firma.puesto} onChange={(e) => set({ firma: { ...cat.firma, puesto: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Firma · teléfono">
            <input style={input} value={cat.firma.telefono} onChange={(e) => set({ firma: { ...cat.firma, telefono: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Párrafo de saludo" ancho>
            <textarea style={{ ...input, height: 78, padding: '11px 13px', lineHeight: 1.5, resize: 'vertical' }} value={cat.saludo} onChange={(e) => set({ saludo: e.target.value } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="IVA" nota="0.16 = 16 %">
            <input style={input} type="number" step="0.01" min="0" max="1" value={cat.iva} onChange={(e) => set({ iva: Number(e.target.value) } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Versión" nota="Se guarda con cada cotización emitida.">
            <input style={input} value={cat.version} onChange={(e) => set({ version: e.target.value } as Partial<CatalogoCotizador>)} />
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
          <div key={clave} style={{ marginBottom: 16 }}>
            <Campo etiqueta={`Título · ${clave}`} ancho>
              <input
                style={input}
                value={bloque.titulo}
                onChange={(e) => set({ condiciones: { ...cat.condiciones, [clave]: { ...bloque, titulo: e.target.value } } } as Partial<CatalogoCotizador>)}
              />
            </Campo>
            <div style={{ height: 10 }} />
            <Campo etiqueta="Puntos (uno por renglón)" ancho>
              <textarea
                style={{ ...input, height: 150, padding: '11px 13px', lineHeight: 1.6, resize: 'vertical' }}
                value={bloque.puntos.join('\n')}
                onChange={(e) =>
                  set({
                    condiciones: {
                      ...cat.condiciones,
                      [clave]: { ...bloque, puntos: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) },
                    },
                  } as Partial<CatalogoCotizador>)
                }
              />
            </Campo>
          </div>
        ))}
      </Bloque>

      <Bloque titulo="Municipios sugeridos" ayuda="Salen como sugerencia en el campo de entrega. Uno por renglón.">
        <textarea
          style={{ ...input, height: 130, padding: '11px 13px', lineHeight: 1.6, resize: 'vertical' }}
          value={cat.municipios.join('\n')}
          onChange={(e) => set({ municipios: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) } as Partial<CatalogoCotizador>)}
        />
      </Bloque>

      <div
        style={{
          position: 'sticky', bottom: 0, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
          padding: '14px 0', background: 'linear-gradient(to top, #0a0a0b 70%, transparent)',
        }}
      >
        <button type="button" onClick={guardar} disabled={guardando} style={{ ...boton, background: D.accent, color: D.accentInk, borderColor: 'transparent' }}>
          {guardando ? 'Guardando…' : `Guardar ${COTIZADORES_META[tipo].titulo.toLowerCase()}`}
        </button>
        <button type="button" onClick={restaurar} disabled={guardando} style={boton}>
          Restaurar valores de fábrica
        </button>
        {mensaje ? (
          <span style={{ fontSize: 13, color: mensaje.tono === 'ok' ? D.ok : D.bad }}>{mensaje.texto}</span>
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
            <input style={input} type="number" min="1" max="24" value={cat.jornada_horas} onChange={(e) => set({ jornada_horas: Number(e.target.value) } as Partial<CatalogoCotizador>)} />
          </Campo>
          {cat.tiers.map((t, i) => (
            <Campo key={t.id} etiqueta={`${t.label} · desde / hasta días`}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={input}
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
                  style={input}
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
                style={input}
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
                style={input}
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
                  style={input}
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
                style={input}
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
                style={input}
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
                style={input}
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
                style={input}
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
                style={input}
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
                style={input}
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
            <input style={input} type="number" min="1" value={cat.ton_por_viaje} onChange={(e) => set({ ton_por_viaje: Number(e.target.value) } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Nota del viaje" ancho>
            <input style={input} value={cat.nota_zona} onChange={(e) => set({ nota_zona: e.target.value } as Partial<CatalogoCotizador>)} />
          </Campo>
        </Rejilla>
        <div style={{ height: 14 }} />
        {cat.zonas.map((z, i) => (
          <Renglon key={z.id} onQuitar={() => set({ zonas: cat.zonas.filter((_, j) => j !== i) } as Partial<CatalogoCotizador>)}>
            <Campo etiqueta="Zona" ancho>
              <input
                style={input}
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
                style={input}
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
              style={input}
              value={cat.fletes_ton.join(', ')}
              onChange={(e) => set({ fletes_ton: e.target.value.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0) } as Partial<CatalogoCotizador>)}
            />
          </Campo>
          <Campo etiqueta="Material de banco · nombre">
            <input style={input} value={cat.material_banco.nombre} onChange={(e) => set({ material_banco: { ...cat.material_banco, nombre: e.target.value } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="Precio por m³">
            <input style={input} type="number" min="0" value={cat.material_banco.precio_m3_default} onChange={(e) => set({ material_banco: { ...cat.material_banco, precio_m3_default: Number(e.target.value) } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <Campo etiqueta="m³ del camión">
            <input style={input} type="number" min="0" value={cat.material_banco.camion_m3} onChange={(e) => set({ material_banco: { ...cat.material_banco, camion_m3: Number(e.target.value) } } as Partial<CatalogoCotizador>)} />
          </Campo>
          <CampoEquipos
            ligas={ligas}
            linea={LINEA_TRITURADOS}
            productos={cat.material_banco.productos}
            proveedorId={cat.material_banco.proveedor_id ?? null}
            onChange={(patch) => set({ material_banco: { ...cat.material_banco, ...patch } } as Partial<CatalogoCotizador>)}
          />
        </Rejilla>
        <div style={{ height: 14 }} />
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
        nota={
          ids.length === 0
            ? 'Sin equipos ligados. La solicitud va al proveedor de respaldo o queda por asignar.'
            : duenos.size > 1
              ? 'Varios aliados lo tienen: la solicitud queda por asignar y eliges tú.'
              : 'La solicitud se le ofrece a su dueño.'
        }
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          {ids.map((id) => {
            const e = porId.get(id);
            return (
              <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, border: `1px solid ${D.cardBorder}`, borderRadius: 999, padding: '4px 6px 4px 10px', color: e ? D.text : D.muted2 }}>
                {e ? `${e.name} · ${e.provider ?? 'sin aliado'}` : `Equipo #${id} (ya no está publicado)`}
                <button
                  type="button"
                  aria-label="Quitar equipo"
                  onClick={() => onChange({ productos: ids.filter((x) => x !== id) })}
                  style={{ background: 'none', border: 'none', color: D.muted2, cursor: 'pointer', fontSize: 15, lineHeight: 1 }}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
        <AdminSelect
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
    <Bloque titulo="Margen sobre el costo del aliado" ayuda="Cada máquina trae lo que cobra su aliado. Al publicarla, el precio al cliente se propone como ese costo más este porcentaje; se puede ajustar máquina por máquina.">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 140 }}>
          <input style={{ ...input, paddingRight: 30 }} type="number" min={0} max={300} step="1" value={margen} disabled={estado === 'cargando'} onChange={(e) => { setMargen(e.target.value); setEstado('listo'); }} />
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: D.muted2, fontSize: 13 }}>%</span>
        </div>
        <button type="button" onClick={() => void guardar()} disabled={estado === 'cargando' || estado === 'guardando' || margen === ''} style={boton}>
          {estado === 'guardando' ? 'Guardando…' : 'Guardar margen'}
        </button>
        {estado === 'ok' ? <span style={{ fontSize: 13, color: D.ok }}>Guardado.</span> : null}
        {estado === 'error' ? <span style={{ fontSize: 13, color: D.bad }}>No se pudo leer o guardar (¿falta correr el SQL de platform_settings?).</span> : null}
      </div>
    </Bloque>
  );
}

function Bloque({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: ReactNode }) {
  return (
    <section style={{ background: D.card, border: `1px solid ${D.cardBorder}`, borderRadius: 18, padding: 22, marginBottom: 16 }}>
      <h2 style={{ margin: 0, fontSize: 16, color: D.text }}>{titulo}</h2>
      {ayuda ? <p style={{ margin: '5px 0 16px', fontSize: 12.5, color: D.muted2, maxWidth: '78ch', lineHeight: 1.6 }}>{ayuda}</p> : <div style={{ height: 14 }} />}
      {children}
    </section>
  );
}

function Rejilla({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 13 }}>{children}</div>;
}

function Campo({ etiqueta, nota, ancho, children }: { etiqueta: string; nota?: string; ancho?: boolean; children: ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 6, gridColumn: ancho ? '1 / -1' : undefined, minWidth: 0 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: D.muted2 }}>{etiqueta}</span>
      {children}
      {nota ? <span style={{ fontSize: 11.5, color: D.muted }}>{nota}</span> : null}
    </label>
  );
}

function Renglon({ children, onQuitar }: { children: ReactNode; onQuitar: () => void }) {
  return (
    <div style={{ border: `1px solid ${D.cardBorder}`, borderRadius: 14, padding: 14, marginBottom: 11, background: D.inputBg }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 11 }}>{children}</div>
      <button type="button" onClick={onQuitar} style={{ marginTop: 10, border: 'none', background: 'transparent', color: D.muted2, cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}>
        <i className="ph ph-trash" /> Quitar
      </button>
    </div>
  );
}

function BotonAgregar({ texto, onClick }: { texto: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ ...boton, borderStyle: 'dashed', width: '100%' }}>
      <i className="ph ph-plus" /> {texto}
    </button>
  );
}

function Interruptor({ etiqueta, nota, on, onChange }: { etiqueta: string; nota?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, padding: '10px 0' }}>
      <button
        type="button"
        onClick={() => onChange(!on)}
        aria-pressed={on}
        style={{ position: 'relative', width: 44, height: 25, borderRadius: 999, border: 'none', cursor: 'pointer', background: on ? D.accent : 'rgba(255,255,255,0.12)', flexShrink: 0, marginTop: 2 }}
      >
        <span style={{ position: 'absolute', top: 3, left: on ? 22 : 3, width: 19, height: 19, borderRadius: 999, background: '#fff', transition: 'left .15s' }} />
      </button>
      <span>
        <b style={{ display: 'block', fontSize: 13.5, color: D.text, fontWeight: 600 }}>{etiqueta}</b>
        {nota ? <span style={{ fontSize: 12, color: D.muted2 }}>{nota}</span> : null}
      </span>
    </div>
  );
}

const input = {
  width: '100%', height: 42, padding: '0 12px', borderRadius: 10, border: `1px solid ${D.inputBorder}`,
  background: D.inputBg, color: D.text, fontFamily: 'inherit', fontSize: 13.5, outline: 'none',
} as const;

const boton = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 42, padding: '0 18px',
  borderRadius: 11, border: `1px solid ${D.cardBorder}`, background: 'transparent', color: D.text,
  fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
} as const;
