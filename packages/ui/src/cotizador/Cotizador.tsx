'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  calcularCotizacion,
  pasosDe,
  type CatalogoCotizador,
  type CatalogoMaquinaria,
  type CatalogoTriturados,
  type OpcionesCotizador,
  type PartidaCotizador,
} from '@maqserv/config';
import { ArrowLeft, ArrowRight, Check, Printer, RotateCcw } from 'lucide-react';
import { COTIZADOR_CSS } from './estilos';
import { DOCUMENTO_CSS, documentoCuerpo, imprimirDocumento, type DatosDocumento } from './documento';
import { money } from './formato';
import { IconoCotizador } from './iconos';
import { Aviso, Campo } from './piezas';
import { ShButton } from '../shadcn/button';
import { ShCombobox } from '../shadcn/combobox';
import { ShInput, ShTextarea } from '../shadcn/input';
import { ShSelect, ShSelectContent, ShSelectItem, ShSelectTrigger, ShSelectValue } from '../shadcn/select';
import {
  CONTEXTO_VACIO,
  aPartidas,
  lineaDeBanco,
  lineaDeEquipo,
  lineaDeMaterial,
  lineaDeServicio,
  lineaDeZona,
  num,
  type ContextoCotizador,
  type LineaCotizador,
  type LineaEquipo,
  type LineaMaquinaria,
  type LineaMaterial,
  type LineaServicio,
  type LineaTriturados,
} from './estado';
import { PasoDuracion, PasoEquipos, PasoServicios } from './pasos-maquinaria';
import { MODALIDADES, PasoEntrega, PasoMateriales, PasoModalidad, type Modalidad } from './pasos-triturados';

export interface ResultadoEnvio {
  folio: string;
  id?: number;
}

export interface DatosEnvio {
  contexto: ContextoCotizador;
  opciones: Partial<OpcionesCotizador>;
  partidas: PartidaCotizador[];
}

export interface CotizadorProps {
  catalogo: CatalogoCotizador;
  /** `panel` = lo arma un administrador; `sitio` = lo pide un visitante. */
  variante: 'panel' | 'sitio';
  /** Datos que ya se saben (cliente con sesión, obra desde un enlace). */
  inicial?: Partial<ContextoCotizador>;
  /** Logo para el documento (fondo claro). */
  logo?: string | null;
  onEnviar: (datos: DatosEnvio) => Promise<ResultadoEnvio>;
}

/**
 * EL COTIZADOR, PASO A PASO.
 *
 * Un solo componente para las dos apps y los dos cotizadores. Lo que cambia
 * entre ellos —qué se pregunta en cada paso— vive en `pasos-maquinaria` y
 * `pasos-triturados`; lo que comparten —el avance, el resumen en vivo, el
 * documento y el envío— vive aquí.
 *
 * POR QUÉ POR PASOS y no todo en una pantalla, que es como venía: el precio de
 * un equipo depende de cuántos días se renta (1-5 día, 6-15 semana, 16+ mes), y
 * en la pantalla única el usuario veía la tarifa moverse sola mientras
 * tecleaba, sin saber por qué. Separando "qué equipo" de "cuánto tiempo", el
 * tramo se anuncia cuando se decide.
 *
 * El cálculo corre EN EL NAVEGADOR mientras se edita (mismo motor que la API,
 * importado de `@maqserv/config`) y el servidor lo repite al guardar. No es
 * duplicación: es la misma función ejecutada en dos sitios, y la del servidor
 * es la que manda.
 */
export function Cotizador({ catalogo, variante, inicial, logo, onEnviar }: CotizadorProps) {
  const tipo = catalogo.tipo;
  const pasos = pasosDe(tipo);
  const esPanel = variante === 'panel';
  // En el panel siempre hay precios; en el sitio manda el tabulador (y cuando
  // dice que no, la API ya mandó el catálogo en ceros: aquí no hay nada que
  // esconder porque nunca llegó).
  const verPrecios = esPanel || catalogo.publico.mostrarPrecios;

  const [paso, setPaso] = useState(0);
  const [ctx, setCtx] = useState<ContextoCotizador>({ ...CONTEXTO_VACIO, ...inicial });
  const [lineas, setLineas] = useState<LineaCotizador[]>([]);
  const [modalidades, setModalidades] = useState<Modalidad[]>([]);
  const [modoUnidad, setModoUnidad] = useState<'horas' | 'dias'>('horas');
  const [conIva, setConIva] = useState(tipo === 'triturados' ? (catalogo as CatalogoTriturados).iva_por_defecto : true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tocado, setTocado] = useState(false);
  const [hecho, setHecho] = useState<ResultadoEnvio | null>(null);

  /**
   * La barra de pasos se centra sola en el paso actual.
   *
   * Al ir en UNA fila que se desplaza, en un teléfono solo se ven dos o tres
   * de los cinco: sin esto, al avanzar al paso 4 la barra seguía enseñando el
   * 1 y el 2 y parecía que no había pasado nada.
   *
   * Se mueve el CONTENEDOR y no se usa `scrollIntoView`, que además desplaza
   * la página en vertical y daría un salto en cada paso.
   */
  const barraPasos = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const cont = barraPasos.current;
    const activo = cont?.querySelector<HTMLElement>('[data-estado="activo"]');
    if (!cont || !activo) return;
    cont.scrollTo({
      left: activo.offsetLeft - (cont.clientWidth - activo.offsetWidth) / 2,
      behavior: 'smooth',
    });
  }, [paso]);

  const opciones: Partial<OpcionesCotizador> = tipo === 'maquinaria' ? { modo_unidad: modoUnidad } : { con_iva: conIva };
  const partidas = useMemo(() => aPartidas(lineas), [lineas]);
  const calc = useMemo(() => calcularCotizacion(catalogo, partidas, opciones), [catalogo, partidas, modoUnidad, conIva]);

  // ---- edición de líneas ----
  const agregar = (l: LineaCotizador) => setLineas((prev) => [...prev, l]);
  const quitar = (uid: number) => setLineas((prev) => prev.filter((l) => l.uid !== uid));
  const actualizar = (uid: number, patch: Record<string, unknown>) =>
    setLineas((prev) => prev.map((l) => (l.uid === uid ? ({ ...l, ...patch } as LineaCotizador) : l)));

  /**
   * Elegir / quitar desde la tarjeta del catálogo.
   *
   * Tocar de nuevo lo que ya elegiste es el gesto que todo el mundo intenta
   * primero, y antes no hacía nada: la tarjeta solo sumaba y el contador subía
   * sin forma de bajarlo. Para quitar algo había que avanzar al paso siguiente
   * y buscar su ✕, que nadie encuentra si no sabe que está ahí.
   *
   * Quita TODAS las partidas de ese equipo/material, no la última: el contador
   * que se ve en la tarjeta es de ese conjunto, y dejar una a medias haría que
   * el número bajara sin que la tarjeta se apagara.
   */
  const alternar = (coincide: (l: LineaCotizador) => boolean, crear: () => LineaCotizador) =>
    setLineas((prev) => (prev.some(coincide) ? prev.filter((l) => !coincide(l)) : [...prev, crear()]));

  const esEquipo = (id: string) => (l: LineaCotizador) => l.tipo === 'equipo' && l.id === id;
  const esServicio = (id: string) => (l: LineaCotizador) => l.tipo === 'servicio' && l.id === id;
  const esMaterial = (id: string) => (l: LineaCotizador) => l.tipo === 'material' && l.id === id;

  /**
   * Al deseleccionar una modalidad se tiran sus partidas.
   *
   * Conservarlas parece más amable, pero entonces el documento saldría con
   * renglones de una modalidad que el usuario ya dijo que no quiere — y como
   * el paso siguiente deja de mostrarlos, no tendría cómo quitarlos.
   */
  const alternarModalidad = (m: Modalidad) => {
    setModalidades((prev) => {
      const fuera = prev.includes(m);
      if (fuera) setLineas((ls) => ls.filter((l) => l.tipo !== m));
      return fuera ? prev.filter((x) => x !== m) : [...prev, m];
    });
  };

  // ---- validación por paso ----
  const clave = pasos[paso]?.clave ?? '';
  const faltante = useMemo(() => validar(clave, { ctx, lineas, modalidades, esPanel, calc }), [clave, ctx, lineas, modalidades, esPanel, calc]);
  const puedeAvanzar = faltante === null;

  const avanzar = () => {
    setTocado(true);
    if (!puedeAvanzar) return;
    setTocado(false);
    setPaso((p) => Math.min(pasos.length - 1, p + 1));
  };
  const retroceder = () => {
    setTocado(false);
    setPaso((p) => Math.max(0, p - 1));
  };

  // ---- documento ----
  const datosDoc = (folio: string): DatosDocumento => ({
    titulo: tipo === 'maquinaria' ? 'Cotización de maquinaria' : 'Cotización de triturados',
    folio,
    cliente: ctx.cliente,
    obra: ctx.obra,
    atencion: ctx.atencion,
    municipio: ctx.municipio,
    notas: ctx.notas,
    empresa: catalogo.empresa,
    firma: catalogo.firma,
    saludo: catalogo.saludo,
    calc,
    mostrarPrecios: verPrecios,
    logo: logo ?? null,
    acento: leerAcento(),
  });

  const imprimir = (folio: string) => {
    if (!imprimirDocumento(datosDoc(folio))) {
      setError('El navegador bloqueó la ventana del documento. Permite las ventanas emergentes de este sitio e inténtalo otra vez.');
    }
  };

  // ---- envío ----
  async function enviar() {
    setTocado(true);
    if (faltante) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await onEnviar({ contexto: ctx, opciones, partidas });
      setHecho(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la cotización.');
    } finally {
      setEnviando(false);
    }
  }

  function reiniciar() {
    setHecho(null);
    setLineas([]);
    setModalidades([]);
    setCtx({ ...CONTEXTO_VACIO, ...inicial });
    setPaso(0);
    setError(null);
  }

  // ---- acuse ----
  if (hecho) {
    return (
      <div className="cz" data-variante={variante}>
        <style>{COTIZADOR_CSS}</style>
        <div className="cz-card cz-done">
          <div className="mark"><Check className="size-8" /></div>
          <h2>{esPanel ? 'Cotización guardada' : 'Solicitud enviada'}</h2>
          <p>
            {esPanel
              ? 'Ya está en el historial del cotizador. Imprímela o guárdala como PDF para enviársela al cliente.'
              : 'Un asesor de MAQSER24 se pondrá en contacto contigo. Guarda tu folio para darle seguimiento.'}
          </p>
          <div className="cz-folio">{hecho.folio}</div>
          <div className="cz-done-acts">
            <ShButton onClick={() => imprimir(hecho.folio)}>
              <Printer className="size-4" /> Imprimir / Guardar PDF
            </ShButton>
            <ShButton variant="outline" onClick={reiniciar}>
              <RotateCcw className="size-4" /> Nueva cotización
            </ShButton>
          </div>
          {error ? (
            <div style={{ marginTop: 16 }}>
              <Aviso tono="bad">{error}</Aviso>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const esUltimo = paso === pasos.length - 1;

  return (
    <div className="cz" data-variante={variante}>
      <style>{COTIZADOR_CSS}</style>

      <ol className="cz-steps" ref={barraPasos}>
        {pasos.map((p, i) => {
          const estado = i === paso ? 'activo' : i < paso ? 'hecho' : 'pendiente';
          return (
            <li key={p.clave} className="cz-step" data-estado={estado}>
              {/* Se puede volver a un paso ya hecho, nunca saltar hacia adelante:
                  lo de adelante depende de lo que se conteste antes. */}
              <button
                type="button"
                disabled={i >= paso}
                onClick={() => i < paso && setPaso(i)}
                aria-current={i === paso ? 'step' : undefined}
                // El número por sí solo no dice en cuál vas ni cuántos faltan:
                // el color no es información para quien no lo distingue.
                aria-label={`Paso ${i + 1} de ${pasos.length}: ${p.titulo}${estado === 'hecho' ? ' (completado)' : ''}`}
              >
                <span className="cz-step-n" aria-hidden>
                  {estado === 'hecho' ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span className="cz-step-t">{p.titulo}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* La ayuda del paso va FUERA de la rejilla, a todo el ancho. Dentro de
          la columna izquierda empujaba esa columna hacia abajo y las dos
          tarjetas —la del paso y el resumen— arrancaban a alturas distintas. */}
      <p className="cz-sub cz-ayuda">{pasos[paso]?.ayuda}</p>

      <div className="cz-grid">
        <div>
          {clave === 'obra' ? (
            <PasoObra ctx={ctx} setCtx={setCtx} catalogo={catalogo} pideContacto={!esPanel} tocado={tocado} />
          ) : null}

          {tipo === 'maquinaria' && clave === 'equipos' ? (
            <PasoEquipos
              cat={catalogo as CatalogoMaquinaria}
              lineas={lineas as LineaMaquinaria[]}
              mostrarPrecios={verPrecios}
              alternar={(id) => alternar(esEquipo(id), () => lineaDeEquipo(id))}
              agregarOtra={(id) => agregar(lineaDeEquipo(id))}
            />
          ) : null}

          {tipo === 'maquinaria' && clave === 'duracion' ? (
            <PasoDuracion
              cat={catalogo as CatalogoMaquinaria}
              lineas={lineas as LineaMaquinaria[]}
              mostrarPrecios={verPrecios}
              actualizar={(uid, patch) => actualizar(uid, patch as Partial<LineaEquipo>)}
              quitar={quitar}
            />
          ) : null}

          {tipo === 'maquinaria' && clave === 'servicios' ? (
            <PasoServicios
              cat={catalogo as CatalogoMaquinaria}
              lineas={lineas as LineaMaquinaria[]}
              mostrarPrecios={verPrecios}
              alternar={(id) => alternar(esServicio(id), () => lineaDeServicio(catalogo as CatalogoMaquinaria, id))}
              actualizar={(uid, patch) => actualizar(uid, patch as Partial<LineaServicio>)}
              quitar={quitar}
            />
          ) : null}

          {tipo === 'triturados' && clave === 'modalidad' ? (
            <PasoModalidad seleccion={modalidades} alternar={alternarModalidad} />
          ) : null}

          {tipo === 'triturados' && clave === 'materiales' ? (
            <PasoMateriales
              cat={catalogo as CatalogoTriturados}
              lineas={lineas as LineaTriturados[]}
              modalidades={modalidades}
              mostrarPrecios={verPrecios}
              alternarMaterial={(id) => alternar(esMaterial(id), () => lineaDeMaterial(catalogo as CatalogoTriturados, id))}
              agregarZona={() => agregar(lineaDeZona(catalogo as CatalogoTriturados))}
              agregarBanco={() => agregar(lineaDeBanco(catalogo as CatalogoTriturados))}
              actualizar={actualizar}
              quitar={quitar}
            />
          ) : null}

          {tipo === 'triturados' && clave === 'entrega' ? (
            <PasoEntrega
              cat={catalogo as CatalogoTriturados}
              lineas={lineas as LineaTriturados[]}
              mostrarPrecios={verPrecios}
              actualizar={(uid, patch) => actualizar(uid, patch as Partial<LineaMaterial>)}
              conIva={conIva}
              setConIva={setConIva}
            />
          ) : null}

          {clave === 'resumen' ? (
            <div className="cz-card">
              <h2 className="cz-card-h">Así queda el documento</h2>
              <p className="cz-card-s">
                {esPanel
                  ? 'Revísalo antes de guardarlo. Al guardar se congela: aunque mañana suba una tarifa, esta cotización seguirá diciendo lo mismo.'
                  : 'Revisa que todo esté correcto antes de enviar tu solicitud.'}
              </p>

              {tipo === 'maquinaria' && verPrecios ? (
                <Campo label="Presentar cantidades en" help="Cómo se ven las cantidades en el documento; el total no cambia.">
                  {(id) => (
                    <ShSelect value={modoUnidad} onValueChange={(v) => setModoUnidad(v as 'horas' | 'dias')}>
                      <ShSelectTrigger id={id} className="max-w-xs">
                        <ShSelectValue />
                      </ShSelectTrigger>
                      <ShSelectContent>
                        <ShSelectItem value="horas">Horas (HRS)</ShSelectItem>
                        <ShSelectItem value="dias">Jornadas (JOR)</ShSelectItem>
                      </ShSelectContent>
                    </ShSelect>
                  )}
                </Campo>
              ) : null}

              <div style={{ marginTop: 14 }}>
                <Campo label="Notas para el cliente (opcional)" ancho="full">
                  {(id) => (
                    <ShTextarea
                      id={id}
                      value={ctx.notas}
                      maxLength={2000}
                      placeholder="Vigencia, condiciones especiales, contacto en obra…"
                      onChange={(e) => setCtx({ ...ctx, notas: e.target.value })}
                    />
                  )}
                </Campo>
              </div>

              <div className="cz-preview" style={{ marginTop: 16 }}>
                {/* El MISMO generador que la impresión: lo que se ve aquí es,
                    literalmente, lo que sale por la impresora. */}
                <div dangerouslySetInnerHTML={{ __html: `<style>${DOCUMENTO_CSS}</style>${documentoCuerpo(datosDoc('BORRADOR'))}` }} />
              </div>

              {error ? (
                <div style={{ marginTop: 14 }}>
                  <Aviso tono="bad">{error}</Aviso>
                </div>
              ) : null}
            </div>
          ) : null}

          {tocado && faltante ? (
            <div style={{ marginTop: 14 }}>
              <Aviso tono="bad">{faltante}</Aviso>
            </div>
          ) : null}

          <div className="cz-nav">
            <ShButton variant="outline" onClick={retroceder} disabled={paso === 0 || enviando}>
              <ArrowLeft className="size-4" /> Atrás
            </ShButton>
            {esUltimo ? (
              <ShButton onClick={enviar} disabled={enviando}>
                {enviando ? 'Enviando…' : esPanel ? 'Guardar cotización' : 'Enviar solicitud'}
              </ShButton>
            ) : (
              <ShButton onClick={avanzar}>
                Continuar <ArrowRight className="size-4" />
              </ShButton>
            )}
          </div>
        </div>

        <ResumenLateral
          calc={calc}
          tipo={tipo}
          verPrecios={verPrecios}
          partidas={partidas.length}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** PASO 1 · para quién y dónde. Igual en los dos cotizadores. */
function PasoObra({
  ctx,
  setCtx,
  catalogo,
  pideContacto,
  tocado,
}: {
  ctx: ContextoCotizador;
  setCtx: (c: ContextoCotizador) => void;
  catalogo: CatalogoCotizador;
  pideContacto: boolean;
  tocado: boolean;
}) {
  const set = (patch: Partial<ContextoCotizador>) => setCtx({ ...ctx, ...patch });
  const malCorreo = tocado && pideContacto && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ctx.correo.trim());
  return (
    <div className="cz-card">
      <h2 className="cz-card-h">Datos de la obra</h2>
      <p className="cz-card-s">Es lo que sale impreso en el encabezado de la cotización.</p>
      <div className="cz-row">
        <Campo label="Cliente o empresa" req ancho="full" error={tocado && ctx.cliente.trim().length < 2 ? 'Escribe a nombre de quién va la cotización.' : null}>
          {(id) => (
            <ShInput id={id} value={ctx.cliente} maxLength={190} placeholder="Ej. Constructora del Norte" onChange={(e) => set({ cliente: e.target.value })} />
          )}
        </Campo>
        <Campo label="Obra o proyecto">
          {(id) => (
            <ShInput id={id} value={ctx.obra} maxLength={190} placeholder="Ej. Fraccionamiento Los Encinos" onChange={(e) => set({ obra: e.target.value })} />
          )}
        </Campo>
        <Campo label="Atención a">
          {(id) => <ShInput id={id} value={ctx.atencion} maxLength={190} placeholder="Ing. / Lic." onChange={(e) => set({ atencion: e.target.value })} />}
        </Campo>
        {/* Combobox y no `<input list>`: el datalist lo dibuja el sistema
            operativo y sobre el sitio oscuro abría una lista blanca de Windows
            que ningún CSS alcanza. Sigue admitiendo texto libre, que aquí hace
            falta: la cobertura cambia y el catálogo de municipios va detrás. */}
        <Campo label="Municipio de entrega" help="Define la zona de flete">
          {(id) => (
            <ShCombobox
              id={id}
              value={ctx.municipio}
              onChange={(v) => set({ municipio: v })}
              options={catalogo.municipios}
              placeholder="Ej. Apodaca"
              buscar="Busca o escribe el municipio…"
            />
          )}
        </Campo>
        {pideContacto ? (
          <>
            <Campo label="Correo" req error={malCorreo ? 'Escribe un correo válido para poder contestarte.' : null}>
              {(id) => (
                <ShInput id={id} type="email" value={ctx.correo} maxLength={190} placeholder="tu@empresa.com" aria-invalid={malCorreo} onChange={(e) => set({ correo: e.target.value })} />
              )}
            </Campo>
            <Campo label="Teléfono" req error={tocado && ctx.telefono.trim().length < 7 ? 'Necesitamos un teléfono de contacto.' : null}>
              {(id) => (
                <ShInput id={id} type="tel" value={ctx.telefono} maxLength={40} placeholder="81 0000 0000" onChange={(e) => set({ telefono: e.target.value })} />
              )}
            </Campo>
          </>
        ) : (
          <>
            <Campo label="Correo del cliente (opcional)">
              {(id) => <ShInput id={id} type="email" value={ctx.correo} maxLength={190} onChange={(e) => set({ correo: e.target.value })} />}
            </Campo>
            <Campo label="Teléfono del cliente (opcional)">
              {(id) => <ShInput id={id} type="tel" value={ctx.telefono} maxLength={40} onChange={(e) => set({ telefono: e.target.value })} />}
            </Campo>
          </>
        )}
      </div>
    </div>
  );
}

/** Resumen en vivo. Acompaña todos los pasos: el total nunca es una sorpresa. */
function ResumenLateral({
  calc,
  tipo,
  verPrecios,
  partidas,
}: {
  calc: ReturnType<typeof calcularCotizacion>;
  tipo: 'maquinaria' | 'triturados';
  verPrecios: boolean;
  partidas: number;
}) {
  const vacio = calc.renglones.length === 0;
  return (
    <aside className="cz-side">
      <div className="cz-side-h">
        <h3>{verPrecios ? 'Resumen' : 'Tu solicitud'}</h3>
        <span>{partidas === 1 ? '1 partida' : `${partidas} partidas`}</span>
      </div>
      {vacio ? (
        <div className="cz-side-empty">
          <span className="ico">
            <IconoCotizador nombre="documento" size={38} />
          </span>
          Todavía no hay partidas. Conforme agregues, el total aparece aquí.
        </div>
      ) : (
        <div className="cz-side-b">
          {verPrecios ? (
            <>
              {tipo === 'maquinaria' ? (
                <>
                  <div className="cz-fr">
                    <span>Renta de equipos</span>
                    <b>{money(calc.desglose.renta)}</b>
                  </div>
                  {calc.desglose.servicios > 0 ? (
                    <div className="cz-fr">
                      <span>Servicios</span>
                      <b>{money(calc.desglose.servicios)}</b>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="cz-fr">
                  <span>Materiales</span>
                  <b>{money(calc.desglose.materiales)}</b>
                </div>
              )}
              {calc.desglose.fletes > 0 ? (
                <div className="cz-fr">
                  <span>Fletes</span>
                  <b>{money(calc.desglose.fletes)}</b>
                </div>
              ) : null}
              <div className="cz-fr">
                <span>Subtotal</span>
                <b>{money(calc.subtotal)}</b>
              </div>
              {calc.con_iva ? (
                <div className="cz-fr">
                  <span>IVA {Math.round(calc.iva_tasa * 100)}%</span>
                  <b>{money(calc.iva)}</b>
                </div>
              ) : (
                <div className="cz-fr">
                  <span>Sin IVA</span>
                  <b>remisionado</b>
                </div>
              )}
              <div className="cz-fr total">
                <span>Total</span>
                <b>{money(calc.total)}</b>
              </div>
            </>
          ) : (
            <>
              {calc.renglones
                .filter((r) => r.clase !== 'flete')
                .map((r, i) => (
                  <div className="cz-fr" key={i}>
                    <span>{r.nombre ?? r.concepto}</span>
                    <b>
                      {r.cantidad} {r.unidad}
                    </b>
                  </div>
                ))}
              <div className="cz-fr total" style={{ fontSize: 13 }}>
                <span>Un asesor te enviará el precio</span>
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------

/**
 * Qué falta para poder continuar. Devuelve el motivo o `null`.
 *
 * El mensaje se guarda hasta que la persona intenta avanzar (`tocado`): marcar
 * en rojo un formulario que aún no se ha tocado es regañar por adelantado.
 */
function validar(
  clave: string,
  d: {
    ctx: ContextoCotizador;
    lineas: LineaCotizador[];
    modalidades: Modalidad[];
    esPanel: boolean;
    calc: ReturnType<typeof calcularCotizacion>;
  },
): string | null {
  const { ctx, lineas, modalidades, esPanel, calc } = d;

  if (clave === 'obra') {
    if (ctx.cliente.trim().length < 2) return 'Escribe a nombre de quién va la cotización.';
    if (!esPanel) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ctx.correo.trim())) return 'Necesitamos un correo válido para enviarte la cotización.';
      if (ctx.telefono.trim().length < 7) return 'Necesitamos un teléfono de contacto.';
    }
    return null;
  }

  if (clave === 'equipos') {
    return lineas.some((l) => l.tipo === 'equipo') ? null : 'Elige al menos un equipo para continuar.';
  }

  if (clave === 'duracion') {
    const sinTiempo = lineas.filter((l) => l.tipo === 'equipo' && l.dias < 1 && l.horas < 1);
    return sinTiempo.length > 0 ? 'Hay equipos sin días ni horas: sin duración no se pueden cotizar.' : null;
  }

  if (clave === 'modalidad') {
    return modalidades.length > 0
      ? null
      : `Elige cómo se entrega: ${MODALIDADES.map((m) => m.titulo.toLowerCase()).join(', ')}.`;
  }

  if (clave === 'materiales') {
    if (lineas.length === 0) return 'Agrega al menos un material.';
    const sinNombre = lineas.some((l) => l.tipo === 'material' && l.id === 'custom' && !l.nombre.trim());
    if (sinNombre) return 'Ponle nombre al material personalizado.';
    const sinCantidad = lineas.some(
      (l) => (l.tipo === 'material' && num(l.toneladas) <= 0) || (l.tipo === 'banco' && num(l.m3) <= 0),
    );
    if (sinCantidad) return 'Hay partidas sin cantidad: captura las toneladas o los m³.';
    return null;
  }

  if (clave === 'resumen') {
    return calc.renglones.length > 0 ? null : 'La cotización está vacía. Regresa y agrega partidas.';
  }

  return null;
}

/**
 * El azul de marca, leído del tema en runtime.
 *
 * El documento se genera como HTML suelto (ventana de impresión), fuera del
 * árbol de la app, así que ahí `var(--color-primary)` no resuelve a nada: hay
 * que leer el valor y escribirlo. Si por lo que sea no está, cae al azul
 * eléctrico del manual de identidad.
 */
function leerAcento(): string {
  if (typeof window === 'undefined') return '#008CFF';
  const v = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
  return v || '#008CFF';
}
