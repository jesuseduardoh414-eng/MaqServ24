'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  calcularCotizacion,
  condicionesSinPrecios,
  conZonaDeLaObra,
  esUbicacionDeMapas,
  faltaZona,
  llevaFlete,
  pasosDe,
  problemaEmail,
  problemaTelefono,
  soloVisibles,
  SERVICIO_A_MANO,
  type CalculoCotizacion,
  type CatalogoCotizador,
  type CatalogoMaquinaria,
  type CatalogoTriturados,
  type OpcionesCotizador,
  type PartidaCotizador,
} from '@maqserv/config';
import { ArrowLeft, ArrowRight, Check, Download, MessageCircle, Printer, RotateCcw } from 'lucide-react';
import { COTIZADOR_CSS } from './estilos';
import { DOCUMENTO_CSS, documentoCuerpo, imprimirDocumento, type DatosDocumento } from './documento';
import { compartirArchivo, descargarArchivo, documentoPdf } from './pdf';
import { money } from './formato';
import { IconoCotizador } from './iconos';
import { Aviso, Campo } from './piezas';
import { ShButton } from '../shadcn/button';
import { ShCombobox } from '../shadcn/combobox';
import { ShInput, ShTextarea } from '../shadcn/input';
import { ShSelect, ShSelectContent, ShSelectItem, ShSelectTrigger, ShSelectValue } from '../shadcn/select';
import { ShDatePicker } from '../shadcn/date-picker';
import {
  CONTEXTO_VACIO,
  aPartidas,
  lineaDeBanco,
  lineaDeEquipo,
  lineaDeMaterial,
  lineaDeServicio,
  lineaDeServicioAMano,
  lineaDeZona,
  nuevoUid,
  num,
  type ClientePanel,
  type ContextoCotizador,
  type EmpresaCliente,
  type LineaCotizador,
  type LineaEquipo,
  type LineaMaquinaria,
  type LineaMaterial,
  type LineaServicio,
  type LineaTriturados,
} from './estado';
import { PasoDuracion, PasoEquipos, PasoServicios, ServiciosDelInicio } from './pasos-maquinaria';
import { AjustesDelTotal, Facturacion, PasoPedido, entregaDecidida } from './pasos-triturados';

/**
 * Correo y teléfono del contacto, con las reglas de la API (@maqserv/config).
 * Antes bastaban 7 caracteres para el teléfono. En el sitio son obligatorios;
 * en el panel no, pero si se escriben tienen que estar bien.
 */
function errorContacto(campo: 'correo' | 'telefono', valor: string, obligatorio: boolean): string | null {
  if (!valor.trim()) {
    if (!obligatorio) return null;
    return campo === 'correo' ? 'Necesitamos un correo para enviarte la cotización.' : 'Necesitamos un teléfono de contacto.';
  }
  return campo === 'correo' ? problemaEmail(valor) : problemaTelefono(valor);
}

export interface ResultadoEnvio {
  folio: string;
  id?: number;
  /** Sitio: a dónde sigue el cliente su solicitud (Mi cuenta). */
  enlace?: { href: string; label: string };
}

export interface DatosEnvio {
  contexto: ContextoCotizador;
  opciones: Partial<OpcionesCotizador>;
  partidas: PartidaCotizador[];
}

export interface CotizadorProps {
  catalogo: CatalogoCotizador;
  /**
   * `panel` = lo arma un administrador; `sitio` = lo pide un cliente con
   * cuenta (desde el 2026-09-23 la página no lo pinta sin sesión) y lo que
   * sale es la SOLICITUD DEL SERVICIO con esa cotización.
   */
  variante: 'panel' | 'sitio';
  /** Datos que ya se saben (cliente con sesión, obra desde un enlace). */
  inicial?: Partial<ContextoCotizador>;
  /** Partidas con las que abre (2026-10-22): el tipo desde el que se llegó del catálogo. */
  lineasIniciales?: LineaCotizador[];
  /**
   * Sitio (2026-10-23): las empresas de la cuenta con sus obras. Con esto el
   * paso 1 pide empresa y obra de un seleccionador (o una nueva) y la obra es
   * obligatoria. El panel no lo pasa y sigue con campos de texto.
   */
  empresas?: EmpresaCliente[];
  /**
   * Panel (2026-10-23): los clientes registrados y cómo leer las obras de uno.
   * Con esto el paso 1 elige cliente y obra (o los escribe nuevos, y se dan
   * de alta al guardar). Sin esto, campos de texto como antes.
   */
  clientesPanel?: { lista: ClientePanel[]; obras: (clienteId: number) => Promise<EmpresaCliente['sites']> };
  /** Logo para el documento (fondo claro). */
  logo?: string | null;
  /**
   * Sin el campo de la ubicación en Google Maps (2026-10-29): el acceso
   * directo instalado en el celular del encargado no lo pide. El panel y el
   * sitio sí (en el panel es opcional).
   */
  sinUbicacion?: boolean;
  /**
   * Solo precios (el acceso directo, 2026-10-29: "no debe aparecer el botón de
   * guardar, solo es para saber precios"): no se guarda nada; al final el
   * documento, sin folio, se manda por WhatsApp o se descarga en PDF.
   *
   * El paso «Datos de la obra» SÍ va (2026-10-30, pedido del dueño: "el
   * cliente siempre debe ir en el documento"); un día se quitó y se regresó.
   */
  soloPrecios?: boolean;
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
 * POR QUÉ POR PASOS y no todo en una pantalla, que es como venía: separando
 * "qué equipo" de "cuánto tiempo", lo que cambia el precio (las horas y su
 * mínimo; antes, el tramo día/semana/mes) se anuncia cuando se decide.
 *
 * El cálculo corre EN EL NAVEGADOR mientras se edita (mismo motor que la API,
 * importado de `@maqserv/config`) y el servidor lo repite al guardar. No es
 * duplicación: es la misma función ejecutada en dos sitios, y la del servidor
 * es la que manda.
 */
export function Cotizador({ catalogo, variante, inicial, lineasIniciales, empresas, clientesPanel, logo, sinUbicacion = false, soloPrecios = false, onEnviar }: CotizadorProps) {
  const tipo = catalogo.tipo;
  const pasos = pasosDe(tipo);
  const esPanel = variante === 'panel';

  /**
   * DOS PREGUNTAS DISTINTAS, que antes eran una sola.
   *
   * `verPrecios` — si esta cotización LLEVA importes. Solo en el panel: desde
   * el 2026-10-23 el sitio NUNCA enseña precios (la API ya manda el catálogo en
   * ceros: aquí no hay nada que esconder porque nunca llegó). El cliente pide,
   * MAQSER24 revisa el precio en Solicitudes y se lo manda para que lo acepte.
   *
   * `preciosEnPasos` — si esos importes acompañan la CAPTURA. Solo en el
   * panel, que es la herramienta con la que se fija y se negocia la tarifa. En
   * el sitio el visitante elige equipo, tiempo y cantidades SIN ver un peso; de
   * paso desaparecen del navegador los campos de precio negociado, que ahí
   * nunca debieron poder tocarse.
   *
   * `preciosAlFinal` era el sitio con tabulador público (el costo de una vez en
   * el último paso). Ya no ocurre; se queda para que el código que lo pinta no
   * dependa de quién llama.
   *
   * PRECIOS DE LISTA EN EL SITIO (2026-10-29, Dirección): "el cotizador para
   * los clientes debe mostrar los costos, ya que son los fijos". Con el
   * interruptor del tabulador encendido (`publico.mostrarPrecios`) la API manda
   * los precios y el visitante los ve mientras arma su pedido. Lo que SIGUE
   * siendo solo del panel es CAMBIARLOS (`editarPrecios`): costo/hora,
   * precio del servicio o del material y la tarifa del flete por cotización.
   */
  const verPrecios = esPanel || catalogo.publico.mostrarPrecios;
  const preciosEnPasos = verPrecios;
  const editarPrecios = esPanel;
  const preciosAlFinal = verPrecios && !preciosEnPasos;
  /** El sitio con precios de lista: total grande al final y la nota para mejorar el precio. */
  const sitioConPrecios = verPrecios && !esPanel;

  const [paso, setPaso] = useState(0);
  const [ctx, setCtx] = useState<ContextoCotizador>({ ...CONTEXTO_VACIO, ...inicial });
  const [lineas, setLineas] = useState<LineaCotizador[]>(lineasIniciales ?? []);
  /** El renglón de material recién agregado: su selector se abre solo. */
  const [nuevo, setNuevo] = useState<number | null>(null);
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
  // El agua sin zona elegida a mano toma la del municipio de la obra (2026-10-29).
  const partidas = useMemo(() => conZonaDeLaObra(catalogo, aPartidas(lineas), ctx.municipio), [catalogo, lineas, ctx.municipio]);
  // Triturados con flete: la ubicación en Google Maps va en el documento (2026-10-29).
  const ubicacionValida = tipo === 'triturados' && llevaFlete(partidas) && esUbicacionDeMapas(ctx.ubicacion);
  const calc = useMemo(() => calcularCotizacion(catalogo, partidas, opciones), [catalogo, partidas, modoUnidad, conIva]);
  /**
   * LO QUE SE ENSEÑA EN EL SITIO (2026-10-23). El tabulador llega en ceros y el
   * motor descarta los renglones de importe cero —servicios, material por
   * tonelada, banco—, así que el documento y el resumen salían vacíos y el
   * último paso decía "la cotización está vacía". Para conceptos y cantidades
   * se calcula con un tabulador de precio simbólico y se borran los importes:
   * nada de esto es un precio, el de verdad lo pone el servidor.
   */
  const calcVista = useMemo(
    () => (verPrecios ? calc : sinImportes(calcularCotizacion(conPrecioSimbolico(catalogo), partidas, opciones))),
    [verPrecios, calc, catalogo, partidas, modoUnidad, conIva],
  );
  /**
   * Lo que se puede ELEGIR: sin lo que su ficha sacó del cotizador
   * (2026-10-19). El cálculo sigue con el tabulador completo, y lo que ya trae
   * la cotización se queda en la lista aunque esté oculto.
   */
  const paraElegir = useMemo(
    () => soloVisibles(catalogo, lineas.map((l) => (l.tipo === 'zona' ? l.productoId : 'id' in l ? l.id : ''))),
    [catalogo, lineas],
  );

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

  /**
   * Triturados: un material por tonelada nace sin elegir (su selector se abre
   * solo) y hereda el flete que ya tenga la sección, que es uno por obra.
   */
  const agregarMaterial = () => {
    const uid = nuevoUid();
    setLineas((prev) => {
      const otro = prev.find((l): l is LineaMaterial => l.tipo === 'material');
      // Los materiales del tabulador se eligen en sus tarjetas; este botón es el de
      // "Otro material (nombre y precio a mano)": nace escrito a mano, sin lista
      // para elegir (2026-10-30, pedido del dueño).
      const linea: LineaMaterial = {
        uid, tipo: 'material', id: 'custom', nombre: '', precio: '', toneladas: '',
        fleteTon: otro?.fleteTon ?? 0, fleteZona: otro?.fleteZona ?? '',
      };
      return [...prev, linea];
    });
    setNuevo(uid);
  };

  /**
   * Triturados con tarjetas, como la maquinaria (2026-10-29): tocar un
   * material lo agrega (con el flete que ya tenga la sección) y tocarlo otra
   * vez lo quita.
   */
  const alternarMaterial = (id: string) => {
    const uid = nuevoUid();
    setLineas((prev) => {
      if (prev.some((l) => l.tipo === 'material' && l.id === id)) return prev.filter((l) => !(l.tipo === 'material' && l.id === id));
      const otro = prev.find((l): l is LineaMaterial => l.tipo === 'material');
      const base = lineaDeMaterial(catalogo as CatalogoTriturados, id);
      return [...prev, { ...base, uid, fleteTon: otro?.fleteTon ?? 0, fleteZona: otro?.fleteZona ?? '' }];
    });
    setNuevo(uid);
  };

  // ---- validación por paso ----
  const clave = pasos[paso]?.clave ?? '';

  /**
   * La ayuda del paso, corregida cuando el costo va al final: el paso de
   * entrega ya no elige flete ni factura —son un precio y se mudaron al
   * resumen— y anunciarlos aquí mandaría a buscar algo que no está.
   */
  const ayuda =
    preciosAlFinal && clave === 'pedido'
      ? 'Qué material y cuánto. El costo, la tarifa del flete y la factura se ven en el último paso.'
      : preciosAlFinal && clave === 'resumen'
        ? 'Aquí aparece el costo. Revísalo antes de solicitar el servicio.'
        // En el sitio no se habla de tarifas ni de costo (2026-10-23).
        : !esPanel && clave === 'duracion'
          ? 'Cuántos días u horas necesitas cada equipo.'
          : !esPanel && clave === 'resumen'
            ? sitioConPrecios
              ? tipo === 'triturados'
                ? 'Dinos si necesitas factura y revisa tu cotización antes de enviarla.'
                : 'Revisa tu cotización antes de enviarla.'
              : tipo === 'triturados'
                ? 'Dinos si necesitas factura y revisa tu solicitud. El precio te lo mandamos por correo.'
                : 'Revisa tu solicitud antes de enviarla. El precio te lo mandamos por correo.'
            : (pasos[paso]?.ayuda ?? '');

  /** El desglose lateral, solo cuando el costo ya está a la vista. */
  const importesALaVista = verPrecios && (preciosEnPasos || clave === 'resumen');
  const faltante = useMemo(
    () => validar(clave, { ctx, lineas, esPanel, calc: calcVista, conClientes: !!clientesPanel, soloPrecios, zona: faltaZona(catalogo, partidas, ctx.municipio) }),
    [clave, ctx, lineas, esPanel, calcVista, clientesPanel, soloPrecios, catalogo, partidas],
  );
  const puedeAvanzar = faltante === null;

  /**
   * Al cambiar de paso, la pantalla sube a la barra de pasos (2026-10-28): en el
   * teléfono se quedaba en el botón "Continuar" y el paso nuevo empezaba más arriba.
   */
  const primerPaso = useRef(true);
  useEffect(() => {
    if (primerPaso.current) { primerPaso.current = false; return; }
    const el = barraPasos.current;
    if (!el) return;
    const arriba = el.getBoundingClientRect().top;
    if (arriba < 0 || arriba > window.innerHeight * 0.35) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [paso]);

  /**
   * Sin maquinaria no hay duración que pedir (2026-10-29): quien solo quiere
   * agua o retiro de material pasa de «Equipos» directo a «Servicios».
   */
  const saltar = (i: number) => pasos[i]?.clave === 'duracion' && !lineas.some((l) => l.tipo === 'equipo');
  const avanzar = () => {
    setTocado(true);
    if (!puedeAvanzar) return;
    setTocado(false);
    setPaso((p) => {
      const n = Math.min(pasos.length - 1, p + 1);
      return saltar(n) ? Math.min(pasos.length - 1, n + 1) : n;
    });
  };
  const retroceder = () => {
    setTocado(false);
    setPaso((p) => {
      const n = Math.max(0, p - 1);
      return saltar(n) ? Math.max(0, n - 1) : n;
    });
  };

  // ---- solo precios (acceso directo): el documento en PDF, para WhatsApp o descargarlo ----
  const [archivo, setArchivo] = useState<File | null>(null);
  const [avisoPdf, setAvisoPdf] = useState<string | null>(null);
  const enElUltimo = paso === pasos.length - 1;
  const huellaDoc = soloPrecios && enElUltimo ? JSON.stringify([calcVista.renglones, calcVista.total, calcVista.con_iva, ctx]) : '';
  useEffect(() => {
    setArchivo(null);
    setAvisoPdf(null);
    if (!huellaDoc) return;
    let vigente = true;
    const t = window.setTimeout(() => {
      documentoPdf(datosDoc(''))
        .then((blob) => {
          if (!vigente) return;
          const hoy = new Date();
          const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
          // Con el cliente en el nombre: en el chat o en Descargas se distingue cuál es cuál.
          const cliente = ctx.cliente.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
          const empresa = catalogo.empresa.nombre.replace(/[^A-Za-z0-9]+/g, '');
          setArchivo(new File([blob], `Cotizacion-${empresa}-${tipo}${cliente ? `-${cliente}` : ''}-${fecha}.pdf`, { type: 'application/pdf' }));
        })
        .catch(() => { if (vigente) setAvisoPdf('No se pudo preparar el PDF. Regresa un paso y vuelve a entrar para intentarlo otra vez.'); });
    }, 500);
    return () => { vigente = false; window.clearTimeout(t); };
    // datosDoc se rehace en cada pintada; lo que cambia el documento está en la huella.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huellaDoc]);

  async function mandarPorWhatsapp() {
    if (!archivo) return;
    setAvisoPdf(null);
    try {
      const r = await compartirArchivo(archivo);
      if (r === 'sin-soporte') {
        descargarArchivo(archivo);
        setAvisoPdf('Este navegador no deja mandar archivos directo: se descargó el PDF, adjúntalo en WhatsApp.');
      }
    } catch {
      setAvisoPdf('No se pudo abrir el menú para compartir. Descarga el PDF y mándalo desde WhatsApp.');
    }
  }

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
    // En el acceso directo no se pide la ubicación: su documento no la menciona (2026-10-30).
    calc: sinUbicacion ? sinFraseDeMapas(calcVista) : calcVista,
    // Cuándo y dónde (2026-10-23): lo que el cliente pidió para su obra.
    ...(ctx.fecha || ctx.direccion || ubicacionValida
      ? {
          detalle: [
            ...(ctx.fecha ? [{ label: tipo === 'maquinaria' ? 'Inicio del servicio' : 'Fecha de entrega', valor: fechaLarga(ctx.fecha) }] : []),
            ...(ctx.direccion ? [{ label: 'Dirección de la obra', valor: [ctx.direccion, ctx.municipio].filter(Boolean).join(', ') }] : []),
            ...(ubicacionValida ? [{ label: 'Ubicación (Google Maps)', valor: ctx.ubicacion.trim() }] : []),
          ],
        }
      : {}),
    mostrarPrecios: verPrecios,
    ...(verPrecios ? {} : { notaSinPrecios: 'Esta solicitud no incluye importes. MAQSER24 la revisa y le envía la cotización con precio y vigencia por correo.' }),
    logo: logo ?? null,
    // A dónde se paga (2026-10-30); el documento solo lo enseña si lleva precio.
    pago: catalogo.pago ?? null,
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
    setNuevo(null);
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
              ? 'Ya está en el historial del cotizador. Mándasela al cliente por correo (con el botón para aceptarla) o imprímela.'
              : sitioConPrecios
                ? 'Recibimos tu solicitud. Confirmamos disponibilidad y te mandamos la cotización por correo; la aceptas desde tu cuenta y entonces asignamos al proveedor que te atiende. Guarda tu folio.'
                : 'Recibimos tu solicitud. La revisamos y te mandamos la cotización con precio por correo; la aceptas desde tu cuenta y entonces asignamos al proveedor que te atiende. Guarda tu folio.'}
          </p>
          <div className="cz-folio">{hecho.folio}</div>
          <div className="cz-done-acts">
            {hecho.enlace ? (
              <ShButton asChild>
                <a href={hecho.enlace.href}>{hecho.enlace.label} <ArrowRight className="size-4" /></a>
              </ShButton>
            ) : null}
            <ShButton onClick={() => imprimir(hecho.folio)} variant={hecho.enlace ? 'outline' : undefined}>
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
      <div className="cz-ayuda">
        <span className="cz-ayuda-n">Paso {paso + 1} de {pasos.length}</span>
        <span className="cz-ayuda-t">{ayuda}</span>
      </div>

      <div className="cz-grid">
        <div>
          {clave === 'obra' ? (
            <PasoObra ctx={ctx} setCtx={setCtx} catalogo={catalogo} pideContacto={!esPanel} tocado={tocado} empresas={esPanel ? undefined : empresas ?? []} clientesPanel={esPanel ? clientesPanel : undefined} minimo={soloPrecios} />
          ) : null}

          {tipo === 'maquinaria' && clave === 'equipos' ? (
            <PasoEquipos
              cat={paraElegir as CatalogoMaquinaria}
              lineas={lineas as LineaMaquinaria[]}
              mostrarPrecios={preciosEnPasos}
              alternar={(id) => alternar(esEquipo(id), () => lineaDeEquipo(id))}
              agregarOtra={(id) => agregar(lineaDeEquipo(id))}
            />
          ) : null}
          {/* Los servicios también aquí (2026-10-30): quien solo quiere agua o retiro no tiene que avanzar. */}
          {tipo === 'maquinaria' && clave === 'equipos' ? (
            <ServiciosDelInicio
              cat={paraElegir as CatalogoMaquinaria}
              lineas={lineas as LineaMaquinaria[]}
              mostrarPrecios={preciosEnPasos}
              municipio={ctx.municipio}
              elegirZona={esPanel}
              alternar={(id) => alternar(esServicio(id), () => lineaDeServicio(catalogo as CatalogoMaquinaria, id))}
            />
          ) : null}

          {tipo === 'maquinaria' && clave === 'duracion' ? (
            <PasoDuracion
              cat={catalogo as CatalogoMaquinaria}
              lineas={lineas as LineaMaquinaria[]}
              mostrarPrecios={preciosEnPasos}
              editarPrecios={editarPrecios}
              actualizar={(uid, patch) => actualizar(uid, patch as Partial<LineaEquipo>)}
              quitar={quitar}
            />
          ) : null}

          {tipo === 'maquinaria' && clave === 'servicios' ? (
            <PasoServicios
              cat={paraElegir as CatalogoMaquinaria}
              lineas={lineas as LineaMaquinaria[]}
              mostrarPrecios={preciosEnPasos}
              editarPrecios={editarPrecios}
              municipio={ctx.municipio}
              elegirZona={esPanel}
              alternar={(id) => alternar(esServicio(id), () => lineaDeServicio(catalogo as CatalogoMaquinaria, id))}
              actualizar={(uid, patch) => actualizar(uid, patch as Partial<LineaServicio>)}
              quitar={quitar}
              agregarOtro={esPanel ? () => agregar(lineaDeServicioAMano()) : undefined}
            />
          ) : null}

          {tipo === 'triturados' && clave === 'pedido' ? (
            <PasoPedido
              cat={paraElegir as CatalogoTriturados}
              lineas={lineas as LineaTriturados[]}
              mostrarPrecios={preciosEnPasos}
              editarPrecios={editarPrecios}
              alternarMaterial={alternarMaterial}
              ubicacion={ctx.ubicacion}
              ponerUbicacion={sinUbicacion ? undefined : (ubicacion) => setCtx((c) => ({ ...c, ubicacion }))}
              ubicacionObligatoria={!esPanel}
              preciosAlFinal={preciosAlFinal}
              permitirOtro={esPanel}
              agregarMaterial={agregarMaterial}
              agregarZona={() => agregar(lineaDeZona(paraElegir as CatalogoTriturados))}
              agregarBanco={() => agregar(lineaDeBanco(catalogo as CatalogoTriturados))}
              actualizar={actualizar}
              quitar={quitar}
              nuevo={nuevo}
              tocado={tocado}
              municipio={ctx.municipio}
            />
          ) : null}

          {clave === 'resumen' ? (
            <div className="cz-card">
              <h2 className="cz-card-h">Así queda el documento</h2>
              <p className="cz-card-s">
                {esPanel
                  ? 'Revísalo antes de guardarlo. Al guardar se congela: aunque mañana suba una tarifa, esta cotización seguirá diciendo lo mismo.'
                  : preciosAlFinal || sitioConPrecios
                    ? 'Este es el costo de lo que armaste, con nuestros precios de lista. Revísalo y, si todo está bien, envía tu solicitud.'
                    : 'Revisa que todo esté correcto antes de enviar tu solicitud. Va sin precios: te mandamos la cotización con precio por correo.'}
              </p>

              {/* Solo con maquinaria: el agua y el retiro van por viaje (2026-10-29). */}
              {tipo === 'maquinaria' && verPrecios && lineas.some((l) => l.tipo === 'equipo') ? (
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

              {tipo === 'triturados' && preciosEnPasos ? (
                <div className="cz-qty wide" style={{ marginBottom: 14 }}>
                  <span className="cz-lbl">{esPanel ? 'Facturación · cambia el total y las condiciones del documento' : '¿Necesitas factura? Cambia el total'}</span>
                  <Facturacion cat={catalogo as CatalogoTriturados} conIva={conIva} setConIva={setConIva} />
                </div>
              ) : null}

              {/* Sin precios también se pregunta (2026-10-23): con o sin factura
                  cambia la cotización que se le manda, y es el cliente quien lo sabe. */}
              {tipo === 'triturados' && !verPrecios ? (
                <div className="cz-qty wide" style={{ marginBottom: 14 }}>
                  <span className="cz-lbl">¿Necesitas factura?</span>
                  <Facturacion cat={catalogo as CatalogoTriturados} conIva={conIva} setConIva={setConIva} />
                </div>
              ) : null}

              {tipo === 'triturados' && preciosAlFinal ? (
                <AjustesDelTotal
                  cat={catalogo as CatalogoTriturados}
                  lineas={lineas as LineaTriturados[]}
                  actualizar={(uid, patch) => actualizar(uid, patch as Partial<LineaMaterial>)}
                  conIva={conIva}
                  setConIva={setConIva}
                />
              ) : null}

              {/* EL COSTO, DICHO EN GRANDE Y UNA SOLA VEZ.
                  El documento de abajo ya lo trae, pero va dentro de una hoja
                  que en un teléfono se lee con scroll horizontal: el número por
                  el que la persona hizo los cinco pasos no puede depender de
                  que lo encuentre. En el panel no hace falta — ahí el total
                  acompañó toda la captura desde el resumen lateral. */}
              {preciosAlFinal || sitioConPrecios ? (
                <div className="cz-total">
                  <span className="n">
                    <span>
                      Total {calc.con_iva ? `con IVA ${Math.round(calc.iva_tasa * 100)}%` : 'sin IVA · remisionado'}
                    </span>
                    <b>{money(calc.total)}</b>
                  </span>
                  <p className="d">
                    Subtotal {money(calc.subtotal)}
                    {calc.con_iva ? ` · IVA ${money(calc.iva)}` : ''}
                  </p>
                </div>
              ) : null}

              <div style={{ marginTop: 14 }}>
                <Campo label={esPanel ? 'Notas para el cliente (opcional)' : 'Algo más que debamos saber (opcional)'} ancho="full">
                  {(id) => (
                    <ShTextarea
                      id={id}
                      value={ctx.notas}
                      maxLength={2000}
                      placeholder={esPanel ? 'Vigencia, condiciones especiales, contacto en obra…' : 'Horario de acceso, contacto en obra, fechas…'}
                      onChange={(e) => setCtx({ ...ctx, notas: e.target.value })}
                    />
                  )}
                </Campo>
              </div>

              {soloPrecios ? (
                <div className="cz-compartir">
                  <ShButton onClick={mandarPorWhatsapp} disabled={!archivo}>
                    <MessageCircle className="size-4" /> {archivo ? 'Mandar por WhatsApp' : 'Preparando PDF…'}
                  </ShButton>
                  <ShButton variant="outline" onClick={() => archivo && descargarArchivo(archivo)} disabled={!archivo}>
                    <Download className="size-4" /> Descargar PDF
                  </ShButton>
                  {avisoPdf ? <p className="cz-help cz-compartir-aviso">{avisoPdf}</p> : null}
                </div>
              ) : null}

              <div className="cz-preview" style={{ marginTop: 16 }}>
                {/* El MISMO generador que la impresión: lo que se ve aquí es,
                    literalmente, lo que sale por la impresora. */}
                <div dangerouslySetInnerHTML={{ __html: `<style>${DOCUMENTO_CSS}</style>${documentoCuerpo(datosDoc(soloPrecios ? '' : 'BORRADOR'))}` }} />
              </div>

              {!esPanel ? (
                <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                  {sitioConPrecios ? <MejorarPrecio telefono={catalogo.empresa.telefono} empresa={catalogo.empresa.nombre} /> : null}
                  <Aviso>
                    {sitioConPrecios
                      ? 'Al enviarla, MAQSER24 confirma disponibilidad y te manda la cotización por correo. Si te conviene, la aceptas desde tu cuenta y asignamos al proveedor que te atiende.'
                      : 'Al enviarla, MAQSER24 revisa tu solicitud y te manda la cotización con precio por correo. Si te conviene, la aceptas desde tu cuenta y asignamos al proveedor que te atiende.'}
                  </Aviso>
                </div>
              ) : null}

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
            {esUltimo && soloPrecios ? (
              // Solo precios: no se guarda nada; se empieza otra.
              <ShButton variant="outline" onClick={reiniciar}>
                <RotateCcw className="size-4" /> Nueva cotización
              </ShButton>
            ) : esUltimo ? (
              <ShButton onClick={enviar} disabled={enviando}>
                {enviando ? 'Enviando…' : esPanel ? 'Guardar cotización' : 'Pedir cotización'}
              </ShButton>
            ) : (
              <ShButton onClick={avanzar}>
                Continuar <ArrowRight className="size-4" />
              </ShButton>
            )}
          </div>
        </div>

        <ResumenLateral
          calc={calcVista}
          tipo={tipo}
          importes={importesALaVista}
          pie={verPrecios ? 'El costo aparece en el último paso' : 'Te mandamos el precio por correo'}
          extra={sitioConPrecios ? <MejorarPrecio telefono={catalogo.empresa.telefono} empresa={catalogo.empresa.nombre} corto /> : null}
          // Con precios, solo las partidas que ya cuentan (con material y
          // cantidad): un renglón recién agregado y vacío no es una partida.
          partidas={verPrecios ? calc.renglones.filter((r) => r.clase !== 'flete').length : partidas.length}
          para={{ cliente: ctx.cliente, obra: ctx.obra, fecha: ctx.fecha ? fechaCorta(ctx.fecha) : '' }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

const OTRA_EMPRESA = '__otra__';

/** Hoy en Monterrey, AAAA-MM-DD: ninguna fecha del servicio puede ser pasada. */
const hoyLocal = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey' }).format(new Date());
const fechaCorta = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const fechaLarga = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const OBRA_NUEVA = '__nueva__';

/** PASO 1 · para quién y dónde. Igual en los dos cotizadores. */
function PasoObra({
  ctx,
  setCtx,
  catalogo,
  pideContacto,
  tocado,
  empresas,
  clientesPanel,
  minimo,
}: {
  ctx: ContextoCotizador;
  setCtx: (c: ContextoCotizador) => void;
  catalogo: CatalogoCotizador;
  pideContacto: boolean;
  tocado: boolean;
  /** Solo el sitio: sus empresas con sus obras (puede venir vacío). */
  empresas?: EmpresaCliente[];
  /** Solo el panel: los clientes registrados. */
  clientesPanel?: CotizadorProps['clientesPanel'];
  /** El acceso directo: solo cliente, obra y teléfono (2026-10-30). */
  minimo?: boolean;
}) {
  const set = (patch: Partial<ContextoCotizador>) => setCtx({ ...ctx, ...patch });
  if (empresas) return <PasoObraSitio ctx={ctx} set={set} catalogo={catalogo} tocado={tocado} empresas={empresas} />;
  if (clientesPanel) return <PasoObraPanel ctx={ctx} set={set} catalogo={catalogo} tocado={tocado} clientes={clientesPanel} minimo={minimo} />;
  // Mismas reglas que la API (@maqserv/config). En el sitio son obligatorios;
  // en el panel, opcionales, pero si se escriben tienen que estar bien.
  const errCorreo = tocado ? errorContacto('correo', ctx.correo, pideContacto) : null;
  const errTelefono = tocado ? errorContacto('telefono', ctx.telefono, pideContacto) : null;
  const malCorreo = !!errCorreo;
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
            <Campo label="Correo" req error={errCorreo}>
              {(id) => (
                <ShInput id={id} type="email" value={ctx.correo} maxLength={190} placeholder="tu@empresa.com" aria-invalid={malCorreo} onChange={(e) => set({ correo: e.target.value })} />
              )}
            </Campo>
            <Campo label="Teléfono" req error={errTelefono}>
              {(id) => (
                <ShInput id={id} type="tel" inputMode="tel" autoComplete="tel" value={ctx.telefono} maxLength={20} placeholder="81 1234 5678" aria-invalid={!!errTelefono} onChange={(e) => set({ telefono: e.target.value })} />
              )}
            </Campo>
          </>
        ) : (
          <>
            <Campo label="Correo del cliente (opcional)" error={errCorreo}>
              {(id) => <ShInput id={id} type="email" value={ctx.correo} maxLength={190} aria-invalid={malCorreo} onChange={(e) => set({ correo: e.target.value })} />}
            </Campo>
            <Campo label="Teléfono del cliente (opcional)" error={errTelefono}>
              {(id) => <ShInput id={id} type="tel" inputMode="tel" value={ctx.telefono} maxLength={20} placeholder="81 1234 5678" aria-invalid={!!errTelefono} onChange={(e) => set({ telefono: e.target.value })} />}
            </Campo>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * PASO 1 EN EL PANEL (2026-10-23): CLIENTE Y OBRA REGISTRADOS, O NUEVOS.
 *
 * "En el panel se escogen los clientes y obras, o se pueden agregar ahí
 * mismo." El cliente se busca entre los registrados; si se escribe uno que no
 * está, se da de alta al guardar. Con un cliente registrado salen sus obras
 * (u "Obra nueva…"); con uno nuevo, la obra se escribe. Correo y teléfono se
 * llenan con los del cliente si están vacíos.
 */
function PasoObraPanel({
  ctx,
  set,
  catalogo,
  tocado,
  clientes,
  minimo = false,
}: {
  ctx: ContextoCotizador;
  set: (patch: Partial<ContextoCotizador>) => void;
  catalogo: CatalogoCotizador;
  tocado: boolean;
  clientes: NonNullable<CotizadorProps['clientesPanel']>;
  /**
   * El acceso directo (2026-10-30, pedido del dueño: "solo deja lo necesario:
   * nombre, obra, teléfono"). Sin dirección, fecha, atención, municipio ni
   * correo; la zona del agua y del flete se elige en su paso (o sale de la
   * obra registrada que se elija). Ahí no se guarda nada, así que tampoco se
   * da de alta al cliente nuevo.
   */
  minimo?: boolean;
}) {
  const [obras, setObras] = useState<EmpresaCliente['sites']>([]);
  const [nueva, setNueva] = useState(false);
  const leerObras = clientes.obras;
  useEffect(() => {
    let vivo = true;
    if (!ctx.clienteId) { setObras([]); return; }
    leerObras(ctx.clienteId).then((o) => { if (vivo) setObras(o); }).catch(() => { if (vivo) setObras([]); });
    return () => { vivo = false; };
  }, [ctx.clienteId, leerObras]);
  const nombres = useMemo(() => [...new Set(clientes.lista.map((c) => c.name))], [clientes.lista]);
  const obraElegida = obras.find((o) => o.id === ctx.obraId) ?? null;
  const pideNueva = !obraElegida && (nueva || !ctx.clienteId || obras.length === 0);
  const errCorreo = tocado ? errorContacto('correo', ctx.correo, false) : null;
  const errTelefono = tocado ? errorContacto('telefono', ctx.telefono, false) : null;
  const falta = (cond: boolean, texto: string) => (tocado && cond ? texto : null);

  const elegirCliente = (v: string) => {
    setNueva(false);
    const c = clientes.lista.find((x) => x.name.toLowerCase() === v.trim().toLowerCase()) ?? null;
    set({
      cliente: c ? c.name : v,
      clienteId: c?.id ?? null,
      obraId: null,
      obra: '',
      direccion: '',
      ...(c && !ctx.correo.trim() && c.email ? { correo: c.email } : {}),
      ...(c && !ctx.telefono.trim() && c.phone ? { telefono: c.phone } : {}),
    });
  };
  const elegirObra = (v: string) => {
    if (v === OBRA_NUEVA) { setNueva(true); set({ obraId: null, obra: '', direccion: '' }); return; }
    const o = obras.find((x) => String(x.id) === v);
    if (!o) return;
    setNueva(false);
    set({ obraId: o.id, obra: o.name, direccion: o.address ?? '', municipio: o.municipality || ctx.municipio });
  };

  return (
    <div className="cz-card">
      <h2 className="cz-card-h">Cliente y obra</h2>
      <p className="cz-card-s">
        {minimo
          ? 'Elige un cliente registrado o escribe su nombre. Sale impreso en el encabezado.'
          : 'Elige un cliente registrado o escribe uno nuevo: se da de alta al guardar, con su obra. Sale impreso en el encabezado.'}
      </p>
      <div className="cz-row">
        <Campo label="Cliente o empresa" req ancho="full" help={!minimo && ctx.cliente.trim() && !ctx.clienteId ? 'Cliente nuevo: se da de alta al guardar.' : undefined}
          error={falta(ctx.cliente.trim().length < 2, 'Elige o escribe a nombre de quién va la cotización.')}>
          {(id) => <ShCombobox id={id} value={ctx.cliente} onChange={elegirCliente} options={nombres} placeholder="Busca o escribe el cliente…" buscar="Busca el cliente…" />}
        </Campo>
        {ctx.clienteId && obras.length ? (
          <Campo label="Obra" req ancho="full" error={falta(!obraElegida && !nueva, 'Elige la obra o «Obra nueva…».')}>
            {(id) => (
              <ShSelect value={obraElegida ? String(obraElegida.id) : nueva ? OBRA_NUEVA : ''} onValueChange={elegirObra}>
                <ShSelectTrigger id={id} aria-label="Obra"><ShSelectValue placeholder="Elige la obra…" /></ShSelectTrigger>
                <ShSelectContent>
                  {obras.map((o) => <ShSelectItem key={o.id} value={String(o.id)}>{o.name}{o.municipality ? ` · ${o.municipality}` : ''}</ShSelectItem>)}
                  <ShSelectItem value={OBRA_NUEVA}>Obra nueva…</ShSelectItem>
                </ShSelectContent>
              </ShSelect>
            )}
          </Campo>
        ) : null}
        {obraElegida ? (
          <p className="cz-help" style={{ gridColumn: '1 / -1', margin: 0 }}>
            {[obraElegida.address, obraElegida.municipality].filter(Boolean).join(' · ') || 'Sin dirección registrada.'}
          </p>
        ) : null}
        {pideNueva ? (
          <>
            <Campo label="Nombre de la obra" req error={falta(ctx.obra.trim().length < 2, 'Ponle un nombre a la obra.')}>
              {(id) => <ShInput id={id} value={ctx.obra} maxLength={190} placeholder="Ej. Fraccionamiento Los Encinos" onChange={(e) => set({ obra: e.target.value })} />}
            </Campo>
            {minimo ? null : (
              <Campo label="Dirección de la obra">
                {(id) => <ShInput id={id} value={ctx.direccion} maxLength={300} placeholder="Calle, número y colonia" onChange={(e) => set({ direccion: e.target.value })} />}
              </Campo>
            )}
          </>
        ) : null}
        {minimo ? (
          <Campo label="Teléfono del cliente" error={errTelefono}>
            {(id) => <ShInput id={id} type="tel" inputMode="tel" value={ctx.telefono} maxLength={20} placeholder="81 1234 5678" aria-invalid={!!errTelefono} onChange={(e) => set({ telefono: e.target.value })} />}
          </Campo>
        ) : (
        <>
        <Campo
          label={catalogo.tipo === 'maquinaria' ? 'Fecha de inicio del servicio' : 'Fecha de entrega'}
          req
          help="Cuándo se necesita en la obra"
          error={falta(!ctx.fecha, 'Elige la fecha.')}
        >
          {(id) => <ShDatePicker id={id} value={ctx.fecha} min={hoyLocal()} onChange={(v) => set({ fecha: v })} placeholder="Elegir fecha" />}
        </Campo>
        <Campo label="Atención a">
          {(id) => <ShInput id={id} value={ctx.atencion} maxLength={190} placeholder="Ing. / Lic." onChange={(e) => set({ atencion: e.target.value })} />}
        </Campo>
        <Campo label="Municipio de entrega" help="Define la zona de flete">
          {(id) => (
            <ShCombobox id={id} value={ctx.municipio} onChange={(v) => set({ municipio: v })} options={catalogo.municipios} placeholder="Ej. Apodaca" buscar="Busca o escribe el municipio…" />
          )}
        </Campo>
        <Campo label="Correo del cliente (opcional)" error={errCorreo}>
          {(id) => <ShInput id={id} type="email" value={ctx.correo} maxLength={190} aria-invalid={!!errCorreo} onChange={(e) => set({ correo: e.target.value })} />}
        </Campo>
        <Campo label="Teléfono del cliente (opcional)" error={errTelefono}>
          {(id) => <ShInput id={id} type="tel" inputMode="tel" value={ctx.telefono} maxLength={20} placeholder="81 1234 5678" aria-invalid={!!errTelefono} onChange={(e) => set({ telefono: e.target.value })} />}
        </Campo>
        </>
        )}
      </div>
    </div>
  );
}

/**
 * PASO 1 EN EL SITIO (2026-10-23): EMPRESA Y OBRA, siempre.
 *
 * "Cada vez que cotice, si ya tiene obras, que le salgan con un seleccionador,
 * y si es nueva que la anote." Una cuenta puede tener varias empresas y cada
 * empresa varias obras: primero la empresa (o "Otra empresa…"), luego sus obras
 * (u "Obra nueva…", que pide nombre, dirección y municipio). Sin obra no se
 * avanza: es a donde va la máquina y con lo que se ordena Clientes y obras.
 * La obra NO se preselecciona: una obra equivocada manda la máquina a otro lado.
 */
function PasoObraSitio({
  ctx,
  set,
  catalogo,
  tocado,
  empresas,
}: {
  ctx: ContextoCotizador;
  set: (patch: Partial<ContextoCotizador>) => void;
  catalogo: CatalogoCotizador;
  tocado: boolean;
  empresas: EmpresaCliente[];
}) {
  const [nueva, setNueva] = useState(false);
  const empresa = empresas.find((e) => e.id === ctx.clienteId) ?? null;
  const obras = empresa?.sites ?? [];
  const obraElegida = obras.find((o) => o.id === ctx.obraId) ?? null;
  // Sin obras registradas en esa empresa, la única opción es una nueva.
  const pideNueva = !obraElegida && (nueva || obras.length === 0);
  const errCorreo = tocado ? errorContacto('correo', ctx.correo, true) : null;
  const errTelefono = tocado ? errorContacto('telefono', ctx.telefono, true) : null;
  const falta = (cond: boolean, texto: string) => (tocado && cond ? texto : null);

  const elegirEmpresa = (v: string) => {
    setNueva(false);
    const e = empresas.find((x) => String(x.id) === v);
    set(e
      ? { clienteId: e.id, cliente: e.name, obraId: null, obra: '', direccion: '' }
      : { clienteId: null, cliente: '', obraId: null, obra: '', direccion: '' });
  };
  const elegirObra = (v: string) => {
    if (v === OBRA_NUEVA) {
      setNueva(true);
      set({ obraId: null, obra: '', direccion: '' });
      return;
    }
    const o = obras.find((x) => String(x.id) === v);
    if (!o) return;
    setNueva(false);
    set({ obraId: o.id, obra: o.name, direccion: o.address ?? '', municipio: o.municipality || ctx.municipio });
  };

  return (
    <div className="cz-card">
      <h2 className="cz-card-h">Empresa y obra</h2>
      <p className="cz-card-s">A nombre de quién va la cotización y a qué obra llega el equipo. Sale impreso en el encabezado.</p>
      <div className="cz-row">
        {empresas.length ? (
          <Campo label="Empresa o persona" req>
            {(id) => (
              <ShSelect value={ctx.clienteId ? String(ctx.clienteId) : OTRA_EMPRESA} onValueChange={elegirEmpresa}>
                <ShSelectTrigger id={id} aria-label="Empresa o persona"><ShSelectValue /></ShSelectTrigger>
                <ShSelectContent>
                  {empresas.map((e) => <ShSelectItem key={e.id} value={String(e.id)}>{e.name}</ShSelectItem>)}
                  <ShSelectItem value={OTRA_EMPRESA}>Otra empresa…</ShSelectItem>
                </ShSelectContent>
              </ShSelect>
            )}
          </Campo>
        ) : null}
        {!ctx.clienteId ? (
          <Campo label={empresas.length ? 'Nombre de la otra empresa' : 'Empresa o persona'} req error={falta(ctx.cliente.trim().length < 2, 'Escribe a nombre de quién va la cotización.')}>
            {(id) => <ShInput id={id} value={ctx.cliente} maxLength={190} placeholder="Ej. Constructora del Norte" onChange={(e) => set({ cliente: e.target.value })} />}
          </Campo>
        ) : null}

        {obras.length ? (
          <Campo label="Obra" req ancho="full" error={falta(!obraElegida && !nueva, 'Elige la obra o «Obra nueva…».')}>
            {(id) => (
              <ShSelect value={obraElegida ? String(obraElegida.id) : nueva ? OBRA_NUEVA : ''} onValueChange={elegirObra}>
                <ShSelectTrigger id={id} aria-label="Obra"><ShSelectValue placeholder="Elige la obra…" /></ShSelectTrigger>
                <ShSelectContent>
                  {obras.map((o) => (
                    <ShSelectItem key={o.id} value={String(o.id)}>{o.name}{o.municipality ? ` · ${o.municipality}` : ''}</ShSelectItem>
                  ))}
                  <ShSelectItem value={OBRA_NUEVA}>Obra nueva…</ShSelectItem>
                </ShSelectContent>
              </ShSelect>
            )}
          </Campo>
        ) : null}
        {obraElegida ? (
          <p className="cz-help" style={{ gridColumn: '1 / -1', margin: 0 }}>
            {[obraElegida.address, obraElegida.municipality].filter(Boolean).join(' · ') || 'Sin dirección registrada.'}
          </p>
        ) : null}

        {pideNueva ? (
          <>
            <Campo label="Nombre de la obra" req error={falta(ctx.obra.trim().length < 2, 'Ponle un nombre a la obra.')}>
              {(id) => <ShInput id={id} value={ctx.obra} maxLength={190} placeholder="Ej. Bodega Escobedo" onChange={(e) => set({ obra: e.target.value })} />}
            </Campo>
            <Campo label="Dirección de la obra" req error={falta(ctx.direccion.trim().length < 5, 'Calle, número y colonia.')}>
              {(id) => <ShInput id={id} value={ctx.direccion} maxLength={300} placeholder="Calle, número y colonia" onChange={(e) => set({ direccion: e.target.value })} />}
            </Campo>
          </>
        ) : null}
        {pideNueva || (obraElegida && !obraElegida.municipality) ? (
          <Campo label="Municipio de la obra" req help="Define la zona de flete" error={falta(!ctx.municipio.trim(), 'Elige el municipio.')}>
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
        ) : null}

        <Campo
          label={catalogo.tipo === 'maquinaria' ? 'Fecha de inicio del servicio' : 'Fecha de entrega'}
          req
          help="Cuándo se necesita en la obra"
          error={falta(!ctx.fecha, 'Elige la fecha.')}
        >
          {(id) => <ShDatePicker id={id} value={ctx.fecha} min={hoyLocal()} onChange={(v) => set({ fecha: v })} placeholder="Elegir fecha" />}
        </Campo>
        <Campo label="Atención a">
          {(id) => <ShInput id={id} value={ctx.atencion} maxLength={190} placeholder="Ing. / Lic." onChange={(e) => set({ atencion: e.target.value })} />}
        </Campo>
        <Campo label="Correo" req error={errCorreo}>
          {(id) => (
            <ShInput id={id} type="email" value={ctx.correo} maxLength={190} placeholder="tu@empresa.com" aria-invalid={!!errCorreo} onChange={(e) => set({ correo: e.target.value })} />
          )}
        </Campo>
        <Campo label="Teléfono" req error={errTelefono}>
          {(id) => (
            <ShInput id={id} type="tel" inputMode="tel" autoComplete="tel" value={ctx.telefono} maxLength={20} placeholder="81 1234 5678" aria-invalid={!!errTelefono} onChange={(e) => set({ telefono: e.target.value })} />
          )}
        </Campo>
      </div>
    </div>
  );
}

/**
 * Resumen en vivo. Acompaña todos los pasos.
 *
 * Enseña IMPORTES solo cuando el costo ya está a la vista; el resto del tiempo
 * lista lo pedido en cantidades, que es lo que hay que revisar mientras se
 * arma, y dice DÓNDE va a aparecer el total: un resumen que se calla el precio
 * sin explicar por qué se lee como una pantalla rota.
 */
function ResumenLateral({
  calc,
  tipo,
  importes,
  pie,
  partidas,
  para,
  extra,
}: {
  calc: ReturnType<typeof calcularCotizacion>;
  tipo: 'maquinaria' | 'triturados';
  /** Debajo del total (el sitio con precios: la nota para mejorar el precio). */
  extra?: ReactNode;
  /** Si toca enseñar el desglose de dinero o solo las cantidades. */
  importes: boolean;
  /** Qué decir en lugar del total mientras no hay importes. */
  pie: string;
  partidas: number;
  /** Para quién es (2026-10-26): el resumen lo dice desde el primer paso. */
  para?: { cliente: string; obra: string; fecha: string };
}) {
  const vacio = calc.renglones.length === 0;
  return (
    <aside className="cz-side">
      <div className="cz-side-h">
        <h3>{importes ? 'Resumen' : 'Tu solicitud'}</h3>
        <span>{partidas === 1 ? '1 partida' : `${partidas} partidas`}</span>
      </div>
      {para && (para.cliente.trim() || para.obra.trim()) ? (
        <div className="cz-side-para">
          <span>Para</span>
          <b>{para.cliente.trim() || 'Cliente por definir'}</b>
          <em>{[para.obra.trim(), para.fecha].filter(Boolean).join(' · ')}</em>
        </div>
      ) : null}
      {vacio ? (
        <div className="cz-side-empty">
          <span className="ico">
            <IconoCotizador nombre="documento" size={38} />
          </span>
          {importes
            ? 'Todavía no hay partidas. Conforme agregues, el total aparece aquí.'
            : 'Todavía no hay partidas. Conforme agregues, aparecen aquí.'}
        </div>
      ) : (
        <div className="cz-side-b">
          {importes ? (
            <>
              {tipo === 'maquinaria' ? (
                <>
                  {calc.desglose.renta > 0 ? (
                    <div className="cz-fr">
                      <span>Renta de equipos</span>
                      <b>{money(calc.desglose.renta)}</b>
                    </div>
                  ) : null}
                  {calc.desglose.servicios > 0 ? (
                    <div className="cz-fr">
                      <span>Servicios</span>
                      <b>{money(calc.desglose.servicios)}</b>
                    </div>
                  ) : null}
                </>
              ) : (
                // Triturados: por forma de venta, en el orden del paso "Material".
                // Antes todo salía como "Materiales" (un viaje por zona también).
                (
                  [
                    ['material', 'En planta, por tonelada'],
                    ['zona', 'Puesto en obra, por viaje'],
                    ['banco', 'Material de banco'],
                  ] as const
                ).map(([clase, texto]) => {
                  const suma = calc.renglones.filter((r) => r.clase === clase).reduce((s, r) => s + r.importe, 0);
                  return suma > 0 ? (
                    <div className="cz-fr" key={clase}>
                      <span>{texto}</span>
                      <b>{money(suma)}</b>
                    </div>
                  ) : null;
                })
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
                <span>{pie}</span>
              </div>
            </>
          )}
        </div>
      )}
      {extra ? <div className="cz-side-extra">{extra}</div> : null}
    </aside>
  );
}

/**
 * "¿QUIERES MEJORAR EL PRECIO?" (2026-10-29): en el sitio los precios son los
 * de lista; quien quiera negociar llama a la línea de MAQSER24. El teléfono es
 * el del documento (Tarifas › Documento), así no hay dos números distintos.
 */
function MejorarPrecio({ telefono, empresa, corto = false }: { telefono: string; empresa: string; corto?: boolean }) {
  const tel = telefono.trim();
  if (!tel) return null;
  const marcar = `tel:${tel.replace(/[^\d+]/g, '')}`;
  return (
    <div className="cz-mejorar">
      <b>¿Quieres mejorar el precio?</b>
      <span>
        {corto ? 'Llama a la línea de ' : 'Estos son nuestros precios de lista. Si quieres negociar el costo, llama a la línea de '}
        {empresa || 'MAQSER24'}: <a href={marcar}>{tel}</a>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * El tabulador con un precio simbólico en todo (2026-10-23): sirve SOLO para
 * que el motor arme los renglones del sitio, que recibe el tabulador en ceros.
 * Sus importes se borran antes de enseñarse (`sinImportes`).
 */
function conPrecioSimbolico(cat: CatalogoCotizador): CatalogoCotizador {
  if (cat.tipo === 'maquinaria') {
    return {
      ...cat,
      fletes: Object.fromEntries(Object.keys(cat.fletes).map((k) => [k, 1])),
      equipos: cat.equipos.map(({ tarifas: _antes, ...e }) => ({ ...e, precio_hora: 1 })),
      // Por zona: precio simbólico solo en las zonas que lo llevan (el sitio las recibe en 1).
      servicios: cat.servicios.map((s) => ({
        ...s, precio: 1,
        ...(s.precios_zona ? { precios_zona: Object.fromEntries(Object.entries(s.precios_zona).map(([z, v]) => [z, v > 0 ? 1 : 0])) } : {}),
      })),
    };
  }
  return {
    ...cat,
    productos: cat.productos.map((p) => ({ ...p, precio_ton: 1 })),
    material_banco: { ...cat.material_banco, precio_m3_default: 1 },
    zonas: cat.zonas.map((z) => ({ ...z, flete: 1, precios: undefined })),
  };
}

/** El mismo cálculo sin un solo importe: conceptos, cantidades y condiciones. */
function sinImportes(calc: ReturnType<typeof calcularCotizacion>): ReturnType<typeof calcularCotizacion> {
  return {
    ...calc,
    renglones: calc.renglones.map((r) => ({ ...r, pu: 0, importe: 0 })),
    desglose: { renta: 0, servicios: 0, fletes: 0, materiales: 0 },
    subtotal: 0,
    iva: 0,
    total: 0,
    condiciones: condicionesSinPrecios(calc.condiciones),
  };
}

/**
 * Qué falta para poder continuar. Devuelve el motivo o `null`.
 *
 * El mensaje se guarda hasta que la persona intenta avanzar (`tocado`): marcar
 * en rojo un formulario que aún no se ha tocado es regañar por adelantado.
 */
/**
 * Las condiciones del documento SIN la ubicación de Google Maps (2026-10-30):
 * en el acceso directo no se pide, así que su documento no la menciona. Se
 * quita la frase (o el punto entero, si solo hablaba de eso); el texto del
 * tabulador no se toca.
 */
function sinFraseDeMapas(calc: CalculoCotizacion): CalculoCotizacion {
  if (!calc.condiciones?.length) return calc;
  return {
    ...calc,
    condiciones: calc.condiciones.map((b) => ({
      ...b,
      puntos: b.puntos
        .map((p) => p.replace(/;?\s*para cotizarlo se necesita la ubicaci[oó]n de la obra en Google Maps/i, ''))
        .filter((p) => p.trim() && !/google maps/i.test(p)),
    })),
  };
}

function validar(
  clave: string,
  d: {
    ctx: ContextoCotizador;
    lineas: LineaCotizador[];
    esPanel: boolean;
    calc: ReturnType<typeof calcularCotizacion>;
    /** Panel con clientes registrados: la obra también se pide. */
    conClientes?: boolean;
    /** El acceso directo: solo cliente, obra y teléfono; sin fecha (2026-10-30). */
    soloPrecios?: boolean;
    /** Lo que falta para cobrar el agua por zona (`faltaZona`), o null. */
    zona?: string | null;
  },
): string | null {
  const { ctx, lineas, esPanel, calc } = d;
  // En el panel la zona del agua se puede elegir a mano, aunque el municipio no esté en ninguna.
  const zona = d.zona ? `${d.zona}${esPanel ? ' Si aun así se lleva, elige la zona a mano.' : ''}` : null;

  if (clave === 'obra') {
    if (ctx.cliente.trim().length < 2) return 'Escribe a nombre de quién va la cotización.';
    // En el sitio toda solicitud es para una obra (2026-10-23): una de las suyas o una nueva completa.
    if (!esPanel && !ctx.obraId) {
      if (ctx.obra.trim().length < 2) return 'Elige tu obra o escribe el nombre de la obra nueva.';
      if (ctx.direccion.trim().length < 5) return 'Escribe la dirección de la obra: calle, número y colonia.';
      if (!ctx.municipio.trim()) return 'Elige el municipio de la obra.';
    }
    if (!esPanel && !ctx.fecha) return 'Elige la fecha del servicio.';
    if (esPanel && d.conClientes && !ctx.obraId && ctx.obra.trim().length < 2) return 'Elige la obra del cliente o escribe el nombre de la obra nueva.';
    if (esPanel && d.conClientes && !d.soloPrecios && !ctx.fecha) return 'Elige la fecha del servicio.';
    return errorContacto('correo', ctx.correo, !esPanel) ?? errorContacto('telefono', ctx.telefono, !esPanel);
  }

  // Sin equipo se puede seguir (2026-10-29): quien solo quiere agua o retiro lo elige en «Servicios».
  if (clave === 'equipos') return null;

  if (clave === 'servicios') {
    if (!lineas.length) return 'Elige al menos un equipo o un servicio para continuar.';
    // El servicio escrito a mano (2026-10-30): sin nombre o sin precio saldría un renglón mudo o en cero.
    const aMano = lineas.filter((l) => l.tipo === 'servicio' && l.id === SERVICIO_A_MANO) as LineaServicio[];
    if (aMano.some((l) => !l.nombre.trim())) return 'Ponle nombre al servicio que escribiste a mano.';
    if (aMano.some((l) => num(l.precio) <= 0)) return 'Captura el precio del servicio que escribiste a mano.';
    return zona;
  }

  if (clave === 'duracion') {
    const sinTiempo = lineas.filter((l) => l.tipo === 'equipo' && l.dias < 1 && l.horas < 1);
    return sinTiempo.length > 0 ? 'Hay equipos sin días ni horas: sin duración no se pueden cotizar.' : null;
  }

  if (clave === 'pedido') {
    if (lineas.length === 0) return 'Agrega al menos un material: en planta por tonelada o puesto en obra por viaje.';
    // Cada renglón incompleto se marca en rojo ahí mismo; esto dice cuál falta.
    if (lineas.some((l) => l.tipo === 'material' && !l.id)) return 'Elige qué material es cada partida por tonelada.';
    if (lineas.some((l) => l.tipo === 'material' && l.id === 'custom' && !l.nombre.trim())) return 'Ponle nombre al material que escribiste a mano.';
    if (esPanel && lineas.some((l) => l.tipo === 'material' && l.id === 'custom' && num(l.precio) <= 0)) return 'Captura el precio por tonelada del material que escribiste a mano.';
    if (lineas.some((l) => l.tipo === 'material' && num(l.toneladas) <= 0)) return 'Captura las toneladas de cada material.';
    // Sin esto el flete se quedaba en cero sin que nadie lo decidiera (2026-10-21).
    const material = lineas.find((l) => l.tipo === 'material');
    if (material && material.tipo === 'material' && !entregaDecidida(material)) return 'Dinos si llevamos el material a obra (elige la zona) o si lo recogen en planta.';
    if (lineas.some((l) => l.tipo === 'zona' && (!l.zonaId || !l.productoId))) return 'Elige la zona y el material de cada viaje.';
    if (lineas.some((l) => l.tipo === 'banco' && num(l.m3) <= 0)) return 'Captura los m³ del material de banco.';
    // Con flete hace falta la ubicación en Google Maps para medirlo (2026-10-29); en el panel es opcional.
    if (llevaFlete(aPartidas(lineas))) {
      const u = ctx.ubicacion.trim();
      if (!esPanel && !u) return 'Para cotizar el flete, pega la ubicación de tu obra en Google Maps (o elige que lo recogen en planta).';
      if (u && !esUbicacionDeMapas(u)) return 'Esa ubicación no es de Google Maps: en Maps toca «Compartir» y pega el enlace, o escribe las coordenadas.';
    }
    return null;
  }

  if (clave === 'resumen') {
    if (zona) return zona;
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
