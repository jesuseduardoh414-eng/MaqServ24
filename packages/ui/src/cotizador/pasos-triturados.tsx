'use client';

import { useState, type ReactNode } from 'react';
import { MapPin, Plus, X } from 'lucide-react';
import { RECOGE_EN_PLANTA, camionDe, camionesDe, esUbicacionDeMapas, fleteCamion, minimoCamionDe, precioZona, zonaDe, zonaPorNombre, type CatalogoTriturados } from '@maqserv/config';
import { money, money2 } from './formato';
import { Campo, Chip, Contador, NumeroTexto, Tarjeta } from './piezas';
import { IconoCotizador } from './iconos';
import { ShInput } from '../shadcn/input';
import { ShSelect, ShSelectContent, ShSelectItem, ShSelectTrigger, ShSelectValue } from '../shadcn/select';
import { num, type FormaTriturados, type LineaBanco, type LineaMaterial, type LineaTriturados, type LineaZona } from './estado';

/*
 * COTIZADOR DE TRITURADOS (rediseño 2026-10-15).
 *
 * "No entiendo el flujo de cotización, es muy confuso." Antes eran cinco
 * pasos y cuatro maneras distintas de hacer lo mismo:
 *   - un paso "Modalidad" que preguntaba algo abstracto antes de elegir nada;
 *   - en "Materiales", tarjetas que se encendían y apagaban (por tonelada) junto
 *     a tarjetas que sumaban un contador (zona y banco);
 *   - las cantidades, en un bloque "Partidas" aparte, lejos de donde se eligió;
 *   - y un paso "Entrega" con OTRO flete (el de por tonelada) que se confundía
 *     con la "entrega por viaje".
 *
 * Ahora es un solo paso, "Material", con tres secciones —una por cada forma
 * de vender— que funcionan IGUAL: un botón "Agregar", y cada renglón trae ahí
 * mismo lo que hay que capturar (qué, cuánto, precio) y su importe. El flete
 * por tonelada vive dentro de su sección, una sola vez para todo su material:
 * una cotización va a una obra. La factura pasa al resumen, junto al total que
 * mueve.
 *
 * Los datos no cambiaron (mismas partidas y mismo cálculo de
 * `calcularTriturados`): solo cómo se capturan.
 */

/* ── Sección ───────────────────────────────────────────────────────────── */

function Bloque({
  icono,
  titulo,
  desc,
  textoAgregar,
  onAgregar,
  vacio,
  pie,
  tarjetas,
  children,
}: {
  icono: string;
  titulo: string;
  desc: string;
  /** Las opciones para elegir, en tarjetas (los materiales, 2026-10-29). */
  tarjetas?: ReactNode;
  /** Sin él no hay botón de agregar (una sección que ya no se ofrece). */
  textoAgregar?: string;
  onAgregar?: () => void;
  vacio: boolean;
  pie?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="cz-card cz-bloque" data-vacio={vacio || undefined}>
      <header className="cz-bloque-h">
        <span className="ico" aria-hidden><IconoCotizador nombre={icono} size={26} /></span>
        <div>
          <h2 className="cz-card-h">{titulo}</h2>
          <p className="cz-card-s">{desc}</p>
        </div>
      </header>
      {tarjetas}
      {vacio ? null : <div className="cz-filas">{children}</div>}
      {textoAgregar && onAgregar ? (
        <button type="button" className="cz-agregar" onClick={onAgregar}>
          <Plus className="size-4" aria-hidden />
          {textoAgregar}
        </button>
      ) : null}
      {pie}
    </section>
  );
}

/** Quitar un renglón: arriba a la derecha, como en el resto de las tarjetas. */
function Quitar({ onClick, que }: { onClick: () => void; que: string }) {
  return (
    <button type="button" className="cz-rm cz-fila-rm" aria-label={`Quitar ${que}`} title="Quitar" onClick={onClick}>
      <X className="size-4" />
    </button>
  );
}

/** Lo que suma el renglón, a la derecha. */
function Importe({ texto, valor }: { texto: string; valor: string }) {
  return (
    <div className="cz-fila-imp">
      <span>{texto}</span>
      <b>{valor}</b>
    </div>
  );
}

/* ── El paso ───────────────────────────────────────────────────────────── */

export function PasoPedido({
  cat,
  lineas,
  agregarMaterial,
  actualizar,
  quitar,
  mostrarPrecios,
  preciosAlFinal,
  permitirOtro = true,
  nuevo,
  tocado,
  municipio,
  ubicacion = '',
  ponerUbicacion,
  ubicacionObligatoria = false,
  editarPrecios = false,
  alternarMaterial,
  alternarViaje,
  forma,
  cambiarForma,
  encabezado,
  guardarZona,
}: {
  cat: CatalogoTriturados;
  /**
   * Enlace y panel (2026-11-06): guardar en qué zona queda un municipio que no
   * está en ninguna. Sin ella (el sitio), la zona se elige a mano como siempre.
   */
  guardarZona?: (municipio: string, zonaId: string) => Promise<void>;
  /** Dentro de una cotización de maquinaria (2026-11-03): dice que esta parte es de triturados. */
  encabezado?: string;
  lineas: LineaTriturados[];
  /** Cómo lo quiere (2026-11-03): en planta, por viaje o pedido grande. Null: todavía no elige. */
  forma: FormaTriturados | null;
  cambiarForma: (f: FormaTriturados) => void;
  /** Por viaje: tocar un material agrega su viaje o lo quita. */
  alternarViaje: (productoId: string) => void;
  /** Municipio de entrega (paso 1): propone la zona del flete por tonelada. */
  municipio?: string;
  /** Con flete, la ubicación de la obra en Google Maps (2026-10-29). */
  ubicacion?: string;
  ponerUbicacion?: (v: string) => void;
  /** El sitio la exige para cotizar el flete; en el panel es opcional. */
  ubicacionObligatoria?: boolean;
  /** Solo el panel cambia el precio por tonelada o la tarifa del flete en la cotización (2026-10-29). */
  editarPrecios?: boolean;
  /** Elegir un material desde su tarjeta, como la maquinaria (2026-10-29): lo agrega o lo quita. */
  alternarMaterial?: (id: string) => void;
  agregarMaterial: () => void;
  /** Ya no se usa: el material de banco por m³ se quitó del cotizador (2026-10-21). */
  agregarBanco?: () => void;
  /** Parche genérico: cada renglón recibe el suyo ya estrechado a su tipo. */
  actualizar: (uid: number, patch: Record<string, unknown>) => void;
  quitar: (uid: number) => void;
  /** Importes junto a la captura (el panel). */
  mostrarPrecios: boolean;
  /** Hay costo, pero se enseña al final (el sitio con tabulador público). */
  preciosAlFinal?: boolean;
  /** "Otro material" (nombre y precio a mano): solo en el panel. */
  permitirOtro?: boolean;
  /** El renglón recién agregado: su selector de material se abre solo. */
  nuevo?: number | null;
  /** Ya se intentó continuar: los renglones incompletos se marcan. */
  tocado?: boolean;
}) {
  const materiales = lineas.filter((l): l is LineaMaterial => l.tipo === 'material');
  const zonas = lineas.filter((l): l is LineaZona => l.tipo === 'zona');
  const bancos = lineas.filter((l): l is LineaBanco => l.tipo === 'banco');
  const b = cat.material_banco;
  // "Flete a mi obra" elegido y todavía sin zona: solo vive en la pantalla.
  const [quiereFlete, setQuiereFlete] = useState(false);
  // Lleva flete el material con zona (no "recoge en planta"), o un viaje puesto en obra.
  const materialAObra = materiales.length > 0 && (quiereFlete || materiales.some((l) => l.fleteTon > 0 || (!!l.fleteZona.trim() && l.fleteZona.trim() !== RECOGE_EN_PLANTA)));
  const ubicacionCampo = ponerUbicacion
    ? <UbicacionMapas valor={ubicacion} poner={ponerUbicacion} obligatoria={ubicacionObligatoria} tocado={!!tocado} />
    : null;

  /**
   * LO QUE VA YA PUESTO EN OBRA (la cal de patio, 2026-11-06, el dueño: "no va
   * en cómo lo quieres, va como opción de triturado, donde está la grava"): una
   * tarjeta más junto a los demás materiales, pero su renglón se cobra puesto
   * en obra, sin flete aparte, y con su mínimo. SOLO en «Pedido grande»
   * (2026-11-12, el dueño: "la cal solo se puede entregar por tolva"): en
   * planta y por viaje no aparece. Ahí elige camión y lugar como los demás
   * (2026-11-12, el dueño: "deben de salir las 4 opciones, independientemente
   * de qué escoja"), pero no paga flete ni cuenta para las 100 toneladas.
   */
  const esEnObra = (id: string) => !!cat.productos.find((p) => p.id === id)?.en_obra;
  const enObra = cat.productos.filter((p) => p.en_obra && !p.oculto);
  const deTabulador = cat.productos.filter((p) => !p.en_obra);
  /** Los renglones por tonelada que pagan flete y cuentan para el mínimo (sin la cal). */
  const conEntrega = materiales.filter((l) => !esEnObra(l.id));
  const notaEnObra = (p: (typeof enObra)[number]) =>
    mostrarPrecios && p.precio_ton > 0 ? `${money(p.precio_ton)} / ton · puesta en obra` : 'por tonelada · puesta en obra';
  const tarjetaEnObra = (p: (typeof enObra)[number]) =>
    alternarMaterial ? (
      <Tarjeta key={p.id} icono="material" titulo={p.nombre} nota={notaEnObra(p)} n={materiales.filter((l) => l.id === p.id).length} onClick={() => alternarMaterial(p.id)} />
    ) : null;
  const tarjetasPorTon = (conCal: boolean) => alternarMaterial ? (
    <div className="cz-cards" style={{ marginBottom: materiales.length ? 14 : 0 }}>
      {deTabulador.map((p) => (
        <Tarjeta
          key={p.id}
          icono="material"
          titulo={p.nombre}
          nota={mostrarPrecios && p.precio_ton > 0 ? `${money(p.precio_ton)} / ton` : 'por tonelada'}
          n={materiales.filter((l) => l.id === p.id).length}
          onClick={() => alternarMaterial(p.id)}
        />
      ))}
      {conCal ? enObra.map(tarjetaEnObra) : null}
    </div>
  ) : undefined;
  const fila = (l: LineaMaterial) => (
    <FilaMaterial key={l.uid} cat={cat} l={l} actualizar={actualizar} quitar={quitar} mostrarPrecios={mostrarPrecios} editarPrecios={editarPrecios} conTarjetas={!!alternarMaterial} permitirOtro={permitirOtro} abrir={l.uid === nuevo} tocado={tocado} />
  );
  const filasPorTon = materiales.map(fila);
  /** Los renglones de la cal (puesta en obra) en «Por viaje», debajo de los viajes. */
  const filasEnObra = materiales.filter((l) => esEnObra(l.id)).map(fila);
  // Con tarjetas, el botón solo queda para el material escrito a mano (panel).
  const textoOtro = alternarMaterial ? (permitirOtro ? 'Otro material (nombre y precio a mano)' : undefined) : materiales.length ? 'Agregar otro material' : 'Agregar material por tonelada';
  // Una cotización vieja con flete por tonelada y sin camión: se enseña su flete para poder cambiarlo.
  const fleteViejo = materiales.some((l) => l.fleteTon > 0 && !l.camion);
  // Por viaje: el precio de cada material, a la zona del primer viaje (o la de la obra).
  const zonaViaje = zonaDe(cat, zonas[0]?.zonaId ?? '') ?? zonaDelMunicipio(cat, municipio);
  // Por viaje, el precio depende de la zona: si el municipio no está en ninguna, se agrega aquí. (En el pedido grande la zona se escribe libre.)
  const sinZona = guardarZona && forma === 'viaje' && municipio?.trim() && !zonaDelMunicipio(cat, municipio)
    ? <MunicipioSinZona key={municipio} cat={cat} municipio={municipio.trim()} guardar={guardarZona} />
    : null;

  return (
    <>
      <FormaEntrega cat={cat} forma={forma} cambiar={cambiarForma} titulo={encabezado} />
      {sinZona}

      {forma === 'planta' ? (
        <Bloque
          icono="banco"
          titulo="Lo recojo en planta"
          desc="Precio de lista por tonelada, cargado en planta (pedreras Escobedo), si mandas tu volteo, tolva o full. No incluye IVA ni flete."
          textoAgregar={textoOtro}
          onAgregar={agregarMaterial}
          vacio={materiales.length === 0}
          tarjetas={tarjetasPorTon(false)}
          pie={fleteViejo ? (
            <FleteTonelada
              cat={cat} materiales={conEntrega} actualizar={actualizar} mostrarPrecios={mostrarPrecios} editarPrecios={editarPrecios}
              preciosAlFinal={preciosAlFinal} tocado={tocado} municipio={municipio}
              quiereFlete={quiereFlete} ponerQuiereFlete={setQuiereFlete}
              ubicacion={materialAObra ? ubicacionCampo : null}
            />
          ) : null}
        >
          {filasPorTon}
        </Bloque>
      ) : null}

      {forma === 'viaje' ? (
        <>
          <Bloque
            icono="zona"
            titulo="Por viaje a mi obra"
            desc={`${cat.nota_zona}. Elige el material y la zona de tu obra; el precio del viaje ya incluye material y flete.`}
            vacio={zonas.length === 0 && filasEnObra.length === 0}
            tarjetas={
              <div className="cz-cards" style={{ marginBottom: zonas.length || filasEnObra.length ? 14 : 0 }}>
                {deTabulador.map((p) => {
                  const pv = mostrarPrecios && zonaViaje ? precioZona(cat, zonaViaje, p.id) : null;
                  return (
                    <Tarjeta
                      key={p.id}
                      icono="material"
                      titulo={p.nombre}
                      nota={pv ? `${money(pv)} / viaje` : 'por viaje'}
                      n={zonas.filter((l) => l.productoId === p.id).length}
                      onClick={() => alternarViaje(p.id)}
                    />
                  );
                })}
                {/* La cal no va por viaje: solo en «Pedido grande» (en tolva). */}
              </div>
            }
          >
            {zonas.map((l) => (
              <FilaZona key={l.uid} cat={cat} l={l} actualizar={actualizar} quitar={quitar} mostrarPrecios={mostrarPrecios} />
            ))}
            {filasEnObra}
          </Bloque>
          {zonas.length > 0 ? ubicacionCampo : null}
        </>
      ) : null}

      {forma === 'grande' ? (
        <Bloque
          icono="zona"
          titulo="Pedido grande: volteo, tolva o full"
          desc={`Desde ${minimoCamionDe(cat)} toneladas. El material va a precio de lista por tonelada; el flete por tonelada se cotiza según el camión y la ubicación de tu obra.`}
          textoAgregar={textoOtro}
          onAgregar={agregarMaterial}
          vacio={materiales.length === 0}
          tarjetas={tarjetasPorTon(true)}
          // Camión y lugar para todo el pedido, la cal también (2026-11-12: los cuatro
          // camiones siempre); el flete y el mínimo, solo de lo que no es cal.
          pie={materiales.length > 0 ? (
            <EntregaCamion
              cat={cat} materiales={materiales} porTon={conEntrega} actualizar={actualizar} mostrarPrecios={mostrarPrecios} editarPrecios={editarPrecios}
              tocado={tocado} municipio={municipio} ubicacion={ubicacionCampo}
            />
          ) : null}
        >
          {filasPorTon}
        </Bloque>
      ) : null}

      {/*
        Material de banco por m³: QUITADO del cotizador de triturados
        (2026-10-21, pedido del cliente). El de banco se vende por viaje, en
        "Transporte y servicios de obra". La sección solo reaparece, sin botón
        de agregar, en una cotización vieja que ya traía uno, para poder verlo
        y quitarlo.
      */}
      {bancos.length > 0 ? (
        <Bloque
          icono="banco"
          titulo={`${b.nombre}, por m³`}
          desc="El material de banco ya no se cotiza. Este renglón viene de una cotización anterior."
          vacio={false}
        >
          {bancos.map((l) => (
            <FilaBanco key={l.uid} cat={cat} l={l} actualizar={actualizar} quitar={quitar} mostrarPrecios={mostrarPrecios} editarPrecios={editarPrecios} tocado={tocado} />
          ))}
        </Bloque>
      ) : null}
    </>
  );
}

/* ── Cómo lo quiere (2026-11-03) ───────────────────────────────────────── */

/**
 * LAS TRES FORMAS, EN TARJETAS (pedido del dueño): "cuando el cliente va por
 * el material (costos de lista); donde se requiere viaje (material y zona,
 * 14 m³); cuando son pedidos de 100 toneladas, en tolva o full". Cambiar de
 * forma conserva el material elegido y cambia solo cómo se entrega.
 */
function FormaEntrega({ cat, forma, cambiar, titulo }: {
  cat: CatalogoTriturados;
  forma: FormaTriturados | null;
  cambiar: (f: FormaTriturados) => void;
  titulo?: string;
}) {
  return (
    <section className="cz-card">
      <h2 className="cz-card-h">{titulo ?? '¿Cómo lo quieres?'}</h2>
      <p className="cz-card-s">Elige una forma; la cotización va de una sola.</p>
      {/* `cz-opciones`: en el celular, una debajo de otra como renglones (2026-11-06). */}
      <div className="cz-cards cz-opciones">
        <Tarjeta icono="banco" titulo="Lo recojo en planta" nota="Mandas tu camión · precio de lista" modo="opcion" n={forma === 'planta' ? 1 : 0} onClick={() => cambiar('planta')} />
        <Tarjeta icono="zona" titulo="Por viaje a mi obra" nota={cat.nota_zona} modo="opcion" n={forma === 'viaje' ? 1 : 0} onClick={() => cambiar('viaje')} />
        <Tarjeta icono="material" titulo="Pedido grande" nota="Tolva 45-50 ton / full 90-100 ton" modo="opcion" n={forma === 'grande' ? 1 : 0} onClick={() => cambiar('grande')} />
      </div>
    </section>
  );
}

/**
 * EL PEDIDO GRANDE: CAMIÓN Y LUGAR, una sola vez para todo el material (va a
 * una obra). Camiones: tolva, full y de 7 y 14 m³ (2026-11-06). El flete NO
 * sale de las zonas (2026-11-06, el dueño: "en ese tipo de viajes no salen las
 * opciones de las zonas, ya que ahí el flete cambia"): el lugar se escribe
 * libre y, en el panel y el enlace, el flete por tonelada también; sin él, se
 * dice que se confirma aparte.
 *
 * LA CAL TAMBIÉN (2026-11-12): los cuatro camiones y el lugar salen siempre,
 * aunque el pedido sea solo cal; la cal dice en qué camión llega, pero su
 * flete va en su precio y no cuenta para el mínimo. `materiales` son todos
 * (el camión y el lugar se ponen a todos); `porTon`, los que pagan flete.
 */
function EntregaCamion({
  cat, materiales, porTon, actualizar, mostrarPrecios, editarPrecios, tocado, municipio, ubicacion,
}: {
  cat: CatalogoTriturados;
  materiales: LineaMaterial[];
  porTon: LineaMaterial[];
  actualizar: (uid: number, patch: Partial<LineaMaterial>) => void;
  mostrarPrecios: boolean;
  editarPrecios: boolean;
  tocado?: boolean;
  municipio?: string;
  ubicacion?: ReactNode;
}) {
  const primero = porTon[0] ?? materiales[0];
  const aTodos = (patch: Partial<LineaMaterial>) => materiales.forEach((l) => actualizar(l.uid, patch));
  const camion = camionDe(cat, primero.camion);
  const conFlete = porTon.length > 0;
  const ton = porTon.reduce((s, l) => s + num(l.toneladas), 0);
  const minimo = minimoCamionDe(cat);
  const fleteTon = primero.fleteTon;
  /** El lugar de la obra, escrito libre. */
  const lugar = primero.fleteZona.trim() === RECOGE_EN_PLANTA ? '' : primero.fleteZona.trim();
  return (
    <div className="cz-flete">
      <div className="cz-flete-h">
        <b>¿En qué camión y a dónde?</b>
        <span>{conFlete ? 'El flete por tonelada depende del camión y del lugar de la obra.' : 'La cal de patio llega puesta en tu obra: el flete ya va en su precio.'}</span>
      </div>
      <div className="cz-cards cz-cards-2 cz-opciones">
        {camionesDe(cat).map((c) => (
          <Tarjeta
            key={c.id}
            icono="zona"
            titulo={c.nombre}
            // m³ y toneladas de cada camión (2026-11-12: ya no «Puesto en obra»).
            nota={c.detalle && !c.nombre.includes(c.detalle) ? c.detalle : undefined}
            modo="opcion"
            n={primero.camion === c.id ? 1 : 0}
            onClick={() => aTodos({ camion: c.id, fleteTon: 0 })}
          />
        ))}
      </div>
      <div className="cz-entrega-zonas">
        {/* LIBRE (2026-11-06): cualquier lugar; sin las zonas de flete de los viajes. */}
        <label className="cz-lbl" htmlFor="cz-zona-camion">¿A dónde va? <i aria-hidden>*</i></label>
        <ShInput
          id="cz-zona-camion"
          className="max-w-md"
          value={lugar}
          maxLength={120}
          placeholder={municipio?.trim() ? `Ej. ${municipio.trim()}, parque industrial, colonia…` : 'Ej. parque industrial, colonia, municipio…'}
          aria-invalid={(tocado && !lugar) || undefined}
          onChange={(e) => aTodos({ fleteZona: e.target.value })}
        />
        {tocado && !lugar ? <p className="cz-err">Escribe a dónde va: el lugar de la obra.</p> : null}
      </div>
      {/* El mínimo y el flete son de lo que no es cal (la cal lleva su propio mínimo y su flete en el precio). */}
      {conFlete ? (
        <p className={tocado && ton < minimo ? 'cz-err' : 'cz-help'} style={{ margin: 0 }}>
          {ton < minimo ? `Llevas ${ton.toLocaleString('es-MX')} ton: el pedido grande es desde ${minimo}.` : `${ton.toLocaleString('es-MX')} ton en total.`}
        </p>
      ) : null}
      {editarPrecios && conFlete ? (
        <Campo label="Flete por tonelada" help="Escríbelo si ya lo sabes; si no, se confirma aparte.">
          <NumeroTexto ariaLabel="flete por tonelada" placeholder="Ej. 150" valor={primero.fleteTon ? String(primero.fleteTon) : ''} onChange={(v) => aTodos({ fleteTon: num(v) })} />
        </Campo>
      ) : null}
      {conFlete && camion && lugar ? (
        fleteTon > 0 ? (
          mostrarPrecios ? <Importe texto={`Flete en ${camion.nombre.toLowerCase()} · ${ton.toLocaleString('es-MX')} ton × ${money(fleteTon)}`} valor={money(fleteTon * ton)} /> : null
        ) : (
          <p className="cz-help" style={{ margin: 0 }}>El flete en {camion.nombre.toLowerCase()} se confirma aparte: todavía no está en este total.</p>
        )
      ) : null}
      {ubicacion}
    </div>
  );
}

/* ── Ubicación para el flete ───────────────────────────────────────────── */

/**
 * LA UBICACIÓN EN GOOGLE MAPS (2026-10-29): "si requieren que se cotice flete
 * deben enviar ubicación por Google Maps". Con ella MAQSER24 mide los km de la
 * planta a la obra y confirma la zona antes de mandar el precio.
 */
function UbicacionMapas({ valor, poner, obligatoria, tocado }: { valor: string; poner: (v: string) => void; obligatoria: boolean; tocado: boolean }) {
  const v = valor.trim();
  const error = v && !esUbicacionDeMapas(v)
    ? 'No es un enlace de Google Maps. En Maps toca «Compartir» → «Copiar enlace» y pégalo aquí.'
    : tocado && obligatoria && !v ? 'Pega la ubicación de tu obra para cotizar el flete.' : undefined;
  return (
    <div className="cz-ubicacion">
      <b>Ubicación de la obra en Google Maps</b>
      <p className="cz-help">
        Con ella medimos la distancia desde la planta y confirmamos la zona del flete.
      </p>
      <Campo label="Enlace de Google Maps" req={obligatoria} help="En Google Maps toca la obra, luego «Compartir» → «Copiar enlace». También sirven las coordenadas." error={error}>
        {(id) => (
          <ShInput
            id={id}
            value={valor}
            maxLength={500}
            inputMode="url"
            placeholder="https://maps.app.goo.gl/…"
            aria-invalid={!!error || undefined}
            onChange={(e) => poner(e.target.value)}
          />
        )}
      </Campo>
    </div>
  );
}

/* ── Renglones ─────────────────────────────────────────────────────────── */

const OTRO = 'custom';

function FilaMaterial({
  cat, l, actualizar, quitar, mostrarPrecios, editarPrecios, conTarjetas, permitirOtro, abrir, tocado,
}: {
  cat: CatalogoTriturados;
  l: LineaMaterial;
  actualizar: (uid: number, patch: Partial<LineaMaterial>) => void;
  quitar: (uid: number) => void;
  mostrarPrecios: boolean;
  editarPrecios: boolean;
  /** Elegido desde su tarjeta: el renglón dice cuál es en vez de volver a preguntarlo. */
  conTarjetas: boolean;
  permitirOtro: boolean;
  abrir: boolean;
  tocado?: boolean;
}) {
  const esOtro = l.id === OTRO;
  const prod = cat.productos.find((p) => p.id === l.id);
  const precio = num(l.precio) || prod?.precio_ton || 0;
  const ton = num(l.toneladas);
  // La cal de patio (2026-11-06): se cobra el mínimo (28 ton) si piden menos, como el documento.
  const minimo = prod?.en_obra ? Number(prod.minimo_ton ?? 0) : 0;
  const cobradas = Math.max(ton, minimo);

  function elegir(id: string) {
    const p = cat.productos.find((x) => x.id === id);
    actualizar(l.uid, id === OTRO
      ? { id, nombre: '', precio: '' }
      // La cal conserva el camión y el lugar del pedido grande (2026-11-12): ya no se le quitan.
      : { id, nombre: p?.nombre ?? '', precio: p ? String(p.precio_ton) : '' });
  }

  return (
    <div className="cz-fila">
      {conTarjetas && prod ? (
        <Campo label="Material">
          {(id) => <ShInput id={id} value={prod.nombre} readOnly tabIndex={-1} />}
        </Campo>
      ) : conTarjetas && esOtro ? null : (
      <Campo label="Material" req error={tocado && !l.id ? 'Elige el material' : null}>
        {(id) => (
          <ShSelect value={l.id} onValueChange={elegir} defaultOpen={abrir && !l.id}>
            <ShSelectTrigger id={id} aria-label="Material">
              <ShSelectValue placeholder="Elige el material" />
            </ShSelectTrigger>
            <ShSelectContent>
              {cat.productos.map((p) => (
                <ShSelectItem key={p.id} value={p.id}>
                  {mostrarPrecios ? `${p.nombre} · ${money(p.precio_ton)}/ton` : p.nombre}
                </ShSelectItem>
              ))}
              {permitirOtro ? <ShSelectItem value={OTRO}>Otro material…</ShSelectItem> : null}
            </ShSelectContent>
          </ShSelect>
        )}
      </Campo>
      )}
      {esOtro ? (
        <Campo label="Nombre del material" req error={tocado && !l.nombre.trim() ? 'Escribe el nombre' : null}>
          {(id) => (
            <ShInput id={id} placeholder="Ej. Grava 8" maxLength={120} autoFocus={abrir} value={l.nombre} onChange={(e) => actualizar(l.uid, { nombre: e.target.value })} />
          )}
        </Campo>
      ) : null}
      <Campo label="Toneladas" req help={minimo > 0 ? `Mínimo ${minimo.toLocaleString('es-MX')} ton · puesta en obra` : undefined} error={tocado && ton <= 0 ? 'Captura las toneladas' : null}>
        <NumeroTexto decimal ariaLabel="toneladas" placeholder="Ej. 30" valor={l.toneladas} onChange={(v) => actualizar(l.uid, { toneladas: v })} />
      </Campo>
      {editarPrecios ? (
        <Campo
          label="Precio / ton"
          req={esOtro}
          help={prod ? `Tabulador: ${money(prod.precio_ton)}` : esOtro ? 'Precio acordado' : undefined}
          error={tocado && esOtro && num(l.precio) <= 0 ? 'Captura el precio' : null}
        >
          <NumeroTexto decimal ariaLabel="precio por tonelada" valor={l.precio} onChange={(v) => actualizar(l.uid, { precio: v })} />
        </Campo>
      ) : null}
      {mostrarPrecios ? (
        <Importe
          texto={`${cobradas.toLocaleString('es-MX')} ton${ton > 0 && cobradas > ton ? ' (mínimo)' : ''} × ${money2(precio)}${prod?.en_obra ? ' · puesta en obra' : ''}`}
          valor={money(precio * (ton > 0 ? cobradas : 0))}
        />
      ) : null}
      <Quitar onClick={() => quitar(l.uid)} que={l.nombre || 'material'} />
    </div>
  );
}

function FilaZona({
  cat, l, actualizar, quitar, mostrarPrecios,
}: {
  cat: CatalogoTriturados;
  l: LineaZona;
  actualizar: (uid: number, patch: Partial<LineaZona>) => void;
  quitar: (uid: number) => void;
  mostrarPrecios: boolean;
}) {
  const z = zonaDe(cat, l.zonaId);
  const precio = precioZona(cat, z, l.productoId) ?? 0;
  return (
    <div className="cz-fila">
      <Campo label="Zona de entrega" req>
        {(id) => (
          <ShSelect value={l.zonaId} onValueChange={(v) => actualizar(l.uid, { zonaId: v })}>
            <ShSelectTrigger id={id} aria-label="Zona de entrega">
              <ShSelectValue placeholder="Elige la zona" />
            </ShSelectTrigger>
            <ShSelectContent>
              {cat.zonas.map((zz) => (
                <ShSelectItem key={zz.id} value={zz.id}>{zz.nombre}</ShSelectItem>
              ))}
            </ShSelectContent>
          </ShSelect>
        )}
      </Campo>
      <Campo label="Material" req>
        {(id) => (
          <ShSelect value={l.productoId} onValueChange={(v) => actualizar(l.uid, { productoId: v })}>
            <ShSelectTrigger id={id} aria-label="Material del viaje">
              <ShSelectValue placeholder="Elige el material" />
            </ShSelectTrigger>
            <ShSelectContent>
              {cat.productos.filter((p) => !p.en_obra).map((p) => {
                // En el panel, el precio del viaje a ESA zona junto a cada material.
                const pv = mostrarPrecios ? precioZona(cat, z, p.id) : null;
                return (
                  <ShSelectItem key={p.id} value={p.id}>
                    {pv ? `${p.nombre} · ${money(pv)}/viaje` : p.nombre}
                  </ShSelectItem>
                );
              })}
            </ShSelectContent>
          </ShSelect>
        )}
      </Campo>
      <div className="cz-qty">
        <span className="cz-lbl">Viajes</span>
        <Contador valor={l.viajes} min={1} ariaLabel="viajes" onChange={(v) => actualizar(l.uid, { viajes: v })} />
      </div>
      {mostrarPrecios ? <Importe texto={`${l.viajes} × ${money(precio)} por viaje`} valor={money(precio * l.viajes)} /> : null}
      <Quitar onClick={() => quitar(l.uid)} que="viaje" />
    </div>
  );
}

function FilaBanco({
  cat, l, actualizar, quitar, mostrarPrecios, editarPrecios, tocado,
}: {
  cat: CatalogoTriturados;
  l: LineaBanco;
  actualizar: (uid: number, patch: Partial<LineaBanco>) => void;
  quitar: (uid: number) => void;
  mostrarPrecios: boolean;
  editarPrecios: boolean;
  tocado?: boolean;
}) {
  const b = cat.material_banco;
  const m3 = num(l.m3);
  const precio = num(l.precioM3) || b.precio_m3_default;
  const viajes = b.camion_m3 > 0 && m3 > 0 ? Math.ceil(m3 / b.camion_m3) : 0;
  return (
    <div className="cz-fila">
      <Campo
        label="Metros cúbicos"
        req
        help={viajes ? `≈ ${viajes} ${viajes === 1 ? 'camión' : 'camiones'} de ${b.camion_m3} m³` : undefined}
        error={tocado && m3 <= 0 ? 'Captura los m³' : null}
      >
        <NumeroTexto decimal ariaLabel="metros cúbicos" placeholder={`Ej. ${b.camion_m3 || 14}`} valor={l.m3} onChange={(v) => actualizar(l.uid, { m3: v })} />
      </Campo>
      {editarPrecios ? (
        <Campo label="Precio / m³" help="Material y flete">
          <NumeroTexto decimal ariaLabel="precio por metro cúbico" valor={l.precioM3} onChange={(v) => actualizar(l.uid, { precioM3: v })} />
        </Campo>
      ) : null}
      {mostrarPrecios ? <Importe texto={`${m3.toLocaleString('es-MX')} m³ × ${money2(precio)}`} valor={money(precio * m3)} /> : null}
      <Quitar onClick={() => quitar(l.uid)} que={b.nombre.toLowerCase()} />
    </div>
  );
}

/* ── Flete del material por tonelada ───────────────────────────────────── */

/** Lo que se guarda como "zona" cuando el cliente recoge: se distingue de "aún no lo dice". */
export { RECOGE_EN_PLANTA };

/**
 * Flete por tonelada a una zona (2026-10-21, pedido del cliente: "no refleja
 * costo por flete por tonelada; hay que ponerlo dependiendo del lugar de
 * entrega"). Sale del MISMO tabulador de zonas que el viaje puesto en obra:
 * ahí `flete` es lo que cuesta el viaje de `ton_por_viaje` toneladas a esa
 * zona, así que por tonelada es la división, redondeada a pesos
 * ($2,400 ÷ 20 t = $120/ton). Cambiar una zona en Tarifas mueve los dos.
 */
export function fleteTonDeZona(cat: CatalogoTriturados, z: { flete: number } | null | undefined): number {
  return z && cat.ton_por_viaje > 0 ? Math.round(Number(z.flete) / cat.ton_por_viaje) : 0;
}

/**
 * ¿Ya se dijo si se lleva a obra (y a qué zona) o si recogen en planta?
 *
 * Basta con la zona (2026-10-23): en el sitio el tabulador llega en ceros y
 * elegir zona deja el flete en $0; el servidor lo pone con esa zona.
 */
export function entregaDecidida(l: LineaMaterial): boolean {
  return l.fleteTon > 0 || l.fleteZona.trim() !== '';
}

const normal = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\bmty\b/g, 'monterrey').replace(/\s+/g, ' ').trim();

/**
 * La zona que corresponde al municipio de entrega del primer paso, si su
 * nombre lo menciona ("25–30 km · San Nicolás, García"). Primero la
 * coincidencia exacta —"Salinas Victoria" no debe caer en la zona de
 * "Salinas"— y luego la que empieza igual ("Ciénega" ↔ "Ciénega de Flores";
 * "Mty centro" ↔ Monterrey). Sin coincidencia, nada: se elige a mano.
 */
export function zonaDelMunicipio(cat: CatalogoTriturados, municipio: string | null | undefined): CatalogoTriturados['zonas'][number] | null {
  const m = normal(municipio ?? '');
  if (!m) return null;
  const partes = (nombre: string) => nombre.split(/[·,]/).map(normal).filter(Boolean);
  return (
    // Primero los que se le agregaron a la zona (2026-11-06): esos se eligieron a propósito.
    cat.zonas.find((z) => (z.municipios ?? []).some((x) => normal(x) === m)) ??
    cat.zonas.find((z) => partes(z.nombre).some((p) => p === m || p === `${m} centro`)) ??
    cat.zonas.find((z) => partes(z.nombre).some((p) => m.startsWith(`${p} `) || p.startsWith(`${m} `))) ??
    null
  );
}

/**
 * UN MUNICIPIO QUE NO ESTÁ EN NINGUNA ZONA (2026-11-06, el dueño: "cuando
 * hagan falta municipios en triturados, poner un campo para agregarlo"). En el
 * enlace y el panel se elige su zona una vez y se guarda (`guardar`): desde
 * ahí la zona del flete sale sola para ese municipio. Se guarda en la zona del
 * tabulador, así que también se ve y se corrige en Tarifas › Triturados.
 */
function MunicipioSinZona({ cat, municipio, guardar }: {
  cat: CatalogoTriturados;
  municipio: string;
  guardar: (municipio: string, zonaId: string) => Promise<void>;
}) {
  const [zonaId, setZonaId] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="cz-card">
      <h2 className="cz-card-h">{municipio} no está en ninguna zona de flete</h2>
      <p className="cz-card-s">Elige en qué zona queda. Se guarda y la próxima vez su zona sale sola.</p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
        <ShSelect value={zonaId} onValueChange={(v) => { setZonaId(v); setError(null); }}>
          <ShSelectTrigger id="cz-zona-municipio" aria-label={`Zona de ${municipio}`} className="max-w-md">
            <ShSelectValue placeholder={`¿En qué zona queda ${municipio}?`} />
          </ShSelectTrigger>
          <ShSelectContent>
            {cat.zonas.map((z) => <ShSelectItem key={z.id} value={z.id}>{z.nombre}</ShSelectItem>)}
          </ShSelectContent>
        </ShSelect>
        <button
          type="button"
          className="cz-agregar"
          style={{ width: 'auto', padding: '0 16px' }}
          disabled={!zonaId || guardando}
          onClick={async () => {
            setGuardando(true);
            setError(null);
            try {
              await guardar(municipio, zonaId);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'No se pudo guardar. Inténtalo otra vez.');
            } finally {
              setGuardando(false);
            }
          }}
        >
          <Plus className="size-4" aria-hidden />
          {guardando ? 'Guardando…' : `Guardar ${municipio} en esa zona`}
        </button>
      </div>
      {error ? <p className="cz-err" style={{ margin: '8px 0 0' }}>{error}</p> : null}
    </section>
  );
}


/**
 * La zona de entrega del material por tonelada. Elegir una pone su flete por
 * tonelada en todos los renglones; "recoge en planta" lo deja en cero. Una
 * cotización vieja con un área escrita a mano y su tarifa se respeta ("otra").
 */
/**
 * La entrega del material por tonelada, CON TARJETAS (2026-10-29): "si hay
 * flete, ponerlo como opción como los demás, una tarjeta, y de ahí se
 * despliegan las opciones: escogen la zona y mandan su ubicación con Google
 * Maps". Primero planta u obra; con obra, las zonas en tarjetas y debajo la
 * ubicación. Elegir una zona pone su flete por tonelada en todos los
 * renglones; "recoger en planta" lo deja en cero. Un área escrita a mano en
 * una cotización vieja se respeta como una tarjeta más.
 */
/** Valor del seleccionador cuando la zona se escribió a mano (cotizaciones viejas). */
const OTRA_ZONA = '__otra';

function ZonaEntrega({ cat, materiales, aTodos, tocado, municipio, mostrarPrecios, quiereFlete, ponerQuiereFlete }: {
  cat: CatalogoTriturados;
  materiales: LineaMaterial[];
  aTodos: (patch: Partial<LineaMaterial>) => void;
  tocado?: boolean;
  /** El municipio de entrega del primer paso: si una zona lo menciona, se sugiere. */
  municipio?: string;
  mostrarPrecios: boolean;
  /** Eligió "Flete a mi obra" y todavía no la zona (solo vive en la pantalla). */
  quiereFlete: boolean;
  ponerQuiereFlete: (v: boolean) => void;
}) {
  const primero = materiales[0];
  const nombreZona = primero.fleteZona.trim();
  const zona = cat.zonas.find((z) => z.nombre === nombreZona);
  const enPlanta = nombreZona === RECOGE_EN_PLANTA && primero.fleteTon === 0;
  const otra = !enPlanta && !zona && primero.fleteTon > 0;
  const aObra = !enPlanta && (quiereFlete || !!zona || otra);
  const falta = tocado && !entregaDecidida(primero);
  const sugerida = aObra && !zona ? zonaDelMunicipio(cat, municipio) : null;
  const usar = (z: CatalogoTriturados['zonas'][number]) => aTodos({ fleteTon: fleteTonDeZona(cat, z), fleteZona: z.nombre });
  return (
    <div className="cz-entrega">
      <div className="cz-cards cz-cards-2 cz-opciones">
        <Tarjeta
          icono="banco"
          titulo="Lo recojo en planta"
          nota="Sin flete · cargado en planta"
          modo="opcion"
          n={enPlanta ? 1 : 0}
          onClick={() => { ponerQuiereFlete(false); aTodos({ fleteTon: 0, fleteZona: RECOGE_EN_PLANTA }); }}
        />
        <Tarjeta
          icono="zona"
          titulo="Flete a mi obra"
          nota="Se suma por tonelada según la zona"
          modo="opcion"
          n={aObra ? 1 : 0}
          onClick={() => {
            if (aObra) return;
            ponerQuiereFlete(true);
            // Si la obra cae en una zona, queda elegida; si no, se escoge abajo.
            const z = zonaDelMunicipio(cat, municipio);
            aTodos(z ? { fleteTon: fleteTonDeZona(cat, z), fleteZona: z.nombre } : { fleteTon: 0, fleteZona: '' });
          }}
        />
      </div>
      {falta && !aObra ? <p className="cz-err">Elige si lo recogen en planta o si lo llevamos a la obra.</p> : null}
      {aObra ? (
        // La zona, de un seleccionador (2026-10-29, pedido del dueño: "la opción
        // de flete sí es tarjeta, lo demás como antes"): en el celular, una
        // tarjeta por zona era una pantalla entera de bajar.
        <div className="cz-entrega-zonas">
          <label className="cz-lbl" htmlFor="cz-zona-flete">¿A qué zona? <i aria-hidden>*</i></label>
          <ShSelect
            value={zona ? zona.id : otra ? OTRA_ZONA : ''}
            onValueChange={(v) => {
              const z = cat.zonas.find((x) => x.id === v);
              if (z) usar(z);
            }}
          >
            <ShSelectTrigger id="cz-zona-flete" aria-label="Zona de la obra" aria-invalid={(falta && !zona && !otra) || undefined} className="max-w-md">
              <ShSelectValue placeholder="Elige la zona de la obra" />
            </ShSelectTrigger>
            <ShSelectContent>
              {cat.zonas.map((z) => {
                const porTon = fleteTonDeZona(cat, z);
                return (
                  <ShSelectItem key={z.id} value={z.id}>
                    {z.nombre}{mostrarPrecios && porTon > 0 ? ` · ${money(porTon)} / ton` : ''}
                  </ShSelectItem>
                );
              })}
              {otra ? <ShSelectItem value={OTRA_ZONA}>{nombreZona || 'Otra área'}</ShSelectItem> : null}
            </ShSelectContent>
          </ShSelect>
          {sugerida ? (
            <button type="button" className="cz-sugerencia" onClick={() => usar(sugerida)}>
              <MapPin className="size-4" aria-hidden />
              <span>La obra es en {municipio}: usar <b>{sugerida.nombre}</b></span>
            </button>
          ) : null}
          {falta ? <p className="cz-err">Elige la zona de la obra.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Una sola vez para todo el material por tonelada: una cotización va a UNA
 * obra. Lo que se elige aquí se aplica a cada renglón (el cálculo y el
 * documento siguen llevando el flete por partida, como siempre).
 *
 * Antes se escribía el área a mano y la tarifa se escogía aparte de una lista
 * de $50 a $300: en el sitio la escogía el cliente, sin saber cuál le tocaba,
 * y el flete solía quedarse en cero. Ahora la ZONA decide la tarifa; en el
 * panel el asesor aún puede ajustarla.
 */
function FleteTonelada({
  cat, materiales, actualizar, mostrarPrecios, editarPrecios, tocado, municipio, quiereFlete, ponerQuiereFlete, ubicacion,
}: {
  cat: CatalogoTriturados;
  materiales: LineaMaterial[];
  actualizar: (uid: number, patch: Partial<LineaMaterial>) => void;
  mostrarPrecios: boolean;
  editarPrecios: boolean;
  quiereFlete: boolean;
  ponerQuiereFlete: (v: boolean) => void;
  /** La ubicación en Google Maps, dentro de "Flete a mi obra" (2026-10-29). */
  ubicacion?: ReactNode;
  preciosAlFinal?: boolean;
  tocado?: boolean;
  municipio?: string;
}) {
  const primero = materiales[0];
  const distintos = materiales.some((l) => l.fleteTon !== primero.fleteTon);
  const ton = materiales.reduce((s, l) => s + num(l.toneladas), 0);
  const aTodos = (patch: Partial<LineaMaterial>) => materiales.forEach((l) => actualizar(l.uid, patch));

  return (
    <div className="cz-flete">
      <div className="cz-flete-h">
        <b>¿Lo llevamos a obra?</b>
        <span>
          {editarPrecios
            ? 'Es opcional. Con flete, la zona pone la tarifa por tonelada.'
            : 'Es opcional. Si lo llevamos, el flete se suma por tonelada según la zona de tu obra.'}
        </span>
      </div>
      <ZonaEntrega cat={cat} materiales={materiales} aTodos={aTodos} tocado={tocado} municipio={municipio} mostrarPrecios={mostrarPrecios} quiereFlete={quiereFlete} ponerQuiereFlete={ponerQuiereFlete} />
      {/* Sin «Flete por tonelada» a mano (2026-10-29, pedido del dueño: «eso no
          es parte del cotizador»): la tarifa la pone la zona, también en el panel. */}
      {mostrarPrecios && primero.fleteTon > 0 && !distintos ? (
        <Importe texto={`Flete · ${ton.toLocaleString('es-MX')} ton × ${money(primero.fleteTon)}`} valor={money(primero.fleteTon * ton)} />
      ) : null}
      {ubicacion}
    </div>
  );
}

/* ── Facturación (resumen) ─────────────────────────────────────────────── */

/** Con o sin factura: cambia el total y las condiciones del documento. */
export function Facturacion({
  cat,
  conIva,
  setConIva,
}: {
  cat: CatalogoTriturados;
  conIva: boolean;
  setConIva: (v: boolean) => void;
}) {
  return (
    <div className="cz-chips" role="group" aria-label="Facturación">
      <Chip on={conIva} onClick={() => setConIva(true)}>Con factura · IVA {Math.round(cat.iva * 100)}%</Chip>
      <Chip on={!conIva} onClick={() => setConIva(false)}>Remisionado · sin IVA</Chip>
    </div>
  );
}

/**
 * LO QUE MUEVE EL TOTAL, EN EL ÚLTIMO PASO (el sitio).
 *
 * Cuando los importes no acompañan la captura, la tarifa del flete y la
 * factura no pueden elegirse antes: serían precios a ciegas. Se piden aquí,
 * pegadas al documento, donde cada toque se ve reflejado en el total.
 */
/** La entrega con su propio "Flete a mi obra" (para cuando no hay un paso que lo guarde). */
function ZonaEntregaSuelta(props: { cat: CatalogoTriturados; materiales: LineaMaterial[]; aTodos: (patch: Partial<LineaMaterial>) => void }) {
  const [quiereFlete, setQuiereFlete] = useState(false);
  return <ZonaEntrega {...props} mostrarPrecios quiereFlete={quiereFlete} ponerQuiereFlete={setQuiereFlete} />;
}

export function AjustesDelTotal({
  cat,
  lineas,
  actualizar,
  conIva,
  setConIva,
}: {
  cat: CatalogoTriturados;
  lineas: LineaTriturados[];
  actualizar: (uid: number, patch: Partial<LineaMaterial>) => void;
  conIva: boolean;
  setConIva: (v: boolean) => void;
}) {
  const materiales = lineas.filter((l): l is LineaMaterial => l.tipo === 'material');
  const primero = materiales[0];
  const ton = materiales.reduce((s, l) => s + num(l.toneladas), 0);
  const aTodos = (patch: Partial<LineaMaterial>) => materiales.forEach((l) => actualizar(l.uid, patch));
  return (
    <div className="cz-ajuste">
      <header>
        <h3>Flete y facturación</h3>
        <p>Es lo último que mueve el total. Cámbialo aquí y el documento de abajo se actualiza solo.</p>
      </header>
      {primero ? (
        // El cliente ya no escoge una tarifa a ciegas: cambia la ZONA y ve el flete que le toca.
        <div className="cz-qty wide">
          <span className="cz-lbl">
            Flete del material · {ton.toLocaleString('es-MX')} ton
            {primero.fleteTon > 0 ? ` × ${money(primero.fleteTon)} por tonelada = ${money(primero.fleteTon * ton)}` : primero.fleteZona.trim() === RECOGE_EN_PLANTA ? ' · lo recogen en planta, sin flete' : ''}
          </span>
          <ZonaEntregaSuelta cat={cat} materiales={materiales} aTodos={aTodos} />
        </div>
      ) : null}
      <div className="cz-qty wide">
        <span className="cz-lbl">Facturación</span>
        <Facturacion cat={cat} conIva={conIva} setConIva={setConIva} />
      </div>
    </div>
  );
}
