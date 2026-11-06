'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  calcularCotizacion,
  catalogoDelSitio,
  COTIZADORES_SITIO,
  cotizadorDelSitio,
  condicionesSinPrecios,
  conZonaDeLaObra,
  esUbicacionDeMapas,
  faltaMinimoCamion,
  faltaZona,
  llevaFlete,
  RECOGE_EN_PLANTA,
  renglonesPorCotizar,
  saludoDe,
  tituloDe,
  problemaEmail,
  problemaTelefono,
  soloVisibles,
  trituradosDe,
  SERVICIO_A_MANO,
  type CalculoCotizacion,
  type CatalogoCotizador,
  type CatalogoMaquinaria,
  type CatalogoTriturados,
  type OpcionesCotizador,
  type PartidaCotizador,
} from '@maqserv/config';
import { ArrowLeft, ArrowRight, Check, Download, MessageCircle, Plus, Printer, RotateCcw } from 'lucide-react';
import { COTIZADOR_CSS } from './estilos';
import { DOCUMENTO_CSS, documentoCuerpo, imprimirDocumento, type DatosDocumento } from './documento';
import { compartirArchivo, descargarArchivo, documentoPdf } from './pdf';
import { money } from './formato';
import { Aviso, Campo, Tarjeta } from './piezas';
import { ShButton } from '../shadcn/button';
import { ShCombobox } from '../shadcn/combobox';
import { ShInput, ShTextarea } from '../shadcn/input';
import { ShSelect, ShSelectContent, ShSelectItem, ShSelectTrigger, ShSelectValue } from '../shadcn/select';
import { ShDatePicker } from '../shadcn/date-picker';
import {
  CONTEXTO_VACIO,
  aPartidas,
  formaDe,
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
  type FormaTriturados,
  type LineaCotizador,
  type LineaEquipo,
  type LineaMaquinaria,
  type LineaMaterial,
  type LineaServicio,
  type LineaTriturados,
  type LineaZona,
} from './estado';
import { PasoDuracion, PasoEquipos, PasoServicios, ServicioAMano } from './pasos-maquinaria';
import { CategoriaAMano, unidadDeProducto, type ProductoALaMedida } from './categorias';
import { AjustesDelTotal, Facturacion, PasoPedido, entregaDecidida, zonaDelMunicipio } from './pasos-triturados';

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
   * El cliente SÍ va (2026-10-30, pedido del dueño: "el cliente siempre debe
   * ir en el documento"); desde 2026-11-03 en una tarjeta compacta en la misma
   * pantalla que lo que se cotiza (`DatosCliente`), no en un paso aparte.
   */
  soloPrecios?: boolean;
  /**
   * El título del documento, si se quiere fijo. Sin él (lo normal desde
   * 2026-11-04) sale de lo que lleva: «Cotización de renta de maquinaria y
   * servicios de agua» (`tituloDe`).
   */
  titulo?: string;
  /** Categorías que van en la cotización sin partida (lo que el sitio pide a la medida): también van en el título. */
  categoriasExtra?: string[];
  /**
   * «¿Necesitas otro servicio?» (sitio, 2026-11-03, pedido del dueño): las
   * demás categorías del mismo tabulador; tocar una agrega sus opciones a esta
   * misma cotización.
   */
  masServicios?: { opciones: Array<{ clave: string; titulo: string; resumen: string; icono: string }>; agregar: (clave: string) => void };
  /** Debajo del acuse: volver a preguntar si necesita cotizar otro servicio (sitio). */
  despues?: ReactNode;
  /**
   * Servicios extra de otras categorías en esta MISMA solicitud (sitio,
   * 2026-11-03), por la clave de su categoría: cada uno sale como sección, en
   * el orden en que se agregó, y su texto (`notasExtra`) va en las notas del
   * documento y de la solicitud.
   */
  extras?: Record<string, ReactNode>;
  notasExtra?: string;
  /**
   * Lo que el cliente pidió de esas categorías sin precio (sitio, 2026-11-06:
   * el block por tarima, cuánto): partidas escritas a mano con su categoría y
   * en $0. Van en el documento como «Por cotizar» y abren su solicitud; el
   * panel les pone precio. Con ellas se puede pedir aunque no haya nada más.
   */
  partidasExtra?: PartidaCotizador[];
  /** Lo que le falta a eso (la cantidad de algo que eligió), o null. */
  faltaExtra?: string | null;
  /**
   * Enlace y panel (2026-11-06): guardar en qué zona de flete de triturados
   * queda un municipio que no está en ninguna. Quien llama actualiza su
   * tabulador con la respuesta; sin ella, la zona se elige a mano.
   */
  guardarZonaTriturados?: (municipio: string, zonaId: string) => Promise<void>;
  /**
   * Panel y enlace (2026-11-03): las categorías SIN precio de lista que se
   * agregaron (carpeta, block, venta), con los productos de su catálogo. Cada
   * una sale en su tarjeta y lo que se toca se cotiza con precio a mano.
   */
  aMano?: { categorias: Array<{ clave: string; titulo: string; icono: string; productos: ProductoALaMedida[] }>; quitar: (clave: string) => void };
  onEnviar: (datos: DatosEnvio) => Promise<ResultadoEnvio>;
}

/** La sección de lo escrito a mano sin categoría (el «Otro servicio» del panel). */
const A_MANO_SUELTOS = '__a-mano';

/** Las dos pantallas: armar (cliente y lo que se cotiza) y el documento. */
const PASOS = [{ clave: 'armar' }, { clave: 'resumen' }] as const;

/**
 * EL COTIZADOR.
 *
 * Un solo componente para las dos apps y los dos cotizadores. Lo que cambia
 * entre ellos —qué se elige y cómo— vive en `pasos-maquinaria` y
 * `pasos-triturados`; lo que comparten —el cliente, el total, el documento y
 * el envío— vive aquí.
 *
 * Fue por pasos (obra, equipos, duración, servicios, resumen) hasta el
 * 2026-11-03; ahora es una sola pantalla para armar y otra con el documento.
 *
 * El cálculo corre EN EL NAVEGADOR mientras se edita (mismo motor que la API,
 * importado de `@maqserv/config`) y el servidor lo repite al guardar. No es
 * duplicación: es la misma función ejecutada en dos sitios, y la del servidor
 * es la que manda.
 */
export function Cotizador({ catalogo, variante, inicial, lineasIniciales, empresas, clientesPanel, logo, sinUbicacion = false, soloPrecios = false, titulo, categoriasExtra, masServicios, despues, extras, notasExtra = '', partidasExtra, faltaExtra = null, guardarZonaTriturados, aMano, onEnviar }: CotizadorProps) {
  const tipo = catalogo.tipo;
  /**
   * EN UNA SOLA PANTALLA (2026-11-03, con la captura del cotizador de PUCSA:
   * primero el enlace y el mismo día el sitio y el panel). Arriba los datos
   * del cliente, debajo lo que se cotiza y abajo una barra con el total y
   * «Cotización →», que lleva al documento. Son dos pantallas: armar y el
   * documento; ya no hay barra de pasos.
   */
  const pasos = PASOS;
  const esPanel = variante === 'panel';
  /** Triturados: el tabulador de esta cotización, o el que viaja con una de maquinaria (una sola cotización con todo, 2026-11-03). */
  const catTrit = trituradosDe(catalogo);

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

  const opciones: Partial<OpcionesCotizador> = tipo === 'maquinaria' ? { modo_unidad: modoUnidad } : { con_iva: conIva };
  // El agua sin zona elegida a mano toma la del municipio de la obra (2026-10-29).
  // Y al final lo pedido a la medida (sitio): «por cotizar», sin importe.
  const partidas = useMemo(
    () => [...conZonaDeLaObra(catalogo, aPartidas(lineas), ctx.municipio), ...(partidasExtra ?? [])],
    [catalogo, lineas, ctx.municipio, partidasExtra],
  );
  // Triturados con flete: la ubicación en Google Maps va en el documento (2026-10-29).
  const ubicacionValida = !!catTrit && llevaFlete(partidas) && esUbicacionDeMapas(ctx.ubicacion);
  const calc = useMemo(() => calcularCotizacion(catalogo, partidas, opciones), [catalogo, partidas, modoUnidad, conIva]);
  /** Todo lo pedido va a la medida (2026-11-06): todavía no hay precio de lista que enseñar. */
  const todoPorCotizar = calc.total <= 0 && renglonesPorCotizar(calc).length > 0;
  /** El sitio con precios de lista: total grande al final y la nota para mejorar el precio. */
  const sitioConPrecios = verPrecios && !esPanel && !todoPorCotizar;
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
  const enUso = lineas.map((l) => (l.tipo === 'zona' ? l.productoId : 'id' in l ? l.id : ''));
  const paraElegir = useMemo(() => soloVisibles(catalogo, enUso), [catalogo, lineas]);
  const paraElegirTrit = useMemo(() => (catTrit ? (soloVisibles(catTrit, enUso) as CatalogoTriturados) : null), [catTrit, lineas]);

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
   * TRITURADOS: CÓMO LO QUIERE (2026-11-03). En planta, por viaje o pedido
   * grande en tolva o full; una cotización va de una sola forma. Se deduce de
   * lo que ya trae (al volver a una cotización) y se elige con tarjetas.
   */
  /** Lo que ya va puesto en obra (la cal de patio, 2026-11-06): tiene su propia forma. */
  const esEnObra = (id: string) => !!catTrit?.productos.find((p) => p.id === id)?.en_obra;
  const [forma, setForma] = useState<FormaTriturados | null>(() => formaDe(lineasIniciales ?? [], esEnObra));
  const zonaObraTrit = () => (catTrit ? zonaDelMunicipio(catTrit, ctx.municipio) : null);
  /**
   * El municipio que no estaba en ninguna zona (2026-11-06): se guarda en la
   * elegida y los viajes sin zona la toman. El tabulador nuevo llega por
   * `catalogo` cuando quien llama lo actualiza.
   */
  const guardarZona = async (municipio: string, zonaId: string) => {
    if (!guardarZonaTriturados) return;
    await guardarZonaTriturados(municipio, zonaId);
    setLineas((prev) => prev.map((l) => (l.tipo === 'zona' && !l.zonaId ? { ...l, zonaId } : l)));
  };
  /**
   * Con qué entrega nace un material en cada forma: en planta, sin flete; en el
   * grande, tolva y el lugar EN BLANCO (2026-11-06: ahí el flete no va por zona,
   * se escribe el lugar de la obra).
   */
  const entregaDe = (f: FormaTriturados | null, otro?: LineaMaterial): Pick<LineaMaterial, 'fleteTon' | 'fleteZona' | 'camion'> =>
    otro
      ? { fleteTon: otro.fleteTon, fleteZona: otro.fleteZona, camion: otro.camion }
      : f === 'grande'
        ? { fleteTon: 0, fleteZona: '', camion: 'tolva' }
        : { fleteTon: 0, fleteZona: RECOGE_EN_PLANTA, camion: '' };
  const cambiarForma = (f: FormaTriturados) => {
    if (f === forma || !catTrit) return;
    setForma(f);
    const cat = catTrit;
    const zona = zonaObraTrit();
    setLineas((prev) => {
      const todos = prev.filter((l): l is LineaMaterial => l.tipo === 'material');
      const viajes = prev.filter((l): l is LineaZona => l.tipo === 'zona');
      const resto = prev.filter((l) => l.tipo !== 'material' && l.tipo !== 'zona');
      // La cal de patio (2026-11-06) va sola en su forma: al entrar se quedan solo
      // sus renglones; al salir, se van (no se cotiza en planta, viaje ni grande).
      if (f === 'cal') return [...resto, ...todos.filter((l) => esEnObra(l.id))];
      const materiales = todos.filter((l) => !esEnObra(l.id));
      // Lo ya elegido se pasa a la forma nueva: mismo material, otra entrega.
      if (f === 'viaje') {
        const ids = [...new Set([...viajes.map((l) => l.productoId), ...materiales.filter((l) => l.id !== 'custom').map((l) => l.id)])];
        const zonaId = viajes[0]?.zonaId || zona?.id || '';
        return [...resto, ...ids.map((id): LineaZona => viajes.find((l) => l.productoId === id) ?? { ...lineaDeZona(cat), productoId: id, zonaId })];
      }
      const ids = materiales.length ? null : [...new Set(viajes.map((l) => l.productoId))];
      const base = materiales.length ? materiales : (ids ?? []).map((id) => lineaDeMaterial(cat, id));
      return [...resto, ...base.map((l) => ({ ...l, ...entregaDe(f) }))];
    });
  };

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
        ...entregaDe(forma, otro),
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
      const base = lineaDeMaterial(catTrit as CatalogoTriturados, id);
      return [...prev, { ...base, uid, ...entregaDe(forma, otro) }];
    });
    setNuevo(uid);
  };

  /** Por viaje (2026-11-03): tocar un material agrega su viaje (a la zona de los demás o de la obra); otra vez, lo quita. */
  const alternarViaje = (productoId: string) => {
    setLineas((prev) => {
      if (prev.some((l) => l.tipo === 'zona' && l.productoId === productoId)) return prev.filter((l) => !(l.tipo === 'zona' && l.productoId === productoId));
      const otro = prev.find((l): l is LineaZona => l.tipo === 'zona');
      return [...prev, { ...lineaDeZona(catTrit as CatalogoTriturados), productoId, zonaId: otro?.zonaId || zonaObraTrit()?.id || '' }];
    });
  };

  /** Escritos a mano sin categoría (el «Otro servicio» del panel). */
  const sueltos = lineas.filter((l): l is LineaServicio => l.tipo === 'servicio' && l.id === SERVICIO_A_MANO && !l.categoria);
  /** Los renglones de una categoría sin precio, y quitarla con ellos. */
  const deCategoria = (clave: string) => lineas.filter((l): l is LineaServicio => l.tipo === 'servicio' && l.categoria === clave);
  const quitarCategoria = (clave: string) => {
    setLineas((prev) => prev.filter((l) => !(l.tipo === 'servicio' && l.categoria === clave)));
    aMano?.quitar(clave);
  };
  const alternarProducto = (clave: string, p: ProductoALaMedida) =>
    setLineas((prev) =>
      prev.some((l) => l.tipo === 'servicio' && l.categoria === clave && l.nombre === p.nombre)
        ? prev.filter((l) => !(l.tipo === 'servicio' && l.categoria === clave && l.nombre === p.nombre))
        : [...prev, lineaDeServicioAMano({ nombre: p.nombre, unidad: unidadDeProducto(p.unidad), categoria: clave })],
    );

  /**
   * EN EL ORDEN EN QUE SE AGREGAN (2026-11-03, pedido del dueño: "si escojo
   * más de un servicio, que no se suban los campos, que aparezcan abajo").
   * Cada categoría es una sección; la que se agrega sale al final, justo
   * arriba de «¿Necesitas otro servicio?», y no en un lugar fijo más arriba.
   */
  const presentes: string[] = [];
  if (tipo === 'maquinaria') {
    const maq = catalogo as CatalogoMaquinaria;
    if (maq.equipos.length) presentes.push('maquinaria');
    for (const c of COTIZADORES_SITIO) {
      if (c.tipo === 'maquinaria' && c.clave !== 'maquinaria' && (catalogoDelSitio(maq, c) as CatalogoMaquinaria).servicios.length) presentes.push(c.clave);
    }
    for (const c of aMano?.categorias ?? []) presentes.push(c.clave);
  }
  if (catTrit) presentes.push('triturados');
  presentes.push(...Object.keys(extras ?? {}));
  if (sueltos.length) presentes.push(A_MANO_SUELTOS);
  const ordenVisto = useRef<string[]>([]);
  const previo = ordenVisto.current.filter((k) => presentes.includes(k));
  const orden = [...previo, ...presentes.filter((k) => !previo.includes(k))].filter((k, n, a) => a.indexOf(k) === n);
  ordenVisto.current = orden;

  const seccion = (k: string): ReactNode => {
    if (k === 'maquinaria') {
      return (
        <>
          <PasoEquipos
            cat={paraElegir as CatalogoMaquinaria}
            lineas={lineas as LineaMaquinaria[]}
            mostrarPrecios={preciosEnPasos}
            alternar={(id) => alternar(esEquipo(id), () => lineaDeEquipo(id))}
            agregarOtra={(id) => agregar(lineaDeEquipo(id))}
          />
          {lineas.some((l) => l.tipo === 'equipo') ? (
            <PasoDuracion
              cat={catalogo as CatalogoMaquinaria}
              lineas={lineas as LineaMaquinaria[]}
              mostrarPrecios={preciosEnPasos}
              editarPrecios={editarPrecios}
              actualizar={(uid, patch) => actualizar(uid, patch as Partial<LineaEquipo>)}
              quitar={quitar}
            />
          ) : null}
        </>
      );
    }
    if (k === 'triturados') {
      return paraElegirTrit ? (
        <PasoPedido
          encabezado={tipo === 'maquinaria' ? 'Triturados: ¿cómo los quieres?' : undefined}
          cat={paraElegirTrit}
          lineas={lineas as LineaTriturados[]}
          mostrarPrecios={preciosEnPasos}
          editarPrecios={editarPrecios}
          alternarMaterial={alternarMaterial}
          alternarViaje={alternarViaje}
          forma={forma}
          cambiarForma={cambiarForma}
          ubicacion={ctx.ubicacion}
          ponerUbicacion={sinUbicacion ? undefined : (ubicacion) => setCtx((c) => ({ ...c, ubicacion }))}
          ubicacionObligatoria={!esPanel}
          preciosAlFinal={preciosAlFinal}
          permitirOtro={esPanel}
          agregarMaterial={agregarMaterial}
          agregarBanco={() => agregar(lineaDeBanco(catTrit as CatalogoTriturados))}
          actualizar={actualizar}
          quitar={quitar}
          nuevo={nuevo}
          tocado={tocado}
          municipio={ctx.municipio}
          guardarZona={guardarZonaTriturados ? guardarZona : undefined}
        />
      ) : null;
    }
    if (k === A_MANO_SUELTOS) {
      return (
        <div className="cz-card">
          <h2 className="cz-card-h">Otros servicios</h2>
          <p className="cz-card-s">Lo que no está en el tabulador: nombre, unidad y precio a mano.</p>
          <div style={{ marginTop: 16 }}>
            {sueltos.map((l) => (
              <ServicioAMano key={l.uid} l={l} actualizar={(uid, patch) => actualizar(uid, patch)} quitar={quitar} mostrarPrecios={preciosEnPasos} />
            ))}
          </div>
        </div>
      );
    }
    const am = tipo === 'maquinaria' ? aMano?.categorias.find((c) => c.clave === k) : undefined;
    if (am) {
      return (
        <CategoriaAMano
          titulo={am.titulo}
          icono={am.icono}
          productos={am.productos}
          lineas={deCategoria(am.clave)}
          alternar={(p) => alternarProducto(am.clave, p)}
          agregarOtro={() => agregar(lineaDeServicioAMano({ categoria: am.clave }))}
          actualizar={(uid, patch) => actualizar(uid, patch)}
          quitarLinea={quitar}
          quitar={() => quitarCategoria(am.clave)}
          mostrarPrecios={preciosEnPasos}
        />
      );
    }
    if (extras?.[k]) return extras[k];
    // Una categoría de servicios (agua, acarreos…): su propia tarjeta, con su nombre.
    const c = cotizadorDelSitio(k);
    if (!c || tipo !== 'maquinaria') return null;
    const cat = catalogoDelSitio(paraElegir, c) as CatalogoMaquinaria;
    const ids = new Set(cat.servicios.map((sv) => sv.id));
    return (
      <PasoServicios
        titulo={c.titulo}
        cat={cat}
        lineas={lineas.filter((l) => l.tipo === 'servicio' && ids.has(l.id)) as LineaMaquinaria[]}
        mostrarPrecios={preciosEnPasos}
        editarPrecios={editarPrecios}
        municipio={ctx.municipio}
        elegirZona={esPanel}
        alternar={(id) => alternar(esServicio(id), () => lineaDeServicio(catalogo as CatalogoMaquinaria, id))}
        actualizar={(uid, patch) => actualizar(uid, patch as Partial<LineaServicio>)}
        quitar={quitar}
      />
    );
  };

  // ---- validación por paso ----
  const clave = pasos[paso]?.clave ?? '';

  const faltante = useMemo(() => {
    const d = { ctx, lineas, esPanel, calc: calcVista, conClientes: !!clientesPanel, soloPrecios, forma, minimoCamion: faltaMinimoCamion(catalogo, partidas), zona: faltaZona(catalogo, partidas, ctx.municipio), hayExtras: (partidasExtra?.length ?? 0) > 0, faltaExtra };
    if (clave !== 'armar') return validar(clave, d);
    // La pantalla única junta lo que antes eran pasos: se revisa en ese orden.
    const conTriturados = lineas.some((l) => l.tipo === 'material' || l.tipo === 'zona');
    const claves = tipo === 'maquinaria' ? ['obra', 'duracion', 'servicios', ...(conTriturados ? ['pedido'] : [])] : ['obra', 'pedido'];
    for (const k of claves) {
      const f = validar(k, d);
      if (f) return f;
    }
    return null;
  }, [clave, tipo, ctx, lineas, esPanel, calcVista, clientesPanel, soloPrecios, forma, catalogo, partidas, partidasExtra, faltaExtra]);
  const puedeAvanzar = faltante === null;

  /** Al pasar al documento (o volver a editar), la pantalla empieza arriba. */
  const primerPaso = useRef(true);
  useEffect(() => {
    if (primerPaso.current) { primerPaso.current = false; return; }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [paso]);

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
    titulo: titulo ?? tituloDe(catalogo, partidas, categoriasExtra),
    folio,
    cliente: ctx.cliente,
    obra: ctx.obra,
    atencion: ctx.atencion,
    municipio: ctx.municipio,
    notas: [ctx.notas.trim(), notasExtra].filter(Boolean).join('\n\n'),
    empresa: catalogo.empresa,
    firma: catalogo.firma,
    // Solo agua o solo block no es "renta de maquinaria" (2026-11-02).
    saludo: saludoDe(catalogo, partidas),
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
      const notas = [ctx.notas.trim(), notasExtra].filter(Boolean).join('\n\n');
      const r = await onEnviar({ contexto: { ...ctx, notas }, opciones, partidas });
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
    setForma(null);
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
          {despues ? <div className="cz-despues">{despues}</div> : null}
        </div>
      </div>
    );
  }

  const esUltimo = paso === pasos.length - 1;

  return (
    <div className="cz" data-variante={variante}>
      <style>{COTIZADOR_CSS}</style>

      <div className="cz-grid">
        <div>
          {/* El cliente arriba y, debajo, lo que se cotiza (2026-11-03). */}
          {clave === 'armar' ? (
            <div className="cz-cliente">
              {soloPrecios ? (
                <DatosCliente
                  ctx={ctx}
                  setCtx={setCtx}
                  catalogo={catalogo}
                  clientes={clientesPanel?.lista}
                  tocado={tocado}
                  // Solo si se cotiza renta de equipo (2026-11-06): en agua, block o triturados no dice nada.
                  modoUnidad={tipo === 'maquinaria' && (catalogo as CatalogoMaquinaria).equipos.length > 0 ? { valor: modoUnidad, poner: setModoUnidad } : undefined}
                />
              ) : (
                <PasoObra ctx={ctx} setCtx={setCtx} catalogo={catalogo} pideContacto={!esPanel} tocado={tocado} empresas={esPanel ? undefined : empresas ?? []} clientesPanel={esPanel ? clientesPanel : undefined} />
              )}
            </div>
          ) : null}
          {/* Cada categoría en su sección, en el orden en que se agregó (2026-11-03). */}
          {clave === 'armar' ? orden.map((k) => <Fragment key={k}>{seccion(k)}</Fragment>) : null}

          {clave === 'resumen' ? (
            <div className="cz-card">
              <h2 className="cz-card-h">Así queda el documento</h2>
              <p className="cz-card-s">
                {soloPrecios
                  ? 'Revísalo y mándalo por WhatsApp o descárgalo en PDF. Aquí no se guarda nada.'
                  : esPanel
                  ? 'Revísalo antes de guardarlo. Al guardar se congela: aunque mañana suba una tarifa, esta cotización seguirá diciendo lo mismo.'
                  : preciosAlFinal || sitioConPrecios
                    ? 'Este es el costo de lo que armaste, con nuestros precios de lista. Revísalo y, si todo está bien, envía tu solicitud.'
                    : 'Revisa que todo esté correcto antes de enviar tu solicitud. Va sin precios: te mandamos la cotización con precio por correo.'}
              </p>

              {/* Solo con maquinaria: el agua y el retiro van por viaje (2026-10-29). En el enlace va en la tarjeta del cliente. */}
              {tipo === 'maquinaria' && verPrecios && !soloPrecios && lineas.some((l) => l.tipo === 'equipo') ? (
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
              {/* Todo a la medida (2026-11-06): no hay total que decir; el precio llega con la cotización. */}
              {(preciosAlFinal || sitioConPrecios) && !(calc.total <= 0 && renglonesPorCotizar(calc).length) ? (
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


          {clave === 'armar' && (masServicios?.opciones.length || (esPanel && tipo === 'maquinaria')) ? (
            <div className="cz-card">
              <h2 className="cz-card-h">¿Necesitas otro servicio?</h2>
              <p className="cz-card-s">
                {esPanel
                  ? 'Toca uno y se agrega a esta misma cotización con sus opciones. Lo que todavía no tiene precio de lista sale con sus productos y su precio se captura a mano.'
                  : 'Toca uno y se agrega a esta misma solicitud: los que tienen precio aquí salen arriba con sus opciones; los demás, como servicio extra que describes y cuyo precio te confirmamos.'}
              </p>
              {masServicios?.opciones.length ? (
                <div className="cz-cards cz-opciones">
                  {masServicios.opciones.map((o) => (
                    <Tarjeta key={o.clave} icono={o.icono} titulo={o.titulo} nota={o.resumen} modo="agregar" onClick={() => masServicios.agregar(o.clave)} />
                  ))}
                </div>
              ) : null}
              {/* El «Otro servicio» del panel: lo escrito a mano sale en su tarjeta, al final. */}
              {esPanel && tipo === 'maquinaria' ? (
                <button type="button" className="cz-agregar" onClick={() => agregar(lineaDeServicioAMano())} style={{ marginTop: 14 }}>
                  <Plus className="size-4" aria-hidden />
                  Otro servicio (nombre y precio a mano)
                </button>
              ) : null}
            </div>
          ) : null}

          {/* La barra: el total siempre a la vista y el siguiente paso al pulgar. */}
          <div className="cz-barra" role="region" aria-label="Total y siguiente paso">
            <div className="cz-barra-in">
              {tocado && faltante ? <Aviso tono="bad">{faltante}</Aviso> : null}
              <div className="cz-barra-fila" data-final={esUltimo || undefined}>
                {esUltimo ? (
                  <>
                    <ShButton variant="outline" onClick={retroceder} disabled={enviando}>
                      <ArrowLeft className="size-4" /> Editar
                    </ShButton>
                    {soloPrecios ? (
                      // Solo precios: no se guarda nada; se empieza otra.
                      <ShButton variant="outline" onClick={reiniciar}>
                        <RotateCcw className="size-4" /> Nueva cotización
                      </ShButton>
                    ) : (
                      <ShButton onClick={enviar} disabled={enviando}>
                        {enviando ? 'Enviando…' : esPanel ? 'Guardar cotización' : 'Pedir cotización'}
                      </ShButton>
                    )}
                  </>
                ) : (
                  <>
                    {/* Sin nada con precio y con algo a la medida (aunque aún sin cantidad): no hay total que decir. */}
                    {/* En el panel y el enlace siempre el total: ahí quien cotiza pone el precio. */}
                    {verPrecios && (esPanel || !(calc.total <= 0 && (renglonesPorCotizar(calc).length || Object.keys(extras ?? {}).length))) ? (
                      <div className="cz-barra-total">
                        <span>Total {calc.con_iva ? 'con IVA' : 'sin IVA'}{renglonesPorCotizar(calc).length ? ' · más lo por cotizar' : ''}</span>
                        <b>{money(calc.total)}</b>
                      </div>
                    ) : (
                      // Sin precios en el sitio: lo que lleva, y que el precio llega por correo.
                      <div className="cz-barra-total">
                        <span>{partidas.length === 0 ? 'Elige qué necesitas' : partidas.length === 1 ? '1 partida' : `${partidas.length} partidas`}</span>
                        <em>Te mandamos el precio por correo</em>
                      </div>
                    )}
                    <ShButton onClick={avanzar}>
                      Cotización <ArrowRight className="size-4" />
                    </ShButton>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

const OTRA_EMPRESA = '__otra__';

/** Hoy en Monterrey, AAAA-MM-DD: ninguna fecha del servicio puede ser pasada. */
const hoyLocal = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey' }).format(new Date());
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
}) {
  const set = (patch: Partial<ContextoCotizador>) => setCtx({ ...ctx, ...patch });
  if (empresas) return <PasoObraSitio ctx={ctx} set={set} catalogo={catalogo} tocado={tocado} empresas={empresas} />;
  if (clientesPanel) return <PasoObraPanel ctx={ctx} set={set} catalogo={catalogo} tocado={tocado} clientes={clientesPanel} />;
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
}: {
  ctx: ContextoCotizador;
  set: (patch: Partial<ContextoCotizador>) => void;
  catalogo: CatalogoCotizador;
  tocado: boolean;
  clientes: NonNullable<CotizadorProps['clientesPanel']>;
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
      <p className="cz-card-s">Elige un cliente registrado o escribe uno nuevo: se da de alta al guardar, con su obra. Sale impreso en el encabezado.</p>
      <div className="cz-row">
        <Campo label="Cliente o empresa" req ancho="full" help={ctx.cliente.trim() && !ctx.clienteId ? 'Cliente nuevo: se da de alta al guardar.' : undefined}
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
            <Campo label="Dirección de la obra">
              {(id) => <ShInput id={id} value={ctx.direccion} maxLength={300} placeholder="Calle, número y colonia" onChange={(e) => set({ direccion: e.target.value })} />}
            </Campo>
          </>
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
      </div>
    </div>
  );
}

/**
 * EL CLIENTE EN EL ENLACE (2026-11-03, con la captura del cotizador de PUCSA).
 *
 * Una tarjeta compacta arriba de lo que se cotiza, en la misma pantalla:
 * cliente o empresa (registrado o escrito), municipio y atención. El
 * municipio elige solo la zona del agua y del flete. En los equipos, cómo se
 * presentan las cantidades. Ahí no se guarda nada, así que un cliente escrito
 * no se da de alta.
 */
function DatosCliente({
  ctx,
  setCtx,
  catalogo,
  clientes,
  tocado,
  modoUnidad,
}: {
  ctx: ContextoCotizador;
  setCtx: (c: ContextoCotizador) => void;
  catalogo: CatalogoCotizador;
  clientes?: ClientePanel[];
  tocado: boolean;
  /** Solo maquinaria: horas o jornadas en el documento. */
  modoUnidad?: { valor: 'horas' | 'dias'; poner: (v: 'horas' | 'dias') => void };
}) {
  const set = (patch: Partial<ContextoCotizador>) => setCtx({ ...ctx, ...patch });
  const nombres = useMemo(() => [...new Set((clientes ?? []).map((c) => c.name))], [clientes]);
  const elegirCliente = (v: string) => {
    const c = (clientes ?? []).find((x) => x.name.toLowerCase() === v.trim().toLowerCase()) ?? null;
    set({ cliente: c ? c.name : v, clienteId: c?.id ?? null });
  };
  return (
    <div className="cz-card cz-datos">
      <div className="cz-row">
        <Campo label="Cliente o empresa" req ancho="full" error={tocado && ctx.cliente.trim().length < 2 ? 'Elige o escribe a nombre de quién va la cotización.' : null}>
          {(id) => <ShCombobox id={id} value={ctx.cliente} onChange={elegirCliente} options={nombres} placeholder="Busca o escribe el cliente…" buscar="Busca el cliente…" />}
        </Campo>
      </div>
      <div className="cz-dos">
        <Campo label="Municipio">
          {(id) => (
            <ShCombobox id={id} value={ctx.municipio} onChange={(v) => set({ municipio: v })} options={catalogo.municipios} placeholder="Ej. Apodaca" buscar="Busca o escribe el municipio…" />
          )}
        </Campo>
        <Campo label="Atención a">
          {(id) => <ShInput id={id} value={ctx.atencion} maxLength={190} placeholder="Ing. / Lic." onChange={(e) => set({ atencion: e.target.value })} />}
        </Campo>
      </div>
      {modoUnidad ? (
        <div className="cz-row">
          <Campo label="Presentar cantidades en" ancho="full">
            {(id) => (
              <ShSelect value={modoUnidad.valor} onValueChange={(v) => modoUnidad.poner(v as 'horas' | 'dias')}>
                <ShSelectTrigger id={id}><ShSelectValue /></ShSelectTrigger>
                <ShSelectContent>
                  <ShSelectItem value="horas">Horas (HRS)</ShSelectItem>
                  <ShSelectItem value="dias">Jornadas (JOR)</ShSelectItem>
                </ShSelectContent>
              </ShSelect>
            )}
          </Campo>
        </div>
      ) : null}
    </div>
  );
}

/**
 * EL CLIENTE EN EL SITIO (2026-11-03, pedido del dueño: "quita obra, fecha,
 * correo, teléfono"). Empresa o persona —una de las de su cuenta u otra—, el
 * municipio de la obra (pone la zona del agua y del flete) y atención. El
 * correo y el teléfono son los de su cuenta: ahí le llega la cotización.
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
  const falta = (cond: boolean, texto: string) => (tocado && cond ? texto : null);
  const elegirEmpresa = (v: string) => {
    const e = empresas.find((x) => String(x.id) === v);
    // Sin municipio todavía, el de su primera obra con municipio.
    const municipio = ctx.municipio.trim() ? {} : { municipio: e?.sites.find((o) => o.municipality)?.municipality ?? '' };
    set(e ? { clienteId: e.id, cliente: e.name, ...municipio } : { clienteId: null, cliente: '' });
  };

  return (
    <div className="cz-card">
      <h2 className="cz-card-h">Cliente</h2>
      <p className="cz-card-s">A nombre de quién va la cotización. Sale impreso en el encabezado.</p>
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
      </div>
      <div className="cz-dos" style={{ marginTop: 13 }}>
        <Campo label="Municipio" req help="Define la zona del agua y del flete" error={falta(!ctx.municipio.trim(), 'Elige el municipio.')}>
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
        <Campo label="Atención a">
          {(id) => <ShInput id={id} value={ctx.atencion} maxLength={190} placeholder="Ing. / Lic." onChange={(e) => set({ atencion: e.target.value })} />}
        </Campo>
      </div>
    </div>
  );
}

/**
 * "¿QUIERES MEJORAR EL PRECIO?" (2026-10-29): en el sitio los precios son los
 * de lista; quien quiera negociar llama a la línea de MAQSER24. El teléfono es
 * el del documento (Tarifas › Documento), así no hay dos números distintos.
 */
function MejorarPrecio({ telefono, empresa }: { telefono: string; empresa: string }) {
  const tel = telefono.trim();
  if (!tel) return null;
  const marcar = `tel:${tel.replace(/[^\d+]/g, '')}`;
  return (
    <div className="cz-mejorar">
      <b>¿Quieres mejorar el precio?</b>
      <span>
        Estos son nuestros precios de lista. Si quieres negociar el costo, llama a la línea de{' '}
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
      // Una combinada (2026-11-03): sus triturados, igual.
      ...(trituradosDe(cat) && cat.tipo === 'maquinaria' ? { triturados: conPrecioSimbolico(trituradosDe(cat) as CatalogoTriturados) as CatalogoTriturados } : {}),
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
    /** El acceso directo: solo cliente, municipio y atención; sin obra ni fecha (2026-11-03). */
    soloPrecios?: boolean;
    /** Triturados (2026-11-03): la forma elegida y lo que le falta al pedido grande para el mínimo. */
    forma?: FormaTriturados | null;
    minimoCamion?: string | null;
    /** Lo que falta para cobrar el agua por zona (`faltaZona`), o null. */
    zona?: string | null;
    /** El sitio con algo pedido a la medida (2026-11-06): ya hay qué pedir, aunque no haya otra partida. */
    hayExtras?: boolean;
    faltaExtra?: string | null;
  },
): string | null {
  const { ctx, lineas, esPanel, calc } = d;
  // En el panel la zona del agua se puede elegir a mano, aunque el municipio no esté en ninguna.
  const zona = d.zona ? `${d.zona}${esPanel ? ' Si aun así se lleva, elige la zona a mano.' : ''}` : null;

  if (clave === 'obra') {
    if (ctx.cliente.trim().length < 2) return 'Escribe a nombre de quién va la cotización.';
    // En el sitio (2026-11-03): cliente y municipio; el correo y el teléfono son los de su cuenta.
    if (!esPanel) return ctx.municipio.trim() ? null : 'Elige el municipio de la obra.';
    // El enlace solo pide cliente, municipio y atención (2026-11-03): sin obra ni fecha.
    if (esPanel && d.conClientes && !d.soloPrecios && !ctx.obraId && ctx.obra.trim().length < 2) return 'Elige la obra del cliente o escribe el nombre de la obra nueva.';
    if (esPanel && d.conClientes && !d.soloPrecios && !ctx.fecha) return 'Elige la fecha del servicio.';
    return errorContacto('correo', ctx.correo, false) ?? errorContacto('telefono', ctx.telefono, false);
  }

  if (clave === 'servicios') {
    if (d.faltaExtra) return d.faltaExtra;
    if (!lineas.length && !d.hayExtras) return 'Elige al menos una opción para continuar.';
    // El servicio escrito a mano (2026-10-30): sin nombre o sin precio saldría un renglón mudo o en cero.
    const aMano = lineas.filter((l) => l.tipo === 'servicio' && l.id === SERVICIO_A_MANO) as LineaServicio[];
    if (aMano.some((l) => !l.nombre.trim())) return 'Ponle nombre al servicio que escribiste a mano.';
    const sinPrecio = aMano.find((l) => num(l.precio) <= 0);
    if (sinPrecio) return sinPrecio.categoria ? `Captura el precio de ${sinPrecio.nombre.trim()}.` : 'Captura el precio del servicio que escribiste a mano.';
    return zona;
  }

  if (clave === 'duracion') {
    const sinTiempo = lineas.filter((l) => l.tipo === 'equipo' && l.dias < 1 && l.horas < 1);
    return sinTiempo.length > 0 ? 'Hay equipos sin días ni horas: sin duración no se pueden cotizar.' : null;
  }

  if (clave === 'pedido') {
    if (lineas.length === 0) {
      return d.forma
        ? 'Elige al menos un material.'
        : 'Elige cómo lo quieres: lo recoges en planta, por viaje a tu obra, pedido grande o cal de patio.';
    }
    // Cada renglón incompleto se marca en rojo ahí mismo; esto dice cuál falta.
    if (lineas.some((l) => l.tipo === 'material' && !l.id)) return 'Elige qué material es cada partida por tonelada.';
    if (lineas.some((l) => l.tipo === 'material' && l.id === 'custom' && !l.nombre.trim())) return 'Ponle nombre al material que escribiste a mano.';
    if (esPanel && lineas.some((l) => l.tipo === 'material' && l.id === 'custom' && num(l.precio) <= 0)) return 'Captura el precio por tonelada del material que escribiste a mano.';
    if (lineas.some((l) => l.tipo === 'material' && num(l.toneladas) <= 0)) return 'Captura las toneladas de cada material.';
    // Pedido grande (2026-11-03): zona y camión, y desde 100 toneladas.
    const grande = lineas.filter((l): l is LineaMaterial => l.tipo === 'material' && !!l.camion);
    if (grande.some((l) => !l.fleteZona.trim() || l.fleteZona.trim() === RECOGE_EN_PLANTA)) return 'Escribe la zona o el lugar de la obra para el pedido en tolva o full.';
    if (d.minimoCamion) return d.minimoCamion;
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
